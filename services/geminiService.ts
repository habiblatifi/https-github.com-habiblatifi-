import { GoogleGenAI, Type, Modality } from "@google/genai";
import { InteractionResult, Medication } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const checkInteractions = async (medications: string[]): Promise<InteractionResult> => {
  if (medications.length < 2) {
    return { hasInteractions: false, summary: "Add two or more medications to check for interactions." };
  }

  const medsString = medications.join(', ');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert clinical pharmacist. Analyze for drug-drug interactions in: ${medsString}.
      For each interaction, create a separate "detail" object.
      - interactingDrugs: An array of the two drug names involved.
      - description: Clearly state the clinical significance of the interaction.
      - severity: 'Mild', 'Moderate', 'Severe', or 'Unknown'.
      - management: A comprehensive, patient-friendly management recommendation.
      Your final summary should be a high-level overview of the risks. If no interactions are found, set hasInteractions to false and provide a reassuring summary.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasInteractions: { type: Type.BOOLEAN },
            summary: { type: Type.STRING },
            details: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  interactingDrugs: { type: Type.ARRAY, items: { type: Type.STRING } },
                  description: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ['Mild', 'Moderate', 'Severe', 'Unknown'] },
                  management: { type: Type.STRING }
                },
                required: ["interactingDrugs", "description", "severity", "management"]
              }
            }
          },
          required: ["hasInteractions", "summary"]
        },
      }
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    return result;

  } catch (error: any) {
    // Handle quota exceeded errors gracefully
    if (error?.error?.code === 429 || error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
      console.warn("Gemini API quota exceeded. Skipping interaction check.");
      return {
        hasInteractions: false,
        summary: "Interaction checking is temporarily unavailable due to API quota limits. Please try again later.",
      };
    }
    console.error("Gemini API error in checkInteractions:", error);
    return {
      hasInteractions: false,
      summary: "Could not check for interactions at this time. Please try again later.",
    };
  }
};

