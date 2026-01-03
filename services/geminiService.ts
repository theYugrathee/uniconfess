import { GoogleGenAI } from "@google/genai";

// Helper to safely get API Key without crashing if process is undefined
const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    console.warn("process.env is not defined");
    return '';
  }
};

const API_KEY = getApiKey();

// Safe fallback if key is missing to avoid crashing app in demo mode
const isConfigured = !!API_KEY;

export const polishConfession = async (text: string): Promise<string> => {
  if (!isConfigured) {
    console.warn("Gemini API Key not found. Returning original text.");
    return text;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // We use a basic Flash model for fast text editing
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an editor for a college confession board. Rewrite the following text to be more engaging, grammatically correct, and impactful, while keeping the original meaning and tone. Keep it under 280 characters if possible. Text: "${text}"`,
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return text; // Fallback to original
  }
};