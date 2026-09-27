import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Mic,
  MicOff,
  Square,
  Volume2,
  Trash2,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Cpu,
  HelpCircle,
} from 'lucide-react';

import { useSession } from '../context/SessionContext';
import {
  submitAnswerApi,
  evaluateInterviewApi,
  transcribeVoiceApi,
  quitInterviewApi,
} from '../services/api';
import WaveformVisualizer from '../components/WaveformVisualizer';

export default function InterviewPage() {
  const navigate = useNavigate();
  const {
    config,
    questions,
    questionObjects,
    answers,
    currentIndex,
    setCurrentIndex,
    submitAnswer,
    clearAnswer,
    injectJudgeQuestion,
    setEvaluationReport,
  } = useSession();

  /* ── Guard: redirect if no questions loaded ── */
  useEffect(() => {
    if (questions.length === 0) navigate('/setup', { replace: true });
  }, [questions, navigate]);

  /* ── Local state ── */
  const [draftAnswer, setDraftAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adHocText, setAdHocText] = useState('');
  const [showInjector, setShowInjector] = useState(false);
  const [injectionSuccess, setInjectionSuccess] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSpokenQuestionRef = useRef<string | null>(null);

  /* ── Countdown timer (30 minutes total) ── */
  const [timeLeft, setTimeLeft] = useState(1800);
  useEffect(() => {
    const cd = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(cd);
  }, []);

  const totalQ = questions.length;
  const question = questions[currentIndex] || '';
  const currentObj = questionObjects[currentIndex] || null;
  const isIcebreaker = currentIndex < 2 || currentObj?.question_type === 'icebreaker';
  const progress = totalQ > 0 ? Math.round(((currentIndex + 1) / totalQ) * 100) : 0;
  const isLast = currentIndex === totalQ - 1;

  /* ── Sync draft when navigating between questions ── */
  useEffect(() => {
    setDraftAnswer(answers[currentIndex]?.text || '');
    setIsRecording(false);
    setRecordingSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [currentIndex, answers]);

  /* ── Automatic Speech Synthesis for Every Active Question ── */
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !question.trim()) {
      return;
    }

    // Prevent duplicate speech caused by re-renders or countdown timer ticks
    if (lastSpokenQuestionRef.current === question.trim()) {
      return;
    }

    lastSpokenQuestionRef.current = question.trim();

    // 1. Cancel previous speech
    window.speechSynthesis.cancel();

    // 2. Automatically speak the newly active question
    const utterance = new SpeechSynthesisUtterance(question.trim());
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    const speechTimer = setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Automatic speech playback error:', err);
      }
    }, 150);

    return () => {
      clearTimeout(speechTimer);
      window.speechSynthesis.cancel();
    };
  }, [currentIndex, question]);

  /* ── Cleanup media streams and speech on unmount ── */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /* ── Manual Question Replay button ── */
  const handleListen = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && question.trim()) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(question.trim());
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  /* ── Browser Voice Recording via MediaRecorder ── */
  const startRecording = async () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((p) => p + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check your browser permissions.');
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        if (audioBlob.size > 0) {
          setIsTranscribing(true);
          try {
            const transcript = await transcribeVoiceApi(audioBlob);
            if (transcript) {
              setDraftAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
            }
          } catch (e) {
            console.error('Transcription error:', e);
          } finally {
            setIsTranscribing(false);
          }
        }
      };
      mediaRecorderRef.current.stop();
    }
  };

  /* ── Submit Answer ── */
  const handleSubmit = async () => {
    if (isSubmitting || isSubmittingFinal || isTranscribing) return;
    setIsSubmitting(true);
    stopRecording();
    const finalTxt = draftAnswer.trim() || '[No answer provided]';

    // Submit individual answer for real-time evaluation by Python backend
    try {
      const evalResp = await submitAnswerApi({
        questionIndex: currentIndex,
        text: finalTxt,
        voiceDuration: recordingSeconds,
      });

      submitAnswer(currentIndex, finalTxt, recordingSeconds, evalResp.evaluation);
    } catch (err) {
      console.warn('Backend evaluation note:', err);
      submitAnswer(currentIndex, finalTxt, recordingSeconds);
    } finally {
      setIsSubmitting(false);
    }

    if (isLast) {
      setIsSubmittingFinal(true);
      const updatedAnswers = questions.map((_, i) => {
        if (i === currentIndex) {
          return { text: finalTxt, voiceDuration: recordingSeconds, submitted: true };
        }
        return answers[i] || { text: '', voiceDuration: 0, submitted: false };
      });

      try {
        const report = await evaluateInterviewApi({
          candidate: config.candidateName,
          role: config.role,
          questions,
          answers: updatedAnswers,
        });
        setEvaluationReport(report);
      } catch (e) {
        console.error('Failed to conclude interview:', e);
      } finally {
        setIsSubmittingFinal(false);
      }
      navigate('/results');
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  /* ── Early Conclude / Quit ── */
  const handleConcludeEarly = async () => {
    setIsSubmittingFinal(true);
    try {
      await quitInterviewApi();
      const report = await evaluateInterviewApi({
        candidate: config.candidateName,
        role: config.role,
        questions,
        answers,
      });
      setEvaluationReport(report);
    } catch (e) {
      console.error('Failed on early conclude:', e);
    } finally {
      setIsSubmittingFinal(false);
    }
    navigate('/results');
  };

  const handleClearCurrent = () => {
    stopRecording();
    setDraftAnswer('');
    clearAnswer(currentIndex);
  };

  const handleInjectAdHoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adHocText.trim()) return;
    injectJudgeQuestion(adHocText.trim());
    setAdHocText('');
    setInjectionSuccess(true);
    setTimeout(() => setInjectionSuccess(false), 3000);
  };

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const formatCountdown = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${pad2(mins)}:${pad2(secs)}`;
  };

  if (totalQ === 0) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* National Tricolour Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0" />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-xs px-4 sm:px-6 py-3 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-drdo-50 border border-drdo-200 text-drdo shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900">
                DRDO TECHNICAL ASSESSMENT INTERVIEW
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="font-semibold text-drdo">{config.candidateName}</span>
                <span>•</span>
                <span>{config.role}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Countdown Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <Clock className="w-4 h-4 text-drdo" />
              <span className="font-semibold text-slate-900">{formatCountdown(timeLeft)}</span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">Remaining</span>
            </div>

            {/* Conclude Session Button */}
            <button
              onClick={handleConcludeEarly}
              disabled={isSubmittingFinal}
              className="btn-institutional-danger text-xs cursor-pointer disabled:opacity-50"
              title="Conclude early and view evaluation report"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Conclude Interview</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Terminal Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-4">

        {/* Real-time Judge Question Injector Bar (Collapsible) */}
        <div className="institutional-card overflow-hidden">
          <button
            onClick={() => setShowInjector(!showInjector)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-700 uppercase tracking-wide cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-drdo" />
              <span>Interviewer Question Injector (Ad-Hoc Oral Viva Mode)</span>
              <span className="badge-drdo text-[10px]">Interviewer Control</span>
            </div>
            {showInjector ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {showInjector && (
            <form onSubmit={handleInjectAdHoc} className="p-5 pt-1 border-t border-slate-200 bg-slate-50/50 space-y-2.5">
              <p className="text-xs text-slate-600">
                Pose a targeted follow-up question. Submitting below immediately updates the active question on screen:
              </p>
              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={adHocText}
                  onChange={(e) => setAdHocText(e.target.value)}
                  placeholder="e.g. Under active signal attenuation, how does your telemetry loop adapt to preserve packet integrity?"
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-drdo"
                />
                <button
                  type="submit"
                  disabled={!adHocText.trim()}
                  className="btn-institutional-primary px-4 text-xs whitespace-nowrap"
                >
                  Inject Question
                </button>
              </div>
              {injectionSuccess && (
                <div className="text-xs text-emerald-700 flex items-center gap-1.5 pt-1 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Question successfully updated for Question {currentIndex + 1}.</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Main Terminal Frame */}
        <div className="institutional-card overflow-hidden flex flex-col flex-1">

          {/* Progress Header Bar */}
          <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                Question {currentIndex + 1} of {totalQ}
              </span>
              <span
                className={`ml-2 px-2.5 py-0.5 rounded text-xs font-semibold ${
                  isIcebreaker
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isIcebreaker
                  ? 'Icebreaker (Unscored for Technical)'
                  : 'Technical Question (Evaluated & Scored)'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-drdo rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600">{progress}% Completed</span>
            </div>
          </div>

          <div className="p-6 space-y-6 flex-1">
            {/* Active Question Box */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 border-l-4 border-l-drdo space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-drdo tracking-wider uppercase">
                  Interview Question
                </span>
                <button
                  onClick={handleListen}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer shadow-xs"
                  title="Replay question audio"
                >
                  <Volume2 className="w-3.5 h-3.5 text-drdo" />
                  <span>🔊 Replay Question</span>
                </button>
              </div>
              <p className="text-base text-slate-900 font-medium leading-relaxed">
                "{question}"
              </p>
            </div>

            {/* Answer Station */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Candidate Response
                </span>
                <span className="text-xs text-slate-400">{draftAnswer.length} / 2500 characters</span>
              </div>

              {/* Textarea */}
              <textarea
                rows={5}
                value={draftAnswer}
                onChange={(e) => {
                  if (e.target.value.length <= 2500) setDraftAnswer(e.target.value);
                }}
                placeholder={
                  config.answerMethod === 'voice'
                    ? 'Use the voice recording module below or type your answer here...'
                    : 'Type your response here...'
                }
                className="w-full bg-white border border-slate-300 rounded-lg p-3.5 text-sm text-slate-900 leading-relaxed resize-none focus:outline-none focus:border-drdo focus:ring-1 focus:ring-drdo transition-all placeholder-slate-400 custom-scroll"
              />

              {/* Voice Recording Module (Active when Voice mode is selected) */}
              {config.answerMethod === 'voice' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Voice Recording (Groq Whisper Engine)
                    </span>
                    {isRecording && (
                      <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-red-100 border border-red-200">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="text-xs font-semibold text-red-700">
                          ● Recording: {pad2(Math.floor(recordingSeconds / 60))}:{pad2(recordingSeconds % 60)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Equalizer Waveform */}
                  <WaveformVisualizer
                    active={isRecording}
                    bars={36}
                    color={isRecording ? 'emerald' : 'cyan'}
                    height={32}
                  />

                  {/* Live Transcription Indicator */}
                  {isTranscribing && (
                    <div className="p-2.5 rounded-lg bg-drdo-50 border border-drdo-200 text-xs text-drdo flex items-center gap-2 font-medium">
                      <Cpu className="w-4 h-4 animate-spin text-drdo" />
                      <span>Transcribing audio via Groq Whisper...</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => (isRecording ? stopRecording() : startRecording())}
                      disabled={isTranscribing}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                        isRecording
                          ? 'bg-red-600 text-white hover:bg-red-700 shadow-xs'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                      }`}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      <span>{isRecording ? 'Stop Recording & Transcribe' : '🎤 Start Recording'}</span>
                    </button>
                    {isRecording && (
                      <span className="text-xs text-slate-500">Microphone active • Speak your answer clearly</span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons: Clear Answer & Submit */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleClearCurrent}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Response</span>
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || isSubmittingFinal || isTranscribing}
                  className="btn-institutional-primary py-2.5 px-6 text-xs"
                >
                  <span>
                    {isSubmittingFinal
                      ? 'Compiling Evaluation Report...'
                      : isLast
                        ? 'Submit Final Answer & View Results →'
                        : 'Submit Answer & Next →'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Question Navigation Bar at Bottom */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 overflow-x-auto custom-scroll">
            <div className="flex items-center gap-2 min-w-max">
              {questions.map((_, idx) => {
                const isAnswered = answers[idx]?.submitted;
                const isCurrent = idx === currentIndex;
                const isIce = idx < 2;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      isCurrent
                        ? 'bg-drdo text-white shadow-xs'
                        : isAnswered
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isCurrent
                      ? `Q${idx + 1} (${isIce ? 'Icebreaker' : 'Technical'}) ●`
                      : isAnswered
                        ? `Q${idx + 1} ✓`
                        : `Q${idx + 1}`}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-3 mt-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-slate-500">
          <span>Recruitment &amp; Assessment Centre (RAC) • DRDO Technical Interview</span>
          <span>Session Active</span>
        </div>
      </footer>
    </div>
  );
}
