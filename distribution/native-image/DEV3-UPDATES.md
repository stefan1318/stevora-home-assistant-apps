# Local OS updates on x86-64 Dev3

The image builder exports the boot-tested VM disk and a corresponding RAUC bundle. The RAUC file in CI is input for a publisher, signed with the upstream build's temporary development key. Keep the long-lived release signing key offline. Before release, verify the source commit and artifact hash, then re-sign the bundle on the signing machine:

    rauc --no-verify --cert=publisher.pem --key=publisher.key resign INPUT.raucb stevora-os-update.raucb
    rauc --keyring=publisher.pem info stevora-os-update.raucb

The --no-verify flag in the offline re-signing step is for the incoming temporary CI signature. Installation always verifies the release signature. Use a dedicated long-lived self-signed RAUC publisher certificate. Record its SHA-256 fingerprint separately. This certificate is independent of each home's mobile TLS CA.

On the Dev3 host console, enroll the public release certificate once:

    stevoractl-enroll-publisher /path/to/publisher.pem EXPECTED_SHA256_FINGERPRINT

Create a backup, open STEVORA Update Center as administrator, select the publisher-signed .raucb and approve. RAUC installs the compatible update to the inactive slot. Restart after the UI reports reboot_required. The data partition and signing trust persist. The bundled STEVORA component loads from the active OS slot. Dev2 lacks this upload interface. Interrupted uploads can be retried. After a power loss during installation check RAUC slot status before retrying. Full two-version upgrade and rollback require VM acceptance.

## Mobile TLS

Download STEVORA CA (.cer) on the trusted local network. Compare its SHA-256 fingerprint with the gateway boot log using a separately trusted console. Install as a trusted root. On iOS enable full trust under Settings > General > About > Certificate Trust Settings. On Android user CA support depends on the client. Use a DNS name or IP included in the server certificate. Each installation has its own CA; the download contains only its public certificate.

## Integration and app access

The native wizard uses Core config and options flows. It handles Tuya's local QR selector, menu choices, common scalar and select fields, external provider links and progress. Complex selectors accept their Core JSON value. Optional integrations and apps must be available to the connected Core/Supervisor. Open uses the app's authenticated Ingress session. Apps without an Ingress web UI require their own supported client.

## GitHub releases on feed-enabled images

Configure the protected GitHub environment `stevora-os-release` once. Set
`STEVORA_RAUC_CERT_PEM` and `STEVORA_RAUC_KEY_PEM` to the matching publisher
certificate and private key as multiline secrets. Restrict publishing to trusted
release tags and protect tag creation. Enroll the matching public certificate
once on each hub using the console procedure above.

Push a tag such as `stevora-os-v1.2.3` at the intended release commit. The
release workflow builds the Pi 4, UTM and OVA targets, re-signs their RAUC
bundles on a separate runner, verifies all three and creates a GitHub Release.
Use a fresh, increasing version for each release. The release job creates
the release itself.

The gateway checks public GitHub Releases at startup and every 30 minutes.
It caches a newer stable bundle for its own board after checking its signature.
An administrator opens Update Center, approves installation and restarts to
activate the new slot. The manual upload remains available. Existing Dev4
systems need one initial upgrade to a build containing the release client.
