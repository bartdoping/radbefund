'use client';

import { useState } from 'react';

interface Layout {
  id: string;
  name: string;
  description: string;
  template: string;
  createdAt: string;
  isDefault?: boolean;
}

interface LayoutSelectorProps {
  selectedLayout: string | null;
  onSelectLayout: (layoutId: string | null) => void;
  layouts: Layout[];
  onSaveLayout: (layout: Omit<Layout, 'id' | 'createdAt'>) => void;
  onUpdateLayout: (layoutId: string, layout: Omit<Layout, 'id' | 'createdAt'>) => void;
  onDeleteLayout: (layoutId: string) => void;
  isDarkMode?: boolean;
}

export default function LayoutSelector({ 
  selectedLayout, 
  onSelectLayout, 
  layouts, 
  onSaveLayout, 
  onUpdateLayout,
  onDeleteLayout,
  isDarkMode = false
}: LayoutSelectorProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingLayout, setEditingLayout] = useState<Layout | null>(null);
  const [newLayout, setNewLayout] = useState({
    name: '',
    description: '',
    template: '',
    befundTemplate: '',
    beurteilungTemplate: ''
  });

  const handleSaveLayout = () => {
    if (!newLayout.name.trim() || !newLayout.befundTemplate.trim()) {
      alert('Layout-Name und Befund-Template sind erforderlich.');
      return;
    }

    // Kombiniere Befund und Beurteilung zu einem Template
    const combinedTemplate = `BEFUND:\n${newLayout.befundTemplate}\n\nBEURTEILUNG:\n${newLayout.beurteilungTemplate || 'Keine Beurteilung verfügbar.'}`;
    
    const layoutData = {
      name: newLayout.name,
      description: newLayout.description,
      template: combinedTemplate
    };

    if (editingLayout) {
      onUpdateLayout(editingLayout.id, layoutData);
    } else {
      onSaveLayout(layoutData);
    }
    
    setNewLayout({ name: '', description: '', template: '', befundTemplate: '', beurteilungTemplate: '' });
    setEditingLayout(null);
    setShowModal(false);
  };

  const handleEditLayout = (layout: Layout) => {
    setEditingLayout(layout);
    
    // Parse das Template in Befund und Beurteilung
    const templateParts = layout.template.split('BEURTEILUNG:');
    const befundPart = templateParts[0].replace('BEFUND:', '').trim();
    const beurteilungPart = templateParts[1] ? templateParts[1].trim() : '';
    
    setNewLayout({
      name: layout.name,
      description: layout.description,
      template: layout.template,
      befundTemplate: befundPart,
      beurteilungTemplate: beurteilungPart
    });
    setShowModal(true);
  };

  const handleDuplicateLayout = (layout: Layout) => {
    // Parse das Template in Befund und Beurteilung
    const templateParts = layout.template.split('BEURTEILUNG:');
    const befundPart = templateParts[0].replace('BEFUND:', '').trim();
    const beurteilungPart = templateParts[1] ? templateParts[1].trim() : '';
    
    setNewLayout({
      name: `${layout.name} (Kopie)`,
      description: layout.description,
      template: layout.template,
      befundTemplate: befundPart,
      beurteilungTemplate: beurteilungPart
    });
    setEditingLayout(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLayout(null);
    setNewLayout({ name: '', description: '', template: '', befundTemplate: '', beurteilungTemplate: '' });
  };

  const handleDeleteLayoutWithConfirmation = (layout: Layout) => {
    if (window.confirm(`Sind Sie sicher, dass Sie das Layout "${layout.name}" löschen möchten?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) {
      onDeleteLayout(layout.id);
    }
  };

  return (
    <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm border p-4`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Layout-Auswahl</h3>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          + Neues Layout
        </button>
      </div>

      {selectedLayout ? (
        <div className={`${isDarkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'} border rounded-lg p-3 mb-3`}>
          <div className="flex justify-between items-center">
            <div>
              <div className={`font-semibold ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
                {layouts.find(l => l.id === selectedLayout)?.name}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                {layouts.find(l => l.id === selectedLayout)?.description}
              </div>
            </div>
            <button
              onClick={() => onSelectLayout(null)}
              className={`${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'} text-lg font-bold`}
            >
              ×
            </button>
          </div>
        </div>
      ) : (
        <div className={`${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3 mb-3 text-center`}>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Kein Layout ausgewählt</div>
        </div>
      )}

      {layouts.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-2">
          {layouts.map((layout) => (
            <div
              key={layout.id}
              className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                selectedLayout === layout.id
                  ? isDarkMode
                    ? 'bg-blue-900/30 border-blue-600'
                    : 'bg-blue-50 border-blue-300'
                  : isDarkMode
                    ? 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => onSelectLayout(layout.id)}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{layout.name}</div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{layout.description}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditLayout(layout);
                    }}
                    className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30' : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'} text-xs px-1.5 py-1 rounded transition-colors`}
                    title="Layout bearbeiten"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateLayout(layout);
                    }}
                    className={`${isDarkMode ? 'text-green-400 hover:text-green-300 hover:bg-green-900/30' : 'text-green-600 hover:text-green-800 hover:bg-green-50'} text-xs px-1.5 py-1 rounded transition-colors`}
                    title="Layout duplizieren"
                  >
                    📋
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLayoutWithConfirmation(layout);
                    }}
                    className={`${isDarkMode ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30' : 'text-red-600 hover:text-red-800 hover:bg-red-50'} text-xs px-1.5 py-1 rounded transition-colors`}
                    title="Layout löschen"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Layout Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-6 shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto border`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                {editingLayout ? 'Layout bearbeiten' : 'Neues Layout erstellen'}
              </h2>
              <button
                onClick={handleCloseModal}
                className={`${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} text-2xl`}
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Layout-Name *</label>
                <input
                  type="text"
                  value={newLayout.name}
                  onChange={(e) => setNewLayout(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="z.B. Standard CT-Befund"
                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Beschreibung</label>
                <input
                  type="text"
                  value={newLayout.description}
                  onChange={(e) => setNewLayout(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Kurze Beschreibung des Layouts"
                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Befund-Template *</label>
                <textarea
                  value={newLayout.befundTemplate}
                  onChange={(e) => setNewLayout(prev => ({ ...prev, befundTemplate: e.target.value }))}
                  placeholder="Definieren Sie hier die Struktur des Befunds. Verwenden Sie [@] Platzhalter für Kompartimente."
                  className={`w-full h-32 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Beurteilung-Template (optional)</label>
                <textarea
                  value={newLayout.beurteilungTemplate}
                  onChange={(e) => setNewLayout(prev => ({ ...prev, beurteilungTemplate: e.target.value }))}
                  placeholder="Definieren Sie hier die Struktur der Beurteilung. Verwenden Sie [@] Platzhalter für Kompartimente."
                  className={`w-full h-24 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              <div className={`p-4 rounded-md text-sm border ${
                isDarkMode 
                  ? 'bg-blue-900/20 border-blue-700' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className={`font-semibold mb-2 ${isDarkMode ? 'text-blue-200' : 'text-blue-800'}`}>📋 [@] Platzhalter verwenden:</div>
                <div className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-700'} space-y-2`}>
                  <div><strong>Beispiele für Kompartiment-Struktur:</strong></div>
                  <div className={`font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs`}>
                    Leber: [@]<br/>
                    Herz, Gefäße: [@]<br/>
                    Lunge: [@]<br/>
                    Niere, Harnwege: [@]
                  </div>
                  <div><strong>Wichtige Regeln:</strong></div>
                  <ul className={`list-disc list-inside space-y-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    <li>Sie definieren die Kompartiment-Namen selbst</li>
                    <li>Verwenden Sie [@] als Platzhalter für den Inhalt</li>
                    <li>Die KI behält Ihre Struktur EXAKT bei</li>
                    <li>Nur die [@] werden durch Inhalt ersetzt</li>
                    <li>Bei unauffälligen Befunden: "Unauffällig."</li>
                  </ul>
                </div>
                <div className={`mt-2 text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  💡 <strong>Tipp:</strong> Sie können Kompartimente beliebig gruppieren (z.B. "Herz, Gefäße: [@]") oder einzeln auflisten.
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={handleCloseModal}
                className={`${isDarkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'} px-4 py-2 rounded-lg transition-colors`}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveLayout}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingLayout ? 'Änderungen speichern' : 'Layout speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
