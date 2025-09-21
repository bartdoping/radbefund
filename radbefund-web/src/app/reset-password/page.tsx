'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Dark mode detection
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(savedTheme === 'dark' || (!savedTheme && prefersDark));

    // Get token from URL
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      setError('Kein Reset-Token gefunden. Bitte verwenden Sie den Link aus Ihrer Email.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Kein Reset-Token gefunden.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Bitte füllen Sie alle Felder aus.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein und mindestens einen Großbuchstaben, einen Kleinbuchstaben, eine Zahl und ein Sonderzeichen enthalten.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Zurücksetzen des Passworts');
      }

      setSuccess('Passwort erfolgreich zurückgesetzt! Sie werden zur Anmeldung weitergeleitet...');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`max-w-md w-full mx-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-8`}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">R+</span>
          </div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Passwort zurücksetzen
          </h1>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Geben Sie Ihr neues Passwort ein
          </p>
        </div>

        {error && (
          <div className={`p-4 rounded-lg border mb-6 ${
            isDarkMode 
              ? 'bg-red-900/20 border-red-800 text-red-300' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`} role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {success && (
          <div className={`p-4 rounded-lg border mb-6 ${
            isDarkMode 
              ? 'bg-green-900/20 border-green-800 text-green-300' 
              : 'bg-green-50 border-green-200 text-green-700'
          }`} role="alert">
            <span className="block sm:inline">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Neues Passwort *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Ihr neues sicheres Passwort"
            />
          </div>

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

          <div className={`p-4 rounded-lg border text-sm ${
            isDarkMode 
              ? 'bg-gray-700 border-gray-600' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className={`font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Passwort-Anforderungen:
            </div>
            <div className="space-y-1">
              <div className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-green-500' : 'text-red-500'}`}>
                <span className="font-bold">{newPassword.length >= 8 ? "✓" : "✗"}</span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens 8 Zeichen</span>
              </div>
              <div className={`flex items-center gap-2 ${/[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-red-500'}`}>
                <span className="font-bold">{/[A-Z]/.test(newPassword) ? "✓" : "✗"}</span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens ein Großbuchstabe</span>
              </div>
              <div className={`flex items-center gap-2 ${/[a-z]/.test(newPassword) ? 'text-green-500' : 'text-red-500'}`}>
                <span className="font-bold">{/[a-z]/.test(newPassword) ? "✓" : "✗"}</span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens ein Kleinbuchstabe</span>
              </div>
              <div className={`flex items-center gap-2 ${/[0-9]/.test(newPassword) ? 'text-green-500' : 'text-red-500'}`}>
                <span className="font-bold">{/[0-9]/.test(newPassword) ? "✓" : "✗"}</span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens eine Zahl</span>
              </div>
              <div className={`flex items-center gap-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-green-500' : 'text-red-500'}`}>
                <span className="font-bold">{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? "✓" : "✗"}</span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mindestens ein Sonderzeichen</span>
              </div>
            </div>
          </div>

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
                Passwort wird zurückgesetzt...
              </span>
            ) : (
              'Passwort zurücksetzen'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className={`text-sm hover:underline transition-colors ${
              isDarkMode 
                ? 'text-blue-400 hover:text-blue-300' 
                : 'text-blue-600 hover:text-blue-500'
            }`}
          >
            Zurück zur Anmeldung
          </button>
        </div>
      </div>
    </div>
  );
}
