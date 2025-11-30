import { Medication, DoseStatus } from '../types';

export interface RecoveryGuidance {
  medicationId: string;
  medicationName: string;
  missedDate: string;
  missedTime: string;
  guidance: string;
  action: 'take_now' | 'skip' | 'consult' | 'take_next';
  severity: 'low' | 'medium' | 'high';
}

/**
 * Generate recovery guidance for missed doses
 */
export const getMissedDoseRecovery = (
  medication: Medication,
  missedDate: string,
  missedTime: string
): RecoveryGuidance | null => {
  const now = new Date();
  const missedDateTime = new Date(`${missedDate}T${missedTime}`);
  const hoursSinceMissed = (now.getTime() - missedDateTime.getTime()) / (1000 * 60 * 60);

  // Get medication frequency
  const frequency = medication.frequency?.toLowerCase() || '';
  const isPRN = frequency.includes('as needed') || frequency.includes('prn');
  const isDaily = frequency.includes('daily') || frequency.includes('once');
  const isTwiceDaily = frequency.includes('twice') || frequency.includes('bid');
  const isMultipleDaily = frequency.includes('three') || frequency.includes('four') || frequency.includes('qid');

  // Check if next dose is soon
  const nextDoseTime = medication.times.find(t => {
    const nextDateTime = new Date(`${missedDate}T${t}`);
    return nextDateTime > missedDateTime;
  });

  let guidance: RecoveryGuidance | null = null;

  // Less than 2 hours late - can still take
  if (hoursSinceMissed < 2 && !isMultipleDaily) {
    guidance = {
      medicationId: medication.id,
      medicationName: medication.name,
      missedDate,
      missedTime,
      guidance: `You're less than 2 hours late. You can still take this dose now.`,
      action: 'take_now',
      severity: 'low',
    };
  }
  // 2-4 hours late
  else if (hoursSinceMissed >= 2 && hoursSinceMissed < 4) {
    if (isDaily || isTwiceDaily) {
      guidance = {
        medicationId: medication.id,
        medicationName: medication.name,
        missedDate,
        missedTime,
        guidance: `You're ${Math.round(hoursSinceMissed)} hours late. If your next dose is more than 4 hours away, you can take it now. Otherwise, skip this dose and take the next one on time.`,
        action: nextDoseTime && new Date(`${missedDate}T${nextDoseTime}`).getTime() - now.getTime() > 4 * 60 * 60 * 1000
          ? 'take_now'
          : 'skip',
        severity: 'medium',
      };
    } else {
      guidance = {
        medicationId: medication.id,
        medicationName: medication.name,
        missedDate,
        missedTime,
        guidance: `You're ${Math.round(hoursSinceMissed)} hours late. For medications taken multiple times daily, skip this dose and continue with your next scheduled dose.`,
        action: 'skip',
        severity: 'medium',
      };
    }
  }
  // More than 4 hours late
  else if (hoursSinceMissed >= 4) {
    if (isDaily) {
      guidance = {
        medicationId: medication.id,
        medicationName: medication.name,
        missedDate,
        missedTime,
        guidance: `You're more than 4 hours late. Skip this dose and take your next scheduled dose on time. Do NOT double up.`,
        action: 'skip',
        severity: 'high',
      };
    } else {
      guidance = {
        medicationId: medication.id,
        medicationName: medication.name,
        missedDate,
        missedTime,
        guidance: `You're more than 4 hours late. Skip this dose and continue with your regular schedule. If you're unsure, consult your pharmacist or doctor.`,
        action: 'consult',
        severity: 'high',
      };
    }
  }

  // Special handling for critical medications
  const criticalMeds = ['warfarin', 'insulin', 'digoxin', 'lithium', 'phenytoin'];
  if (criticalMeds.some(critical => medication.name.toLowerCase().includes(critical))) {
    if (guidance) {
      guidance.guidance += ' ⚠️ This is a critical medication - consult your healthcare provider if you have concerns.';
      guidance.severity = 'high';
      guidance.action = 'consult';
    }
  }

  return guidance;
};

