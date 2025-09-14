from dotenv import load_dotenv
load_dotenv()  # this reads your .env file and sets os.environ

# main.py
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os, json

app = FastAPI()

# If you open index.html directly or serve from a different port, enable CORS:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten later if you want
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

class QuizReq(BaseModel):
    notes: str
    n: int = 3

@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/quiz")
def make_quiz(req: QuizReq):
    # Basic validation
    notes = (req.notes or "").strip()
    n = max(1, min(5, int(req.n or 3)))
    if not notes:
        return {"questions": []}

    # Call OpenAI with JSON mode for predictable parsing
    try:
        resp = client.responses.create(
            model="gpt-4o-mini",  # or any model you have access to
            input=[
                {"role": "system",
                 "content": "You are an expert STEM tutor. Generate diverse, high-quality short-answer questions "
                 "that span the ENTIRE content (beginning, middle, end). Mix difficulty (recall, conceptual, application). "
                 "Avoid copying the opening lines verbatim. Return ONLY JSON: {\"questions\": string[]}."},
                {"role": "user",
                 "content": f"Create {n} short-answer questions from these notes:\n{notes}"}
            ],
            response_format={"type": "json_object"},
        )
        raw = getattr(resp, "output_text", None)
        if not raw:
            # Fallback shape handling
            raw = (resp.output[0].content[0].text if getattr(resp, "output", None) else "{}")
        data = json.loads(raw)
        qs = data.get("questions", [])
        # Normalize to strings, and guard length
        qs = [str(q).strip() for q in qs][:5]
        if not qs:
            # final fallback if model returned unexpected shape
            qs = fallback_questions(notes, n)
        return {"questions": qs}
    except Exception as e:
        # Log server-side details and still return something
        print("openai error:", repr(e))
        return {"questions": fallback_questions(notes, n)}

def fallback_questions(notes: str, n: int):
    lines = [ln.strip().strip("-• ") for ln in notes.splitlines() if ln.strip()]
    seeds = [ln for ln in lines if len(ln) > 10][:10] or ["Summarize the main idea."]
    qs = []
    for i in range(n):
        base = seeds[i % len(seeds)]
        qs.append(f"Explain: {base.rstrip(':.?;')}")
    return qs

