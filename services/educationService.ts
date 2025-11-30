import { Medication, MedicationEducation } from '../types';

/**
 * Generate educational content for a medication
 */
export const generateMedicationEducation = async (
  medication: Medication
): Promise<MedicationEducation> => {
  // In a real implementation, this would call an API or use a knowledge base
  // For now, we'll generate basic content from existing medication data
  
  const education: MedicationEducation = {
    medicationId: medication.id,
    summary: medication.usageNote || `Information about ${medication.name}`,
    howToTake: getHowToTakeInstructions(medication),
    commonSideEffects: medication.sideEffects 
      ? medication.sideEffects.split(',').map(s => s.trim())
      : [],
    foodNotes: getFoodNotes(medication),
    interactionNotes: medication.drugClass 
      ? `This medication belongs to the ${medication.drugClass} class. Always inform your doctor about all medications you're taking.`
      : undefined,
  };

  return education;
};

/**
 * Get how-to-take instructions
 */
const getHowToTakeInstructions = (medication: Medication): string => {
  const instructions: string[] = [];

  if (medication.food === 'With food') {
    instructions.push('Take with food or a meal to reduce stomach upset and improve absorption.');
  } else if (medication.food === 'Without food') {
    instructions.push('Take on an empty stomach (1 hour before or 2 hours after meals) for best absorption.');
  }

  if (medication.times.length > 0) {
    instructions.push(`Take at the same time(s) each day: ${medication.times.join(', ')}.`);
  }

  if (medication.frequency) {
    if (medication.frequency.toLowerCase().includes('tapering')) {
      instructions.push('Follow the tapering schedule exactly as prescribed. Do not skip days.');
    } else if (medication.frequency.toLowerCase().includes('antibiotic')) {
      instructions.push('Complete the full course of antibiotics, even if you feel better.');
    }
  }

  return instructions.join(' ') || 'Follow your doctor\'s instructions for taking this medication.';
};

/**
 * Get food-related notes
 */
const getFoodNotes = (medication: Medication): string | undefined => {
  if (medication.food === 'With food') {
    return 'Taking with food helps reduce nausea and improves how your body absorbs this medication.';
  } else if (medication.food === 'Without food') {
    return 'Taking on an empty stomach ensures optimal absorption. Wait 1-2 hours after eating.';
  }
  return undefined;
};

/**
 * Get contextual educational tip based on medication type
 */
export const getContextualTip = (medication: Medication, context: 'add' | 'schedule' | 'take'): string | null => {
  if (context === 'add' && medication.food === 'With food') {
    return '💡 Taking with food reduces nausea and improves absorption for many medications like this.';
  }

  if (context === 'schedule' && medication.frequency.toLowerCase().includes('antibiotic')) {
    return '💡 Try to keep antibiotic doses evenly spaced throughout the day for best effectiveness.';
  }

  if (context === 'take' && medication.times.length > 2) {
    return '💡 For multiple daily doses, spacing them evenly helps maintain consistent levels in your body.';
  }

  return null;
};

