// src/taskpane/index.tsx
import * as React from "react";
import { createRoot } from "react-dom/client";

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error; errorInfo?: React.ErrorInfo }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Speichere Fehler-Details für Debugging
    this.setState({ errorInfo });
    
    // Optional: Sende Fehler an einen Error-Tracking-Service
    if (typeof window !== 'undefined' && window.console) {
      console.group('🚨 React Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: "20px", 
          textAlign: "center",
          color: "#721c24",
          backgroundColor: "#f8d7da",
          border: "1px solid #f5c6cb",
          borderRadius: "8px",
          margin: "20px"
        }}>
          <h2>Ein Fehler ist aufgetreten</h2>
          <p>Die Anwendung ist auf einen unerwarteten Fehler gestoßen.</p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ margin: "10px 0", textAlign: "left" }}>
              <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
                Fehler-Details (Development)
              </summary>
              <pre style={{ 
                fontSize: "12px", 
                backgroundColor: "#f8f9fa", 
                padding: "10px", 
                borderRadius: "4px",
                overflow: "auto",
                maxHeight: "200px"
              }}>
                {this.state.error.message}
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: undefined, errorInfo: undefined });
              window.location.reload();
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              margin: "10px"
            }}
          >
            Seite neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

declare global {
  interface Window {
    Office?: any;
    Word?: any;
  }
}

const CLAIM = "Radiologische Befunde – sprachlich sauber, klar strukturiert.";
const DISCLAIMER =
  "Dieses Werkzeug verbessert Sprache und Struktur. Medizinische Bewertung bleibt bei Ihnen.";

const PROCESS_URL = "https://api.mylovelu.de/process";
const IMPRESSION_URL = "https://api.mylovelu.de/impression";
const STRUCTURED_URL = "https://api.mylovelu.de/structured";

// Auth URLs
const AUTH_REGISTER_URL = "https://api.mylovelu.de/auth/register";
const AUTH_LOGIN_URL = "https://api.mylovelu.de/auth/login";
const AUTH_REFRESH_URL = "https://api.mylovelu.de/auth/refresh";
const AUTH_LOGOUT_URL = "https://api.mylovelu.de/auth/logout";
const AUTH_PROFILE_URL = "https://api.mylovelu.de/auth/profile";

// Slider-Level statt A–D
type Level = 1 | 2 | 3 | 4 | 5;
type Stil = "knapp" | "neutral" | "ausführlicher";
type Ansprache = "sie" | "neutral";

// Layout-Optionen
type LayoutType = "standard" | "strukturiert" | "tabellarisch" | "konsiliar";

interface Layout {
  id: string;
  name: string;
  description: string;
  template: string;
  createdAt: string;
  isDefault?: boolean;
}

// Vorbefunde
interface PriorFinding {
  id: string;
  date: string;
  text: string;
}

// Generierte Ergebnisse
interface GeneratedResult {
  befund: string;
  beurteilung: string;
  empfehlungen?: string;
  zusatzinformationen?: string;
}

// Workflow-Optionen
interface WorkflowOptions {
  option1: boolean; // Sprachliche & grammatikalische Korrektur (immer aktiv)
  option2: boolean; // Terminologie verbessern, Struktur bleibt
  option3: boolean; // Terminologie + Umstrukturierung + kurze Beurteilung
  option4: boolean; // Klinische Empfehlung hinzufügen
  option5: boolean; // Zusatzinfos/Differentialdiagnosen
  selectedLayout?: string; // Ausgewähltes Layout
}

// Auth Types
interface User {
  id: string;
  email: string;
  name: string;
  organization?: string;
  createdAt: string;
  lastLogin?: string;
}

interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

type BackendResponse =
  | {
      blocked: true;
      reasons?: string[];
      message?: string;
      suggestion?: string | GeneratedResult;
      diff?: {
        addedNumbers: string[];
        removedNumbers: string[];
        lateralityChanged: boolean;
        newMedicalKeywords: string[];
      };
    }
  | { blocked: false; answer: string | GeneratedResult };

