import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Upload,
  FileText,
  CheckCircle2,
  ArrowRight,
  Cpu,
  FileCheck,
  Activity,
} from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { parseResumeApi } from '../services/api';

export default function HomePage() {
  const navigate = useNavigate();
  const { resume, setResume, config, setConfig } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      alert("CRITICAL ERROR: Only .pdf files are accepted by RAC. All other formats (.txt, .docx, .doc) are strictly blocked.");
      setFileError("CRITICAL ERROR: Only .pdf files are accepted by RAC. All other formats (.txt, .docx, .doc) are strictly blocked.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('FILE EXCEEDED: DOSSIER SIZE CANNOT EXCEED 10MB');
      return;
    }
    setFileError(null);
    setParsing(true);

    parseResumeApi(file)
      .then((parsedResp) => {
        const data = {
          fileName: file.name,
          fileSize: parsedResp.fileSize,
          candidateName: parsedResp.candidate,
          discipline: parsedResp.role,
          skills: parsedResp.skills,
          parsed: true,
          profile: parsedResp.profile,
        };
        setResume(data);
        setConfig({
          ...config,
          candidateName: parsedResp.candidate,
          role: parsedResp.role,
        });
      })
      .catch((err) => {
        console.error('Resume parse error from backend:', err);
        setFileError(err.message || 'Failed to extract candidate profile from resume PDF.');
      })
      .finally(() => {
        setParsing(false);
      });
  }, [config, setConfig, setResume]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      alert("CRITICAL ERROR: Only .pdf files are accepted by RAC. All other formats (.txt, .docx, .doc) are strictly blocked.");
      setFileError("CRITICAL ERROR: Only .pdf files are accepted by RAC. All other formats (.txt, .docx, .doc) are strictly blocked.");
      return;
    }
    processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        alert("CRITICAL ERROR: Only .pdf files are accepted by RAC. All other formats (.txt, .docx, .doc) are strictly blocked.");
        setFileError("CRITICAL ERROR: Only .pdf files are accepted by RAC. All other formats (.txt, .docx, .doc) are strictly blocked.");
        return;
      }
      processFile(file);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* National Tricolour Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0" />

      {/* Official DRDO RAC Header */}
      <header className="border-b border-slate-200 bg-white shadow-xs px-5 py-3 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-drdo-50 border border-drdo-200 text-drdo shadow-xs">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-slate-900">
                  RECRUITMENT &amp; ASSESSMENT CENTRE (RAC)
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-drdo-50 text-drdo border border-drdo-200">
                  DRDO
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Defence Research &amp; Development Organisation • Ministry of Defence, Govt. of India
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Assessment Portal Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Single Centered Vertical Column */}
      <main className="max-w-4xl mx-auto flex flex-col space-y-6 pb-12 w-full px-4 sm:px-6 pt-6 flex-1">

        {/* ─── CANDIDATE DOSSIER & RESUME INTAKE ─── */}
        <section className="institutional-card p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-drdo" />
              <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                Candidate Dossier &amp; Resume Intake
              </h2>
            </div>
            <span className="badge-drdo">Required</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Upload candidate curriculum vitae or technical research dossier (PDF format, max 10MB). Domain competencies and credentials are extracted to calibrate technical assessment questions.
          </p>

          {/* Error banner if rejected */}
          {fileError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
              <span>⚠️ {fileError}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFileError(null);
                }}
                className="text-red-500 hover:text-red-700 text-xs ml-2 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Clean Institutional Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              dragActive
                ? 'border-drdo bg-drdo-50/50'
                : fileError
                  ? 'border-red-300 bg-red-50/30'
                  : resume?.parsed
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-slate-300 bg-slate-50/50 hover:border-drdo hover:bg-drdo-50/20'
            }`}
          >
            {parsing ? (
              <div className="flex flex-col items-center gap-3 py-3">
                <Cpu className="w-8 h-8 text-drdo animate-spin" />
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Extracting Candidate Profile via NLP...
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Analyzing domain competencies and qualifications from resume
                  </p>
                </div>
                <div className="w-56 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-drdo rounded-full animate-pulse" style={{ width: '85%' }} />
                </div>
              </div>
            ) : resume?.parsed ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-900">Dossier Successfully Ingested &amp; Indexed</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-700 shadow-xs">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium">{resume.fileName}</span>
                  <span className="text-slate-400">({resume.fileSize})</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="w-12 h-12 rounded-lg bg-drdo-50 border border-drdo-200 flex items-center justify-center mb-1 text-drdo">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Upload Candidate Dossier (PDF Only - Max 10MB)
                </p>
                <p className="text-[11px] text-slate-500">
                  Drag and drop your file here, or click to browse files
                </p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Dynamic Extracted Preview Pills & Quick Fields */}
          {resume?.parsed && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium">Identified Technical Competencies</span>
                <span className="text-emerald-700 font-semibold">Indexed</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {resume.skills.map((skill) => (
                  <span key={skill} className="badge-drdo">
                    {skill}
                  </span>
                ))}
              </div>

              {/* Quick Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">CANDIDATE NAME</label>
                  <input
                    type="text"
                    value={config.candidateName}
                    onChange={(e) => setConfig({ ...config, candidateName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-drdo focus:ring-1 focus:ring-drdo focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">DETECTED DISCIPLINE / ROLE</label>
                  <input
                    type="text"
                    value={config.role}
                    onChange={(e) => setConfig({ ...config, role: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-drdo focus:ring-1 focus:ring-drdo focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ─── SYSTEM STATUS & LAUNCH ─── */}
        <section className="institutional-card p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-drdo" />
              <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                System Status &amp; Launch
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ready for Assessment</span>
            </div>
          </div>

          {/* 2 Status Indicators in Clean Grid (Anti-cheating card removed) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">AI Evaluation Engine</div>
                <div className="text-[11px] text-slate-500">Chroma RAG &amp; LLM Service</div>
              </div>
              <span className="badge-emerald">Online</span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">Speech-to-Text Engine</div>
                <div className="text-[11px] text-slate-500">Groq Whisper Transcription</div>
              </div>
              <span className="badge-drdo">Ready</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed text-center max-w-xl mx-auto">
            Proceed to configure interview parameters, question rubrics, and launch the candidate technical evaluation terminal.
          </p>

          {/* Prominent Primary Launch Button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={() => navigate('/setup')}
              className="btn-institutional-primary py-3 px-8 text-xs min-w-[280px]"
            >
              <span>Proceed to Interview Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-3.5 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>Recruitment &amp; Assessment Centre (RAC) • Defence Research &amp; Development Organisation, New Delhi</span>
          <span>Technical Assessment Portal</span>
        </div>
      </footer>
    </div>
  );
}
