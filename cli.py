import argparse
import asyncio
import sys
import json
import logging

# Configure logging to stderr so it doesn't mess up MCP stdio
logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger("gemini-tester-cli")

def run_mcp_server():
    """Starts the MCP server for agent integration."""
    try:
        from backend.mcp_server import mcp
        logger.info("Starting TestOrbit MCP Server...")
        # FastMCP run method handles stdio
        mcp.run() 
    except ImportError:
        logger.error("Failed to import mcp_server. Ensure 'mcp' is installed.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"MCP Server failed: {e}")
        sys.exit(1)

async def run_test_collection(file_path):
    """Runs a test collection JSON file."""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        # Determine if it's a raw list of tests or a collection export
        tests = data.get('items', []) if 'items' in data else data
        
        if not tests:
            logger.error("No tests found in file.")
            sys.exit(1)
            
        logger.info(f"Running {len(tests)} tests from {file_path}...")
        
        # Import here to avoid import errors if not running tests
        sys.path.append("./backend")
        from backend.app.services.test_runner import test_runner
        
        # We need a base_url. For now, assume localhost or extract from env?
        # Or let the test runner handle absolute URLs if present.
        results = await test_runner.run_batch(tests, "http://localhost:8000") # Default base?
        
        # Print JSON report to stdout
        print(json.dumps(results, indent=2))
        
        # Check for failures
        failures = [r for r in results if r.get('status_code') != 200 or not r.get('passed', True)]
        if failures:
            sys.exit(1)
        sys.exit(0)
        
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="TestOrbit CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # MCP Command
    mcp_parser = subparsers.add_parser("mcp", help="Start the MCP Server (Agent Mode)")
    
    # Run Command
    run_parser = subparsers.add_parser("run", help="Run a test collection")
    run_parser.add_argument("file", help="Path to collection JSON file")

    args = parser.parse_args()

    if args.command == "mcp":
        run_mcp_server()
    elif args.command == "run":
        asyncio.run(run_test_collection(args.file))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
