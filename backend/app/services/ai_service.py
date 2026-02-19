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

    async def generate_tests(self, api_details: str, openapi_spec: str = None, user_instructions: str = None):
        """
        Generates test scenarios for a given API description or URL.
        If openapi_spec is provided, uses it for accurate endpoint URLs and schemas.
        If user_instructions is provided, generates tests ONLY for those specific questions.
        """
        spec_context = ""
        if openapi_spec:
            spec_context = f"""

        IMPORTANT: Use this OpenAPI/Swagger specification for accurate test generation:
        ```
        {openapi_spec}
        ```
        - Use the exact endpoint URLs from the spec (server URL + path).
        - Use the correct request body schemas with proper field names and types.
        - Include the 'endpoint' field in each test with the full URL.
        """

        # When user provides specific questions, generate ONLY those tests
        if user_instructions:
            scope_instruction = f"""
        CRITICAL: The user has provided specific test scenarios they want. Generate EXACTLY one test per question/scenario below — no more, no less. Do NOT add extra tests beyond what is asked.

        User's test scenarios:
        {user_instructions}
        """
        else:
            scope_instruction = """
        Generate a comprehensive test suite. Include:
        1. Happy Path tests
        2. Edge cases (null values, empty strings, max length)
        3. Security checks (SQL Injection probes, XSS probes in params)
        """

        prompt = f"""
        You are an expert QA Automation Engineer.
        Analyze this API endpoint/description and generate test cases.

        API Target: {api_details}
        {spec_context}
        {scope_instruction}
        Generate a JSON response with this structure:
        {{
            "test_suite_name": "string",
            "tests": [
                {{
                    "name": "string",
                    "description": "string",
                    "method": "GET|POST|PUT|DELETE",
                    "endpoint": "full URL to test",
                    "payload": {{}} (optional),
                    "headers": {{}} (optional),
                    "expected_status": int,
                    "category": "happy_path|edge_case|security|performance"
                }}
            ]
        }}
        """
        
        try:
            # Run blocking call in a separate thread to avoid freezing the event loop
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

    async def generate_payload_from_intent(self, prompt_text: str, openapi_spec: str = None, conversation_history: list = None):
        """
        Generates a JSON payload based on a natural language prompt.
        If openapi_spec is provided, uses it for accurate payload generation.
        If conversation_history is provided, uses it for multi-turn context.
        """
        # Build context with optional OpenAPI spec
        spec_context = ""
        if openapi_spec:
            spec_context = f"""

        IMPORTANT: Use this OpenAPI/Swagger specification to generate the EXACT payload structure:
        ```
        {openapi_spec}
        ```
        Follow the schema precisely - use correct field names, types, and required fields.
        """

        # Build conversation context
        history_context = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history[-10:]:  # Last 10 messages for context
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_lines.append(f"{role}: {content}")
            history_context = f"""

        Previous conversation:
        {chr(10).join(history_lines)}

        The user is continuing this conversation. Use the context above to understand follow-up requests.
        """

        system_prompt = f"""
        You are an API Expert. The user wants to construct an API Request Body.
        {history_context}
        User Query: "{prompt_text}"
        {spec_context}
        Task:
        1. Analyze the intent (what API are they trying to hit?).
        2. Construct a REALISTIC JSON body for that request.
        3. If OpenAPI spec is provided:
           - Use it to find the EXACT URL (Server URL + Endpoint Path).
           - Follow the schema precisely for the body.
        4. If it looks like an OTP login, use dummy numbers like +1234567890.
        5. Generate realistic test data (names, emails, etc.)

        Return JSON ONLY:
        {{
            "method": "POST",
            "url": "https://api.example.com/v1/endpoint",
            "suggested_body": {{ ...json content... }},
            "explanation": "Brief reasoning"
        }}
        """

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=system_prompt,
                config=types.GenerateContentConfig(
                     response_mime_type="application/json"
                )
            )
            return json.loads(self._clean_json(response.text))
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
        {context[:2000]}
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
