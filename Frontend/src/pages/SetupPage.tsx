import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  FileText,
  Sparkles,
  Edit3,
  Sliders,
} from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { ROLES, DEFAULT_JD } from '../types';
import { initInterviewApi } from '../services/api';

export default function SetupPage() {
  const navigate = useNavigate();
  const { config, setConfig, setQuestions, setQuestionObjects } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJdEditor, setShowJdEditor] = useState(false);

  const update = <K extends keyof typeof config>(key: K, value: (typeof config)[K]) => {
    setConfig({ ...config, [key]: value });
  };

  const handleManualQuestionChange = (index: number, val: string) => {
    const updated = [...config.manualQuestions];
    updated[index] = val;
    setConfig({ ...config, manualQuestions: updated });
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await initInterviewApi({
        candidateName: config.candidateName || 'Candidate',
        role: config.role,
        jd: config.jd || DEFAULT_JD,
        questionSource: config.questionSource,
        answerMethod: config.answerMethod,
        manualQuestions: config.questionSource === 'manual' ? config.manualQuestions : undefined,
      });

      if (response.success && response.questions && response.questions.length > 0) {
        setQuestions(response.questions_text);
        setQuestionObjects(response.questions);
        navigate('/interview');
      } else {
        throw new Error('No interview questions returned by backend.');
      }
    } catch (err: unknown) {
      console.error('Failed to initialize interview:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to initialize interview with real Python backend.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* National Tricolour Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0" />

      {/* Official DRDO Header */}
      <header className="border-b border-slate-200 bg-white shadow-xs px-5 py-3 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-drdo-50 border border-drdo-200 text-drdo shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900">
                RECRUITMENT &amp; ASSESSMENT CENTRE (RAC)
              </div>
              <div className="text-xs text-slate-500">
                DRDO Candidate Assessment Configuration
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="badge-drdo">Configuration Stage</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="institutional-card overflow-hidden">

          {/* Title Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="text-xs text-slate-600 hover:text-drdo flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home Portal
            </button>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-drdo" />
              <h1 className="text-xs font-bold tracking-wider text-slate-900 uppercase">
                Interview Setup Configuration
              </h1>
            </div>
            <span className="badge-slate text-[11px]">Step 2 of 3</span>
          </div>

          {/* Form */}
          <form onSubmit={handleStart} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Candidate Name Identifier */}
            <div className="p-3.5 rounded-lg bg-drdo-50/60 border border-drdo-200">
              <span className="text-[11px] font-semibold text-drdo uppercase tracking-wider block mb-0.5">
                Candidate Profile
              </span>
              <div className="text-slate-900 text-sm font-semibold">
                {config.candidateName || 'Candidate Extracted from Resume'}
              </div>
            </div>

            {/* Role Dropdown */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5 uppercase tracking-wide">
                Target Role / Applied Discipline
              </label>
              <select
                value={config.role}
                onChange={(e) => update('role', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-drdo focus:ring-1 focus:ring-drdo transition-all cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Job Description (Collapsible / Editable) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-drdo" />
                  Job Specification &amp; Assessment Criteria
                </span>
                <button
                  type="button"
                  onClick={() => setShowJdEditor(!showJdEditor)}
                  className="text-xs text-drdo hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {showJdEditor ? 'Hide Editor' : 'Customize JD'}
                </button>
              </div>

              {showJdEditor ? (
                <textarea
                  rows={6}
                  value={config.jd}
                  onChange={(e) => update('jd', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-drdo"
                  placeholder="Paste role requirements and evaluation criteria..."
                />
              ) : (
                <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 max-h-24 overflow-y-auto leading-relaxed">
                  {config.jd.slice(0, 240)}...
                </div>
              )}
            </div>

            {/* Question Source Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2 uppercase tracking-wide">
                Technical Question Source
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup">
                {[
                  {
                    id: 'ai',
                    label: 'AI Generated (Chroma RAG)',
                    desc: '2 Icebreakers + 5 Domain Technical Questions',
                  },
                  {
                    id: 'manual',
                    label: 'Manual Questions',
                    desc: '2 Icebreakers + 5 Board Provided Questions',
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                      config.questionSource === item.id
                        ? 'border-drdo bg-drdo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="questionSource"
                      value={item.id}
                      checked={config.questionSource === item.id}
                      onChange={() => update('questionSource', item.id as 'ai' | 'manual')}
                      className="hidden"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        config.questionSource === item.id ? 'border-drdo' : 'border-slate-300'
                      }`}
                    >
                      {config.questionSource === item.id && <div className="w-2 h-2 rounded-full bg-drdo" />}
                    </div>
                    <div>
                      <div className={`text-xs font-semibold ${config.questionSource === item.id ? 'text-drdo' : 'text-slate-900'}`}>
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Manual Questions Input (Rendered when Manual source is chosen) */}
            {config.questionSource === 'manual' && (
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide block">
                  Enter 5 Technical Questions
                </span>
                {config.manualQuestions.map((q, idx) => (
                  <div key={idx} className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">
                      Technical Question {idx + 1}
                    </label>
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => handleManualQuestionChange(idx, e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-drdo"
                      required
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Answer Method: Single-select Radio Group */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2 uppercase tracking-wide">
                Answer Input Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup">
                {[
                  { id: 'text', label: 'Text Input', desc: 'Direct written response & technical rationale' },
                  { id: 'voice', label: 'Voice (Groq Whisper)', desc: 'Microphone recording & automatic transcription' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                      config.answerMethod === item.id
                        ? 'border-drdo bg-drdo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="answerMethod"
                      value={item.id}
                      checked={config.answerMethod === item.id}
                      onChange={() => update('answerMethod', item.id as 'voice' | 'text')}
                      className="hidden"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        config.answerMethod === item.id ? 'border-drdo' : 'border-slate-300'
                      }`}
                    >
                      {config.answerMethod === item.id && <div className="w-2 h-2 rounded-full bg-drdo" />}
                    </div>
                    <div>
                      <div className={`text-xs font-semibold ${config.answerMethod === item.id ? 'text-drdo' : 'text-slate-900'}`}>
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Protocol Notice */}
            <div className="p-3.5 rounded-lg bg-drdo-50/60 border border-drdo-200 text-xs text-slate-700 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-drdo shrink-0" />
              <span>
                Assessment structure: <strong>2 Icebreakers (Unscored for technical)</strong> + <strong>5 Technical Questions (Scored)</strong>. Total 7 questions.
              </span>
            </div>

            {/* Start Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-institutional-primary py-3 text-xs tracking-wider"
            >
              <span>{loading ? 'Initializing Assessment Engine...' : 'Start Technical Interview'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-3.5 mt-auto">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-slate-500">
          <span>Recruitment &amp; Assessment Centre (RAC) • DRDO, New Delhi</span>
          <span>Technical Assessment Portal</span>
        </div>
      </footer>
    </div>
  );
}
