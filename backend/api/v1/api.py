"""API v1 master router aggregating endpoints."""

from fastapi import APIRouter
from backend.api.v1.endpoints import admin, chat

api_router = APIRouter()

api_router.include_router(chat.router, tags=["Chat"])
api_router.include_router(admin.router, tags=["Admin"])