// Auth Modal Component - außerhalb der Hauptkomponente für bessere Performance
const AuthModal = React.memo(({ 
  authFormData, 
  setAuthFormData, 
  authMode, 
  setAuthMode, 
  authLoading, 
  authError, 
  setAuthError, 
  setShowAuthModal, 
  handleLogin, 
  handleRegister 
}: {
  authFormData: any;
  setAuthFormData: any;
  authMode: 'login' | 'register';
  setAuthMode: any;
  authLoading: boolean;
  authError: string | null;
  setAuthError: any;
  setShowAuthModal: any;
  handleLogin: any;
  handleRegister: any;
}) => {
  // Verwende die externen States
  const { email, password, name, organization, confirmPassword, acceptTerms } = authFormData;
  
  // Direkte Setter-Funktionen ohne useCallback
  const setEmail = (value: string) => setAuthFormData((prev: any) => ({ ...prev, email: value }));
  const setPassword = (value: string) => setAuthFormData((prev: any) => ({ ...prev, password: value }));
  const setName = (value: string) => setAuthFormData((prev: any) => ({ ...prev, name: value }));
  const setOrganization = (value: string) => setAuthFormData((prev: any) => ({ ...prev, organization: value }));
  const setConfirmPassword = (value: string) => setAuthFormData((prev: any) => ({ ...prev, confirmPassword: value }));
  const setAcceptTerms = (value: boolean) => setAuthFormData((prev: any) => ({ ...prev, acceptTerms: value }));

  // Passwort-Validierung
  const passwordRequirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch = password === confirmPassword;

  // Funktion zum Leeren aller Felder
  const clearAllFields = () => {
    setAuthFormData({
      email: "",
      password: "",
      name: "",
      organization: "",
      confirmPassword: "",
      acceptTerms: false
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (authMode === 'register') {
      if (!isPasswordValid) {
        setAuthError("Passwort erfüllt nicht alle Anforderungen");
        return;
      }
      if (!passwordsMatch) {
        setAuthError("Passwörter stimmen nicht überein");
        return;
      }
      if (!acceptTerms) {
        setAuthError("Bitte akzeptieren Sie die Datenschutz- und AGB-Bestimmungen");
        return;
      }
      // Nur bei erfolgreicher Validierung die clearFields-Funktion übergeben
      handleRegister(email, password, name, organization, clearAllFields);
    } else {
      handleLogin(email, password, clearAllFields);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "32px",
        width: "400px",
        maxWidth: "90vw",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px"
        }}>
          <h2 style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: "700",
            color: "#2c3e50"
          }}>
            {authMode === 'login' ? 'Anmelden' : 'Registrieren'}
          </h2>
          <button
            onClick={() => {
              setShowAuthModal(false);
              setAuthError(null);
            }}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#6c757d"
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {authMode === 'register' && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057"
              }}>
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input-modern"
                style={{ width: "100%" }}
              />
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#495057"
            }}>
              E-Mail *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-modern"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#495057"
            }}>
              Passwort *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-modern"
              style={{ width: "100%" }}
            />
            
            {/* Passwort-Anforderungen */}
            {authMode === 'register' && password && (
              <div style={{
                marginTop: "8px",
                padding: "12px",
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
                border: "1px solid #e9ecef"
              }}>
                <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#495057" }}>
                  Passwort-Anforderungen:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                    <span style={{ 
                      color: passwordRequirements.length ? "#28a745" : "#dc3545",
                      fontWeight: "600"
                    }}>
                      {passwordRequirements.length ? "✓" : "✗"}
                    </span>
                    <span style={{ color: passwordRequirements.length ? "#28a745" : "#6c757d" }}>
                      Mindestens 8 Zeichen
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                    <span style={{ 
                      color: passwordRequirements.uppercase ? "#28a745" : "#dc3545",
                      fontWeight: "600"
                    }}>
                      {passwordRequirements.uppercase ? "✓" : "✗"}
                    </span>
                    <span style={{ color: passwordRequirements.uppercase ? "#28a745" : "#6c757d" }}>
                      Mindestens 1 Großbuchstabe
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                    <span style={{ 
                      color: passwordRequirements.lowercase ? "#28a745" : "#dc3545",
                      fontWeight: "600"
                    }}>
                      {passwordRequirements.lowercase ? "✓" : "✗"}
                    </span>
                    <span style={{ color: passwordRequirements.lowercase ? "#28a745" : "#6c757d" }}>
                      Mindestens 1 Kleinbuchstabe
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                    <span style={{ 
                      color: passwordRequirements.special ? "#28a745" : "#dc3545",
                      fontWeight: "600"
                    }}>
                      {passwordRequirements.special ? "✓" : "✗"}
                    </span>
                    <span style={{ color: passwordRequirements.special ? "#28a745" : "#6c757d" }}>
                      Mindestens 1 Sonderzeichen
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {authMode === 'register' && (
            <>
              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#495057"
                }}>
                  Passwort bestätigen *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="input-modern"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#495057"
                }}>
                  Organisation (optional)
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="input-modern"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Datenschutz-Checkbox */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  fontSize: "13px",
                  color: "#495057",
                  cursor: "pointer"
                }}>
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    style={{
                      marginTop: "2px",
                      transform: "scale(1.1)"
                    }}
                  />
                  <span>
                    Ich akzeptiere die{" "}
                    <a href="#" style={{ color: "#667eea", textDecoration: "underline" }}>
                      Datenschutzbestimmungen
                    </a>{" "}
                    und{" "}
                    <a href="#" style={{ color: "#667eea", textDecoration: "underline" }}>
                      AGB
                    </a>
                    . *
                  </span>
                </label>
              </div>
            </>
          )}

          {authError && (
            <div style={{
              backgroundColor: "#f8d7da",
              border: "1px solid #f5c6cb",
              color: "#721c24",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "14px"
            }}>
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="btn btn-primary"
            style={{ width: "100%", marginBottom: "16px" }}
          >
            {authLoading ? (
              <>
                <div className="loading-spinner"></div>
                {authMode === 'login' ? 'Anmelden...' : 'Registrieren...'}
              </>
            ) : (
              authMode === 'login' ? 'Anmelden' : 'Registrieren'
            )}
          </button>

          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              style={{
                background: "none",
                border: "none",
                color: "#667eea",
                cursor: "pointer",
                fontSize: "14px",
                textDecoration: "underline"
              }}
            >
              {authMode === 'login' 
                ? 'Noch kein Konto? Jetzt registrieren' 
                : 'Bereits registriert? Jetzt anmelden'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

function App() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mainText, setMainText] = React.useState<string>("");
  const [generatedResult, setGeneratedResult] = React.useState<GeneratedResult | null>(null);
  
  // Workflow-Optionen (Option 1 ist immer aktiv)
  const [workflowOptions, setWorkflowOptions] = React.useState<WorkflowOptions>({
    option1: true, // Immer aktiv
    option2: false,
    option3: false,
    option4: false,
    option5: false,
    selectedLayout: undefined
  });

  // Layout-System
  const [layouts, setLayouts] = React.useState<Layout[]>([]);
  const [showLayoutModal, setShowLayoutModal] = React.useState(false);
  const [newLayout, setNewLayout] = React.useState({ name: "", description: "", template: "" });

  // Auth States
  const [authState, setAuthState] = React.useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null
  });
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  
  // Auth-Form States (außerhalb der Modal-Komponente)
  const [authFormData, setAuthFormData] = React.useState({
    email: "",
    password: "",
    name: "",
    organization: "",
    confirmPassword: "",
    acceptTerms: false
  });

  const isOffice = !!(window as any).Office;

  // Workflow-Optionen Handler mit Fehlerbehandlung
  const toggleWorkflowOption = (option: keyof WorkflowOptions) => {
    try {
      if (option === 'option1') return; // Option 1 ist immer aktiv
      
      // Option 3 kann nicht deaktiviert werden, wenn ein Layout ausgewählt ist
      if (option === 'option3' && workflowOptions.selectedLayout && workflowOptions.option3) {
        return; // Verhindere Deaktivierung von Option 3 bei ausgewähltem Layout
      }
      
      setWorkflowOptions(prev => ({
        ...prev,
        [option]: !prev[option]
      }));
    } catch (error) {
      console.error('Error in toggleWorkflowOption:', error);
    }
  };

  // Layout-Funktionen
  const selectLayout = (layoutId: string) => {
    try {
      setWorkflowOptions(prev => ({
        ...prev,
        selectedLayout: layoutId,
        // Automatisch Option 3 aktivieren wenn Layout gewählt wird
        option3: prev.selectedLayout !== layoutId ? true : prev.option3
      }));
    } catch (error) {
      console.error('Error in selectLayout:', error);
    }
  };

  const deselectLayout = () => {
    try {
      setWorkflowOptions(prev => ({
        ...prev,
        selectedLayout: undefined,
        // Option 3 kann deaktiviert werden, wenn kein Layout ausgewählt ist
        option3: false
      }));
    } catch (error) {
      console.error('Error in deselectLayout:', error);
    }
  };

  const saveLayout = async () => {
    try {
      if (!newLayout.name.trim() || !newLayout.template.trim()) {
        setError("Layout-Name und Template sind erforderlich.");
        return;
      }

      if (!authState.accessToken) {
        setError("Sie müssen angemeldet sein, um Layouts zu speichern.");
        return;
      }

      const response = await fetch('https://api.mylovelu.de/layouts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newLayout.name.trim(),
          description: newLayout.description.trim(),
          template: newLayout.template.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setLayouts(prev => [...prev, data.layout]);
        setNewLayout({ name: "", description: "", template: "" });
        setShowLayoutModal(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Fehler beim Speichern des Layouts.");
      }
    } catch (error) {
      console.error('Error in saveLayout:', error);
      setError("Fehler beim Speichern des Layouts.");
    }
  };

  const deleteLayout = async (layoutId: string) => {
    try {
      if (!authState.accessToken) {
        setError("Sie müssen angemeldet sein, um Layouts zu löschen.");
        return;
      }

      const response = await fetch(`https://api.mylovelu.de/layouts/${layoutId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setLayouts(prev => prev.filter(l => l.id !== layoutId));
        
        // Wenn das gelöschte Layout ausgewählt war, Auswahl aufheben und Option 3 deaktivieren
        if (workflowOptions.selectedLayout === layoutId) {
          setWorkflowOptions(prev => ({
            ...prev,
            selectedLayout: undefined,
            option3: false
          }));
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Fehler beim Löschen des Layouts.");
      }
    } catch (error) {
      console.error('Error in deleteLayout:', error);
      setError("Fehler beim Löschen des Layouts.");
    }
  };

  // Bestimme die höchste aktive Option für die API
  const getActiveLevel = (): "1" | "2" | "3" | "4" | "5" => {
    if (workflowOptions.option5) return "5";
    if (workflowOptions.option4) return "4";
    if (workflowOptions.option3) return "3";
    if (workflowOptions.option2) return "2";
    return "1";
  };

  // Haupttext-Eingabefeld
  const MainTextarea = () => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [localText, setLocalText] = React.useState(mainText);
    const [isInitialized, setIsInitialized] = React.useState(false);

    // Initialisiere das Textfeld nur einmal
    React.useEffect(() => {
      if (textareaRef.current && !isInitialized) {
        textareaRef.current.value = mainText;
        setLocalText(mainText);
        setIsInitialized(true);
      }
    }, [mainText, isInitialized]);

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      try {
        const textarea = e.currentTarget;
        const value = textarea.value;
        
        setLocalText(value);
        
        // Height adjustment
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
      } catch (error) {
        console.error('Error in handleInput:', error);
      }
    };

    const handleBlur = () => {
      try {
        // State nur beim Verlassen des Feldes aktualisieren
        if (textareaRef.current) {
          const currentValue = textareaRef.current.value;
          setMainText(currentValue);
          setLocalText(currentValue);
        }
      } catch (error) {
        console.error('Error in handleBlur:', error);
      }
    };

    return (
      <div>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          marginBottom: "16px",
          gap: "12px"
        }}>
          <div style={{
            width: "8px",
            height: "8px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "50%"
          }}></div>
          <label style={{ 
            fontSize: "18px", 
            fontWeight: "700",
            color: "#2c3e50",
            letterSpacing: "-0.01em"
          }}>
            Befundtext
          </label>
        </div>
        <div style={{
          position: "relative",
          background: "white",
          borderRadius: "12px",
          padding: "4px",
          border: "2px solid #e9ecef"
        }}>
          <textarea
            ref={textareaRef}
            onInput={handleInput}
            onBlur={handleBlur}
            placeholder="Fügen Sie hier den gesamten Befundtext ein. Die KI erkennt automatisch Anamnese, Fragestellung, Diagnose, Befund und Beurteilung und trennt diese entsprechend auf."
            className="textarea-modern"
            style={{ 
              width: "100%", 
              minHeight: "200px",
              border: "none",
              background: "white",
              resize: "none",
              fontFamily: "inherit"
            }}
          />
        </div>
        <div style={{
          marginTop: "12px",
          padding: "12px 16px",
          background: "linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)",
          borderRadius: "8px",
          border: "1px solid #e1bee7"
        }}>
          <p style={{
            margin: 0,
            fontSize: "13px",
            color: "#5e35b1",
            fontWeight: "500",
            lineHeight: "1.4"
          }}>
            Die KI analysiert Ihren Text automatisch und erkennt verschiedene Abschnitte wie Anamnese, Fragestellung, Diagnose, Befund und Beurteilung.
          </p>
        </div>
      </div>
    );
  };

  // Reset-Funktion für neuen Befund
  const resetForNewBefund = () => {
    setMainText("");
    setGeneratedResult(null);
    setError(null);
    setWorkflowOptions({
      option1: true,
      option2: false,
      option3: false,
      option4: false,
      option5: false,
      selectedLayout: undefined
    });
  };

  // Auth Functions
  const saveAuthState = (authData: AuthResponse) => {
    const newAuthState: AuthState = {
      isAuthenticated: true,
      user: authData.user,
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken
    };
    setAuthState(newAuthState);
    localStorage.setItem('authState', JSON.stringify(newAuthState));
  };

  const clearAuthState = () => {
    const newAuthState: AuthState = {
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null
    };
    setAuthState(newAuthState);
    localStorage.removeItem('authState');
  };

  const getAuthHeaders = (): Record<string, string> => {
    if (!authState.accessToken) return { 'Content-Type': 'application/json' };
    return {
      'Authorization': `Bearer ${authState.accessToken}`,
      'Content-Type': 'application/json'
    };
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    if (!authState.refreshToken) {
      console.log('Kein Refresh Token vorhanden');
      return false;
    }
    
    try {
      console.log('Versuche Token-Erneuerung...');
      const response = await fetch(AUTH_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: authState.refreshToken })
      }).catch((fetchError) => {
        console.error('Fetch error in refreshAccessToken:', fetchError);
        throw new Error('Netzwerkfehler bei Token-Erneuerung');
      });
      
      if (response.ok) {
        const data = await response.json().catch((jsonError) => {
          console.error('JSON parse error in refreshAccessToken:', jsonError);
          throw new Error('Server-Antwort bei Token-Erneuerung konnte nicht verarbeitet werden');
        });
        
        const newAuthState: AuthState = {
          ...authState,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        };
        setAuthState(newAuthState);
        localStorage.setItem('authState', JSON.stringify(newAuthState));
        console.log('Token erfolgreich erneuert');
        return true;
      } else {
        console.log('Token-Erneuerung fehlgeschlagen:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.log('Fehler-Details:', errorData);
      }
    } catch (error: any) {
      console.error('Token refresh failed:', error);
      console.error('Error message:', error?.message);
    }
    
    console.log('Lösche Auth State...');
    clearAuthState();
    return false;
  };

  const handleLogin = async (email: string, password: string, clearFields?: () => void) => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const response = await fetch(AUTH_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).catch((fetchError) => {
        console.error('Fetch error in handleLogin:', fetchError);
        throw new Error('Netzwerkfehler: Server nicht erreichbar');
      });
      
      const data = await response.json().catch((jsonError) => {
        console.error('JSON parse error in handleLogin:', jsonError);
        throw new Error('Server-Antwort konnte nicht verarbeitet werden');
      });
      
      if (response.ok) {
        saveAuthState(data);
        setShowAuthModal(false);
        setAuthError(null);
        // Nur bei erfolgreicher Anmeldung die Felder leeren
        if (clearFields) clearFields();
      } else {
        setAuthError(data.error || 'Anmeldung fehlgeschlagen');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setAuthError(error?.message || 'Netzwerkfehler bei der Anmeldung');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string, name: string, organization?: string, clearFields?: () => void) => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const response = await fetch(AUTH_REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, organization })
      }).catch((fetchError) => {
        console.error('Fetch error in handleRegister:', fetchError);
        throw new Error('Netzwerkfehler: Server nicht erreichbar');
      });
      
      const data = await response.json().catch((jsonError) => {
        console.error('JSON parse error in handleRegister:', jsonError);
        throw new Error('Server-Antwort konnte nicht verarbeitet werden');
      });
      
      if (response.ok) {
        saveAuthState(data);
        setShowAuthModal(false);
        setAuthError(null);
        // Nur bei erfolgreicher Registrierung die Felder leeren
        if (clearFields) clearFields();
      } else {
        setAuthError(data.error || 'Registrierung fehlgeschlagen');
      }
    } catch (error: any) {
      console.error('Register error:', error);
      setAuthError(error?.message || 'Netzwerkfehler bei der Registrierung');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (authState.accessToken) {
        await fetch(AUTH_LOGOUT_URL, {
          method: 'POST',
          headers: getAuthHeaders()
        }).catch((fetchError) => {
          console.error('Fetch error in handleLogout:', fetchError);
          // Logout auch bei Netzwerkfehlern durchführen
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthState();
    }
  };

  // Auth State Initialization mit Token-Validierung und Layout-Loading
  React.useEffect(() => {
    const savedAuthState = localStorage.getItem('authState');
    if (savedAuthState) {
      try {
        const parsed = JSON.parse(savedAuthState);
        
        // Prüfe ob Token noch gültig ist (einfache Zeitprüfung)
        if (parsed.accessToken) {
          try {
            // Dekodiere JWT Token (ohne Verifikation, nur für Zeitprüfung)
            const tokenParts = parsed.accessToken.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              const now = Math.floor(Date.now() / 1000);
              
              // Wenn Token in weniger als 5 Minuten abläuft, versuche Erneuerung
              if (payload.exp && (payload.exp - now) < 300) {
                console.log('Token läuft bald ab, versuche Erneuerung...');
                // Token-Erneuerung wird beim nächsten API-Aufruf versucht
              }
            }
          } catch (tokenError) {
            console.log('Token-Dekodierung fehlgeschlagen:', tokenError);
          }
        }
        
        setAuthState(parsed);
      } catch (error) {
        console.log('Fehler beim Laden des Auth States:', error);
        localStorage.removeItem('authState');
      }
    }

    // Layouts aus Backend laden (wird in useEffect nach Anmeldung gemacht)
  }, []);

  // Layouts laden wenn User angemeldet ist
  React.useEffect(() => {
    const loadLayouts = async () => {
      if (authState.isAuthenticated && authState.accessToken) {
        try {
          const response = await fetch('https://api.mylovelu.de/layouts', {
            headers: {
              'Authorization': `Bearer ${authState.accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            // Backend sendet { success: true, data: [...], total: N }
            setLayouts(data.data || []);
          } else {
            console.error('Fehler beim Laden der Layouts:', response.status);
            setLayouts([]);
          }
        } catch (error) {
          console.error('Fehler beim Laden der Layouts:', error);
        }
      } else {
        // Wenn nicht angemeldet, Layouts leeren
        setLayouts([]);
      }
    };

    loadLayouts();
  }, [authState.isAuthenticated, authState.accessToken]);

  // Befund generieren mit verbesserter Fehlerbehandlung
  async function onGenerateClick() {
    if (!mainText.trim()) {
      setError("Bitte Befundtext eingeben.");
      return;
    }
    
    setError(null);
    setGeneratedResult(null);
    
    setLoading(true);
    try {
      const activeLevel = getActiveLevel();
      const r1 = await callStructured(mainText.trim(), false, activeLevel);
      
      if (r1.blocked) {
        const ok = confirm("Änderungen betreffen Inhalt; prüfen?\n\n" + formatGuardDetails(r1));
        if (!ok) { 
          if (r1.suggestion && typeof r1.suggestion === 'object') {
            setGeneratedResult(r1.suggestion);
          }
          return; 
        }
        
        try {
          const r2 = await callStructured(mainText.trim(), true, activeLevel);
          if (r2.blocked) { 
            setError("Inhaltliche Abweichungen bestehen weiterhin."); 
            if (r2.suggestion && typeof r2.suggestion === 'object') {
              setGeneratedResult(r2.suggestion);
            }
            return; 
          }
          if (typeof r2.answer === 'object') {
            setGeneratedResult(r2.answer);
            // Auto-scroll nach unten
            setTimeout(() => {
              try {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              } catch (scrollError) {
                console.error('Scroll error:', scrollError);
              }
            }, 100);
          }
        } catch (secondError: any) {
          console.error('Second attempt error:', secondError);
          setError(`Fehler beim zweiten Versuch: ${secondError?.message || "Unbekannter Fehler"}`);
          return;
        }
        return;
      }
      
      if (typeof r1.answer === 'object') {
        setGeneratedResult(r1.answer);
        // Auto-scroll nach unten
        setTimeout(() => {
          try {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          } catch (scrollError) {
            console.error('Scroll error:', scrollError);
          }
        }, 100);
      }
    } catch (e: any) { 
      console.error('Generate error:', e);
      console.error('Error stack:', e?.stack);
      
      // Spezielle Behandlung für Authentifizierungsfehler
      if (e?.message?.includes('Sitzung abgelaufen')) {
        setError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.");
        setShowAuthModal(true);
      } else if (e?.message?.includes('403')) {
        setError("Authentifizierungsfehler. Bitte melden Sie sich erneut an.");
        setShowAuthModal(true);
      } else if (e?.message?.includes('fetch')) {
        setError("Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.");
      } else {
        setError(e?.message || "Unbekannter Fehler"); 
      }
    } finally { 
      setLoading(false); 
    }
  }

  // Kopier-Funktionen mit verbesserter Fehlerbehandlung
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text).catch((clipboardError) => {
        console.error('Clipboard API error:', clipboardError);
        throw clipboardError;
      });
    } catch (err: any) {
      console.error('Fehler beim Kopieren:', err);
      // Fallback für ältere Browser
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('execCommand copy failed');
        }
      } catch (fallbackErr: any) {
        console.error('Fallback-Kopieren fehlgeschlagen:', fallbackErr);
        // Zeige eine Benutzerfreundliche Nachricht
        alert('Kopieren fehlgeschlagen. Bitte markieren Sie den Text manuell und kopieren Sie ihn mit Ctrl+C (Cmd+C auf Mac).');
      }
    }
  };

  async function callProcess(
    text: string,
    allowContentChanges = false
  ): Promise<BackendResponse> {
    try {
      const activeLevel = getActiveLevel();
      const payload = { 
        text, 
        options: { 
          mode: String(activeLevel), 
          includeRecommendations: true,
          stil: "neutral", // Standard-Wert für Kompatibilität
          ansprache: "neutral" // Standard-Wert für Kompatibilität
        }, 
        allowContentChanges 
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      let res = await fetch(PROCESS_URL, {
      method: "POST",
        headers: getAuthHeaders(),
      body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Wenn 403 (Token abgelaufen), versuche Token zu erneuern
      if (res.status === 403) {
        console.log('Token abgelaufen, versuche Erneuerung...');
        const refreshSuccess = await refreshAccessToken();
        
        if (refreshSuccess) {
          // Erneute Anfrage mit neuem Token
          res = await fetch(PROCESS_URL, {
      method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
            signal: controller.signal
          });
        } else {
          // Token-Erneuerung fehlgeschlagen, zur Anmeldung weiterleiten
          clearAuthState();
          setShowAuthModal(true);
          throw new Error('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
        }
      }
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        throw new Error(`Backend-Fehler ${res.status}: ${errorText}`);
      }
      
      const result = await res.json().catch(() => {
        throw new Error('Invalid JSON response from server');
      });
      
      return result as BackendResponse;
    } catch (error) {
      console.error('API call failed:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - Server antwortet nicht');
      }
      throw error;
    }
  }

  // NEU: Strukturierte Ausgabe mit Token-Erneuerung und Layout-Unterstützung
  async function callStructured(
    text: string,
    allowContentChanges = false,
    level: "1" | "2" | "3" | "4" | "5" = "1"
  ): Promise<BackendResponse> {
    const startTime = Date.now();
    
    try {
      // Layout-Information für Backend
      const selectedLayout = layouts?.find(l => l.id === workflowOptions.selectedLayout);
      const layoutTemplate = selectedLayout ? selectedLayout.template : undefined;
      
      const payload = { 
        text, 
        options: { 
          mode: String(level), 
          includeRecommendations: true,
          stil: "neutral", // Standard-Wert für Kompatibilität
          ansprache: "neutral", // Standard-Wert für Kompatibilität
          layout: layoutTemplate // Layout-Template an Backend senden
        }, 
        allowContentChanges 
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      let res = await fetch(STRUCTURED_URL, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Wenn 403 (Token abgelaufen), versuche Token zu erneuern
      if (res.status === 403) {
        console.log('Token abgelaufen, versuche Erneuerung...');
        const refreshSuccess = await refreshAccessToken();
        
        if (refreshSuccess) {
          // Erneute Anfrage mit neuem Token
          res = await fetch(STRUCTURED_URL, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
            signal: controller.signal
          });
        } else {
          // Token-Erneuerung fehlgeschlagen, zur Anmeldung weiterleiten
          clearAuthState();
          setShowAuthModal(true);
          throw new Error('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
        }
      }
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        throw new Error(`Backend-Fehler ${res.status}: ${errorText}`);
      }
      
      const result = await res.json().catch(() => {
        throw new Error('Invalid JSON response from server');
      });
      
      // Performance-Logging
      const duration = Date.now() - startTime;
      console.log(`API call completed in ${duration}ms`);
      
      return result as BackendResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Structured API call failed:', error);
      console.error(`Failed after ${duration}ms`);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - Server antwortet nicht');
      }
      throw error;
    }
  }

  function formatGuardDetails(resp: Extract<BackendResponse, { blocked: true }>) {
    const rows: string[] = [];
    if (resp.message) rows.push(resp.message);
    if (resp.diff?.addedNumbers?.length) rows.push(`Neue Zahlen: ${resp.diff.addedNumbers.join(", ")}`);
    if (resp.diff?.removedNumbers?.length) rows.push(`Entfernte Zahlen: ${resp.diff.removedNumbers.join(", ")}`);
    if (resp.diff?.lateralityChanged) rows.push("Lateralisierung geändert.");
    if (resp.diff?.newMedicalKeywords?.length)
      rows.push(`Neue med. Schlüsselwörter: ${resp.diff.newMedicalKeywords.join(", ")}`);
    return rows.join("\n");
  }


  // Wenn nicht angemeldet, zeige nur Login-Screen
  if (!authState.isAuthenticated) {
  return (
      <div style={{ 
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", 
        padding: "24px",
        background: "#f8f9fa",
        minHeight: "100vh",
        color: "#2c3e50",
        maxWidth: "1200px",
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div className="card" style={{ 
          padding: "48px", 
          textAlign: "center",
          maxWidth: "500px",
          width: "100%"
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "80px",
            height: "80px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "20px",
            marginBottom: "24px",
            boxShadow: "0 8px 25px rgba(102, 126, 234, 0.3)"
          }}>
            <span style={{
              color: "white",
              fontSize: "36px",
              fontWeight: "700",
              letterSpacing: "-0.02em"
            }}>
              R+
            </span>
          </div>
          
          <h1 style={{ 
            margin: "0 0 16px 0", 
            fontSize: "36px", 
            fontWeight: "700",
            color: "#2c3e50",
            letterSpacing: "-0.02em"
          }}>
            RadBefund+
          </h1>
          
          <p style={{ 
            color: "#6c757d", 
            fontSize: "18px", 
            margin: "0 0 32px 0",
            lineHeight: "1.6"
          }}>
            {CLAIM}
          </p>
          
          <p style={{ 
            color: "#495057", 
            fontSize: "16px", 
            margin: "0 0 32px 0",
            lineHeight: "1.5"
          }}>
            Bitte melden Sie sich an, um das Tool zu verwenden.
          </p>
          
          <button
            onClick={() => setShowAuthModal(true)}
            className="btn btn-primary"
            style={{ 
              padding: "16px 32px", 
              fontSize: "18px",
              fontWeight: "700",
              borderRadius: "12px"
            }}
          >
            Anmelden
          </button>
        </div>
        
        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal 
            authFormData={authFormData}
            setAuthFormData={setAuthFormData}
            authMode={authMode}
            setAuthMode={setAuthMode}
            authLoading={authLoading}
            authError={authError}
            setAuthError={setAuthError}
            setShowAuthModal={setShowAuthModal}
            handleLogin={handleLogin}
            handleRegister={handleRegister}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", 
      padding: "24px",
      background: "#f8f9fa",
      minHeight: "100vh",
      color: "#2c3e50",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      <style>{`
        .card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(0, 0, 0, 0.06);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }
        
        .card:hover::before {
          opacity: 1;
        }
        
        .btn {
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 14px;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.025em;
        }
        
        .btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }
        
        .btn:hover::before {
          left: 100%;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        
        .btn-primary:active {
          transform: translateY(0);
        }
        
        .btn-primary:disabled {
          background: #e9ecef;
          color: #6c757d;
          cursor: not-allowed;
          box-shadow: none;
        }
        
        .btn-secondary {
          background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(108, 117, 125, 0.3);
        }
        
        .btn-secondary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(108, 117, 125, 0.4);
        }
        
        .btn-outline {
          background: transparent;
          border: 2px solid #667eea;
          color: #667eea;
          position: relative;
        }
        
        .btn-outline:hover:not(:disabled) {
          background: #667eea;
          color: white;
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        .loading-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .input-modern {
          border: 2px solid #e9ecef;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          transition: all 0.3s ease;
          background: white;
        }
        
        .input-modern:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .textarea-modern {
          border: 2px solid #e9ecef;
          border-radius: 8px;
          padding: 16px;
          font-size: 14px;
          line-height: 1.6;
          transition: all 0.3s ease;
          background: white;
          resize: vertical;
        }
        
        .textarea-modern:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .slider-modern {
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(to right, #28a745 0%, #17a2b8 25%, #667eea 50%, #6f42c1 75%, #495057 100%);
          outline: none;
          cursor: pointer;
        }
        
        .slider-modern::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 3px solid #667eea;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }
        
        .slider-modern::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .slider-modern::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 3px solid #667eea;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }
        
        .result-section {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border-left: 4px solid #667eea;
        }
        
        .result-befund {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border-left: 4px solid #28a745;
        }
        
        .result-beurteilung {
          background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%);
          border-left: 4px solid #20c997;
        }
        
        .result-empfehlungen {
          background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
          border-left: 4px solid #ffc107;
        }
      `}</style>
      
      {/* Header - Kompakt oben links */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        padding: "16px 0"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "8px",
            boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)"
          }}>
            <span style={{
              color: "white",
              fontSize: "18px",
              fontWeight: "700",
              letterSpacing: "-0.02em"
            }}>
              R+
            </span>
          </div>
      <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: "20px", 
              fontWeight: "700",
              color: "#2c3e50",
              letterSpacing: "-0.01em"
            }}>
              RadBefund+
            </h1>
            <p style={{ 
              margin: 0,
              fontSize: "12px", 
              color: "#6c757d"
            }}>
              {CLAIM}
            </p>
          </div>
      </div>

        <div>
          {authState.isAuthenticated ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#2c3e50" }}>
                  {authState.user?.name}
                </div>
                <div style={{ fontSize: "12px", color: "#6c757d" }}>
                  {authState.user?.email}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-outline"
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Abmelden
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="btn btn-primary"
              style={{ padding: "10px 20px", fontSize: "14px" }}
            >
              Anmelden
            </button>
          )}
        </div>
      </div>

      {/* Workflow-Optionen und Layout-System */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        {/* Kompakte Workflow-Optionen */}
        <div className="card" style={{ padding: "16px", flex: "1" }}>
          <h3 style={{ 
            margin: "0 0 12px 0", 
            fontSize: "16px", 
            fontWeight: "700",
            color: "#2c3e50",
            letterSpacing: "-0.01em"
          }}>
            Workflow-Optionen
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Option 1 - Immer aktiv */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%)",
              border: "1px solid #28a745",
              borderRadius: "6px"
            }}>
              <div style={{
                width: "16px",
                height: "16px",
                background: "#28a745",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "10px",
                fontWeight: "700"
              }}>
                ✓
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#2c3e50" }}>
                  1: Sprachliche & grammatikalische Korrektur
                </div>
              </div>
            </div>

            {/* Option 2 */}
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: workflowOptions.option2 ? "linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)" : "#f8f9fa",
                border: `1px solid ${workflowOptions.option2 ? "#667eea" : "#e9ecef"}`,
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.3s ease"
              }}
              onClick={() => toggleWorkflowOption('option2')}
            >
              <div style={{
                width: "16px",
                height: "16px",
                background: workflowOptions.option2 ? "#667eea" : "#e9ecef",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "10px",
                fontWeight: "700"
              }}>
                {workflowOptions.option2 ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#2c3e50" }}>
                  2: Terminologie verbessern
                </div>
              </div>
            </div>

            {/* Option 3 */}
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: workflowOptions.option3 ? "linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)" : "#f8f9fa",
                border: `1px solid ${workflowOptions.option3 ? "#ffc107" : "#e9ecef"}`,
                borderRadius: "6px",
                cursor: workflowOptions.selectedLayout && workflowOptions.option3 ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                opacity: workflowOptions.selectedLayout && workflowOptions.option3 ? 0.7 : 1
              }}
              onClick={() => toggleWorkflowOption('option3')}
              title={workflowOptions.selectedLayout && workflowOptions.option3 ? "Option 3 ist erforderlich für Layout-Auswahl" : ""}
            >
              <div style={{
                width: "16px",
                height: "16px",
                background: workflowOptions.option3 ? "#ffc107" : "#e9ecef",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "10px",
                fontWeight: "700"
              }}>
                {workflowOptions.option3 ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: "12px", 
                  fontWeight: "600", 
                  color: workflowOptions.selectedLayout && workflowOptions.option3 ? "#6c757d" : "#2c3e50"
                }}>
                  3: Umstrukturierung + Beurteilung
                  {workflowOptions.selectedLayout && workflowOptions.option3 && (
                    <span style={{ fontSize: "10px", color: "#6c757d", marginLeft: "4px" }}>
                      (erforderlich)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Option 4 */}
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: workflowOptions.option4 ? "linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)" : "#f8f9fa",
                border: `1px solid ${workflowOptions.option4 ? "#17a2b8" : "#e9ecef"}`,
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.3s ease"
              }}
              onClick={() => toggleWorkflowOption('option4')}
            >
              <div style={{
                width: "16px",
                height: "16px",
                background: workflowOptions.option4 ? "#17a2b8" : "#e9ecef",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "10px",
                fontWeight: "700"
              }}>
                {workflowOptions.option4 ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#2c3e50" }}>
                  4: Klinische Empfehlung
                </div>
              </div>
            </div>

            {/* Option 5 */}
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: workflowOptions.option5 ? "linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)" : "#f8f9fa",
                border: `1px solid ${workflowOptions.option5 ? "#dc3545" : "#e9ecef"}`,
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.3s ease"
              }}
              onClick={() => toggleWorkflowOption('option5')}
            >
              <div style={{
                width: "16px",
                height: "16px",
                background: workflowOptions.option5 ? "#dc3545" : "#e9ecef",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "10px",
                fontWeight: "700"
              }}>
                {workflowOptions.option5 ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#2c3e50" }}>
                  5: Zusatzinfos/DDx
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Layout-System */}
        <div className="card" style={{ padding: "16px", flex: "1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: "16px", 
              fontWeight: "700",
              color: "#2c3e50",
              letterSpacing: "-0.01em"
            }}>
              Layout-Auswahl
            </h3>
            <button
              onClick={() => setShowLayoutModal(true)}
              className="btn btn-outline"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              + Neues Layout
            </button>
          </div>
          
          {workflowOptions.selectedLayout ? (
            <div style={{
              padding: "12px",
              background: "linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%)",
              border: "2px solid #28a745",
              borderRadius: "8px",
              marginBottom: "8px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#2c3e50" }}>
                    {layouts?.find(l => l.id === workflowOptions.selectedLayout)?.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6c757d" }}>
                    {layouts?.find(l => l.id === workflowOptions.selectedLayout)?.description}
                  </div>
                </div>
                <button
                  onClick={deselectLayout}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc3545",
                    cursor: "pointer",
                    fontSize: "16px",
                    padding: "4px"
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              padding: "12px",
              background: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: "8px",
              marginBottom: "8px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "12px", color: "#6c757d" }}>
                Kein Layout ausgewählt
              </div>
            </div>
          )}

          {layouts && layouts.length > 0 && (
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {layouts.map((layout) => (
                <div
                  key={layout.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: workflowOptions.selectedLayout === layout.id ? "linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)" : "#f8f9fa",
                    border: `1px solid ${workflowOptions.selectedLayout === layout.id ? "#667eea" : "#e9ecef"}`,
                    borderRadius: "6px",
                    marginBottom: "4px",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                  onClick={() => selectLayout(layout.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#2c3e50" }}>
                      {layout.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "#6c757d" }}>
                      {layout.description}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayout(layout.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#dc3545",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "2px 6px"
                    }}
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Haupttext-Eingabe - Zentral */}
      <div className="card" style={{ padding: "32px", marginBottom: "24px", textAlign: "center" }}>
        <MainTextarea />
      </div>

      {/* Großer Befund erstellen Button */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <button 
          onClick={(e) => {
            e.preventDefault();
            try {
              onGenerateClick().catch((error) => {
                console.error('Button click error:', error);
                setError('Ein unerwarteter Fehler ist aufgetreten');
              });
            } catch (syncError) {
              console.error('Synchronous error in button click:', syncError);
              setError('Ein unerwarteter Fehler ist aufgetreten');
            }
          }}
          disabled={loading}
          className="btn btn-primary"
          style={{ 
            width: "100%",
            maxWidth: "400px",
            height: "64px",
            fontSize: "20px",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            borderRadius: "16px",
            letterSpacing: "-0.01em",
            boxShadow: "0 8px 25px rgba(102, 126, 234, 0.3)"
          }}
        >
          {loading ? (
            <>
              <div className="loading-spinner"></div>
              Befund wird erstellt...
            </>
          ) : (
            "Befund erstellen"
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card" style={{ 
          padding: "16px", 
          marginBottom: "24px",
          background: "#f8d7da",
          border: "1px solid #f5c6cb",
          color: "#721c24"
        }}>
          <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600" }}>
            Fehler aufgetreten
          </h4>
          <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
        </div>
      )}

      {/* Results Section */}
      {generatedResult && (
        <div className="card" style={{ padding: "32px", marginBottom: "32px" }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            marginBottom: "24px",
            gap: "12px"
          }}>
            <div style={{
              width: "8px",
              height: "8px",
              background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
              borderRadius: "50%"
            }}></div>
            <h3 style={{ 
              margin: 0, 
              fontSize: "22px", 
              fontWeight: "700",
              color: "#2c3e50",
              letterSpacing: "-0.01em"
            }}>
              Generierte Ergebnisse
            </h3>
          </div>
          
          {/* Verbesserter Befund */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "16px"
            }}>
              <h4 style={{ 
                margin: 0, 
                fontSize: "18px", 
                fontWeight: "700",
                color: "#2c3e50",
                letterSpacing: "-0.01em"
              }}>
                Verbesserter Befund
              </h4>
              <button 
                onClick={() => copyToClipboard(generatedResult.befund)}
                className="btn btn-outline"
                style={{ padding: "8px 16px", fontSize: "13px", fontWeight: "600" }}
              >
                Kopieren
        </button>
            </div>
            <div className="result-befund" style={{
              borderRadius: "8px",
              padding: "20px",
              fontFamily: "inherit",
              fontSize: "14px",
              lineHeight: "1.7",
              whiteSpace: "pre-wrap",
              overflow: "auto",
              maxHeight: "300px"
            }}>
              {generatedResult.befund}
            </div>
      </div>

          {/* Kurze Beurteilung - nur wenn Option 3, 4 oder 5 aktiv */}
          {(workflowOptions.option3 || workflowOptions.option4 || workflowOptions.option5) && generatedResult.beurteilung && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "16px"
              }}>
                <h4 style={{ 
                  margin: 0, 
                  fontSize: "18px", 
                  fontWeight: "700",
                  color: "#2c3e50",
                  letterSpacing: "-0.01em"
                }}>
                  Kurze Beurteilung
                </h4>
                <button 
                  onClick={() => copyToClipboard(generatedResult.beurteilung)}
                  className="btn btn-outline"
                  style={{ padding: "8px 16px", fontSize: "13px", fontWeight: "600" }}
                >
                  Kopieren
                </button>
              </div>
              <div className="result-beurteilung" style={{
                borderRadius: "8px",
                padding: "20px",
                fontFamily: "inherit",
                fontSize: "14px",
                lineHeight: "1.7",
                whiteSpace: "pre-wrap",
                overflow: "auto",
                maxHeight: "200px"
              }}>
                {generatedResult.beurteilung}
              </div>
        </div>
      )}

          {/* Klinische Empfehlung - nur wenn Option 4 oder 5 aktiv */}
          {(workflowOptions.option4 || workflowOptions.option5) && generatedResult.empfehlungen && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "16px"
              }}>
                <h4 style={{ 
                  margin: 0, 
                  fontSize: "18px", 
                  fontWeight: "700",
                  color: "#2c3e50",
                  letterSpacing: "-0.01em"
                }}>
                  Klinische Empfehlung
                </h4>
                <button 
                  onClick={() => copyToClipboard(generatedResult.empfehlungen || "")}
                  className="btn btn-outline"
                  style={{ padding: "8px 16px", fontSize: "13px", fontWeight: "600" }}
                >
                  Kopieren
                </button>
              </div>
              <div className="result-empfehlungen" style={{
                borderRadius: "8px",
                padding: "20px",
                fontFamily: "inherit",
                fontSize: "14px",
                lineHeight: "1.7",
                whiteSpace: "pre-wrap",
                overflow: "auto",
                maxHeight: "200px"
              }}>
                {generatedResult.empfehlungen}
              </div>
        </div>
      )}

          {/* Zusatzinformationen / DDx - nur wenn Option 5 aktiv */}
          {workflowOptions.option5 && generatedResult.zusatzinformationen && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "16px"
              }}>
                <h4 style={{ 
                  margin: 0, 
                  fontSize: "18px", 
                  fontWeight: "700",
                  color: "#2c3e50",
                  letterSpacing: "-0.01em"
                }}>
                  Zusatzinformationen / DDx
                </h4>
                <button 
                  onClick={() => copyToClipboard(generatedResult.zusatzinformationen || "")}
                  className="btn btn-outline"
                  style={{ padding: "8px 16px", fontSize: "13px", fontWeight: "600" }}
                >
                  Kopieren
                </button>
              </div>
              <div className="result-empfehlungen" style={{
                borderRadius: "8px",
                padding: "20px",
                fontFamily: "inherit",
                fontSize: "14px",
                lineHeight: "1.7",
                whiteSpace: "pre-wrap",
                overflow: "auto",
                maxHeight: "200px"
              }}>
                {generatedResult.zusatzinformationen}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{
            background: "linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)",
            border: "1px solid #bee5eb",
            borderRadius: "8px",
            padding: "16px",
            marginTop: "20px"
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: "13px", 
              color: "#0c5460",
              fontWeight: "600",
              lineHeight: "1.5"
            }}>
              {DISCLAIMER}
            </p>
          </div>
        </div>
      )}

      {/* Neuer Befund Button - Ganz unten */}
      {generatedResult && (
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <button 
            onClick={(e) => {
              e.preventDefault();
              try {
                resetForNewBefund();
              } catch (error) {
                console.error('Error in resetForNewBefund:', error);
                // Fallback: Seite neu laden
                window.location.reload();
              }
            }}
            className="btn btn-secondary"
            style={{ 
              width: "100%",
              maxWidth: "300px",
              height: "56px",
              fontSize: "18px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              borderRadius: "12px",
              letterSpacing: "-0.01em"
            }}
          >
            Neuer Befund
          </button>
        </div>
      )}

      {/* Layout Modal */}
      {showLayoutModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            width: "600px",
            maxWidth: "90vw",
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <h2 style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "700",
                color: "#2c3e50"
              }}>
                Neues Layout erstellen
              </h2>
              <button
                onClick={() => {
                  setShowLayoutModal(false);
                  setNewLayout({ name: "", description: "", template: "" });
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6c757d"
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057"
              }}>
                Layout-Name *
              </label>
      <input
                type="text"
                value={newLayout.name}
                onChange={(e) => setNewLayout(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Standard CT-Befund"
                className="input-modern"
        style={{ width: "100%" }}
      />
      </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057"
              }}>
                Beschreibung
        </label>
              <input
                type="text"
                value={newLayout.description}
                onChange={(e) => setNewLayout(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Kurze Beschreibung des Layouts"
                className="input-modern"
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057"
              }}>
                Layout-Template *
        </label>
              <textarea
                value={newLayout.template}
                onChange={(e) => setNewLayout(prev => ({ ...prev, template: e.target.value }))}
                placeholder="Definieren Sie hier die Struktur des Layouts. Verwenden Sie Platzhalter wie [BEFUND], [BEURTEILUNG], etc."
                className="textarea-modern"
                style={{ 
                  width: "100%", 
                  minHeight: "200px",
                  fontFamily: "monospace",
                  fontSize: "13px"
                }}
              />
              <div style={{
                marginTop: "8px",
                padding: "12px",
                background: "#f8f9fa",
                borderRadius: "6px",
                border: "1px solid #e9ecef"
              }}>
                <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#495057" }}>
                  Verfügbare Platzhalter:
                </div>
                <div style={{ fontSize: "11px", color: "#6c757d", lineHeight: "1.4" }}>
                  <div>[BEFUND] - Der optimierte Befundtext</div>
                  <div>[BEURTEILUNG] - Die medizinische Beurteilung</div>
                  <div>[EMPFEHLUNGEN] - Klinische Empfehlungen</div>
                  <div>[ZUSATZINFOS] - Zusatzinformationen/Differentialdiagnosen</div>
                </div>
              </div>
      </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowLayoutModal(false);
                  setNewLayout({ name: "", description: "", template: "" });
                }}
                className="btn btn-secondary"
                style={{ padding: "10px 20px" }}
              >
                Abbrechen
        </button>
              <button
                onClick={saveLayout}
                className="btn btn-primary"
                style={{ padding: "10px 20px" }}
              >
                Layout speichern
        </button>
      </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal 
          authFormData={authFormData}
          setAuthFormData={setAuthFormData}
          authMode={authMode}
          setAuthMode={setAuthMode}
          authLoading={authLoading}
          authError={authError}
          setAuthError={setAuthError}
          setShowAuthModal={setShowAuthModal}
          handleLogin={handleLogin}
          handleRegister={handleRegister}
        />
      )}

    </div>
  );
}

