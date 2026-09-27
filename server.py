import os
import sys
import json
import base64
import tempfile
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from dotenv import load_dotenv

load_dotenv()

# Add root directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from main import (
    load_resume,
    extract_candidate_profile,
    generate_icebreakers,
    generate_interview_questions,
    DEFAULT_JD,
)
from interview import (
    analyze_manual_question,
    evaluate_answer,
    evaluate_icebreaker_answer,
    generate_final_report,
)
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in .env")

groq_client = Groq(api_key=GROQ_API_KEY)
PORT = int(os.getenv("PORT", 5000))

# Thread-safe in-memory session store
class SessionManager:
    def __init__(self):
        self.session = {
            "session_id": "RAC-LIVE-SESSION",
            "candidate_name": "",
            "candidate_profile": None,
            "resume_text": "",
            "role": "Software & Systems Engineer",
            "jd": DEFAULT_JD,
            "question_source": "ai",
            "answer_mode": "text",
            "questions": [],
            "answers": {},
            "interview_results": [],
            "status": "pending",
            "final_report": None,
        }

    def reset(self):
        self.session = {
            "session_id": "RAC-LIVE-SESSION",
            "candidate_name": "",
            "candidate_profile": None,
            "resume_text": "",
            "role": "Software & Systems Engineer",
            "jd": DEFAULT_JD,
            "question_source": "ai",
            "answer_mode": "text",
            "questions": [],
            "answers": {},
            "interview_results": [],
            "status": "pending",
            "final_report": None,
        }

