import { Medication, BehavioralPattern, NotificationBehavior, DoseStatus } from '../types';

/**
 * Analyze behavioral patterns from medication history
 */
export const analyzeBehavioralPatterns = (medications: Medication[]): BehavioralPattern[] => {
  const patterns: BehavioralPattern[] = [];
  const now = new Date();
  
  medications.forEach(med => {
    if (!med.doseStatus) return;
    
    // Analyze missed doses by day of week
    const missedByDay: { [day: number]: number } = {};
    const lateByTimeWindow: { [window: string]: number } = {};
    const snoozeCount: { [time: string]: number } = {};
    
    Object.keys(med.doseStatus).forEach(dateTimeKey => {
      const [dateStr, timeStr] = dateTimeKey.split('T');
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const status = med.doseStatus![dateTimeKey];
      
      // Check if missed (no status means missed)
      if (!status) {
        missedByDay[dayOfWeek] = (missedByDay[dayOfWeek] || 0) + 1;
      }
      
      // Check if late (taken but after scheduled time)
      if (status === 'taken') {
        const scheduledTime = new Date(`${dateStr}T${timeStr}`);
        // This would need actual taken timestamp - simplified for now
        const timeWindow = getTimeWindow(timeStr);
        lateByTimeWindow[timeWindow] = (lateByTimeWindow[timeWindow] || 0) + 1;
      }
    });
    
    // Find most problematic day
    const mostMissedDay = Object.entries(missedByDay)
      .sort(([, a], [, b]) => b - a)[0];
    
    if (mostMissedDay && mostMissedDay[1] >= 3) {
      patterns.push({
        medicationId: med.id,
        patternType: 'missed_day',
        dayOfWeek: parseInt(mostMissedDay[0]),
        frequency: mostMissedDay[1],
        suggestion: `You often miss doses on ${getDayName(parseInt(mostMissedDay[0]))}. Consider setting an extra reminder for that day.`,
      });
    }
    
    // Find most problematic time window
    const mostLateWindow = Object.entries(lateByTimeWindow)
      .sort(([, a], [, b]) => b - a)[0];
    
    if (mostLateWindow && mostLateWindow[1] >= 3) {
      patterns.push({
        medicationId: med.id,
        patternType: 'late_time',
        timeWindow: mostLateWindow[0],
        frequency: mostLateWindow[1],
        suggestion: `Your ${mostLateWindow[0]} doses are frequently late. Consider moving the reminder 15-30 minutes earlier.`,
      });
    }
  });
  
  return patterns;
};

/**
 * Get time window from time string
 */
const getTimeWindow = (time: string): string => {
  const hour = parseInt(time.split(':')[0]);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'bedtime';
};

/**
 * Get day name from day number
 */
const getDayName = (day: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day];
};

/**
 * Calculate adaptive reminder time based on behavior
 */
export const calculateAdaptiveReminderTime = (
  scheduledTime: string,
  behavior: NotificationBehavior
): string => {
  if (!behavior.averageResponseTime || behavior.averageResponseTime <= 0) {
    return scheduledTime;
  }
  
  // If user consistently takes medication late, adjust reminder earlier
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Adjust by average response time (subtract to remind earlier)
  const adjustedMinutes = totalMinutes - Math.min(behavior.averageResponseTime, 30); // Max 30 min earlier
  const adjustedHours = Math.floor(adjustedMinutes / 60);
  const adjustedMins = adjustedMinutes % 60;
  
  return `${adjustedHours.toString().padStart(2, '0')}:${adjustedMins.toString().padStart(2, '0')}`;
};

/**
 * Update notification behavior based on actual dose time
 */
export const updateNotificationBehavior = (
  medicationId: string,
  scheduledTime: string,
  actualTime: string | null,
  behaviors: NotificationBehavior[]
): NotificationBehavior[] => {
  const behavior = behaviors.find(b => b.medicationId === medicationId) || {
    medicationId,
    snoozeCount: 0,
    lateDoseCount: 0,
    adjustedTimes: [],
  };
  
  if (actualTime) {
    const scheduled = new Date(`2000-01-01T${scheduledTime}`);
    const actual = new Date(`2000-01-01T${actualTime}`);
    const diffMinutes = (actual.getTime() - scheduled.getTime()) / (1000 * 60);
    
    if (diffMinutes > 0) {
      // Late dose
      behavior.lateDoseCount++;
      if (!behavior.averageResponseTime) {
        behavior.averageResponseTime = diffMinutes;
      } else {
        // Moving average
        behavior.averageResponseTime = (behavior.averageResponseTime * 0.7) + (diffMinutes * 0.3);
      }
    }
  }
  
  // Update adjusted time
  const adjustedTime = calculateAdaptiveReminderTime(scheduledTime, behavior);
  if (!behavior.adjustedTimes.includes(adjustedTime)) {
    behavior.adjustedTimes.push(adjustedTime);
  }
  
  const updated = behaviors.filter(b => b.medicationId !== medicationId);
  updated.push(behavior);
  
  return updated;
};

