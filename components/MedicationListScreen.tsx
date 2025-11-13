import React, { useState } from 'react';
import { Medication } from '../types';
import { PencilIcon, TrashIcon, PillIcon, InformationCircleIcon } from './icons';
import MedicationInfoModal from './MedicationInfoModal';

interface MedicationListScreenProps {
  medications: Medication[];
  onEdit: (med: Medication) => void;
  onDeleteRequest: (med: Medication) => void;
}

const MedicationListScreen: React.FC<MedicationListScreenProps> = ({ medications, onEdit, onDeleteRequest }) => {
  const [infoModalMed, setInfoModalMed] = useState<Medication | null>(null);

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">My Medications</h2>
        {medications.length > 0 ? (
          <ul className="space-y-4">
            {medications.map(med => (
              <li key={med.id} className="bg-white p-4 rounded-xl shadow-lg flex items-center justify-between transition-shadow hover:shadow-xl">
                <div className="flex items-center space-x-4">
                  {med.image ? (
                     <img src={med.image} alt={med.name} className="w-14 h-14 object-cover rounded-full bg-gray-200 shadow-inner" />
                  ) : (
                    <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-200">
                      <PillIcon className="w-7 h-7 text-indigo-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{med.name}</p>
                    <p className="text-sm text-gray-500">{med.dosage} - {med.drugClass || med.frequency}</p>
                    <p className="text-xs text-gray-400">{med.food}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                   {(med.sideEffects || med.usageNote || med.similarMeds) && (
                      <button
                        onClick={() => setInfoModalMed(med)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                        aria-label={`More information for ${med.name}`}
                      >
                        <InformationCircleIcon className="h-6 w-6" />
                      </button>
                   )}
                  <button
                    onClick={() => onEdit(med)}
                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                    aria-label={`Edit ${med.name}`}
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => onDeleteRequest(med)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    aria-label={`Delete ${med.name}`}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-10 px-4 bg-white rounded-xl shadow-lg">
            <PillIcon className="mx-auto h-12 w-12 text-gray-300"/>
            <p className="text-gray-600 font-medium mt-4">You haven't added any medications yet.</p>
            <p className="text-gray-500 text-sm mt-1">Tap the '+' button to get started.</p>
          </div>
        )}
      </div>

      <MedicationInfoModal
        medication={infoModalMed}
        onClose={() => setInfoModalMed(null)}
      />
    </>
  );
};

export default MedicationListScreen;