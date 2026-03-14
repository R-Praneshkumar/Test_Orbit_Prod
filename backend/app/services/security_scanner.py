"""
AI-powered API Security Scanner service.

Uses Gemini 2.0 Flash to analyze API request/response pairs for security
vulnerabilities. Detects: auth bypass patterns, injection vulnerabilities,
sensitive data exposure, CORS misconfiguration, insecure headers, and more.

This is TestOrbit's #1 differentiator — Postman doesn't have this at any price.
"""
from app.services.ai_service import ai_service
import json
import re
import logging

logger = logging.getLogger(__name__)

# Deterministic header checks (no AI needed)
SECURITY_HEADERS = {
    "strict-transport-security": {
        "severity": "high",
        "title": "Missing HSTS Header",
        "description": "Strict-Transport-Security header is not set. This allows downgrade attacks from HTTPS to HTTP.",
        "recommendation": "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains' header.",
        "category": "insecure_headers",
    },
    "x-content-type-options": {
        "severity": "medium",
        "title": "Missing X-Content-Type-Options",
        "description": "X-Content-Type-Options header is not set. Browsers may MIME-sniff responses, leading to XSS.",
        "recommendation": "Add 'X-Content-Type-Options: nosniff' header.",
        "category": "insecure_headers",
    },
    "x-frame-options": {
        "severity": "medium",
        "title": "Missing X-Frame-Options",
        "description": "X-Frame-Options header is not set. The page can be embedded in iframes, enabling clickjacking.",
        "recommendation": "Add 'X-Frame-Options: DENY' or 'SAMEORIGIN' header.",
        "category": "insecure_headers",
    },
    "content-security-policy": {
        "severity": "medium",
        "title": "Missing Content-Security-Policy",
        "description": "CSP header is not set. No defense against XSS and data injection attacks.",
        "recommendation": "Add a Content-Security-Policy header with appropriate directives.",
        "category": "insecure_headers",
    },
}

# Patterns for sensitive data in response bodies
SENSITIVE_PATTERNS = [
    {
        "pattern": r"\b\d{3}-\d{2}-\d{4}\b",
        "title": "Possible SSN Exposure",
        "severity": "critical",
        "category": "data_exposure",
    },
    {
        "pattern": r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b",
        "title": "Possible Credit Card Number",
        "severity": "critical",
        "category": "data_exposure",
    },
    {
        "pattern": r"(?:password|passwd|pwd)\s*[:=]\s*['\"]?[^\s'\"]{4,}",
        "title": "Password Value in Response",
        "severity": "high",
        "category": "data_exposure",
    },
    {
        "pattern": r"(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,}",
        "title": "API Key / Secret in Response",
        "severity": "high",
        "category": "data_exposure",
    },
    {
        "pattern": r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
        "title": "JWT Token in Response Body",
        "severity": "high",
        "category": "data_exposure",
    },
    {
        "pattern": r"(?:AKIA|ASIA)[A-Z0-9]{16}",
        "title": "AWS Access Key in Response",
        "severity": "critical",
        "category": "data_exposure",
    },
]


