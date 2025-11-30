import { Medication } from '../types';

export interface CostSavingSuggestion {
  id: string;
  medicationId: string;
  medicationName: string;
  suggestion: string;
  potentialSavings?: string;
  actionType: 'generic' | 'coupon' | 'insurance' | 'pharmacy' | 'dosage';
  priority: 'low' | 'medium' | 'high';
}

/**
 * Generate cost-saving suggestions for medications
 */
export const generateCostSavings = (medications: Medication[]): CostSavingSuggestion[] => {
  const suggestions: CostSavingSuggestion[] = [];

  medications.forEach(med => {
    const name = med.name.toLowerCase();

    // Check for brand-name medications that might have generic alternatives
    const brandToGeneric: { [key: string]: string } = {
      'lipitor': 'atorvastatin',
      'nexium': 'esomeprazole',
      'plavix': 'clopidogrel',
      'advair': 'fluticasone/salmeterol',
      'singulair': 'montelukast',
      'prozac': 'fluoxetine',
      'zoloft': 'sertraline',
      'paxil': 'paroxetine',
      'celexa': 'citalopram',
      'lexapro': 'escitalopram',
    };

    for (const [brand, generic] of Object.entries(brandToGeneric)) {
      if (name.includes(brand)) {
        suggestions.push({
          id: `generic-${med.id}`,
          medicationId: med.id,
          medicationName: med.name,
          suggestion: `Consider asking your doctor about switching to generic ${generic}. Generic medications are typically 80-85% cheaper than brand-name versions.`,
          potentialSavings: '80-85%',
          actionType: 'generic',
          priority: 'high',
        });
        break;
      }
    }

    // Check for medications that might benefit from 90-day supplies
    if (med.frequency && (
      med.frequency.toLowerCase().includes('daily') ||
      med.frequency.toLowerCase().includes('once')
    )) {
      suggestions.push({
        id: `90day-${med.id}`,
        medicationId: med.id,
        medicationName: med.name,
        suggestion: `Ask your pharmacy about 90-day supplies for ${med.name}. This can save you money on copays and reduce trips to the pharmacy.`,
        potentialSavings: '2 copays per year',
        actionType: 'pharmacy',
        priority: 'medium',
      });
    }

    // Check for medications that might have manufacturer coupons
    const medicationsWithCoupons = [
      'humira', 'enbrel', 'stelara', 'cosentyx', 'tremfya',
      'eliquis', 'xarelto', 'pradaxa',
      'januvia', 'trulicity', 'ozempic',
    ];

    if (medicationsWithCoupons.some(couponMed => name.includes(couponMed))) {
      suggestions.push({
        id: `coupon-${med.id}`,
        medicationId: med.id,
        medicationName: med.name,
        suggestion: `${med.name} may have manufacturer savings programs or coupons available. Check the manufacturer's website or ask your pharmacist.`,
        potentialSavings: 'Varies',
        actionType: 'coupon',
        priority: 'high',
      });
    }
  });

  return suggestions;
};

/**
 * Get medication cost comparison information
 */
export const getCostComparison = (medication: Medication): {
  averageCost: string;
  genericAvailable: boolean;
  savingsTips: string[];
} => {
  const name = medication.name.toLowerCase();
  const tips: string[] = [];

  // Generic availability check
  const hasGeneric = !name.includes('brand') && 
    !['humira', 'enbrel', 'stelara', 'cosentyx'].some(brand => name.includes(brand));

  if (hasGeneric) {
    tips.push('Generic version may be available - ask your pharmacist');
  }

  // Insurance tips
  tips.push('Check if your insurance has preferred pharmacies for lower copays');
  tips.push('Some medications are covered better under different insurance tiers');

  // Pharmacy comparison
  tips.push('Compare prices at different pharmacies - costs can vary significantly');

  return {
    averageCost: 'Varies by pharmacy and insurance',
    genericAvailable: hasGeneric,
    savingsTips: tips,
  };
};

