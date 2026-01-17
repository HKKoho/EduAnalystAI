
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AnalysisStatus } from "../types";

export class GeminiAnalyzer {
  private ai: GoogleGenAI;
  private modelName = 'gemini-3-flash-preview';

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable is not set.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyze(input: string, isUrl: boolean, onStatusChange: (status: AnalysisStatus) => void): Promise<string> {
    onStatusChange(AnalysisStatus.ANALYZING);

    const systemInstruction = `
      You are an elite Educational Analyst. Your goal is to process transcript text and produce a professional "Educational Analysis" dashboard in high-quality Markdown.
      
      RULES:
      1. Analyze the provided text as your primary source of truth.
      2. If a URL is provided, use Google Search grounding to fetch or supplement context about the video content.
      3. Use a structured, academic aesthetic in your Markdown.
      4. Focus on:
         - Executive Summary
         - Key Learning Objectives
         - Core Concepts Deep Dive
         - Critical Arguments & Evidence
         - Educational Value Assessment (Pedagogical utility)
         - Suggested Practical Applications
         - Further Research/Reading list.
      5. Use professional, clear, and objective language.
      6. Use tables or lists where they improve readability.
    `;

    const prompt = isUrl 
      ? `Please perform a deep educational analysis for this YouTube video: ${input}`
      : `Please perform a deep educational analysis of the following transcript text: \n\n${input}`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          temperature: 0.3,
          topP: 0.9,
        },
      });

      onStatusChange(AnalysisStatus.SUMMARIZING);
      return response.text || "Failed to generate analysis.";
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(error.message || "An error occurred during analysis.");
    }
  }
}
