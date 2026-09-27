/**
 * RAC Defence Tech API Service
 * Connects directly to the real Python DRDO RAG Technical Interview Backend (http://localhost:5000/api).
 * No mock data or fake evaluations.
 */

import type {
  ExtractedCandidateProfile,
  FinalReportData,
  InterviewResultDoc,
  QuitInterviewResponse,
  QuestionEvaluation,
  InterviewResultItem,
} from '../types';


const API_BASE_URL = 'http://localhost:5000/api';

type TransmissionListener = (status: string | null) => void;
const transmissionListeners = new Set<TransmissionListener>();

function notifyTransmission(status: string | null) {
  transmissionListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (e) {
      console.error('Error in transmission listener:', e);
    }
  });
}

export function subscribeTransmissionStatus(listener: TransmissionListener): () => void {
  transmissionListeners.add(listener);
  return () => {
    transmissionListeners.delete(listener);
  };
}

export interface ParsedResumeResponse {
  success: boolean;
  candidate: string;
  role: string;
  skills: string[];
  fileName: string;
  fileSize: string;
  confidence?: number;
  profile?: ExtractedCandidateProfile;
}


export type { QuestionEvaluation, InterviewResultItem };


export interface AssessmentReportData {
  candidate: string;
  role: string;
  status: 'completed' | 'cancelled';
  questions_attempted: number;
  total_questions: number;
  evaluation: {
    overall_score: number; // /10
    resume_relevance: number; // /10
    clarity: number; // /10
    communication: number; // /10
    authenticity_consistency: number; // /10
  };
  interview_results: InterviewResultItem[];
  final_report?: FinalReportData;
}

export interface QuestionItem {
  question_number: number;
  question: string;
  source: 'ai' | 'manual';
  question_type: 'icebreaker' | 'technical';
  scored: boolean;
  jd_match?: number;
  resume_match?: number;
  difficulty?: string;
  difficulty_score?: number;
  topic?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const b64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(b64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * 1. Parse Resume PDF via Real Python Backend
 */
export async function parseResumeApi(file: File): Promise<ParsedResumeResponse> {
  notifyTransmission('TRANSMITTING TO REAL PYTHON RAG BACKEND...');

  try {
    const base64Data = await fileToBase64(file);

    const res = await fetch(`${API_BASE_URL}/parse-resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        fileData: base64Data,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${res.status}`);
    }

    const data: ParsedResumeResponse = await res.json();
    return data;
  } finally {
    notifyTransmission(null);
  }
}

/**
 * 2. Initialize Interview & Generate 7 Questions (2 Icebreakers + 5 Technical)
 */
export async function initInterviewApi(payload: {
  candidateName: string;
  role: string;
  jd?: string;
  questionSource: 'ai' | 'manual';
  answerMethod: 'voice' | 'text';
  manualQuestions?: string[];
}): Promise<{
  success: boolean;
  sessionId: string;
  candidate: string;
  role: string;
  total_questions: number;
  questions: QuestionItem[];
  questions_text: string[];
}> {
  notifyTransmission('GENERATING GROUNDED RAG INTERVIEW QUESTIONS...');

  try {
    const res = await fetch(`${API_BASE_URL}/interview/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Interview init failed with status ${res.status}`);
    }

    return await res.json();
  } finally {
    notifyTransmission(null);
  }
}

/**
 * 3. Fetch Questions (Alias / Compatibility)
 */
export async function fetchQuestionsApi(role: string, count: number): Promise<string[]> {
  notifyTransmission('FETCHING QUESTIONS FROM RAG SYSTEM...');

  try {
    const res = await fetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, count }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions;
      }
    }
    throw new Error(`Failed to fetch questions from backend`);
  } finally {
    notifyTransmission(null);
  }
}

/**
 * 4. Transcribe Voice Audio via Groq Whisper API
 */
export async function transcribeVoiceApi(audioBlob: Blob): Promise<string> {
  notifyTransmission('TRANSCRIBING AUDIO VIA GROQ WHISPER...');

  try {
    const base64Data = await fileToBase64(audioBlob);

    const res = await fetch(`${API_BASE_URL}/voice/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData: base64Data }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Audio transcription failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.text || '';
  } finally {
    notifyTransmission(null);
  }
}

/**
 * 5. Submit Individual Answer for Immediate Real-Time Evaluation
 */
export async function submitAnswerApi(payload: {
  questionIndex: number;
  text: string;
  voiceDuration?: number;
}): Promise<{
  success: boolean;
  question_number: number;
  evaluation: QuestionEvaluation;
  result_item: InterviewResultItem;
}> {
  notifyTransmission('EVALUATING ANSWER WITH GROQ LLM...');

  try {
    const res = await fetch(`${API_BASE_URL}/interview/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Answer submission failed with status ${res.status}`);
    }

    return await res.json();
  } finally {
    notifyTransmission(null);
  }
}

/**
 * 6. Quit / Cancel Interview Early
 */
export async function quitInterviewApi(): Promise<QuitInterviewResponse> {
  notifyTransmission('TERMINATING INTERVIEW SESSION...');

  try {
    const res = await fetch(`${API_BASE_URL}/interview/quit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'user_quit' }),
    });

    if (!res.ok) {
      throw new Error(`Quit request failed with status ${res.status}`);
    }

    return await res.json();
  } finally {
    notifyTransmission(null);
  }
}

/**
 * 7. Conclude Interview & Obtain Official Scorecard
 */
export async function evaluateInterviewApi(payload: {
  candidate: string;
  role: string;
  questions: string[];
  answers: { text: string; voiceDuration?: number }[];
}): Promise<AssessmentReportData> {
  notifyTransmission('GENERATING OFFICIAL DRDO RAC SCORECARD...');

  try {
    const res = await fetch(`${API_BASE_URL}/evaluate-interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Evaluation endpoint failed with status ${res.status}`);
    }

    const data: AssessmentReportData = await res.json();
    return data;
  } finally {
    notifyTransmission(null);
  }
}

/**
 * 8. Retrieve Stored Interview Result
 */
export async function getInterviewResultApi(): Promise<InterviewResultDoc> {
  notifyTransmission('RETRIEVING STORED EVALUATION DOSSIER...');

  try {
    const res = await fetch(`${API_BASE_URL}/interview/result`);
    if (!res.ok) {
      throw new Error(`Could not fetch interview result`);
    }
    return await res.json();
  } finally {
    notifyTransmission(null);
  }
}

/**
 * 9. Analyze Manual Question Against Resume and Job Description
 */
export async function analyzeManualQuestionApi(payload: {
  question: string;
  jd?: string;
}): Promise<{
  success: boolean;
  analysis: {
    topic: string;
    difficulty: string;
    jd_match: number;
    resume_match: number;
    feedback: string;
  };
}> {
  notifyTransmission('ANALYZING MANUAL QUESTION RELEVANCE...');

  try {
    const res = await fetch(`${API_BASE_URL}/manual-questions/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Question analysis failed with status ${res.status}`);
    }

    return await res.json();
  } finally {
    notifyTransmission(null);
  }
}

