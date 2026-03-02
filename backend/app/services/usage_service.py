"""
In-memory usage tracking service.

Tracks AI endpoint calls per user per day. Resets automatically at midnight UTC.
When Supabase is configured (S4.3+), this can also persist to a usage_logs table.
"""
from datetime import datetime, timezone, timedelta

# Free tier limits (Pro/Team = unlimited, enforced via plan check)
FREE_LIMITS = {
    "ai_calls": 25,
    "test_gen": 5,
    "code_gen": 5,
}

# Map endpoint names to the usage categories they increment
ENDPOINT_CATEGORIES = {
    "generate": ["ai_calls", "test_gen"],
    "suggest": ["ai_calls", "test_gen"],
    "codegen": ["ai_calls", "code_gen"],
    "chat": ["ai_calls"],
    "voice": ["ai_calls"],
    "diagnose": ["ai_calls"],
    "contract-check": ["ai_calls"],
    "run": ["ai_calls"],
}


class UsageService:
    """In-memory daily usage counter per user."""

    def __init__(self):
        # { user_id: { "date": "2026-03-02", "ai_calls": 5, "test_gen": 2, "code_gen": 0 } }
        self._data = {}

    def _today(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _get_entry(self, user_id: str) -> dict:
        """Get or create today's usage entry for a user. Auto-resets if date changed."""
        today = self._today()
        entry = self._data.get(user_id)
        if not entry or entry.get("date") != today:
            entry = {"date": today, "ai_calls": 0, "test_gen": 0, "code_gen": 0}
            self._data[user_id] = entry
        return entry

    def record(self, user_id: str, endpoint: str):
        """Record a usage event for the given user and endpoint."""
        if user_id == "anonymous":
            return  # Don't track anonymous dev-mode usage
        entry = self._get_entry(user_id)
        categories = ENDPOINT_CATEGORIES.get(endpoint, ["ai_calls"])
        for cat in categories:
            entry[cat] = entry.get(cat, 0) + 1

    def check_limit(self, user_id: str, endpoint: str, plan: str = "free") -> dict | None:
        """Check if a user has exceeded their daily limit for an endpoint's categories.
        Returns dict with exceeded category info, or None if within limits."""
        if user_id == "anonymous" or plan in ("pro", "team"):
            return None  # No limits for dev mode or paid plans
        entry = self._get_entry(user_id)
        categories = ENDPOINT_CATEGORIES.get(endpoint, ["ai_calls"])
        for cat in categories:
            limit = FREE_LIMITS.get(cat, -1)
            used = entry.get(cat, 0)
            if limit > 0 and used >= limit:
                return {"category": cat, "used": used, "limit": limit}
        return None

    def get_today(self, user_id: str, plan: str = "free") -> dict:
        """Get today's usage stats for a user, including limits based on plan."""
        entry = self._get_entry(user_id)
        is_pro = plan in ("pro", "team")

        tomorrow = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)

        return {
            "ai_calls": entry["ai_calls"],
            "test_gen": entry["test_gen"],
            "code_gen": entry["code_gen"],
            "limits": {
                "ai_calls": -1 if is_pro else FREE_LIMITS["ai_calls"],
                "test_gen": -1 if is_pro else FREE_LIMITS["test_gen"],
                "code_gen": -1 if is_pro else FREE_LIMITS["code_gen"],
            },
            "plan": plan,
            "resets_at": tomorrow.isoformat(),
        }


usage_service = UsageService()
