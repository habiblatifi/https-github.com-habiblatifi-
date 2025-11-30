import { Medication, PRNConfig } from '../types';

/**
 * Check if a PRN medication can be taken
 */
export const canTakePRN = (
  medication: Medication,
  prnConfig: PRNConfig,
  currentTime: Date = new Date()
): { canTake: boolean; reason?: string; nextAvailableTime?: Date } => {
  // Check if it's a new day (reset counter)
  const today = currentTime.toISOString().split('T')[0];
  if (prnConfig.resetDate !== today) {
    return { canTake: true }; // New day, counter reset
  }

  // Check daily limit
  if (prnConfig.takenToday >= prnConfig.maxPerDay) {
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return {
      canTake: false,
      reason: `Daily limit reached (${prnConfig.maxPerDay} per day). Next dose available tomorrow.`,
      nextAvailableTime: tomorrow,
    };
  }

  // Check minimum interval
  if (prnConfig.lastTakenTime) {
    const lastTaken = new Date(prnConfig.lastTakenTime);
    const timeSinceLastDose = (currentTime.getTime() - lastTaken.getTime()) / (1000 * 60 * 60); // hours

    if (timeSinceLastDose < prnConfig.minIntervalHours) {
      const nextAvailable = new Date(lastTaken);
      nextAvailable.setHours(nextAvailable.getHours() + prnConfig.minIntervalHours);
      return {
        canTake: false,
        reason: `Minimum interval not met. Wait ${Math.ceil(prnConfig.minIntervalHours - timeSinceLastDose)} more hour(s).`,
        nextAvailableTime: nextAvailable,
      };
    }
  }

  return { canTake: true };
};

/**
 * Record a PRN dose taken
 */
export const recordPRNDose = (
  prnConfig: PRNConfig,
  currentTime: Date = new Date()
): PRNConfig => {
  const today = currentTime.toISOString().split('T')[0];

  // Reset if new day
  if (prnConfig.resetDate !== today) {
    return {
      ...prnConfig,
      takenToday: 1,
      lastTakenTime: currentTime.toISOString(),
      resetDate: today,
    };
  }

  return {
    ...prnConfig,
    takenToday: prnConfig.takenToday + 1,
    lastTakenTime: currentTime.toISOString(),
  };
};

/**
 * Get default PRN config based on medication
 */
export const getDefaultPRNConfig = (medication: Medication): PRNConfig => {
  // Default: 4 hours minimum interval, 4 max per day
  // These should be customized per medication
  return {
    medicationId: medication.id,
    minIntervalHours: 4,
    maxPerDay: 4,
    takenToday: 0,
    resetDate: new Date().toISOString().split('T')[0],
  };
};

/**
 * Check if medication is PRN (as-needed)
 */
export const isPRNMedication = (medication: Medication): boolean => {
  const frequency = medication.frequency?.toLowerCase() || '';
  return frequency.includes('as needed') ||
         frequency.includes('prn') ||
         frequency.includes('when needed') ||
         frequency.includes('as required');
};

