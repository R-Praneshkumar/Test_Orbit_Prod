import React, { useState } from 'react';
import { Check, X, Sparkles, Zap, Users, ArrowLeft } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { API_BASE, authFetch } from '../../config';
import { toast } from '../../utils/toast';

const FEATURES = [
    { name: 'Collections', free: 'Unlimited', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'Requests & Environments', free: 'Unlimited', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'WebSocket Tester', free: true, pro: true, team: true },
    { name: 'Body Types (JSON, Form, File)', free: true, pro: true, team: true },
    { name: 'Test Runner', free: 'Sequential', pro: 'Sequential + Parallel', team: 'Sequential + Parallel' },
    { name: 'AI Chat / Diagnose / Suggest', free: '25/day', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'AI Test Generation', free: '5/day', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'AI Code Generation', free: '5/day', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'Export (JUnit XML, HTML)', free: 'Last run', pro: 'Full history', team: 'Full history' },
    { name: 'Mock Server', free: '5 mocks', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'Collection Sharing', free: false, pro: 'Share links', team: 'Role-based' },
    { name: 'Team Workspaces', free: false, pro: false, team: true },
    { name: 'Priority Support', free: false, pro: true, team: 'SLA included' },
];

function FeatureCell({ value }) {
    if (value === true) return <Check size={14} className="text-emerald-500 mx-auto" />;
    if (value === false) return <X size={14} className="text-slate-300 dark:text-slate-600 mx-auto" />;
    return <span className="text-xs">{value}</span>;
}

