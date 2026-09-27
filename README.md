# AI/RAG Technical Interview System

A grounded AI technical interview platform designed for candidate screening. The system dynamically extracts candidate profiles from PDF resumes, retrieves domain-specific question context via Chroma vector search, generates personalized technical questions, evaluates text and voice responses in real time, and persists final assessment scorecards.

---

## Architecture

```text
React Frontend (Vite + TypeScript)
       │ (HTTP / JSON / Base64 Audio)
       ▼
Python Backend Server (server.py - port 5000)
       │
       ├─► PyPDFLoader & LLM Profile Extractor (main.py)
       │
       ├─► ChromaDB Vector Store + BGE Embeddings (main.py)
       │     └─► Domain Metadata Filtering (Software, AI, Mechanical)
       │
       ├─► Groq LLM (openai/gpt-oss-120b)
       │     ├─► 2 Unscored Icebreakers (Resume-grounded)
       │     ├─► 5 Scored Technical Questions (RAG-retrieved)
       │     └─► Real-Time Turn & Final Report Evaluation
       │
       ├─► Groq Whisper API (whisper-large-v3-turbo)
       │     └─► Voice Answer Speech-to-Text Transcription
       │
       └─► Local Persistence Engine (interview_result.json)
```

---

## Technology Stack

- **Frontend:**
  - React 18
  - TypeScript
  - Vite
  - Tailwind CSS
  - Lucide React (Icons)
  - Web Speech API (Native Speech Synthesis)
  - MediaRecorder API (Audio Capture)
- **Backend:**
  - Python 3.10+
  - Python Standard Library HTTP Server (`http.server`)
  - LangChain
  - Chroma Vector Database (`chromadb`)
  - BAAI/bge-small-en-v1.5 Local Embeddings (`sentence-transformers` / HuggingFace)
  - Groq Cloud API:
    - LLM: `openai/gpt-oss-120b`
    - Audio STT: `whisper-large-v3-turbo`
  - PyPDFLoader (`pypdf` / `langchain-community`)

---

## Features

- **Resume Parsing:** Upload PDF candidate resumes and extract structured profiles without hallucinating unlisted qualifications.
- **Candidate Profiling:** Automatically extracts candidate name, education, skills, projects, and domain specialization.
- **RAG Technical Question Generation:** Queries Chroma vector database with domain filtering and local BGE embeddings to generate grounded interview questions.
- **Manual Question Mode:** Allows interview boards to inject custom technical questions with automated JD and resume match analysis.
- **Structured 7-Question Viva:**
  - **2 Icebreakers:** Resume-grounded, evaluated separately for clarity and communication, excluded from technical score.
  - **5 Technical Questions:** Core engineering topics, evaluated and scored to determine the technical screening grade.
- **Automatic Question Speech:** Every active interview question is automatically spoken aloud via browser-native Speech Synthesis (no user configuration required).
- **Dual Response Modality:**
  - **Text Answers:** Interactive candidate terminal with live character count.
  - **Voice Answers:** In-browser audio recording with real-time waveform visualization.
- **Groq Whisper Transcription:** High-accuracy speech-to-text audio transcription for spoken answers.
- **Real-Time Evaluation:** Immediate per-turn scoring, constructive critique, and strengths/weaknesses identification.
- **Technical Screening Report:** High-level institutional screening dossier providing executive summary, core technical competencies breakdown, identified strengths, areas for technical growth, board recommendations, and printable PDF export.
- **Result Persistence:** Every interview and cancellation is recorded directly to `interview_result.json`.

---

## Project Structure

```text
DRDO_Project/
├── server.py               # Main Python HTTP backend server & API endpoints
├── main.py                 # RAG pipeline, Chroma indexing, Groq LLM logic
├── interview.py            # Interview session flow and report generation
├── voice_interview.py      # Audio processing and Groq Whisper client
├── test_integration.py     # Automated 9-test E2E integration verification suite
├── Sample_Files/           # Sample test resumes (PDF)
│   └── DRDO_Sample_Resume_1.pdf
├── Frontend/               # React + TypeScript + Vite web client
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoadingOverlay.tsx       # Unified centered blocking loader
│   │   │   └── WaveformVisualizer.tsx   # Live audio recording visualizer
│   │   ├── context/
│   │   │   └── SessionContext.tsx       # Global interview state provider
│   │   ├── pages/
│   │   │   ├── HomePage.tsx             # Resume upload and dossier intake
│   │   │   ├── SetupPage.tsx            # Viva configuration & JD selection
│   │   │   ├── InterviewPage.tsx        # Live viva terminal with auto-speech
│   │   │   └── ResultsPage.tsx          # High-level Technical Screening Report
│   │   ├── services/
│   │   │   └── api.ts                   # Backend API client integration
│   │   ├── types.ts                     # Strict TypeScript interfaces
│   │   ├── App.tsx                      # Application routing & layout
│   │   ├── main.tsx                     # React DOM entry point
│   │   └── index.css                    # DRDO institutional theme styles
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

---

## Backend Setup

1. **Activate Virtual Environment:**
   Ensure Python dependencies and environment variables (including `GROQ_API_KEY`) are configured in `.env`.

2. **Start Backend Server:**
   ```powershell
   .\.venv\Scripts\python.exe server.py
   ```
   The backend server will initialize ChromaDB, load local BGE embeddings, and start listening on `http://127.0.0.1:5000`.

---

## Frontend Setup

1. **Install Dependencies:**
   ```powershell
   cd Frontend
   npm install
   ```

2. **Start Development Server:**
   ```powershell
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Verification & Testing

### Frontend Code Quality
Run all static analysis and bundle verification checks from the `Frontend` directory:

```powershell
cd Frontend
npm run typecheck
npm run lint
npm run build
```

### Backend E2E Integration Suite
Verify all backend endpoints, Chroma RAG retrieval, question counts, and scoring persistence:

```powershell
.\.venv\Scripts\python.exe test_integration.py
```
