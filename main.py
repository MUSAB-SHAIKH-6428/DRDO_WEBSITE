import os
import json
import pandas as pd

from dotenv import load_dotenv

from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq


# ENV

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in .env")



llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0,
    api_key=GROQ_API_KEY
)

QUESTION_BANK_PATH = "./Sample_Files/DRDO_150_Question_Bank.csv"

CHROMA_PATH = "./chroma_db"

COLLECTION_NAME = "interview_question_bank"


DEFAULT_JD = """
Software & Systems Engineer

Organization:
Defence Research & Technology Division

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
- Telemetry

Responsibilities:
- Develop software systems for technical and defence-oriented applications.
- Write efficient and maintainable software.
- Debug and troubleshoot complex software problems.
- Work with system-level components.
- Design and implement algorithms.
- Work with databases and data processing systems.
- Collaborate with engineering teams.
"""


embedding_model = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5"
)


def get_vectorstore():

    if os.path.exists(CHROMA_PATH):

        print("Loading existing Chroma vector store...")

        vectorstore = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=embedding_model,
            persist_directory=CHROMA_PATH
        )

        print("Existing Chroma vector store loaded.")

        return vectorstore
    
    # Otherwise create it
    

    print("Creating Chroma vector store...")

    question_df = pd.read_csv(QUESTION_BANK_PATH)

    print("Question bank loaded:", len(question_df))

    question_docs = []

    for _, row in question_df.iterrows():

        metadata = {
            "question_id": row["question_id"],
            "domain": row["domain"],
            "topic": row["topic"],
            "difficulty": row["difficulty"],
            "question_type": row["question_type"],
            "source": row["source"],
            "language": row["language"],
            "content_type": row["content_type"]
        }

        document = Document(
            page_content=row["question"],
            metadata=metadata
        )

        question_docs.append(document)

    vectorstore = Chroma.from_documents(
        documents=question_docs,
        embedding=embedding_model,
        collection_name=COLLECTION_NAME,
        persist_directory=CHROMA_PATH
    )

    print("Chroma vector store created.")

    return vectorstore



# LOAD RESUME


def load_resume(resume_path):
    if not os.path.exists(resume_path):
        raise FileNotFoundError(f"Resume not found: {resume_path}")

    loader = PyPDFLoader(resume_path)
    resume_docs = loader.load()

    return "\n".join(
        doc.page_content
        for doc in resume_docs
    )


def extract_candidate_profile(resume_text):
    prompt = f"""
Extract a candidate profile using ONLY information explicitly present in this resume.

RESUME:
{resume_text}

Return ONLY valid JSON:
{{
    "name": "",
    "education": [],
    "experience": [],
    "skills": [],
    "projects": [],
    "certifications": [],
    "background_summary": ""
}}

Do not invent information. Keep the candidate name exactly as written.
"""

    response = llm.invoke(prompt)
    content = response.content.strip()
    content = content.replace("```json", "").replace("```", "").strip()
    data = json.loads(content)

    if not data.get("name"):
        raise ValueError("Candidate name could not be extracted from resume.")

    return data


def generate_icebreakers(candidate_profile, resume_text):
    prompt = f"""
Create exactly 2 short opening interview questions based ONLY on the candidate's resume.

CANDIDATE PROFILE:
{json.dumps(candidate_profile, indent=2)}

RESUME:
{resume_text}

Rules:
- Ask about background, education, projects, experience, motivation, or stated work.
- Do not ask deep technical questions.
- Do not invent experience.
- Make the two questions cover different parts of the background.
- Return ONLY valid JSON.

{{
    "questions": ["Question 1", "Question 2"]
}}
"""

    response = llm.invoke(prompt)
    content = response.content.strip()
    content = content.replace("```json", "").replace("```", "").strip()
    data = json.loads(content)
    questions = data["questions"]

    if len(questions) != 2:
        raise ValueError(f"Expected 2 icebreakers, got {len(questions)}")

    return [
        {
            "question_number": index,
            "question": question,
            "source": "ai",
            "question_type": "icebreaker",
            "scored": False
        }
        for index, question in enumerate(questions, start=1)
    ]


def get_interview_domain(role):

    role = role.lower()

    if any(term in role for term in [
        "software",
        "systems",
        "software engineer",
        "systems engineer"
    ]):
        return "Software & Systems"

    if any(term in role for term in [
        "data",
        "ai",
        "machine learning",
        "ml",
        "data engineer"
    ]):
        return "Data & AI"

    if any(term in role for term in [
        "mechanical",
        "mechanical engineer"
    ]):
        return "Mechanical Engineering"

    raise ValueError(
        f"Could not determine interview domain for role: {role}"
    )


# GENERATE QUESTIONS


def generate_interview_questions(role, jd, resume_text):

    print("\nGenerating personalized interview...")

    vectorstore = get_vectorstore()

    domain = get_interview_domain(role)

    retrieval_query = f"""
Candidate Resume:

{resume_text}


Job Description:

{jd}


Interview Role:

{role}


Find interview questions relevant to this candidate
and this role.

Prioritize:
- Candidate skills
- Candidate experience
- Required JD skills
- Resume/JD overlap
- Technical depth
- Practical scenarios
"""

    retrieved_docs = vectorstore.similarity_search(
        retrieval_query,
        k=15,
        filter={"domain": domain}
    )

    print(
        f"Retrieved {len(retrieved_docs)} questions "
        f"from domain: {domain}"
    )

    for doc in retrieved_docs:
        print(
            f"{doc.metadata['question_id']} | "
            f"{doc.metadata['domain']} | "
            f"{doc.metadata['topic']}"
        )

    retrieved_questions = "\n".join(
        f"""
[{doc.metadata["question_id"]}]
Domain: {doc.metadata["domain"]}
Topic: {doc.metadata["topic"]}
Difficulty: {doc.metadata["difficulty"]}
Type: {doc.metadata["question_type"]}
Question: {doc.page_content}
"""
        for doc in retrieved_docs
    )

    prompt = f"""
You are a technical interview question selector.

Create a personalized technical interview for the candidate.

========================
CANDIDATE RESUME
========================

{resume_text}


========================
JOB DESCRIPTION
========================

{jd}


========================
RETRIEVED QUESTION BANK
========================

{retrieved_questions}


========================
INSTRUCTIONS
========================

Generate exactly 5 technical interview questions.

Rules:

1. Questions must be relevant to the job description.

2. Questions must match the candidate's actual resume.

3. Prefer skills that appear in both the resume and JD.

4. Do not invent candidate experience.

5. Do not ask about unrelated technologies.

6. Progress from fundamentals to deeper technical questions.

7. Include practical/scenario-based questions where appropriate.

8. Use the retrieved question bank as the source.

9. You may slightly adapt retrieved questions to
   personalize them.

10. Return ONLY valid JSON.

Use exactly this format:

{{
    "questions": [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5"
    ]
}}
"""

    response = llm.invoke(prompt)

    content = response.content.strip()

    content = content.replace("```json", "")
    content = content.replace("```", "")
    content = content.strip()

    data = json.loads(content)

    questions = data["questions"]

    if len(questions) != 5:
        raise ValueError(
            f"Expected 5 questions, got {len(questions)}"
        )

    print("\n5 technical interview questions generated.")

    return [
        {
            "question": question,
            "source": "ai",
            "question_type": "technical",
            "scored": True
        }
        for question in questions
    ]

