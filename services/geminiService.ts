
import { GoogleGenAI, Type, Schema } from "@google/genai";
import OpenAI from "openai";
import { ScreeningResult, FileInput, AiProvider } from "../types";
import mammoth from "mammoth";

// --- Configuration & Schemas ---

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "Full name of the candidate." },
    candidateLocation: { type: Type.STRING, description: "City/Country or 'Remote' if specified." },
    candidateExperience: { type: Type.STRING, description: "Total years of experience (e.g., '7 years')." },
    currentRole: { type: Type.STRING, description: "Current or most recent job title." },
    email: { type: Type.STRING, description: "Email address if available, else empty string." },
    phone: { type: Type.STRING, description: "Phone number without country code." },
    resumeText: { type: Type.STRING, description: "The full plain text content of the resume, extracted verbatim." },
    overallMatchScore: {
      type: Type.NUMBER,
      description: "A score from 0 to 100 indicating how well the candidate matches the job description.",
    },
    candidateSummary: {
      type: Type.STRING,
      description: "A concise professional summary of the candidate (max 3 sentences).",
    },
    skillsAnalysis: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill: { type: Type.STRING, description: "Name of the specific requirement or skill from the JD." },
          score: { type: Type.NUMBER, description: "Score 0-100. 0 if missing, 100 if perfectly matched." },
          reasoning: { type: Type.STRING, description: "Brief explanation of the score, comparing JD requirement to Resume content." },
          evidence: { type: Type.STRING, description: "A direct short quote from the resume that supports this score." },
        },
        required: ["skill", "score", "reasoning", "evidence"],
      },
      description: "Detailed breakdown of key skills/requirements found in the Job Description and how the candidate compares.",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of key strengths identified in the resume relative to the job.",
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of missing skills or areas of improvement relative to the job.",
    },
    recommendation: {
      type: Type.STRING,
      enum: ["Strong Match", "Potential Match", "Weak Match", "Not a Match"],
      description: "Final recommendation category.",
    },
    suitableRoles: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 3-5 job titles that would be suitable for this candidate based on their resume content.",
    },
    technicalSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Comprehensive list of all technical skills (languages, frameworks, tools, platforms) found in the resume.",
    },
    functionalSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of functional and soft skills (leadership, project management, communication, agile) found in the resume.",
    },
  },
  required: [
    "candidateName", "candidateLocation", "candidateExperience", "currentRole", "resumeText",
    "overallMatchScore", "candidateSummary", "skillsAnalysis", "strengths", "weaknesses", "recommendation", "suitableRoles",
    "technicalSkills", "functionalSkills"
  ],
};

// --- Helpers ---

const extractTextFromDocx = async (base64: string): Promise<string> => {
  try {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // mammoth is a default export in some environments
    return (await mammoth.extractRawText({ arrayBuffer: bytes.buffer })).value;
  } catch (e) {
    console.error("Failed to extract text from DOCX", e);
    return "";
  }
};

