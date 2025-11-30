import { Medication, SymptomEntry, UserPreferences, EmergencyInfo, AppSecurity } from '../types';

export interface BackupData {
  version: string;
  exported: string;
  medications: Medication[];
  symptomEntries: SymptomEntry[];
  userPreferences: UserPreferences;
  emergencyInfo: EmergencyInfo;
  appSecurity: AppSecurity;
}

/**
 * Export all app data to JSON
 */
export const exportAllData = (): BackupData => {
  const medications = JSON.parse(localStorage.getItem('medications') || '[]');
  const symptomEntries = JSON.parse(localStorage.getItem('symptomEntries') || '[]');
  const userPreferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
  const emergencyInfo = JSON.parse(localStorage.getItem('emergencyInfo') || '{}');
  const appSecurity = JSON.parse(localStorage.getItem('appSecurity') || '{}');

  return {
    version: '1.0',
    exported: new Date().toISOString(),
    medications,
    symptomEntries,
    userPreferences,
    emergencyInfo,
    appSecurity,
  };
};

/**
 * Import data from backup
 */
export const importAllData = (backupData: BackupData): { success: boolean; errors: string[] } => {
  const errors: string[] = [];

  try {
    if (backupData.medications) {
      localStorage.setItem('medications', JSON.stringify(backupData.medications));
    } else {
      errors.push('No medications data found in backup');
    }

    if (backupData.symptomEntries) {
      localStorage.setItem('symptomEntries', JSON.stringify(backupData.symptomEntries));
    }

    if (backupData.userPreferences) {
      localStorage.setItem('userPreferences', JSON.stringify(backupData.userPreferences));
    }

    if (backupData.emergencyInfo) {
      localStorage.setItem('emergencyInfo', JSON.stringify(backupData.emergencyInfo));
    }

    if (backupData.appSecurity) {
      localStorage.setItem('appSecurity', JSON.stringify(backupData.appSecurity));
    }

    return { success: errors.length === 0, errors };
  } catch (error: any) {
    errors.push(`Import failed: ${error.message}`);
    return { success: false, errors };
  }
};

/**
 * Download backup as file
 */
export const downloadBackup = (): void => {
  const backup = exportAllData();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pillpal-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Email backup (opens mailto link)
 */
export const emailBackup = (): void => {
  const backup = exportAllData();
  const backupString = JSON.stringify(backup, null, 2);
  const subject = encodeURIComponent('PillPal Backup');
  const body = encodeURIComponent(`PillPal Medication Tracker Backup\n\nExported: ${backup.exported}\n\nPlease find the backup data attached or in the email body.\n\n${backupString}`);
  
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

/**
 * Restore from file
 */
export const restoreFromFile = (file: File): Promise<{ success: boolean; errors: string[] }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target?.result as string) as BackupData;
        const result = importAllData(backupData);
        resolve(result);
      } catch (error: any) {
        resolve({ success: false, errors: [`Failed to parse backup file: ${error.message}`] });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, errors: ['Failed to read backup file'] });
    };

    reader.readAsText(file);
  });
};

/**
 * Clear all data
 */
export const clearAllData = (): void => {
  localStorage.removeItem('medications');
  localStorage.removeItem('symptomEntries');
  localStorage.removeItem('userPreferences');
  localStorage.removeItem('emergencyInfo');
  localStorage.removeItem('appSecurity');
  localStorage.removeItem('medicationEducations');
  localStorage.removeItem('lastSyncTime');
  
  // Clear all notification behavior data
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('notificationBehavior_')) {
      localStorage.removeItem(key);
    }
  });
};

