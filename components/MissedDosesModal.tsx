import React, { useState } from 'react';
import { Medication } from '../types';
import { XIcon, AlertTriangleIcon } from './icons';

interface MissedDosesModalProps {
  missedDoses: { med: Medication; date: string; time: string }[];
  onClose: () => void;
  onSaveReasons: (reasons: { [medId: string]: { [dateTimeKey: string]: string } }) => void;
}

const MissedDosesModal: React.FC<MissedDosesModalProps> = ({ missedDoses, onClose, onSaveReasons }) => {
  const [reasons, setReasons] = useState<{ [key: string]: string }>({});

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleSave();
    }
  };

  const handleReasonChange = (medId: string, date: string, time: string, reason: string) => {
    const key = `${medId}-${date}-${time}`;
    setReasons(prev => ({ ...prev, [key]: reason }));
  };

  const handleSave = () => {
    const reasonsToSave: { [medId: string]: { [dateTimeKey: string]: string } } = {};
    
    // Fix: Explicitly type `reason` as `string` to resolve inference issue.
    Object.entries(reasons).forEach(([key, reason]: [string, string]) => {
        if (reason.trim() === '') return; // Don't save empty reasons
        
        const keyParts = key.split('-');
        const medId = keyParts[0];
        const date = keyParts[1];
        const time = keyParts[2];
        const dateTimeKey = `${date}T${time}`;

        if (!reasonsToSave[medId]) {
            reasonsToSave[medId] = {};
        }
        reasonsToSave[medId][dateTimeKey] = reason;
    });

    if (Object.keys(reasonsToSave).length > 0) {
        onSaveReasons(reasonsToSave);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <header className="p-5 border-b shrink-0 flex justify-between items-center bg-yellow-50">
          <div className="flex items-center space-x-3">
            <AlertTriangleIcon className="h-6 w-6 text-yellow-600" />
            <h2 className="text-xl font-bold text-yellow-800">Missed Doses</h2>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="Close modal"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-gray-700">
            It looks like you may have missed the following medication doses. You can optionally add a reason below for your records.
          </p>
          <div className="space-y-4">
            {missedDoses.map(({ med, date, time }, index) => {
              const key = `${med.id}-${date}-${time}`;
              return (
                <div key={index} className="p-3 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                  <p className="font-semibold text-red-800">{med.name} <span className="font-normal text-sm">{med.dosage}</span></p>
                  <p className="text-sm text-red-700 mb-2">
                    Scheduled for: {new Date(`${date}T${time}`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {time}
                  </p>
                  <input
                    type="text"
                    value={reasons[key] || ''}
                    onChange={(e) => handleReasonChange(med.id, date, time, e.target.value)}
                    placeholder="Reason (optional, e.g., forgot)"
                    className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    aria-label={`Reason for missing ${med.name}`}
                  />
                </div>
              );
            })}
          </div>
        </main>
        
        <footer className="p-4 bg-gray-50 border-t flex justify-end shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 brand-gradient text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md"
          >
            Save & Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default MissedDosesModal;