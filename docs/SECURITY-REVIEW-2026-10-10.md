# Open-source security review — 2026-10-10

## Result and scope

No real embedded credential was found in the reviewed repository history,
publication snapshot, or frontend build. This is a source and dependency review,
not a guarantee of zero vulnerabilities or a certification of the hosted service.
No hosted database schema or deployment secrets were changed in this review.

## Credential checks

- Refreshed the origin branches and tags, then scanned 86 existing commits with
  Gitleaks 8.30.1. Its release archive was checked against the published SHA-256.
- Triaged all three historical findings: two log-masking test fixtures and one
  documentation example. Added only their exact historical fingerprints to
  `.gitleaksignore`; future occurrences and other contents are still scanned.
- Removed complete token-shaped examples from current tests/documentation.
- Scanned the staged publication snapshot and generated frontend assets separately.
- Inspected historical file paths: only `backend/.env.example` and
  `frontend/.env.example` appear as environment files. The local `backend/.env`
  is untracked and ignored. Local configuration contains placeholders, so it
  cannot be used to prove that deployed credentials have never been exposed.
- Expanded Git and Docker exclusions for environment variants, private keys,
  and local runtime data. Actual environment files were not modified.

## Changes

- Removed the pricing UI, checkout routes, Razorpay dependency/configuration,
  subscription state, paid usage tiers, and paid sharing-limit triggers.
- Rewrote the README and page metadata; marked historical marketing drafts as retired.
- Authenticated mock generation and isolated mock storage and deletion by user.
- Pinned outbound test connections to validated DNS results, disabled redirects,
  blocked non-public/mapped addresses, and bounded upstream response reads.
- Required authentication outside development and strengthened JWT validation.
- Removed the hard-coded OAuth state-signing fallback.
- Fixed masking for child loggers, formatted arguments, exception text, and extra fields.
- Restricted profile reads to their owner. Moved privileged SQL helpers to a
  private schema and guarded collection/environment ownership and team membership.
- Updated vulnerable dependencies and added security minimums for backend packages.
- Enabled GitHub secret scanning, push protection, Dependabot alerts/security fixes,
  and private vulnerability reporting. Added secret-scan and database-policy CI jobs.

## Validation

- Publication snapshot: 417 frontend tests and 94 backend tests passed.
- Frontend lint and production builds passed. A large-chunk size warning remains.
- 18 database assertions passed on both a fresh schema and an upgrade from the
  previous schema, including a second idempotent application.
- `npm audit`: 20 initial affected packages, zero known vulnerabilities after updates.
- `pip-audit`: 46 initial advisories across seven installed packages, zero after
  updates; 60 packages checked. `pip check` found no broken requirements.
- Gitleaks: no untriaged historical findings and no publication/build findings.

## Deployment boundary

The updated SQL must be applied to an existing Supabase project before its policy
fixes protect that database. Its `private` schema must remain unexposed to the Data
API. Source tests do not prove the configuration of an existing hosted project.
Backend fixes likewise require deployment and authenticated runtime verification.

Imported JavaScript must be trusted: a Web Worker is not a complete sandbox.
Collections, exports, environment values, and request history may contain users'
own secrets; UI masking is not encryption. Provider spending controls remain an
operator responsibility. Existing subscription records are preserved intentionally.

Tool references: [Gitleaks](https://github.com/gitleaks/gitleaks),
[Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
