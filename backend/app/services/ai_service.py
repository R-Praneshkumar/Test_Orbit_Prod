from google import genai
from google.genai import types
from app.core.config import get_settings
import json
import re
import asyncio
import logging

logger = logging.getLogger(__name__)

settings = get_settings()

class AIService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = "gemini-2.0-flash"

    @staticmethod
    def _clean_json(text: str) -> str:
        """Strip markdown code fences that Gemini sometimes wraps JSON in."""
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
        return text.strip()

    async def generate_tests(self, api_details: str, openapi_spec: str = None,
                             user_instructions: str = None, base_url: str = None):
        """
        Generates test scenarios for a given API description or URL.
        Uses deterministic spec parsing for accurate URLs.
        """
        # --- Deterministic spec extraction ---
        spec_info = self._extract_spec_info(openapi_spec, base_url)
        resolved_base_url = spec_info["base_url"]

        spec_context = ""
        if openapi_spec and spec_info["endpoints"]:
            spec_context = f"""
=== API SPECIFICATION ===
Base URL: {resolved_base_url or 'NOT PROVIDED'}
Available Endpoints:
{chr(10).join(spec_info['endpoints'])}
{f"Schemas: {spec_info['schemas_hint']}" if spec_info['schemas_hint'] else ""}

Full spec for schema reference:
```
{openapi_spec[:8000]}
```
=== END SPECIFICATION ==="""
        elif openapi_spec:
            spec_context = f"""
=== API SPECIFICATION ===
Base URL: {resolved_base_url or 'NOT PROVIDED'}
```
{openapi_spec[:8000]}
```
=== END SPECIFICATION ==="""

        if user_instructions:
            scope_instruction = f"""
SCOPE: Generate EXACTLY one test per scenario below — no more, no less.
User's test scenarios:
{user_instructions}"""
        else:
            scope_instruction = """
SCOPE: Generate a comprehensive test suite organized BY ENDPOINT. For each endpoint:
1. Happy Path — normal successful operation with valid data
2. Validation — missing required fields, wrong types, empty strings
3. Edge Cases — boundary values, special characters, very long strings
4. Error Handling — non-existent resources (404), invalid IDs
5. Security — SQL injection in parameters, XSS in string fields

Name each test clearly: "POST /v1/users - valid creation" format.
Group tests by endpoint path."""

        base_url_rule = ""
        if resolved_base_url:
            base_url_rule = f"""
CRITICAL: The base URL is "{resolved_base_url}".
Every "endpoint" field MUST be an absolute URL starting with "{resolved_base_url}".
Example: "{resolved_base_url}/v1/resource" — NOT just "/v1/resource"."""

        prompt = f"""You are an expert QA Automation Engineer generating API test cases.

API Target: {api_details}
{spec_context}
{base_url_rule}
{scope_instruction}

INSTRUCTIONS:
- Use the spec's schemas to build accurate request bodies with correct field names and types.
- Generate realistic test data: real names, emails, dates, IDs.
- For GET/DELETE: set payload to null.
- Auth headers are applied at runtime — do NOT include Authorization headers.

Return JSON:
{{
  "test_suite_name": "descriptive name",
  "tests": [
    {{
      "name": "POST /v1/bank - create valid bank",
      "description": "Tests creating a bank with all required fields",
      "method": "POST",
      "endpoint": "{resolved_base_url or 'https://api.example.com'}/v1/bank",
      "payload": {{"name": "Test Bank", "code": "TB001"}},
      "headers": {{}},
      "expected_status": 201,
      "category": "happy_path"
    }}
  ]
}}

Categories: happy_path | edge_case | security | performance | validation
{"Every endpoint MUST start with: " + resolved_base_url if resolved_base_url else ""}"""

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            result = json.loads(self._clean_json(response.text))

            # Post-process: ensure all test endpoint URLs are absolute
            if resolved_base_url and isinstance(result, dict) and "tests" in result:
                for test in result["tests"]:
                    ep = test.get("endpoint", "")
                    if ep and not ep.startswith("http"):
                        test["endpoint"] = resolved_base_url.rstrip("/") + ("" if ep.startswith("/") else "/") + ep

            return result
        except Exception as e:
            logger.error(f"Test generation failed: {e}")
            return {"error": str(e)}

    async def analyze_optimization(self, endpoint: str, response_time_ms: int, payload_size_bytes: int):
        """
        Analyzes performance metrics and suggests optimizations.
        """
        prompt = f"""
        Analyze these API metrics and suggest optimizations.
        
        Endpoint: {endpoint}
        Time: {response_time_ms}ms
        Size: {payload_size_bytes} bytes
        
        Return a short, punchy JSON list of suggestions:
        [
            {{ "issue": "High Latency", "suggestion": "Implement Redis caching...", "impact": "High" }}
        ]
        """
        
        try:
            # Run blocking call in a separate thread
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            return json.loads(self._clean_json(response.text))
        except Exception as e:
             return []

    async def diagnose_failure(self, method: str, url: str, request_body: str = None,
                              request_headers: dict = None, expected_status: int = 200,
                              actual_status: int = 0, response_body: str = None,
                              response_headers: dict = None, openapi_spec: str = None):
        """
        Diagnoses why an API test failed by analyzing request/response context.
        """
        spec_hint = ""
        if openapi_spec:
            spec_hint = f"\nOpenAPI Spec (for reference):\n```\n{openapi_spec[:2000]}\n```"

        prompt = f"""
        An API test has FAILED. Analyze the request and response to determine the root cause.

        Request:
        - Method: {method}
        - URL: {url}
        - Headers: {json.dumps(request_headers, indent=2) if request_headers else 'None'}
        - Body: {request_body or 'None'}

        Expected Status: {expected_status}
        Actual Status: {actual_status}

        Response Body: {(response_body or 'None')[:3000]}
        Response Headers: {json.dumps(response_headers, indent=2) if response_headers else 'None'}
        {spec_hint}

        Analyze and return JSON:
        {{
            "root_cause": "One-line summary of what went wrong",
            "explanation": "Detailed explanation of why this happened (2-3 sentences)",
            "suggested_fix": "Specific actionable fix the developer should apply",
            "confidence": "high|medium|low"
        }}
        """

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            return json.loads(self._clean_json(response.text))
        except Exception as e:
            logger.error(f"Diagnosis failed: {e}")
            return {"error": str(e)}

    async def generate_code(self, method: str, url: str, headers: dict = None, body: str = None,
                           language: str = "python", variant: str = None, include_tests: bool = False):
        """
        Generates production-ready code for an API request in the specified language.
        """
        headers_str = json.dumps(headers, indent=2) if headers else "None"
        body_str = body or "None"
        variant_hint = f" using the '{variant}' library" if variant else ""
        test_hint = """
        ALSO include unit test assertions at the end of the code that:
        - Verify the response status code
        - Verify the response contains expected fields
        - Use the language's standard test framework (pytest for Python, Jest for JS, testing package for Go, JUnit for Java)
        """ if include_tests else ""

        prompt = f"""
        Generate production-ready {language} code{variant_hint} for the following API request.

        HTTP Method: {method}
        URL: {url}
        Headers: {headers_str}
        Request Body: {body_str}

        Requirements:
        - Write clean, well-commented, production-quality code
        - Include proper error handling and response parsing
        - Use type hints / type annotations where the language supports them
        - Include all necessary imports at the top
        - Print/log the response status and body
        - Handle both success and error responses
        {test_hint}

        Return ONLY the code as a JSON object:
        {{
            "code": "...the full code string...",
            "language": "{language}",
            "filename": "suggested_filename.ext"
        }}
        """

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            return json.loads(self._clean_json(response.text))
        except Exception as e:
            logger.error(f"Code generation failed: {e}")
            return {"error": str(e)}

    @staticmethod
    def _extract_spec_info(openapi_spec: str, base_url_override: str = None) -> dict:
        """
        Deterministically extract structured info from an OpenAPI spec.
        This avoids relying on the LLM for URL construction.
        """
        result = {"base_url": "", "endpoints": [], "schemas_hint": ""}
        if not openapi_spec:
            return result

        try:
            spec = json.loads(openapi_spec) if openapi_spec.strip().startswith('{') else None
            if spec is None:
                try:
                    import yaml as yaml_lib
                    spec = yaml_lib.safe_load(openapi_spec)
                except Exception:
                    return result
        except Exception:
            return result

        if not isinstance(spec, dict):
            return result

        # 1. Base URL: explicit override > spec servers > spec host+basePath
        if base_url_override:
            result["base_url"] = base_url_override.rstrip("/")
        else:
            servers = spec.get("servers", [])
            if servers and isinstance(servers, list) and servers[0].get("url"):
                result["base_url"] = servers[0]["url"].rstrip("/")
            elif spec.get("host"):
                scheme = (spec.get("schemes", ["https"]) or ["https"])[0]
                result["base_url"] = f"{scheme}://{spec['host']}{spec.get('basePath', '')}".rstrip("/")

        # 2. Endpoint summary (method + path + summary) — compact for prompt efficiency
        paths = spec.get("paths", {})
        methods = ("get", "post", "put", "delete", "patch")
        endpoints = []
        for path, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue
            for method in methods:
                op = path_item.get(method)
                if not op:
                    continue
                summary = op.get("summary", op.get("operationId", ""))
                has_body = "requestBody" in op
                params = [p.get("name", "") for p in op.get("parameters", []) if p.get("in") == "path"]
                line = f"  {method.upper()} {path}"
                if summary:
                    line += f" — {summary}"
                if has_body:
                    line += " [body]"
                if params:
                    line += f" [params: {', '.join(params)}]"
                endpoints.append(line)

        result["endpoints"] = endpoints

        # 3. Schema hints — top-level component schemas (names only, to keep prompt small)
        schemas = (spec.get("components", {}) or {}).get("schemas", {})
        if schemas:
            schema_names = list(schemas.keys())[:20]
            result["schemas_hint"] = ", ".join(schema_names)

        return result

    @staticmethod
    def _ensure_absolute_urls(data, base_url: str):
        """
        Post-process AI response to guarantee all URLs are absolute.
        This is the deterministic safety net — never rely on LLM for URL construction.
        """
        if not base_url:
            return data

        def fix_url(url: str) -> str:
            if not url:
                return url
            url = url.strip()
            if url.startswith("http://") or url.startswith("https://"):
                return url
            # Relative path: prepend base URL
            if not url.startswith("/"):
                url = "/" + url
            return base_url.rstrip("/") + url

        if isinstance(data, dict):
            if "url" in data:
                data["url"] = fix_url(data["url"])
            if "endpoints" in data and isinstance(data["endpoints"], list):
                for ep in data["endpoints"]:
                    if isinstance(ep, dict) and "url" in ep:
                        ep["url"] = fix_url(ep["url"])
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and "url" in item:
                    item["url"] = fix_url(item["url"])

        return data

    async def generate_payload_from_intent(self, prompt_text: str, openapi_spec: str = None,
                                           conversation_history: list = None, base_url: str = None):
        """
        Generates API endpoint suggestions based on natural language intent.
        Uses deterministic spec parsing + LLM for intelligent matching.
        """
        # --- Step 1: Deterministically extract spec info (not LLM-dependent) ---
        spec_info = self._extract_spec_info(openapi_spec, base_url)
        resolved_base_url = spec_info["base_url"]

        # --- Step 2: Build structured spec context for the prompt ---
        spec_context = ""
        if openapi_spec and spec_info["endpoints"]:
            spec_context = f"""
=== API SPECIFICATION ===
Base URL: {resolved_base_url or 'NOT PROVIDED'}
Available Endpoints:
{chr(10).join(spec_info['endpoints'])}
{f"Schemas: {spec_info['schemas_hint']}" if spec_info['schemas_hint'] else ""}

Full spec for body/schema reference:
```
{openapi_spec[:6000]}
```
=== END SPECIFICATION ==="""
        elif openapi_spec:
            spec_context = f"""
=== API SPECIFICATION ===
Base URL: {resolved_base_url or 'NOT PROVIDED'}
```
{openapi_spec[:6000]}
```
=== END SPECIFICATION ==="""

        # --- Step 3: Build conversation history ---
        history_context = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_lines.append(f"{role}: {content}")
            history_context = f"""
Previous conversation:
{chr(10).join(history_lines)}
Continue this conversation using the context above.
"""

        # --- Step 4: Detect requested count from user message ---
        count_hint = ""
        number_words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
                        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
        requested_count = None
        lower_prompt = prompt_text.lower()
        # Check for digit patterns like "5 endpoints", "give me 3"
        digit_match = re.search(r'(\d+)\s*(?:endpoint|api|request|route|url|test)', lower_prompt)
        if digit_match:
            requested_count = int(digit_match.group(1))
        else:
            # Check for word patterns like "five endpoints"
            for word, num in number_words.items():
                if re.search(rf'\b{word}\b', lower_prompt):
                    requested_count = num
                    break
        if requested_count and requested_count > 1:
            count_hint = f"""
CRITICAL: The user is asking for EXACTLY {requested_count} endpoints.
You MUST return a JSON array with EXACTLY {requested_count} endpoint objects. Not 1, not {requested_count - 1}, but exactly {requested_count}.
Pick {requested_count} different endpoints from the API specification.
"""

        # --- Step 5: Build the prompt ---
        base_url_rule = ""
        if resolved_base_url:
            base_url_rule = f"""
CRITICAL URL RULE: The base URL is "{resolved_base_url}".
Every "url" field MUST be an absolute URL starting with "{resolved_base_url}".
Example: "{resolved_base_url}/v1/users" — NOT just "/v1/users".
"""

        system_prompt = f"""You are an API testing expert. Analyze the user's request and generate the appropriate API endpoint(s).
{history_context}
User Request: "{prompt_text}"
{spec_context}
{base_url_rule}
{count_hint}
INSTRUCTIONS:
1. Match the user's intent to endpoints from the spec (if provided).
2. For each endpoint, provide the full absolute URL, HTTP method, realistic request body (if applicable), and a brief explanation.
3. Use the spec's schemas to generate accurate request bodies with correct field names, types, and realistic test data.
4. For GET/DELETE requests, set "suggested_body" to null.
5. Generate realistic test data: real names, emails, dates, IDs — not placeholders like "string" or "example".

OUTPUT FORMAT — Return valid JSON only:

{"Return a JSON ARRAY with exactly " + str(requested_count) + " objects:" if requested_count and requested_count > 1 else "For a SINGLE endpoint, return one object. For MULTIPLE endpoints, return a JSON array:"}

{{"method": "POST", "url": "{resolved_base_url or 'https://api.example.com'}/v1/resource", "suggested_body": {{"field": "value"}}, "explanation": "What this endpoint does and why"}}

Every object MUST have: "method", "url", "suggested_body", "explanation".
{"Every url MUST start with: " + resolved_base_url if resolved_base_url else ""}
{"RETURN EXACTLY " + str(requested_count) + " ENDPOINTS IN A JSON ARRAY." if requested_count and requested_count > 1 else ""}"""

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=system_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            parsed = json.loads(self._clean_json(response.text))

            # --- Step 5: Deterministic post-processing — guarantee absolute URLs ---
            parsed = self._ensure_absolute_urls(parsed, resolved_base_url)

            # Normalize array response to the frontend's expected shape
            if isinstance(parsed, list):
                # Fix URLs in each item
                return {
                    "method": parsed[0].get("method", "GET") if parsed else "GET",
                    "url": parsed[0].get("url", "") if parsed else "",
                    "suggested_body": parsed[0].get("suggested_body") if parsed else None,
                    "explanation": "\n".join(
                        f"• **{item.get('method', '?')} {item.get('url', '?')}** — {item.get('explanation', '')}"
                        for item in parsed
                    ),
                    "endpoints": parsed,
                }
            return parsed
        except Exception as e:
            return {"error": str(e)}

    async def chat(self, message: str, conversation_history: list = None, context: str = None):
        """
        Conversational AI assistant for API testing help.
        """
        history_context = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_lines.append(f"{role}: {content}")
            history_context = f"""
        Previous conversation:
        {chr(10).join(history_lines)}
        """

        spec_context = ""
        if context:
            spec_context = f"""
        API Context (OpenAPI Spec):
        ```
        {context}
        ```
        """

        prompt = f"""You are an expert API testing assistant helping developers test and debug APIs.
        {history_context}
        {spec_context}
        User: {message}

        Provide a helpful, concise response. If they ask about an API, help them understand it.
        If they need code examples, provide them. Keep responses focused on API testing.

        Return JSON:
        {{
            "response": "Your helpful response here",
            "type": "chat"
        }}
        """

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            return json.loads(self._clean_json(response.text))
        except Exception as e:
            logger.error(f"Chat failed: {e}")
            return {"error": str(e)}

    async def generate_mock_response(self, method: str, path: str):
        """
        Generates a realistic mock response for a given API endpoint.
        """
        prompt = f"""
        Generate a REALISTIC JSON response for this API endpoint.
        
        Method: {method}
        URL Path: {path}
        
        - If it's a list endpoint (e.g. /users), return a list of 3-5 items.
        - If it's a detail endpoint (e.g. /users/1), return a single object.
        - If it's a POST/PUT, return the created/updated resource.
        - Use realistic data (English names, recent dates, legitimate-looking IDs).
        - Return ONLY the JSON.
        """
        
        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            return json.loads(self._clean_json(response.text))
        except Exception as e:
            logger.error(f"Mock generation failed: {e}")
            return {"error": "Failed to generate mock data", "details": str(e)}

ai_service = AIService()