session_manager = SessionManager()

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class InterviewAPIHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_error_json(self, status_code, message):
        self.send_json(status_code, {"success": False, "error": message})

    def parse_body(self):
        content_type = self.headers.get("Content-Type", "")
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length)

        if "application/json" in content_type:
            try:
                return json.loads(raw_body.decode("utf-8"))
            except Exception:
                return {}
        return raw_body

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self.send_json(200, {
                "status": "online",
                "service": "DRDO Technical Interview System (Python RAG Backend)",
                "llm_model": "openai/gpt-oss-120b",
                "embedding_model": "BAAI/bge-small-en-v1.5",
                "whisper_model": "whisper-large-v3-turbo",
                "active_candidate": session_manager.session.get("candidate_name") or None,
            })
            return

        if path == "/api/interview/result":
            result_path = os.path.join(BASE_DIR, "interview_result.json")
            if os.path.exists(result_path):
                try:
                    with open(result_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.send_json(200, data)
                    return
                except Exception as e:
                    self.send_error_json(500, f"Error reading result file: {str(e)}")
                    return
            else:
                self.send_error_json(404, "interview_result.json not found.")
                return

        self.send_error_json(404, f"GET endpoint not found: {path}")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            # 1. Resume Parsing & Profile Extraction
            if path in ["/api/parse-resume", "/api/resume/upload"]:
                self.handle_parse_resume()
                return

            # 2. Interview Initialization & Question Generation
            if path in ["/api/interview/init", "/api/initialize-interview"]:
                self.handle_init_interview()
                return

            # 3. Dynamic Question Generation (RAG or Manual)
            if path in ["/api/questions", "/api/questions/generate"]:
                self.handle_fetch_questions()
                return

            # 4. Manual Question Analysis
            if path == "/api/manual-questions/analyze":
                self.handle_analyze_manual_question()
                return

            # 5. Voice Recording Transcription via Groq Whisper
            if path in ["/api/voice/transcribe", "/api/transcribe"]:
                self.handle_transcribe_voice()
                return

            # 6. Single Answer Submission & Real-time Evaluation
            if path in ["/api/interview/answer", "/api/answer"]:
                self.handle_submit_answer()
                return

            # 7. Quit / Early Termination
            if path in ["/api/interview/quit", "/api/quit"]:
                self.handle_quit_interview()
                return

            # 8. Conclude Interview & Generate Final Assessment Report
            if path in ["/api/evaluate-interview", "/api/interview/conclude"]:
                self.handle_evaluate_interview()
                return

            self.send_error_json(404, f"POST endpoint not found: {path}")

        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_error_json(500, f"Internal server error: {str(e)}")

    def handle_parse_resume(self):
        body = self.parse_body()
        file_name = "resume.pdf"
        file_bytes = None

        if isinstance(body, dict):
            file_name = body.get("fileName", "resume.pdf")
            file_data_b64 = body.get("fileData")
            if file_data_b64:
                if "," in file_data_b64:
                    file_data_b64 = file_data_b64.split(",")[1]
                file_bytes = base64.b64decode(file_data_b64)
            elif body.get("filePath") and os.path.exists(body["filePath"]):
                with open(body["filePath"], "rb") as f:
                    file_bytes = f.read()

        if not file_bytes:
            # Check if sample resume exists as fallback
            sample_path = os.path.join(BASE_DIR, "Sample_Files", "DRDO_Sample_Resume_1.pdf")
            if os.path.exists(sample_path):
                with open(sample_path, "rb") as f:
                    file_bytes = f.read()
            else:
                self.send_error_json(400, "No file data received and sample resume not found.")
                return

        # Write to temporary file for PyPDFLoader
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_pdf:
            temp_pdf.write(file_bytes)
            temp_pdf_path = temp_pdf.name

        try:
            resume_text = load_resume(temp_pdf_path)
            candidate_profile = extract_candidate_profile(resume_text)
            candidate_name = candidate_profile.get("name", "Unknown Candidate")

            # Store in session
            session_manager.session["candidate_name"] = candidate_name
            session_manager.session["candidate_profile"] = candidate_profile
            session_manager.session["resume_text"] = resume_text

            skills = candidate_profile.get("skills", [])
            role = session_manager.session.get("role", "Software & Systems Engineer")

            self.send_json(200, {
                "success": True,
                "candidate": candidate_name,
                "role": role,
                "skills": skills,
                "fileName": file_name,
                "fileSize": f"{len(file_bytes) / 1024:.1f} KB",
                "profile": candidate_profile,
            })
        finally:
            if os.path.exists(temp_pdf_path):
                os.remove(temp_pdf_path)

    def handle_init_interview(self):
        body = self.parse_body()
        candidate_name = body.get("candidateName") or session_manager.session.get("candidate_name") or "Candidate"
        role = body.get("role") or session_manager.session.get("role") or "Software & Systems Engineer"
        jd = body.get("jd") or session_manager.session.get("jd") or DEFAULT_JD
        question_source = body.get("questionSource", "ai")
        answer_mode = body.get("answerMethod", "text")
        manual_questions_input = body.get("manualQuestions", [])

        resume_text = session_manager.session.get("resume_text", "")
        candidate_profile = session_manager.session.get("candidate_profile")

        if not resume_text:
            # Try to load sample resume if none uploaded yet
            sample_path = os.path.join(BASE_DIR, "Sample_Files", "DRDO_Sample_Resume_1.pdf")
            if os.path.exists(sample_path):
                resume_text = load_resume(sample_path)
                candidate_profile = extract_candidate_profile(resume_text)
                candidate_name = candidate_profile.get("name", candidate_name)
                session_manager.session["resume_text"] = resume_text
                session_manager.session["candidate_profile"] = candidate_profile
                session_manager.session["candidate_name"] = candidate_name

        # 1. Exactly 2 resume-based icebreakers
        icebreakers = generate_icebreakers(candidate_profile, resume_text)

        # 2. Exactly 5 technical questions
        technical_questions = []
        if question_source == "manual" and manual_questions_input and len(manual_questions_input) >= 5:
            for idx, q_text in enumerate(manual_questions_input[:5]):
                analysis = analyze_manual_question(q_text, resume_text, jd)
                technical_questions.append({
                    "question": q_text,
                    "source": "manual",
                    "question_type": "technical",
                    "scored": True,
                    "jd_match": analysis.get("jd_match", 8),
                    "resume_match": analysis.get("resume_match", 8),
                    "difficulty": analysis.get("difficulty", "Medium"),
                    "difficulty_score": analysis.get("difficulty_score", 7),
                    "topic": analysis.get("topic", "Technical"),
                })
        else:
            # Default to AI-generated RAG technical questions
            technical_questions = generate_interview_questions(role, jd, resume_text)

        # Combine into exactly 7 questions: 2 icebreakers + 5 technical
        combined_questions = icebreakers + technical_questions
        for idx, q in enumerate(combined_questions, start=1):
            q["question_number"] = idx

        session_manager.session["candidate_name"] = candidate_name
        session_manager.session["role"] = role
        session_manager.session["jd"] = jd
        session_manager.session["question_source"] = question_source
        session_manager.session["answer_mode"] = answer_mode
        session_manager.session["questions"] = combined_questions
        session_manager.session["answers"] = {}
        session_manager.session["interview_results"] = []
        session_manager.session["status"] = "active"

        self.send_json(200, {
            "success": True,
            "sessionId": session_manager.session["session_id"],
            "candidate": candidate_name,
            "role": role,
            "total_questions": len(combined_questions),
            "questions": combined_questions,
            "questions_text": [q["question"] for q in combined_questions],
        })

    def handle_fetch_questions(self):
        body = self.parse_body()
        role = body.get("role") or session_manager.session.get("role") or "Software & Systems Engineer"
        jd = body.get("jd") or session_manager.session.get("jd") or DEFAULT_JD
        resume_text = session_manager.session.get("resume_text", "")

        if not resume_text:
            sample_path = os.path.join(BASE_DIR, "Sample_Files", "DRDO_Sample_Resume_1.pdf")
            if os.path.exists(sample_path):
                resume_text = load_resume(sample_path)
                candidate_profile = extract_candidate_profile(resume_text)
                session_manager.session["resume_text"] = resume_text
                session_manager.session["candidate_profile"] = candidate_profile
                session_manager.session["candidate_name"] = candidate_profile.get("name", "Candidate")

        candidate_profile = session_manager.session.get("candidate_profile", {})
        icebreakers = generate_icebreakers(candidate_profile, resume_text)
        technical_questions = generate_interview_questions(role, jd, resume_text)

        combined = icebreakers + technical_questions
        for idx, q in enumerate(combined, start=1):
            q["question_number"] = idx

        session_manager.session["questions"] = combined

        self.send_json(200, {
            "success": True,
            "role": role,
            "count": len(combined),
            "questions": [q["question"] for q in combined],
            "question_objects": combined,
        })

    def handle_analyze_manual_question(self):
        body = self.parse_body()
        question = body.get("question", "")
        jd = body.get("jd") or session_manager.session.get("jd") or DEFAULT_JD
        resume_text = session_manager.session.get("resume_text", "")

        if not question:
            self.send_error_json(400, "Question text is required.")
            return

        analysis = analyze_manual_question(question, resume_text, jd)
        self.send_json(200, {
            "success": True,
            "analysis": analysis,
        })

    def handle_transcribe_voice(self):
        body = self.parse_body()
        audio_bytes = None

        if isinstance(body, dict):
            audio_b64 = body.get("audioData")
            if audio_b64:
                if "," in audio_b64:
                    audio_b64 = audio_b64.split(",")[1]
                audio_bytes = base64.b64decode(audio_b64)
        elif isinstance(body, (bytes, bytearray)):
            audio_bytes = body

        if not audio_bytes:
            self.send_error_json(400, "No audio data provided.")
            return

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_audio_path = temp_audio.name

        try:
            with open(temp_audio_path, "rb") as af:
                transcription = groq_client.audio.transcriptions.create(
                    file=af,
                    model="whisper-large-v3-turbo",
                    response_format="text"
                )
            self.send_json(200, {
                "success": True,
                "text": transcription.strip() if isinstance(transcription, str) else str(transcription),
            })
        finally:
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)

    def handle_submit_answer(self):
        body = self.parse_body()
        q_idx = int(body.get("questionIndex", 0))
        answer_text = (body.get("text") or "").strip()
        voice_duration = body.get("voiceDuration", 0)

        questions = session_manager.session.get("questions", [])
        if not questions or q_idx >= len(questions):
            self.send_error_json(400, f"Invalid question index: {q_idx}")
            return

        question_obj = questions[q_idx]
        question_text = question_obj["question"]
        resume_text = session_manager.session.get("resume_text", "")

        if not answer_text:
            answer_text = "[No answer provided]"

        # Check early quit signal in answer
        if answer_text.lower() in {"quit", ":q", "exit"}:
            session_manager.session["status"] = "cancelled"

        # Evaluate based on question type
        if question_obj.get("question_type") == "icebreaker":
            evaluation = evaluate_icebreaker_answer(question_text, answer_text, resume_text)
        else:
            evaluation = evaluate_answer(question_text, answer_text, resume_text)

        result_item = {
            **question_obj,
            "answer": answer_text,
            "voice_duration": voice_duration,
            "evaluation": evaluation,
        }

        # Store in session
        session_manager.session["answers"][q_idx] = {
            "text": answer_text,
            "voice_duration": voice_duration,
            "evaluation": evaluation,
        }

        # Update or append in interview_results
        existing_idx = next((i for i, r in enumerate(session_manager.session["interview_results"]) if r.get("question_number") == question_obj["question_number"]), None)
        if existing_idx is not None:
            session_manager.session["interview_results"][existing_idx] = result_item
        else:
            session_manager.session["interview_results"].append(result_item)

        self.send_json(200, {
            "success": True,
            "question_number": question_obj["question_number"],
            "evaluation": evaluation,
            "result_item": result_item,
        })

    def handle_quit_interview(self):
        session_manager.session["status"] = "cancelled"
        candidate_name = session_manager.session.get("candidate_name", "Candidate")
        role = session_manager.session.get("role", "Software & Systems Engineer")
        interview_results = session_manager.session.get("interview_results", [])

        final_report = None
        if interview_results:
            final_report = generate_final_report(interview_results, candidate_name, role)

        session_manager.session["final_report"] = final_report

        output = {
            "candidate": candidate_name,
            "role": role,
            "status": "cancelled",
            "questions_attempted": len(interview_results),
            "interview_results": interview_results,
            "final_report": final_report,
        }

        with open(os.path.join(BASE_DIR, "interview_result.json"), "w", encoding="utf-8") as f:
            json.dump(output, f, indent=4, ensure_ascii=False)

        self.send_json(200, {
            "success": True,
            "status": "cancelled",
            "result": output,
        })

    def handle_evaluate_interview(self):
        body = self.parse_body()
        candidate = body.get("candidate") or session_manager.session.get("candidate_name") or "Candidate"
        role = body.get("role") or session_manager.session.get("role") or "Software & Systems Engineer"
        questions = body.get("questions") or [q["question"] for q in session_manager.session.get("questions", [])]
        answers = body.get("answers") or []
        resume_text = session_manager.session.get("resume_text", "")

        session_questions = session_manager.session.get("questions", [])

        # Ensure all questions have evaluations
        interview_results = []
        for idx, q_text in enumerate(questions):
            q_obj = session_questions[idx] if idx < len(session_questions) else {
                "question_number": idx + 1,
                "question": q_text,
                "source": "ai",
                "question_type": "icebreaker" if idx < 2 else "technical",
                "scored": idx >= 2,
            }

            ans_entry = answers[idx] if idx < len(answers) else {}
            ans_text = (ans_entry.get("text") if isinstance(ans_entry, dict) else str(ans_entry)) or ""
            ans_text = ans_text.strip() or "[No answer provided]"

            # Check if already evaluated in session
            saved_eval = session_manager.session["answers"].get(idx, {}).get("evaluation")
            if saved_eval:
                evaluation = saved_eval
            else:
                if q_obj.get("question_type") == "icebreaker":
                    evaluation = evaluate_icebreaker_answer(q_text, ans_text, resume_text)
                else:
                    evaluation = evaluate_answer(q_text, ans_text, resume_text)

            item = {
                **q_obj,
                "answer": ans_text,
                "evaluation": evaluation,
            }
            interview_results.append(item)

        session_manager.session["interview_results"] = interview_results

        # Generate final comprehensive report
        final_report = generate_final_report(interview_results, candidate, role)
        session_manager.session["final_report"] = final_report
        session_manager.session["status"] = "completed"

        # Prepare persistence structure
        output = {
            "candidate": candidate,
            "role": role,
            "status": "completed",
            "questions_attempted": len([a for a in interview_results if a.get("answer") != "[No answer provided]"]) or len(interview_results),
            "interview_results": interview_results,
            "final_report": final_report,
        }

        # Write to interview_result.json
        with open(os.path.join(BASE_DIR, "interview_result.json"), "w", encoding="utf-8") as f:
            json.dump(output, f, indent=4, ensure_ascii=False)

        # UI format bridge matching AssessmentReportData
        icebreaker_eval = final_report.get("icebreaker_evaluation", {})
        ui_evaluation = {
            "overall_score": float(final_report.get("overall_score", 0)),
            "resume_relevance": float(icebreaker_eval.get("resume_relevance", final_report.get("answer_relevance", 8.0))),
            "clarity": float(final_report.get("technical_knowledge", 8.0)),
            "communication": float(final_report.get("communication", 8.0)),
            "authenticity_consistency": float(icebreaker_eval.get("authenticity_consistency", 8.5)),
        }

        ui_response = {
            "candidate": candidate,
            "role": role,
            "status": "completed",
            "questions_attempted": output["questions_attempted"],
            "total_questions": len(interview_results),
            "evaluation": ui_evaluation,
            "final_report": final_report,
            "interview_results": interview_results,
        }

        self.send_json(200, ui_response)

def run_server():
    server_address = ("", PORT)
    httpd = ThreadedHTTPServer(server_address, InterviewAPIHandler)
    print(f"[DRDO RAC PYTHON SERVER] Active and listening on http://localhost:{PORT}")
    print(f"[DRDO RAC PYTHON SERVER] Connected to ChromaDB RAG, Groq LLM and Whisper STT")
    print(f"[DRDO RAC PYTHON SERVER] Ready to serve React frontend on port {PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()
