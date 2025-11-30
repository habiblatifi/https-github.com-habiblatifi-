/**
 * Voice command recognition and processing
 */

export interface VoiceCommand {
  action: 'mark_taken' | 'show_schedule' | 'show_missed' | 'add_medication' | 'show_reports';
  medication?: string;
  time?: string;
}

/**
 * Initialize voice recognition
 */
export const initializeVoiceRecognition = (): SpeechRecognition | null => {
  if (typeof window === 'undefined') return null;

  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech recognition not supported in this browser');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  return recognition;
};

/**
 * Parse voice command text into structured command
 */
export const parseVoiceCommand = (text: string): VoiceCommand | null => {
  const lowerText = text.toLowerCase();

  // Mark as taken
  if (lowerText.includes('mark') && lowerText.includes('taken')) {
    // Try to extract medication name
    const medicationMatch = extractMedicationName(lowerText);
    return {
      action: 'mark_taken',
      medication: medicationMatch,
    };
  }

  // Show schedule
  if (lowerText.includes('schedule') || lowerText.includes('what do i take')) {
    return { action: 'show_schedule' };
  }

  // Show missed doses
  if (lowerText.includes('missed') || lowerText.includes('miss')) {
    return { action: 'show_missed' };
  }

  // Add medication
  if (lowerText.includes('add') && lowerText.includes('medication')) {
    return { action: 'add_medication' };
  }

  // Show reports
  if (lowerText.includes('report') || lowerText.includes('adherence')) {
    return { action: 'show_reports' };
  }

  return null;
};

/**
 * Extract medication name from voice text
 */
const extractMedicationName = (text: string): string | undefined => {
  // Common medication name patterns
  const commonMeds = [
    'aspirin', 'ibuprofen', 'tylenol', 'metformin', 'lisinopril',
    'atorvastatin', 'amlodipine', 'metoprolol', 'omeprazole', 'simvastatin',
  ];

  for (const med of commonMeds) {
    if (text.includes(med)) {
      return med;
    }
  }

  // Try to extract after "mark" or "taken"
  const markIndex = text.indexOf('mark');
  const takenIndex = text.indexOf('taken');
  const startIndex = Math.max(markIndex, takenIndex);
  
  if (startIndex > -1) {
    const afterKeyword = text.substring(startIndex);
    const words = afterKeyword.split(' ');
    // Return first capitalized word after keyword
    for (let i = 1; i < words.length; i++) {
      if (words[i] && words[i][0] && words[i][0] === words[i][0].toUpperCase()) {
        return words[i];
      }
    }
  }

  return undefined;
};

/**
 * Speak text using text-to-speech
 */
export const speak = (text: string, onEnd?: () => void): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Text-to-speech not supported');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  if (onEnd) {
    utterance.onend = onEnd;
  }

  window.speechSynthesis.speak(utterance);
};

/**
 * Stop any ongoing speech
 */
export const stopSpeaking = (): void => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

