# STEVORA Adaptive Capability UI — Next Development Stage
Status: APPROVED PRODUCT REQUIREMENT / IMPLEMENTATION NOT STARTED
Date: 2026-11-27
Scope: STEVORA OS + STEVORA Universal Integration/Home Panel + Android + iOS
Owner: STEVORA Ecosystem
Implementation principle: **capability-driven UI, not brand/model-driven UI**.

## Objective
Across every installation, discover the actual Home Assistant devices, entities and supported operations and show only appropriate pages, tiles, status and controls. Never display empty specialist modules in homes lacking relevant equipment. Never suppress supported device capabilities merely because a dedicated tile has not yet been implemented. Features must reflect *actual* exposure by each Home Assistant integration, not inferred marketing specifications.

## Core acceptance invariants
1. No brand-specific hardcoding, static entity IDs, device inventory assumptions or mandatory fixed rooms.
2. Specialist pages (Energy, Heat Pump, Irrigation, Security, Water, etc.) appear when sufficient confirmed, relevant capabilities exist; absent otherwise. Basic fallback entity controls remain accessible.
3. Render read-only measurements without pretending to offer unavailable write operations.
4. Distinguish missing/disconnected/unavailable from removed equipment: a temporarily unavailable device remains visible with explicit offline/error state.
5. Every supported exposed operation has an accessible control in a specialist renderer or a safe generic fallback, subject to permissions.
6. Cross-platform semantic parity via one versioned capability manifest; responsive layout/platform-native interaction is allowed.
7. Admin override of grouping/classification and visibility, with persistence across restarts and rediscovery; never grant access beyond HA authorization.
8. For high-risk commands (water shutoff, security arming/disarming, electrical protection, heating safety modes) enforce device support, role authorization, confirmation where appropriate, explicit failure status and auditability.
9. BG/EN labels, units and naming supported, while stable IDs remain language independent.
10. Update rendering on HA entity/device/area registry changes, state and capability changes; throttle updates to avoid UI flicker.

## Categories / functionality matrix
- Heat pumps: heating/cooling modes; supply/return/outdoor temperatures; DHW setpoint and tank actual temperature; compressor status; circulation pump; diagnostics; consumption/thermal output/COP **only if surfaced**.
- Hydronic heating/floor heating: zones by room; thermostats, manifold valves, target/actual temperatures, schedules when available; room affiliation may require admin mapping.
- Fan coils, AC and HVAC: heating/cooling; targets, fan modes/speeds, swing/direction, humidity, power, diagnostics per device.
- Photovoltaic: grid-tied, standalone/off-grid and hybrid; inverter, PV production, grid import/export, household load, battery SOC/charge/discharge, reserve, backup, operating modes, trends and energy flow **only with properly typed and consistent sensors**. No invented measurements.
- Smart plugs and energy monitors: on/off, power, energy and safe limits if actually exposed.
- Irrigation: controllers, valves, zones, soil moisture, schedules, rain skip if provided.
- Smart circuit breakers/relays: states, current, voltage, power, trip diagnostics, commands only if explicitly safe and exposed; no bypass of protective safeguards.
- Water valves, meters and leak protection: valve status, flow, consumption, leak alarms, automated water shutoff integration, manual confirmation and priority alarm.
- Alarms, safety sensors: arm/disarm only through supported services and permissions, sirens, motion, smoke/CO/leak detection, open door/window, tamper, battery and connectivity.
- Cameras: streams, snapshots, motion/events, supported recordings with proper authentication and privacy policies.
- Lighting: on/off, brightness, color, color temperature, effects where supported; preserve STEVORA-specific rule that existing light backlights are not exposed as controllable UI.
- Other Home Assistant domains (covers, locks, fans, sensors, media, vacuums, etc.): usable generic renderer plus progressively enhanced specialist renderers.
- Related features (e.g. heat pump + PV solar optimization) activate only when each input/control is available; disabled/read-only explanations when partially supported. Never issue unsafe automations by default.

## Data architecture
Home Assistant is the authoritative integration and device-control layer. Build a reusable STEVORA *Capability Discovery & Normalization* service using device registry, entity registry, area registry, entity domain, device_class, state_class, unit_of_measurement, supported_features, service/action schemas, options, integration metadata and availability. Note: registries/metadata can be incomplete or misleading; classification must carry evidence, confidence and override capability.

Proposed normalized schema (illustrative, revise against actual repository):
- schema_version, site_id (home scoped), revision
- systems[] {system_id, category, device_ids[], area_ids[], capabilities[], classification_source, confidence, availability}
- devices[] {stable_device_id, ha_device_id, area_id, display_names, capabilities[], entity_ids[], availability}
- capabilities[] {id, semantic_type, read_entity_ids[], actions[] {service, target, required_params, constraints, authorization}, units, range/options, availability, provenance, read_only}
- preferences/overrides per home & admin; no personal secrets in manifest.

