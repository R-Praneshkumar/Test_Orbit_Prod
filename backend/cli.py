#!/usr/bin/env python3
"""
TestOrbit CLI — Run API test collections from the command line.

Usage:
    python cli.py run <collection.json> [options]

Examples:
    python cli.py run my_collection.json
    python cli.py run my_collection.json --base-url https://api.staging.com
    python cli.py run my_collection.json --env env.json --format junit --output results.xml
    python cli.py run my_collection.json --auth-token "Bearer abc123" --format json
"""
import argparse
import asyncio
import json
import sys
import time
import re
import os
import xml.sax.saxutils as saxutils
from pathlib import Path

import aiohttp


# ──────────────────────────────────────────────
# Collection Parser
# ──────────────────────────────────────────────

def parse_collection(data: dict) -> list[dict]:
    """Parse a TestOrbit or Postman v2.1 collection into a flat list of requests."""
    requests = []

    # Detect format
    if "info" in data and "item" in data:
        # Postman v2.1 format
        _parse_postman_items(data["item"], requests)
    elif "items" in data or "type" in data:
        # TestOrbit format (single collection object)
        _parse_testorbit_items(data.get("items", []), requests)
    elif isinstance(data, list):
        # Raw list of request objects
        for item in data:
            if item.get("url") or item.get("endpoint"):
                requests.append(item)
    else:
        print(f"Error: Unrecognized collection format.", file=sys.stderr)
        sys.exit(1)

    return requests


def _parse_postman_items(items: list, out: list):
    """Recursively parse Postman v2.1 items (handles folders)."""
    for item in (items or []):
        if "item" in item and "request" not in item:
            # Folder
            _parse_postman_items(item["item"], out)
        elif "request" in item:
            req = item["request"]
            url = req.get("url", "")
            if isinstance(url, dict):
                url = url.get("raw", "")

            headers = {}
            for h in (req.get("header") or []):
                if not h.get("disabled") and h.get("key"):
                    headers[h["key"]] = h.get("value", "")

            body = None
            body_obj = req.get("body")
            if body_obj:
                mode = body_obj.get("mode", "raw")
                if mode == "raw":
                    raw = body_obj.get("raw", "")
                    try:
                        body = json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        body = raw
                elif mode in ("urlencoded", "formdata"):
                    pairs = body_obj.get(mode, [])
                    body = {p["key"]: p.get("value", "") for p in pairs if not p.get("disabled")}

            out.append({
                "name": item.get("name", "Unnamed"),
                "method": req.get("method", "GET"),
                "url": url,
                "headers": headers,
                "payload": body,
                "expected_status": 200,
            })


def _parse_testorbit_items(items: list, out: list):
    """Recursively parse TestOrbit items (handles folders)."""
    for item in (items or []):
        if item.get("type") == "folder":
            _parse_testorbit_items(item.get("items", []), out)
        elif item.get("type") in ("request", "websocket", None):
            headers = {}
            for h in (item.get("headers") or []):
                if h.get("enabled", True) and h.get("key"):
                    headers[h["key"]] = h.get("value", "")

            body = None
            body_obj = item.get("body")
            if body_obj and body_obj.get("content"):
                content = body_obj["content"]
                btype = body_obj.get("type", "json")
                if btype == "json":
                    try:
                        body = json.loads(content)
                    except (json.JSONDecodeError, TypeError):
                        body = content
                elif btype in ("form", "urlencoded"):
                    try:
                        pairs = json.loads(content)
                        body = {p["key"]: p.get("value", "") for p in pairs if p.get("enabled", True)}
                    except (json.JSONDecodeError, TypeError):
                        body = content
                else:
                    body = content

            out.append({
                "name": item.get("name", "Unnamed"),
                "method": item.get("method", "GET"),
                "url": item.get("url", ""),
                "headers": headers,
                "payload": body,
                "expected_status": item.get("expected_status", 200),
            })


# ──────────────────────────────────────────────
# Environment / Variable Resolution
# ──────────────────────────────────────────────

