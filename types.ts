
export interface SkillAnalysis {
  skill: string;
  score: number;
  reasoning: string;
  evidence: string; // Quote from resume
}

export interface ScreeningResult {
  candidateName: string;
  candidateLocation: string;
  candidateExperience: string; // e.g., "6 years"
  currentRole: string;
  email?: string;
  phone?: string;
  resumeText: string; // Extracted full text of the resume
  
  overallMatchScore: number;
  candidateSummary: string;
  skillsAnalysis: SkillAnalysis[];
  strengths: string[];
  weaknesses: string[];
  recommendation: "Strong Match" | "Potential Match" | "Weak Match" | "Not a Match";
  suitableRoles: string[];
  technicalSkills: string[];
  functionalSkills: string[];
}

export interface FileInput {
  file: File | null;
  base64: string | null;
  mimeType: string;
  source?: 'local' | 'sharepoint';
}

export interface SavedJobDescription {
  id: string;
  title: string;
  content: string;
  date: string;
}

export enum JobDescriptionMode {
  TEXT = 'TEXT',
  FILE = 'FILE'
}

export type AiProvider = 'gemini' | 'openai';

export const AI_MODELS = {
    gemini: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Balanced)' },
        { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Complex Tasks)' },
        { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite (Fastest)' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Legacy)' }
    ],
    openai: [
        { id: 'gpt-4o', name: 'GPT-4o (Omni)' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Cost Effective)' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
};
