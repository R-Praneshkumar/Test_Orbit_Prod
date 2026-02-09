from mcp.server.fastmcp import FastMCP
from app.services.ai_service import ai_service
from app.services.test_runner import test_runner
import asyncio
import json

# Initialize FastMCP Server
mcp = FastMCP("Gemini API Tester")

@mcp.tool()
async def generate_api_tests(url: str, context: str = None) -> str:
    """
    Generates a comprehensive test suite for the given API URL.
    Returns the test plan as a JSON string.
    """
    try:
        result = await ai_service.generate_tests(f"{url} {context or ''}")
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
async def run_api_tests(test_suite_json: str, base_url: str) -> str:
    """
    Runs a test suite (provided as JSON string) against the base URL.
    Returns the execution results.
    """
    try:
        suite = json.loads(test_suite_json)
        tests = suite.get("tests", [])
        if not tests:
            return "No tests found in the provided JSON."
            
        results = await test_runner.run_batch(tests, base_url)
        return json.dumps(results, indent=2)
    except Exception as e:
        return f"Error executing tests: {str(e)}"

@mcp.tool()
async def diagnose_api_failure(method: str, url: str, status_code: int, response_body: str) -> str:
    """
    Diagnoses why an API request failed.
    """
    try:
        result = await ai_service.diagnose_failure(
            method=method, 
            url=url, 
            actual_status=status_code, 
            response_body=response_body,
            expected_status=200 # Default assumption
        )
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error diagnosing failure: {str(e)}"

if __name__ == "__main__":
    mcp.run()
