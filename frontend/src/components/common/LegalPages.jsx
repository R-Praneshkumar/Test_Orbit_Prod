import React from 'react';
import { ArrowLeft, Scale, ShieldCheck } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

const EFFECTIVE_DATE = 'March 2, 2026';
const CONTACT_EMAIL = 'legal@testorbit.dev';

function LegalShell({ icon, title, children }) {
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);
    const IconComponent = icon;

    return (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
            <div className="max-w-3xl mx-auto px-6 py-10">
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 transition-colors"
                >
                    <ArrowLeft size={14} /> Back to Dashboard
                </button>

                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-xl flex items-center justify-center">
                        <IconComponent size={20} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Effective: {EFFECTIVE_DATE}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 prose-container">
                    {children}
                </div>

                <LegalFooter />
            </div>
        </div>
    );
}

function LegalFooter() {
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);

    return (
        <div className="flex items-center justify-center gap-4 mt-8 text-[11px] text-slate-400 dark:text-slate-500">
            <button onClick={() => setCurrentView('terms')} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Terms of Service
            </button>
            <span>&middot;</span>
            <button onClick={() => setCurrentView('privacy')} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Privacy Policy
            </button>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="mb-6 last:mb-0">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">{title}</h2>
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-2">
                {children}
            </div>
        </div>
    );
}

