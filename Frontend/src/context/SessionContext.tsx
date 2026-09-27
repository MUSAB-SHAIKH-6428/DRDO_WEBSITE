import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AssessmentReportData, QuestionItem, QuestionEvaluation } from '../services/api';
import { DEFAULT_JD, type ExtractedCandidateProfile } from '../types';

/* ── Resume ── */
export interface ResumeData {
  fileName: string;
  fileSize: string;
  candidateName: string;
  discipline: string;
  skills: string[];
  parsed: boolean;
  profile?: ExtractedCandidateProfile;
}

/* ── Setup Config ── */
export interface SetupConfig {
  candidateName: string;
  role: string;
  jd: string;
  questionSource: 'ai' | 'manual';
  answerMethod: 'voice' | 'text';
  questionCount: number;
  manualQuestions: string[];
}

/* ── Per-question answer record ── */
export interface AnswerRecord {
  text: string;
  submitted: boolean;
  voiceDuration?: number;
  score: number;
  technicalAccuracy: number;
  depthScore: number;
  aiFeedback: string;
  evaluation?: QuestionEvaluation;
}


interface SessionContextValue {
  resume: ResumeData | null;
  setResume: (r: ResumeData | null) => void;
  config: SetupConfig;
  setConfig: (c: SetupConfig) => void;
  questions: string[];
  setQuestions: (q: string[]) => void;
  questionObjects: QuestionItem[];
  setQuestionObjects: (q: QuestionItem[]) => void;
  answers: AnswerRecord[];
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
  submitAnswer: (idx: number, text: string, voiceDuration?: number, evalData?: QuestionEvaluation) => void;
  clearAnswer: (idx: number) => void;
  injectJudgeQuestion: (questionText: string) => void;
  broadcastJudgeQuestion: (questionText: string) => void;
  initSession: () => void;
  resetSession: () => void;
  evaluationReport: AssessmentReportData | null;
  setEvaluationReport: (report: AssessmentReportData | null) => void;
}

const defaultConfig: SetupConfig = {
  candidateName: '',
  role: 'Software & Systems Engineer',
  jd: DEFAULT_JD,
  questionSource: 'ai',
  answerMethod: 'text',
  questionCount: 7, 
  manualQuestions: [
    'How do you manage race conditions and thread safety in shared memory architectures?',
    'Explain the design of a zero-copy circular ring buffer for real-time telemetry.',
    'What are the memory layout differences between stack and heap in C++ applications?',
    'How would you validate high-assurance embedded firmware against buffer overflows?',
    'Describe your methodology for optimizing latency-critical network socket communication.',
  ],
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [config, setConfig] = useState<SetupConfig>(defaultConfig);
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionObjects, setQuestionObjects] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [evaluationReport, setEvaluationReport] = useState<AssessmentReportData | null>(null);

  const initSession = useCallback(() => {
    // Session initialization logic; real questions are loaded via initInterviewApi
    setCurrentIndex(0);
  }, []);

  const submitAnswer = useCallback(
    (idx: number, text: string, voiceDuration?: number, evalData?: QuestionEvaluation) => {
      setAnswers((prev) => {
        const next = [...prev];
        const overallScore = evalData?.overall_score ? Math.round(evalData.overall_score * 10) : 80;
        const techScore = evalData?.technical_correctness ? Math.round(evalData.technical_correctness * 10) : overallScore;
        const depth = evalData?.depth ? Math.round(evalData.depth * 10) : overallScore;
        const feedback = evalData?.feedback || 'Answer recorded for final board evaluation.';

        next[idx] = {
          text,
          submitted: true,
          voiceDuration,
          score: overallScore,
          technicalAccuracy: techScore,
          depthScore: depth,
          aiFeedback: feedback,
          evaluation: evalData,
        };
        return next;
      });
    },
    [],
  );

  const clearAnswer = useCallback((idx: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = {
        text: '',
        submitted: false,
        score: 0,
        technicalAccuracy: 0,
        depthScore: 0,
        aiFeedback: '',
      };
      return next;
    });
  }, []);

  const injectJudgeQuestion = useCallback((questionText: string) => {
    if (!questionText.trim()) return;
    setQuestions((prev) => {
      const updated = [...prev];
      updated[currentIndex] = questionText.trim();
      return updated;
    });
    setQuestionObjects((prev) => {
      const updated = [...prev];
      if (updated[currentIndex]) {
        updated[currentIndex] = {
          ...updated[currentIndex],
          question: questionText.trim(),
        };
      }
      return updated;
    });
  }, [currentIndex]);

  const resetSession = useCallback(() => {
    setResume(null);
    setConfig(defaultConfig);
    setQuestions([]);
    setQuestionObjects([]);
    setAnswers([]);
    setCurrentIndex(0);
    setEvaluationReport(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        resume,
        setResume,
        config,
        setConfig,
        questions,
        setQuestions,
        questionObjects,
        setQuestionObjects,
        answers,
        currentIndex,
        setCurrentIndex,
        submitAnswer,
        clearAnswer,
        injectJudgeQuestion,
        broadcastJudgeQuestion: injectJudgeQuestion,
        initSession,
        resetSession,
        evaluationReport,
        setEvaluationReport,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

