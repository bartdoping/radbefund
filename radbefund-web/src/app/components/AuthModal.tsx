'use client';

import { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  onRegister: (email: string, password: string, name: string, organization?: string) => Promise<void>;
  onVerifyEmail: (email: string, code: string, password: string, name: string, organization?: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onResetPassword: (token: string, newPassword: string) => Promise<void>;
  isDarkMode?: boolean;
}

export default function AuthModal({ isOpen, onClose, onLogin, onRegister, onVerifyEmail, onForgotPassword, onResetPassword, isDarkMode = false }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'verify' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');

  // Password validation
  const passwordRequirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await onLogin(email, password, rememberMe);
        onClose();
      } else if (mode === 'register') {
        if (!isPasswordValid) {
          setError('Passwort erfüllt nicht alle Anforderungen');
          return;
        }
        if (!passwordsMatch) {
          setError('Passwörter stimmen nicht überein');
          return;
        }
        if (!acceptTerms) {
          setError('Bitte akzeptieren Sie die Datenschutz- und AGB-Bestimmungen');
          return;
        }
        await onRegister(email, password, name, organization);
        setMode('verify');
        setSuccess('Verifizierungs-Email wurde gesendet. Bitte geben Sie den 6-stelligen Code ein.');
      } else if (mode === 'verify') {
        if (!isPasswordValid) {
          setError('Passwort erfüllt nicht alle Anforderungen');
          return;
        }
        if (!passwordsMatch) {
          setError('Passwörter stimmen nicht überein');
          return;
        }
        await onVerifyEmail(email, verificationCode, password, name, organization);
        onClose();
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Bitte geben Sie Ihre Email-Adresse ein');
          return;
        }
        await onForgotPassword(email);
        setSuccess('Passwort-Reset-Email wurde gesendet. Bitte überprüfen Sie Ihr Postfach.');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Ein Fehler ist aufgetreten';
      setError(errorMessage);
      
      // Wenn es sich um ein bereits existierendes Konto handelt, zeige einen Link zur Anmeldung
      if (errorMessage.includes('bereits registriert') || errorMessage.includes('bereits existiert')) {
        setError(errorMessage + ' Klicken Sie hier, um sich stattdessen anzumelden.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setOrganization('');
    setConfirmPassword('');
    setVerificationCode('');
    setError('');
    setSuccess('');
    setAcceptTerms(false);
  };

  const handleModeChange = (newMode: 'login' | 'register' | 'verify' | 'forgot') => {
    setMode(newMode);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border shadow-xl w-full max-w-md`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">R+</span>
              </div>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {mode === 'login' ? 'Anmelden' : 
                 mode === 'register' ? 'Registrieren' :
                 mode === 'verify' ? 'Email verifizieren' :
                 mode === 'forgot' ? 'Passwort vergessen' :
                 'Email verifizieren'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:bg-gray-700 hover:text-white' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Ihr vollständiger Name"
                />
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                E-Mail *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="ihre.email@beispiel.de"
              />
            </div>

            {/* Password Field - nur für login und register */}
            {(mode === 'login' || mode === 'register') && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Passwort *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Ihr sicheres Passwort"
                />
              
                {mode === 'register' && password && (
                <div className={`mt-3 p-4 rounded-lg border text-sm ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Passwort-Anforderungen:
                  </div>
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 ${passwordRequirements.length ? 'text-green-500' : 'text-red-500'}`}>
                      <span className="font-bold">{passwordRequirements.length ? "✓" : "✗"}</span>
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens 8 Zeichen</span>
                    </div>
                    <div className={`flex items-center gap-2 ${passwordRequirements.uppercase ? 'text-green-500' : 'text-red-500'}`}>
                      <span className="font-bold">{passwordRequirements.uppercase ? "✓" : "✗"}</span>
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens 1 Großbuchstabe</span>
                    </div>
                    <div className={`flex items-center gap-2 ${passwordRequirements.lowercase ? 'text-green-500' : 'text-red-500'}`}>
                      <span className="font-bold">{passwordRequirements.lowercase ? "✓" : "✗"}</span>
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens 1 Kleinbuchstabe</span>
                    </div>
                    <div className={`flex items-center gap-2 ${passwordRequirements.special ? 'text-green-500' : 'text-red-500'}`}>
                      <span className="font-bold">{passwordRequirements.special ? "✓" : "✗"}</span>
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens 1 Sonderzeichen</span>
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}

            {mode === 'login' && (
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={`w-4 h-4 rounded border-2 focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-blue-500' 
                        : 'bg-white border-gray-300 text-blue-500'
                    }`}
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Angemeldet bleiben
                  </span>
                </label>
              </div>
            )}

            {/* Verification Code Field */}
            {mode === 'verify' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Verifizierungscode *
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="123456"
                />
                <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Geben Sie den 6-stelligen Code aus der Email ein
                </p>
              </div>
            )}


            {mode === 'register' && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Passwort bestätigen *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="Passwort wiederholen"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Organisation (optional)
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="Ihre Organisation oder Klinik"
                  />
                </div>

                <div>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className={`mt-1 w-4 h-4 rounded border-2 focus:ring-2 focus:ring-blue-500 ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-blue-500' 
                          : 'bg-white border-gray-300 text-blue-500'
                      }`}
                    />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Ich akzeptiere die{' '}
                      <a href="#" className="text-blue-500 hover:text-blue-400 underline">
                        Datenschutzbestimmungen
                      </a>{' '}
                      und{' '}
                      <a href="#" className="text-blue-500 hover:text-blue-400 underline">
                        AGB
                      </a>
                    </span>
                  </label>
                </div>
              </>
            )}

            {error && (
              <div className={`p-4 rounded-lg border ${
                isDarkMode 
                  ? 'bg-red-900/20 border-red-800 text-red-300' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`} role="alert">
                <div className="block sm:inline">
                  {error.includes('bereits registriert') || error.includes('bereits existiert') ? (
                    <div>
                      <span>{error.replace(' Klicken Sie hier, um sich stattdessen anzumelden.', '')}</span>
                      <button
                        type="button"
                        onClick={() => handleModeChange('login')}
                        className={`ml-2 underline hover:no-underline font-semibold ${
                          isDarkMode 
                            ? 'text-blue-400 hover:text-blue-300' 
                            : 'text-blue-600 hover:text-blue-500'
                        }`}
                      >
                        Klicken Sie hier, um sich stattdessen anzumelden.
                      </button>
                    </div>
                  ) : (
                    <span>{error}</span>
                  )}
                </div>
              </div>
            )}

            {success && (
              <div className={`p-4 rounded-lg border ${
                isDarkMode 
                  ? 'bg-green-900/20 border-green-800 text-green-300' 
                  : 'bg-green-50 border-green-200 text-green-700'
              }`} role="alert">
                <span className="block sm:inline">{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {mode === 'login' ? 'Anmelden...' : 
                   mode === 'register' ? 'Registrieren...' :
                   mode === 'verify' ? 'Verifizieren...' :
                   mode === 'forgot' ? 'Email senden...' :
                   'Verifizieren...'}
                </span>
              ) : (
                mode === 'login' ? 'Anmelden' : 
                mode === 'register' ? 'Registrieren' :
                mode === 'verify' ? 'Email verifizieren' :
                mode === 'forgot' ? 'Reset-Email senden' :
                'Email verifizieren'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-center space-y-2">
            {/* Passwort vergessen Link */}
            {mode === 'login' && (
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange('forgot')}
                  className={`text-sm hover:underline transition-colors ${
                    isDarkMode 
                      ? 'text-blue-400 hover:text-blue-300' 
                      : 'text-blue-600 hover:text-blue-500'
                  }`}
                >
                  Passwort vergessen?
                </button>
              </div>
            )}

            {/* Zurück zu Login Link */}
            {mode === 'forgot' && (
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className={`text-sm hover:underline transition-colors ${
                    isDarkMode 
                      ? 'text-blue-400 hover:text-blue-300' 
                      : 'text-blue-600 hover:text-blue-500'
                  }`}
                >
                  Zurück zur Anmeldung
                </button>
              </div>
            )}

            {/* Reset-Info für forgot Mode */}
            {mode === 'forgot' && success && (
              <div className={`p-4 rounded-lg border ${
                isDarkMode 
                  ? 'bg-blue-900/20 border-blue-800 text-blue-300' 
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                <div className="text-sm">
                  <p className="font-semibold mb-2">📧 Email wurde gesendet!</p>
                  <p className="mb-2">Bitte überprüfen Sie Ihr Postfach und klicken Sie auf den Reset-Link in der Email.</p>
                  <p className="text-xs opacity-75">
                    Der Link führt Sie zu einer sicheren Seite, wo Sie Ihr neues Passwort eingeben können.
                  </p>
                </div>
              </div>
            )}

            {/* Register/Login Toggle */}
            {(mode === 'login' || mode === 'register') && (
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange(mode === 'login' ? 'register' : 'login')}
                  className={`text-sm hover:underline transition-colors ${
                    isDarkMode 
                      ? 'text-blue-400 hover:text-blue-300' 
                      : 'text-blue-600 hover:text-blue-500'
                  }`}
                >
                  {mode === 'login' 
                    ? 'Noch kein Konto? Jetzt registrieren' 
                    : 'Bereits registriert? Jetzt anmelden'
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
