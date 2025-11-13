
declare global {
  interface AIStudio {
    camera: {
      getPicture: () => Promise<Blob>;
    };
  }
  // Add Web Speech API types for voice input
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type DoseStatus = 'taken' | 'skipped';

export interface InteractionDetail {
  description: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Unknown';
  management: string;
  interactingDrugs?: string[];
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[]; // e.g., ['08:00', '20:00']
  food: 'With food' | 'Without food' | 'No specific instructions';
  doseStatus?: { [dateTime: string]: DoseStatus }; // Tracks intake, e.g., { '2023-10-27T08:00': 'taken' }
  missedDoseReasons?: { [dateTime: string]: string }; // Tracks reasons for missed doses
  image?: string; // Base64 encoded image string from camera or search
  quantity?: number;
  refillThreshold?: number;
  refillNotified?: boolean; // To prevent spamming refill notifications
  drugClass?: string; // From Gemini
  sideEffects?: string; // From Gemini
  imprint?: string; // e.g., "APO 10"
  shape?: string;
  color?: string;
  refillHistory?: string[]; // Array of ISO date strings 'YYYY-MM-DD'
  usageNote?: string;
  similarMeds?: string[];
}

export interface InteractionResult {
  hasInteractions: boolean;
  summary: string;
  details?: InteractionDetail[];
}

export enum View {
  Dashboard = 'dashboard',
  Meds = 'meds',
  Reports = 'reports',
  Settings = 'settings',
}