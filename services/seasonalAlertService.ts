import { Medication } from '../types';

export interface SeasonalAlert {
  id: string;
  type: 'allergy' | 'flu' | 'vaccine' | 'preventive' | 'seasonal';
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  priority: 'low' | 'medium' | 'high';
}

/**
 * Get seasonal alerts based on current date
 */
export const getSeasonalAlerts = (medications: Medication[]): SeasonalAlert[] => {
  const alerts: SeasonalAlert[] = [];
  const today = new Date();
  const month = today.getMonth(); // 0-11
  const day = today.getDate();

  // Spring Allergy Season (March-May)
  if (month >= 2 && month <= 4) {
    alerts.push({
      id: 'spring-allergy',
      type: 'allergy',
      title: '🌸 Spring Allergy Season',
      message: 'Spring allergy season is here. Consider adding allergy medications like antihistamines if you experience seasonal allergies.',
      actionText: 'Add Allergy Medication',
      priority: 'medium',
      startDate: `${today.getFullYear()}-03-01`,
      endDate: `${today.getFullYear()}-05-31`,
    });
  }

  // Fall/Winter Flu Season (October-March)
  if (month >= 9 || month <= 2) {
    alerts.push({
      id: 'flu-season',
      type: 'flu',
      title: '🦠 Flu Season',
      message: 'Flu season is active. Consider getting your annual flu shot and adding it to your medication list.',
      actionText: 'Add Flu Shot',
      priority: 'high',
      startDate: `${today.getFullYear()}-10-01`,
      endDate: `${today.getFullYear() + (month <= 2 ? 0 : 1)}-03-31`,
    });
  }

  // COVID-19 Booster Reminders (Year-round, but emphasize in fall)
  if (month >= 8 && month <= 10) {
    alerts.push({
      id: 'covid-booster',
      type: 'vaccine',
      title: '💉 COVID-19 Booster',
      message: 'Fall is a good time to get your COVID-19 booster shot. Check with your healthcare provider about eligibility.',
      priority: 'high',
      startDate: `${today.getFullYear()}-09-01`,
      endDate: `${today.getFullYear()}-11-30`,
    });
  }

  // Summer Sun Protection (May-August)
  if (month >= 4 && month <= 7) {
    alerts.push({
      id: 'sun-protection',
      type: 'preventive',
      title: '☀️ Sun Protection Season',
      message: 'Summer sun is strong. If you take medications that increase sun sensitivity, ensure you have sunscreen.',
      priority: 'low',
      startDate: `${today.getFullYear()}-05-01`,
      endDate: `${today.getFullYear()}-08-31`,
    });
  }

  // Check if user has relevant medications
  const hasAllergyMeds = medications.some(m => 
    m.name.toLowerCase().includes('antihistamine') ||
    m.name.toLowerCase().includes('loratadine') ||
    m.name.toLowerCase().includes('cetirizine') ||
    m.name.toLowerCase().includes('fexofenadine')
  );

  const hasFluShot = medications.some(m => 
    m.name.toLowerCase().includes('flu') ||
    m.name.toLowerCase().includes('influenza')
  );

  // Filter alerts based on existing medications
  return alerts.filter(alert => {
    if (alert.type === 'allergy' && hasAllergyMeds) return false;
    if (alert.type === 'flu' && hasFluShot) return false;
    return true;
  });
};

/**
 * Get preventive care reminders
 */
export const getPreventiveAlerts = (medications: Medication[]): SeasonalAlert[] => {
  const alerts: SeasonalAlert[] = [];
  const today = new Date();

  // Annual check-up reminder (once per year)
  const lastCheckup = localStorage.getItem('lastAnnualCheckup');
  if (!lastCheckup || new Date(lastCheckup) < new Date(today.getFullYear(), 0, 1)) {
    alerts.push({
      id: 'annual-checkup',
      type: 'preventive',
      title: '📋 Annual Health Check-up',
      message: 'Consider scheduling your annual health check-up to review your medications with your healthcare provider.',
      priority: 'medium',
      startDate: today.toISOString().split('T')[0],
      endDate: `${today.getFullYear()}-12-31`,
    });
  }

  // Medication review reminder (every 6 months)
  const lastReview = localStorage.getItem('lastMedicationReview');
  if (!lastReview) {
    alerts.push({
      id: 'medication-review',
      type: 'preventive',
      title: '💊 Medication Review',
      message: 'It\'s been a while since your last medication review. Consider reviewing your medications with your pharmacist or doctor.',
      priority: 'medium',
      startDate: today.toISOString().split('T')[0],
      endDate: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  } else {
    const reviewDate = new Date(lastReview);
    const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
    if (reviewDate < sixMonthsAgo) {
      alerts.push({
        id: 'medication-review',
        type: 'preventive',
        title: '💊 Medication Review Due',
        message: 'It\'s time for your 6-month medication review. Schedule an appointment with your healthcare provider.',
        priority: 'high',
        startDate: today.toISOString().split('T')[0],
        endDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }
  }

  return alerts;
};

