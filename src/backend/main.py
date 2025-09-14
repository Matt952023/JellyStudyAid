from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
import os, json

load_dotenv()  # reads .env file automatically

app = FastAPI()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

class QuizReq(BaseModel):
    notes: str
    n: int = 3

@app.post("/api/quiz")
def make_quiz(req: QuizReq):
    if not req.notes.strip():
        return {"questions": []}
    n = max(1, min(5, int(req.n or 3)))
    resp = client.responses.create(
        model="gpt-4o-mini",
        input=[
            {"role":"system","content":"You are a helpful study quiz generator. Return ONLY JSON: {\"questions\": string[]}."},
            {"role":"user","content":f"Generate {n} short-answer questions based on these notes:\n{req.notes}"}
        ],
        response_format={"type":"json_object"}
    )
    raw = getattr(resp, "output_text", None)
    if not raw:
        # fallback extraction if SDK shape differs
        raw = (resp.output[0].content[0].text if getattr(resp, "output", None) else "{}")
    data = json.loads(raw)
    return {"questions": list(data.get("questions", []))[:5]}
