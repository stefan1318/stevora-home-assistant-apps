package main

import "testing"

func TestNewestStableBoardRelease(t *testing.T) {
	name := "stevora-os-rpi4_64.raucb"
	asset := []releaseAsset{{name, 42}}
	all := []githubRelease{
		{"stevora-os-v2.9.3", false, false, asset},
		{"stevora-os-v2.10.1", false, false, asset},
		{"stevora-os-v2.11.0", false, false, []releaseAsset{{"stevora-os-ova.raucb", 42}}},
		{"stevora-os-v3.0.0", false, true, asset},
		{"stevora-os-v4.0.0", true, false, asset},
		{"stevora-os-v5.0.0", false, false, []releaseAsset{{name, maxBundle + 1}}},
		{"stevora-os-v99.1.0-beta", false, false, asset},
	}
	tag, size := newest(all, "stevora-os-v2.0.0", name)
	if tag != "stevora-os-v2.10.1" || size != 42 {
		t.Fatal(tag, size)
	}
	if _, size = newest(all, tag, name); size != 0 {
		t.Fatal("offered installed release")
	}
}
