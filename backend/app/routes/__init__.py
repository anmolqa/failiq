from backend.app.routes.analyze import router as analyze_router
from backend.app.routes.ingest import router as ingest_router

from fastapi import APIRouter

router = APIRouter()
router.include_router(analyze_router)
router.include_router(ingest_router)
