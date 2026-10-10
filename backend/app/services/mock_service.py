from typing import Any, Optional
import json
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
MOCKS_FILE = os.path.join(DATA_DIR, "mocks.json")


class MockService:
    def __init__(self):
        self.mocks: dict[tuple[str, str, str], dict] = {}
        self._load_from_file()

    def _load_from_file(self):
        """Load mocks from JSON file on startup."""
        try:
            if os.path.exists(MOCKS_FILE):
                with open(MOCKS_FILE, "r") as f:
                    data = json.load(f)
                for entry in data:
                    key = (entry.get("user_id", "anonymous"), entry["method"], entry["path"])
                    self.mocks[key] = {
                        "response": entry["response"],
                        "created_at": entry.get("created_at", datetime.now().isoformat()),
                    }
                logger.info(f"Loaded {len(self.mocks)} mocks from {MOCKS_FILE}")
        except Exception as e:
            logger.warning(f"Could not load mocks file: {e}")

    def _save_to_file(self):
        """Persist mocks to JSON file."""
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            data = []
            for (user_id, method, path), value in self.mocks.items():
                data.append({
                    "user_id": user_id,
                    "method": method,
                    "path": path,
                    "response": value["response"],
                    "created_at": value.get("created_at", datetime.now().isoformat()),
                })
            with open(MOCKS_FILE, "w") as f:
                json.dump(data, f, indent=2, default=str)
            logger.info(f"Saved {len(self.mocks)} mocks to {MOCKS_FILE}")
        except Exception as e:
            logger.error(f"Could not save mocks file: {e}")

    def get_mock(self, method: str, path: str, user_id: str = "anonymous") -> Optional[Any]:
        key = (user_id, method.upper(), path)
        entry = self.mocks.get(key)
        return entry["response"] if entry else None

    def add_mock(self, method: str, path: str, response_data: Any, user_id: str = "anonymous"):
        key = (user_id, method.upper(), path)
        self.mocks[key] = {
            "response": response_data,
            "created_at": datetime.now().isoformat(),
        }
        logger.info(f"Mock added for {method} {path}")
        self._save_to_file()

    def delete_mock(self, method: str, path: str, user_id: str = "anonymous") -> bool:
        """Delete a single mock. Returns True if it existed."""
        key = (user_id, method.upper(), path)
        if key in self.mocks:
            del self.mocks[key]
            logger.info(f"Mock deleted for {method} {path}")
            self._save_to_file()
            return True
        return False

    def clear_mocks(self, user_id: str = "anonymous"):
        self.mocks = {key: value for key, value in self.mocks.items() if key[0] != user_id}
        if self.mocks:
            self._save_to_file()
        elif os.path.exists(MOCKS_FILE):
            os.remove(MOCKS_FILE)

    def list_mocks(self, user_id: str = "anonymous") -> list[dict]:
        return [
            {
                "method": method,
                "path": path,
                "created_at": value.get("created_at"),
                "response_preview": str(value["response"])[:200],
            }
            for (owner_id, method, path), value in self.mocks.items()
            if owner_id == user_id
        ]


mock_service = MockService()
