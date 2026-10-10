"""
In-memory usage tracking service.

Tracks AI endpoint calls per user per day. Resets automatically at midnight UTC.
When Supabase is configured (S4.3+), this can also persist to a usage_logs table.
"""
from datetime import datetime, timezone, timedelta

USAGE_CATEGORIES = ("ai_calls", "test_gen", "code_gen", "security_scan")

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
    "security-scan": ["ai_calls", "security_scan"],
    "perf-analyze": ["ai_calls"],
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
            entry = {"date": today, "ai_calls": 0, "test_gen": 0, "code_gen": 0, "security_scan": 0}
            self._data[user_id] = entry
        # Ensure security_scan key exists for entries created before this field was added
        entry.setdefault("security_scan", 0)
        return entry

    def record(self, user_id: str, endpoint: str):
        """Record a usage event for the given user and endpoint."""
        if user_id == "anonymous":
            return  # Don't track anonymous dev-mode usage
        entry = self._get_entry(user_id)
        categories = ENDPOINT_CATEGORIES.get(endpoint, ["ai_calls"])
        for cat in categories:
            entry[cat] = entry.get(cat, 0) + 1

    def get_today(self, user_id: str) -> dict:
        """Return informational counters; endpoint rate limits still apply."""
        entry = self._get_entry(user_id)

        tomorrow = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)

        return {
            "ai_calls": entry["ai_calls"],
            "test_gen": entry["test_gen"],
            "code_gen": entry["code_gen"],
            "security_scan": entry.get("security_scan", 0),
            "resets_at": tomorrow.isoformat(),
        }


usage_service = UsageService()
