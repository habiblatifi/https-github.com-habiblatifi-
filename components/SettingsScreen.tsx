import React, { useState } from 'react';
import { DownloadIcon } from './icons';

interface SettingsScreenProps {
  onExportData: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onExportData }) => {
  const [reminderSound, setReminderSound] = useState('Default');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Settings</h2>

      <div className="bg-white p-4 rounded-xl shadow-lg">
        <h3 className="font-bold text-lg text-gray-700 border-b pb-2 mb-4">Notification Settings</h3>
        <div>
            <label htmlFor="reminderSound" className="block text-sm font-medium text-gray-700">Reminder Sound</label>
            <select 
              name="reminderSound" 
              id="reminderSound" 
              value={reminderSound}
              onChange={(e) => setReminderSound(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
                <option>Default</option>
                <option>Chime</option>
                <option>Alert</option>
                <option>Bell</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Custom sounds for notifications have limited support across devices and browsers.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-lg">
        <h3 className="font-bold text-lg text-gray-700 border-b pb-2 mb-4">Data Management</h3>
        <button
            onClick={onExportData}
            className="flex items-center justify-center gap-2 w-full bg-gray-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-700 transition-colors shadow-md"
        >
            <DownloadIcon className="w-5 h-5"/>
            Export Medication Data (CSV)
        </button>
        <p className="text-xs text-gray-500 mt-2">Exports your medication list and dose history into downloadable CSV files.</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-lg">
        <h3 className="font-bold text-lg text-gray-700 border-b pb-2 mb-4">About PillPal</h3>
        <div className="space-y-2 text-gray-600">
          <p>
            PillPal is your personal medication management assistant, designed to help you stay on track with your health regimen.
          </p>
          <p>
            Easily add medications, set reminders, check for potential drug interactions, and track your adherence over time. Our goal is to make managing your health simpler and safer.
          </p>
          <p className="font-semibold pt-2">Version: 1.3.0</p>
        </div>
      </div>
      
       <div className="bg-white p-4 rounded-xl shadow-lg">
        <h3 className="font-bold text-lg text-gray-700 border-b pb-2 mb-4">Disclaimer</h3>
        <p className="text-sm text-gray-600">
            PillPal is an informational tool and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with your doctor or pharmacist regarding your medications and health conditions. The drug interaction checker uses AI and may not be exhaustive or entirely accurate.
        </p>
      </div>

    </div>
  );
};

export default SettingsScreen;