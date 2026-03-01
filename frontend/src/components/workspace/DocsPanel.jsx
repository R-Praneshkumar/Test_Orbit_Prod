import React, { useState } from 'react';
import {
    Play, Server, Terminal, Keyboard, MessageSquare, FlaskConical, Folder, Send,
    Sparkles, CheckCircle, Layers, Globe, ArrowRight, Shield, Code, Zap,
    FileText, Users, Pencil, Search, Plus, MoreHorizontal, Settings,
    Plug, Copy, Upload, Download, GitBranch, AlertTriangle, Info, Lightbulb,
    BookOpen, ChevronRight, LayoutDashboard, PanelLeft, Eye, Trash2, RefreshCw
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

// ─── Helper Components ──────────────────────────────────────────────────────

const CodeBlock = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="relative group my-3">
            <pre className="bg-slate-900 text-slate-200 text-xs leading-relaxed rounded-lg p-4 overflow-x-auto font-mono">
                {code}
            </pre>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy"
            >
                {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
        </div>
    );
};

const InfoBox = ({ type = 'note', children }) => {
    const styles = {
        tip: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
        warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
        note: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
    };
    const icons = { tip: Lightbulb, warning: AlertTriangle, note: Info };
    const Icon = icons[type];
    return (
        <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm my-3 ${styles[type]}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div>{children}</div>
        </div>
    );
};

const PropTable = ({ headers, rows }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-xs">
            <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                    {headers.map((h, i) => (
                        <th key={i} className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'}>
                        {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const SectionHeading = ({ icon: Icon, title, subtitle }) => (
    <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            {Icon && <Icon size={22} className="text-corporate-500" />}
            {title}
        </h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
    </div>
);

const Kbd = ({ children }) => (
    <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono rounded border border-slate-200 dark:border-slate-600 shadow-sm">
        {children}
    </kbd>
);

const Badge = ({ color = 'slate', children }) => {
    const colors = {
        green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
        red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
        purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
        slate: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    };
    return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${colors[color]}`}>{children}</span>;
};

const P = ({ children }) => <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{children}</p>;
const H3 = ({ children }) => <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mt-6 mb-2">{children}</h3>;
const H4 = ({ children }) => <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4 mb-1.5">{children}</h4>;
const Li = ({ children }) => <li className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{children}</li>;
const Ul = ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 ml-2">{children}</ul>;

// ─── Section Definitions ────────────────────────────────────────────────────

const DOCS_SECTIONS = [
    {
        id: 'overview', title: 'Overview', icon: BookOpen,
        content: (nav) => (<>
            <SectionHeading icon={BookOpen} title="Welcome to TestOrbit" subtitle="AI-native API testing powered by Google Gemini" />
            <P>TestOrbit is a comprehensive API testing platform that combines a traditional request editor with AI-powered features: automatic test generation, intelligent mock servers, code generation, contract testing, and conversational AI assistance. All powered by Google Gemini.</P>

            <H3>Workspace Layout</H3>
            <div className="grid grid-cols-3 gap-3 my-4">
                {[
                    { icon: PanelLeft, title: 'Sidebar (Left)', desc: 'Collections, folders, requests, WebSockets. Search, add new items, manage environments.', color: 'bg-slate-100 dark:bg-slate-800' },
                    { icon: Send, title: 'Editor (Center)', desc: 'Build and send HTTP requests. View responses. 6 subtabs: Params, Headers, Body, Auth, Scripts, Assertions.', color: 'bg-purple-50 dark:bg-purple-900/20' },
                    { icon: Sparkles, title: 'Intelligence (Right)', desc: 'AI Chat, OpenAPI Spec, Test Generation. Your AI copilot for API testing.', color: 'bg-green-50 dark:bg-green-900/20' },
                ].map(p => (
                    <div key={p.title} className={`p-4 rounded-xl border border-slate-200 dark:border-slate-700 ${p.color}`}>
                        <p.icon size={24} className="mb-2 text-slate-600 dark:text-slate-400" />
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{p.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.desc}</p>
                    </div>
                ))}
            </div>

            <H3>Quick Start</H3>
            <div className="space-y-2 my-3">
                {[
                    'Create a collection from the Dashboard or Sidebar + button',
                    'Add a request: click + → New Request in [Collection]',
                    'Enter the URL and select the HTTP method (GET, POST, etc.)',
                    'Click Send to execute the request and see the response',
                    'Add assertions, scripts, or use AI Chat for intelligent assistance',
                ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                        <span className="w-5 h-5 rounded-full bg-corporate-100 dark:bg-corporate-900/30 text-corporate-600 dark:text-corporate-400 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                        {step}
                    </div>
                ))}
            </div>

            <H3>Explore the Docs</H3>
            <div className="grid grid-cols-2 gap-2 my-3">
                {[
                    { label: 'Request Editor', id: 'request-editor' },
                    { label: 'Authentication', id: 'auth' },
                    { label: 'Scripts & Automation', id: 'scripts' },
                    { label: 'Test Generation', id: 'tests' },
                    { label: 'Variables', id: 'variables' },
                    { label: 'Mock Server', id: 'mock-server' },
                ].map(link => (
                    <button key={link.id} onClick={() => nav(link.id)} className="text-left text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-corporate-50 dark:hover:bg-corporate-900/20 text-slate-600 dark:text-slate-400 hover:text-corporate-600 dark:hover:text-corporate-400 transition-colors flex items-center gap-2">
                        <ArrowRight size={12} /> {link.label}
                    </button>
                ))}
            </div>
        </>),
    },
    {
        id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard,
        content: () => (<>
            <SectionHeading icon={LayoutDashboard} title="Dashboard" subtitle="Your home screen for managing collections" />
            <P>The Dashboard shows all your collections in a grid layout with quick actions for creating and importing.</P>

            <H3>Quick Actions Bar</H3>
            <PropTable headers={['Button', 'Action']} rows={[
                [<><Plus size={12} className="inline" /> <strong>New Collection</strong></>, 'Opens inline input to name and create a new collection'],
                [<><Terminal size={12} className="inline" /> <strong>Import cURL</strong></>, 'Opens modal to paste a cURL command and import as a request'],
                [<><Upload size={12} className="inline" /> <strong>Import Collection</strong></>, 'Opens modal to upload a Postman or OpenAPI JSON file'],
            ]} />

            <H3>Collection Cards</H3>
            <P>Each card displays:</P>
            <Ul>
                <Li><strong>Collection name</strong> — click to open the collection in the workspace</Li>
                <Li><strong>Request count</strong> — total requests (including inside folders)</Li>
                <Li><strong>Test count</strong> — number of test suites</Li>
                <Li><strong>Last run stats</strong> — passed/failed counts and time ago</Li>
                <Li><strong>Shared badge</strong> — appears if the collection is shared with you, showing &quot;Shared&quot; + role (Editor/Viewer)</Li>
            </Ul>

            <H3>Recent Activity</H3>
            <P>Shows the 5 most recent collection runs across all collections. Each row shows the collection name, passed/failed counts, and time since the run. A green dot means all passed; amber means some failures. Click a row to navigate to that collection.</P>
        </>),
    },
    {
        id: 'sidebar', title: 'Sidebar & Navigation', icon: PanelLeft,
        content: () => (<>
            <SectionHeading icon={PanelLeft} title="Sidebar & Navigation" subtitle="Browse and manage your collections, folders, and requests" />

            <H3>Tree Structure</H3>
            <P>The sidebar shows a hierarchical tree: <strong>Collections → Folders → Requests/WebSockets</strong>. Click a collection to expand it. Click a request to open it in the editor. Folders can be nested to organize related requests.</P>

            <H3>Search</H3>
            <P>Click the <Search size={12} className="inline" /> search icon to open the search bar. It filters across request name, URL, and HTTP method in real-time.</P>

            <H3>Context Menu</H3>
            <P>Right-click (or click the <MoreHorizontal size={12} className="inline" /> three-dot icon) on any item to open the context menu. Available actions depend on the item type:</P>

            <H4>Collection Actions</H4>
            <PropTable headers={['Action', 'Description']} rows={[
                ['Run All', 'Execute every request in the collection sequentially'],
                ['Open Test Dashboard', 'View test suites and results for this collection'],
                ['Rename', 'Inline rename — type new name, press Enter to save, Escape to cancel'],
                ['Settings', 'Open Collection Settings tab (Auth, Scripts, Runs, Overview)'],
                ['Share', 'Open Share modal to invite collaborators (owner only)'],
                ['New Folder', 'Create a subfolder in this collection'],
                ['Export', 'Download as Postman v2.1 JSON file'],
                ['Delete', 'Delete the collection (with confirmation dialog)'],
            ]} />

            <H4>Folder Actions</H4>
            <PropTable headers={['Action', 'Description']} rows={[
                ['Run Folder', 'Execute all requests inside this folder'],
                ['Open Test Dashboard', 'View folder-scoped test results'],
                ['New Request', 'Add a new request inside this folder'],
                ['Move to...', 'Move folder to another location'],
                ['Delete', 'Delete folder and all contents'],
            ]} />

            <H4>Request / WebSocket Actions</H4>
            <PropTable headers={['Action', 'Description']} rows={[
                ['Duplicate', 'Create a copy of this request'],
                ['Move to...', 'Move to a different folder or collection root'],
                ['Delete', 'Remove the request'],
            ]} />

            <H3>Add Menu (+)</H3>
            <P>Click the <Plus size={12} className="inline" /> button at the top of the sidebar to see options:</P>
            <Ul>
                <Li><strong>New Request in [Collection]</strong> — adds a GET request to the selected collection</Li>
                <Li><strong>WebSocket in [Collection]</strong> — adds a WebSocket connection</Li>
                <Li><strong>New Folder in [Collection]</strong> — creates a folder</Li>
                <Li><strong>Import Collection</strong> — upload a file</Li>
                <Li><strong>Import cURL</strong> — paste a cURL command</Li>
            </Ul>

            <H3>Resizable Panels</H3>
            <P>Drag the border between sidebar and editor to resize. The sidebar width ranges from 200–400px. The Intelligence Panel on the right is also resizable (240–480px). Panels auto-collapse on narrow screens (&lt;1200px and &lt;900px breakpoints).</P>

            <InfoBox type="tip">Toggle the sidebar with <Kbd>Ctrl</Kbd>+<Kbd>B</Kbd> and the Intelligence Panel with <Kbd>Ctrl</Kbd>+<Kbd>J</Kbd>.</InfoBox>
        </>),
    },
    {
        id: 'request-editor', title: 'Request Editor', icon: Send,
        content: (nav) => (<>
            <SectionHeading icon={Send} title="Request Editor" subtitle="Build, send, and inspect HTTP requests" />

            <H3>URL Bar</H3>
            <P>The top bar contains three elements:</P>
            <Ul>
                <Li><strong>Method dropdown</strong> — choose GET, POST, PUT, DELETE, PATCH, OPTIONS, or HEAD</Li>
                <Li><strong>URL input</strong> — enter the full URL. Supports <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{variables}}'}</code> syntax. Query parameters are automatically parsed and synced with the Params tab.</Li>
                <Li><strong>Send button</strong> <Play size={12} className="inline" /> — sends the request. Shows a spinner while loading.</Li>
            </Ul>

            <H3>Request Subtabs (6 tabs)</H3>

            <H4>1. Params</H4>
            <P>Key-value editor for query parameters. Each row has an enable/disable checkbox. Adding params here automatically updates the URL, and vice versa. Use the + button to add rows.</P>

            <H4>2. Headers</H4>
            <P>Key-value editor for request headers. Each row has an enable/disable checkbox. Common headers like <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">Content-Type</code>, <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">Authorization</code> can be added manually.</P>

            <H4>3. Body</H4>
            <P>Raw text editor for the request body. Supports JSON, XML, form-data, and other formats. A &quot;Pretty Print&quot; button formats JSON for readability.</P>

            <H4>4. Auth</H4>
            <P>Configure authentication for this specific request. See the <button onClick={() => nav('auth')} className="text-corporate-600 dark:text-corporate-400 underline font-medium">Authentication</button> section for full details on all 5 auth types.</P>

            <H4>5. Scripts</H4>
            <P>Pre-request and post-response JavaScript scripts. See the <button onClick={() => nav('scripts')} className="text-corporate-600 dark:text-corporate-400 underline font-medium">Scripts</button> section for the full PM API reference.</P>

            <H4>6. Assertions</H4>
            <P>Automated response validation rules. See the <button onClick={() => nav('assertions')} className="text-corporate-600 dark:text-corporate-400 underline font-medium">Assertions</button> section for all 23 operators.</P>

            <H3>Response Panel</H3>
            <P>After sending a request, the bottom panel shows:</P>
            <PropTable headers={['Tab', 'Content']} rows={[
                ['Body', 'Response body with JSON syntax highlighting (collapsible tree), table view for arrays, or raw text'],
                ['Headers', 'Response headers in a key-value table'],
                ['Tests', 'Assertion and script test results (pass/fail for each)'],
                ['Debug', 'Console output from pre/post scripts (console.log, warn, error)'],
            ]} />
            <P>The status bar shows: <Badge color="green">200 OK</Badge> status code, response time in ms, and response size in bytes.</P>

            <H3>Variable Extraction</H3>
            <P>After receiving a response, use the &quot;Extract to Variable&quot; feature to save a value from the response into a chain variable. Enter the JSON path (e.g., <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">data.user.id</code>) and a variable name, then click Extract.</P>

            <H3>Code Generation</H3>
            <P>Click the code generation button to open the Code Gen modal. See <button onClick={() => nav('codegen')} className="text-corporate-600 dark:text-corporate-400 underline font-medium">Code Generation</button> for details.</P>
        </>),
    },
    {
        id: 'auth', title: 'Authentication', icon: Shield,
        content: () => (<>
            <SectionHeading icon={Shield} title="Authentication" subtitle="5 auth types with inheritance and force override" />

            <H3>Auth Resolution Chain</H3>
            <P>When a request is sent, authentication resolves in this order:</P>
            <div className="flex items-center gap-2 flex-wrap my-3 text-xs">
                <Badge color="red">Force Collection Auth</Badge> <ArrowRight size={10} className="text-slate-400" />
                <Badge color="purple">Request Auth</Badge> <ArrowRight size={10} className="text-slate-400" />
                <Badge color="blue">Inherit from Collection</Badge> <ArrowRight size={10} className="text-slate-400" />
                <Badge color="slate">No Auth</Badge>
            </div>

            <H3>Auth Types</H3>

            <H4>1. No Auth</H4>
            <P>No authentication headers are sent. Use this for public APIs.</P>

            <H4>2. Bearer Token</H4>
            <P>Sends an <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> header.</P>
            <CodeBlock code={`Authorization: Bearer eyJhbGciOiJIUzI1NiIs...`} />

            <H4>3. Basic Auth</H4>
            <P>Enter a username and password. They are Base64-encoded and sent as <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">Authorization: Basic &lt;base64&gt;</code>.</P>

            <H4>4. API Key</H4>
            <P>Send a custom header with your API key. Configure the header name (default: <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">X-API-Key</code>) and the key value.</P>
            <CodeBlock code={`X-API-Key: sk-1234567890abcdef`} />

            <H4>5. Auto-Auth (Login → Token)</H4>
            <P>Automatically logs in to an endpoint and extracts a token. Ideal for OAuth2 password flows or custom login APIs.</P>
            <PropTable headers={['Field', 'Description', 'Example']} rows={[
                ['Login URL', 'The endpoint that returns a token', 'https://api.example.com/auth/login'],
                ['Method', 'HTTP method for the login request', 'POST'],
                ['Body', 'JSON body for the login request', '{"email": "user@test.com", "password": "pass123"}'],
                ['Token Path', 'Dot-notation path to extract the token from response', 'data.access_token'],
                ['Headers', 'Optional headers for the login request', 'Content-Type: application/json'],
            ]} />
            <P>Click <strong>&quot;Test Login Now&quot;</strong> to verify your configuration. Once a token is acquired, it&apos;s cached and reused. Click <strong>&quot;Clear Token&quot;</strong> to force a re-login.</P>

            <H3>Force Collection Auth</H3>
            <P>Enable this toggle in <strong>Collection Settings → Auth tab</strong> to force ALL requests in the collection to use the collection-level auth, ignoring their individual auth settings. Useful when every endpoint uses the same token.</P>
            <InfoBox type="warning">When Force Collection Auth is enabled, request-level auth settings are completely ignored — even &quot;No Auth&quot; requests will use the collection auth.</InfoBox>

            <H3>Inherit from Collection</H3>
            <P>Select &quot;Inherit from Collection&quot; on a request to use whatever auth is configured at the collection level. This is the default for new requests.</P>
        </>),
    },
    {
        id: 'scripts', title: 'Pre/Post Scripts', icon: Terminal,
        content: () => (<>
            <SectionHeading icon={Terminal} title="Pre/Post Scripts" subtitle="JavaScript automation before and after requests" />
            <P>Scripts let you run JavaScript code before sending a request (pre-request) and after receiving a response (post-response). Available at both the <strong>request level</strong> (Scripts subtab) and <strong>collection level</strong> (Collection Settings → Scripts tab).</P>

            <H3>PM API Reference</H3>

            <H4>Chain Variables (pm.variables)</H4>
            <CodeBlock code={`// Set a variable (persists across requests)
pm.variables.set('authToken', 'eyJhbG...');

// Get a variable
const token = pm.variables.get('authToken');

// Get all variables as object
const all = pm.variables.toObject();`} />

            <H4>Environment Variables (pm.environment)</H4>
            <CodeBlock code={`// Read from active environment (falls back to Global)
const baseUrl = pm.environment.get('baseUrl');

// Set a variable in the current environment
pm.environment.set('lastRunTime', Date.now());`} />

            <H4>Request Data (pre-request only)</H4>
            <CodeBlock code={`pm.request.url       // Full URL string
pm.request.method    // "GET", "POST", etc.
pm.request.headers   // Resolved headers object
pm.request.body      // Request body string`} />

            <H4>Response Data (post-response only)</H4>
            <CodeBlock code={`pm.response.status      // HTTP status code (200, 404, etc.)
pm.response.statusText  // "OK", "Not Found", etc.
pm.response.time        // Response time in ms
pm.response.headers     // Response headers object
pm.response.json()      // Parse body as JSON (or null)
pm.response.text()      // Body as plain string`} />

            <H4>Test Assertions</H4>
            <CodeBlock code={`// Named test block
pm.test("Status is 200", function() {
    if (pm.response.status !== 200) {
        throw new Error("Expected 200, got " + pm.response.status);
    }
});

// BDD-style with pm.expect()
pm.expect(pm.response.status).to.equal(200);
pm.expect(pm.response.json().name).to.include("John");
pm.expect(pm.response.json().items).to.have.lengthOf(5);`} />

            <H4>pm.expect() Matchers (full list)</H4>
            <PropTable headers={['Matcher', 'Example']} rows={[
                ['.to.equal(val)', 'pm.expect(status).to.equal(200)'],
                ['.to.include(val)', 'pm.expect(body).to.include("success")'],
                ['.to.have.lengthOf(n)', 'pm.expect(items).to.have.lengthOf(3)'],
                ['.to.be.null', 'pm.expect(val).to.be.null'],
                ['.to.be.true / .to.be.false', 'pm.expect(active).to.be.true'],
                ['.to.be.a(type)', 'pm.expect(name).to.be.a("string")'],
                ['.to.be.above(n)', 'pm.expect(count).to.be.above(0)'],
                ['.to.be.below(n)', 'pm.expect(time).to.be.below(2000)'],
                ['.to.have.property(key)', 'pm.expect(user).to.have.property("id")'],
                ['.to.not.be.empty', 'pm.expect(list).to.not.be.empty'],
            ]} />

            <H4>Console Output</H4>
            <CodeBlock code={`console.log("Debug info:", someVar);
console.warn("Slow response:", pm.response.time);
console.error("Missing field!");
console.info("Request sent to:", pm.request.url);`} />
            <P>Console output appears in the <strong>Debug</strong> tab of the response panel.</P>

            <H3>Script Examples</H3>

            <H4>Example 1: Extract token from login</H4>
            <CodeBlock code={`// Post-response script on a login request
const data = pm.response.json();
pm.variables.set('authToken', data.access_token);
pm.variables.set('userId', data.user.id);
console.log("Token acquired for user:", data.user.id);`} />

            <H4>Example 2: Add dynamic timestamp</H4>
            <CodeBlock code={`// Pre-request script
pm.variables.set('requestTime', new Date().toISOString());
console.log("Request will be sent at:", pm.variables.get('requestTime'));`} />

            <H4>Example 3: Validate response structure</H4>
            <CodeBlock code={`// Post-response script
const body = pm.response.json();
pm.test("Has required fields", function() {
    pm.expect(body).to.have.property("id");
    pm.expect(body).to.have.property("name");
    pm.expect(body.name).to.be.a("string");
});`} />

            <H3>Security Restrictions</H3>
            <P>Scripts run in a sandboxed environment. The following are <strong>blocked</strong>:</P>
            <Ul>
                <Li><code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">window</code>, <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">document</code>, <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">fetch</code>, <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">XMLHttpRequest</code></Li>
                <Li><code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">localStorage</code>, <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">sessionStorage</code>, <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">indexedDB</code></Li>
                <Li><code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">eval()</code>, <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">importScripts()</code></Li>
            </Ul>
            <InfoBox type="warning">Scripts have a 5-second timeout. Long-running scripts will be terminated.</InfoBox>

            <H3>Collection-Level Scripts</H3>
            <P>Set scripts in <strong>Collection Settings → Scripts tab</strong>. These run before/after <em>every</em> request when using the Collection Runner.</P>
        </>),
    },
    {
        id: 'assertions', title: 'Assertions', icon: CheckCircle,
        content: () => (<>
            <SectionHeading icon={CheckCircle} title="Assertions" subtitle="Automated response validation with 23 operators" />
            <P>Assertions are rules that automatically validate API responses. Add them in the <strong>Assertions subtab</strong> of the Request Editor. They run every time you send a request and in the Collection Runner.</P>

            <H3>How to Add Assertions</H3>
            <Ul>
                <Li>Open a request → click the <strong>Assertions</strong> subtab</Li>
                <Li>Click <strong>Add Assertion</strong></Li>
                <Li>Select the assertion type, operator, and expected value</Li>
                <Li>Send the request — results appear in the Tests tab of the response panel</Li>
            </Ul>

            <H3>Assertion Types</H3>
            <PropTable headers={['Type', 'What It Checks', 'Example']} rows={[
                ['status_code', 'HTTP status code', 'Status equals 200'],
                ['response_time', 'Response time in ms', 'Time less_than 2000'],
                ['body_contains', 'Substring in response body', 'Body contains "success"'],
                ['body_not_contains', 'Substring NOT in response', 'Body not_contains "error"'],
                ['json_path', 'Value at a JSON path (dot notation)', 'data.user.name equals "John"'],
                ['header_contains', 'Value in a response header', 'Content-Type contains "json"'],
                ['body_json_schema', 'Validate body against JSON Schema', 'Full schema validation'],
            ]} />

            <H3>Comparison Operators (23 total)</H3>
            <PropTable headers={['Operator', 'Description']} rows={[
                ['equals', 'Exact match (string comparison)'],
                ['not_equals', 'Does not match'],
                ['contains', 'String includes substring'],
                ['not_contains', 'String does not include substring'],
                ['starts_with', 'String starts with prefix'],
                ['ends_with', 'String ends with suffix'],
                ['matches_regex', 'Matches a regular expression pattern'],
                ['greater_than', 'Numeric: actual > expected'],
                ['greater_than_or_equal', 'Numeric: actual >= expected'],
                ['less_than', 'Numeric: actual < expected'],
                ['less_than_or_equal', 'Numeric: actual <= expected'],
                ['exists', 'Field is not undefined/null'],
                ['is_null', 'Value is null or undefined'],
                ['is_not_null', 'Value is not null and not undefined'],
                ['is_empty', 'Empty string, array, object, or null'],
                ['is_not_empty', 'Has content (non-empty)'],
                ['length_equals', 'Array/string .length === expected'],
                ['length_greater_than', 'Array/string .length > expected'],
                ['length_less_than', 'Array/string .length < expected'],
                ['is_type', 'typeof check (string, number, object, array, boolean)'],
                ['body_json_schema', 'Full JSON Schema validation'],
            ]} />

            <H3>JSON Path Examples</H3>
            <CodeBlock code={`data.user.id          → access nested fields
data.items[0].name    → access array elements
data.items            → access entire array (use length_equals)
headers.content-type  → access response headers (case-insensitive)`} />

            <H3>JSON Schema Validation</H3>
            <P>The <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">body_json_schema</code> type validates the entire response body against a JSON Schema. Supports: type, required, properties, items, enum, minLength, maxLength, minimum, maximum.</P>
            <CodeBlock code={`{
  "type": "object",
  "required": ["id", "name", "email"],
  "properties": {
    "id": { "type": "number" },
    "name": { "type": "string", "minLength": 1 },
    "email": { "type": "string" }
  }
}`} />

            <InfoBox type="tip">Assertions run automatically in the Collection Runner. Failed assertions mark a request as &quot;failed&quot; in the summary.</InfoBox>
        </>),
    },
    {
        id: 'environments', title: 'Environment Variables', icon: Globe,
        content: (nav) => (<>
            <SectionHeading icon={Globe} title="Environment Variables" subtitle="Named sets of key-value pairs for different contexts" />
            <P>Environments let you store variables (like base URLs, API keys, tokens) and switch between them. For example, you might have &quot;Development&quot;, &quot;Staging&quot;, and &quot;Production&quot; environments with different base URLs.</P>

            <H3>Managing Environments</H3>
            <Ul>
                <Li>Open the Environment Manager from the sidebar footer (Globe icon)</Li>
                <Li><strong>Global</strong> environment always exists and cannot be deleted — it&apos;s the fallback</Li>
                <Li>Click <Plus size={10} className="inline" /> to create a new environment</Li>
                <Li>Switch active environment using the dropdown</Li>
                <Li>Delete an environment with the <Trash2 size={10} className="inline" /> trash icon (except Global)</Li>
            </Ul>

            <H3>Variable Table</H3>
            <Ul>
                <Li><strong>Checkbox</strong> — enable/disable each variable (disabled variables are not resolved)</Li>
                <Li><strong>Variable name</strong> — the key to reference in requests</Li>
                <Li><strong>Value</strong> — the value (masked by default, toggle with <Eye size={10} className="inline" /> eye icon)</Li>
                <Li><Plus size={10} className="inline" /> <strong>Add Variable</strong> — adds a new empty row</Li>
            </Ul>

            <H3>Using Variables</H3>
            <P>Use <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{variableName}}'}</code> syntax anywhere in URLs, headers, or request bodies:</P>
            <CodeBlock code={`URL:     {{baseUrl}}/api/users
Header:  Authorization: Bearer {{authToken}}
Body:    { "api_key": "{{apiKey}}" }`} />

            <H3>Variable Resolution Priority</H3>
            <div className="flex items-center gap-2 flex-wrap my-3 text-xs">
                <Badge color="purple">Dynamic $vars</Badge> <ArrowRight size={10} className="text-slate-400" />
                <Badge color="amber">Chain vars</Badge> <ArrowRight size={10} className="text-slate-400" />
                <Badge color="blue">Active env</Badge> <ArrowRight size={10} className="text-slate-400" />
                <Badge color="slate">Global env</Badge>
            </div>
            <P>Dynamic variables (like <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{$timestamp}}'}</code>) take highest priority, followed by chain variables set in scripts, then the active environment, and finally Global. See <button onClick={() => nav('variables')} className="text-corporate-600 dark:text-corporate-400 underline font-medium">Dynamic Variables</button> for the full list.</P>

            <InfoBox type="note">Variables resolve at <strong>send time</strong>, not when you type them. The editor shows the raw <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{placeholder}}'}</code> text.</InfoBox>
        </>),
    },
    {
        id: 'variables', title: 'Dynamic & Chain Variables', icon: Zap,
        content: () => (<>
            <SectionHeading icon={Zap} title="Dynamic & Chain Variables" subtitle="Built-in dynamic values and request chaining" />

            <H3>Built-in Dynamic Variables</H3>
            <P>These generate a fresh value every time a request is sent:</P>
            <PropTable headers={['Variable', 'Description', 'Example Output']} rows={[
                [<code>{'{{$timestamp}}'}</code>, 'Unix timestamp in milliseconds', '1709312400000'],
                [<code>{'{{$isoTimestamp}}'}</code>, 'ISO 8601 date-time string', '2026-03-01T12:00:00.000Z'],
                [<code>{'{{$randomInt}}'}</code>, 'Random integer 0–999', '742'],
                [<code>{'{{$guid}}'}</code>, 'UUID v4', '550e8400-e29b-41d4-a716-446655440000'],
                [<code>{'{{$randomEmail}}'}</code>, 'Random email address', 'user_a3k2x@test.com'],
                [<code>{'{{$randomName}}'}</code>, 'Random name from built-in list', 'Alice'],
                [<code>{'{{$randomPhone}}'}</code>, 'Random 10-digit phone number', '5551234567'],
                [<code>{'{{$randomBoolean}}'}</code>, 'Random "true" or "false"', 'true'],
            ]} />

            <H3>Chain Variables</H3>
            <P>Chain variables allow you to pass data between requests. Set them in post-response scripts and use them in subsequent requests.</P>
            <CodeBlock code={`// POST /auth/login — Post-response script:
const data = pm.response.json();
pm.variables.set('authToken', data.access_token);
pm.variables.set('userId', data.user.id);

// GET /users/{{userId}} — Uses the extracted userId
// Header: Authorization: Bearer {{authToken}}`} />

            <H3>Request Chaining Example</H3>
            <P>A common flow: Login → Extract token → Use token in subsequent requests.</P>
            <div className="flex items-center gap-2 flex-wrap my-3 text-xs">
                <Badge color="blue">1. POST /login</Badge> <ArrowRight size={10} className="text-slate-400" />
                <Badge color="amber">Extract token via script</Badge> <ArrowRight size={10} className="text-slate-400" />
                <Badge color="green">2. GET /profile (uses token)</Badge>
            </div>

            <InfoBox type="tip">Chain variables persist across requests and survive page refreshes. Use <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">pm.variables.set()</code> in post-response scripts and reference them with <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{variableName}}'}</code> in any field.</InfoBox>
        </>),
    },
    {
        id: 'tests', title: 'Test Suites & AI Generation', icon: FlaskConical,
        content: () => (<>
            <SectionHeading icon={FlaskConical} title="Test Suites & AI Test Generation" subtitle="AI-powered test creation and management" />

            <H3>Generating Tests with AI</H3>
            <Ul>
                <Li>Open the <strong>Intelligence Panel</strong> (right panel) → <strong>Tests</strong> tab</Li>
                <Li>Click <strong>&quot;Generate Tests&quot;</strong> — AI analyzes your collection&apos;s requests and OpenAPI spec</Li>
                <Li>Tests are categorized: <Badge color="green">happy_path</Badge> <Badge color="amber">edge_case</Badge> <Badge color="red">security</Badge> <Badge color="blue">validation</Badge> <Badge color="purple">error_handling</Badge></Li>
            </Ul>

            <H3>Test Suite Structure</H3>
            <P>Each generated test suite contains:</P>
            <Ul>
                <Li><strong>Name</strong> and description</Li>
                <Li><strong>Tests</strong> — individual test cases with method, endpoint, headers, payload, expected status</Li>
                <Li><strong>Category badges</strong> — visual indicators of test type</Li>
                <Li><strong>Request linking</strong> — tests auto-link to matching requests by endpoint signature</Li>
            </Ul>

            <H3>Running Test Suites</H3>
            <P>Click &quot;Run&quot; on a test suite to execute all its tests. Results show pass/fail for each test. The test suite card displays a summary of the last run.</P>

            <H3>Auto-Linking</H3>
            <P>Tests match to requests using: (1) explicit requestId link, (2) endpoint signature match (METHOD::path), or (3) fuzzy URL tail matching. This linking determines which request is run when executing a test.</P>

            <H3>AI Test Suggestions</H3>
            <P>After running a request, AI may suggest additional assertions. These appear as &quot;pending suggestions&quot; that you can approve individually or all at once. Approved suggestions become real assertions on the request.</P>

            <H3>Importing Tests</H3>
            <P>Test endpoints can be imported as requests. The importer auto-creates folders organized by URL path segment and skips duplicates.</P>
        </>),
    },
    {
        id: 'runner', title: 'Collection Runner', icon: Play,
        content: () => (<>
            <SectionHeading icon={Play} title="Collection Runner" subtitle="Execute all requests with progress tracking and AI diagnosis" />

            <H3>Opening the Runner</H3>
            <Ul>
                <Li><strong>Collection level:</strong> Right-click a collection → &quot;Run All&quot;</Li>
                <Li><strong>Folder level:</strong> Right-click a folder → &quot;Run Folder&quot;</Li>
                <Li><strong>Test suite:</strong> Click &quot;Run&quot; on a test suite card</Li>
            </Ul>

            <H3>Execution Modes</H3>
            <PropTable headers={['Mode', 'Behavior']} rows={[
                ['Sequential', 'Requests run one after another — chain variables propagate between them'],
                ['Parallel', 'Requests run concurrently — faster but no variable chaining'],
            ]} />

            <H3>Results Table</H3>
            <P>Each request row shows: name, method badge, URL, status code, response time, response size, and pass/fail icon. Click a row to expand it and see:</P>
            <Ul>
                <Li>Full response body (JSON highlighted)</Li>
                <Li>Response headers</Li>
                <Li>Assertion results (each assertion with pass/fail)</Li>
                <Li>Script test results</Li>
            </Ul>

            <H3>AI Diagnosis</H3>
            <P>When a request fails, click the <Lightbulb size={12} className="inline" /> diagnosis icon. AI analyzes the failure and returns:</P>
            <Ul>
                <Li><strong>Root cause</strong> — one-line summary</Li>
                <Li><strong>Explanation</strong> — 2-3 sentence detailed analysis</Li>
                <Li><strong>Suggested fix</strong> — actionable recommendation</Li>
                <Li><strong>Confidence</strong> — high, medium, or low</Li>
            </Ul>

            <H3>Data-Driven Testing</H3>
            <P>Upload a CSV or JSON data file to run the same requests multiple times with different data. Each iteration uses a different row from the data file. Variables from the data file are available via <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{columnName}}'}</code> syntax.</P>

            <H3>Summary Statistics</H3>
            <P>After a run completes, the summary shows: total requests, passed, failed, average response time, slowest and fastest requests.</P>

            <H3>Run History</H3>
            <P>Runs are saved automatically (up to 20 per collection). View past runs in <strong>Collection Settings → Runs tab</strong>. Click the eye icon to reload a historical run in the runner.</P>
        </>),
    },
    {
        id: 'sharing', title: 'Sharing & Collaboration', icon: Users,
        content: () => (<>
            <SectionHeading icon={Users} title="Sharing & Collaboration" subtitle="Share collections with team members in real-time" />
            <InfoBox type="note">Sharing requires a Supabase account. It is not available in offline/local mode.</InfoBox>

            <H3>How to Share</H3>
            <Ul>
                <Li>Right-click a collection → <strong>Share</strong> (owner only)</Li>
                <Li>Or open <strong>Collection Settings → Sharing tab</strong></Li>
                <Li>Enter the collaborator&apos;s email address</Li>
                <Li>Select a role: <Badge color="blue">Viewer</Badge> or <Badge color="amber">Editor</Badge></Li>
                <Li>Click <strong>Send Invite</strong></Li>
            </Ul>

            <H3>Role Permissions</H3>
            <PropTable headers={['Action', 'Owner', 'Editor', 'Viewer']} rows={[
                ['View requests & responses', 'Yes', 'Yes', 'Yes'],
                ['Send requests', 'Yes', 'Yes', 'Yes'],
                ['Run All / Run Folder', 'Yes', 'Yes', 'Yes'],
                ['View Test Dashboard', 'Yes', 'Yes', 'Yes'],
                ['Export collection', 'Yes', 'Yes', 'Yes'],
                ['Edit requests', 'Yes', 'Yes', 'No'],
                ['Add/delete requests', 'Yes', 'Yes', 'No'],
                ['Create folders', 'Yes', 'Yes', 'No'],
                ['Rename items', 'Yes', 'Yes', 'No'],
                ['Edit auth/scripts', 'Yes', 'Yes', 'No'],
                ['Share with others', 'Yes', 'No', 'No'],
                ['Delete collection', 'Yes', 'No', 'No'],
            ]} />

            <H3>Visual Indicators</H3>
            <Ul>
                <Li><strong>Dashboard cards</strong> — shared collections show a &quot;Shared&quot; badge + role badge (Editor/Viewer)</Li>
                <Li><strong>Sidebar</strong> — shared collections show a compact role badge next to the name</Li>
                <Li><strong>Request Editor</strong> — viewers see a &quot;View-only&quot; banner; edits will not be saved</Li>
                <Li><strong>Collection Settings</strong> — viewers see a read-only banner; inputs are disabled</Li>
            </Ul>

            <H3>Managing Access</H3>
            <P>In the Share modal, the &quot;Who has access&quot; section lists all collaborators. Click the <Trash2 size={12} className="inline" /> trash icon to remove a collaborator. Only the owner can manage shares.</P>

            <H3>Real-Time Sync</H3>
            <P>Changes propagate instantly via Supabase Realtime. When someone shares a collection with you or changes your role, your collection list updates automatically without refreshing.</P>
        </>),
    },
    {
        id: 'websocket', title: 'WebSocket Testing', icon: Plug,
        content: () => (<>
            <SectionHeading icon={Plug} title="WebSocket Testing" subtitle="Connect, send messages, and monitor real-time communication" />

            <H3>Creating a WebSocket</H3>
            <P>Click the <Plus size={12} className="inline" /> button in the sidebar → <strong>WebSocket in [Collection]</strong>. This creates a new WebSocket tab in the editor.</P>

            <H3>Connection Bar</H3>
            <PropTable headers={['Element', 'Description']} rows={[
                ['URL Input', 'Enter the WebSocket URL (wss:// or ws://). Disabled while connected.'],
                ['Protocols', 'Optional comma-separated subprotocols (e.g., graphql-ws, mqtt)'],
                ['Connect/Disconnect', 'Green button to connect, red to disconnect. Shows spinner while connecting.'],
                ['Status Indicator', 'Colored dot + label: Disconnected (gray), Connecting (yellow pulse), Connected (green), Error (red)'],
            ]} />

            <H3>Sending Messages</H3>
            <P>Type a message in the textarea at the bottom and press <Kbd>Enter</Kbd> to send (or click the Send button). Use <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for newlines. The input is disabled when not connected.</P>

            <H3>Message Log</H3>
            <P>Messages appear in a scrollable log with color coding:</P>
            <Ul>
                <Li><Badge color="blue">Sent</Badge> — your outgoing messages (blue background, up arrow)</Li>
                <Li><Badge color="green">Received</Badge> — server responses (green background, down arrow)</Li>
                <Li><Badge color="slate">System</Badge> — connection events, errors, disconnection reasons</Li>
            </Ul>
            <P>Each message shows a timestamp and size in bytes. Hover over a message to see the copy button.</P>

            <H3>Filters</H3>
            <P>Use the filter buttons (All / Sent / Received) to show only specific message types. The counter shows the total sent and received counts.</P>
        </>),
    },
    {
        id: 'mock-server', title: 'Mock Server', icon: Server,
        content: () => (<>
            <SectionHeading icon={Server} title="AI Mock Server" subtitle="Generate realistic API responses on-the-fly with Gemini" />

            <H3>How It Works</H3>
            <P>Send any request to <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">/mock-server/any/path</code> and Gemini AI generates a realistic JSON response based on the HTTP method and path. No real backend needed.</P>
            <CodeBlock code={`GET  /mock-server/api/users       → Returns a list of user objects
GET  /mock-server/api/users/123  → Returns a single user object
POST /mock-server/api/orders     → Returns a created order response`} />

            <H3>Caching</H3>
            <P>Once a mock is generated, it&apos;s cached. The same method + path returns the same response on subsequent calls. Mocks persist across server restarts (stored in <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">backend/data/mocks.json</code>).</P>

            <H3>Mock Server Panel</H3>
            <P>Navigate to the Mock Server view to manage your mocks:</P>
            <Ul>
                <Li><RefreshCw size={12} className="inline" /> <strong>Refresh</strong> — reload the list of active mocks</Li>
                <Li><Trash2 size={12} className="inline" /> <strong>Clear All</strong> — delete all cached mocks</Li>
                <Li>Each mock card shows: method badge, path, response preview, copy URL button, delete button</Li>
            </Ul>

            <InfoBox type="tip">Use the mock server for prototyping when your real API isn&apos;t ready. The AI generates contextually appropriate data — names, dates, IDs, nested objects — all inferred from the URL path.</InfoBox>
        </>),
    },
    {
        id: 'codegen', title: 'Code Generation', icon: Code,
        content: () => (<>
            <SectionHeading icon={Code} title="Code Generation" subtitle="Generate production-ready API client code in 11 languages" />

            <H3>Opening the Generator</H3>
            <P>In the Request Editor, click the code generation button (Code icon with sparkles). This opens the Code Gen modal.</P>

            <H3>Supported Languages & Variants</H3>
            <PropTable headers={['Language', 'Library Variants']} rows={[
                ['Python', 'requests, httpx, aiohttp'],
                ['JavaScript', 'fetch, axios, node-fetch'],
                ['Go', 'net/http'],
                ['Java', 'HttpClient'],
                ['C#', 'HttpClient, RestSharp'],
                ['PHP', 'cURL, Guzzle'],
                ['Ruby', 'Net::HTTP, HTTParty'],
                ['Rust', 'reqwest'],
                ['Swift', 'URLSession'],
                ['Kotlin', 'OkHttp'],
                ['Shell', 'cURL, wget, HTTPie'],
            ]} />

            <H3>Options</H3>
            <Ul>
                <Li><strong>Include Test Assertions</strong> — checkbox to add test code (pytest, Jest, JUnit, etc.)</Li>
                <Li><strong>Copy button</strong> — copy the generated code to clipboard</Li>
            </Ul>

            <P>The generated code includes proper imports, error handling, type hints, and response parsing. Powered by Gemini AI.</P>
        </>),
    },
    {
        id: 'import-export', title: 'Import & Export', icon: Download,
        content: () => (<>
            <SectionHeading icon={Download} title="Import & Export" subtitle="Move data in and out of TestOrbit" />

            <H3>Import cURL</H3>
            <P>Dashboard or Sidebar + menu → <strong>Import cURL</strong>. Paste a cURL command into the textarea. Click <strong>Parse</strong> to preview the extracted method, URL, headers, and body. Then click <strong>Import</strong> to create a request in your active collection.</P>
            <CodeBlock code={`curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-xxx" \\
  -d '{"name": "John", "email": "john@test.com"}'`} />

            <H3>Import Collection</H3>
            <P>Upload a Postman Collection v2.1 JSON file or OpenAPI/Swagger specification. The importer creates a full collection with folders and requests preserving the original structure.</P>

            <H3>Import OpenAPI Spec</H3>
            <P>Intelligence Panel → <strong>Spec tab</strong> → paste an OpenAPI/Swagger JSON or YAML spec → click <strong>Import</strong>. This creates requests from every endpoint in the spec, organized into folders by the first path segment. Parameters, request bodies, and content types are extracted automatically.</P>

            <H3>Export Collection</H3>
            <P>Right-click a collection in the sidebar → <strong>Export</strong>. Downloads the collection as a Postman v2.1 compatible JSON file.</P>
        </>),
    },
    {
        id: 'ai-chat', title: 'AI Chat (Intelligence)', icon: MessageSquare,
        content: () => (<>
            <SectionHeading icon={MessageSquare} title="AI Chat (Intelligence Panel)" subtitle="Conversational AI assistant for API testing" />

            <H3>Accessing the Panel</H3>
            <P>Toggle the Intelligence Panel with <Kbd>Ctrl</Kbd>+<Kbd>J</Kbd> or click the collapse button. The panel has 3 tabs: <strong>Chat</strong>, <strong>Spec</strong>, and <strong>Tests</strong>.</P>

            <H3>Chat Tab</H3>
            <P>Describe what you want to test in natural language:</P>
            <Ul>
                <Li>&quot;Test the login endpoint with email and password&quot;</Li>
                <Li>&quot;Create a POST request to /api/users with a JSON body&quot;</Li>
                <Li>&quot;Give me 5 endpoints for testing a blog API&quot;</Li>
                <Li>&quot;What&apos;s wrong with this 401 error?&quot;</Li>
            </Ul>
            <P>AI responds with explanation and actionable <strong>suggestion cards</strong> showing method, URL, and description. Click:</P>
            <Ul>
                <Li><strong>Apply</strong> — populates the request editor with the suggested configuration</Li>
                <Li><strong>Apply &amp; Run</strong> — applies and immediately sends the request</Li>
            </Ul>

            <H3>Spec Context</H3>
            <P>Toggle &quot;Use spec context&quot; to attach your OpenAPI spec to AI messages. This dramatically improves AI accuracy — it knows your exact endpoints, schemas, and parameters.</P>

            <H3>Spec Tab</H3>
            <Ul>
                <Li><strong>Paste spec</strong> — paste OpenAPI/Swagger JSON or YAML directly</Li>
                <Li><strong>Fetch from URL</strong> — auto-discovers /openapi.json, /swagger.json, /api-docs, etc.</Li>
                <Li><strong>Import endpoints</strong> — creates requests from spec paths</Li>
                <Li><strong>Base URL</strong> — set if not defined in the spec&apos;s servers field</Li>
            </Ul>

            <H3>Tests Tab</H3>
            <P>View and manage AI-generated test suites. See the <strong>Test Suites</strong> section for full details.</P>
        </>),
    },
    {
        id: 'contract-testing', title: 'Contract Testing', icon: GitBranch,
        content: () => (<>
            <SectionHeading icon={GitBranch} title="Contract Testing" subtitle="Validate API responses against your OpenAPI schema" />

            <H3>What is Contract Testing?</H3>
            <P>Contract testing verifies that your API&apos;s actual responses match the expected schema defined in your OpenAPI specification. It detects &quot;contract drift&quot; — when the API and spec diverge.</P>

            <H3>How to Run</H3>
            <Ul>
                <Li>Paste your OpenAPI spec in the Intelligence Panel → Spec tab</Li>
                <Li>Send requests to cache responses</Li>
                <Li>Click <strong>Contract Check</strong> in the Tests tab</Li>
            </Ul>

            <H3>Drift Detection</H3>
            <P>The contract checker identifies:</P>
            <PropTable headers={['Drift Type', 'Description', 'Example']} rows={[
                ['Type mismatch', 'Field type differs from schema', 'Expected string, got number'],
                ['Missing field', 'Required field not in response', 'Missing "email" field'],
                ['Extra field', 'Field in response not in schema', 'Unexpected "debug_info"'],
                ['Invalid enum', 'Value not in allowed enum list', '"status" got "pending", expected ["active","inactive"]'],
                ['Format violation', 'Value doesn\'t match format', '"created_at" is not valid date-time'],
            ]} />

            <H3>Severity Levels</H3>
            <Ul>
                <Li><Badge color="red">Error</Badge> — breaking change (type mismatch, missing required field)</Li>
                <Li><Badge color="amber">Warning</Badge> — potential issue (extra fields, format violations)</Li>
                <Li><Badge color="blue">Info</Badge> — non-breaking observation</Li>
            </Ul>

            <H3>Supported Format Validators</H3>
            <P>date-time, date, email, UUID, URI, IPv4</P>

            <InfoBox type="tip">Run contract tests regularly to catch API drift early. The AI can also analyze drifts and suggest fixes.</InfoBox>
        </>),
    },
    {
        id: 'shortcuts', title: 'Keyboard Shortcuts', icon: Keyboard,
        content: () => (<>
            <SectionHeading icon={Keyboard} title="Keyboard Shortcuts" subtitle="Navigate faster with keyboard commands" />
            <div className="space-y-1.5 my-3">
                {[
                    { keys: ['Ctrl', 'B'], action: 'Toggle Sidebar' },
                    { keys: ['Ctrl', 'J'], action: 'Toggle Intelligence Panel' },
                    { keys: ['Ctrl', 'N'], action: 'New Request' },
                    { keys: ['Ctrl', 'Enter'], action: 'Send Request' },
                    { keys: ['Ctrl', 'S'], action: 'Save Current' },
                    { keys: ['Esc'], action: 'Close Modal / Runner / Cancel Edit' },
                    { keys: ['Enter'], action: 'Confirm Inline Edit / Submit Form' },
                    { keys: ['Shift', 'Enter'], action: 'Newline in Textareas (instead of submit)' },
                ].map(s => (
                    <div key={s.action} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{s.action}</span>
                        <div className="flex items-center gap-1">
                            {s.keys.map((k, i) => (
                                <React.Fragment key={i}>
                                    <Kbd>{k}</Kbd>
                                    {i < s.keys.length - 1 && <span className="text-slate-400 text-xs">+</span>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>),
    },
    {
        id: 'collection-settings', title: 'Collection Settings', icon: Settings,
        content: (nav) => (<>
            <SectionHeading icon={Settings} title="Collection Settings" subtitle="Configure auth, scripts, view history, and manage sharing" />
            <P>Open collection settings by clicking the gear icon on a collection in the sidebar, or by right-clicking → <strong>Settings</strong>. This opens a dedicated tab with 4-5 subtabs.</P>

            <H3>Tabs</H3>
            <PropTable headers={['Tab', 'Content']} rows={[
                [<><Shield size={12} className="inline" /> <strong>Auth</strong></>, <>Collection-wide authentication. See <button onClick={() => nav('auth')} className="text-corporate-600 dark:text-corporate-400 underline">Authentication</button> for details. Includes the Force Auth toggle.</>],
                [<><Terminal size={12} className="inline" /> <strong>Scripts</strong></>, <>Collection-level pre-request and post-response scripts. Run before/after ALL requests in the runner.</>],
                [<><Play size={12} className="inline" /> <strong>Runs</strong></>, 'Run history — list of past runs with timestamps, pass/fail summaries, and a replay button.'],
                [<><Settings size={12} className="inline" /> <strong>Overview</strong></>, 'Collection statistics: request count, folder count, WebSocket count, test suite count, run count.'],
                [<><Users size={12} className="inline" /> <strong>Sharing</strong></>, 'Invite collaborators and manage access. Only visible to the collection owner.'],
            ]} />

            <H3>Run All Button</H3>
            <P>The header includes a <Play size={12} className="inline" /> Run All button that opens the Collection Runner for this collection.</P>

            <H3>Viewer Mode</H3>
            <P>If you have viewer access to a shared collection, settings display in read-only mode with disabled inputs and a &quot;View-only access&quot; banner.</P>
        </>),
    },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function DocsPanel() {
    const [activeSection, setActiveSection] = useState('overview');
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);

    const currentSection = DOCS_SECTIONS.find(s => s.id === activeSection) || DOCS_SECTIONS[0];

    return (
        <div className="flex-1 flex overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            {/* Sidebar Nav */}
            <nav className="w-52 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 overflow-y-auto">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <FileText size={16} className="text-corporate-500" />
                        Documentation
                    </h1>
                </div>
                <div className="p-2 space-y-0.5">
                    {DOCS_SECTIONS.map(section => {
                        const Icon = section.icon;
                        const isActive = section.id === activeSection;
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                                    ? 'bg-corporate-50 dark:bg-corporate-900/20 text-corporate-700 dark:text-corporate-300 border border-corporate-200 dark:border-corporate-800'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Icon size={14} className={isActive ? 'text-corporate-500' : 'text-slate-400 dark:text-slate-500'} />
                                {section.title}
                            </button>
                        );
                    })}
                </div>
                <div className="p-3 mt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setCurrentView('workspace')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-corporate-600 dark:hover:text-corporate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowRight size={14} />
                        Go to Workspace
                    </button>
                </div>
            </nav>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-8 py-8">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mb-6">
                        <button onClick={() => setActiveSection('overview')} className="hover:text-slate-600 dark:hover:text-slate-300">Docs</button>
                        <ChevronRight size={10} />
                        <span className="text-slate-600 dark:text-slate-300">{currentSection.title}</span>
                    </div>

                    {/* Section Content */}
                    {currentSection.content(setActiveSection)}

                    {/* Footer Nav */}
                    <div className="flex items-center justify-between mt-12 pt-6 border-t border-slate-200 dark:border-slate-800">
                        {(() => {
                            const idx = DOCS_SECTIONS.findIndex(s => s.id === activeSection);
                            const prev = idx > 0 ? DOCS_SECTIONS[idx - 1] : null;
                            const next = idx < DOCS_SECTIONS.length - 1 ? DOCS_SECTIONS[idx + 1] : null;
                            return (<>
                                {prev ? (
                                    <button onClick={() => setActiveSection(prev.id)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-corporate-600 dark:hover:text-corporate-400 flex items-center gap-1.5">
                                        <ChevronRight size={12} className="rotate-180" /> {prev.title}
                                    </button>
                                ) : <div />}
                                {next ? (
                                    <button onClick={() => setActiveSection(next.id)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-corporate-600 dark:hover:text-corporate-400 flex items-center gap-1.5">
                                        {next.title} <ChevronRight size={12} />
                                    </button>
                                ) : <div />}
                            </>);
                        })()}
                    </div>
                </div>
            </main>
        </div>
    );
}