export const identifyMedication = async (base64Image: string, mimeType: string = 'image/jpeg', retryCount: number = 0): Promise<Partial<Medication>> => {
  // Check if API key is configured
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY === '') {
    throw new Error("API key is not configured. Please set GEMINI_API_KEY in your .env file.");
  }

  const maxRetries = 2;
  const retryDelay = 1000 * (retryCount + 1); // Exponential backoff: 1s, 2s

  try {
    // Normalize MIME type - default to jpeg if not provided or invalid
    let normalizedMimeType = mimeType || 'image/jpeg';
    if (!normalizedMimeType.startsWith('image/')) {
      normalizedMimeType = 'image/jpeg';
    }
    // Gemini supports: image/jpeg, image/png, image/webp, image/heic, image/heif
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(normalizedMimeType)) {
      normalizedMimeType = 'image/jpeg'; // Fallback to jpeg
    }

    const imagePart = {
      inlineData: {
        mimeType: normalizedMimeType,
        data: base64Image,
      },
    };
    const textPart = {
      text: `Identify the medication in this image. Provide its name, a common dosage (e.g., "10mg tablet"), the pill's imprint (text on the pill), shape, and color. Also provide a common frequency (e.g., "Once daily"), standard food instructions ("With food", "Without food", or "No specific instructions"), its drug class, a brief summary of common side effects, a short patient-friendly note on its primary use (usageNote), and a list of 2-3 common alternative medications (similarMeds). Provide only the most common values. If you cannot identify the pill, return empty strings/arrays for all fields.`
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            dosage: { type: Type.STRING },
            frequency: { type: Type.STRING },
            food: { type: Type.STRING },
            drugClass: { type: Type.STRING },
            sideEffects: { type: Type.STRING },
            imprint: { type: Type.STRING },
            shape: { type: Type.STRING },
            color: { type: Type.STRING },
            usageNote: { type: Type.STRING },
            similarMeds: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["name", "dosage", "frequency", "food"]
        },
      }
    });
    
    const jsonString = response.text.trim();
    let result;
    
    try {
      result = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      console.error("Response text:", jsonString);
      throw new Error("Invalid response from medication identification service.");
    }

    // Validate that we got a result object
    if (!result || typeof result !== 'object') {
      console.error("Invalid result format:", result);
      throw new Error("Invalid response format from medication identification service.");
    }

    if (result.food && !['With food', 'Without food', 'No specific instructions'].includes(result.food)) {
        result.food = 'No specific instructions';
    }

    // Log the result for debugging
    console.log("Identification result:", { 
      name: result.name, 
      dosage: result.dosage, 
      hasName: !!result.name,
      nameLength: result.name?.length,
      nameTrimmed: result.name?.trim().length,
      fullResult: result
    });

    // Ensure we return a valid object even if name is empty
    return {
      name: result.name || '',
      dosage: result.dosage || '',
      frequency: result.frequency || '',
      food: result.food || 'No specific instructions',
      drugClass: result.drugClass || '',
      sideEffects: result.sideEffects || '',
      imprint: result.imprint || '',
      shape: result.shape || '',
      color: result.color || '',
      usageNote: result.usageNote || '',
      similarMeds: result.similarMeds || [],
    } as Partial<Medication>;

  } catch (error: any) {
    console.error("Gemini API error in identifyMedication:", error);
    
    // Provide more specific error messages
    if (error?.message?.includes('API_KEY') || error?.message?.includes('api key') || error?.message?.includes('authentication')) {
      throw new Error("Invalid or missing API key. Please check your GEMINI_API_KEY in the .env file.");
    }
    // Check for quota/rate limit errors and retry if we haven't exceeded max retries
    const isQuotaError = error?.message?.includes('quota') || 
                         error?.message?.includes('rate limit') ||
                         error?.message?.includes('RESOURCE_EXHAUSTED') ||
                         error?.error?.code === 429 ||
                         error?.code === 429 ||
                         error?.status === 429;
    
    // Check for service unavailable/overloaded errors (503)
    const isServiceUnavailable = error?.error?.code === 503 ||
                                 error?.code === 503 ||
                                 error?.status === 503 ||
                                 error?.error?.status === 'UNAVAILABLE' ||
                                 error?.message?.includes('overloaded') ||
                                 error?.message?.includes('UNAVAILABLE') ||
                                 error?.error?.message?.includes('overloaded');
    
    if ((isQuotaError || isServiceUnavailable) && retryCount < maxRetries) {
      const errorType = isServiceUnavailable ? 'Service unavailable' : 'Quota';
      console.log(`${errorType} error detected. Retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return identifyMedication(base64Image, mimeType, retryCount + 1);
    }
    
    if (isQuotaError) {
      // For quota errors after retries, return empty result to allow manual entry instead of throwing
      console.warn("API quota exceeded after retries. Allowing manual entry.");
      return {
        name: '',
        dosage: '',
        frequency: '',
        food: 'No specific instructions',
        drugClass: '',
        sideEffects: '',
        imprint: '',
        shape: '',
        color: '',
        usageNote: '',
        similarMeds: [],
      } as Partial<Medication>;
    }
    
    if (isServiceUnavailable) {
      // For service unavailable errors, return empty result to allow manual entry
      console.warn("API service unavailable. Allowing manual entry.");
      throw new Error("The medication identification service is temporarily overloaded. Please try again later or enter the details manually.");
    }
    if (error?.message?.includes('invalid') && error?.message?.includes('image')) {
      throw new Error("Invalid image format. Please try a different image.");
    }
    
    // Format error message to be user-friendly
    let errorMessage = '';
    if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = 'An unexpected error occurred';
    }
    
    // Clean up error message - remove JSON formatting if present
    if (errorMessage.includes('{') && errorMessage.includes('}')) {
      try {
        const errorObj = JSON.parse(errorMessage);
        if (errorObj.error?.message) {
          errorMessage = errorObj.error.message;
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        }
      } catch {
        // If parsing fails, use the original message but clean it up
        errorMessage = errorMessage.replace(/\{.*?\}/g, '').trim();
      }
    }
    
    throw new Error(errorMessage || 'Failed to identify medication. Please try again or enter details manually.');
  }
};

export const identifyMedicationByName = async (name: string, dosage: string): Promise<Partial<Medication>> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Provide details for the medication: ${name} ${dosage}. If a dosage is not provided, suggest a common one.
I need:
- common dosage
- common frequency (e.g., "Once daily"). **For medications with a standard tapering schedule (like steroid dose packs), provide the full, detailed tapering schedule as the frequency.**
- standard food instructions ("With food", "Without food", or "No specific instructions")
- drug class
- a brief summary of common side effects
- the most common physical characteristics: pill imprint (text on the pill), shape, and color
- a short patient-friendly note on its primary use (usageNote)
- a list of 2-3 common alternative medications (similarMeds).
Provide only the most common values. If you cannot identify it, return empty strings/arrays for all fields.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dosage: { type: Type.STRING },
            frequency: { type: Type.STRING },
            food: { type: Type.STRING },
            drugClass: { type: Type.STRING },
            sideEffects: { type: Type.STRING },
            imprint: { type: Type.STRING },
            shape: { type: Type.STRING },
            color: { type: Type.STRING },
            usageNote: { type: Type.STRING },
            similarMeds: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      }
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);

    if (result.food && !['With food', 'Without food', 'No specific instructions'].includes(result.food)) {
        result.food = 'No specific instructions';
    }
    
    return result as Partial<Medication>;

  } catch (error) {
    console.error("Gemini API error in identifyMedicationByName:", error);
    throw new Error("Failed to identify medication from name.");
  }
};

export const identifyMedicationByImprint = async (imprint: string): Promise<Partial<Medication>> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Identify the medication from its pill imprint: "${imprint}".
      Provide its name, a common dosage (e.g., "10mg tablet"), the pill's imprint (which should match the query), shape, and color.
      Also provide a common frequency (e.g., "Once daily"), standard food instructions ("With food", "Without food", or "No specific instructions"), its drug class, a brief summary of common side effects, a short patient-friendly note on its primary use (usageNote), and a list of 2-3 common alternative medications (similarMeds).
      Provide only the most common values for a US context. If you cannot identify the pill from the imprint, return empty strings/arrays for all fields except for the imprint field itself.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            dosage: { type: Type.STRING },
            frequency: { type: Type.STRING },
            food: { type: Type.STRING },
            drugClass: { type: Type.STRING },
            sideEffects: { type: Type.STRING },
            imprint: { type: Type.STRING },
            shape: { type: Type.STRING },
            color: { type: Type.STRING },
            usageNote: { type: Type.STRING },
            similarMeds: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["name", "dosage", "frequency", "food", "imprint"]
        },
      }
    });
    
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);

    if (result.food && !['With food', 'Without food', 'No specific instructions'].includes(result.food)) {
        result.food = 'No specific instructions';
    }

    return result as Partial<Medication>;

  } catch (error) {
    console.error("Gemini API error in identifyMedicationByImprint:", error);
    throw new Error("Failed to identify medication from imprint.");
  }
};


export const findPillImage = async (medicationName: string, dosage: string): Promise<string | null> => {
  if (!medicationName) return null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A clear, high-quality, photo-realistic image of a single ${medicationName} ${dosage || ''} pill on a plain white background.`,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    return null;

  } catch (error) {
    console.error("Gemini API error in findPillImage:", error);
    return null;
  }
};

export const getTimesFromFrequency = async (frequencyText: string): Promise<string[]> => {
  if (!frequencyText || frequencyText.toLowerCase().includes('as needed')) {
    return [];
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an intelligent pharmacy assistant. Your task is to parse a medication frequency instruction and return a JSON array of suggested 24-hour format times (HH:mm). Be smart about typical medication schedules.
      Instruction: "${frequencyText}".
      
      **CRITICAL INSTRUCTIONS:**
      1.  For multi-day tapering schedules (e.g., "Day 1: 6 tablets; Day 2: 5 tablets..."), you MUST return the suggested times for the FIRST day mentioned ONLY. Spread the times evenly throughout waking hours (approx. 08:00 to 22:00).
      2.  If no specific daily times are applicable (like for "as needed", "weekly", or vague ranges like "every 4-6 hours"), return an empty array.
      3.  Return ONLY the JSON array.

      **EXAMPLES of your high-quality work:**
      - "Once daily" -> ["09:00"]
      - "Twice a day" or "every 12 hours" -> ["09:00", "21:00"]
      - "Every 8 hours" -> ["07:00", "15:00", "23:00"]
      - "3 times a day with meals" -> ["08:00", "12:00", "18:00"]
      - "4 times a day" or "Up to 4 times daily" -> ["08:00", "12:00", "16:00", "20:00"]
      - "Take 1 tablet by mouth every morning" -> ["08:00"]
      - "At bedtime" -> ["22:00"]
      - "Tapering dose... Day 1: 6 tablets; Day 2: 5 tablets..." -> ["08:00", "11:00", "14:00", "17:00", "20:00", "22:00"]
      - "As needed for pain" -> []
      - "Weekly" -> []
      `,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });
    
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    if (Array.isArray(result) && result.every(item => typeof item === 'string' && /^\d{2}:\d{2}$/.test(item))) {
        return result.sort();
    }
    return [];
  } catch (error) {
    console.error('Gemini API error in getTimesFromFrequency:', error);
    // Fallback for common cases if API fails
    const lowerFreq = frequencyText.toLowerCase();
    if (lowerFreq.includes('once a day') || lowerFreq.includes('daily')) return ['09:00'];
    if (lowerFreq.includes('twice a day') || lowerFreq.includes('every 12 hours')) return ['09:00', '21:00'];
    return [];
  }
};

export const parseMedicationInfoFromText = async (text: string): Promise<Partial<Omit<Medication, 'id'>>> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert pharmacy assistant. A patient is speaking and you need to parse their statement to extract medication details accurately.
      Patient statement: "${text}"
      From this statement, extract the medication name, the dosage (e.g., "500mg"), a simple frequency description (e.g., "Twice a day"), and food instructions ('With food', 'Without food', or 'No specific instructions').
      If a piece of information isn't mentioned, return an empty string for that field. For food, default to 'No specific instructions' if not mentioned.
      Example 1: "I need to take Metformin 500mg twice a day with some food" -> { "name": "Metformin", "dosage": "500mg", "frequency": "twice a day", "food": "With food" }
      Example 2: "Lisinopril 10 milligrams once daily" -> { "name": "Lisinopril", "dosage": "10mg", "frequency": "once daily", "food": "No specific instructions" }
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            dosage: { type: Type.STRING },
            frequency: { type: Type.STRING },
            food: { type: Type.STRING },
          },
          required: ["name", "dosage", "frequency", "food"]
        },
      }
    });

    const jsonString = response.text.trim();
    return JSON.parse(jsonString) as Partial<Medication>;

  } catch (error) {
    console.error("Gemini API error in parseMedicationInfoFromText:", error);
    return {};
  }
};