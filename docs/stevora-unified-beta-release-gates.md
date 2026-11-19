# STEVORA Ecosystem — unified beta release gates

Status: **implementation in progress; not a verified beta release**.

## Products and canonical source
- Android: `stefan1318/Ha_android`, `feature/stevora-companion`; `com.stevora.companion`.
- iOS: `stefan1318/HA_iOS`, `feature/stevora-ios`; verify all bundle IDs, splash and extensions.
- Home Hub / Panel: `stefan1318/stevora-home-assistant-apps`, `feature/stevora-universal-discovery-v1`.
- Hey Stevora: validate the voice module on both platforms; do not treat a settings toggle as a functioning wake word.

## Manifest requirements
- `stevora/manifest` must be registered on the Home Assistant server and respond over the
  already authenticated WebSocket session.
- Schema `1.0`: installation ID, revision, rooms, entity mappings and supported capabilities.
- Verify ownership/authorization of every entity and service call against the connected HA server.
- Distinguish three states in settings: checking / STEVORA detected / native HA fallback.
  Fallback is **not** proof that the remote server is unmodified.
- Scope all cached data to a server and account; purge on server/account switch.
- Do not publish home entity IDs, location, access tokens or private configuration.

## Mandatory tests before distributing artifacts
1. Compile Android product branch and run unit tests; inspect APK application ID and display name.
2. Compile iOS product branch; inspect IPA bundle IDs, display name and signing requirements.
3. Verify actual settings UI status on Android and iOS for STEVORA and standard HA servers.
4. Validate room/entity UI rendering and state updates without hardcoded IDs.
5. Validate device control, permissions, reconnect, revocation, malformed/old manifest and fallback.
6. Validate Home Hub/Panel installer on a clean HA installation, including rollback.
7. Validate Hey Stevora permissions and recording behavior; no simulated successful recording.
8. Run at least two distinct STEVORA installations plus one plain HA installation.
9. Capture exact workflow run URLs, artifacts, test results, version and commit SHA.

**Release decision:** No beta release is confirmed until all applicable gates pass.