const getCommonPrompt = (jdContext: string) => `
    You are an expert HR Technical Recruiter and Resume Screener known for being extremely strict and precise.
    
    ${jdContext}

    Your goal is to screen the attached resume against the Job Description (JD) with high precision, verifying claims against evidence.

    Steps:
    1. **Analyze the JD**: Identify the critical "Must-Have" technical skills, required years of experience, and essential soft skills. Distinguish these from "Nice-to-Have" skills.
    2. **Analyze the Resume**: Extract candidate details and skills. 
       - NOTE: If the resume content appears to be invalid, random text, or not a resume at all, set 'recommendation' to "Not a Match", 'overallMatchScore' to 0, and 'candidateName' to "Unknown/Invalid File".
    3. **Strict Comparison (Evidence-Based)**: 
       - **Context Matters**: Do not just keyword match. A candidate listing "Python" in a skills section is different from one who used "Python" to build a backend API in their last job.
       - **Penalty for Missing Must-Haves**: If a core requirement (e.g., "5+ years of Java") is missing or the candidate only has 1 year, the score for that skill must be low (<40), and the overall match score must be significantly impacted.
       - **Keyword Stuffing**: Assign low scores (30-50) if a skill is only found in a "Skills" list without context in the "Experience" section.
       - **Synonyms**: 'AWS' matches 'Amazon Web Services'; 'React' matches 'React.js'.
    4. **Recommendation Logic**:
       - **Strong Match**: Candidate meets ALL "Must-Have" requirements with strong evidence in recent roles.
       - **Potential Match**: Meets most "Must-Haves" but might lack specific domain knowledge or full years of experience.
       - **Weak Match**: Missing one or more critical "Must-Have" skills, or experience is significantly lower than required.
       - **Not a Match**: Fundamental mismatch (e.g., wrong tech stack, junior applying for architect role, missing multiple core skills).

    Task output:
    1. Extract candidate's Name, Location, Experience, Role, Email.
    2. Extract Phone: **Strictly remove any international country codes** (e.g., +1, +91, 0044). Return only the local 10-digit (or standard local length) number. Format as (XXX) XXX-XXXX if it is a US number, or standard local format otherwise.
    3. Extract FULL resume text.
    4. 'skillsAnalysis': List the *JD Requirements* you identified in Step 1.
       - Score strictly based on evidence found in the 'Experience' or 'Projects' sections, not just the 'Skills' list.
       - In 'evidence', quote the specific text. If no evidence exists in experience/projects, state "Listed in skills only" or "No evidence found".
    5. 'overallMatchScore': A weighted average. Weight "Must-Have" skills double.
    6. 'suitableRoles': 3-5 roles this candidate fits.
    7. 'technicalSkills' & 'functionalSkills': Comprehensive lists.

    Be extremely critical. It is better to reject a weak candidate than to falsely recommend them.
`;

