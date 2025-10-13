import React, { useState, useEffect } from 'react';

interface EditTerminalNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  currentName: string;
  terminalId: string;
}

const EditTerminalNameModal: React.FC<EditTerminalNameModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentName,
  terminalId
}) => {
  const [name, setName] = useState(currentName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(currentName);
  }, [currentName, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(name.trim());
      onClose();
    } catch (error) {
      console.error('Error saving terminal name:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">✏️ Editar Nombre de Terminal</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isSaving}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-2">
            ID de Terminal: <span className="text-green-400 font-mono">{terminalId}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-300">
              Nombre Personalizado
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Terminal Caja Principal"
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-3 focus:ring-amber-500 focus:border-amber-500"
              maxLength={50}
              autoFocus
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500 mt-1">
              {name.length}/50 caracteres
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-6 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 text-gray-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTerminalNameModal;
