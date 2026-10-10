# Security

Keep Gemini keys, JWT signing secrets, service-role keys, and provider credentials
in deployment secret storage or ignored local environment files. The application
does not require a Supabase service-role key. Browser `VITE_*` variables are public.

Only placeholder `.env.example` files belong in Git. `.gitignore` and Docker ignore
rules exclude environment variants, private keys, and local runtime data. Before
publishing changes, run `gitleaks git . --log-opts=--all --redact=100` and dependency
audits. Historical scanner exceptions are restricted to three reviewed example
fingerprints; they do not exempt entire files or future credentials.

Use authentication and HTTPS for shared deployments. Local development with
`REQUIRE_AUTH=False` permits anonymous access and private-network targets; bind
that configuration to localhost. Keep AI-provider spending controls enabled.

Review and apply `supabase_schema.sql` in your own Supabase project. Updating this
repository does not update an existing database. The schema restricts profiles to
their owners, scopes shared data through RLS, and keeps privileged helper functions
in the unexposed `private` schema. Do not expose that schema through the Data API.
Existing retired subscription data is preserved; remove it only under your own
data-retention policy. Existing deployments need the retired restriction triggers
removed by the updated schema before sharing becomes unrestricted.

API testing data can contain secrets: collection headers, environment values,
request history, exports, and shared requests must be reviewed before sharing.
The `isSecret` UI setting masks display; it is not encryption. Only run trusted
imported JavaScript. A Web Worker is not a complete security boundary for hostile
code. AI security suggestions are not a penetration test or security certification.

Report vulnerabilities privately through the repository's GitHub security advisory
page when private reporting is available. Never include real secrets or personal
data in a public issue. If a real secret is exposed, revoke/rotate it at its provider;
deleting a file or changing repository visibility does not revoke copied credentials.

## Database policy regression checks

Install `@electric-sql/pglite@0.5.8` in an isolated tools directory and set
`TESTORBIT_PGLITE_MODULE` to the file URL of its `dist/index.js`, then run:

```bash
node scripts/test-schema.mjs
```

These tests simulate Supabase authentication roles locally. They do not establish
which policies or configuration are currently applied to a hosted database.
