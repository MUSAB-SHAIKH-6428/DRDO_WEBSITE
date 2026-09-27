import os
import json

from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in .env")


llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0,
    api_key=GROQ_API_KEY
)


def analyze_manual_question(question, resume_text, jd):

    prompt = f"""
You are a technical interview question analyzer.

Analyze the following manually created interview question.

JOB DESCRIPTION:
{jd}

CANDIDATE RESUME:
{resume_text}

MANUAL QUESTION:
{question}

Evaluate the question using these criteria.

JD MATCH:
How relevant is the question to the job description?
0 = completely unrelated
10 = directly relevant

RESUME MATCH:
How relevant is the question to the candidate's demonstrated
skills and experience?
0 = completely unrelated
10 = directly aligned

DIFFICULTY:
Evaluate the intrinsic technical difficulty of the question.

Easy:
- Basic definitions
- Fundamental concepts
- Simple explanations

Medium:
- Application of concepts
- Moderate debugging
- Combining multiple concepts
- Practical scenarios

Hard:
- Complex system design
- Trade-off analysis
- Complex debugging
- Multiple interacting concepts
- Open-ended architecture problems

Also identify the primary technical topic.

Return ONLY valid JSON:

{{
    "jd_match": 0,
    "resume_match": 0,
    "difficulty": "Easy",
    "difficulty_score": 0,
    "topic": ""
}}

Do not evaluate the candidate's ability to answer the question.
Evaluate only the question itself.
"""

    response = llm.invoke(prompt)

    content = response.content.strip()

    content = content.replace("```json", "")
    content = content.replace("```", "")
    content = content.strip()

    try:
        return json.loads(content)

    except json.JSONDecodeError:

        raise ValueError(
            f"Could not parse question analysis:\n{content}"
        )


def add_manual_questions(resume_text, jd):

    questions = []

    print("\n")
    print("=" * 60)
    print("MANUAL QUESTION SETUP")
    print("=" * 60)
    print("\nEnter exactly 5 technical questions.")
    print("Type 'quit' to exit the interview setup.")

    while len(questions) < 5:

        print(f"\nQuestion {len(questions) + 1}/5")

        question = input("Question: ").strip()

        if question.lower() == "quit":
            raise SystemExit("Interview cancelled by user.")

        if not question:
            print("Question cannot be empty.")
            continue

        print("\nAnalyzing question...")

        analysis = analyze_manual_question(
            question,
            resume_text,
            jd
        )

        question_data = {
            "question_number": len(questions) + 1,
            "question": question,
            "source": "manual",
            "question_type": "technical",
            "scored": True,
            "jd_match": analysis["jd_match"],
            "resume_match": analysis["resume_match"],
            "difficulty": analysis["difficulty"],
            "difficulty_score": analysis["difficulty_score"],
            "topic": analysis["topic"]
        }

        questions.append(question_data)

        print("\nQuestion analysis:")
        print(f"JD Match:       {analysis['jd_match']}/10")
        print(f"Resume Match:   {analysis['resume_match']}/10")
        print(f"Difficulty:     {analysis['difficulty']}")
        print(f"Difficulty Score: {analysis['difficulty_score']}/10")
        print(f"Topic:          {analysis['topic']}")

    return questions


def evaluate_answer(question, answer, resume_text):

    prompt = f"""
You are a strict technical interview evaluator.

Evaluate the candidate's answer.

QUESTION:
{question}

CANDIDATE ANSWER:
{answer}

CANDIDATE RESUME:
{resume_text}

Evaluate:

1. Relevance
2. Technical correctness
3. Completeness
4. Depth
5. Clarity

Give each a score from 0 to 10.

Calculate an overall score from 0 to 10.

Return ONLY valid JSON:

{{
    "relevance": 0,
    "technical_correctness": 0,
    "completeness": 0,
    "depth": 0,
    "clarity": 0,
    "overall_score": 0,
    "strengths": [],
    "weaknesses": [],
    "feedback": ""
}}
"""

    response = llm.invoke(prompt)

    content = response.content.strip()

    content = content.replace("```json", "")
    content = content.replace("```", "")
    content = content.strip()

    return json.loads(content)


def evaluate_icebreaker_answer(question, answer, resume_text):

    prompt = f"""
You are an interview evaluator assessing an opening icebreaker answer.

QUESTION:
{question}

CANDIDATE ANSWER:
{answer}

CANDIDATE RESUME:
{resume_text}

Evaluate ONLY these icebreaker factors:

1. Resume Relevance
How well does the answer relate to the candidate's stated background, education, projects, experience, or motivation?

2. Clarity
How clearly and understandably is the answer expressed?

3. Communication
How effectively does the candidate communicate the answer in a professional interview setting?

4. Authenticity / Consistency
Does the answer appear consistent with the candidate's resume and avoid unsupported claims?

Give each factor a score from 0 to 10.
Do not evaluate technical knowledge.
Do not include this evaluation in the technical interview score.

Return ONLY valid JSON:

{{
    "resume_relevance": 0,
    "clarity": 0,
    "communication": 0,
    "authenticity_consistency": 0,
    "overall_score": 0,
    "strengths": [],
    "weaknesses": [],
    "feedback": ""
}}
"""

    response = llm.invoke(prompt)
    content = response.content.strip()
    content = content.replace("```json", "").replace("```", "").strip()

    return json.loads(content)


