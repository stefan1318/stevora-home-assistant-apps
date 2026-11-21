# STEVORA Ecosystem — Codex Agent Instructions
Version: 1.0 (proposed) | Scope: STEVORA OS, Home Panel, Home Hub, Universal Integration, Android, iOS, Hey Stevora.

## Mission and authority
Develop STEVORA as a portable, bilingual, secure Home Assistant ecosystem. These are shared project requirements, not evidence that features are implemented. Inspect the actual repository, its existing AGENTS.md, documentation, manifests, and tests before changes. Never claim tests, builds, releases, or device verification passed unless actually executed and evidenced.

## Repository boundaries
- stefan1318/stevora-home-assistant-apps: HA custom integration, Home Panel, Home Hub and related packages.
- stefan1318/Ha_android: Android client; retain upstream Home Assistant agent instructions, Kotlin conventions and existing build system.
- stefan1318/HA_iOS: Apple client; retain upstream Home Assistant agent instructions, Swift conventions and existing build system.
- STEVORA OS and Hey Stevora: determine their actual repository and implementation status before editing. Do not invent paths or assert deployment.
- Changes to shared protocols must specify compatibility impact and coordinate all affected clients.

## Product invariants
1. Support Bulgarian and English UI; preserve user-defined names and translations, and do not silently overwrite user customization.
2. Support connection to independent Home Assistant installations; never hardcode the Dunav server, local IP, credentials, dashboard identifiers, or a specific home.
3. Device and room discovery must distinguish supported/unsupported, disabled, hidden and unavailable entities; do not silently discard user-selected devices. Provide diagnostics and safe manual mapping.
4. Preserve the STEVORA premium Home Panel visual identity, responsive mobile/tablet/desktop behavior and accessible interaction; do not replace it with a generic HA interface without approval.
5. Do not add controls for lamp backlights; the project requirement is that all lamp backlights remain ON and are not managed through STEVORA.
6. Home Hub, Home Panel, mobile apps, and Hey Stevora are independently versioned components; do not imply a feature exists merely because its UI entry exists.
7. Voice and AI features require explicit permission handling, graceful failures, and clear separation between local and cloud processing.
8. Preserve existing HA configuration, entity IDs, user settings, automations and permissions during upgrades.

## Security and privacy
- Never commit secrets, tokens, private keys, provisioning credentials, certificates, user addresses or personal HA data.
- Use HA authentication and authorization; enforce access on the backend, not just in the UI.
- Do not bypass TLS verification, hardcode credentials, or log sensitive data.
- Require explicit approval before production deployments, destructive migrations, permission changes, or merges into protected/stable branches.
- Do not modify Home Assistant Dunav as part of independent-test development without explicit authorization.

## Workflow for every task
1. Read repository-specific AGENTS.md and relevant docs. Existing platform-specific guidance remains authoritative for implementation details; resolve conflicts explicitly.
2. State scope, dependencies, current behavior, expected behavior and acceptance criteria.
3. Create a focused branch and minimal changes; avoid unrelated refactors.
4. Add or update tests (including BG/EN, permissions, persistence, restart, independent-server compatibility and regressions when applicable).
5. Run available formatters, linters, unit/integration tests and builds; report exact commands, outcomes and environment limitations.
6. Open a PR with change summary, risk assessment, test evidence, screenshots for UI changes, migration/rollback steps and affected components.
7. Do not merge or tag a stable release before required CI and real-device acceptance gates are met.

## Release and updates
- Use semantic versioning and distinguish planned, implemented, tested, release-candidate and released.
- Stable and beta channels must be separate. Never auto-upgrade production from a test branch.
- Plan STEVORA OS for in-place signed updates, backups and rollback; A/B updates are an architectural target, not a currently verified capability.
- Treat installation images and upgrade artifacts as separate deliverables; verify update and restore paths on a disposable installation before production.

## Cross-product contracts
Document any changed API, manifest, room/entity schema, authentication flow or event contract. Specify schema/version migration, backwards compatibility and tests for Android, iOS and Home Panel. Never claim synchronization without checking the actual consumers.

## Reporting format
For each task report: repository and branch; files changed; implemented behavior; tests run with PASS/FAIL/NOT RUN; CI URL if available; limitations; compatibility impact; rollback; and next action. Use precise evidence rather than generic success claims.

## Project streams
STE-00 Core; STE-01 Home Panel; STE-02 Android; STE-03 iOS; STE-04 Hey Stevora; STE-05 Integrations; STE-06 Memory & Releases. Reference the relevant stream in PRs when useful.
