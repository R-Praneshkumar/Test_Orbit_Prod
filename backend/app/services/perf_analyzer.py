"""
AI Performance Analyzer — holistic collection run analysis.

Analyzes collection run results as a whole to identify:
- Slow endpoints (>500ms)
- Response size outliers
- Caching opportunities (missing Cache-Control)
- N+1 query patterns (sequential calls that could be batched)
- Compression opportunities (large uncompressed responses)
"""
import json
import asyncio
import logging
from google.genai import types
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)


class PerfAnalyzer:
    """Analyzes a batch of API request/response results for performance insights."""

    # Thresholds
    SLOW_MS = 500
    LARGE_BYTES = 50_000  # 50KB
    VERY_LARGE_BYTES = 200_000  # 200KB

    def _deterministic_analysis(self, results: list[dict]) -> dict:
        """Fast, no-AI analysis of common performance issues."""
        findings = []
        slow_endpoints = []
        large_responses = []
        missing_cache = []
        missing_compression = []

        for r in results:
            name = r.get("name", "Unknown")
            method = r.get("method", "GET")
            duration = r.get("duration_ms", 0)
            size = r.get("size_bytes", 0)
            resp_headers = r.get("response_headers") or {}
            # Normalize header keys to lowercase
            headers_lower = {k.lower(): v for k, v in resp_headers.items()}

            # Slow endpoint detection
            if duration > self.SLOW_MS:
                slow_endpoints.append({
                    "name": name, "method": method,
                    "duration_ms": duration, "size_bytes": size,
                })

            # Large response detection
            if size > self.LARGE_BYTES:
                large_responses.append({
                    "name": name, "method": method,
                    "size_bytes": size, "duration_ms": duration,
                })

            # Caching opportunity — GET requests without Cache-Control
            if method.upper() == "GET" and "cache-control" not in headers_lower:
                missing_cache.append({"name": name, "method": method, "size_bytes": size})

            # Compression opportunity — large responses without content-encoding
            if size > self.LARGE_BYTES and "content-encoding" not in headers_lower:
                missing_compression.append({
                    "name": name, "method": method,
                    "size_bytes": size,
                    "potential_saving": f"~{int(size * 0.7)}B with gzip",
                })

        # Build findings
        if slow_endpoints:
            findings.append({
                "category": "slow_endpoints",
                "title": "Slow Endpoints Detected",
                "severity": "high" if any(e["duration_ms"] > 2000 for e in slow_endpoints) else "medium",
                "description": f"{len(slow_endpoints)} endpoint(s) exceeded {self.SLOW_MS}ms threshold.",
                "endpoints": slow_endpoints[:10],
            })

        if large_responses:
            findings.append({
                "category": "large_responses",
                "title": "Large Response Payloads",
                "severity": "high" if any(e["size_bytes"] > self.VERY_LARGE_BYTES for e in large_responses) else "medium",
                "description": f"{len(large_responses)} response(s) exceeded {self.LARGE_BYTES // 1000}KB.",
                "endpoints": large_responses[:10],
            })

        if missing_cache:
            findings.append({
                "category": "caching",
                "title": "Missing Cache-Control Headers",
                "severity": "medium",
                "description": f"{len(missing_cache)} GET endpoint(s) lack Cache-Control headers.",
                "endpoints": missing_cache[:10],
            })

        if missing_compression:
            findings.append({
                "category": "compression",
                "title": "Compression Opportunities",
                "severity": "low",
                "description": f"{len(missing_compression)} large response(s) lack content encoding (gzip/br).",
                "endpoints": missing_compression[:10],
            })

        # N+1 pattern detection — sequential similar GETs to same base path
        n1_candidates = self._detect_n1_patterns(results)
        if n1_candidates:
            findings.append({
                "category": "n_plus_one",
                "title": "Potential N+1 Query Pattern",
                "severity": "high",
                "description": f"{len(n1_candidates)} group(s) of sequential calls to the same endpoint pattern detected.",
                "endpoints": n1_candidates[:5],
            })

        # Compute summary stats
        times = [r.get("duration_ms", 0) for r in results]
        sizes = [r.get("size_bytes", 0) for r in results]
        total_time = sum(times)
        avg_time = round(total_time / len(times)) if times else 0
        p95_time = sorted(times)[int(len(times) * 0.95)] if len(times) >= 2 else (times[0] if times else 0)

        stats = {
            "total_requests": len(results),
            "total_time_ms": total_time,
            "avg_time_ms": avg_time,
            "p95_time_ms": p95_time,
            "max_time_ms": max(times) if times else 0,
            "total_size_bytes": sum(sizes),
            "slow_count": len(slow_endpoints),
            "large_count": len(large_responses),
        }

        return {"findings": findings, "stats": stats}

    def _detect_n1_patterns(self, results: list[dict]) -> list[dict]:
        """Detect sequential calls to similar URL patterns (N+1 query smell)."""
        import re
        candidates = []

        # Extract base paths (strip IDs/UUIDs from URLs)
        def normalize_path(url: str) -> str:
            # Remove query params, strip trailing slashes
            path = url.split("?")[0].rstrip("/")
            # Replace UUIDs and numeric IDs with {id}
            path = re.sub(r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/{id}', path)
            path = re.sub(r'/\d+', '/{id}', path)
            return path

        # Group consecutive requests by normalized path
        groups = {}
        for i, r in enumerate(results):
            url = r.get("url", "")
            method = r.get("method", "GET")
            key = f"{method}:{normalize_path(url)}"
            if key not in groups:
                groups[key] = []
            groups[key].append({"index": i, "name": r.get("name", ""), "url": url})

        # Flag groups with 3+ sequential (or near-sequential) similar requests
        for key, items in groups.items():
            if len(items) >= 3:
                indices = [it["index"] for it in items]
                # Check if they're roughly sequential (within a window)
                is_sequential = all(indices[i+1] - indices[i] <= 2 for i in range(len(indices) - 1))
                if is_sequential:
                    candidates.append({
                        "pattern": key,
                        "count": len(items),
                        "suggestion": f"Consider batching these {len(items)} calls into a single request.",
                    })

        return candidates

    async def analyze(self, results: list[dict]) -> dict:
        """Full performance analysis: deterministic + AI-powered insights."""
        # 1. Fast deterministic analysis
        report = self._deterministic_analysis(results)

        # 2. AI deep analysis (Gemini) — summarize findings + suggest action plan
        if len(results) >= 2:
            try:
                ai_insights = await self._ai_analyze(results, report)
                if ai_insights:
                    report["ai_summary"] = ai_insights.get("summary", "")
                    report["ai_recommendations"] = ai_insights.get("recommendations", [])
                    report["performance_score"] = ai_insights.get("performance_score", None)
            except Exception as e:
                logger.error(f"AI performance analysis failed: {e}")
                report["ai_summary"] = None
                report["ai_recommendations"] = []
                report["performance_score"] = None
        else:
            report["ai_summary"] = None
            report["ai_recommendations"] = []
            report["performance_score"] = None

        return report

    async def _ai_analyze(self, results: list[dict], deterministic: dict) -> dict | None:
        """Use Gemini to produce a holistic performance summary and recommendations."""
        # Build a compact representation of the run data
        compact = []
        for r in results[:30]:  # Cap at 30 to stay within prompt limits
            compact.append({
                "name": r.get("name", "?"),
                "method": r.get("method", "GET"),
                "url": r.get("url", "")[:120],
                "duration_ms": r.get("duration_ms", 0),
                "size_bytes": r.get("size_bytes", 0),
                "status": r.get("status_code", 0),
                "has_cache_control": bool(
                    (r.get("response_headers") or {}).get("cache-control")
                    or (r.get("response_headers") or {}).get("Cache-Control")
                ),
            })

        findings_summary = [
            {"category": f["category"], "title": f["title"], "severity": f["severity"]}
            for f in deterministic.get("findings", [])
        ]

        prompt = f"""Analyze this API collection run and provide performance insights.

Run data ({len(compact)} requests):
{json.dumps(compact, indent=1)}

Detected issues:
{json.dumps(findings_summary, indent=1)}

Stats: avg={deterministic['stats']['avg_time_ms']}ms, p95={deterministic['stats']['p95_time_ms']}ms, total_size={deterministic['stats']['total_size_bytes']}B

Return JSON:
{{
    "summary": "2-3 sentence executive summary of performance health",
    "performance_score": <0-100 integer score>,
    "recommendations": [
        {{
            "title": "short title",
            "description": "what to do and why",
            "impact": "High|Medium|Low",
            "category": "latency|payload|caching|batching|compression"
        }}
    ]
}}

Rules:
- Max 6 recommendations, sorted by impact
- Be specific: reference actual endpoint names and numbers
- performance_score: 90-100=excellent, 70-89=good, 50-69=needs work, <50=poor
"""

        try:
            response = await asyncio.to_thread(
                ai_service.client.models.generate_content,
                model=ai_service.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=ai_service.SYSTEM_GUARD,
                    response_mime_type="application/json",
                ),
            )
            return json.loads(ai_service._clean_json(response.text))
        except Exception as e:
            logger.error(f"Gemini perf analysis failed: {e}")
            return None


perf_analyzer = PerfAnalyzer()
