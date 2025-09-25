'use client';

import { useState, useEffect } from 'react';
import AuthModal from './components/AuthModal';
import LayoutSelector from './components/LayoutSelector';
import KnowledgeBaseAdmin from './components/KnowledgeBaseAdmin';
// import { API_URL } from '../lib/api'; // Unused import
import { apiClient } from '../lib/api-client';

// Additional Info Modal Component
interface AdditionalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
  type: 'vorbefund' | 'zusatzinfo';
  isDarkMode: boolean;
}

function AdditionalInfoModal({ isOpen, onClose, onSave, type, isDarkMode }: AdditionalInfoModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && content.trim()) {
      onSave(title.trim(), content.trim());
      setTitle('');
      setContent('');
    }
  };

  const handleClose = () => {
    setTitle('');
    setContent('');
    onClose();
  };

  if (!isOpen) return null;

  const typeLabels = {
    vorbefund: {
      title: 'Vorbefund hinzufügen',
      description: 'Fügen Sie Vorbefunde von Voruntersuchungen hinzu (z.B. CT, MRT, Röntgen)',
      placeholder: 'z.B. CT Thorax vom 15.01.2024'
    },
    zusatzinfo: {
      title: 'Zusatzinformation hinzufügen',
      description: 'Fügen Sie weitere relevante Informationen hinzu (Laborbefunde, Pathologie, OP-Berichte, etc.)',
      placeholder: 'z.B. Laborbefund, Pathologiebefund, OP-Bericht'
    }
  };

  const labels = typeLabels[type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden`}>
        <div className={`${isDarkMode ? 'border-gray-700' : 'border-gray-200'} border-b p-6`}>
          <div className="flex justify-between items-center">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {labels.title}
            </h2>
            <button
              onClick={handleClose}
              className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {labels.description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Titel
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={labels.placeholder}
              className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Inhalt
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Fügen Sie hier den vollständigen Inhalt ein..."
              rows={8}
              className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !content.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              Hinzufügen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Structured Result Display Component
interface StructuredResultDisplayProps {
  result: string;
  isDarkMode: boolean;
}

function StructuredResultDisplay({ result, isDarkMode }: StructuredResultDisplayProps) {
  // Parse the result to extract different sections
  const parseResult = (text: string) => {
    const sections: { [key: string]: string } = {};
    
    // Split by section headers
    const sectionRegex = /\*\*(VERBESSERTER BEFUND|BEFUND|BEURTEILUNG|KLINISCHE EMPFEHLUNGEN|ZUSATZINFORMATIONEN.*?):\*\*/gi;
    const parts = text.split(sectionRegex);
    
    for (let i = 1; i < parts.length; i += 2) {
      const sectionName = parts[i].toLowerCase();
      const sectionContent = parts[i + 1]?.trim() || '';
      
      if (sectionName.includes('befund') || sectionName.includes('verbesserter')) {
        sections.befund = sectionContent;
      } else if (sectionName.includes('beurteilung')) {
        sections.beurteilung = sectionContent;
      } else if (sectionName.includes('empfehlung')) {
        sections.empfehlungen = sectionContent;
      } else if (sectionName.includes('zusatz') || sectionName.includes('differential')) {
        sections.zusatzinformationen = sectionContent;
      }
    }
    
    return sections;
  };

  const sections = parseResult(result);
  
  const copyToClipboard = async (text: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const renderSection = (title: string, content: string, sectionKey: string) => {
    if (!content) return null;
    
    // Special handling for Befund section to format Voruntersuchungen
    const formatBefundContent = (text: string) => {
      // Check if Voruntersuchungen section exists
      const voruntersuchungenMatch = text.match(/^Voruntersuchungen:\s*(.+?)(?:\n\n|\n$)/m);
      
      if (voruntersuchungenMatch) {
        const voruntersuchungen = voruntersuchungenMatch[1];
        const restOfBefund = text.replace(/^Voruntersuchungen:\s*.+?(?:\n\n|\n$)/m, '').trim();
        
        return (
          <div>
            <div className="mb-2">
              <span className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Voruntersuchungen:
              </span>
              <span className={`ml-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {voruntersuchungen}
              </span>
            </div>
            {restOfBefund && (
              <div className="mt-3">
                <pre className="whitespace-pre-wrap font-mono text-sm">{restOfBefund}</pre>
              </div>
            )}
          </div>
        );
      }
      
      // If no Voruntersuchungen section, display as normal
      return <pre className="whitespace-pre-wrap font-mono text-sm">{text}</pre>;
    };
    
    return (
      <div key={sectionKey} className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 mb-4`}>
        <div className="flex justify-between items-center mb-2">
          <h4 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {title}:
          </h4>
          <button
            onClick={() => copyToClipboard(content, sectionKey)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              isDarkMode 
                ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            Kopieren
          </button>
        </div>
        <div className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          {sectionKey === 'befund' ? formatBefundContent(content) : <pre className="whitespace-pre-wrap font-mono">{content}</pre>}
        </div>
      </div>
    );
  };

  // If no structured sections found, show as plain text
  if (Object.keys(sections).length === 0) {
    return (
      <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
        <pre className={`whitespace-pre-wrap text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          {result}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderSection('Befund', sections.befund, 'befund')}
      {renderSection('Beurteilung', sections.beurteilung, 'beurteilung')}
      {renderSection('Klinische Empfehlungen', sections.empfehlungen, 'empfehlungen')}
      {renderSection('Zusatzinformationen / Differentialdiagnosen', sections.zusatzinformationen, 'zusatzinformationen')}
    </div>
  );
}

