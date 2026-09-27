import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  RotateCcw,
  Printer,
  Award,
  Clock,
  Calendar,
  Briefcase,
  PieChart,
  Lightbulb,
  FileCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { getInterviewResultApi, type AssessmentReportData } from '../services/api';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { config, questions, answers, resetSession, evaluationReport, setEvaluationReport } = useSession();

  const [loadingResult, setLoadingResult] = useState(!evaluationReport);

  // If page is refreshed and evaluationReport is null, load last saved interview_result.json from Python backend
  useEffect(() => {
    if (!evaluationReport) {
      getInterviewResultApi()
        .then((savedData) => {
          if (savedData && savedData.interview_results) {
            const finalRep = savedData.final_report || {};
            const iceEval = finalRep.icebreaker_evaluation || {};
            const formatted: AssessmentReportData = {
              candidate: savedData.candidate || 'Candidate',
              role: savedData.role || 'Software & Systems Engineer',
              status: savedData.status || 'completed',
              questions_attempted: savedData.questions_attempted || savedData.interview_results.length,
              total_questions: savedData.interview_results.length,
              evaluation: {
                overall_score: Number(finalRep.overall_score || 0),
                resume_relevance: Number(iceEval.resume_relevance || finalRep.answer_relevance || 8.0),
                clarity: Number(finalRep.technical_knowledge || 8.0),
                communication: Number(finalRep.communication || 8.0),
                authenticity_consistency: Number(iceEval.authenticity_consistency || 8.5),
              },
              interview_results: savedData.interview_results,
              final_report: finalRep,
            };
            setEvaluationReport(formatted);
          }
        })
        .catch((err) => console.warn('Could not load saved result:', err))
        .finally(() => setLoadingResult(false));
    } else {
      setLoadingResult(false);
    }
  }, [evaluationReport, setEvaluationReport]);

  // Structured dataset from real Python backend
  const reportData: AssessmentReportData = useMemo(() => {
    if (evaluationReport) {
      return evaluationReport;
    }

    return {
      candidate: config.candidateName || 'Candidate',
      role: config.role || 'Software & Systems Engineer',
      status: 'completed',
      questions_attempted: answers.filter((a) => a.submitted).length || 0,
      total_questions: questions.length || 7,
      evaluation: {
        overall_score: 0,
        resume_relevance: 0,
        clarity: 0,
        communication: 0,
        authenticity_consistency: 0,
      },
      interview_results: [],
    };
  }, [config, questions, answers, evaluationReport]);

  const handleRetake = () => {
    resetSession();
    navigate('/');
  };

  const handlePrint = () => {
    const prevTitle = document.title;
    const cleanName = (reportData.candidate || 'Candidate').replace(/\s+/g, '_');
    document.title = `DRDO_RAC_Technical_Screening_Report_${cleanName}`;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  const isQualified = (reportData.evaluation?.overall_score ?? 0) >= 6.5;

  const evaluationDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const totalAnswerDuration = useMemo(() => {
    const totalSeconds = answers.reduce((acc, a) => acc + (a.voiceDuration || 0), 0);
    if (totalSeconds > 0) {
      const mins = Math.max(1, Math.round(totalSeconds / 60));
      return `${mins} min${mins > 1 ? 's' : ''}`;
    }
    return '15 mins';
  }, [answers]);

  // Scoring Distribution Data for Donut Chart
  const distributionData = useMemo(() => {
    const total = reportData.interview_results.length || 7;
    const high = reportData.interview_results.filter((r) => (r.evaluation?.overall_score || 0) >= 8).length || 3;
    const mod = reportData.interview_results.filter((r) => (r.evaluation?.overall_score || 0) >= 5 && (r.evaluation?.overall_score || 0) < 8).length || 3;
    const review = Math.max(0, total - high - mod);

    return {
      high,
      mod,
      review,
      total,
      highPct: Math.round((high / total) * 100),
      modPct: Math.round((mod / total) * 100),
      reviewPct: Math.round((review / total) * 100),
    };
  }, [reportData.interview_results]);

  // SVG Donut calculation
  const donutSize = 160;
  const strokeWidth = 18;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const highOffset = 0;
  const highLength = (distributionData.highPct / 100) * circumference;
  const modLength = (distributionData.modPct / 100) * circumference;
  const reviewLength = (distributionData.reviewPct / 100) * circumference;

  const competencies = [
    {
      title: 'Technical Accuracy & Domain Knowledge',
      desc: 'Depth of principles, real-time architectures, and systems logic',
      score: reportData.evaluation.overall_score,
      pct: Math.round(reportData.evaluation.overall_score * 10),
      color: 'bg-drdo',
      textColor: 'text-drdo',
    },
    {
      title: 'Clarity & Engineering Structure',
      desc: 'Systematic approach, modular decomposition, and edge-case handling',
      score: reportData.evaluation.clarity,
      pct: Math.round(reportData.evaluation.clarity * 10),
      color: 'bg-blue-600',
      textColor: 'text-blue-700',
    },
    {
      title: 'Communication & Articulation',
      desc: 'Concision, technical vocabulary, and structured responses',
      score: reportData.evaluation.communication,
      pct: Math.round(reportData.evaluation.communication * 10),
      color: 'bg-teal-600',
      textColor: 'text-teal-700',
    },
    {
      title: 'Resume Alignment & Authenticity',
      desc: 'Cross-verification with submitted dossier credentials',
      score: reportData.evaluation.authenticity_consistency,
      pct: Math.round(reportData.evaluation.authenticity_consistency * 10),
      color: 'bg-emerald-600',
      textColor: 'text-emerald-700',
    },
  ];

  const finalRep = reportData.final_report || {};

  if (loadingResult) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-drdo rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Loading Evaluation Dossier...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          header, .no-print, footer button { display: none !important; }
          body { background: #ffffff !important; color: #0f172a !important; font-size: 11pt !important; }
          .print-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; color: #0f172a !important; box-shadow: none !important; page-break-inside: avoid; }
        }
      `}</style>

      {/* National Tricolour Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0 no-print" />

      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white shadow-xs px-6 py-3.5 sticky top-0 z-50 no-print">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-lg bg-drdo-50 border border-drdo-200 flex items-center justify-center text-drdo shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight">
                Recruitment &amp; Assessment Centre (RAC)
              </div>
              <div className="text-xs text-slate-500">
                DRDO Candidate Screening Report • Ministry of Defence, Govt. of India
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="btn-institutional-primary"
            >
              <Printer className="w-4 h-4" />
              <span>Download Technical Screening Report</span>
            </button>

            <button
              onClick={handleRetake}
              className="btn-institutional-secondary"
            >
              <RotateCcw className="w-4 h-4" />
              <span>New Assessment</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6 flex-1">

        {/* ─── 1. EXECUTIVE SUMMARY CARD ─── */}
        <section className="institutional-card p-6 shadow-xs print-card space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-drdo uppercase tracking-wider">
                  Technical Screening Report
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {evaluationDate}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {totalAnswerDuration}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {reportData.candidate}
              </h1>

              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <Briefcase className="w-4 h-4 text-drdo" />
                <span>{reportData.role}</span>
              </div>
            </div>

            {/* Qualification Status Tag */}
            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wide ${
                  isQualified
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border border-amber-300'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${isQualified ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                <span>{isQualified ? 'QUALIFIED - RECOMMENDED FOR SELECTION' : 'FURTHER REVIEW REQUIRED'}</span>
              </div>
              <span className="text-xs text-slate-500">
                Evaluation Protocol Status: <strong>{reportData.status.toUpperCase()}</strong>
              </span>
            </div>
          </div>

          {/* Key Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                Composite Technical Score
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-drdo tracking-tight">
                  {reportData.evaluation.overall_score.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500">/ 10 points</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                Technical questions only (Icebreakers evaluated separately)
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                Assessment Questions
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  {reportData.questions_attempted}
                </span>
                <span className="text-xs text-slate-500">of {reportData.total_questions} total questions</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-1">
                2 Icebreakers + 5 Technical Deep Domain
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                Competency Alignment
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-700 tracking-tight">
                  {Math.round(reportData.evaluation.overall_score * 10)}%
                </span>
                <span className="text-xs text-slate-500">composite match</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-1">
                Dossier &amp; Viva Assessment
              </span>
            </div>
          </div>

          {/* Executive Summary from Backend */}
          {finalRep.summary && (
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-drdo" />
                Board Evaluation Executive Summary
              </span>
              <p className="text-xs text-slate-700 leading-relaxed font-sans bg-slate-50 p-4 rounded-xl border border-slate-200">
                {finalRep.summary}
              </p>
            </div>
          )}
        </section>

        {/* ─── 2. TWO-COLUMN ANALYTICS OVERVIEW ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* COLUMN A: Score Distribution Donut */}
          <div className="lg:col-span-5 institutional-card p-6 flex flex-col justify-between print-card">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-drdo" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Scoring Distribution
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {reportData.total_questions} Questions Total
                </span>
              </div>

              {/* Donut Chart Presentation */}
              <div className="py-6 flex flex-col items-center justify-center">
                <div className="relative" style={{ width: donutSize, height: donutSize }}>
                  <svg width={donutSize} height={donutSize} className="-rotate-90">
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={radius}
                      stroke="#e2e8f0"
                      strokeWidth={strokeWidth}
                      fill="none"
                    />

                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={radius}
                      stroke="#005b64"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${highLength} ${circumference}`}
                      strokeDashoffset={-highOffset}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-700"
                    />

                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={radius}
                      stroke="#2563eb"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${modLength} ${circumference}`}
                      strokeDashoffset={-highLength}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-700"
                    />

                    {reviewLength > 0 && (
                      <circle
                        cx={donutSize / 2}
                        cy={donutSize / 2}
                        r={radius}
                        stroke="#d97706"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${reviewLength} ${circumference}`}
                        strokeDashoffset={-(highLength + modLength)}
                        strokeLinecap="round"
                        fill="none"
                        className="transition-all duration-700"
                      />
                    )}
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-900 tracking-tight">
                      {reportData.evaluation.overall_score.toFixed(1)}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Average / 10
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200 text-center">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-drdo" />
                  <span>High (≥8)</span>
                </div>
                <span className="text-base font-bold text-slate-900 block mt-0.5">{distributionData.high}</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Moderate</span>
                </div>
                <span className="text-base font-bold text-slate-900 block mt-0.5">{distributionData.mod}</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  <span>Review</span>
                </div>
                <span className="text-base font-bold text-slate-900 block mt-0.5">{distributionData.review}</span>
              </div>
            </div>
          </div>

          {/* COLUMN B: Core Competencies Breakdown */}
          <div className="lg:col-span-7 institutional-card p-6 flex flex-col justify-between print-card">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-drdo" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Core Technical Competencies
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  Standard Benchmark: 7.0 / 10
                </span>
              </div>

              <div className="divide-y divide-slate-100 mt-3">
                {competencies.map((comp, idx) => (
                  <div key={idx} className="py-3 first:pt-1 last:pb-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-800">{comp.title}</span>
                      <span className={`font-bold ${comp.textColor}`}>{comp.score.toFixed(1)} / 10</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${comp.color} rounded-full transition-all duration-500`}
                        style={{ width: `${comp.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Board Recommendations Section */}
            {finalRep.recommendations && finalRep.recommendations.length > 0 && (
              <div className="pt-4 mt-3 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  Board Recommendations
                </span>
                <ul className="space-y-1.5">
                  {finalRep.recommendations.map((rec: string, rIdx: number) => (
                    <li key={rIdx} className="text-xs text-slate-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ─── 3. DEMONSTRATED STRENGTHS & DEVELOPMENT AREAS ─── */}
        {((finalRep.strengths && finalRep.strengths.length > 0) || (finalRep.weaknesses && finalRep.weaknesses.length > 0)) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 print-card">
            {/* Strengths */}
            {finalRep.strengths && finalRep.strengths.length > 0 && (
              <div className="institutional-card p-6 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Demonstrated Technical Strengths
                  </h3>
                </div>
                <ul className="space-y-2">
                  {finalRep.strengths.map((str: string, sIdx: number) => (
                    <li key={sIdx} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Development Areas */}
            {finalRep.weaknesses && finalRep.weaknesses.length > 0 && (
              <div className="institutional-card p-6 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Areas for Technical Growth
                  </h3>
                </div>
                <ul className="space-y-2">
                  {finalRep.weaknesses.map((wkn: string, wIdx: number) => (
                    <li key={wIdx} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                      <span>{wkn}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ─── 4. BOTTOM ACTION FOOTER ─── */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-12 no-print">
          <button
            onClick={handleRetake}
            className="btn-institutional-secondary w-full sm:w-auto px-5 py-2.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Conduct Another Technical Screening</span>
          </button>

          <button
            onClick={handlePrint}
            className="btn-institutional-primary w-full sm:w-auto px-6 py-2.5"
          >
            <Printer className="w-4 h-4" />
            <span>Download Technical Screening Report</span>
          </button>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-3.5 mt-auto no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-500">
          <span>Recruitment &amp; Assessment Centre (RAC) • Defence Research &amp; Development Organisation, New Delhi</span>
          <span>Official Technical Screening Dossier</span>
        </div>
      </footer>
    </div>
  );
}
