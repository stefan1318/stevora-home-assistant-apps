# STEVORA Admin Managers v1 — integration/iOS/Android shared contract
Status: implementation contract approved; server endpoints and UI not yet deployed.
Streams: [STE-00], [STE-02], [STE-03], [STE-04], [STE-05].

## Identity and access
Every read of global administration settings and every write MUST authenticate the active Home Assistant session and verify the current HA user is an administrator on the server. Never trust a client-supplied role, account-type string, manifest field or cached admin flag. Non-admins receive a forbidden response without sensitive configuration. Recheck permissions for every request. Global configuration remains server-owned; mobile apps never store service secrets.

## Compatibility
Keep the deployed `stevora/manifest` read command and schema_version `"1.0"` with rooms, mappings, revision and installation_id unchanged for existing clients. Add optional capability flags. Do not silently expose previously excluded entities. All additions are opt-in and backward-compatible.

## Admin API (proposed Home Assistant WebSocket commands)
- `stevora/admin/capabilities` — admin-only discovery of supported operations, assistant providers and permission capabilities.
- `stevora/admin/rooms/get` — admin-only snapshot of HA Areas, device/entity membership, STEVORA visibility and ordering overrides, revision.
- `stevora/admin/rooms/update` — admin-only validated patch with expected_revision, room/entity identifiers, explicit visibility override (default/include/exclude), optional display name/order. Server rejects stale revisions and forbidden/unknown IDs.
- `stevora/admin/assistants/get` — admin-only assistant providers, active pipelines, configurable defaults and per-user grants; never return API keys or tokens.
- `stevora/admin/assistants/update` — admin-only validated assistant provider/pipeline defaults and per-user grants; server enforces provider availability and policy.
- `stevora/admin/configuration_updated` — event notification with revision only; clients refetch authorized state. Event subscription and payload must not leak admin configuration to non-admin users.

## Assistant selection policy
- Remove fixed routing based on account type. Resolve effective assistant from explicit admin-managed per-user selection, then home default, then safe HA Assist fallback.
- Distinguish access grant from default selection. A user may choose only among providers the administrator has enabled for that user.
- Assistant provider credentials and prompts stay server-side. Enforce access on every conversation/request, not just in Settings UI.
- Changing assistant configuration must not silently grant device-control privileges; HA permissions and confirmation rules remain in force.

## Room manager rules
- HA Areas are the canonical physical location; entity Area overrides device Area.
- STEVORA overlays visibility, display name and ordering only; no HA entity deletion.
- Explicit exclusions remain excluded across migration, including backlights. No automatic migration that adds hidden or disabled entities.
- Only admins can mutate global layout. All clients receive projected manifest according to server policy.

## Required release gates
1. Locate and audit the live server manifest implementation and existing assistant routing.
2. Implement server endpoints, persistent storage, HA admin checks, validation and audit logging.
3. Implement iOS and Android admin-only settings screens using authenticated WebSocket commands; no client-side role-based assistant hardcoding.
4. Test admin/non-admin access, token vs OAuth, Dunav and independent HA, manifest absent, migration of exclusions, stale revisions, provider missing, and offline.
5. Build and test both apps; only then enable the new server feature in production.

No existing production deployment is modified by this document.
