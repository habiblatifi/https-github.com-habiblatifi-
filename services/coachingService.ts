import { Medication, WeeklyCoachingSummary, DoseStatus } from '../types';

/**
 * Generate weekly coaching summary
 */
export const generateWeeklyCoachingSummary = (
  medications: Medication[],
  weekStart: Date
): WeeklyCoachingSummary => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  let totalDoses = 0;
  let takenDoses = 0;
  let missedDoses = 0;
  const timeWindowStats: { [window: string]: { taken: number; total: number } } = {};

  medications.forEach(med => {
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      med.times.forEach(time => {
        totalDoses++;
        const dateTimeKey = `${dateStr}T${time}`;
        const status = med.doseStatus?.[dateTimeKey];

        const timeWindow = getTimeWindow(time);
        if (!timeWindowStats[timeWindow]) {
          timeWindowStats[timeWindow] = { taken: 0, total: 0 };
        }
        timeWindowStats[timeWindow].total++;

        if (status === 'taken') {
          takenDoses++;
          timeWindowStats[timeWindow].taken++;
        } else if (!status) {
          missedDoses++;
        }
      });
    }
  });

  const adherencePercentage = totalDoses > 0 
    ? Math.round((takenDoses / totalDoses) * 100)
    : 0;

  // Find best and worst time windows
  let bestWindow = '';
  let bestPercentage = 0;
  let worstWindow = '';
  let worstPercentage = 100;

  Object.entries(timeWindowStats).forEach(([window, stats]) => {
    const percentage = stats.total > 0 ? (stats.taken / stats.total) * 100 : 0;
    if (percentage > bestPercentage) {
      bestPercentage = percentage;
      bestWindow = window;
    }
    if (percentage < worstPercentage) {
      worstPercentage = percentage;
      worstWindow = window;
    }
  });

  // Generate suggestions
  const suggestions: string[] = [];
  const achievements: string[] = [];

  if (adherencePercentage >= 90) {
    achievements.push('Excellent adherence this week! 🌟');
  } else if (adherencePercentage >= 75) {
    achievements.push('Good adherence this week! 👍');
  } else {
    suggestions.push('Try to improve your consistency this week.');
  }

  if (worstWindow && worstPercentage < 80) {
    suggestions.push(
      `Consider moving your ${worstWindow} medication reminder 15-30 minutes earlier for better consistency.`
    );
  }

  if (takenDoses >= 50) {
    achievements.push(`You've taken ${takenDoses} doses this week! 💊`);
  }

  if (adherencePercentage >= 95) {
    achievements.push('Nearly perfect adherence! Keep it up! 🎯');
  }

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    adherencePercentage,
    totalDoses,
    takenDoses,
    missedDoses,
    bestTimeWindow: bestWindow || 'N/A',
    worstTimeWindow: worstWindow || 'N/A',
    suggestions: suggestions.length > 0 ? suggestions : ['Keep up the great work!'],
    achievements: achievements.length > 0 ? achievements : [],
  };
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
 * Get current week start (Monday)
 */
export const getCurrentWeekStart = (): Date => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