// Globaler Error Handler für unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection detected:', event.reason);
  console.error('Stack trace:', event.reason?.stack);
  console.error('Promise rejection details:', {
    reason: event.reason,
    type: typeof event.reason,
    message: event.reason?.message,
    name: event.reason?.name,
    toString: event.reason?.toString?.()
  });
  
  // Verhindere, dass der Fehler in der Konsole erscheint
  event.preventDefault();
  
  // Spezielle Behandlung für verschiedene Fehlertypen
  if (event.reason?.message?.includes('fetch')) {
    console.warn('Netzwerkfehler erkannt - möglicherweise Server-Problem');
  } else if (event.reason?.message?.includes('ChunkLoadError')) {
    console.warn('Chunk-Load-Fehler erkannt - möglicherweise Netzwerkproblem');
  } else if (event.reason?.message?.includes('Cannot read properties')) {
    console.warn('Property-Access-Fehler erkannt - möglicherweise Race Condition');
  } else {
    console.warn('Unbekannter Promise-Rejection-Typ:', typeof event.reason);
  }
  
  // Zusätzliche Debugging-Informationen
  console.group('🔍 Debug Information');
  console.log('Event object:', event);
  console.log('Promise:', event.promise);
  console.log('Reason type:', typeof event.reason);
  console.log('Reason constructor:', event.reason?.constructor?.name);
  console.groupEnd();
});

