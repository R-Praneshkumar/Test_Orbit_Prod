"""
Digest email API routes.

Admin-only endpoints to preview and trigger the weekly digest email.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.security import verify_token
from app.services.digest_service import build_digest_html, send_digest_email
from app.api.admin_routes import _require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/digest", tags=["Digest Email"])


class DigestSendRequest(BaseModel):
    to_emails: list[str]


@router.get("/preview")
async def preview_digest(request: Request, user: dict = Depends(verify_token)):
    """Preview the weekly digest without sending it. Admin only."""
    _require_admin(user)
    digest = build_digest_html()
    return {
        "subject": digest["subject"],
        "stats": digest["stats"],
        "period": digest["period"],
        "html": digest["html"],
    }


@router.post("/send")
async def trigger_digest(body: DigestSendRequest, request: Request, user: dict = Depends(verify_token)):
    """Send the weekly digest to specified email addresses. Admin only."""
    _require_admin(user)

    if not body.to_emails:
        raise HTTPException(status_code=400, detail="At least one recipient email required")

    if len(body.to_emails) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 recipients per send")

    result = await send_digest_email(body.to_emails)

    if not result["sent"]:
        raise HTTPException(status_code=502, detail=result["error"])

    return result
