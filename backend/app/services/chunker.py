"""
Document chunker — splits PDF, TXT, and JSON files into text chunks
suitable for embedding.
"""

from __future__ import annotations

import json
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def chunk_file(content: bytes, filename: str) -> list[str]:
    """
    Extract text from a file and split into chunks.
    Supports: .txt, .md, .log, .pdf, .json
    """
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        text = _extract_pdf(content)
    elif suffix == ".json":
        text = _extract_json(content)
    else:
        # Plain text: .txt, .md, .log, or anything else
        text = content.decode("utf-8", errors="replace")

    chunks = _splitter.split_text(text)
    return [c.strip() for c in chunks if c.strip()]


def _extract_pdf(content: bytes) -> str:
    import io
    reader = PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)


def _extract_json(content: bytes) -> str:
    """
    Flatten a JSON document (e.g. Jira ticket export) into readable text.
    Handles both single objects and arrays.
    """
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return content.decode("utf-8", errors="replace")

    if isinstance(data, list):
        return "\n\n---\n\n".join(_flatten_obj(item) for item in data)
    return _flatten_obj(data)


def _flatten_obj(obj: object, prefix: str = "") -> str:
    """Recursively flatten a dict/list into key: value lines."""
    lines: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            lines.append(_flatten_obj(v, key))
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            lines.append(_flatten_obj(item, f"{prefix}[{i}]"))
    else:
        lines.append(f"{prefix}: {obj}")
    return "\n".join(lines)
