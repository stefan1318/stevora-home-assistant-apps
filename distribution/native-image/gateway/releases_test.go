package main

import (
	"strings"
	"testing"
)

func TestNewestStableBoardRelease(t *testing.T) {
	name := "stevora-os-rpi4_64.raucb"
	digest := "sha256:" + strings.Repeat("a", 64)
	asset := []releaseAsset{{name, 42, digest}}
	all := []githubRelease{
		{"stevora-os-v2.9.3", false, false, asset},
		{"stevora-os-v2.10.1", false, false, asset},
		{"stevora-os-v2.11.0", false, false, []releaseAsset{{"stevora-os-ova.raucb", 42, digest}}},
		{"stevora-os-v3.0.0", false, true, asset},
		{"stevora-os-v4.0.0", true, false, asset},
		{"stevora-os-v5.0.0", false, false, []releaseAsset{{name, maxBundle + 1, digest}}},
		{"stevora-os-v6.0.0", false, false, []releaseAsset{{name, 42, ""}}},
		{"stevora-os-v99.1.0-beta", false, false, asset},
	}
	tag, selected := newest(all, "stevora-os-v2.0.0", name)
	if tag != "stevora-os-v2.10.1" || selected != asset[0] {
		t.Fatal(tag, selected)
	}
	if _, selected = newest(all, tag, name); selected.Size != 0 {
		t.Fatal("offered installed release")
	}
}

func TestOfficialImageDisallowsUnversionedUpload(t *testing.T) {
	for _, entry := range []struct {
		feed *releaseFeed
		want bool
	}{
		{nil, false},
		{&releaseFeed{Installed: "stevora-os-v0.0.0"}, false},
		{&releaseFeed{Installed: "stevora-os-v1.0.0"}, true},
	} {
		if got := entry.feed.usesOfficialReleaseFeed(); got != entry.want {
			t.Errorf("feed %v: official = %t, want %t", entry.feed, got, entry.want)
		}
	}
}
