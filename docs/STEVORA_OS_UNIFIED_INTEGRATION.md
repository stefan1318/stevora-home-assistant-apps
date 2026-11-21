# STEVORA OS — Unified Ecosystem Integration
Status: approved scope, NOT implemented or released. Date: 2026-11-21.
Canonical standard: stefan1318/stevora-memory-sync/PRODUCT_STANDARDS.md

## Confirmed field findings
- Independent x86-64 VirtualBox preview booted; Supervisor installed Home Assistant Core.
- Core attempted to use HTTP port 80 and entered Recovery Mode due to address already in use.
- Changing Core HTTP server port to 8123 fixed the problem; user confirmed persistence after restart.
- HA onboarding required visiting port 8123 manually; STEVORA sign-in redirects to official HA authentication and returns.

## Required implementation work
1. Identify the real STEVORA OS image source repository, build workflow, ingress source, configuration templates and exact versions. This is a BLOCKER: this repository alone does not prove ownership of the OS image.
2. Core startup: use default HA Core port 8123, keep STEVORA gateway listener separate, detect collisions and preserve existing user configuration. Back up before any migration.
3. First-boot: branded BG/EN wizard, Core download/installation/readiness status, official HA onboarding APIs, account creation without storing credentials in STEVORA, resume after restart, error/retry paths.
4. Login: preserve official HA authentication, MFA, identity providers, secure redirects, CSRF/state and role checks. Brand supported surfaces only; do not bypass official auth.
5. Embed OS Core, Universal Integration, Home Panel 7.1.1 Premium, Home Hub, Frontend, People & Presence and versioned Manifest. No hardcoded homes, IPs, devices, room names, credentials or entity IDs.
6. Hey Stevora is a built-in OS/Android/iOS function using only actually installed, authorized AI/voice providers. Show unavailable state when absent.
7. Integrations: capability-based discovery, user overrides, accurate unsupported/disabled diagnostics; do not control lamp backlights.
8. Updates/backup: stable and beta channels, tested backups, migrations and rollback; never claim signed or A/B update support without implementation evidence.
9. Android/iOS: versioned OS API contract, manifest and permissions compatibility, BG/EN translations, native login and independent-server tests.
10. Private STEVORA Memory & Sync is excluded from public OS and apps; owner-only optional extension disabled by default.

## Acceptance gates
- Clean x86-64 VirtualBox install reaches branded STEVORA onboarding without manual navigation to port 8123.
- HA Core remains on 8123 after restart; no Recovery Mode or listener collision.
- Slow mobile network, interrupted Docker pull, resume and offline errors are tested.
- OAuth/MFA, logout, token expiry, roles and return redirects tested.
- Empty home, different devices, unavailable integrations, custom room/device names and BG/EN tested.
- Android/iOS contract tests, migration from existing preview, backup/restore and rollback tested.
- Record source commit, CI links, image checksum, and PROPOSED/IMPLEMENTED/TESTED/RELEASED status per module.

Do not merge this requirements PR as evidence of implementation; actual OS source and build must be located before any implementation claim.