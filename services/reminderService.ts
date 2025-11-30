import { Medication, NotificationBehavior, DoseStatus } from '../types';

export interface ReminderStage {
  stage: number; // 0 = first, 1 = follow-up, 2 = check-in
  scheduledTime: string; // HH:mm
  reminderTime: string; // ISO timestamp
  snoozeOptions: number[]; // minutes [5, 10, 15]
}

/**
 * Calculate reminder stages for a medication dose
 */
export const calculateReminderStages = (
  medication: Medication,
  scheduledTime: string,
  date: string,
  behavior?: NotificationBehavior
): ReminderStage[] => {
  const stages: ReminderStage[] = [];
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const scheduledDateTime = new Date(`${date}T${scheduledTime}`);
  
  // Stage 0: First reminder (at scheduled time)
  stages.push({
    stage: 0,
    scheduledTime,
    reminderTime: scheduledDateTime.toISOString(),
    snoozeOptions: [5, 10, 15],
  });

  // Stage 1: Follow-up reminder (15 minutes after if not taken)
  const followUpTime = new Date(scheduledDateTime);
  followUpTime.setMinutes(followUpTime.getMinutes() + 15);
  stages.push({
    stage: 1,
    scheduledTime,
    reminderTime: followUpTime.toISOString(),
    snoozeOptions: [5, 10, 15],
  });

  // Stage 2: Check-in reminder (30 minutes after if still not taken)
  const checkInTime = new Date(scheduledDateTime);
  checkInTime.setMinutes(checkInTime.getMinutes() + 30);
  stages.push({
    stage: 2,
    scheduledTime,
    reminderTime: checkInTime.toISOString(),
    snoozeOptions: [5, 10, 15],
  });

  return stages;
};

/**
 * Check if a reminder should be sent based on dose status
 */
export const shouldSendReminder = (
  medication: Medication,
  date: string,
  time: string,
  reminderStage: number
): boolean => {
  const dateTimeKey = `${date}T${time}`;
  const status = medication.doseStatus?.[dateTimeKey];
  
  // Don't send if already taken or skipped
  if (status === 'taken' || status === 'skipped') {
    return false;
  }

  // Check if reminder stage matches
  const behavior = medication as any; // Assuming behavior is stored
  const currentStage = behavior.reminderStage || 0;
  
  return reminderStage >= currentStage;
};

/**
 * Get snooze time options
 */
export const getSnoozeOptions = (): { label: string; minutes: number }[] => {
  return [
    { label: '5 min', minutes: 5 },
    { label: '10 min', minutes: 10 },
    { label: '15 min', minutes: 15 },
  ];
};

/**
 * Calculate next reminder time after snooze
 */
export const calculateSnoozeTime = (snoozeMinutes: number): Date => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + snoozeMinutes);
  return now;
};

/**
 * Update reminder stage after snooze
 */
export const updateReminderStage = (
  behavior: NotificationBehavior,
  newStage: number
): NotificationBehavior => {
  return {
    ...behavior,
    reminderStage: newStage,
    lastReminderTime: new Date().toISOString(),
    snoozeCount: behavior.snoozeCount + 1,
  };
};

/**
 * Reset reminder stage after dose is taken
 */
export const resetReminderStage = (
  behavior: NotificationBehavior
): NotificationBehavior => {
  return {
    ...behavior,
    reminderStage: 0,
    lastReminderTime: undefined,
  };
};