// Helper for retrying async operations
async function retryOperation<T>(operation: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Operation failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Generate a dummy result for mock SharePoint files so the demo works without a real backend
const generateMockResult = (fileName: string): ScreeningResult => {
  return {
    candidateName: fileName.replace(/\.(pdf|docx)$/, '').replace(/_/g, ' '),
    candidateLocation: "SharePoint Import (Demo)",
    candidateExperience: "5+ years",
    currentRole: "Software Engineer",
    email: "demo.candidate@example.com",
    phone: "555-0123",
    resumeText: "This is a simulated resume text for demonstration purposes as the file was imported from a mock SharePoint source.",
    overallMatchScore: Math.floor(Math.random() * 40) + 60, // Random 60-100
    candidateSummary: "This is a generated summary for the SharePoint demo. In a production environment, the file content would be fetched via Microsoft Graph API and analyzed by the AI.",
    skillsAnalysis: [
      { skill: "React", score: 85, reasoning: "Demonstrated strong proficiency in simulated context.", evidence: "Built complex UIs" },
      { skill: "TypeScript", score: 75, reasoning: "Good understanding implied by role.", evidence: "Used in recent projects" },
      { skill: "Cloud Platforms", score: 60, reasoning: "Mentioned but lacks specific details in this mock.", evidence: "Deployed apps" }
    ],
    strengths: ["Quick Learner", "Team Player", "Technical adaptability"],
    weaknesses: ["Mock data lacks depth"],
    recommendation: "Potential Match",
    suitableRoles: ["Frontend Developer", "Full Stack Engineer"],
    technicalSkills: ["JavaScript", "React", "Node.js", "Git"],
    functionalSkills: ["Communication", "Agile"]
  };
};

// --- Main Function ---

export const screenResume = async (
  resume: FileInput,
  jobDescriptionText: string,
  jobDescriptionFile: FileInput | null,
  modelName: string = "gemini-2.5-flash",
  provider: AiProvider = "gemini"
): Promise<ScreeningResult> => {
  
  // DEMO MODE: Handle Mock SharePoint Files
  if (resume.source === 'sharepoint' && resume.base64 === "MOCK_BASE64_CONTENT_FOR_DEMO_ONLY") {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      return generateMockResult(resume.file?.name || "Candidate");
  }

  if (!resume.base64) {
    throw new Error("Resume file content is missing.");
  }

  // Common: Prepare JD Context
  let jdContext = "Job Description Context:\n";
  if (jobDescriptionFile && jobDescriptionFile.base64) {
    if (jobDescriptionFile.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
       const jdText = await extractTextFromDocx(jobDescriptionFile.base64);
       jdContext += jdText;
    } else {
       // For PDF/Txt JD, simple handling
       if (provider === 'gemini') {
          // Gemini can handle PDF context inline
          jdContext += "(See attached Job Description document)";
       } else {
           // OpenAI needs text for JD if it's not an image/text file.
           if (jobDescriptionFile.mimeType === "application/pdf") {
               console.warn("PDF Job Description not fully supported in OpenAI mode without text extraction. Results may be less accurate.");
               jdContext += "(Attached JD is a PDF - Please copy text for better results)";
           } else {
               const decoded = window.atob(jobDescriptionFile.base64);
               jdContext += decoded;
           }
       }
    }
  } else if (jobDescriptionText.trim()) {
    jdContext += jobDescriptionText;
  } else {
    throw new Error("No Job Description provided.");
  }

  return retryOperation(async () => {
    // --- Provider: Gemini ---
    if (provider === "gemini") {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("Gemini API Key missing in environment variables.");
        
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [];

        // Resume Part
        if (resume.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          const extractedText = await extractTextFromDocx(resume.base64!);
          if (!extractedText || extractedText.trim().length === 0) throw new Error("Empty DOCX");
          parts.push({ text: `RESUME TEXT CONTENT:\n${extractedText}` });
        } else {
          parts.push({
            inlineData: { mimeType: resume.mimeType, data: resume.base64! },
          });
        }

        // JD Part (if using inline data for PDF JD)
        if (jobDescriptionFile && jobDescriptionFile.mimeType === "application/pdf") {
            parts.push({
              inlineData: { mimeType: jobDescriptionFile.mimeType, data: jobDescriptionFile.base64 },
            });
        }

        parts.push({ text: getCommonPrompt(jdContext) });

        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.1, 
          },
        });

        const text = response.text;
        if (!text) throw new Error("Empty response from Gemini");
        return JSON.parse(text) as ScreeningResult;
    }

    // --- Provider: OpenAI ---
    if (provider === "openai") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OpenAI API Key missing. Please configure OPENAI_API_KEY in backend/environment variables.");

        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        let resumeTextContent = "";

        // OpenAI Text Extraction
        if (resume.mimeType === "application/pdf") {
            throw new Error("OpenAI mode currently supports DOCX and Text files only. Please use Gemini for PDF resumes.");
        } else if (resume.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            resumeTextContent = await extractTextFromDocx(resume.base64!);
        } else {
            // Plain text / Markdown
            resumeTextContent = window.atob(resume.base64!);
        }

        if (!resumeTextContent.trim()) throw new Error("Could not extract text from resume for OpenAI processing.");

        // OpenAI Prompt Construction
        // We append a JSON skeleton example to ensure the "json_object" mode respects our TypeScript interface
        const jsonStructurePrompt = `
        IMPORTANT: Your response MUST be valid JSON adhering exactly to this structure:
        {
          "candidateName": "string",
          "candidateLocation": "string",
          "candidateExperience": "string",
          "currentRole": "string",
          "email": "string",
          "phone": "string",
          "resumeText": "string",
          "overallMatchScore": 0,
          "candidateSummary": "string",
          "skillsAnalysis": [{ "skill": "string", "score": 0, "reasoning": "string", "evidence": "string" }],
          "strengths": ["string"],
          "weaknesses": ["string"],
          "recommendation": "Strong Match" | "Potential Match" | "Weak Match" | "Not a Match",
          "suitableRoles": ["string"],
          "technicalSkills": ["string"],
          "functionalSkills": ["string"]
        }
        `;

        const systemMessage = getCommonPrompt(jdContext) + "\n\n" + jsonStructurePrompt;
        
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: `Here is the resume content:\n\n${resumeTextContent}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No response from OpenAI");
        
        return JSON.parse(content) as ScreeningResult;
    }

    throw new Error(`Unsupported provider: ${provider}`);
  });
};
