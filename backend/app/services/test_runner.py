import aiohttp
import asyncio
import time
from typing import List, Dict, Any

class TestRunner:
    async def run_single_test(self, session: aiohttp.ClientSession, test_case: Dict[str, Any]):
        url = test_case.get("url")  # User provided base URL + endpoint
        method = test_case.get("method", "GET")
        headers = test_case.get("headers", {})
        payload = test_case.get("payload", None)
        
        start_time = time.perf_counter()
        try:
            # Add strict timeout (10 seconds) to prevent hanging
            timeout = aiohttp.ClientTimeout(total=10)
            async with session.request(method, url, headers=headers, json=payload, timeout=timeout) as response:
                content = await response.read()
                duration = (time.perf_counter() - start_time) * 1000  # ms
                
                return {
                    "test_name": test_case.get("name"),
                    "status_code": response.status,
                    "expected_status": test_case.get("expected_status"),
                    "duration_ms": int(duration),
                    "size_bytes": len(content),
                    "passed": response.status == test_case.get("expected_status"),
                    "error": None
                }
        except Exception as e:
            return {
                "test_name": test_case.get("name"),
                "status_code": 0,
                "passed": False,
                "error": str(e),
                "duration_ms": 0,
                "size_bytes": 0
            }

    async def run_batch(self, test_cases: List[Dict[str, Any]], base_url: str = ""):
        # Normalize URLs
        for t in test_cases:
            if not t.get("url", "").startswith("http"):
                 t["url"] = f"{base_url}{t.get('endpoint', '')}"

        async with aiohttp.ClientSession() as session:
            tasks = [self.run_single_test(session, t) for t in test_cases]
            results = await asyncio.gather(*tasks)
            return results

test_runner = TestRunner()
