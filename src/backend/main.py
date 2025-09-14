from dotenv import load_dotenv
load_dotenv()  # this reads your .env file and sets os.environ

# main.py
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os, json, re
from collections import OrderedDict

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    notes = (req.notes or "").strip()
    n = max(1, min(5, int(req.n or 3)))
    if not notes:
        return {"questions": []}

    try:
        # Use Chat Completions with JSON mode
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0.8,
            presence_penalty=0.3,
            frequency_penalty=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert STEM tutor. Generate DIVERSE, high-quality short-answer questions "
                        "that cover the ENTIRE notes (beginning, middle, end). Include a mix: recall, concept, "
                        "application, comparison, example/edge case, and calculation (if applicable). "
                        "Avoid repeating stems and avoid copying the opening lines verbatim. "
                        "Return ONLY valid JSON: {\"questions\": string[]} with exactly the requested count."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Create {n} varied short-answer questions from these notes:\n{notes}"
                }
            ],
        )

        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        qs = data.get("questions", [])
        qs = [str(q).strip() for q in qs if str(q).strip()]

        # Deduplicate while preserving order and normalize minor punctuation/case diffs
        def norm(s: str) -> str:
            s2 = re.sub(r"\s+", " ", s.strip().lower())
            s2 = re.sub(r"[.?!]+$", "", s2)
            return s2

        seen = set()
        unique_qs = []
        for q in qs:
            k = norm(q)
            if k not in seen:
                seen.add(k)
                unique_qs.append(q)

        # Guard: if model under-delivers, top up with a diversified fallback
        if len(unique_qs) < n:
            unique_qs += diversified_fallback(notes, n - len(unique_qs))

        return {"questions": unique_qs[:n]}

    except Exception as e:
        print("openai error:", repr(e))
        return {"questions": diversified_fallback(notes, n)}

# A smarter fallback that mixes stems and reduces duplicates
def diversified_fallback(notes: str, n: int):
    # Extract candidate lines from the notes
    lines = [ln.strip(" -•\t") for ln in notes.splitlines() if ln.strip()]
    # Prefer non-tiny, non-heading-y lines
    seeds = [ln for ln in lines if len(ln) > 12][:20] or ["the main idea of the notes"]

    stems = [
        "Define: {}",
        "Why is this important: {}",
        "How does {} work?",
        "Compare and contrast {} with a related concept.",
        "Give a concrete example of {}.",
        "What problem does {} solve, and how?",
        "List key assumptions behind {}.",
        "Compute/estimate a value related to {} (show steps).",
        "What could go wrong or be misunderstood about {}?",
        "Explain how {} connects to another topic in the notes.",
    ]

    out = []
    i = 0
    while len(out) < n:
        base = seeds[i % len(seeds)].rstrip(":.?;")
        stem = stems[i % len(stems)]
        q = stem.format(base)
        out.append(q)
        i += 1

    # Deduplicate lightly
    seen = OrderedDict()
    for q in out:
        seen[q] = True
    return list(seen.keys())[:n]

