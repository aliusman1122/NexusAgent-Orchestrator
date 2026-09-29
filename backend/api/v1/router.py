"""API v1 master router aggregating endpoints."""

from fastapi import APIRouter
from backend.api.v1.endpoints import admin, chat

router = APIRouter()

router.include_router(chat.router, tags=["Chat"])
router.include_router(admin.router, tags=["Admin"])

__all__ = ["router"]
