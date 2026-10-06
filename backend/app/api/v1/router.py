from fastapi import APIRouter

from app.api.v1 import admin, health, registration_status, registrations

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(registration_status.router)
api_router.include_router(registrations.router)
api_router.include_router(admin.router)
