export type ViewMode = 'board' | 'candidate';

export const DEFAULT_JD = `# Software & Systems Engineer
Organization: Defence Research & Technology Division
Role: Software & Systems Engineer
Experience: 0–3 years

Required Skills:
- Python
- C++
- Data Structures and Algorithms
- Object-Oriented Programming
- SQL
- Linux
- Git
- Debugging

Preferred Skills:
- Multithreading
- Distributed Systems
- Docker
- REST APIs
- Simulation
- Telemetry`;

export const ROLES = [
  'Software & Systems Engineer',
  'Data & AI Engineer',
  'Mechanical Systems Engineer',
  'Radar Signal Processing Engineer',
  'Avionics Systems Engineer',
  'Cyber Defense Engineer',
];

export interface QuestionEvaluation {
  strengths: string[];
  weaknesses: string[];
  feedback: string;
  overall_score?: number;
  relevance?: number;
  technical_correctness?: number;
  completeness?: number;
  depth?: number;
  clarity?: number;
  resume_relevance?: number;
  communication?: number;
  authenticity_consistency?: number;
}

export interface InterviewResultItem {
  question_number: number;
  question_type: string;
  scored: boolean;
  question: string;
  answer: string;
  evaluation: QuestionEvaluation;
  source?: string;
  voice_duration?: number;
}

export interface ExtractedCandidateProfile {
  name?: string;
  education?: Array<string | Record<string, unknown>>;
  experience?: Array<string | Record<string, unknown>>;
  skills?: string[];
  projects?: Array<string | Record<string, unknown>>;
  certifications?: string[];
  background_summary?: string;
  [key: string]: unknown;
}

export interface FinalReportData {
  overall_score?: number;
  technical_score?: number;
  problem_solving?: number;
  communication?: number;
  answer_relevance?: number;
  technical_knowledge?: number;
  icebreaker_evaluation?: Record<string, QuestionEvaluation>;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  summary?: string;
  [key: string]: unknown;
}

export interface InterviewResultDoc {
  candidate: string;
  role: string;
  status: 'completed' | 'cancelled';
  questions_attempted: number;
  interview_results: InterviewResultItem[];
  final_report?: FinalReportData | null;
  [key: string]: unknown;
}

export interface QuitInterviewResponse {
  success: boolean;
  status: 'cancelled';
  result: InterviewResultDoc;
}