One physical device can participate in multiple systems. Multiple entities can combine into one system. Implement reconciliation, stable mapping, deletion/rename migrations, safe caching and event-driven updates. Do not duplicate HA auth; enforce rights on the backend at time of action, not merely by hiding UI. Avoid leaking secrets/camera tokens; prefer authorized secure stream endpoints.

## Rendering and navigation
- General Home & Rooms stay available; category hubs/cards appear only if classified systems exist.
- UI component registry: capability type -> specialist widget. Unknown capability -> generic entity details/actions with proper types and permissions.
- Dynamic menus and tile expansions: compact summary; detailed controls on selection, no HA default control page.
- Hide irrelevant groups/empty states, but preserve offline device tiles, explicit diagnostics and discoverability through Device & Room Manager.
- Admin: visual device categorization/icon selection; group/rename/room assignment BG/EN; manual capability mapping when discovery cannot prove linkage; reset to automatic.
- User/panels: permission-filtered controls; no admin-only sections; do not assume globally uniform permissions.
- OS, Android and iOS follow identical capability IDs/availability semantics and can independently render appropriately for screen and platform.
- Manifest version negotiation for older app builds with safe generic fallback.

## Implementation stages
### Phase 0 — Repository audit and contract
Review current code and active OS Dev4 branches, Universal Integration manifest, Device & Room Manager, Home Panel 7.1.1, Android and iOS consumers. Document compatibility and migration constraints. Avoid modifying live Dunav and do not merge unrelated active Dev4 work.

### Phase 1 — Backend discovery, classification & manifest
Build normalized service; event listeners + reconcilers; capability evidence; registry changes; offline retention; versioned schema; admin override storage; permission enforcement; migrations, rate limiting, tests.

### Phase 2 — Dynamic OS / Home Panel renderer
Create reusable registry of control components with fallback; dynamic category navigation; device detail; Energy and Climate specialists as initial reference implementations; no blank categories. Respect established STEVORA brand and UI.

### Phase 3 — Mobile contracts and consumers
Synchronize Android (stefan1318/Ha_android) and iOS (stefan1318/HA_iOS). Discover actual repository state before editing. Wire schema negotiation, dynamic modules, read-only states, permissions and localization. CI unsigned iOS workflow/signing rules must remain unchanged absent approval.

### Phase 4 — Category expansion and cross-system logic
Irrigation, smart power, water/leak response, security, cameras, contact sensors and remaining HA device types. Energy optimization only when relevant telemetry & safe actions are verified, default opt-in.

### Phase 5 — Quality gates and rollout
Unit, contract and E2E tests across OS + apps; independent HA test server before home deployment; regression against existing room/device counts, Home Panel v7.1.1, BG/EN, existing lighting/backlight policy and access rights. Feature flag & rollback; no production/main merges without explicit approval.

## Required scenario tests
- Empty house, one ordinary AC, heat pump with/without DHW, multiple floor-heating zones with fan coils.
- Solar grid-only, off-grid, hybrid with battery, incomplete/mislabelled energy sensors.
- Plug on/off only vs plug with power/energy; lights supporting just on/off vs RGB/brightness.
- Water sensor without valve; leak sensor plus shutoff; unavailable shutoff valve; alarms and cameras with denied permissions.
- Add/remove/reassign/rename devices, duplicate names, offline/online transitions, unsupported vendor integration, restart and reauthentication.
- Admin/user/panels permissions, two independent homes, BG/EN, legacy manifest/app fallback.
- Rapid state changes: no redraw loops, menu flicker, duplicate tiles or leaked state.
- Dangerous controls never issue commands without supported capability and authorization.

## Definition of done
- End-to-end discovery/normalization and adaptable UI works in isolated test HA and all targeted clients.
- No false specialist pages or missing supported controls across test matrix; permitted generic fallback works for unknown domains.
- Complete CI, security review, migration/rollback documentation and independently approved acceptance tests.
- Produce PRs, screenshots/demo data, schema docs and release notes; no implicit approval to merge or deploy.

## Codex / Work handoff
Start at this document. Inspect latest open PRs and active branches first; do not assume main represents latest OS Dev4. Write an implementation plan with dependency order and cross-repo changes. Split work into reviewable PRs, preserve existing CI and signing/release infrastructure, test against mock HA registries and independent test instances. Never place signing keys, credentials, or user-home-specific data in repository. Report completed vs planned capabilities explicitly.

Approved product goal by user on 2026-11-27; this document records requirements only, not a claim that code is deployed.
