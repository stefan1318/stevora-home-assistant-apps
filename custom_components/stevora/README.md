# STEVORA Custom Integration — experimental 0.1.0

Copy the `stevora` folder into Home Assistant `config/custom_components/`, restart HA, and add **STEVORA Ecosystem** under Settings → Devices & services → Add integration.

Currently implements config flow, options flow, BG/EN translations, and a read-only internal manifest builder. No public API, frontend installer, entity control, OAuth client, or automatic app synchronization is exposed. The manifest is **not** a permission-filtered API response and must not be exposed directly to clients. For client discovery use authenticated native HA APIs with proper permissions.

Do not install over an existing custom integration with the same domain without a backup. Do not deploy to production until tested on a disposable HA instance.
