package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

const updateDir = "/mnt/data/stevora/update"

func publisherCert() string {
	for _, p := range []string{updateDir + "/publisher.pem", "/etc/stevora/publisher.pem"} {
		if file, err := os.Stat(p); err == nil && file.Mode().IsRegular() {
			return p
		}
	}
	return ""
}

// Core validates the caller on every request, including status reads.
func newUpdateHandler(core *url.URL) http.Handler {
	feed := readFeed()
	go feed.monitor()
	var install sync.Mutex
	client := http.Client{Timeout: 6 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		token := r.Header.Get("Authorization")
		if !strings.HasPrefix(token, "Bearer ") {
			http.Error(w, "Sign in", 401)
			return
		}
		auth, _ := http.NewRequestWithContext(r.Context(), "GET", core.ResolveReference(&url.URL{Path: "/api/stevora/native/admin"}).String(), nil)
		auth.Header.Set("Authorization", token)
		res, err := client.Do(auth)
		if err != nil {
			http.Error(w, "Core unavailable", 503)
			return
		}
		res.Body.Close()
		if res.StatusCode != 204 {
			http.Error(w, "Administrator required", 403)
			return
		}
		cert := publisherCert()
		boot, _ := os.ReadFile("/proc/sys/kernel/random/boot_id")
		statusFile := filepath.Join(updateDir, "status")
		last, _ := os.ReadFile(statusFile)
		status := "idle"
		if prefix := strings.TrimSpace(string(boot)) + " "; strings.HasPrefix(string(last), prefix) {
			status = strings.TrimPrefix(string(last), prefix)
		}
		if r.Method == "GET" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{"publisher_configured": cert != "", "status": status, "downloaded_release": feed.cached()})
			return
		}
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", 405)
			return
		}
		staged := r.URL.Query().Get("release")
		if (staged == "" && r.Header.Get("Content-Type") != "application/octet-stream") || r.Header.Get("Origin") != requestOrigin(r) {
			http.Error(w, "Invalid upload", 400)
			return
		}
		if r.Header.Get("X-Stevora-Update-Approval") != "install" {
			http.Error(w, "Administrator must explicitly approve installation", http.StatusPreconditionRequired)
			return
		}
		if staged == "" && feed.usesOfficialReleaseFeed() {
			http.Error(w, "Select a newer official release from Update Center", http.StatusConflict)
			return
		}
		if cert == "" {
			http.Error(w, "Enroll the release publisher certificate on the host first", 409)
			return
		}
		if !install.TryLock() {
			http.Error(w, "Update already in progress", 409)
			return
		}
		defer install.Unlock()
		latest, _ := os.ReadFile(statusFile)
		if strings.TrimSpace(string(latest)) == strings.TrimSpace(string(boot))+" reboot_required" || status == "reboot_required" {
			http.Error(w, "Restart the VM to activate the pending update", 409)
			return
		}
		var bundle string
		if staged != "" {
			if feed == nil || !releaseTag.MatchString(staged) || staged != feed.cached() {
				http.Error(w, "Release no longer staged", 409)
				return
			}
			// Pin the approved file while the poller may replace its cache.
			bundle = filepath.Join(updateDir, "installing-release.raucb")
			os.Remove(bundle)
			if err = os.Link(feed.path(staged), bundle); err != nil {
				http.Error(w, "Refresh available releases", 409)
				return
			}
			defer os.Remove(bundle)
		} else {
			const maxSize = maxBundle
			if r.ContentLength <= 0 || r.ContentLength > maxSize {
				http.Error(w, "Invalid bundle size", 413)
				return
			}
			if err := os.MkdirAll(updateDir, 0700); err != nil {
				http.Error(w, "Cannot stage update", 500)
				return
			}
			var disk syscall.Statfs_t
			if syscall.Statfs(updateDir, &disk) != nil || disk.Bavail*uint64(disk.Bsize) < uint64(r.ContentLength)+(256<<20) {
				http.Error(w, "Insufficient staging space", 507)
				return
			}
			f, err := os.CreateTemp(updateDir, "upload-*.raucb")
			if err != nil {
				http.Error(w, "Cannot stage update", 500)
				return
			}
			defer os.Remove(f.Name())
			size, copyErr := io.Copy(f, http.MaxBytesReader(w, r.Body, maxSize))
			closeErr := f.Close()
			if copyErr != nil || closeErr != nil || size != r.ContentLength {
				http.Error(w, "Incomplete upload", 400)
				return
			}
			bundle = f.Name()
		}
		record := func(s string) error {
			return writeAtomic(statusFile, []byte(strings.TrimSpace(string(boot))+" "+s), 0600)
		}
		// RAUC checks bundle integrity and the board/slot configuration at install.
		if err = exec.CommandContext(r.Context(), "rauc", "--keyring", cert, "info", bundle).Run(); err != nil {
			http.Error(w, "Bundle signature verification failed", 400)
			return
		}
		if err = record("installing"); err != nil {
			http.Error(w, "Cannot persist update state", 500)
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		if err = exec.CommandContext(ctx, "rauc", "install", bundle).Run(); err != nil {
			record("failed")
			http.Error(w, "RAUC installation failed", 500)
			return
		}
		record("reboot_required")
		w.WriteHeader(http.StatusNoContent)
	})
}

func requestOrigin(r *http.Request) string {
	if r.TLS != nil {
		return "https://" + r.Host
	}
	return "http://" + r.Host
}