interface WorkflowOptions {
  option1: boolean;
  option2: boolean;
  option3: boolean;
  option4: boolean;
  option5: boolean;
}

interface Layout {
  id: string;
  name: string;
  description: string;
  template: string;
  createdAt: string;
  isDefault?: boolean;
}

interface AdditionalInfo {
  id: string;
  type: 'vorbefund' | 'zusatzinfo';
  title: string;
  content: string;
  createdAt: string;
}

interface BefundHistory {
  id: string;
  title: string;
  originalText: string;
  result: string;
  workflowOptions: WorkflowOptions;
  selectedLayout: string | null;
  selectedModalitaet: string;
  additionalInfo: AdditionalInfo[];
  isFavorite: boolean;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  organization?: string;
  createdAt: string;
  lastLogin?: string;
}

export default function Home() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workflowOptions, setWorkflowOptions] = useState<WorkflowOptions>({
    option1: true,
    option2: false,
    option3: false,
    option4: false,
    option5: false,
  });

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  
  // Admin check
  const isAdmin = user?.email === 'ahmadh.mustafaa@gmail.com';

  // Layout state
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);

  // Befund history state
  const [befundHistory, setBefundHistory] = useState<BefundHistory[]>([]);
  const [selectedBefund, setSelectedBefund] = useState<string | null>(null);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Additional info state
  const [additionalInfo, setAdditionalInfo] = useState<AdditionalInfo[]>([]);
  const [showVorbefundModal, setShowVorbefundModal] = useState(false);
  const [showZusatzinfoModal, setShowZusatzinfoModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(1); // 1 = first confirmation, 2 = second confirmation

  // Modalität state
  const [selectedModalitaet, setSelectedModalitaet] = useState<string>('CT');

  // Favoriten und Suche state
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Knowledge Base state
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);

  // Loading progress state
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');

  // Load saved data on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    const savedToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    const savedDarkMode = localStorage.getItem('darkMode');
    const savedBefundHistory = localStorage.getItem('befundHistory');
    
    // Check if we have valid saved credentials
    if (savedUser && savedToken) {
      try {
        const userData = JSON.parse(savedUser);
        
        // Validate token by making a test request
        const validateToken = async () => {
          try {
            const response = await apiClient.profile(savedToken);
            
            if (response.ok) {
              setUser(userData);
              setAccessToken(savedToken);
              console.log('User automatically logged in from storage');
            } else {
              // Token is invalid, clear it from both storages
              localStorage.removeItem('user');
              localStorage.removeItem('accessToken');
              sessionStorage.removeItem('user');
              sessionStorage.removeItem('accessToken');
              console.log('Saved token is invalid, cleared from storage');
            }
          } catch (error) {
            console.error('Error validating token:', error);
            // Clear invalid data from both storages
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('accessToken');
          }
        };
        
        validateToken();
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        // Clear invalid data from both storages
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('accessToken');
      }
    }
    
    if (savedDarkMode) {
      setIsDarkMode(savedDarkMode === 'true');
    }
    
    // Befund history will be loaded from backend when user is authenticated
  }, []);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  // Befund history is now stored in PostgreSQL database - no localStorage needed

  // Load befund history from PostgreSQL database (PERSISTENT STORAGE)
  const loadBefundHistory = async () => {
    if (!accessToken) {
      console.log('No access token, skipping befund history load');
      return;
    }
    
    console.log('Loading befund history from PostgreSQL database...');
    
    try {
      const response = await apiClient.getBefundHistory(accessToken);

      if (response.ok) {
        const result = await response.json();
        
        // Convert database format to frontend format
        const convertedHistory = (result.history || []).map((dbBefund: Record<string, unknown>) => {
          // Safe JSON parsing with fallback
          let processedData = {};
          let additionalData = {};
          
          try {
            if (typeof dbBefund.processed_text === 'string') {
              // Try to parse as JSON, fallback to plain text
              try {
                processedData = JSON.parse(dbBefund.processed_text);
              } catch (e) {
                // If not JSON, treat as plain text (legacy data)
                processedData = {
                  title: dbBefund.processed_text.substring(0, 50) + (dbBefund.processed_text.length > 50 ? '...' : ''),
                  optimizedText: dbBefund.processed_text
                };
              }
            } else {
              processedData = dbBefund.processed_text || {};
            }
          } catch (e) {
            console.warn('Error parsing processed_text:', e);
            processedData = {
              title: 'Unbenannter Befund',
              optimizedText: dbBefund.processed_text || ''
            };
          }
          
          try {
            if (typeof dbBefund.additional_info === 'string') {
              additionalData = JSON.parse(dbBefund.additional_info);
            } else {
              additionalData = dbBefund.additional_info || {};
            }
          } catch (e) {
            console.warn('Error parsing additional_info:', e);
            additionalData = {};
          }
          
          return {
            id: dbBefund.id.toString(),
            title: processedData?.title || 'Unbenannter Befund',
            originalText: dbBefund.original_text,
            result: processedData?.optimizedText || dbBefund.processed_text || '',
            workflowOptions: dbBefund.options?.workflowOptions || {},
            selectedLayout: dbBefund.options?.selectedLayout || '',
            selectedModalitaet: dbBefund.modalitaet || dbBefund.options?.selectedModalitaet || '',
            additionalInfo: dbBefund.options?.additionalInfo || [],
            isFavorite: false, // Not stored in current DB structure
            createdAt: dbBefund.created_at
          };
        });
        
        setBefundHistory(convertedHistory);
        console.log('Loaded befund history from database:', convertedHistory.length, 'items');
      } else {
        console.error('Failed to load befund history, status:', response.status);
        setBefundHistory([]);
      }
    } catch (error) {
      console.error('Error loading befund history from database:', error);
      setBefundHistory([]);
    }
  };

  // Load befund history when user is authenticated
  useEffect(() => {
    console.log('useEffect triggered - user:', user?.email, 'accessToken:', !!accessToken);
    if (user && accessToken) {
      console.log('Loading befund history for user:', user.email);
      loadBefundHistory();
    } else {
      console.log('No user or access token, clearing befund history');
      setBefundHistory([]);
    }
  }, [user, accessToken]);

  // Load layouts when user is authenticated
  useEffect(() => {
    const loadLayouts = async () => {
      if (user && accessToken) {
        try {
          const response = await apiClient.getLayouts(accessToken);

          if (response.ok) {
            const data = await response.json();
            setLayouts(data.layouts);
          }
        } catch (error) {
          console.error('Fehler beim Laden der Layouts:', error);
        }
      } else {
        setLayouts([]);
      }
    };

    loadLayouts();
  }, [user, accessToken]);

  // Central API function with automatic token refresh
  const apiCall = async (url: string, options: RequestInit = {}) => {
    const makeRequest = async (token: string) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        },
      });
    };

    let response = await makeRequest(accessToken);
    
    // If token expired or forbidden, try to refresh
    if ((response.status === 401 || response.status === 403) && refreshToken) {
      try {
        const refreshResponse = await apiClient.refresh(refreshToken);

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setAccessToken(refreshData.accessToken);
          setRefreshToken(refreshData.refreshToken);
          
          // Retry original request with new token
          response = await makeRequest(refreshData.accessToken);
        } else {
          // Refresh failed, logout user
          handleLogout();
          throw new Error('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
        }
      } catch (error) {
        handleLogout();
        throw new Error('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
      }
    }
    
    return response;
  };

  const getActiveLevel = (): "1" | "2" | "3" | "4" | "5" => {
    if (workflowOptions.option5) return "5";
    if (workflowOptions.option4) return "4";
    if (workflowOptions.option3) return "3";
    if (workflowOptions.option2) return "2";
    return "1";
  };

  const handleWorkflowOptionChange = (option: keyof WorkflowOptions, value: boolean) => {
    // Wenn Workflow 3 deaktiviert werden soll, aber ein Layout ausgewählt ist
    if (option === 'option3' && !value && selectedLayout) {
      const layoutName = layouts.find(l => l.id === selectedLayout)?.name || 'das ausgewählte Layout';
      if (!window.confirm(`Hinweis: Sie haben ${layoutName} ausgewählt.\n\nWorkflow 3 kann nur deaktiviert werden, wenn kein Layout ausgewählt ist.\n\nMöchten Sie das Layout abwählen und Workflow 3 deaktivieren?`)) {
        return; // Benutzer bricht ab
      }
      // Layout abwählen
      setSelectedLayout(null);
    }
    
    // Wenn ein Layout ausgewählt wird, automatisch Workflow 3 aktivieren
    if (option === 'option3' && value) {
      setWorkflowOptions(prev => ({ ...prev, [option]: value }));
    } else {
      setWorkflowOptions(prev => ({ ...prev, [option]: value }));
    }
  };

  const handleLayoutSelect = (layoutId: string | null) => {
    setSelectedLayout(layoutId);
    
    // Automatisch Workflow 3 aktivieren, wenn ein Layout ausgewählt wird
    if (layoutId && !workflowOptions.option3) {
      setWorkflowOptions(prev => ({ ...prev, option3: true }));
    }
  };

  const handleLogin = async (email: string, password: string, rememberMe: boolean = true) => {
    const response = await apiClient.login(email, password);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Anmeldung fehlgeschlagen');
    }

    setUser(data.user);
    setAccessToken(data.accessToken);
    
    if (rememberMe) {
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('accessToken', data.accessToken);
      console.log('Login credentials saved to localStorage');
    } else {
      // Only save to sessionStorage for this session
      sessionStorage.setItem('user', JSON.stringify(data.user));
      sessionStorage.setItem('accessToken', data.accessToken);
      console.log('Login credentials saved to sessionStorage only');
    }

    // Nach erfolgreichem Login zur Startseite navigieren
    console.log('Login erfolgreich - Nutzer wird zur Startseite geleitet');
    
    // Kurze Verzögerung, dann zur Startseite navigieren
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  const handleRegister = async (email: string, password: string, name: string, organization?: string) => {
    const response = await apiClient.register(email, password, name, organization);

    const data = await response.json();

    if (!response.ok) {
      if (data.canLogin) {
        throw new Error(`${data.error} ${data.suggestion}`);
      }
      throw new Error(data.error || 'Registrierung fehlgeschlagen');
    }

    // Registration successful, but requires email verification
    if (data.requiresVerification) {
      // Don't close modal, stay in verification mode
      return;
    }

    // If somehow we get here with full registration, handle it
    setUser(data.user);
    setAccessToken(data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('accessToken', data.accessToken);
    
    // Nach erfolgreicher Registrierung zur Startseite navigieren
    console.log('Registrierung erfolgreich - Nutzer wird zur Startseite geleitet');
    
    // Kurze Verzögerung, dann zur Startseite navigieren
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  const handleVerifyEmail = async (email: string, code: string, password: string, name: string, organization?: string) => {
    const response = await apiClient.verifyEmail(email, code, password, name, organization);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Email-Verifizierung fehlgeschlagen');
    }

    setUser(data.user);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setIsAuthenticated(true);
    setShowAuthModal(false);
    
    // Nach erfolgreicher E-Mail-Verifizierung zur Startseite navigieren
    console.log('E-Mail-Verifizierung erfolgreich - Nutzer wird zur Startseite geleitet');
    
    // Kurze Verzögerung, dann zur Startseite navigieren
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  const handleForgotPassword = async (email: string) => {
    const response = await apiClient.forgotPassword(email);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Fehler beim Senden der Reset-Email');
    }

    // Success message is handled in the modal
  };

  const handleResetPassword = async (token: string, newPassword: string) => {
    const response = await apiClient.resetPassword(token, newPassword);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Fehler beim Zurücksetzen des Passworts');
    }

    // Success message is handled in the modal
  };

  const handleLogout = () => {
    setUser(null);
    setAccessToken(null);
    // Clear from both localStorage and sessionStorage
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('accessToken');
    console.log('User logged out, credentials cleared from storage');
  };

  // Befund history functions - using localStorage for now
  const saveBefundToHistory = async (originalText: string, result: string) => {
    if (!accessToken) {
      console.log('No access token, cannot save befund to database');
      return;
    }

    const title = originalText.length > 50 
      ? originalText.substring(0, 50) + '...' 
      : originalText;
    
    console.log('Saving befund to history:', {
      hasAccessToken: !!accessToken,
      title: title.substring(0, 30),
      originalTextLength: originalText.length,
      resultLength: result.length,
      userEmail: user?.email
    });
    
    try {
      const response = await apiClient.saveBefund(accessToken, {
        title,
        originalText,
        optimizedText: result,
        options: {
          workflowOptions: { ...workflowOptions },
          selectedLayout,
          selectedModalitaet,
          additionalInfo: [...additionalInfo]
        },
        tags: [],
        modality: selectedModalitaet || 'CT'
      });

      console.log('Save befund response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (response.ok) {
        const savedBefund = await response.json();
        console.log('✅ Befund saved to PostgreSQL database:', savedBefund.befund?.id);
        
        // Refresh history from database
        await loadBefundHistory();
      } else {
        const errorText = await response.text();
        console.error('Failed to save befund to database:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
      }
    } catch (error) {
      console.error('Error saving befund to database:', error);
    }
  };

  const refreshBefundHistory = () => {
    if (user && accessToken) {
      loadBefundHistory();
    }
  };

  const loadBefundFromHistory = (befundId: string) => {
    const befund = befundHistory.find(b => b.id === befundId);
    if (befund) {
      setText(befund.originalText || '');
      setResult(befund.result || '');
      setWorkflowOptions(befund.workflowOptions || {
        option1: true,
        option2: false,
        option3: false,
        option4: false,
        option5: false,
      });
      setSelectedLayout(befund.selectedLayout || null);
      setSelectedModalitaet(befund.selectedModalitaet || 'CT');
      setAdditionalInfo(befund.additionalInfo || []);
      setSelectedBefund(befundId);
    }
  };

  const addAdditionalInfo = (type: 'vorbefund' | 'zusatzinfo', title: string, content: string) => {
    const newInfo: AdditionalInfo = {
      id: Date.now().toString(),
      type,
      title,
      content,
      createdAt: new Date().toISOString()
    };
    
    setAdditionalInfo(prev => [...prev, newInfo]);
  };

  const toggleFavorite = (befundId: string) => {
    setBefundHistory(prev => 
      prev.map(befund => 
        befund.id === befundId 
          ? { ...befund, isFavorite: !befund.isFavorite }
          : befund
      )
    );
  };

  const filteredBefundHistory = befundHistory.filter(befund => {
    // Filter by favorites if enabled
    if (showFavoritesOnly && !befund.isFavorite) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        (befund.title || '').toLowerCase().includes(query) ||
        (befund.originalText || '').toLowerCase().includes(query) ||
        (befund.result || '').toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const removeAdditionalInfo = (id: string) => {
    setAdditionalInfo(prev => prev.filter(info => info.id !== id));
  };

  const deleteBefundFromHistory = async (befundId: string) => {
    if (!accessToken) {
      console.log('No access token, cannot delete befund from database');
      return;
    }

    const befund = befundHistory.find(b => b.id === befundId);
    const befundTitle = befund ? befund.title : 'diesen Befund';
    
    if (window.confirm(`Sind Sie sicher, dass Sie "${befundTitle}" aus der Historie löschen möchten?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) {
      try {
        const response = await apiClient.deleteBefund(accessToken, befundId);

        if (response.ok) {
          console.log('✅ Befund deleted from PostgreSQL database');
          
          // Refresh history from database
          await loadBefundHistory();
          
          if (selectedBefund === befundId) {
            setSelectedBefund(null);
            setText('');
            setResult('');
          }
        } else {
          console.error('Failed to delete befund from database, status:', response.status);
        }
      } catch (error) {
        console.error('Error deleting befund from database:', error);
      }
    }
  };

  const handleSaveLayout = async (layout: Omit<Layout, 'id' | 'createdAt'>) => {
    if (!accessToken) {
      throw new Error('Sie müssen angemeldet sein, um Layouts zu speichern.');
    }

    const response = await apiClient.saveLayout(accessToken, layout);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fehler beim Speichern des Layouts.');
    }

    const data = await response.json();
    const updatedLayouts = [...layouts, data.layout];
    setLayouts(updatedLayouts);
  };

  const handleUpdateLayout = async (layoutId: string, layout: Omit<Layout, 'id' | 'createdAt'>) => {
    if (!accessToken) {
      throw new Error('Sie müssen angemeldet sein, um Layouts zu bearbeiten.');
    }

    const response = await apiCall(`http://localhost:3001/layouts/${layoutId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(layout),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fehler beim Aktualisieren des Layouts.');
    }

    const data = await response.json();
    const updatedLayouts = layouts.map(l => l.id === layoutId ? data.layout : l);
    setLayouts(updatedLayouts);
  };

  const handleDeleteLayout = async (layoutId: string) => {
    if (!accessToken) {
      throw new Error('Sie müssen angemeldet sein, um Layouts zu löschen.');
    }

    const response = await apiCall(`http://localhost:3001/layouts/${layoutId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fehler beim Löschen des Layouts.');
    }

    const updatedLayouts = layouts.filter(l => l.id !== layoutId);
    setLayouts(updatedLayouts);
    
    if (selectedLayout === layoutId) {
      setSelectedLayout(null);
    }
  };

  const handleProcess = async () => {
    console.log('handleProcess called', { text: text.trim(), accessToken: !!accessToken, user: !!user });
    
    if (!text.trim()) {
      setError('Bitte Befundtext eingeben.');
      return;
    }

    if (!accessToken) {
      setError('Sie müssen angemeldet sein, um Befunde zu verarbeiten.');
      return;
    }

    // Show confirmation modal first
    setShowConfirmationModal(true);
    setConfirmationStep(1);
  };

  const handleConfirmation = () => {
    if (confirmationStep === 1) {
      // First confirmation - show second step
      setConfirmationStep(2);
    } else if (confirmationStep === 2) {
      // Second confirmation - start processing
      setShowConfirmationModal(false);
      setConfirmationStep(1);
      startProcessing();
    }
  };

  const startProcessing = async () => {
    setLoading(true);
    setError('');
    setResult('');
    setLoadingProgress(0);
    setLoadingStage('Initialisierung...');

    try {
      // Simulate progress steps
      const progressSteps = [
        { progress: 10, stage: 'Text wird analysiert...' },
        { progress: 25, stage: 'Workflow-Optionen werden verarbeitet...' },
        { progress: 40, stage: 'Layout-Template wird angewendet...' },
        { progress: 60, stage: 'KI-Verarbeitung läuft...' },
        { progress: 80, stage: 'Ergebnis wird formatiert...' },
        { progress: 95, stage: 'Finalisierung...' }
      ];

      // Start progress simulation
      let currentStep = 0;
      const progressInterval = setInterval(() => {
        if (currentStep < progressSteps.length) {
          const step = progressSteps[currentStep];
          setLoadingProgress(step.progress);
          setLoadingStage(step.stage);
          currentStep++;
        }
      }, 800);

      const selectedLayoutTemplate = layouts.find(l => l.id === selectedLayout)?.template;
      
      const response = await apiCall('http://localhost:3001/structured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          options: {
            mode: getActiveLevel(),
            layout: selectedLayoutTemplate,
            includeRecommendations: true,
          },
          allowContentChanges: false,
          additionalInfo: additionalInfo,
          modalitaet: selectedModalitaet,
        }),
      });

      // Clear progress interval
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoadingStage('Abgeschlossen!');

      const data = await response.json();

      if (data.blocked) {
        setError(data.message);
        setResult(data.suggestion);
        // Don't save to history if blocked
      } else if (!response.ok) {
        setError(data.error || 'Fehler bei der Verarbeitung');
        setResult('');
        // Don't save to history if request failed
      } else {
        // Handle structured response
        if (typeof data.answer === 'object' && data.answer !== null) {
          // Format structured response based on active workflow level
          let formattedResult = '';
          const activeLevel = getActiveLevel();
          
          if (data.answer.befund) {
            formattedResult += `**VERBESSERTER BEFUND:**\n${data.answer.befund}\n\n`;
          }
          
          // Only show beurteilung for level 3-5
          if (activeLevel >= '3' && data.answer.beurteilung) {
            formattedResult += `**BEURTEILUNG:**\n${data.answer.beurteilung}\n\n`;
          }
          
          // Only show empfehlungen for level 4-5
          if (activeLevel >= '4' && data.answer.empfehlungen) {
            formattedResult += `**KLINISCHE EMPFEHLUNGEN:**\n${data.answer.empfehlungen}\n\n`;
          }
          
          // Only show zusatzinformationen for level 5
          if (activeLevel >= '5' && data.answer.zusatzinformationen) {
            formattedResult += `**ZUSATZINFORMATIONEN / DIFFERENTIALDIAGNOSEN:**\n${data.answer.zusatzinformationen}`;
          }
          
          setResult(formattedResult);
          // Save to history
          if (formattedResult.trim()) {
            saveBefundToHistory(text.trim(), formattedResult);
          }
        } else {
          setResult(data.answer);
          // Save to history
          if (data.answer && data.answer.trim()) {
            saveBefundToHistory(text.trim(), data.answer);
          }
        }
      }

      // Reset progress after a short delay
      setTimeout(() => {
        setLoadingProgress(0);
        setLoadingStage('');
      }, 1000);

    } catch (err) {
      console.error('Error in handleProcess:', err);
      setError('Fehler bei der Verarbeitung: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler'));
      setLoadingProgress(0);
      setLoadingStage('');
    } finally {
      setLoading(false);
    }
  };

  const toggleOption = (option: keyof WorkflowOptions) => {
    if (option === 'option1') return; // Option 1 ist immer aktiv
    
    handleWorkflowOptionChange(option, !workflowOptions[option]);
  };

  // Show login screen if not authenticated
  if (!user) {
  return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-lg border p-8 max-w-md w-full mx-4`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">R+</span>
            </div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>RadBefund+</h1>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Radiologische Befunde optimieren</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Anmelden / Registrieren
            </button>
          </div>
          
          <p className={`text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-6`}>
            Bitte melden Sie sich an, um das Tool zu verwenden.
          </p>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onVerifyEmail={handleVerifyEmail}
          onForgotPassword={handleForgotPassword}
          onResetPassword={handleResetPassword}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex`}>
      {/* Sidebar */}
      <div className={`w-64 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => {
              // Zur Startseite navigieren - Seite neu laden um alle Zustände zurückzusetzen
              window.location.href = '/';
            }}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer w-full text-left"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">R+</span>
            </div>
            <div>
              <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>RadBefund+</h1>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4">
          <nav className="space-y-2">
            <button
              onClick={() => {
                setText('');
                setResult('');
                setError('');
                setSelectedLayout(null);
                setSelectedModalitaet('CT');
                setSelectedBefund(null);
                setAdditionalInfo([]);
                setWorkflowOptions({
                  option1: true,
                  option2: false,
                  option3: false,
                  option4: false,
                  option5: false,
                });
              }}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode 
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title="Alle Felder zurücksetzen und neuen Befund starten"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Neuer Befund</span>
            </button>

            {/* Knowledge Base Button - Only for Admin */}
            {isAdmin && (
              <button
                onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showKnowledgeBase
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode 
                      ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title="Wissensdatenbank verwalten (nur Admin)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Wissensdatenbank</span>
              </button>
            )}
          </nav>

          {/* Befund History */}
          {user && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {showFavoritesOnly ? 'Favoriten' : 'Befund-Historie'}
                </h3>
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    showFavoritesOnly
                      ? 'bg-yellow-500 text-white'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={showFavoritesOnly ? 'Alle Befunde anzeigen' : 'Nur Favoriten anzeigen'}
                >
                  ⭐
                </button>
              </div>
              
              {/* Suchleiste */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Befunde durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400 focus:border-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-400'
                  }`}
                />
              </div>
              
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {filteredBefundHistory.length === 0 ? (
                  <div className={`text-center py-8 text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {showFavoritesOnly 
                      ? 'Keine Favoriten gefunden' 
                      : searchQuery.trim() 
                        ? 'Keine Befunde gefunden' 
                        : 'Keine Befunde vorhanden. Generieren Sie Ihren ersten Befund!'
                    }
                  </div>
                ) : (
                  filteredBefundHistory.map((befund) => (
                    <div
                      key={befund.id}
                      className={`group relative flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        selectedBefund === befund.id
                          ? isDarkMode
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-100 text-gray-900'
                          : isDarkMode
                            ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      onClick={() => loadBefundFromHistory(befund.id)}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{befund.title}</p>
                        <p className={`text-xs truncate ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {new Date(befund.createdAt).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(befund.id);
                          }}
                          className={`p-1 rounded transition-all ${
                            befund.isFavorite
                              ? 'text-yellow-500 hover:text-yellow-400'
                              : isDarkMode
                                ? 'text-gray-400 hover:text-yellow-500'
                                : 'text-gray-500 hover:text-yellow-500'
                          }`}
                          title={befund.isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                        >
                          <svg className="w-3 h-3" fill={befund.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBefundFromHistory(befund.id);
                          }}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                            isDarkMode 
                              ? 'hover:bg-gray-600 text-gray-400 hover:text-red-400' 
                              : 'hover:bg-gray-200 text-gray-500 hover:text-red-500'
                          }`}
                          title="Befund löschen"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {user.name}
              </p>
              <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {user.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
              title="Abmelden"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4 flex justify-between items-center`}>
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Radiologische Befunde optimieren
          </h2>
          
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Modalitätsauswahl */}
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-3`}>
          <div className="flex items-center space-x-4">
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Modalität:
            </span>
            <div className="flex space-x-2">
              {['Sonografie', 'Röntgen', 'Durchleuchtung', 'CT', 'MRT', 'PET/CT'].map((modalitaet) => (
                <button
                  key={modalitaet}
                  onClick={() => setSelectedModalitaet(modalitaet)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedModalitaet === modalitaet
                      ? 'bg-blue-500 text-white'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {modalitaet}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 space-y-6">
          {/* Knowledge Base Admin */}
          {showKnowledgeBase && (
            <KnowledgeBaseAdmin 
              isDarkMode={isDarkMode} 
              accessToken={accessToken || ''} 
            />
          )}

          {/* Main Application Content */}
          {!showKnowledgeBase && (
            <>
              {/* All Three Containers Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Workflow Options */}
            <div className="lg:col-span-1">
              <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-4`}>
                <h3 className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Workflow-Optionen
                </h3>
                <div className="space-y-2">
                  {[
                    { key: 'option1', label: 'Sprachliche Korrektur', always: true },
                    { key: 'option2', label: 'Terminologie verbessern' },
                    { key: 'option3', label: 'Umstrukturierung + Beurteilung' },
                    { key: 'option4', label: 'Klinische Empfehlung' },
                    { key: 'option5', label: 'Zusatzinfos/DDx' },
                  ].map(({ key, label, always }) => (
                    <button
                      key={key}
                      onClick={() => toggleOption(key as keyof WorkflowOptions)}
                      disabled={always}
                      className={`w-full p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        workflowOptions[key as keyof WorkflowOptions]
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : isDarkMode
                            ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      } ${always ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{label}</span>
                        {workflowOptions[key as keyof WorkflowOptions] && (
                          <span className="ml-1">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Layout Selector */}
            <div className="lg:col-span-1">
              <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-4`}>
                <h3 className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Layout-Templates
                </h3>
                <LayoutSelector
                  selectedLayout={selectedLayout}
                  onSelectLayout={handleLayoutSelect}
                  layouts={layouts}
                  onSaveLayout={handleSaveLayout}
                  onUpdateLayout={handleUpdateLayout}
                  onDeleteLayout={handleDeleteLayout}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>

            {/* Additional Info Container */}
            <div className="lg:col-span-1">
              <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-4`}>
                <h3 className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Zusätzliche Informationen
                </h3>
                
                {/* Add Buttons */}
                <div className="space-y-2 mb-3">
                  <button
                    onClick={() => setShowVorbefundModal(true)}
                    className={`w-full p-3 rounded-lg border-2 border-dashed text-xs font-medium transition-all flex items-center justify-center space-x-2 ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-600'
                        : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Vorbefunde</span>
                  </button>
                  
                  <button
                    onClick={() => setShowZusatzinfoModal(true)}
                    className={`w-full p-3 rounded-lg border-2 border-dashed text-xs font-medium transition-all flex items-center justify-center space-x-2 ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-600'
                        : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Zusatzinfos</span>
                  </button>
                </div>

                {/* Additional Info List */}
                {additionalInfo.length > 0 && (
                  <div className="space-y-2">
                    <h4 className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Hinzugefügt:
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {additionalInfo.map((info) => (
                        <div
                          key={info.id}
                          className={`p-2 rounded border text-xs ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600 text-gray-200'
                              : 'bg-gray-50 border-gray-200 text-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-1 mb-1">
                                <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                  info.type === 'vorbefund'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                }`}>
                                  {info.type === 'vorbefund' ? 'V' : 'Z'}
                                </span>
                              </div>
                              <div className="font-medium truncate text-xs">{info.title}</div>
                              <div className="text-xs opacity-75 truncate">{info.content.substring(0, 30)}...</div>
                            </div>
                            <button
                              onClick={() => removeAdditionalInfo(info.id)}
                              className={`ml-1 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors`}
                              title="Entfernen"
                            >
                              <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Text Input */}
          <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Befundtext
            </h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Fügen Sie hier den gesamten Befundtext ein..."
              className={`w-full h-64 p-4 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } border`}
            />
          </div>

          {/* Process Button & Progress */}
          <div className="text-center space-y-4">
            <button
              onClick={handleProcess}
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? 'Verarbeitung läuft...' : 'Befund erstellen'}
            </button>

            {/* Progress Indicator */}
            {loading && (
              <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 max-w-md mx-auto`}>
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                  
                  {/* Progress Text */}
                  <div className="text-center">
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {loadingStage}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                      {loadingProgress}% abgeschlossen
                    </p>
                  </div>

                  {/* Animated Dots */}
                  <div className="flex justify-center space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Optimierter Befund
              </h3>
              
              {/* Structured Result Display */}
              <StructuredResultDisplay result={result} isDarkMode={isDarkMode} />
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Gesamten Befund kopieren
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onVerifyEmail={handleVerifyEmail}
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
        isDarkMode={isDarkMode}
      />

      {/* Vorbefund Modal */}
      {showVorbefundModal && (
        <AdditionalInfoModal
          isOpen={showVorbefundModal}
          onClose={() => setShowVorbefundModal(false)}
          onSave={(title, content) => {
            addAdditionalInfo('vorbefund', title, content);
            setShowVorbefundModal(false);
          }}
          type="vorbefund"
          isDarkMode={isDarkMode}
        />
      )}

      {/* Zusatzinfo Modal */}
      {showZusatzinfoModal && (
        <AdditionalInfoModal
          isOpen={showZusatzinfoModal}
          onClose={() => setShowZusatzinfoModal(false)}
          onSave={(title, content) => {
            addAdditionalInfo('zusatzinfo', title, content);
            setShowZusatzinfoModal(false);
          }}
          type="zusatzinfo"
          isDarkMode={isDarkMode}
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4`}>
            <div className="flex items-center mb-4">
              <div className={`p-2 rounded-full ${isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className={`text-lg font-semibold ml-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {confirmationStep === 1 ? 'Datenschutz-Hinweis' : 'Generierung starten'}
              </h3>
            </div>
            
            {confirmationStep === 1 ? (
              <div className="mb-6">
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                  <strong className={`${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    Wichtiger Hinweis zum Datenschutz:
                  </strong>
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                  Bitte überprüfen Sie Ihren Befundtext vollständig auf personenbezogene Patientendaten (Namen, Geburtsdaten, Adressen, etc.) und entfernen Sie diese bei Bedarf, bevor Sie die Generierung starten.
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Die Verarbeitung personenbezogener Daten ohne entsprechende Rechtsgrundlage kann gegen Datenschutzbestimmungen verstoßen.
                </p>
              </div>
            ) : (
              <div className="mb-6">
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                  Sind Sie sicher, dass Sie die Befundgenerierung starten möchten?
                </p>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Der Befundtext wurde auf personenbezogene Daten überprüft und ist bereit für die Verarbeitung.
                </p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowConfirmationModal(false);
                  setConfirmationStep(1);
                }}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmation}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  confirmationStep === 1
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {confirmationStep === 1 ? 'Bestätigen' : 'Generierung starten'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}