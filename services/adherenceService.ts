import { Medication, AdherenceStreak, Milestone, Badge, DoseStatus } from '../types';

/**
 * Calculate adherence streak based on medication history
 */
export const calculateAdherenceStreak = (medications: Medication[]): AdherenceStreak => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let currentStreak = 0;
  let longestStreak = 0;
  let lastStreakDate = '';
  let totalDosesTaken = 0;
  const milestones: Milestone[] = [];
  
  // Get all dose dates
  const doseDates = new Set<string>();
  const takenDates = new Set<string>();
  
  medications.forEach(med => {
    if (med.doseStatus) {
      Object.keys(med.doseStatus).forEach(dateTimeKey => {
        const [date] = dateTimeKey.split('T');
        doseDates.add(date);
        if (med.doseStatus![dateTimeKey] === 'taken') {
          takenDates.add(date);
          totalDosesTaken++;
        }
      });
    }
  });
  
  // Calculate current streak (consecutive days with at least one dose taken)
  let checkDate = new Date(today);
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (takenDates.has(dateStr)) {
      currentStreak++;
      lastStreakDate = dateStr;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  // Calculate longest streak
  const sortedDates = Array.from(takenDates).sort().reverse();
  let tempStreak = 0;
  let maxStreak = 0;
  let prevDate: Date | null = null;
  
  sortedDates.forEach(dateStr => {
    const date = new Date(dateStr);
    if (prevDate) {
      const daysDiff = Math.floor((prevDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        maxStreak = Math.max(maxStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    prevDate = date;
  });
  longestStreak = Math.max(maxStreak, tempStreak, currentStreak);
  
  // Define milestones
  const milestoneTargets = [
    { type: 'days' as const, target: 7, id: 'week1' },
    { type: 'days' as const, target: 30, id: 'month1' },
    { type: 'days' as const, target: 100, id: 'century' },
    { type: 'doses' as const, target: 50, id: 'doses50' },
    { type: 'doses' as const, target: 100, id: 'doses100' },
    { type: 'doses' as const, target: 500, id: 'doses500' },
  ];
  
  milestoneTargets.forEach(({ type, target, id }) => {
    const achieved = type === 'days' 
      ? longestStreak >= target
      : totalDosesTaken >= target;
    
    milestones.push({
      id,
      type,
      target,
      achieved,
      achievedDate: achieved ? new Date().toISOString() : undefined,
    });
  });
  
  return {
    currentStreak,
    longestStreak,
    lastStreakDate: lastStreakDate || today.toISOString().split('T')[0],
    totalDosesTaken,
    milestones,
  };
};

/**
 * Get badges earned based on adherence
 */
export const getEarnedBadges = (streak: AdherenceStreak): Badge[] => {
  const badges: Badge[] = [];
  const today = new Date().toISOString().split('T')[0];
  
  // Streak badges
  if (streak.currentStreak >= 7) {
    badges.push({
      id: 'streak_week',
      name: 'Week Warrior',
      description: '7 days in a row!',
      icon: '🔥',
      earnedDate: today,
      category: 'streak',
    });
  }
  
  if (streak.currentStreak >= 30) {
    badges.push({
      id: 'streak_month',
      name: 'Monthly Master',
      description: '30 days in a row!',
      icon: '⭐',
      earnedDate: today,
      category: 'streak',
    });
  }
  
  if (streak.longestStreak >= 100) {
    badges.push({
      id: 'streak_century',
      name: 'Century Champion',
      description: '100 days streak achieved!',
      icon: '🏆',
      earnedDate: today,
      category: 'milestone',
    });
  }
  
  // Dose count badges
  if (streak.totalDosesTaken >= 50) {
    badges.push({
      id: 'doses_50',
      name: 'Half Century',
      description: '50 doses taken!',
      icon: '💊',
      earnedDate: today,
      category: 'adherence',
    });
  }
  
  if (streak.totalDosesTaken >= 100) {
    badges.push({
      id: 'doses_100',
      name: 'Centurion',
      description: '100 doses taken!',
      icon: '🎖️',
      earnedDate: today,
      category: 'adherence',
    });
  }
  
  if (streak.totalDosesTaken >= 500) {
    badges.push({
      id: 'doses_500',
      name: 'Master Adherer',
      description: '500 doses taken!',
      icon: '👑',
      earnedDate: today,
      category: 'milestone',
    });
  }
  
  return badges;
};

/**
 * Get motivational message based on streak and adherence
 */
export const getMotivationalMessage = (streak: AdherenceStreak): string => {
  const messages: string[] = [];
  
  if (streak.currentStreak >= 7) {
    messages.push("Nice work staying consistent this week 👏");
  }
  
  if (streak.currentStreak >= 30) {
    messages.push("Amazing! You've maintained your streak for a full month! 🌟");
  }
  
  if (streak.currentStreak === 0) {
    messages.push("It's okay to have an off day. Let's try again tomorrow 💪");
  } else if (streak.currentStreak < 7) {
    messages.push(`You're on a ${streak.currentStreak}-day streak! Keep it up! 🔥`);
  }
  
  if (streak.totalDosesTaken >= 100) {
    messages.push(`You've taken ${streak.totalDosesTaken} doses! That's dedication! 🎉`);
  }
  
  return messages[Math.floor(Math.random() * messages.length)] || "Keep up the great work! 💊";
};

