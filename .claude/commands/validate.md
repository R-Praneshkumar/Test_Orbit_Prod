Run the full validation checklist for the TestOrbit project. This verifies nothing is broken.

Run ALL of these checks in sequence. Report pass/fail for each:

## Checks to Run

1. **Frontend Lint** — `cd D:/Testing_Automation/gemini-api-tester/frontend && npm run lint`
   - PASS: 0 errors, 0 warnings
   - FAIL: any error or warning

2. **Frontend Build** — `cd D:/Testing_Automation/gemini-api-tester/frontend && npm run build`
   - PASS: Build succeeds
   - FAIL: Build fails
   - Also report: JS bundle size (gzip) and CSS bundle size (gzip)

3. **Backend Import Check** — `cd D:/Testing_Automation/gemini-api-tester/backend && .venv/Scripts/python.exe -c "from app.main import app; print('Backend OK')"`
   - PASS: Prints "Backend OK"
   - FAIL: Import error or crash

4. **Backend Tests** — `cd D:/Testing_Automation/gemini-api-tester/backend && .venv/Scripts/python.exe -m pytest tests/ -v`
   - PASS: All tests pass
   - FAIL: Any test fails

## Output Format

Show results as:
```
VALIDATION RESULTS
==================
[PASS/FAIL] Frontend Lint      — 0 errors, 0 warnings
[PASS/FAIL] Frontend Build     — JS: XXXkb (gzip) | CSS: XXkb (gzip)
[PASS/FAIL] Backend Import     — Backend OK
[PASS/FAIL] Backend Tests      — X/Y passed

Overall: X/4 checks passed
```

If any check fails, explain what failed and suggest a fix.
