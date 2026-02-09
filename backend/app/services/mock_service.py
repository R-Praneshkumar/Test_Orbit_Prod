from typing import Dict, Tuple, Optional, Any
import logging

logger = logging.getLogger(__name__)  

class MockService:
    def __init__(self):
        # Key: (method, path), Value: response_data (dict or list)
        self.mocks: Dict[Tuple[str, str], Any] = {}

    def get_mock(self, method: str, path: str) -> Optional[Any]:
        """Retrieves a mock response if it exists."""
        key = (method.upper(), path)
        return self.mocks.get(key)

    def add_mock(self, method: str, path: str, response_data: Any):
        """Adds or updates a mock response."""
        key = (method.upper(), path)
        self.mocks[key] = response_data
        logger.info(f"Mock added for {method} {path}")

    def clear_mocks(self):
        """Clears all stored mocks."""
        self.mocks.clear()
        logger.info("All mocks cleared")

    def list_mocks(self) -> Dict[str, Any]:
        """Returns a list of active mocks for the frontend."""
        return {
            f"{method} {path}": response 
            for (method, path), response in self.mocks.items()
        }

mock_service = MockService()
