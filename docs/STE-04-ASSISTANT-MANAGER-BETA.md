# STEVORA Assistant Manager — integration beta

## Implemented in this branch
- Admin-only `stevora/admin/assistants/get` returns configured default, per-user selections, and live HA Assist pipelines.
- Admin-only `stevora/admin/assistants/update` validates selected pipeline IDs and active HA user IDs, uses revision checks and persistent storage.
- Authenticated `stevora/assistants/resolve` returns the current user's selected pipeline ID, or `null` for the HA default.
- Server never trusts mobile role flags or account-type strings. It never returns other users' settings to non-admin callers.
- iOS/Android shared API contracts support these messages.

## Important release boundaries
- This **does not** override the Home Assistant native `assist_pipeline/run` authorization or automatically change third-party conversation routing. Clients must use `stevora/assistants/resolve` before sending `assist_pipeline/run` and pass the returned ID in its `pipeline` field; omit `pipeline` when null.
- Per-user **pipeline selection** is implemented; per-user **access grants** are NOT yet enforced. Native HA Assist may remain callable independently of STEVORA. Do not present this as a security boundary against a malicious client.
- Native HA Assist pipeline list can change across versions; test on actual HA Core versions before production.
- This beta does not yet provide complete admin UI screens or mobile end-to-end voice integration. The client protocol alone does not alter runtime voice behavior.
- Home Assistant permissions remain authoritative for actual device control. Credentials remain in HA integrations.
- Do not deploy to Dunav without full backup, separate installation acceptance and rollback testing.

## Admin commands
```json
{"id":10,"type":"stevora/admin/assistants/get"}
{"id":11,"type":"stevora/admin/assistants/update","expected_revision":1,"default_pipeline":"actual-pipeline-id","user_pipelines":{"actual-ha-user-id":"another-pipeline-id"}}
```
Both commands reject non-admin users. A stale revision is rejected with `conflict`.

## Client resolution
```json
{"id":12,"type":"stevora/assistants/resolve"}
```
Response `result.pipeline_id` is a live Assist pipeline ID or `null`. Client should use this ID with HA `assist_pipeline/run`, whose `pipeline` argument selects a specific pipeline.

## Next acceptance gates
1. Add administrator settings screens to iOS, Android and Home Panel.
2. Integrate resolver with actual voice execution paths (and remove account-type hardcoding).
3. Decide whether per-user access grants require a server-side proxy for enforceable restrictions.
4. Run real HA admin/non-admin integration tests, missing pipeline, deleted user, revision conflict, migration, restart.
5. Ship isolated test artifacts after device and integration CI.
