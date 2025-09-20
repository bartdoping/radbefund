'use client';

import { useState } from 'react';

interface WorkflowOptions {
  option1: boolean;
  option2: boolean;
  option3: boolean;
  option4: boolean;
  option5: boolean;
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

  const getActiveLevel = (): "1" | "2" | "3" | "4" | "5" => {
    if (workflowOptions.option5) return "5";
    if (workflowOptions.option4) return "4";
    if (workflowOptions.option3) return "3";
    if (workflowOptions.option2) return "2";
    return "1";
  };

  const handleProcess = async () => {
    if (!text.trim()) {
      setError('Bitte Befundtext eingeben.');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          options: {
            mode: getActiveLevel(),
            includeRecommendations: true,
          },
          allowContentChanges: false,
        }),
      });

      const data = await response.json();

      if (data.blocked) {
        setError(data.message);
        setResult(data.suggestion);
      } else {
        setResult(data.answer);
      }
    } catch (err) {
      setError('Fehler bei der Verarbeitung');
    } finally {
      setLoading(false);
    }
  };

  const toggleOption = (option: keyof WorkflowOptions) => {
    if (option === 'option1') return; // Option 1 ist immer aktiv
    
    setWorkflowOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">R+</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">RadBefund+</h1>
                <p className="text-sm text-gray-500">Radiologische Befunde optimieren</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workflow Options */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow-Optionen</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { key: 'option1', label: '1: Sprachliche Korrektur', always: true },
              { key: 'option2', label: '2: Terminologie verbessern' },
              { key: 'option3', label: '3: Umstrukturierung + Beurteilung' },
              { key: 'option4', label: '4: Klinische Empfehlung' },
              { key: 'option5', label: '5: Zusatzinfos/DDx' },
            ].map(({ key, label, always }) => (
              <button
                key={key}
                onClick={() => toggleOption(key as keyof WorkflowOptions)}
                disabled={always}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  workflowOptions[key as keyof WorkflowOptions]
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                } ${always ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {label}
                {workflowOptions[key as keyof WorkflowOptions] && (
                  <span className="ml-2">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Befundtext</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Fügen Sie hier den gesamten Befundtext ein..."
            className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Process Button */}
        <div className="text-center mb-6">
          <button
            onClick={handleProcess}
            disabled={loading}
            className="bg-gradient-to-r from-primary-500 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:from-primary-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Verarbeitung läuft...' : 'Befund erstellen'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Optimierter Befund</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-800">{result}</pre>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => navigator.clipboard.writeText(result)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Kopieren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
