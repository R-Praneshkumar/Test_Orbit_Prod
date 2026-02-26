---
description: Review code for security vulnerabilities
allowed-tools: Read, Grep, Glob, Bash(git:*)
model: sonnet
---

Perform a comprehensive security review of the codebase.

**Scope:** Review recently changed files first, then do a broader sweep:
- Changed files: !`git diff --name-only origin/HEAD...HEAD 2>/dev/null || git diff --name-only HEAD~10...HEAD 2>/dev/null || echo ""`
- Then scan: src/ directory for patterns below

**OWASP Top 10 & Common Vulnerabilities:**
- SQL injection / NoSQL injection risks
- Cross-site scripting (XSS) — innerHTML, dangerouslySetInnerHTML, unescaped output
- Authentication/authorization flaws — broken auth, missing checks, token handling
- Insecure data handling — sensitive data in localStorage, unencrypted credentials
- Hardcoded secrets or credentials — API keys, passwords, tokens in source
- SSRF — proxy endpoints, user-supplied URLs without validation
- Prototype pollution — obj[userInput], __proto__ traversal
- Command injection — exec(), child_process, os.system
- Insecure deserialization — eval(), new Function(), JSON.parse on untrusted input

**Auth & Token Security (TestOrbit-specific):**
- Auto-auth token caching — correct source (collection vs request)
- Token refresh race conditions
- Credentials persisted in localStorage or synced to cloud
- Force collection auth bypass scenarios
- Token path extraction safety (prototype chain traversal)
- Authorization header leakage in logs/UI

**Security Best Practices:**
- Input validation at system boundaries (user input, external APIs)
- Output encoding correct
- Secure defaults used
- Error messages safe (no stack traces, no sensitive data)
- Logging appropriate (no tokens, passwords, or PII)
- CORS configuration
- Content Security Policy headers

**For each issue found provide:**
- File and line number
- Severity: Critical / High / Medium / Low
- Description of the vulnerability
- Recommended fix with code snippet

Prioritize by severity. Output as a structured table at the end.
