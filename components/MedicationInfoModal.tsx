import React from 'react';
import { Medication } from '../types';
import { XIcon } from './icons';

interface MedicationInfoModalProps {
  medication: Medication | null;
  onClose: () => void;
}

const MedicationInfoModal: React.FC<MedicationInfoModalProps> = ({ medication, onClose }) => {
  if (!medication) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <header className="p-5 border-b shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{medication.name}</h2>
            <p className="text-sm text-gray-500">{medication.dosage}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {medication.usageNote && (
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-2">Usage Note</h3>
              <p className="text-sm text-indigo-800 bg-indigo-50 p-3 rounded-lg">{medication.usageNote}</p>
            </div>
          )}

          {medication.sideEffects && (
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-2">Common Side Effects</h3>
              <p className="text-sm text-yellow-800 bg-yellow-50 p-3 rounded-lg">{medication.sideEffects}</p>
            </div>
          )}

          {medication.similarMeds && medication.similarMeds.length > 0 && (
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-2">Similar Medications</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {medication.similarMeds.map((med, index) => (
                  <li key={index}>{med}</li>
                ))}
              </ul>
            </div>
          )}
        </main>
        
        <footer className="p-4 bg-gray-50 border-t flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default MedicationInfoModal;