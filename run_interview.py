import os

from main import (
    load_resume,
    extract_candidate_profile,
    generate_icebreakers,
    generate_interview_questions
)
from interview import (
    add_manual_questions,
    run_interview,
    text_answer_provider,
    voice_answer_provider
)

print("\nINTERVIEW SETUP")

resume_path = input("\nResume PDF path: ").strip()
if not os.path.exists(resume_path):
    raise FileNotFoundError(f"Resume not found: {resume_path}")

print("\nLoading resume...")
resume_text = load_resume(resume_path)

print("Analyzing candidate profile...")
candidate_profile = extract_candidate_profile(resume_text)
candidate_name = candidate_profile["name"]
print(f"\nCandidate: {candidate_name}")

role = input("\nInterview role: ").strip()
if not role:
    raise ValueError("Interview role cannot be empty.")

print("\nPaste job description. Type END on a new line when finished:")
jd_lines = []
while True:
    line = input()
    if line.strip() == "END":
        break
    jd_lines.append(line)
jd = "\n".join(jd_lines).strip()
if not jd:
    raise ValueError("Job description cannot be empty.")

print("\nQuestion source:")
print("1. AI Generated")
print("2. Manual")
print("q. Quit")
question_source = input("\nSelect option: ").strip()
if question_source.lower() in {"q", "quit", "exit"}:
    raise SystemExit("Interview cancelled by user.")

print("\nAnswer method:")
print("1. Text")
print("2. Voice")
print("q. Quit")
answer_option = input("\nSelect option: ").strip()
if answer_option.lower() in {"q", "quit", "exit"}:
    raise SystemExit("Interview cancelled by user.")

if answer_option == "1":
    answer_mode = "text"
    answer_provider = text_answer_provider
elif answer_option == "2":
    answer_mode = "voice"
    answer_provider = voice_answer_provider
else:
    raise ValueError("Invalid answer method.")

icebreakers = generate_icebreakers(candidate_profile, resume_text)

if question_source == "1":
    print("\nGenerating AI interview questions...")
    technical_questions = generate_interview_questions(role, jd, resume_text)
elif question_source == "2":
    technical_questions = add_manual_questions(resume_text, jd)
else:
    raise ValueError("Invalid question source.")

questions = icebreakers + technical_questions
for index, question in enumerate(questions, start=1):
    question["question_number"] = index

if not questions:
    raise ValueError("No questions were provided.")

print("\n" + "=" * 60)
print("INTERVIEW")
print("=" * 60)
print(f"Candidate: {candidate_name}")
print(f"Role: {role}")
print(f"Answer mode: {answer_mode}")
print("Questions: 2 icebreakers + 5 technical")
print("Type 'quit' during text answers or say 'quit' in voice mode to stop.")
input("\nPress ENTER to start...")

result = run_interview(
    questions=questions,
    candidate_name=candidate_name,
    role=role,
    answer_mode=answer_mode,
    answer_provider=answer_provider,
    resume_text=resume_text
)

print("\n" + "=" * 60)
print("FINAL INTERVIEW RESULT")
print("=" * 60)
if result["final_report"] is None:
    print("\nInterview cancelled.")
    raise SystemExit

report = result["final_report"]
print(f"\nOverall Score: {report['overall_score']}/10")
print(f"Technical Knowledge: {report['technical_knowledge']}/10")
print(f"Problem Solving: {report['problem_solving']}/10")
print(f"Communication: {report['communication']}/10")
print(f"Answer Relevance: {report['answer_relevance']}/10")
print("\nStrengths:")
for item in report["strengths"]:
    print(f"- {item}")
print("\nWeaknesses:")
for item in report["weaknesses"]:
    print(f"- {item}")
print("\nRecommendations:")
for item in report["recommendations"]:
    print(f"- {item}")
print("\nSummary:")
print(report["summary"])
print("\nSaved: interview_result.json")
