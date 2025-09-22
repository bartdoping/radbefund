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
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
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
      
      // Dokumente neu laden
      loadDocuments();
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
      
      // Dokumente neu laden
      loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Text-Upload fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      // TODO: Implementiere GET /api/knowledge/documents endpoint
      console.log('Loading documents...');
    } catch (err) {
      console.error('Error loading documents:', err);
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
        <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            📚 Wissensdatenbank durchsuchen
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Hier können Sie die Wissensdatenbank durchsuchen und verwalten. (Coming Soon)
          </p>
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
