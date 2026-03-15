import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Sparkles, Zap, Users, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { API_BASE, authFetch } from '../../config';
import { toast } from '../../utils/toast';

const FEATURES = [
    { name: 'Collections & Requests', free: 'Unlimited', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'Environments', free: 'Unlimited', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'Team Members', free: 'Up to 3', pro: 'Up to 5', team: 'Unlimited' },
    { name: 'AI Chat / Diagnose / Suggest', free: '50/day', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'AI Test Generation', free: '10/day', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'AI Code Generation', free: '10/day', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'AI Security Scanning', free: '3/day', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'Collection Sharing', free: '2 collaborators', pro: 'Unlimited', team: 'Unlimited' },
    { name: 'WebSocket Tester', free: true, pro: true, team: true },
    { name: 'Body Types (JSON, Form, File)', free: true, pro: true, team: true },
    { name: 'Import from Postman', free: true, pro: true, team: true },
    { name: 'Test Runner', free: true, pro: true, team: true },
    { name: 'Mock Server', free: true, pro: true, team: true },
    { name: 'Export (JUnit XML, HTML)', free: true, pro: true, team: true },
    { name: 'Team Workspaces', free: true, pro: true, team: true },
];

function FeatureCell({ value }) {
    if (value === true) return <Check size={14} className="text-emerald-500 mx-auto" />;
    if (value === false) return <X size={14} className="text-slate-300 dark:text-slate-600 mx-auto" />;
    return <span className="text-xs">{value}</span>;
}