// Globaler Error Handler für JavaScript-Fehler
window.addEventListener('error', (event) => {
  console.error('JavaScript error:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  });
  
  // Verhindere, dass der Fehler die Anwendung zum Absturz bringt
  event.preventDefault();
});

// Zusätzlicher Handler für React Error Boundaries
window.addEventListener('error', (event) => {
  if (event.error?.name === 'ChunkLoadError') {
    console.error('Chunk load error - likely network issue:', event.error);
    event.preventDefault();
  }
});

// Handler für spezifische React-Fehler
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('Cannot read properties')) {
    console.error('Property access error:', event.error);
    event.preventDefault();
  }
});

// Zusätzlicher Handler für alle möglichen Promise-Rejections
window.addEventListener('unhandledrejection', (event) => {
  // Spezielle Behandlung für "Unknown promise rejection reason"
  if (!event.reason || event.reason === undefined || event.reason === null) {
    console.error('🚨 Unknown promise rejection reason detected');
    console.error('Event details:', {
      type: event.type,
      promise: event.promise,
      reason: event.reason,
      timeStamp: event.timeStamp
    });
    event.preventDefault();
    return;
  }
  
  // Behandlung für leere oder undefinierte Gründe
  if (event.reason === '' || event.reason === 'Unknown promise rejection reason') {
    console.error('🚨 Empty or unknown promise rejection reason');
    console.error('This might be caused by a third-party library or browser extension');
    event.preventDefault();
    return;
  }
  
  // Behandlung für spezifische Fehlermeldungen
  if (typeof event.reason === 'string' && event.reason.includes('Unknown promise rejection reason')) {
    console.error('🚨 String-based unknown promise rejection reason');
    console.error('This is likely from a third-party library or browser extension');
    event.preventDefault();
    return;
  }
  
  // Behandlung für Objekte ohne message-Eigenschaft
  if (typeof event.reason === 'object' && !event.reason.message && !event.reason.stack) {
    console.error('🚨 Object-based promise rejection without message/stack');
    console.error('Reason object:', event.reason);
    event.preventDefault();
    return;
  }
});