def load_env_vars(env_path: str) -> dict:
    """Load environment variables from a JSON file.
    Supports TestOrbit env format: { "name": "...", "vars": [...] }
    or simple key-value: { "key": "value" }
    """
    with open(env_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        if "vars" in data and isinstance(data["vars"], list):
            # TestOrbit format
            return {
                v["key"]: v.get("value", "")
                for v in data["vars"]
                if v.get("enabled", True) and v.get("key")
            }
        # Postman env format
        if "values" in data and isinstance(data["values"], list):
            return {
                v["key"]: v.get("value", "")
                for v in data["values"]
                if v.get("enabled", True) and v.get("key")
            }
        # Simple key-value
        return {k: str(v) for k, v in data.items() if isinstance(k, str)}

    return {}


def resolve_variables(text: str, variables: dict) -> str:
    """Replace {{variable}} placeholders in text."""
    if not text or not isinstance(text, str):
        return text or ""
    return re.sub(
        r"\{\{(\w+)\}\}",
        lambda m: variables.get(m.group(1), m.group(0)),
        text,
    )


def resolve_request(req: dict, variables: dict) -> dict:
    """Resolve all variable placeholders in a request."""
    resolved = {**req}
    resolved["url"] = resolve_variables(req.get("url", ""), variables)
    resolved["headers"] = {
        resolve_variables(k, variables): resolve_variables(v, variables)
        for k, v in (req.get("headers") or {}).items()
    }
    # Resolve variables in payload strings
    payload = req.get("payload")
    if isinstance(payload, str):
        resolved["payload"] = resolve_variables(payload, variables)
    elif isinstance(payload, dict):
        resolved["payload"] = {
            k: resolve_variables(str(v), variables) if isinstance(v, str) else v
            for k, v in payload.items()
        }
    return resolved


# ──────────────────────────────────────────────
# Test Executor
# ──────────────────────────────────────────────

async def run_request(session: aiohttp.ClientSession, req: dict, base_url: str) -> dict:
    """Execute a single API request and return the result."""
    url = req.get("url", "")
    if base_url and not url.startswith("http"):
        url = f"{base_url.rstrip('/')}/{url.lstrip('/')}" if url else base_url

    method = req.get("method", "GET").upper()
    headers = req.get("headers") or {}
    payload = req.get("payload")

    start = time.perf_counter()
    try:
        timeout = aiohttp.ClientTimeout(total=30)
        kwargs = {}
        if payload is not None and method not in ("GET", "HEAD"):
            if isinstance(payload, (dict, list)):
                kwargs["json"] = payload
                if "Content-Type" not in headers:
                    headers["Content-Type"] = "application/json"
            else:
                kwargs["data"] = str(payload)

        async with session.request(method, url, headers=headers, timeout=timeout, **kwargs) as resp:
            body = await resp.read()
            elapsed = int((time.perf_counter() - start) * 1000)
            expected = req.get("expected_status", 200)
            success = resp.status == expected if expected else (200 <= resp.status < 300)

            return {
                "name": req.get("name", "Unnamed"),
                "method": method,
                "url": url,
                "status": resp.status,
                "expected_status": expected,
                "time": elapsed,
                "size": len(body),
                "success": success,
                "error": None,
            }
    except Exception as e:
        elapsed = int((time.perf_counter() - start) * 1000)
        return {
            "name": req.get("name", "Unnamed"),
            "method": method,
            "url": url,
            "status": 0,
            "expected_status": req.get("expected_status", 200),
            "time": elapsed,
            "size": 0,
            "success": False,
            "error": str(e),
        }


async def run_all(requests: list[dict], base_url: str) -> list[dict]:
    """Run all requests concurrently."""
    async with aiohttp.ClientSession() as session:
        tasks = [run_request(session, req, base_url) for req in requests]
        return await asyncio.gather(*tasks)


# ──────────────────────────────────────────────
# Output Formatters
# ──────────────────────────────────────────────

METHOD_COLORS = {
    "GET": "\033[32m",     # green
    "POST": "\033[33m",    # yellow
    "PUT": "\033[34m",     # blue
    "DELETE": "\033[31m",  # red
    "PATCH": "\033[35m",   # magenta
}
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
RED = "\033[31m"
DIM = "\033[2m"


def format_table(results: list[dict], summary: dict):
    """Print results as a colored terminal table."""
    print(f"\n{BOLD}TestOrbit Collection Run{RESET}")
    print(f"{DIM}{'─' * 80}{RESET}\n")

    for r in results:
        mc = METHOD_COLORS.get(r["method"], "")
        icon = f"{GREEN}✓{RESET}" if r["success"] else f"{RED}✗{RESET}"
        status_str = f"{r['status']}" if r["status"] else "ERR"
        name = r["name"][:40]
        print(f"  {icon} {mc}{r['method']:7s}{RESET} {name:42s} {status_str:>4s}  {r['time']:>5d}ms", end="")
        if r["error"]:
            print(f"  {RED}{r['error'][:40]}{RESET}", end="")
        print()

    print(f"\n{DIM}{'─' * 80}{RESET}")
    p = summary["passed"]
    f = summary["failed"]
    total = summary["total"]
    pct = summary["pass_rate"]
    color = GREEN if f == 0 else RED
    print(f"  {BOLD}Results:{RESET} {GREEN}{p} passed{RESET}, {RED}{f} failed{RESET}, {total} total")
    print(f"  {BOLD}Pass Rate:{RESET} {color}{pct}%{RESET}")
    print(f"  {BOLD}Duration:{RESET} {summary['total_time']}ms (avg {summary['avg_time']}ms)")
    print()


def format_json(results: list[dict], summary: dict) -> str:
    """Return results as JSON string."""
    return json.dumps({"results": results, "summary": summary}, indent=2)


def format_junit(results: list[dict], summary: dict, suite_name: str) -> str:
    """Return results as JUnit XML."""
    total_time_sec = f"{summary['total_time'] / 1000:.3f}"

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += f'<testsuites name="{saxutils.escape(suite_name)}" tests="{summary["total"]}" failures="{summary["failed"]}" time="{total_time_sec}">\n'
    xml += f'  <testsuite name="{saxutils.escape(suite_name)}" tests="{summary["total"]}" failures="{summary["failed"]}" time="{total_time_sec}">\n'

    for r in results:
        t = f"{r['time'] / 1000:.3f}"
        name = saxutils.escape(r["name"])
        xml += f'    <testcase name="{name}" classname="{r["method"]}" time="{t}">\n'
        if not r["success"]:
            msg = saxutils.escape(r["error"] or f"Expected {r['expected_status']}, got {r['status']}")
            xml += f'      <failure message="{msg}" type="AssertionError">\n'
            xml += f'Status: {r["status"]}\nURL: {saxutils.escape(r["url"])}\nMethod: {r["method"]}\nDuration: {r["time"]}ms\n'
            if r["error"]:
                xml += f'Error: {saxutils.escape(r["error"])}\n'
            xml += '      </failure>\n'
        xml += '    </testcase>\n'

    xml += '  </testsuite>\n'
    xml += '</testsuites>\n'
    return xml


# ──────────────────────────────────────────────
# Main CLI
# ──────────────────────────────────────────────

def compute_summary(results: list[dict]) -> dict:
    """Compute summary statistics from results."""
    passed = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])
    total = len(results)
    times = [r["time"] for r in results]
    total_time = sum(times)
    avg_time = round(total_time / total) if total > 0 else 0
    max_time = max(times) if times else 0
    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": round(passed / total * 100) if total > 0 else 0,
        "total_time": total_time,
        "avg_time": avg_time,
        "max_time": max_time,
    }


