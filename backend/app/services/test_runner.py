import aiohttp
import asyncio
import json
import logging
import time
from typing import List, Dict, Any, Optional

from app.core.security import validate_proxy_url, safe_request, read_bounded_response
from app.services.schema_comparator import (
    compare_to_schema,
    parse_openapi_spec,
    extract_response_schema,
)

logger = logging.getLogger(__name__)

# Maximum number of concurrent tests to prevent DoS amplification
MAX_CONCURRENT_TESTS = 50


class TestRunner:
    async def run_single_test(self, session: aiohttp.ClientSession, test_case: Dict[str, Any]):
        url = test_case.get("url") or test_case.get("endpoint", "")
        method = test_case.get("method", "GET").upper()
        headers = test_case.get("headers", {})
        payload = test_case.get("payload", None)

        if not url:
            return {
                "test_name": test_case.get("name"),
                "status_code": 0,
                "passed": False,
                "error": "No URL provided for this test",
                "duration_ms": 0,
                "size_bytes": 0
            }

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
            async with safe_request(method, url, headers=headers, json=payload, timeout=timeout) as response:
                content = await read_bounded_response(response)
                duration = (time.perf_counter() - start_time) * 1000  # ms

                # Decode response body (truncate to 50KB to avoid memory issues)
                try:
                    body_text = content[:51200].decode('utf-8', errors='replace')
                except Exception:
                    body_text = None

                return {
                    "test_name": test_case.get("name"),
                    "status_code": response.status,
                    "expected_status": test_case.get("expected_status"),
                    "duration_ms": int(duration),
                    "size_bytes": len(content),
                    "passed": response.status == test_case.get("expected_status"),
                    "response_body": body_text,
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

    async def run_contract_check(
        self,
        openapi_spec: str,
        base_url: str,
        endpoints: Optional[List[Dict[str, str]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Runs contract checks against live API endpoints by comparing responses
        to their OpenAPI schema definitions.

        Args:
            openapi_spec: OpenAPI spec as a JSON or YAML string.
            base_url: The base URL for the API.
            endpoints: Optional list of {method, path} to check. Defaults to
                       GET-only endpoints for safety.

        Returns:
            List of results per endpoint with drift details.
        """
        spec = parse_openapi_spec(openapi_spec)
        if not spec:
            return [{"method": "?", "path": "?", "status": "error",
                     "actual_status": 0, "drifts": [], "driftCount": 0,
                     "responseTime": 0, "error": "Failed to parse OpenAPI spec"}]

        # Validate base_url with SSRF protection
        if base_url:
            try:
                await validate_proxy_url(base_url)
            except Exception as e:
                return [{"method": "?", "path": "?", "status": "error",
                         "actual_status": 0, "drifts": [], "driftCount": 0,
                         "responseTime": 0,
                         "error": f"Base URL blocked: {getattr(e, 'detail', str(e))}"}]

        # Determine which endpoints to check
        if endpoints:
            target_endpoints = endpoints
        else:
            # Default: extract GET-only endpoints from the spec for safety
            target_endpoints = []
            paths = spec.get("paths", {})
            for path, path_item in paths.items():
                if not isinstance(path_item, dict):
                    continue
                if "get" in path_item:
                    target_endpoints.append({"method": "GET", "path": path})

        if not target_endpoints:
            return [{"method": "?", "path": "?", "status": "error",
                     "actual_status": 0, "drifts": [], "driftCount": 0,
                     "responseTime": 0, "error": "No endpoints found to check"}]

        # Cap at MAX_CONCURRENT_TESTS to prevent abuse
        target_endpoints = target_endpoints[:MAX_CONCURRENT_TESTS]

        results = []
        timeout = aiohttp.ClientTimeout(total=15)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            for ep in target_endpoints:
                method = ep.get("method", "GET").upper()
                path = ep.get("path", "")
                full_url = f"{base_url.rstrip('/')}{path}"

                # Validate each endpoint URL
                try:
                    await validate_proxy_url(full_url)
                except Exception as e:
                    results.append({
                        "method": method,
                        "path": path,
                        "status": "error",
                        "actual_status": 0,
                        "drifts": [],
                        "driftCount": 0,
                        "responseTime": 0,
                        "error": f"URL blocked: {getattr(e, 'detail', str(e))}",
                    })
                    continue

                start_time = time.perf_counter()
                try:
                    async with safe_request(method, full_url, timeout=timeout) as response:
                        content = await read_bounded_response(response)
                        duration_ms = int((time.perf_counter() - start_time) * 1000)

                        # Try to parse response as JSON
                        try:
                            body_text = content[:51200].decode("utf-8", errors="replace")
                            response_data = json.loads(body_text)
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            response_data = None

                        # Get the expected schema for this endpoint
                        response_schema = extract_response_schema(
                            spec, path, method, str(response.status)
                        )

                        drifts = []
                        if response_schema and response_data is not None:
                            drifts = compare_to_schema(
                                response_data, response_schema, spec
                            )

                        status = "pass" if not drifts else "drift"

                        results.append({
                            "method": method,
                            "path": path,
                            "status": status,
                            "actual_status": response.status,
                            "drifts": drifts,
                            "driftCount": len(drifts),
                            "responseTime": duration_ms,
                        })

                except asyncio.TimeoutError:
                    results.append({
                        "method": method,
                        "path": path,
                        "status": "error",
                        "actual_status": 0,
                        "drifts": [],
                        "driftCount": 0,
                        "responseTime": int((time.perf_counter() - start_time) * 1000),
                        "error": "Request timed out after 15 seconds",
                    })
                except Exception as e:
                    results.append({
                        "method": method,
                        "path": path,
                        "status": "error",
                        "actual_status": 0,
                        "drifts": [],
                        "driftCount": 0,
                        "responseTime": int((time.perf_counter() - start_time) * 1000),
                        "error": str(e),
                    })

        return results

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

        # Normalize URLs — frontend sends URL in "endpoint" field, backend expects "url"
        for t in test_cases:
            # Use "url" if present, otherwise fall back to "endpoint"
            if not t.get("url"):
                t["url"] = t.get("endpoint", "")
            # Only prepend base_url if the URL is relative (not already absolute)
            if t["url"] and not t["url"].startswith("http"):
                t["url"] = f"{base_url.rstrip('/')}/{t['url'].lstrip('/')}" if base_url else t["url"]

        async with aiohttp.ClientSession() as session:
            tasks = [self.run_single_test(session, t) for t in test_cases]
            results = await asyncio.gather(*tasks)
            return results

test_runner = TestRunner()
