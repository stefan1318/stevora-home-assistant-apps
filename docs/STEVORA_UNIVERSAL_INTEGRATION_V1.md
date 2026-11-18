# STEVORA Universal Integration v1 — draft contract
Status: implementation in progress; NOT production-ready.

## Scope
Home Panel installer/configurator, Home Hub discovery, Android/iOS client adaptation, Hey Stevora capability discovery.

## Installation
A future Home Assistant custom integration is installed via HACS or manually, configured through a Home Assistant config flow. No public unauthenticated configuration endpoint.

## Discovery
Clients authenticate using Home Assistant OAuth authorization-code flow. After authorization, clients query Home Assistant registries via its authenticated WebSocket API and optionally the STEVORA capability manifest. Without STEVORA installed, fall back to native HA entity/area/device discovery.

## Manifest contract
Schema version 1.0; fields: schema_version, installation_id, capabilities, preferred_language, rooms, mappings. Installation ID is server-scoped, not a global user identifier. The manifest MUST NOT contain passwords, long-lived access tokens, private IP addresses, precise location or personal data. Per-user permissions apply; clients cannot infer authorization from a manifest.

## Mapping
Device classes and supported_features take precedence over entity names. Users can override mappings. Unknown devices remain visible but are not assigned speculative controls. Keep source entity IDs and unique IDs distinct.

## Synchronization
HA config entries/options are authoritative for server-side configuration. Use revision numbers for conflict detection. Never persist configuration exclusively in browser localStorage. No automatic cross-home sharing.

## Safety and rollout
No automatic control of devices during discovery. Never expose control APIs without HA authentication and authorization. Validate allowed origins and TLS; no SSL bypass. Backup existing config before migration; migrations are reversible. Feature flags default off until tests pass.

## Acceptance tests
- Fresh install, reinstall and rollback
- Existing STEVORA v7 config preserved
- Multiple independent HA servers
- Missing/renamed/offline entities
- Permission-limited accounts
- Android/iOS OAuth and token refresh
- Hey Stevora unavailable or disabled
- BG/EN localization
- HA version compatibility and integration unloading
- No secrets in logs/manifest
- No device actions during discovery

## Release gates
Design -> implemented -> automated tests -> live HA tests -> released. Do not label a feature released without evidence.
