import aiohttp
import asyncio
import logging
import time
from typing import List, Dict, Any

from app.core.security import validate_proxy_url

logger = logging.getLogger(__name__)

# Maximum number of concurrent tests to prevent DoS amplification
MAX_CONCURRENT_TESTS = 50


class TestRunner:
    async def run_single_test(self, session: aiohttp.ClientSession, test_case: Dict[str, Any]):
        url = test_case.get("url")  # User provided base URL + endpoint
        method = test_case.get("method", "GET").upper()
        headers = test_case.get("headers", {})
        payload = test_case.get("payload", None)

        # Validate URL against SSRF before making the request
        try:
            await validate_proxy_url(url)
        except Exception as e:
            return {
                "test_name": test_case.get("name"),
                "status_code": 0,
                "passed": False,
                "error": f"URL blocked by security policy: {getattr(e, 'detail', str(e))}",
                "duration_ms": 0,
                "size_bytes": 0
            }

        # Validate HTTP method
        allowed_methods = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}
        if method not in allowed_methods:
            return {
                "test_name": test_case.get("name"),
                "status_code": 0,
                "passed": False,
                "error": f"Invalid HTTP method: {method}",
                "duration_ms": 0,
                "size_bytes": 0
            }

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
        # Enforce concurrency limit to prevent DoS amplification
        if len(test_cases) > MAX_CONCURRENT_TESTS:
            logger.warning(f"Test batch size {len(test_cases)} exceeds limit {MAX_CONCURRENT_TESTS}, truncating")
            test_cases = test_cases[:MAX_CONCURRENT_TESTS]

        # Validate base_url if provided
        if base_url:
            try:
                await validate_proxy_url(base_url)
            except Exception as e:
                return [{
                    "test_name": "batch_validation",
                    "status_code": 0,
                    "passed": False,
                    "error": f"Base URL blocked by security policy: {getattr(e, 'detail', str(e))}",
                    "duration_ms": 0,
                    "size_bytes": 0
                }]

        # Normalize URLs
        for t in test_cases:
            if not t.get("url", "").startswith("http"):
                 t["url"] = f"{base_url}{t.get('endpoint', '')}"

        async with aiohttp.ClientSession() as session:
            tasks = [self.run_single_test(session, t) for t in test_cases]
            results = await asyncio.gather(*tasks)
            return results

test_runner = TestRunner()
