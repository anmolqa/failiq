"""
Knowledge base ingestion routes.

POST   /ingest                — upload a document into the vector store
GET    /knowledge             — list all ingested documents
DELETE /knowledge/{doc_id}   — remove a document from the vector store
"""

import uuid
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

from backend.app.services.chunker import chunk_file
from backend.app.services.embedder import add_chunks, list_documents, delete_document

router = APIRouter()


@router.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename or "unknown"

        chunks = chunk_file(content, filename)
        if not chunks:
            return JSONResponse(status_code=400, content={"error": "No text could be extracted from the file."})

        doc_id = str(uuid.uuid4())
        add_chunks(chunks, doc_id=doc_id, source_name=filename)

        return {
            "doc_id": doc_id,
            "source": filename,
            "chunks_ingested": len(chunks),
            "message": f"Successfully ingested '{filename}' ({len(chunks)} chunks).",
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/knowledge")
async def knowledge():
    try:
        docs = list_documents()
        return {"documents": docs, "total": len(docs)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.delete("/knowledge/{doc_id}")
async def delete_knowledge(doc_id: str):
    try:
        deleted = delete_document(doc_id)
        if deleted == 0:
            return JSONResponse(status_code=404, content={"error": f"Document '{doc_id}' not found."})
        return {"doc_id": doc_id, "chunks_deleted": deleted, "message": "Document removed from knowledge base."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
