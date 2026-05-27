"""
ChromaDB vector store wrapper.
Uses a custom embedding function built on the new google.genai SDK
(avoids the deprecated google.generativeai / chromadb integration bug).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from google import genai
import chromadb
from chromadb import EmbeddingFunction, Documents, Embeddings

load_dotenv()

_DB_PATH = Path(__file__).parent.parent / "db" / "chroma"
_COLLECTION_NAME = "failiq_knowledge"

# ── Custom embedding function using new google.genai SDK ──────────────────────

class GeminiEmbeddingFunction(EmbeddingFunction):
    def __init__(self, api_key: str, model: str = "models/text-embedding-004"):
        self._client = genai.Client(api_key=api_key)
        self._model = model

    def __call__(self, input: Documents) -> Embeddings:
        result = self._client.models.embed_content(
            model=self._model,
            contents=list(input),
        )
        return [e.values for e in result.embeddings]


_embedding_fn = GeminiEmbeddingFunction(
    api_key=os.getenv("GEMINI_API_KEY", ""),
    model="models/gemini-embedding-001",
)

# ── ChromaDB client ───────────────────────────────────────────────────────────

_db_client = chromadb.PersistentClient(path=str(_DB_PATH))

_collection = _db_client.get_or_create_collection(
    name=_COLLECTION_NAME,
    embedding_function=_embedding_fn,
    metadata={"hnsw:space": "cosine"},
)


# ── Public API ────────────────────────────────────────────────────────────────

def add_chunks(chunks: List[str], doc_id: str, source_name: str) -> None:
    """Embed and store a list of text chunks from a document."""
    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [
        {"doc_id": doc_id, "source": source_name, "chunk_index": i}
        for i in range(len(chunks))
    ]
    _collection.add(documents=chunks, ids=ids, metadatas=metadatas)


def retrieve(query: str, n_results: int = 5) -> List[dict]:
    """Retrieve the top-N most relevant chunks for a query."""
    if _collection.count() == 0:
        return []
    results = _collection.query(
        query_texts=[query],
        n_results=min(n_results, _collection.count()),
        include=["documents", "metadatas", "distances"],
    )
    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "text": doc,
            "source": meta.get("source", "unknown"),
            "doc_id": meta.get("doc_id", ""),
            "relevance": round(1 - dist, 3),
        })
    return chunks


def list_documents() -> List[dict]:
    """Return a deduplicated list of ingested documents."""
    if _collection.count() == 0:
        return []
    results = _collection.get(include=["metadatas"])
    seen: dict[str, dict] = {}
    for meta in results["metadatas"]:
        doc_id = meta.get("doc_id", "")
        if doc_id not in seen:
            seen[doc_id] = {"doc_id": doc_id, "source": meta.get("source", "unknown")}
    return list(seen.values())


def delete_document(doc_id: str) -> int:
    """Delete all chunks belonging to a document. Returns number of chunks deleted."""
    results = _collection.get(where={"doc_id": doc_id}, include=["metadatas"])
    ids = results["ids"]
    if ids:
        _collection.delete(ids=ids)
    return len(ids)
