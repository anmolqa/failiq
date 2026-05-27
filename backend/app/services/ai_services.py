from dotenv import load_dotenv
from pathlib import Path
from google import genai
from google.genai import types
import os

load_dotenv()

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "rca_prompt.txt"


def analyze_logs(logs: str, context_chunks: list[dict] | None = None) -> str:
    with open(_PROMPT_PATH, "r") as f:
        prompt_template = f.read()

    # Build the RAG context section
    if context_chunks:
        context_lines = []
        for chunk in context_chunks:
            context_lines.append(
                f"[Source: {chunk['source']} | Relevance: {chunk['relevance']}]\n{chunk['text']}"
            )
        context_text = "\n\n---\n\n".join(context_lines)
    else:
        context_text = "No historical context available."

    prompt = prompt_template.replace("{LOGS}", logs).replace("{CONTEXT}", context_text)

    response = _client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction="You are an expert reliability engineer.",
            temperature=0.2,
        ),
    )
    return response.text
