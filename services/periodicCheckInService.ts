import { Medication } from '../types';

export interface CheckInReminder {
  id: string;
  medicationId: string;
  medicationName: string;
  type: 'long-term' | 'chronic' | 'preventive';
  lastCheckIn?: string;
  nextCheckIn: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Generate periodic check-in reminders for long-term medications
 */
export const generateCheckInReminders = (medications: Medication[]): CheckInReminder[] => {
  const reminders: CheckInReminder[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  medications.forEach(med => {
    // Check if medication is long-term (has been taken for more than 90 days)
    const doseDates = Object.keys(med.doseStatus || {})
      .map(key => key.split('T')[0])
      .filter(date => med.doseStatus?.[`${date}T${med.times[0]}`] === 'taken')
      .sort();

    if (doseDates.length === 0) return;

    const firstDose = new Date(doseDates[0]);
    const daysSinceFirstDose = Math.floor((today.getTime() - firstDose.getTime()) / (1000 * 60 * 60 * 24));

    // Long-term medication check-in (every 3 months)
    if (daysSinceFirstDose >= 90) {
      const lastCheckIn = localStorage.getItem(`checkIn_${med.id}`);
      const lastCheckInDate = lastCheckIn ? new Date(lastCheckIn) : firstDose;
      const daysSinceCheckIn = Math.floor((today.getTime() - lastCheckInDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceCheckIn >= 90) {
        reminders.push({
          id: `checkin-${med.id}`,
          medicationId: med.id,
          medicationName: med.name,
          type: 'long-term',
          lastCheckIn: lastCheckIn || firstDose.toISOString().split('T')[0],
          nextCheckIn: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          message: `It's been ${Math.floor(daysSinceCheckIn / 30)} months since your last check-in for ${med.name}. Consider reviewing with your healthcare provider to ensure it's still the right medication and dosage for you.`,
          priority: daysSinceCheckIn >= 120 ? 'high' : 'medium',
        });
      }
    }

    // Chronic condition medications (check every 6 months)
    const chronicConditions = ['blood pressure', 'diabetes', 'cholesterol', 'heart', 'thyroid'];
    const isChronic = chronicConditions.some(condition => 
      med.name.toLowerCase().includes(condition) ||
      med.drugClass?.toLowerCase().includes(condition)
    );

    if (isChronic && daysSinceFirstDose >= 180) {
      const lastReview = localStorage.getItem(`review_${med.id}`);
      const lastReviewDate = lastReview ? new Date(lastReview) : firstDose;
      const daysSinceReview = Math.floor((today.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceReview >= 180) {
        reminders.push({
          id: `review-${med.id}`,
          medicationId: med.id,
          medicationName: med.name,
          type: 'chronic',
          lastCheckIn: lastReview || firstDose.toISOString().split('T')[0],
          nextCheckIn: new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          message: `${med.name} is a long-term medication. It's been ${Math.floor(daysSinceReview / 30)} months since your last review. Schedule a check-up with your doctor to review effectiveness and any needed adjustments.`,
          priority: daysSinceReview >= 240 ? 'high' : 'medium',
        });
      }
    }
  });

  return reminders;
};

/**
 * Mark a check-in as completed
 */
export const markCheckInComplete = (medicationId: string, type: 'checkin' | 'review') => {
  const key = type === 'checkin' ? `checkIn_${medicationId}` : `review_${medicationId}`;
  localStorage.setItem(key, new Date().toISOString());
};