// Zusätzlicher Handler für React-spezifische Fehler
window.addEventListener('error', (event) => {
  // Behandle React-spezifische Fehler
  if (event.error?.name === 'Invariant Violation') {
    console.error('React Invariant Violation:', event.error);
    event.preventDefault();
  }
  
  // Behandle Chunk-Load-Fehler
  if (event.error?.name === 'ChunkLoadError') {
    console.error('Chunk Load Error:', event.error);
    event.preventDefault();
  }
  
  // Behandle alle anderen JavaScript-Fehler
  console.error('JavaScript Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  });
  event.preventDefault();
});

// Zusätzliche Sicherheitsmaßnahmen für Promise-Operationen
if (typeof window !== 'undefined' && window.Promise) {
  // Wrapper für alle Promise-Operationen
  const originalPromise = window.Promise;
  
  // Sichere Promise-Erstellung
  const safePromise = (executor: any) => {
    return new originalPromise((resolve, reject) => {
      try {
        executor(
          (value: any) => {
            try {
              resolve(value);
            } catch (error) {
              console.error('Error in Promise resolve:', error);
              reject(error);
            }
          },
          (reason: any) => {
            try {
              reject(reason);
            } catch (error) {
              console.error('Error in Promise reject:', error);
            }
          }
        );
      } catch (error) {
        console.error('Error in Promise constructor:', error);
        reject(error);
      }
    });
  };
  
  // Ersetze Promise.all, Promise.race, etc. mit sicheren Versionen
  window.Promise.all = (promises: any[]) => {
    return originalPromise.all(promises.map(p => 
      p instanceof originalPromise ? p : safePromise(p)
    ));
  };
  
  window.Promise.race = (promises: any[]) => {
    return originalPromise.race(promises.map(p => 
      p instanceof originalPromise ? p : safePromise(p)
    ));
  };
}

// Sichere Initialisierung
try {
const el = document.getElementById("container");
  const root = createRoot(el ?? (() => { 
    const f = document.createElement("div"); 
    f.id = "container"; 
    document.body.appendChild(f); 
    return f; 
  })());
  
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (error) {
  console.error('Critical error during app initialization:', error);
  // Fallback: Einfache Fehlermeldung anzeigen
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; margin: 20px;">
      <h2>Ein Fehler ist aufgetreten</h2>
      <p>Die Anwendung konnte nicht geladen werden.</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Seite neu laden
      </button>
    </div>
  `;
}