export default function PricingPage() {
    const [annual, setAnnual] = useState(false);
    const [loading, setLoading] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);
    const subscription = useWorkspaceStore(s => s.subscription);
    const user = useWorkspaceStore(s => s.user);

    // Load Razorpay checkout script on demand (only on this page)
    useEffect(() => {
        if (!document.querySelector('script[src*="checkout.razorpay"]')) {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onerror = () => console.warn('Razorpay checkout script failed to load');
            document.body.appendChild(script);
        }
    }, []);

    // Fetch subscription status on mount (for logged-in users)
    const fetchSubStatus = useCallback(async () => {
        if (!user) return;
        try {
            const res = await authFetch(`${API_BASE}/razorpay/subscription-status`);
            if (res.ok) {
                const data = await res.json();
                if (data.plan && data.plan !== 'free') {
                    useWorkspaceStore.getState().setSubscription({
                        plan: data.plan,
                        status: data.status,
                        billing: data.billing || null,
                        subscription_id: data.subscription_id || null,
                    });
                }
            }
        } catch {
            // Silently fail — subscription status is optional
        }
    }, [user]);

    useEffect(() => { fetchSubStatus(); }, [fetchSubStatus]);

    const handleCancel = async () => {
        if (!subscription?.subscription_id) {
            toast.error('No subscription ID found. Try upgrading again from the free plan.');
            useWorkspaceStore.getState().setSubscription({ plan: 'free', status: 'inactive', billing: null, subscription_id: null });
            return;
        }
        setCancelling(true);
        try {
            const res = await authFetch(`${API_BASE}/razorpay/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription_id: subscription.subscription_id }),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.detail || 'Failed to cancel subscription');
                return;
            }
            toast.success('Subscription cancelled successfully');
            useWorkspaceStore.getState().setSubscription({ plan: 'free', status: 'cancelled' });
        } catch {
            toast.error('Failed to cancel subscription');
        } finally {
            setCancelling(false);
        }
    };

    const proPrice = annual ? 3999 : 399;
    const proPeriod = annual ? '/yr' : '/mo';
    const proSavings = annual ? '(save 17%)' : '';

    const handleUpgrade = async (plan) => {
        setLoading(plan);
        try {
            const planKey = annual ? 'pro_annual' : 'pro_monthly';
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
                const subId = data.subscription_id;
                const options = {
                    key: data.razorpay_key_id,
                    subscription_id: subId,
                    name: 'TestOrbit',
                    description: data.plan_details?.name || 'Pro Plan',
                    handler: (response) => {
                        // Official Razorpay verification: send payment_id + subscription_id + signature to backend
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 15000);
                        const fallbackSub = {
                            plan: 'pro', status: 'active',
                            billing: annual ? 'annual' : 'monthly',
                            subscription_id: response.razorpay_subscription_id || subId,
                        };
                        authFetch(`${API_BASE}/razorpay/verify-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_subscription_id: response.razorpay_subscription_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                            signal: controller.signal,
                        }).then(r => {
                            clearTimeout(timeoutId);
                            return r.ok ? r.json() : null;
                        }).then(verified => {
                            if (verified) {
                                toast.success('Subscription activated! Welcome to Pro.');
                                useWorkspaceStore.getState().setSubscription({
                                    plan: verified.plan, status: verified.status,
                                    billing: verified.billing, subscription_id: verified.subscription_id,
                                });
                            } else {
                                toast.success('Payment received! Activating...');
                                useWorkspaceStore.getState().setSubscription(fallbackSub);
                            }
                        }).catch(() => {
                            clearTimeout(timeoutId);
                            toast.success('Payment received! Pro activating shortly...');
                            useWorkspaceStore.getState().setSubscription(fallbackSub);
                        });
                    },
                    theme: { color: '#7c3aed' },
                };
                const rzp = new window.Razorpay(options);
                rzp.open();
            } else if (data.short_url) {
                // Fallback: redirect to Razorpay hosted page — validate domain first
                try {
                    const parsed = new URL(data.short_url);
                    const allowed = ['rzp.io', 'razorpay.com', 'pages.razorpay.com'];
                    const isRazorpay = allowed.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
                    if (parsed.protocol === 'https:' && isRazorpay) {
                        window.open(data.short_url, '_blank');
                        toast.info('Razorpay checkout opened in new tab');
                    } else {
                        toast.error('Invalid payment redirect URL');
                    }
                } catch {
                    toast.error('Invalid payment URL');
                }
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
    // If billing is unknown (null), default to 'monthly' — the more common case
    const billingCycle = subscription?.billing || (currentPlan === 'pro' ? 'monthly' : null);
    const isProMonthly = currentPlan === 'pro' && billingCycle === 'monthly';
    const isProAnnual = currentPlan === 'pro' && billingCycle === 'annual';
    const canSwitchToAnnual = isProMonthly && annual;

    const handleSwitchToAnnual = async () => {
        setLoading('pro');
        try {
            if (subscription?.subscription_id) {
                // Cancel current monthly subscription first
                await authFetch(`${API_BASE}/razorpay/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription_id: subscription.subscription_id }),
                });
            } else {
                toast.info('Creating new annual plan. If you have an existing monthly charge, cancel it from your payment provider.');
            }
            // Create annual subscription (toggle is already set to annual)
            await handleUpgrade('pro');
        } catch {
            toast.error('Failed to switch plan');
            setLoading(null);
        }
    };

    const getProButtonText = () => {
        if (loading === 'pro') return 'Processing...';
        if (currentPlan !== 'pro') return 'Upgrade to Pro';
        if (canSwitchToAnnual) return 'Switch to Annual (save 17%)';
        if (isProAnnual && annual) return 'Current Plan';
        if (isProAnnual && !annual) return 'Current Plan (Annual)';
        return 'Current Plan';
    };

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
                    <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 px-3 py-1.5 rounded-full">
                        <Sparkles size={11} />
                        <span>Switching from Postman? Our free tier gives <strong>30x more AI</strong> than Postman&apos;s free plan.</span>
                    </div>

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
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> Up to 3 team members</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> 50 AI calls/day</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> 10 test generations/day</li>
                            <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Check size={12} className="text-emerald-500 shrink-0" /> Import from Postman</li>
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
                            disabled={(currentPlan === 'pro' && !canSwitchToAnnual) || loading === 'pro'}
                            onClick={canSwitchToAnnual ? handleSwitchToAnnual : () => handleUpgrade('pro')}
                            className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${canSwitchToAnnual
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
                            }`}
                        >
                            {getProButtonText()}
                        </button>
                        {currentPlan === 'pro' && subscription?.subscription_id && (
                            <button
                                onClick={handleCancel}
                                disabled={cancelling}
                                className="w-full mt-2 py-1.5 rounded-lg text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50"
                            >
                                {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                            </button>
                        )}
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
                            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">₹799</span>
                            <span className="text-xs text-slate-400 ml-1">/mo + ₹399/seat</span>
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