class SecurityScanner:
    """Hybrid deterministic + AI security scanner."""

    def _check_headers(self, response_headers: dict) -> list:
        """Deterministic check for missing security headers."""
        findings = []
        lower_headers = {k.lower(): v for k, v in (response_headers or {}).items()}

        for header, info in SECURITY_HEADERS.items():
            if header not in lower_headers:
                findings.append({
                    "id": f"HDR-{header.upper().replace('-', '_')}",
                    "severity": info["severity"],
                    "title": info["title"],
                    "description": info["description"],
                    "recommendation": info["recommendation"],
                    "category": info["category"],
                    "source": "static",
                })

        # Check for overly permissive CORS
        cors_origin = lower_headers.get("access-control-allow-origin", "")
        if cors_origin == "*":
            findings.append({
                "id": "CORS-WILDCARD",
                "severity": "medium",
                "title": "Wildcard CORS Origin",
                "description": "Access-Control-Allow-Origin is set to '*', allowing any domain to make requests.",
                "recommendation": "Restrict to specific trusted origins instead of using wildcard.",
                "category": "cors",
                "source": "static",
            })

        cors_creds = lower_headers.get("access-control-allow-credentials", "")
        if cors_creds.lower() == "true" and cors_origin == "*":
            findings.append({
                "id": "CORS-CREDS-WILDCARD",
                "severity": "high",
                "title": "CORS Credentials with Wildcard Origin",
                "description": "Allow-Credentials is true with wildcard origin. Browsers block this, but it indicates a misconfiguration.",
                "recommendation": "Never combine Access-Control-Allow-Credentials: true with wildcard origins.",
                "category": "cors",
                "source": "static",
            })

        return findings

    def _check_sensitive_data(self, response_body: str) -> list:
        """Regex-based scan for sensitive data patterns in response body."""
        findings = []
        if not response_body:
            return findings

        body_str = response_body if isinstance(response_body, str) else json.dumps(response_body)

        for pattern_info in SENSITIVE_PATTERNS:
            matches = re.findall(pattern_info["pattern"], body_str, re.IGNORECASE)
            if matches:
                # Redact matched values for safety
                sample = matches[0]
                redacted = sample[:4] + "****" + sample[-2:] if len(sample) > 6 else "****"
                findings.append({
                    "id": f"DATA-{pattern_info['title'].upper().replace(' ', '_')[:20]}",
                    "severity": pattern_info["severity"],
                    "title": pattern_info["title"],
                    "description": f"Found {len(matches)} occurrence(s) matching sensitive data pattern. Sample (redacted): {redacted}",
                    "recommendation": "Never expose sensitive data in API responses. Use data masking or remove these fields.",
                    "category": pattern_info["category"],
                    "source": "static",
                    "count": len(matches),
                })

        return findings

    def _check_auth(self, method: str, url: str, request_headers: dict, status: int) -> list:
        """Check for missing authentication on sensitive endpoints."""
        findings = []
        lower_headers = {k.lower(): v for k, v in (request_headers or {}).items()}

        has_auth = "authorization" in lower_headers or "x-api-key" in lower_headers

        # Flag if a write operation succeeded without auth
        if method.upper() in ("POST", "PUT", "PATCH", "DELETE") and not has_auth and 200 <= status < 300:
            findings.append({
                "id": "AUTH-MISSING-WRITE",
                "severity": "high",
                "title": "Successful Write Without Authentication",
                "description": f"{method.upper()} {url} returned {status} without an Authorization header. This may indicate a missing auth check.",
                "recommendation": "Ensure all write endpoints require authentication. Add auth middleware.",
                "category": "auth_bypass",
                "source": "static",
            })

        return findings

    async def scan(
        self,
        method: str,
        url: str,
        request_headers: dict = None,
        request_body: str = None,
        response_status: int = 200,
        response_body: str = None,
        response_headers: dict = None,
    ) -> dict:
        """
        Run a full security scan on a request/response pair.
        Combines deterministic checks with AI-powered analysis.
        """
        # Phase 1: Deterministic checks (fast, no AI cost)
        findings = []
        findings.extend(self._check_headers(response_headers))
        findings.extend(self._check_sensitive_data(response_body))
        findings.extend(self._check_auth(method, url, request_headers, response_status))

        # Phase 2: AI-powered deep analysis
        ai_findings = await self._ai_scan(
            method, url, request_headers, request_body,
            response_status, response_body, response_headers,
        )
        findings.extend(ai_findings)

        # Deduplicate by title
        seen = set()
        unique = []
        for f in findings:
            if f["title"] not in seen:
                seen.add(f["title"])
                unique.append(f)

        # Sort by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        unique.sort(key=lambda f: severity_order.get(f.get("severity", "info"), 5))

        # Summary
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in unique:
            sev = f.get("severity", "info")
            counts[sev] = counts.get(sev, 0) + 1

        risk_score = counts["critical"] * 10 + counts["high"] * 5 + counts["medium"] * 2 + counts["low"] * 1
        risk_level = "critical" if risk_score >= 20 else "high" if risk_score >= 10 else "medium" if risk_score >= 5 else "low" if risk_score > 0 else "secure"

        return {
            "findings": unique,
            "summary": {
                "total": len(unique),
                "critical": counts["critical"],
                "high": counts["high"],
                "medium": counts["medium"],
                "low": counts["low"],
                "info": counts["info"],
                "risk_level": risk_level,
                "risk_score": risk_score,
            },
            "scanned": {
                "method": method,
                "url": url,
                "status": response_status,
            },
        }

    async def _ai_scan(
        self, method, url, request_headers, request_body,
        response_status, response_body, response_headers,
    ) -> list:
        """Use Gemini to find vulnerabilities that regex/rules can't detect."""
        body_preview = ""
        if response_body:
            body_str = response_body if isinstance(response_body, str) else json.dumps(response_body)
            body_preview = body_str[:3000]

        req_body_preview = ""
        if request_body:
            req_str = request_body if isinstance(request_body, str) else json.dumps(request_body)
            req_body_preview = req_str[:2000]

        prompt = f"""You are an expert API security auditor. Analyze this HTTP request/response for security vulnerabilities.

Request:
- Method: {ai_service._w(method, "method")}
- URL: {ai_service._w(url, "url")}
- Headers: {ai_service._w(json.dumps(request_headers or {}, indent=2), "request_headers")}
- Body: {ai_service._w(req_body_preview or "None", "request_body")}

Response:
- Status: {response_status}
- Headers: {ai_service._w(json.dumps(response_headers or {}, indent=2), "response_headers")}
- Body (first 3000 chars): {ai_service._w(body_preview or "None", "response_body")}

Analyze for THESE specific vulnerability types:
1. **Injection Vulnerabilities**: SQL injection, NoSQL injection, command injection, XSS reflected in response
2. **Auth Bypass Patterns**: Missing auth on sensitive endpoints, broken access control, IDOR indicators
3. **Sensitive Data Exposure**: PII, credentials, tokens, internal IPs, stack traces, debug info in response
4. **Rate Limiting**: Missing rate limit headers (X-RateLimit-*)
5. **Information Disclosure**: Server version headers, stack traces, verbose error messages, internal paths
6. **Input Validation**: Evidence of missing input validation, type confusion, boundary violations

IMPORTANT:
- Only report REAL findings based on actual evidence in the request/response data
- Do NOT report findings for missing security headers (those are checked separately)
- Do NOT report CORS issues (those are checked separately)
- Assign severity: critical, high, medium, low, info
- Be specific about what you found and where

Return JSON:
{{
  "findings": [
    {{
      "severity": "high",
      "title": "Short descriptive title",
      "description": "What was found and why it's a risk",
      "recommendation": "Specific fix recommendation",
      "category": "injection|auth_bypass|data_exposure|rate_limiting|info_disclosure|input_validation"
    }}
  ]
}}

If no vulnerabilities found, return: {{"findings": []}}"""

        try:
            import asyncio
            from google.genai import types

            response = await asyncio.to_thread(
                ai_service.client.models.generate_content,
                model=ai_service.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=ai_service.SYSTEM_GUARD,
                    response_mime_type="application/json"
                )
            )
            result = json.loads(ai_service._clean_json(response.text))
            ai_findings = result.get("findings", [])

            # Annotate AI findings
            valid_severities = {"critical", "high", "medium", "low", "info"}
            clean = []
            for i, f in enumerate(ai_findings[:10]):  # Cap at 10 AI findings
                sev = f.get("severity", "info").lower()
                if sev not in valid_severities:
                    sev = "info"
                clean.append({
                    "id": f"AI-{i+1:03d}",
                    "severity": sev,
                    "title": f.get("title", "Unnamed Finding"),
                    "description": f.get("description", ""),
                    "recommendation": f.get("recommendation", ""),
                    "category": f.get("category", "other"),
                    "source": "ai",
                })
            return clean

        except Exception as e:
            logger.error(f"AI security scan failed: {e}")
            return []


security_scanner = SecurityScanner()
