'use client';

import React, { useState, useRef } from 'react';

interface KnowledgeDocument {
  id: string;
  title: string;
  description?: string;
  modality?: string;
  category?: string;
  tags: string[];
  priority: string;
  chunkCount: number;
  fileSize?: number;
  fileType?: string;
  type: 'file' | 'text';
}

interface KnowledgeBaseAdminProps {
  isDarkMode: boolean;
  accessToken: string;
}

const KnowledgeBaseAdmin: React.FC<KnowledgeBaseAdminProps> = ({ isDarkMode, accessToken }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'browse' | 'stats'>('upload');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Browse tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModality, setSelectedModality] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'date' | 'size'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    modality: '',
    category: '',
    tags: '',
    priority: 'medium'
  });
  
  // Text form state
  const [textForm, setTextForm] = useState({
    title: '',
    content: '',
    description: '',
    modality: '',
    category: '',
    tags: '',
    priority: 'medium'
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    };

    // Nur Content-Type setzen wenn es nicht bereits gesetzt ist (für File-Uploads)
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      throw new Error('Unauthorized');
    }

    return response;
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      const file = fileInputRef.current?.files?.[0];
      
      if (!file) {
        throw new Error('Bitte wählen Sie eine Datei aus');
      }

      formData.append('file', file);
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('modality', uploadForm.modality);
      formData.append('category', uploadForm.category);
      formData.append('tags', uploadForm.tags);
      formData.append('priority', uploadForm.priority);

      const response = await apiCall('http://localhost:3001/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload fehlgeschlagen');
      }

      const result = await response.json();
      setSuccess(`Dokument "${result.document.title}" erfolgreich hochgeladen (${result.document.chunkCount} Chunks)`);
      
      // Form zurücksetzen
      setUploadForm({
        title: '',
        description: '',
        modality: '',
        category: '',
        tags: '',
        priority: 'medium'
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Dokumente neu laden wenn Browse-Tab aktiv ist
      if (activeTab === 'browse') {
        loadDocuments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleTextUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiCall('http://localhost:3001/api/knowledge/text', {
        method: 'POST',
        body: JSON.stringify({
          title: textForm.title,
          content: textForm.content,
          description: textForm.description,
          modality: textForm.modality,
          category: textForm.category,
          tags: textForm.tags ? textForm.tags.split(',').map(tag => tag.trim()) : [],
          priority: textForm.priority
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Text-Upload fehlgeschlagen');
      }

      const result = await response.json();
      setSuccess(`Text "${result.document.title}" erfolgreich hinzugefügt (${result.document.chunkCount} Chunks)`);
      
      // Form zurücksetzen
      setTextForm({
        title: '',
        content: '',
        description: '',
        modality: '',
        category: '',
        tags: '',
        priority: 'medium'
      });
      
      // Dokumente neu laden wenn Browse-Tab aktiv ist
      if (activeTab === 'browse') {
        loadDocuments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Text-Upload fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Browse tab functions
  const searchDocuments = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (searchQuery.trim()) {
        // Echte Suche mit Query
        const params = new URLSearchParams();
        params.append('q', searchQuery);
        if (selectedModality) params.append('modality', selectedModality);
        if (selectedCategory) params.append('category', selectedCategory);
        
        const response = await apiCall(`http://localhost:3001/api/knowledge/search?${params.toString()}`, {
          method: 'GET',
        });

        if (response.ok) {
          const result = await response.json();
          // Konvertiere RAG-Ergebnisse zu Dokumentenformat
          const documents = result.results?.map((item: any, index: number) => ({
            id: `search_${index}`,
            title: item.metadata?.title || `Suchergebnis ${index + 1}`,
            description: item.content?.substring(0, 100) + '...',
            modality: item.metadata?.modality || '',
            category: item.metadata?.category || '',
            tags: item.metadata?.tags || [],
            priority: item.metadata?.priority || 'medium',
            chunkCount: 1,
            fileSize: item.content?.length || 0,
            type: 'text'
          })) || [];
          setDocuments(documents);
        } else {
          setError('Fehler bei der Suche');
        }
      } else {
        // Keine Query = alle Dokumente laden
        loadDocuments();
      }
    } catch (err: any) {
      setError(`Fehler bei der Suche: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await apiCall(`http://localhost:3001/api/knowledge/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Dokument erfolgreich gelöscht!');
        setSelectedDocuments([]);
        setShowDeleteConfirm(false);
        loadDocuments(); // Refresh list
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Fehler beim Löschen des Dokuments');
      }
    } catch (err: any) {
      setError(`Fehler beim Löschen des Dokuments: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedDocuments = async () => {
    setLoading(true);
    setError('');
    
    try {
      const deletePromises = selectedDocuments.map(id => 
        apiCall(`http://localhost:3001/api/knowledge/${id}`, {
          method: 'DELETE',
        })
      );
      
      await Promise.all(deletePromises);
      setSuccess(`${selectedDocuments.length} Dokument(e) erfolgreich gelöscht!`);
      setSelectedDocuments([]);
      setShowDeleteConfirm(false);
      loadDocuments(); // Refresh list
    } catch (err: any) {
      setError(`Fehler beim Löschen der Dokumente: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const selectAllDocuments = () => {
    setSelectedDocuments(documents.map(doc => doc.id));
  };

  const clearSelection = () => {
    setSelectedDocuments([]);
  };

  // Load documents when browse tab is activated
  React.useEffect(() => {
    if (activeTab === 'browse') {
      loadDocuments();
    }
  }, [activeTab]);

  // Filter and sort documents
  const filteredDocuments = React.useMemo(() => {
    let filtered = documents.filter(doc => {
      const matchesSearch = !searchQuery || 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesModality = !selectedModality || doc.modality === selectedModality;
      const matchesCategory = !selectedCategory || doc.category === selectedCategory;
      
      return matchesSearch && matchesModality && matchesCategory;
    });

    // Sort documents
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
          comparison = new Date(a.id).getTime() - new Date(b.id).getTime();
          break;
        case 'size':
          comparison = (a.fileSize || 0) - (b.fileSize || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [documents, searchQuery, selectedModality, selectedCategory, sortBy, sortOrder]);

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await apiCall('http://localhost:3001/api/knowledge/documents', {
        method: 'GET',
      });

      if (response.ok) {
        const result = await response.json();
        setDocuments(result.documents || []);
      } else {
        setError('Fehler beim Laden der Dokumente');
      }
    } catch (err: any) {
      setError(`Fehler beim Laden der Dokumente: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'best_practices', name: 'Best Practices', description: 'Empfehlungen für optimale Befundschreibung' },
    { id: 'guidelines', name: 'Leitlinien', description: 'Medizinische Leitlinien und Standards' },
    { id: 'glossaries', name: 'Glossare', description: 'Terminologie und Klassifikationen' },
    { id: 'literature', name: 'Literatur', description: 'Relevante wissenschaftliche Literatur' },
    { id: 'modality_specific', name: 'Modalitätsspezifisch', description: 'Spezifische Inhalte für bestimmte Modalitäten' }
  ];

  const modalities = [
    { id: 'CT', name: 'Computertomographie' },
    { id: 'MRI', name: 'Magnetresonanztomographie' },
    { id: 'Sonografie', name: 'Sonografie' },
    { id: 'Röntgen', name: 'Röntgen' },
    { id: 'Durchleuchtung', name: 'Durchleuchtung' },
    { id: 'PET/CT', name: 'PET/CT' }
  ];

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          📚 Wissensdatenbank-Verwaltung
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? isDarkMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'browse'
                ? isDarkMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Durchsuchen
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'stats'
                ? isDarkMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Statistiken
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className={`mb-4 p-4 rounded-lg ${isDarkMode ? 'bg-red-900/30 border border-red-500' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
            ❌ {error}
          </p>
        </div>
      )}

      {success && (
        <div className={`mb-4 p-4 rounded-lg ${isDarkMode ? 'bg-green-900/30 border border-green-500' : 'bg-green-50 border border-green-200'}`}>
          <p className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
            ✅ {success}
          </p>
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* File Upload */}
          <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              📁 Datei hochladen
            </h3>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Datei auswählen
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  required
                />
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Unterstützte Formate: PDF, DOCX, TXT, JPG, JPEG, PNG (max. 50MB)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Titel *
                  </label>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    className={`w-full p-3 border rounded-lg ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                    placeholder="z.B. CT-Leitlinien Lungenrundherde"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Modalität
                  </label>
                  <select
                    value={uploadForm.modality}
                    onChange={(e) => setUploadForm({ ...uploadForm, modality: e.target.value })}
                    className={`w-full p-3 border rounded-lg ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="">Alle Modalitäten</option>
                    {modalities.map(mod => (
                      <option key={mod.id} value={mod.id}>{mod.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Kategorie
                  </label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    className={`w-full p-3 border rounded-lg ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="">Kategorie wählen</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Priorität
                  </label>
                  <select
                    value={uploadForm.priority}
                    onChange={(e) => setUploadForm({ ...uploadForm, priority: e.target.value })}
                    className={`w-full p-3 border rounded-lg ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Beschreibung
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  rows={3}
                  placeholder="Kurze Beschreibung des Inhalts..."
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Tags (kommagetrennt)
                </label>
                <input
                  type="text"
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  placeholder="z.B. Lungenrundherde, CT, Leitlinien"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  loading
                    ? isDarkMode
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {loading ? '⏳ Wird hochgeladen...' : '📤 Datei hochladen'}
              </button>
            </form>
          </div>

          {/* Text Upload */}
          <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              📝 Text direkt hinzufügen
            </h3>
            <form onSubmit={handleTextUpload} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Titel *
                  </label>
                  <input
                    type="text"
                    value={textForm.title}
                    onChange={(e) => setTextForm({ ...textForm, title: e.target.value })}
                    className={`w-full p-3 border rounded-lg ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                    placeholder="z.B. Befundschreib-Empfehlungen"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Modalität
                  </label>
                  <select
                    value={textForm.modality}
                    onChange={(e) => setTextForm({ ...textForm, modality: e.target.value })}
                    className={`w-full p-3 border rounded-lg ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="">Alle Modalitäten</option>
                    {modalities.map(mod => (
                      <option key={mod.id} value={mod.id}>{mod.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Inhalt *
                </label>
                <textarea
                  value={textForm.content}
                  onChange={(e) => setTextForm({ ...textForm, content: e.target.value })}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  rows={8}
                  placeholder="Geben Sie hier den Text ein, der zur Wissensdatenbank hinzugefügt werden soll..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Kategorie
                  </label>
                  <select
                    value={textForm.category}
                    onChange={(e) => setTextForm({ ...textForm, category: e.target.value })}
                    className={`w-full p-3 border rounded-lg ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="">Kategorie wählen</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Priorität
                  </label>
                  <select
                    value={textForm.priority}
                    onChange={(e) => setTextForm({ ...textForm, priority: e.target.value })}
                    className={`w-full p-3 border rounded-lg ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Beschreibung
                </label>
                <textarea
                  value={textForm.description}
                  onChange={(e) => setTextForm({ ...textForm, description: e.target.value })}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  rows={2}
                  placeholder="Kurze Beschreibung des Inhalts..."
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Tags (kommagetrennt)
                </label>
                <input
                  type="text"
                  value={textForm.tags}
                  onChange={(e) => setTextForm({ ...textForm, tags: e.target.value })}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  placeholder="z.B. Befundschreibung, Best Practices"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  loading
                    ? isDarkMode
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {loading ? '⏳ Wird hinzugefügt...' : '📝 Text hinzufügen'}
              </button>
            </form>
          </div>
        </div>
      )}


      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <div className="space-y-6">
          {/* Search and Filter Controls */}
          <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              🔍 Dokumente durchsuchen
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* Search Input */}
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Suchbegriff
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  placeholder="Titel, Beschreibung oder Tags durchsuchen..."
                />
              </div>

              {/* Modality Filter */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Modalität
                </label>
                <select
                  value={selectedModality}
                  onChange={(e) => setSelectedModality(e.target.value)}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                >
                  <option value="">Alle Modalitäten</option>
                  {modalities.map(mod => (
                    <option key={mod.id} value={mod.id}>{mod.name}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Kategorie
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                >
                  <option value="">Alle Kategorien</option>
                  <option value="Best Practices">Best Practices</option>
                  <option value="Leitlinien">Leitlinien</option>
                  <option value="Glossar">Glossar</option>
                  <option value="Klassifikationen">Klassifikationen</option>
                  <option value="Literatur">Literatur</option>
                </select>
              </div>
            </div>

            {/* Sort Controls */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Sortieren nach:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'title' | 'date' | 'size')}
                  className={`p-2 border rounded ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                >
                  <option value="title">Titel</option>
                  <option value="date">Datum</option>
                  <option value="size">Dateigröße</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className={`p-2 rounded ${
                    isDarkMode
                      ? 'bg-gray-600 hover:bg-gray-500 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>

              <button
                onClick={searchDocuments}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {loading ? 'Suche...' : 'Suchen'}
              </button>

              <button
                onClick={loadDocuments}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : isDarkMode
                      ? 'bg-gray-600 hover:bg-gray-500 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Alle laden
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedDocuments.length > 0 && (
            <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-yellow-600 bg-yellow-900/20' : 'border-yellow-300 bg-yellow-50'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  {selectedDocuments.length} Dokument(e) ausgewählt
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={clearSelection}
                    className={`px-3 py-1 text-sm rounded ${
                      isDarkMode
                        ? 'bg-gray-600 hover:bg-gray-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    Auswahl aufheben
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Documents List */}
          <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                📄 Dokumente ({filteredDocuments.length})
              </h3>
              {documents.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={selectAllDocuments}
                    className={`px-3 py-1 text-sm rounded ${
                      isDarkMode
                        ? 'bg-gray-600 hover:bg-gray-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    Alle auswählen
                  </button>
                  <button
                    onClick={clearSelection}
                    className={`px-3 py-1 text-sm rounded ${
                      isDarkMode
                        ? 'bg-gray-600 hover:bg-gray-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    Auswahl aufheben
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  📚 Lade Dokumente...
                </div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8">
                <div className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  📭 Keine Dokumente gefunden
                </div>
                <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {documents.length === 0 
                    ? 'Die Wissensdatenbank ist noch leer. Laden Sie Ihr erstes Dokument hoch!'
                    : 'Versuchen Sie andere Suchkriterien oder Filter.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      selectedDocuments.includes(doc.id)
                        ? isDarkMode
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-blue-300 bg-blue-50'
                        : isDarkMode
                          ? 'border-gray-600 bg-gray-800 hover:bg-gray-750'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />

                      {/* Document Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {doc.title}
                            </h4>
                            {doc.description && (
                              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {doc.description}
                              </p>
                            )}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => deleteDocument(doc.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Dokument löschen"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-4 mt-3 text-sm">
                          {doc.modality && (
                            <span className={`px-2 py-1 rounded ${
                              isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                            }`}>
                              📊 {doc.modality}
                            </span>
                          )}
                          {doc.category && (
                            <span className={`px-2 py-1 rounded ${
                              isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                            }`}>
                              📁 {doc.category}
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded ${
                            isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                          }`}>
                            📄 {doc.chunkCount} Chunks
                          </span>
                          {doc.fileSize && (
                            <span className={`px-2 py-1 rounded ${
                              isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                            }`}>
                              💾 {(doc.fileSize / 1024).toFixed(1)} KB
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded ${
                            isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {doc.type === 'file' ? '📁 Datei' : '📝 Text'}
                          </span>
                        </div>

                        {/* Tags */}
                        {doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {doc.tags.map((tag, index) => (
                              <span
                                key={index}
                                className={`px-2 py-1 text-xs rounded ${
                                  isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className={`p-6 rounded-lg shadow-lg max-w-md w-full mx-4 ${
                isDarkMode ? 'bg-gray-800' : 'bg-white'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  🗑️ Dokumente löschen
                </h3>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Möchten Sie {selectedDocuments.length} Dokument(e) wirklich löschen? 
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      isDarkMode
                        ? 'bg-gray-600 hover:bg-gray-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={deleteSelectedDocuments}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {loading ? 'Lösche...' : 'Löschen'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            📊 Statistiken
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Hier werden Statistiken zur Wissensdatenbank angezeigt. (Coming Soon)
          </p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseAdmin;
