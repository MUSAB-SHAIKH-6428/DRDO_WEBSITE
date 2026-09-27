import os
import sys
import json
import base64
import time
import threading
import urllib.request
import urllib.error

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from server import ThreadedHTTPServer, InterviewAPIHandler

PORT = 5005 # Test port to avoid conflict

def start_test_server():
    server = ThreadedHTTPServer(("127.0.0.1", PORT), InterviewAPIHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(1)
    return server

def request_json(method, path, data=None):
    url = f"http://127.0.0.1:{PORT}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def run_tests():
    print("=" * 60)
    print("STARTING E2E INTEGRATION TEST FOR DRDO INTERVIEW SYSTEM")
    print("=" * 60)

    server = start_test_server()
    print("Test server started on port", PORT)

    # 1. Health check
    print("\n[TEST 1] GET /api/health")
    status, health = request_json("GET", "/api/health")
    assert status == 200, f"Health check failed: {status}"
    assert health.get("status") == "online", "Health status not online"
    print("[PASS] Health check PASSED:", health["service"])

    # 2. Resume Upload & Profile Extraction
    print("\n[TEST 2] POST /api/parse-resume (using DRDO_Sample_Resume_1.pdf)")
    resume_path = os.path.join(BASE_DIR, "Sample_Files", "DRDO_Sample_Resume_1.pdf")
    with open(resume_path, "rb") as f:
        pdf_bytes = f.read()
    b64_pdf = base64.b64encode(pdf_bytes).decode("utf-8")

    status, parse_res = request_json("POST", "/api/parse-resume", {
        "fileName": "DRDO_Sample_Resume_1.pdf",
        "fileData": b64_pdf
    })
    assert status == 200, f"Parse resume failed: {status}"
    assert parse_res["success"] is True
    candidate_name = parse_res["candidate"]
    print("[PASS] Resume parsed successfully!")
    print(f"  Candidate Name: {candidate_name}")
    print(f"  Skills Extracted: {len(parse_res.get('skills', []))} skills")
    assert len(candidate_name) > 0, "Candidate name must not be empty"

    # 3. Interview Initialization (2 Icebreakers + 5 Technical RAG questions)
    print("\n[TEST 3] POST /api/interview/init (AI Question Mode)")
    status, init_res = request_json("POST", "/api/interview/init", {
        "candidateName": candidate_name,
        "role": "Software & Systems Engineer",
        "questionSource": "ai",
        "answerMethod": "text"
    })
    assert status == 200, f"Init failed: {status}"
    questions = init_res["questions"]
    print(f"✓ Interview initialized! Total questions: {len(questions)}")
    assert len(questions) == 7, f"Expected exactly 7 questions, got {len(questions)}"
    
    # Verify exactly 2 icebreakers and 5 technical
    icebreakers = [q for q in questions if q.get("question_type") == "icebreaker"]
    technical = [q for q in questions if q.get("question_type") == "technical"]
    assert len(icebreakers) == 2, f"Expected 2 icebreakers, got {len(icebreakers)}"
    assert len(technical) == 5, f"Expected 5 technical questions, got {len(technical)}"
    print(f"  Icebreakers (Unscored): {len(icebreakers)}")
    print(f"  Technical (Scored): {len(technical)}")

    # 4. Turn-by-Turn Answer Submission & Evaluation (Icebreaker)
    print("\n[TEST 4] POST /api/interview/answer (Question 1: Icebreaker)")
    status, ans1_res = request_json("POST", "/api/interview/answer", {
        "questionIndex": 0,
        "text": "I completed my undergraduate degree in Computer Science and focused on distributed systems and high-throughput data pipelines during my internship.",
        "voiceDuration": 12
    })
    assert status == 200, f"Answer 1 failed: {status}"
    eval1 = ans1_res["evaluation"]
    print("[PASS] Icebreaker answered and evaluated!")
    print(f"  Relevance: {eval1.get('resume_relevance')}/10, Clarity: {eval1.get('clarity')}/10, Comm: {eval1.get('communication')}/10")
    print(f"  Feedback: {eval1.get('feedback')[:100]}...")

    # 5. Turn-by-Turn Answer Submission & Evaluation (Technical)
    print("\n[TEST 5] POST /api/interview/answer (Question 3: Technical)")
    status, ans3_res = request_json("POST", "/api/interview/answer", {
        "questionIndex": 2,
        "text": "To prevent priority inversion in an RTOS, we use the Priority Ceiling Protocol or Priority Inheritance Protocol so high priority tasks are not blocked indefinitely by lower priority tasks holding a shared mutex.",
        "voiceDuration": 25
    })
    assert status == 200, f"Answer 3 failed: {status}"
    eval3 = ans3_res["evaluation"]
    print("[PASS] Technical question answered and evaluated!")
    print(f"  Technical Correctness: {eval3.get('technical_correctness')}/10, Overall: {eval3.get('overall_score')}/10")
    print(f"  Strengths: {eval3.get('strengths')}")

    # 6. Manual Question Analysis
    print("\n[TEST 6] POST /api/manual-questions/analyze")
    status, manual_res = request_json("POST", "/api/manual-questions/analyze", {
        "question": "Explain how RAII is used in C++ to guarantee resource cleanup.",
        "jd": "Software & Systems Engineer position requiring C++ and Linux."
    })
    assert status == 200
    analysis = manual_res["analysis"]
    print("[PASS] Manual question analyzed successfully!")
    print(f"  Topic: {analysis.get('topic')}, Difficulty: {analysis.get('difficulty')}, JD Match: {analysis.get('jd_match')}/10")

    # 7. Conclude Interview & Generate Final Assessment Report
    print("\n[TEST 7] POST /api/evaluate-interview (Final Report & Scorecard)")
    sample_answers = [
        {"text": "I studied Computer Science and developed streaming pipelines for telemetry.", "voiceDuration": 10},
        {"text": "My major final-year project explored real-time kernel synchronization.", "voiceDuration": 15},
        {"text": "Priority Inheritance and Ceiling protocols prevent low-priority priority inversion.", "voiceDuration": 20},
        {"text": "We implement a lock-free circular ring buffer with atomic operations for zero-copy ingestion.", "voiceDuration": 30},
        {"text": "Stack allocation is fast and fixed-size; heap allocation is dynamic but requires careful lifecycle management to avoid leaks.", "voiceDuration": 18},
        {"text": "We enforce static analysis, bounds checking, and ASLR to prevent firmware buffer overflow exploits.", "voiceDuration": 22},
        {"text": "Zero-copy sockets and epoll edge-triggered I/O multiplexing ensure minimal latency overhead.", "voiceDuration": 25},
    ]
    status, final_res = request_json("POST", "/api/evaluate-interview", {
        "candidate": candidate_name,
        "role": "Software & Systems Engineer",
        "questions": [q["question"] for q in questions],
        "answers": sample_answers
    })
    assert status == 200, f"Conclude failed: {status}"
    assert final_res["status"] == "completed"
    print("[PASS] Final Interview Report Generated Successfully!")
    print(f"  Candidate: {final_res['candidate']}")
    print(f"  Overall Score: {final_res['evaluation']['overall_score']}/10")
    print(f"  Questions Attempted: {final_res['questions_attempted']} of {final_res['total_questions']}")
    assert os.path.exists(os.path.join(BASE_DIR, "interview_result.json")), "interview_result.json was not created!"
    print("[PASS] Verified persistence: interview_result.json exists on disk.")

    # 8. Result Retrieval
    print("\n[TEST 8] GET /api/interview/result")
    status, stored = request_json("GET", "/api/interview/result")
    assert status == 200
    assert stored["candidate"] == candidate_name
    print("[PASS] Stored result retrieved successfully from interview_result.json")

    # 9. Quit / Cancellation handling
    print("\n[TEST 9] POST /api/interview/quit")
    status, quit_res = request_json("POST", "/api/interview/quit", {})
    assert status == 200
    assert quit_res["status"] == "cancelled"
    print("[PASS] Early termination / quit signal handled cleanly.")

    print("\n" + "=" * 60)
    print("ALL 9 E2E INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
