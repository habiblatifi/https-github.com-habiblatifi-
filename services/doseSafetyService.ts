import { Medication, DoseStatus } from '../types';

export interface DoseSafetyCheck {
  isSafe: boolean;
  warnings: string[];
  errors: string[];
  canProceed: boolean;
}

/**
 * Check if a dose is safe to take based on spacing and daily limits
 */
export const checkDoseSafety = (
  medication: Medication,
  date: string,
  time: string,
  doseStatus: DoseStatus,
  allMedications: Medication[]
): DoseSafetyCheck => {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isSafe = true;
  let canProceed = true;

  const dateTimeKey = `${date}T${time}`;
  const scheduledDateTime = new Date(`${date}T${time}`);

  // Check 1: Is this dose already taken?
  if (medication.doseStatus?.[dateTimeKey] === 'taken') {
    errors.push('This dose has already been marked as taken.');
    canProceed = false;
    isSafe = false;
    return { isSafe, warnings, errors, canProceed };
  }

  // Check 2: Check spacing between doses of the same medication
  const sameMedDoses = Object.entries(medication.doseStatus || {})
    .filter(([key, status]) => status === 'taken')
    .map(([key]) => {
      const [d, t] = key.split('T');
      return new Date(`${d}T${t}`);
    })
    .sort((a, b) => b.getTime() - a.getTime()); // Most recent first

  if (sameMedDoses.length > 0) {
    const lastDoseTime = sameMedDoses[0];
    const hoursSinceLastDose = (scheduledDateTime.getTime() - lastDoseTime.getTime()) / (1000 * 60 * 60);

    // Minimum spacing check (default: 2 hours, can be customized)
    const minSpacingHours = 2;
    if (hoursSinceLastDose < minSpacingHours && hoursSinceLastDose > 0) {
      warnings.push(
        `This dose is only ${Math.round(hoursSinceLastDose * 10) / 10} hours after your last dose. ` +
        `Minimum recommended spacing is ${minSpacingHours} hours.`
      );
    }

    // Check if taking too early (negative hours = future dose)
    if (hoursSinceLastDose < 0) {
      const hoursEarly = Math.abs(hoursSinceLastDose);
      if (hoursEarly < 1) {
        warnings.push(
          `You're marking this dose ${Math.round(hoursEarly * 60)} minutes early. ` +
          `Make sure you're taking it at the correct time.`
        );
      }
    }
  }

  // Check 3: Count doses taken today
  const today = date;
  const dosesTakenToday = Object.entries(medication.doseStatus || {})
    .filter(([key, status]) => {
      const [d] = key.split('T');
      return d === today && status === 'taken';
    }).length;

  // Check 4: Maximum daily dose limit
  const maxDailyDoses = medication.times?.length || 0;
  if (dosesTakenToday >= maxDailyDoses && doseStatus === 'taken') {
    errors.push(
      `You've already taken ${dosesTakenToday} dose(s) of ${medication.name} today. ` +
      `The scheduled maximum is ${maxDailyDoses} dose(s).`
    );
    canProceed = false;
    isSafe = false;
  }

  // Check 5: Food timing constraints
  if (medication.food === 'Without food') {
    const currentHour = scheduledDateTime.getHours();
    // Typical meal times: 7-9 (breakfast), 12-14 (lunch), 18-20 (dinner)
    if ((currentHour >= 7 && currentHour <= 9) || 
        (currentHour >= 12 && currentHour <= 14) || 
        (currentHour >= 18 && currentHour <= 20)) {
      warnings.push(
        `This medication should be taken on an empty stomach. ` +
        `It's currently a typical meal time - make sure you haven't eaten recently.`
      );
    }
  }

  // Check 6: Interaction warnings (basic check)
  // This would integrate with the existing interaction checking system

  if (errors.length > 0) {
    isSafe = false;
  }

  return { isSafe, warnings, errors, canProceed };
};

/**
 * Get recommended spacing for a medication
 */
export const getRecommendedSpacing = (medication: Medication): number => {
  // Default spacing based on frequency
  const frequency = medication.frequency?.toLowerCase() || '';
  
  if (frequency.includes('every 4 hours') || frequency.includes('q4h')) return 4;
  if (frequency.includes('every 6 hours') || frequency.includes('q6h')) return 6;
  if (frequency.includes('every 8 hours') || frequency.includes('q8h')) return 8;
  if (frequency.includes('every 12 hours') || frequency.includes('q12h')) return 12;
  if (frequency.includes('twice daily') || frequency.includes('bid')) {
    return 12; // Twice daily = ~12 hours apart
  }
  if (frequency.includes('three times') || frequency.includes('tid')) {
    return 8; // Three times daily = ~8 hours apart
  }
  if (frequency.includes('four times') || frequency.includes('qid')) {
    return 6; // Four times daily = ~6 hours apart
  }
  
  // Default: 2 hours minimum
  return 2;
};