export function TermsOfService() {
    return (
        <LegalShell icon={Scale} title="Terms of Service">
            <Section title="1. Acceptance of Terms">
                <p>
                    By accessing or using TestOrbit (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;).
                    If you do not agree, do not use the Service. These Terms apply to all users, including guests and
                    registered users.
                </p>
            </Section>

            <Section title="2. Description of Service">
                <p>
                    TestOrbit is an AI-powered API testing platform that provides tools for building, testing, and debugging HTTP APIs.
                    Features include request building, test generation, code generation, mock servers, WebSocket testing, and AI-assisted
                    diagnostics. AI features are powered by third-party AI services.
                </p>
            </Section>

            <Section title="3. Accounts and Registration">
                <p>
                    You may use TestOrbit as a guest or create an account via email, Google, or GitHub SSO.
                    You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.
                    You must notify us immediately of any unauthorized use.
                </p>
            </Section>

            <Section title="4. Free Service">
                <p>
                    TestOrbit is free to use. All features &mdash; including AI-powered test generation, code generation,
                    security scanning, and AI chat &mdash; are available without paid feature tiers. Deployment rate limits and external provider charges may apply.
                    There are no paid plans, subscriptions, or credits.
                </p>
            </Section>

            <Section title="5. Acceptable Use">
                <p>You agree not to:</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                    <li>Use the Service to attack, scan, or probe third-party systems without authorization</li>
                    <li>Attempt to bypass rate limits, usage quotas, or security controls</li>
                    <li>Upload or transmit malicious content, malware, or illegal data</li>
                    <li>Misrepresent affiliation with the hosted service. Source-code reuse is governed by the MIT license.</li>
                    <li>Use AI features to generate harmful, abusive, or illegal content</li>
                    <li>Interfere with the Service&apos;s infrastructure, availability, or other users&apos; experience</li>
                </ul>
            </Section>

            <Section title="6. Intellectual Property">
                <p>
                    <strong>Your data:</strong> You retain full ownership of the API requests, collections, test configurations, and
                    other content you create in TestOrbit. We do not claim any intellectual property rights over your content.
                </p>
                <p>
                    <strong>Generated content:</strong> Code, tests, and suggestions generated by AI features are provided for your use.
                    We do not guarantee the accuracy, security, or fitness for purpose of AI-generated output. You are responsible for
                    reviewing and testing any generated code before using it in production.
                </p>
                <p>
                    <strong>Our property:</strong> TestOrbit&apos;s software, brand, design, and documentation remain our intellectual property.
                </p>
            </Section>

            <Section title="7. Data Storage and Security">
                <p>
                    Collections and workspace data are stored locally in your browser (localStorage). If you have an account, data may
                    be synced to our cloud infrastructure (Supabase). We implement security measures including JWT authentication,
                    SSRF protection, input validation, and rate limiting. However, no system is 100% secure.
                </p>
                <p>
                    <strong>API keys and secrets:</strong> Any API keys, tokens, or credentials you enter into request headers or
                    environment variables are stored locally. We recommend using environment variables for sensitive values and never
                    sharing collections containing production secrets.
                </p>
            </Section>

            <Section title="8. Third-Party Services">
                <p>
                    TestOrbit integrates with third-party services including third-party AI services (AI) and Supabase (authentication and storage).
                    Your use of these services is subject to their respective terms. We are not responsible for
                    the availability or behavior of third-party services.
                </p>
            </Section>

            <Section title="9. Disclaimer of Warranties">
                <p>
                    The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied. We do not
                    warrant that the Service will be uninterrupted, error-free, or secure. AI-generated content may contain errors,
                    inaccuracies, or security vulnerabilities.
                </p>
            </Section>

            <Section title="10. Limitation of Liability">
                <p>
                    To the maximum extent permitted by law, TestOrbit and its operators shall not be liable for any indirect, incidental,
                    special, or consequential damages arising from your use of the Service. Our total liability shall not exceed the
                    amount you paid for the Service in the 12 months preceding the claim.
                </p>
            </Section>

            <Section title="11. Termination">
                <p>
                    We may suspend or terminate your account if you violate these Terms or engage in behavior that harms the Service or
                    its users. You may delete your account at any time from your profile settings. Upon termination, your cloud-synced
                    data will be deleted. Locally stored data remains on your device.
                </p>
            </Section>

            <Section title="12. Changes to Terms">
                <p>
                    We may update these Terms from time to time. Material changes will be communicated via email or an in-app notification.
                    Continued use of the Service after changes constitutes acceptance of the updated Terms.
                </p>
            </Section>

            <Section title="13. Governing Law">
                <p>
                    These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the
                    courts in Bangalore, Karnataka, India.
                </p>
            </Section>

            <Section title="14. Contact">
                <p>
                    For questions about these Terms, contact us at{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                        {CONTACT_EMAIL}
                    </a>.
                </p>
            </Section>
        </LegalShell>
    );
}

export function PrivacyPolicy() {
    return (
        <LegalShell icon={ShieldCheck} title="Privacy Policy">
            <Section title="1. Introduction">
                <p>
                    This Privacy Policy explains how TestOrbit (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, and protects your
                    information when you use our API testing platform. We are committed to protecting your privacy and handling
                    your data transparently.
                </p>
            </Section>

            <Section title="2. Information We Collect">
                <p><strong>Account information:</strong> When you sign up, we collect your email address, display name, and
                    authentication provider (Google, GitHub, or email). This is managed by Supabase Auth.</p>
                <p><strong>Usage data:</strong> We track daily usage counts for AI features (chat calls, test generations,
                    code generations) to display usage statistics. These counters are stored in
                    memory and reset daily at midnight UTC.</p>
                <p><strong>Workspace data:</strong> Your API collections, requests, environments, test suites, and mock server
                    configurations are stored locally in your browser. If logged in, this data may be synced to Supabase for
                    cross-device access.</p>
                <p><strong>AI interaction data:</strong> When you use AI features, request context (method, URL, headers, body
                    snippets) is sent to third-party AI services for processing. We do not persistently store the content of AI
                    conversations on our servers.</p>
            </Section>

            <Section title="3. How We Use Your Information">
                <ul className="list-disc pl-5 space-y-1">
                    <li>Provide and operate the Service (authentication, data sync, AI features)</li>
                    <li>Send transactional emails (account verification, password reset)</li>
                    <li>Monitor and improve Service performance and reliability</li>
                    <li>Detect and prevent abuse, fraud, or Terms violations</li>
                </ul>
            </Section>

            <Section title="4. Data Sharing">
                <p>We do not sell your personal data. We share data only with:</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                    <li><strong>AI Provider:</strong> Request context is sent for AI processing. Subject to Google&apos;s AI terms.</li>
                    <li><strong>Supabase:</strong> Authentication and data storage. Subject to Supabase&apos;s privacy policy.</li>
                    <li><strong>Law enforcement:</strong> When required by law, court order, or to protect our legal rights.</li>
                </ul>
            </Section>

            <Section title="5. Data Storage and Security">
                <p>
                    <strong>Local storage:</strong> Primary data storage is in your browser&apos;s localStorage. This data never
                    leaves your device unless you are logged in and syncing is enabled.
                </p>
                <p>
                    <strong>Cloud storage:</strong> For authenticated users, data is stored in Supabase (hosted infrastructure)
                    with Row-Level Security (RLS) policies ensuring you can only access your own data.
                </p>
                <p>
                    <strong>Security measures:</strong> We implement JWT authentication, SSRF protection, input validation,
                    rate limiting, security headers (CSP, HSTS), and secret masking in logs.
                </p>
                <p>
                    <strong>Encryption:</strong> All data in transit is encrypted via HTTPS/TLS. Data at rest in Supabase is
                    encrypted by the hosting provider.
                </p>
            </Section>

            <Section title="6. Cookies and Local Storage">
                <p>
                    TestOrbit uses browser localStorage to persist your workspace data, preferences (dark mode, panel sizes),
                    and authentication tokens. We do not use third-party tracking cookies or advertising pixels.
                    Supabase Auth uses secure httpOnly cookies for session management.
                </p>
            </Section>

            <Section title="7. Your Rights">
                <p>You have the right to:</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                    <li><strong>Access:</strong> View all data associated with your account</li>
                    <li><strong>Export:</strong> Export your collections in standard formats (Postman, OpenAPI)</li>
                    <li><strong>Delete:</strong> Delete your account and all associated cloud data from the profile page</li>
                    <li><strong>Correct:</strong> Update your profile information at any time</li>
                    <li><strong>Restrict:</strong> Use the Service as a guest without creating an account</li>
                </ul>
                <p className="mt-2">
                    To exercise any of these rights, use the in-app settings or contact{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                        {CONTACT_EMAIL}
                    </a>.
                </p>
            </Section>

            <Section title="8. Data Retention">
                <p>
                    <strong>Account data:</strong> Retained as long as your account is active. Deleted within 30 days of
                    account deletion.
                </p>
                <p>
                    <strong>Usage logs:</strong> Daily usage counters are stored in memory and reset every 24 hours.
                    Persistent usage logs (when enabled) are retained for 90 days.
                </p>
            </Section>

            <Section title="9. Children's Privacy">
                <p>
                    TestOrbit is not intended for use by individuals under the age of 16. We do not knowingly collect
                    personal information from children. If you believe a child has provided us with personal data,
                    please contact us and we will delete it promptly.
                </p>
            </Section>

            <Section title="10. International Users">
                <p>
                    TestOrbit is operated from India. If you access the Service from outside India, your data may be
                    transferred to and processed in India. By using the Service, you consent to this transfer.
                </p>
            </Section>

            <Section title="11. Changes to This Policy">
                <p>
                    We may update this Privacy Policy from time to time. We will notify registered users of material
                    changes via email. The &quot;Effective&quot; date at the top reflects the latest revision.
                </p>
            </Section>

            <Section title="12. Contact Us">
                <p>
                    For privacy-related inquiries, data requests, or concerns, contact us at{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                        {CONTACT_EMAIL}
                    </a>.
                </p>
            </Section>
        </LegalShell>
    );
}