def generate_final_report(
    interview_results,
    candidate_name,
    role
):

    technical_results = [
        r for r in interview_results
        if r.get("question_type") != "icebreaker" and r.get("scored", True)
    ]
    icebreaker_results = [
        r for r in interview_results
        if r.get("question_type") == "icebreaker"
    ]

    prompt = f"""
You are a technical interview evaluator.

Generate a final interview report.

Candidate:
{candidate_name}

Role:
{role}

ICEBREAKER EVALUATIONS:
{json.dumps(icebreaker_results, indent=2)}

TECHNICAL INTERVIEW RESULTS:
{json.dumps(technical_results, indent=2)}

Rules:
- Evaluate the technical interview using ONLY the technical interview results.
- Do NOT include icebreaker scores in overall_score or any technical score.
- Icebreaker evaluations are reported separately.

Return ONLY valid JSON:

{{
    "overall_score": 0,
    "technical_knowledge": 0,
    "problem_solving": 0,
    "communication": 0,
    "answer_relevance": 0,
    "icebreaker_evaluation": {{}},
    "strengths": [],
    "weaknesses": [],
    "recommendations": [],
    "summary": ""
}}

Scores must be from 0 to 10.
Base the evaluation only on the provided interview results.
Do not invent candidate information.
"""

    response = llm.invoke(prompt)
    content = response.content.strip()
    content = content.replace("```json", "").replace("```", "").strip()

    return json.loads(content)


def display_final_report(report):

    print("\n")
    print("=" * 60)
    print("FINAL INTERVIEW RESULT")
    print("=" * 60)

    print(f"\nOverall Score:       {report['overall_score']}/10")
    print(
        f"Technical Knowledge: "
        f"{report['technical_knowledge']}/10"
    )
    print(
        f"Problem Solving:     "
        f"{report['problem_solving']}/10"
    )
    print(
        f"Communication:       "
        f"{report['communication']}/10"
    )
    print(
        f"Answer Relevance:    "
        f"{report['answer_relevance']}/10"
    )

    print("\nIcebreaker Evaluation:")
    icebreaker = report.get("icebreaker_evaluation", {})
    if icebreaker:
        print(f"Resume Relevance:       {icebreaker.get('resume_relevance', 'N/A')}/10")
        print(f"Clarity:                {icebreaker.get('clarity', 'N/A')}/10")
        print(f"Communication:          {icebreaker.get('communication', 'N/A')}/10")
        print(f"Authenticity/Consistency: {icebreaker.get('authenticity_consistency', 'N/A')}/10")
        print(f"Icebreaker Score:       {icebreaker.get('overall_score', 'N/A')}/10")
    else:
        print("No icebreaker evaluation available.")

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


def run_interview(
    questions,
    candidate_name,
    role,
    answer_mode="text",
    answer_provider=None,
    resume_text=""
):
    if not questions:
        raise ValueError("No questions were provided.")

    if answer_mode not in ["text", "voice"]:
        raise ValueError("answer_mode must be 'text' or 'voice'")

    if answer_provider is None:
        raise ValueError("answer_provider is required.")

    interview_results = []
    quit_requested = False

    for index, question_data in enumerate(questions, start=1):

        question = question_data["question"]

        try:
            answer = answer_provider(
                question=question,
                question_number=index,
                total_questions=len(questions),
                answer_mode=answer_mode
            )
        except (KeyboardInterrupt, EOFError):
            quit_requested = True
            break

        if answer is None:
            answer = ""

        answer = answer.strip()

        if answer.lower() in {"quit", ":q", "exit"}:
            quit_requested = True
            break

        if not answer:
            answer = "[No answer provided]"

        if question_data.get("question_type") == "icebreaker":
            evaluation = evaluate_icebreaker_answer(question, answer, resume_text)
        else:
            evaluation = evaluate_answer(question, answer, resume_text)

        result = {
            **question_data,
            "answer": answer,
            "evaluation": evaluation
        }

        interview_results.append(result)

    if not interview_results:
        print("\nInterview cancelled. No answers recorded.")
        return {
            "candidate": candidate_name,
            "role": role,
            "status": "cancelled",
            "questions_attempted": 0,
            "interview_results": [],
            "final_report": None
        }

    final_report = generate_final_report(
        interview_results,
        candidate_name,
        role
    )

    output = {
        "candidate": candidate_name,
        "role": role,
        "status": "cancelled" if quit_requested else "completed",
        "questions_attempted": len(interview_results),
        "interview_results": interview_results,
        "final_report": final_report
    }

    with open(
        "interview_result.json",
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            output,
            file,
            indent=4,
            ensure_ascii=False
        )

    return output


def text_answer_provider(
    question,
    question_number,
    total_questions,
    answer_mode
):
    print("\n")
    print("=" * 60)
    print(f"QUESTION {question_number}/{total_questions}")
    print("=" * 60)
    print(f"\n{question}")

    return input("\nYour answer: ")

def voice_answer_provider(
    question,
    question_number,
    total_questions,
    answer_mode
):
    from voice_interview import record_and_transcribe

    print("\n")
    print("=" * 60)
    print(f"QUESTION {question_number}/{total_questions}")
    print("=" * 60)
    print(f"\n{question}")

    answer = record_and_transcribe()

    print("\nTranscribed answer:")
    print(answer)

    return answer