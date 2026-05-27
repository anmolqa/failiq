from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from backend.app.services.parser import clean_logs
from backend.app.services.ai_services import analyze_logs
from backend.app.services.embedder import retrieve

router = APIRouter()


@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_logs = content.decode("utf-8")

        cleaned_logs = clean_logs(raw_logs)

        # Retrieve relevant historical context from the knowledge base
        context_chunks = retrieve(cleaned_logs, n_results=5)

        result = analyze_logs(cleaned_logs, context_chunks=context_chunks)

        return {
            "analysis": result,
            "context_used": len(context_chunks),
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )
