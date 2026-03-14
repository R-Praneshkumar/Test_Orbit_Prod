import React from 'react';
import { ArrowLeft, Check, X, Zap, Shield, Clock, Users, DollarSign, ArrowRight, Sparkles, Server, FlaskConical, Code, Terminal, Upload } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

// ──────────────────────────────────────────────
// Shared components
// ──────────────────────────────────────────────

function PageShell({ children }) {
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);
    return (
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
            <div className="max-w-4xl mx-auto px-6 py-10">
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 mb-6 transition-colors"
                >
                    <ArrowLeft size={14} /> Back to Dashboard
                </button>
                {children}
            </div>
        </div>
    );
}

function CTASection() {
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);
    const user = useWorkspaceStore(s => s.user);
    return (
        <div className="mt-12 text-center bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-10">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to switch?</h2>
            <p className="text-purple-200 mb-6 max-w-md mx-auto text-sm">
                Import your Postman collections in seconds. No credit card required. Free forever for small teams.
            </p>
            <div className="flex items-center justify-center gap-3">
                <button
                    onClick={() => setCurrentView(user ? 'dashboard' : 'login')}
                    className="px-6 py-2.5 bg-white text-purple-700 font-bold rounded-lg text-sm hover:bg-purple-50 transition-colors"
                >
                    {user ? 'Go to Dashboard' : 'Get Started Free'}
                </button>
                <button
                    onClick={() => setCurrentView('pricing')}
                    className="px-6 py-2.5 border border-purple-300 text-white font-semibold rounded-lg text-sm hover:bg-purple-500/20 transition-colors"
                >
                    View Pricing
                </button>
            </div>
        </div>
    );
}

function ComparisonRow({ feature, testorbit, postman, highlight }) {
    return (
        <tr className={highlight ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}>
            <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">{feature}</td>
            <td className="px-4 py-3 text-xs text-center border-b border-slate-100 dark:border-slate-800">
                {testorbit === true ? <Check size={14} className="text-emerald-500 mx-auto" /> :
                 testorbit === false ? <X size={14} className="text-slate-300 dark:text-slate-600 mx-auto" /> :
                 <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{testorbit}</span>}
            </td>
            <td className="px-4 py-3 text-xs text-center border-b border-slate-100 dark:border-slate-800">
                {postman === true ? <Check size={14} className="text-emerald-500 mx-auto" /> :
                 postman === false ? <X size={14} className="text-slate-300 dark:text-slate-600 mx-auto" /> :
                 <span className="text-slate-500 dark:text-slate-400">{postman}</span>}
            </td>
        </tr>
    );
}


// ──────────────────────────────────────────────
// Page 1: Postman Alternative
// ──────────────────────────────────────────────

const ALTERNATIVE_FEATURES = [
    { icon: Zap, title: 'Unlimited AI', desc: 'No credit limits on paid plans. Gemini Flash AI costs us ~$0.001/call — we pass the savings to you.' },
    { icon: Users, title: 'Free for teams of 3', desc: 'Postman locked free teams to 1 user. TestOrbit keeps teams of up to 3 free forever.' },
    { icon: DollarSign, title: '2x cheaper', desc: 'Pro at ₹399/mo ($5). Team at ₹799/mo + ₹399/seat. A 5-person team pays $600/yr vs Postman\'s $1,140/yr.' },
    { icon: Clock, title: 'Loads in 2 seconds', desc: 'Web-first, zero install. No Electron bloat. Opens instantly in any browser.' },
    { icon: Shield, title: 'AI security scanning', desc: 'OWASP Top 10 vulnerability detection, auth bypass testing, injection fuzzing. Postman only does static rules.' },
    { icon: FlaskConical, title: 'AI test generation', desc: 'Generate boundary, negative, and contract tests from a single request. 50 free per day.' },
];

export function PostmanAlternativePage() {
    return (
        <PageShell>
            {/* Hero */}
            <div className="mb-10">
                <div className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-full mb-4">
                    Postman Alternative
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3 leading-tight">
                    The fast, affordable, AI-powered<br />Postman alternative
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
                    Postman v12 gutted the free plan (1 user, 50 AI credits/month) and charges $19/user/month for teams.
                    TestOrbit gives you unlimited AI on paid plans, free teams of 3, and loads in 2 seconds — at a fraction of the cost.
                </p>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {ALTERNATIVE_FEATURES.map(f => {
                    const FeatureIcon = f.icon;
                    return (
                        <div key={f.title} className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                    <FeatureIcon size={16} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{f.title}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick comparison */}
            <div className="mb-10">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Quick comparison</h2>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900">
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/2">Feature</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">TestOrbit</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Postman</th>
                            </tr>
                        </thead>
                        <tbody>
                            <ComparisonRow feature="Free plan team size" testorbit="3 users" postman="1 user" highlight />
                            <ComparisonRow feature="AI calls (free)" testorbit="50/day" postman="50/month" highlight />
                            <ComparisonRow feature="AI calls (paid)" testorbit="Unlimited" postman="Metered credits" highlight />
                            <ComparisonRow feature="Price (solo)" testorbit="₹399/mo ($5)" postman="$19/mo" />
                            <ComparisonRow feature="Price (5-person team/yr)" testorbit="$600/yr" postman="$1,140/yr" highlight />
                            <ComparisonRow feature="Install required" testorbit="No (web app)" postman="Electron app" />
                            <ComparisonRow feature="AI test generation" testorbit={true} postman={true} />
                            <ComparisonRow feature="AI security scanning" testorbit={true} postman={false} highlight />
                            <ComparisonRow feature="AI code generation" testorbit={true} postman={true} />
                            <ComparisonRow feature="WebSocket testing" testorbit={true} postman={true} />
                            <ComparisonRow feature="Mock server" testorbit={true} postman={true} />
                            <ComparisonRow feature="Collection import" testorbit="Postman + Insomnia" postman="Native" />
                            <ComparisonRow feature="Collection runner" testorbit={true} postman={true} />
                        </tbody>
                    </table>
                </div>
            </div>

            <CTASection />
        </PageShell>
    );
}


// ──────────────────────────────────────────────
// Page 2: TestOrbit vs Postman
// ──────────────────────────────────────────────

const VS_SECTIONS = [
    {
        title: 'Pricing',
        icon: DollarSign,
        testorbit: [
            'Free for teams of up to 3 — forever',
            'Pro: ₹399/mo ($5/mo) — unlimited AI',
            'Team: ₹799/mo + ₹399/seat — role-based access',
            'No hidden credit charges',
        ],
        postman: [
            'Free: 1 user only, 50 AI credits/month',
            'Basic: $14/user/month',
            'Professional: $29/user/month',
            'AI credits metered at $0.035-0.05 each',
        ],
    },
    {
        title: 'AI Capabilities',
        icon: Sparkles,
        testorbit: [
            '50 AI calls/day free (30x more than Postman)',
            'Unlimited AI on paid plans (no credits)',
            'AI security scanning (OWASP Top 10)',
            'AI test generation + code generation',
            'AI diagnostics + voice input',
        ],
        postman: [
            '50 AI credits/month free',
            'Metered credits on paid plans',
            'No AI security testing',
            'AI test generation (5 types)',
            'Agent mode with 70+ tools',
        ],
    },
    {
        title: 'Performance & UX',
        icon: Zap,
        testorbit: [
            'Web-first — opens in any browser instantly',
            'Loads in under 2 seconds',
            'Minimal UI — no learning curve',
            'Keyboard shortcuts + command palette',
        ],
        postman: [
            'Electron desktop app required for full features',
            'Heavy resource usage (~500MB RAM)',
            'Complex UI with 70+ tool panels',
            'Steep learning curve for new features',
        ],
    },
    {
        title: 'Testing & Security',
        icon: Shield,
        testorbit: [
            'AI-powered vulnerability detection',
            'Auth bypass testing',
            'Injection fuzzing (SQL, XSS, SSRF)',
            'Contract testing + assertion builder',
            'Collection runner with parallel execution',
        ],
        postman: [
            'Static OWASP security rules only',
            'No AI security testing',
            'Contract testing available',
            'Collection runner',
            'Postman Monitors for scheduling',
        ],
    },
];

export function PostmanVsTestOrbitPage() {
    return (
        <PageShell>
            {/* Hero */}
            <div className="mb-10">
                <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded-full mb-4">
                    Honest Comparison
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3 leading-tight">
                    TestOrbit vs Postman:<br />An honest comparison
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
                    Postman is the industry standard with 40M+ developers and deep integrations.
                    TestOrbit is the lightweight alternative for teams who want fast, affordable, AI-powered API testing without the bloat.
                    Here's an honest side-by-side.
                </p>
            </div>

            {/* Where Postman wins */}
            <div className="mb-8 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Where Postman wins</h2>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                    <li className="flex items-start gap-2"><Check size={12} className="text-orange-500 mt-0.5 shrink-0" /> Agent mode with 70+ tools — deeper AI integration breadth</li>
                    <li className="flex items-start gap-2"><Check size={12} className="text-orange-500 mt-0.5 shrink-0" /> Multi-protocol: GraphQL, gRPC, MCP, MQTT built-in</li>
                    <li className="flex items-start gap-2"><Check size={12} className="text-orange-500 mt-0.5 shrink-0" /> Enterprise features: SSO, audit logs, API governance</li>
                    <li className="flex items-start gap-2"><Check size={12} className="text-orange-500 mt-0.5 shrink-0" /> Massive ecosystem: integrations, community, docs</li>
                    <li className="flex items-start gap-2"><Check size={12} className="text-orange-500 mt-0.5 shrink-0" /> Postman Monitors for scheduled test runs</li>
                </ul>
            </div>

            {/* Comparison sections */}
            <div className="space-y-6 mb-10">
                {VS_SECTIONS.map(section => {
                    const SectionIcon = section.icon;
                    return (
                        <div key={section.title} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                                <SectionIcon size={14} className="text-purple-600 dark:text-purple-400" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{section.title}</h3>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
                                <div className="p-5">
                                    <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3">TestOrbit</div>
                                    <ul className="space-y-2">
                                        {section.testorbit.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                                                <Check size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="p-5">
                                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Postman</div>
                                    <ul className="space-y-2">
                                        {section.postman.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <Check size={11} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom line */}
            <div className="mb-8 p-5 border-2 border-purple-200 dark:border-purple-800 rounded-xl bg-purple-50/50 dark:bg-purple-900/10">
                <h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-2">The bottom line</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Choose <strong>Postman</strong> if you need enterprise governance, multi-protocol support, or deep CI/CD integrations.
                    Choose <strong>TestOrbit</strong> if you want fast, affordable API testing with unlimited AI, no install, and a team-friendly free tier.
                    For indie devs, startups, and small teams — TestOrbit delivers 90% of the value at 20% of the cost.
                </p>
            </div>

            <CTASection />
        </PageShell>
    );
}


// ──────────────────────────────────────────────
// Page 3: Migrate from Postman
// ──────────────────────────────────────────────

const MIGRATION_STEPS = [
    {
        step: 1,
        icon: Terminal,
        title: 'Export from Postman',
        desc: 'Open Postman, right-click your collection, select "Export" and choose Collection v2.1 format. Save the JSON file.',
    },
    {
        step: 2,
        icon: Upload,
        title: 'Import into TestOrbit',
        desc: 'Open TestOrbit, click "Import" in the sidebar, select "Postman Collection" and drop your exported JSON file. All requests, folders, and scripts are preserved.',
    },
    {
        step: 3,
        icon: Code,
        title: 'Set up environments',
        desc: 'Your environment variables transfer automatically. Review them in the Environment Manager and update any secrets or API keys.',
    },
    {
        step: 4,
        icon: FlaskConical,
        title: 'Run your tests',
        desc: 'Use the Collection Runner to execute all requests. TestOrbit preserves your pre-request scripts, test scripts, and assertions.',
    },
    {
        step: 5,
        icon: Sparkles,
        title: 'Unlock AI features',
        desc: 'Generate AI tests, run security scans, and use the AI chat to diagnose failures — all features Postman charges extra credits for.',
    },
];

const MIGRATION_COMPATIBILITY = [
    { feature: 'Collections & folders', status: 'full' },
    { feature: 'Request methods (GET, POST, PUT, DELETE, PATCH)', status: 'full' },
    { feature: 'Headers & query parameters', status: 'full' },
    { feature: 'Request body (JSON, form-data, raw, binary)', status: 'full' },
    { feature: 'Pre-request scripts', status: 'full' },
    { feature: 'Test scripts (assertions)', status: 'full' },
    { feature: 'Environment variables', status: 'full' },
    { feature: 'Collection auth (Bearer, Basic, API Key)', status: 'full' },
    { feature: 'Insomnia collections', status: 'full' },
    { feature: 'GraphQL queries', status: 'planned' },
    { feature: 'gRPC / MQTT', status: 'planned' },
    { feature: 'Postman Monitors', status: 'na' },
    { feature: 'Postman Flows', status: 'na' },
];

export function MigrateFromPostmanPage() {
    return (
        <PageShell>
            {/* Hero */}
            <div className="mb-10">
                <div className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full mb-4">
                    Migration Guide
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3 leading-tight">
                    Migrate from Postman<br />in under 5 minutes
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
                    TestOrbit imports Postman Collection v2.1 files natively — including nested folders, scripts, environments, and auth.
                    No data loss, no manual re-creation. Your team can be up and running in minutes.
                </p>
            </div>

            {/* Steps */}
            <div className="mb-10">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5">Step-by-step migration</h2>
                <div className="space-y-4">
                    {MIGRATION_STEPS.map(s => {
                        const StepIcon = s.icon;
                        return (
                            <div key={s.step} className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                    <StepIcon size={18} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="pt-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">STEP {s.step}</span>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.title}</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Compatibility table */}
            <div className="mb-10">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Compatibility matrix</h2>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900">
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Feature</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MIGRATION_COMPATIBILITY.map(row => (
                                <tr key={row.feature}>
                                    <td className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">{row.feature}</td>
                                    <td className="px-4 py-2.5 text-center border-b border-slate-100 dark:border-slate-800">
                                        {row.status === 'full' && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                <Check size={11} /> Supported
                                            </span>
                                        )}
                                        {row.status === 'planned' && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                <Clock size={11} /> Planned
                                            </span>
                                        )}
                                        {row.status === 'na' && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                <X size={11} /> N/A
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Why switch section */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
                    <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mb-1">50/day</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Free AI calls<br />(vs Postman's 50/month)</div>
                </div>
                <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
                    <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-1">3 users</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Free team plan<br />(vs Postman's 1 user)</div>
                </div>
                <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
                    <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mb-1">2 sec</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Load time<br />(no Electron app)</div>
                </div>
            </div>

            <CTASection />
        </PageShell>
    );
}
