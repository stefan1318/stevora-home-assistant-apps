# [STE-01] STEVORA Home Panel 7.1.1 — Native Premium UX

**Universal Integration:** 0.3.0-beta.3  
**Scope:** Desktop / iPhone / Android Companion / wall tablet.  
**Status:** experimental UI release candidate, separate feature branch and Draft PR #10.  
**Requires:** STEVORA Core + premium Home Panel; Home Hub remains available.

## Source of the requested improvements

The previous UI rendered its entire Shadow DOM on routine Home Assistant
`hass` property assignments. A browser's open `<details>` element is lost
whenever `innerHTML` is replaced. This closed long device customization lists
and discarded unsaved form fields. Users were forced to type `mdi:...`
identifiers and comma-separated control keys and saw generic developer cards.
The AI page only reported that Hey Stevora was not included.

## Implemented changes

1. **Stable settings editor:** HA state ticks do not reconstruct Settings or the
   active chat view. When an explicit refresh is needed, same-installation
   accordion open state, editor draft values and list scroll position are
   restored. None of that state survives a user/server switch.
2. **Visual icons:** curated searchable Home Assistant MDI gallery with
   previews; clicking an icon populates the server-validated icon profile.
   Advanced user IDs are collapsed, and layout/control mode labels use
   end-user language.
3. **Control presets:** Auto / View-only / Custom. Custom uses labeled checkboxes
   instead of comma-separated codes. The server's existing profile validation
   and HA permissions remain authoritative. An explicit empty controls list
   denotes view-only. Fan oscillation/direction, climate swing and cover tilt
   survive the projected panel contract.
4. **Native-feeling cards:** icons, state chips, climate target/reading, RGB and
   brightness, fan speed, safe cover actions, media pause/play and HA More Info.
   Raw entity IDs are hidden from everyday card UI. Lock and unlock require the
   original HA native dialog, not one-tap controls in STEVORA.
5. **Action security:** On EVERY click, the client rechecks the permission-scoped
   manifest, generated controls, live state and backlight identity. HA
   `hass.callService` is the final authorization layer; the new UI does not
   register privileged service proxies.
6. **Home view:** RGB lamp state and current color are visible without offering
   direct color/power control there; full controls remain on Lighting/Rooms.
   The climate summary may read a same-room HA temperature/humidity sensor
   automatically, without Dunav-specific hardcoded entity IDs. Celsius/Fahrenheit
   display follows the connected HA unit system.
7. **Built-in text Assist:** direct authenticated `conversation/process` WebSocket
   to Home Assistant's configured conversation agent, even if Hey Stevora is
   not installed. The panel keeps only a short in-memory chat history and
   conversation ID, cleared when the server/user changes. Output is escaped
   as text, not inserted as HTML. Missing HA Conversation or agent reports a
   clear error. This is TEXT chat; native microphone/voice pipeline setup is
   still handled by HA and optional Hey Stevora products.
8. **Premium design:** responsive dark glass system, visually consistent
   cards/settings/chat, MDI icons, keyboard focus and reduced-motion support.

## Explicit limits

- The icon gallery includes curated common MDI choices, not the complete
  upstream MDI catalog. Icons are still represented as server-safe `mdi:`
  strings internally.
- This is not an independent new voice model. Assist must already be configured
  on that Home Assistant installation and its conversation agent must support
  the selected language/intents.
- No auto-controlling backlights, no privilege escalation, no new device
  integrations, cloud sync, hidden remote service calls or Dunav credentials.
- Unit/contract CI uses HA stubs and a simplified DOM. **Browser usability
  and HA Core compatibility are not proven by green CI alone.**

## Independent test / release gates

- [ ] S01: Home Panel loads in desktop Chrome/Safari, no missing CSS/MDI icons.
- [ ] S02: Open Settings -> Admin -> Device editor, expand an entry and type
      an unsaved name. Generate several HA state updates: no collapsing,
      scroll jump or lost input text.
- [ ] S03: Force a manual refresh, verify editor openness and unsaved draft.
      Save a device and confirm the saved values reappear after HA restart.
- [ ] S04: Search devices, pick icons visually, change compact/expanded/info
      layout, choose auto/info/custom controls and verify valid persistence.
- [ ] S05: Admin changes translate devices BG/EN and remain synchronized to
      Android and iOS manifests.
- [ ] S06: Test authorized lights (power, brightness, RGB), fan speed, cover,
      media, climate +/-1 target-unit and native More Info on real hardware.
- [ ] S07: Read-only/non-admin user cannot execute controls through UI or
      crafted DOM events; restricted/hidden/backlight entities remain blocked.
- [ ] S08: Info-only devices do not present a path to native actuator controls.
- [ ] S09: In AI Center, submit a text question via native HA Assist with
      **Hey Stevora not installed**, receive response, send follow-up
      with a continued conversation ID.
- [ ] S10: Disable or remove HA Conversation and confirm explicit UX error
      rather than a fake reply or silent failure.
- [ ] S11: Switch between TWO HA installations/users; no old rooms, controls,
      unsaved forms or chat transcript leak into the new session.
- [ ] S12: Responsive mobile layout works on iOS Safari/PWA and Android,
      including landscape, small screen, touch icon picker and keyboard.
- [ ] S13: Confirm Home Hub status/alerts, rooms, Scenes, Insights, Memory
      placeholder and wall mode remain functional.
- [ ] S14: Full backup and verified rollback from previous successful
      0.3.0-beta.2 test candidate.
- [ ] S15: No Home Assistant errors in Settings -> System -> Logs.

## Installation

Run only on the **independent** test instance after a full backup.
Download the GitHub Actions artifact named
`STEVORA-Universal-Integration-0.3.0-beta.3` from the successful,
**exact commit** of PR #10. Verify the inner integration ZIP against
`SHA256SUMS.txt`, extract to `/config/`, restart HA and hard-refresh
the browser to clear old JS/CSS caches. Do **not** co-install the old
`stevora_manifest` because it registers the same WebSocket command.

## Rollback

Keep the old `/config/custom_components/stevora` folder and a full
HA backup. Restore that folder, restart HA and confirm 0.3.0-beta.2,
the manifest, device profiles and Home Hub. Do not delete .storage data
or other ecosystem integrations.

**Production/Dunav merge is prohibited until S01–S15 succeed on physical
devices and rollback is verified.**
