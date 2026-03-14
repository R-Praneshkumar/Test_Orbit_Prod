"""
Admin dashboard API routes.

Protected endpoints that require the caller's JWT email to be in ADMIN_EMAILS.
Provides usage metrics, active user counts, and endpoint analytics.
"""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException, Depends

from app.core.config import get_settings
from app.core.security import verify_token
from app.services.usage_service import usage_service, ENDPOINT_CATEGORIES, FREE_LIMITS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])
_settings = get_settings()

# Parse admin emails once at import time
_admin_emails = {e.strip().lower() for e in _settings.ADMIN_EMAILS.split(",") if e.strip()}


def _require_admin(user: dict):
    """Raise 403 if user is not an admin."""
    email = user.get("email", "").lower()
    # In dev mode with no ADMIN_EMAILS configured, allow anonymous access
    if not _admin_emails and not _settings.REQUIRE_AUTH:
        return
    if email not in _admin_emails:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/check")
async def admin_check(request: Request, user: dict = Depends(verify_token)):
    """Lightweight admin check — returns 200 if admin, 403 if not."""
    _require_admin(user)
    return {"is_admin": True}


@router.get("/stats")
async def admin_stats(request: Request, user: dict = Depends(verify_token)):
    """
    Return admin dashboard statistics:
    - Active users (unique users with usage today / this week / this month)
    - Usage by endpoint category
    - Per-user breakdown (top users by usage)
    - System info (uptime, plan limits)
    """
    _require_admin(user)

    data = usage_service._data
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    # Calculate date ranges
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")

    # Aggregate stats
    dau = 0  # daily active users
    wau = set()
    mau = set()
    total_ai_calls_today = 0
    total_test_gen_today = 0
    total_code_gen_today = 0
    total_security_scan_today = 0

    # Per-endpoint totals (today only)
    endpoint_usage = {cat: 0 for cat in FREE_LIMITS}

    # Top users by AI calls today
    user_breakdown = []

    for uid, entry in data.items():
        entry_date = entry.get("date", "")

        # DAU/WAU/MAU
        if entry_date == today:
            dau += 1
            total_ai_calls_today += entry.get("ai_calls", 0)
            total_test_gen_today += entry.get("test_gen", 0)
            total_code_gen_today += entry.get("code_gen", 0)
            total_security_scan_today += entry.get("security_scan", 0)

            for cat in FREE_LIMITS:
                endpoint_usage[cat] += entry.get(cat, 0)

            user_breakdown.append({
                "user_id": uid[:8] + "...",  # Truncated for privacy
                "ai_calls": entry.get("ai_calls", 0),
                "test_gen": entry.get("test_gen", 0),
                "code_gen": entry.get("code_gen", 0),
                "security_scan": entry.get("security_scan", 0),
            })

        if entry_date >= week_ago:
            wau.add(uid)
        if entry_date >= month_ago:
            mau.add(uid)

    # Sort top users by AI calls descending
    user_breakdown.sort(key=lambda u: u["ai_calls"], reverse=True)

    return {
        "timestamp": now.isoformat(),
        "active_users": {
            "dau": dau,
            "wau": len(wau),
            "mau": len(mau),
        },
        "usage_today": {
            "ai_calls": total_ai_calls_today,
            "test_gen": total_test_gen_today,
            "code_gen": total_code_gen_today,
            "security_scan": total_security_scan_today,
        },
        "endpoint_usage": endpoint_usage,
        "top_users": user_breakdown[:20],
        "plan_limits": FREE_LIMITS,
        "tracked_endpoints": list(ENDPOINT_CATEGORIES.keys()),
        "total_tracked_users": len(data),
    }
