# STEVORA OS Dev4

Open `http://<VM-IP>/` on the local network after boot. Core still owns accounts,
MFA, token issuance and permissions. HTTP sends session credentials without transport
encryption. The browser microphone requires a secure origin. Text Assist works on HTTP.

To enable TLS from the host console, put the following entries in
`/mnt/data/stevora/gateway.env` and run `systemctl restart stevora-native-web.service`.
Use paths to a PEM certificate chain and matching private key readable by the gateway.

```ini
STEVORA_HTTPS_ADDR=:443
STEVORA_TLS_CERT=/mnt/data/stevora/https/chain.pem
STEVORA_TLS_KEY=/mnt/data/stevora/https/server-private.key
```

Setting only the listen address uses the installation's locally issued certificate.
With TLS enabled the gateway redirects port 80 to the configured HTTPS port.
Remove the settings and restart the service to restore HTTP.

The STEVORA system screen includes native home, network and host settings.
“All Core settings” opens the full Core catalog within the STEVORA shell and can
ask for a Core session. Room and device tiles use the native STEVORA controls.
Active clients fetch their own permission-filtered manifest on connection and
after a registry or manager change. Mobile systems resume synchronization when
they permit the app to run.

The OVA workflow produces an x86-64 VM image and a RAUC publisher input.
An in-place update requires a bundle signed with the key matching the
publisher enrolled on the target appliance.