export default function PricingPage() {
    const [annual, setAnnual] = useState(false);
    const [loading, setLoading] = useState(null);
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);
    const subscription = useWorkspaceStore(s => s.subscription);

    const proPrice = annual ? 2500 : 250;
    const proPeriod = annual ? '/yr' : '/mo';
    const proSavings = annual ? '(save 17%)' : '';

    const handleUpgrade = async (plan) => {
        setLoading(plan);
        try {
            const planKey = plan === 'pro' ? (annual ? 'pro_annual' : 'pro_monthly') : 'team_monthly';
            const res = await authFetch(`${API_BASE}/razorpay/create-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: planKey }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.detail || 'Failed to create subscription');
                return;
            }

            const data = await res.json();

            // Open Razorpay Checkout
            if (window.Razorpay && data.razorpay_key_id) {
                const options = {
                    key: data.razorpay_key_id,
                    subscription_id: data.subscription_id,
                    name: 'TestOrbit',
                    description: data.plan_details?.name || 'Pro Plan',
                    handler: () => {
                        toast.success('Subscription activated! Welcome to Pro.');
                        useWorkspaceStore.getState().setSubscription({ plan: 'pro', status: 'active' });
                    },
                    theme: { color: '#7c3aed' },
                };
                const rzp = new window.Razorpay(options);
                rzp.open();
            } else if (data.short_url) {
                // Fallback: redirect to Razorpay hosted page
                window.open(data.short_url, '_blank');
                toast.info('Razorpay checkout opened in new tab');
            } else {
                toast.error('Razorpay checkout not available. Check configuration.');
            }
        } catch (e) {
            toast.error(`Upgrade failed: ${e.message}`);
        } finally {
            setLoading(null);
        }
    };

    const currentPlan = subscription?.plan || 'free';

    return (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
            <div className="max-w-5xl mx-auto px-6 py-10">
                {/* Back button */}
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 transition-colors"
                >
                    <ArrowLeft size={14} /> Back to Dashboard
                </button>

                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Choose Your Plan</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                        Unlimited API testing for free. Upgrade for unlimited AI-powered features.
                    </p>

                    {/* Annual toggle */}
                    <div className="flex items-center justify-center gap-3 mt-6">
                        <span className={`text-xs font-medium ${!annual ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>Monthly</span>
                        <button
                            onClick={() => setAnnual(!annual)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${annual ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${annual ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                        <span className={`text-xs font-medium ${annual ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                            Annual <span className="text-emerald-600 dark:text-emerald-400 font-semibold">save 17%</span>
                        </span>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
                    {/* Free */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap size={18} className="text-slate-500" />
                            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Free</h2>
                        </div>
                        <div className="mb-4">
                            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">₹0</span>
                            <span className="text-xs text-slate-400 ml-1">forever</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                            Unlimited API testing. Limited AI features.
                        </p>
                        <button
                            disabled={currentPlan === 'free'}
                            className="w-full py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 cursor-default"
                        >
                            {currentPlan === 'free' ? 'Current Plan' : 'Free'}
                        </button>
                        <ul className="mt-6 space-y-2.5">
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> Unlimited collections & requests</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> 25 AI calls/day</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> 5 test generations/day</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> Sequential test runner</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> 5 mock endpoints</li>
                        </ul>
                    </div>

                    {/* Pro */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-purple-500 dark:border-purple-600 p-6 relative shadow-lg shadow-purple-100 dark:shadow-purple-950/30">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                            MOST POPULAR
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles size={18} className="text-purple-500" />
                            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Pro</h2>
                        </div>
                        <div className="mb-4">
                            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">₹{proPrice}</span>
                            <span className="text-xs text-slate-400 ml-1">{proPeriod}</span>
                            {proSavings && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium ml-2">{proSavings}</span>}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                            Unlimited AI. Parallel testing. Full exports.
                        </p>
                        <button
                            disabled={currentPlan === 'pro' || loading === 'pro'}
                            onClick={() => handleUpgrade('pro')}
                            className="w-full py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
                        >
                            {loading === 'pro' ? 'Processing...' : currentPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
                        </button>
                        <ul className="mt-6 space-y-2.5">
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-purple-500 shrink-0" /> Everything in Free</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Sparkles size={12} className="text-purple-500 shrink-0" /> <strong>Unlimited</strong> AI calls</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Sparkles size={12} className="text-purple-500 shrink-0" /> <strong>Unlimited</strong> test & code gen</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-purple-500 shrink-0" /> Parallel test runner</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-purple-500 shrink-0" /> Unlimited mocks & export</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-purple-500 shrink-0" /> Collection sharing</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-purple-500 shrink-0" /> Priority support</li>
                        </ul>
                    </div>

                    {/* Team */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Users size={18} className="text-blue-500" />
                            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Team</h2>
                        </div>
                        <div className="mb-4">
                            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">₹500</span>
                            <span className="text-xs text-slate-400 ml-1">/mo + ₹250/seat</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                            Shared workspaces, roles, team analytics.
                        </p>
                        <button
                            className="w-full py-2 rounded-lg text-xs font-semibold border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        >
                            Coming Soon
                        </button>
                        <ul className="mt-6 space-y-2.5">
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-blue-500 shrink-0" /> Everything in Pro</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-blue-500 shrink-0" /> Team workspaces</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-blue-500 shrink-0" /> Role-based sharing</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-blue-500 shrink-0" /> Team analytics</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-blue-500 shrink-0" /> SLA support</li>
                        </ul>
                    </div>
                </div>

                {/* Feature Comparison Table */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Feature Comparison</h3>
                    </div>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Feature</th>
                                <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400 w-28">Free</th>
                                <th className="text-center px-4 py-3 font-medium text-purple-600 dark:text-purple-400 w-28">Pro</th>
                                <th className="text-center px-4 py-3 font-medium text-blue-600 dark:text-blue-400 w-28">Team</th>
                            </tr>
                        </thead>
                        <tbody>
                            {FEATURES.map((f, i) => (
                                <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                                    <td className="px-6 py-2.5 text-slate-700 dark:text-slate-300">{f.name}</td>
                                    <td className="text-center px-4 py-2.5 text-slate-600 dark:text-slate-400"><FeatureCell value={f.free} /></td>
                                    <td className="text-center px-4 py-2.5 text-slate-600 dark:text-slate-400"><FeatureCell value={f.pro} /></td>
                                    <td className="text-center px-4 py-2.5 text-slate-600 dark:text-slate-400"><FeatureCell value={f.team} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="text-center mt-8 space-y-2">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        Payments powered by Razorpay. All prices in INR. Cancel anytime.
                    </div>
                    <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                        <button onClick={() => setCurrentView('terms')} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            Terms of Service
                        </button>
                        <span>&middot;</span>
                        <button onClick={() => setCurrentView('privacy')} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            Privacy Policy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