def main():
    parser = argparse.ArgumentParser(
        prog="testorbit",
        description="TestOrbit CLI — Run API test collections from the command line.",
    )
    subparsers = parser.add_subparsers(dest="command")

    # `run` command
    run_parser = subparsers.add_parser("run", help="Run a collection file")
    run_parser.add_argument("collection", help="Path to collection JSON file (TestOrbit or Postman v2.1)")
    run_parser.add_argument("--base-url", "-b", help="Override base URL for all requests")
    run_parser.add_argument("--env", "-e", help="Path to environment JSON file (variables)")
    run_parser.add_argument("--auth-token", "-a", help='Auth token to inject (e.g. "Bearer abc123")')
    run_parser.add_argument("--format", "-f", choices=["table", "json", "junit"], default="table", help="Output format (default: table)")
    run_parser.add_argument("--output", "-o", help="Write output to file instead of stdout")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "run":
        # Load collection
        col_path = Path(args.collection)
        if not col_path.exists():
            print(f"Error: Collection file not found: {col_path}", file=sys.stderr)
            sys.exit(1)

        with open(col_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                print(f"Error: Invalid JSON in collection file: {e}", file=sys.stderr)
                sys.exit(1)

        requests = parse_collection(data)
        if not requests:
            print("Error: No requests found in collection.", file=sys.stderr)
            sys.exit(1)

        # Load environment variables
        env_vars = {}
        if args.env:
            env_path = Path(args.env)
            if not env_path.exists():
                print(f"Error: Environment file not found: {env_path}", file=sys.stderr)
                sys.exit(1)
            env_vars = load_env_vars(str(env_path))

        # Resolve variables in all requests
        resolved_requests = [resolve_request(req, env_vars) for req in requests]

        # Inject auth token
        if args.auth_token:
            for req in resolved_requests:
                req["headers"]["Authorization"] = args.auth_token

        base_url = args.base_url or ""

        # Print header for table format
        suite_name = data.get("info", {}).get("name") or data.get("name") or col_path.stem
        if args.format == "table":
            print(f"\n  Running {len(resolved_requests)} requests from \"{suite_name}\"...")
            if base_url:
                print(f"  Base URL: {base_url}")
            if env_vars:
                print(f"  Environment: {len(env_vars)} variables loaded")
            if args.auth_token:
                print(f"  Auth: token injected")

        # Run
        results = asyncio.run(run_all(resolved_requests, base_url))
        summary = compute_summary(results)

        # Output
        if args.format == "table":
            format_table(results, summary)
        elif args.format == "json":
            output = format_json(results, summary)
            if args.output:
                Path(args.output).write_text(output, encoding="utf-8")
                print(f"Results written to {args.output}")
            else:
                print(output)
        elif args.format == "junit":
            output = format_junit(results, summary, suite_name)
            if args.output:
                Path(args.output).write_text(output, encoding="utf-8")
                print(f"JUnit XML written to {args.output}")
            else:
                print(output)

        # Exit code: 1 if any failures
        sys.exit(1 if summary["failed"] > 0 else 0)


if __name__ == "__main__":
    main()
