package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const releaseRepo = "stefan1318/stevora-home-assistant-apps"
const maxBundle = 2 << 30

var releaseTag = regexp.MustCompile(`^stevora-os-v(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$`)

func releaseNumber(tag string) int64 {
	parts := releaseTag.FindStringSubmatch(tag)
	if parts == nil {
		return -1
	}
	var result int64
	for _, part := range parts[1:] {
		n, _ := strconv.Atoi(part)
		result = result*1000000 + int64(n)
	}
	return result
}

type releaseAsset struct {
	Name   string
	Size   int64
	Digest string
}
type githubRelease struct {
	Tag        string `json:"tag_name"`
	Draft      bool
	Prerelease bool
	Assets     []releaseAsset
}
type releaseFeed struct {
	Board     string
	Installed string
}

func readFeed() *releaseFeed {
	raw, err := os.ReadFile("/usr/share/stevora-os/release-feed")
	if err != nil {
		return nil
	}
	items := strings.Fields(string(raw))
	if len(items) != 2 || releaseNumber(items[1]) < 0 {
		return nil
	}
	switch items[0] {
	case "ova", "generic_aarch64", "rpi4_64":
		return &releaseFeed{items[0], items[1]}
	}
	return nil
}
func (f *releaseFeed) cached() string {
	if f == nil {
		return ""
	}
	files, _ := filepath.Glob(filepath.Join(updateDir, f.Board+"-stevora-os-v*.raucb"))
	best := f.Installed
	for _, path := range files {
		tag := strings.TrimSuffix(strings.TrimPrefix(filepath.Base(path), f.Board+"-"), ".raucb")
		if releaseNumber(tag) > releaseNumber(best) {
			best = tag
		}
	}
	if best == f.Installed {
		return ""
	}
	return best
}
func (f *releaseFeed) path(tag string) string {
	return filepath.Join(updateDir, f.Board+"-"+tag+".raucb")
}
var releaseDigest = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)

func newest(releases []githubRelease, floor, name string) (string, releaseAsset) {
	best := floor
	var selected releaseAsset
	for _, r := range releases {
		if r.Draft || r.Prerelease || releaseNumber(r.Tag) <= releaseNumber(best) {
			continue
		}
		for _, a := range r.Assets {
			if a.Name == name && a.Size > 0 && a.Size <= maxBundle && releaseDigest.MatchString(a.Digest) {
				best, selected = r.Tag, a
				break
			}
		}
	}
	return best, selected
}
func (f *releaseFeed) poll() error {
	cert := publisherCert()
	if cert == "" {
		return nil
	}
	client := &http.Client{Timeout: 45 * time.Minute}
	req, _ := http.NewRequest("GET", "https://api.github.com/repos/"+releaseRepo+"/releases?per_page=100", nil)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("release list HTTP %d", resp.StatusCode)
	}
	var releases []githubRelease
	if err = json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&releases); err != nil {
		return err
	}
	previous := f.cached()
	floor := f.Installed
	if previous != "" {
		floor = previous
	}
	name := "stevora-os-" + f.Board + ".raucb"
	tag, selected := newest(releases, floor, name)
	size := selected.Size
	if size == 0 {
		return nil
	}
	if err = os.MkdirAll(updateDir, 0700); err != nil {
		return err
	}
	var disk syscall.Statfs_t
	if syscall.Statfs(updateDir, &disk) != nil || disk.Bavail*uint64(disk.Bsize) < uint64(size)+(256<<20) {
		return errors.New("insufficient update cache space")
	}
	asset, err := client.Get("https://github.com/" + releaseRepo + "/releases/download/" + tag + "/" + name)
	if err != nil {
		return err
	}
	defer asset.Body.Close()
	if asset.StatusCode != 200 {
		return fmt.Errorf("release asset HTTP %d", asset.StatusCode)
	}
	file, err := os.CreateTemp(updateDir, "release-*.part")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	digest := sha256.New()
	n, err := io.Copy(io.MultiWriter(file, digest), io.LimitReader(asset.Body, size+1))
	closeErr := file.Close()
	if err != nil || closeErr != nil || n != size {
		return errors.New("incomplete release download")
	}
	if fmt.Sprintf("sha256:%x", digest.Sum(nil)) != selected.Digest {
		return errors.New("release checksum verification failed")
	}
	if err = exec.Command("rauc", "--keyring", cert, "info", file.Name()).Run(); err != nil {
		return errors.New("release signature verification failed")
	}
	if err = os.Rename(file.Name(), f.path(tag)); err != nil {
		return err
	}
	if previous != "" {
		os.Remove(f.path(previous))
	}
	return nil
}
func (f *releaseFeed) monitor() {
	if f == nil {
		return
	}
	// An interrupted transfer is never offered as an installable bundle.
	files, _ := filepath.Glob(filepath.Join(updateDir, "release-*.part"))
	for _, p := range files {
		os.Remove(p)
	}
	// Remove bundles superseded by the currently booted system.
	bundles, _ := filepath.Glob(filepath.Join(updateDir, f.Board+"-stevora-os-v*.raucb"))
	for _, p := range bundles {
		tag := strings.TrimSuffix(strings.TrimPrefix(filepath.Base(p), f.Board+"-"), ".raucb")
		if releaseNumber(tag) <= releaseNumber(f.Installed) {
			os.Remove(p)
		}
	}
	for {
		if err := f.poll(); err != nil {
			log.Printf("STEVORA release discovery: %v", err)
		}
		time.Sleep(30 * time.Minute)
	}
}
