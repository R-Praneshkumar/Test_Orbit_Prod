# TestOrbit Demo Video — Script & Storyboard

> 2-minute screen recording. Goal: show import → AI test gen → security scan → export. Emphasize speed.

---

## Recording Setup

- **Resolution:** 1920x1080 (full HD)
- **Browser:** Chrome, clean profile, no extensions visible
- **Theme:** Dark mode (looks better on video)
- **Font size:** Slightly increased (browser zoom 110%)
- **Tools:** OBS Studio or Loom
- **Voiceover:** Record separately for clean audio, or use captions
- **Music:** Subtle lo-fi background (optional, keep low)

---

## Shot List (2:00 total)

### INTRO — 0:00–0:10 (10s)

**Screen:** TestOrbit dashboard (guest view with hero banner)

**Voiceover/Caption:**
> "TestOrbit — AI-powered API testing. Free for teams. No credit limits. Let me show you how it works."

**Action:** Pause on hero banner for 3 seconds, then scroll slightly to show capability cards.

---

### SCENE 1: Import from Postman — 0:10–0:30 (20s)

**Voiceover/Caption:**
> "Step 1: Import your Postman collection. Drag and drop — everything transfers."

**Actions:**
1. Click "Import from Postman" button on hero (0:10)
2. Import modal opens (0:12)
3. Select "Postman Collection" tab (0:14)
4. Drag a Postman JSON file onto the drop zone (0:16)
5. Collection appears in sidebar with folders and requests (0:20)
6. Click to expand a folder — show nested requests (0:23)
7. Click a request to open it in a tab — show URL, headers, body populated (0:26)

**Key visual:** The full collection structure appearing instantly in the sidebar.

---

### SCENE 2: Send a Request — 0:30–0:45 (15s)

**Voiceover/Caption:**
> "Send a request and see the full response — status, headers, body, timing."

**Actions:**
1. Click "Send" (Ctrl+Enter) on an already-populated request (0:30)
2. Response appears — show status code (200), response time, body (0:33)
3. Briefly show Headers tab (0:37)
4. Show the response body formatted as JSON (0:39)

**Key visual:** Fast response, clean JSON viewer.

---

### SCENE 3: AI Test Generation — 0:45–1:10 (25s)

**Voiceover/Caption:**
> "Now the magic. Click 'Generate Tests' and the AI creates boundary, negative, and contract tests automatically. 50 calls per day — free."

**Actions:**
1. Click the Intelligence Panel expand button (or it's already open) (0:45)
2. Click "Generate Tests" button (0:48)
3. Show the AI thinking spinner briefly (0:49)
4. Test results appear — show 10-15 generated test cases (0:52)
5. Scroll through the tests — show test names like "rejects empty email", "validates max length", "returns 401 without auth" (0:55)
6. Click "Apply Tests" or show them added as assertions (1:02)
7. Run the collection to show tests passing (green checkmarks) (1:05)

**Key visual:** The list of AI-generated tests appearing, then green checkmarks in the runner.

---

### SCENE 4: AI Security Scan — 1:10–1:30 (20s)

**Voiceover/Caption:**
> "AI security scanning — OWASP Top 10 vulnerability detection. Something Postman doesn't offer."

**Actions:**
1. Click "Security Scan" in the Intelligence Panel (1:10)
2. Show the AI analyzing (brief spinner) (1:12)
3. Security results appear — show vulnerability categories (1:15)
4. Show specific findings: SQL injection risk, missing rate limiting, CORS misconfiguration (1:18)
5. Show severity levels (Critical, High, Medium, Low) (1:22)
6. Show a recommendation/fix suggestion (1:25)

**Key visual:** Color-coded severity badges, specific vulnerability findings.

---

### SCENE 5: Code Generation — 1:30–1:40 (10s)

**Voiceover/Caption:**
> "Generate client code in any language — Python, JavaScript, cURL."

**Actions:**
1. Click "Generate Code" button (1:30)
2. Show language selector dropdown (1:32)
3. Select "Python (requests)" (1:33)
4. Show the generated Python code with syntax highlighting (1:35)
5. Click copy button (1:38)

**Key visual:** Clean, syntax-highlighted code ready to copy.

---

### SCENE 6: Quick Feature Montage — 1:40–1:50 (10s)

**Voiceover/Caption:**
> "Plus: WebSocket testing, mock server, collection runner, command palette, team sharing — all included."

**Actions (quick cuts, 2s each):**
1. WebSocket tester — connected, messages flowing (1:40)
2. Mock server — AI-generated response (1:42)
3. Command palette (Ctrl+K) — searching (1:44)
4. Collection runner — progress bar, green results (1:46)
5. Dark mode toggle (1:48)

**Key visual:** Rapid montage showing breadth of features.

---

### OUTRO — 1:50–2:00 (10s)

**Screen:** Dashboard with pricing overlay or pricing page

**Voiceover/Caption:**
> "Free for teams of 3. 50 AI calls per day. Pro at $3/month for unlimited AI. No Electron, no bloat, no credit limits. Try it at testorbit.dev."

**Actions:**
1. Show pricing table briefly (1:50)
2. End card: TestOrbit logo + "testorbit.dev" + GitHub link (1:55)

**Key visual:** The $3/month price point prominently displayed.

---

## Key Messages to Hit

1. **Speed** — Import takes seconds, app loads instantly
2. **AI generosity** — 50 calls/day free, unlimited on paid
3. **Security scanning** — unique differentiator vs Postman
4. **Price** — $3/month Pro, $252/year for 5-person team
5. **No install** — web-first, no Electron

## Thumbnail

- Split screen: TestOrbit (clean, fast, $3/mo) vs Postman (bloated, $19/mo)
- Or: "Import Postman → AI Tests → Security Scan in 60 seconds"
- Bold text, dark background, purple accent

## Distribution

| Platform | Format | Notes |
|----------|--------|-------|
| Product Hunt | Embedded | Direct upload, autoplay |
| YouTube | Full | SEO title: "TestOrbit Demo — AI-Powered Postman Alternative" |
| Twitter/X | 60s cut | Trim to highlights only |
| GitHub README | Link | Embed as GIF or link to video |
| LinkedIn | Native upload | 60s version, captions required |
| Vimeo | Full | Backup host |
