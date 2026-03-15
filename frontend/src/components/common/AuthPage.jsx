import React, { useState } from 'react';
import { Mail, Lock, User, Github, ArrowRight, Zap, Server, Wifi, Shield } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useWorkspaceStore } from '../../store/workspaceStore';

/**
 * Full-page login/signup screen.
 * Split-screen: branding (left) + auth form (right).
 * Replaces the old AuthModal.jsx.
 *
 * Google SSO requires Supabase Dashboard setup:
 *   1. Authentication → Providers → Google → Enable
 *   2. Google Cloud Console → Create OAuth 2.0 Client ID
 *   3. Redirect URI: https://<project-ref>.supabase.co/auth/v1/callback
 */
const AuthPage = () => {
    const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);

    // --- Auth Handlers ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        if (!supabase) {
            setError('Supabase is not configured. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
            setLoading(false);
            return;
        }

        try {
            if (mode === 'reset') {
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}`,
                });
                if (resetError) throw resetError;
                setSuccess('Password reset email sent. Check your inbox.');
                setLoading(false);
                return;
            }
            if (mode === 'signup') {
                const { error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName }
                    }
                });
                if (authError) throw authError;
                setSuccess('Check your email for the confirmation link.');
            } else {
                const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
                if (authError) throw authError;
                setCurrentView('dashboard');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        if (!supabase) {
            setError('Supabase is not configured.');
            return;
        }
        setError(null);
        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (authError) setError(authError.message);
    };

    const handleGithubLogin = async () => {
        if (!supabase) {
            setError('Supabase is not configured.');
            return;
        }
        setError(null);
        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: { redirectTo: window.location.origin }
        });
        if (authError) setError(authError.message);
    };

    const handleGuestContinue = () => {
        setCurrentView('dashboard');
    };

    // --- Features for left panel ---
    const features = [
        { icon: Zap, text: 'AI-powered test generation with Gemini' },
        { icon: Server, text: 'Smart mock server with realistic responses' },
        { icon: Wifi, text: 'WebSocket testing & real-time monitoring' },
        { icon: Shield, text: 'Automated failure diagnosis & fixes' },
    ];

    return (
        <div className="flex-1 flex min-h-0 overflow-auto">
            {/* Left Panel — Branding */}
            <div className="hidden md:flex md:w-[55%] bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute top-20 -left-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-10 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/3 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

                <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 py-12 w-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-11 h-11 bg-gradient-to-br from-sky-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="3" fill="white" />
                                <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
                                <circle cx="20" cy="12" r="2" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">TestOrbit</h1>
                            <p className="text-xs text-slate-300">AI-Native API Testing</p>
                        </div>
                    </div>

                    {/* Tagline */}
                    <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
                        Test APIs smarter,<br />
                        not harder.
                    </h2>
                    <p className="text-slate-300 text-base mb-10 max-w-md leading-relaxed">
                        Powered by Google Gemini AI. Generate tests from natural language,
                        diagnose failures instantly, and ship with confidence.
                    </p>

                    {/* Feature list */}
                    <div className="space-y-4">
                        {features.map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-400/20 flex items-center justify-center shrink-0">
                                    <f.icon size={17} className="text-sky-300" />
                                </div>
                                <span className="text-sm text-slate-300">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel — Auth Form */}
            <div className="flex-1 flex items-center justify-center px-6 py-10 bg-white dark:bg-slate-950">
                <div className="w-full max-w-sm">
                    {/* Mobile logo (hidden on md+) */}
                    <div className="flex items-center gap-2.5 mb-8 md:hidden">
                        <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="3" fill="white" />
                                <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
                                <circle cx="20" cy="12" r="2" fill="white" />
                            </svg>
                        </div>
                        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">TestOrbit</span>
                    </div>

                    {/* Heading */}
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                        {mode === 'reset' ? 'Reset your password' : mode === 'login' ? 'Welcome back' : 'Create your account'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-7">
                        {mode === 'reset'
                            ? 'Enter your email and we\'ll send a reset link.'
                            : mode === 'login'
                            ? 'Sign in to sync your workspaces across devices.'
                            : 'Start testing APIs with the power of AI.'}
                    </p>

                    {/* Error / Success */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-600 dark:text-green-400">
                            {success}
                        </div>
                    )}

                    {/* Social SSO Buttons (hidden during password reset) */}
                    {mode !== 'reset' && <div className="space-y-2.5 mb-5">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={!supabase}
                            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {/* Google icon */}
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Continue with Google
                        </button>

                        <button
                            onClick={handleGithubLogin}
                            disabled={!supabase}
                            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 border border-slate-800 dark:border-slate-600 rounded-lg text-sm font-medium text-white hover:bg-slate-900 dark:hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Github size={18} />
                            Continue with GitHub
                        </button>
                    </div>}

                    {/* Divider */}
                    {mode !== 'reset' && <div className="relative my-5">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-white dark:bg-slate-950 px-3 text-slate-400 dark:text-slate-500">
                                or continue with email
                            </span>
                        </div>
                    </div>}

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 dark:focus:border-sky-500 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 dark:focus:border-sky-500 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        {mode !== 'reset' && (
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Password</label>
                                    {mode === 'login' && (
                                        <button
                                            type="button"
                                            onClick={() => { setMode('reset'); setError(null); setSuccess(null); }}
                                            className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                                        >
                                            Forgot password?
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 dark:focus:border-sky-500 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                        placeholder="Min. 6 characters"
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !supabase}
                            className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-sky-500/20 mt-1"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'reset' ? 'Send Reset Link' : mode === 'login' ? 'Sign In' : 'Create Account'}
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle login/signup */}
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
                        {mode === 'reset' ? (
                            <>
                                Remember your password?{' '}
                                <button
                                    onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                                    className="text-sky-600 dark:text-sky-400 font-medium hover:underline"
                                >
                                    Sign in
                                </button>
                            </>
                        ) : mode === 'login' ? (
                            <>
                                Don&apos;t have an account?{' '}
                                <button
                                    onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                                    className="text-sky-600 dark:text-sky-400 font-medium hover:underline"
                                >
                                    Sign up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button
                                    onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                                    className="text-sky-600 dark:text-sky-400 font-medium hover:underline"
                                >
                                    Sign in
                                </button>
                            </>
                        )}
                    </p>

                    {/* Guest mode */}
                    <button
                        onClick={handleGuestContinue}
                        className="w-full mt-4 py-2 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors"
                    >
                        Skip for now &mdash; continue as guest
                    </button>

                    {/* Legal links */}
                    <div className="flex items-center justify-center gap-3 mt-6 text-[11px] text-slate-400 dark:text-slate-500">
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
};

export default AuthPage;
