package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestBrandedAuthorization(t *testing.T) {
	const page = "<html><head><title>Home Assistant</title></head><body><ha-authorize></ha-authorize><script src='/frontend_latest/auth.js'></script></body></html>"
	const policy = "script-src 'self'"
	core := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/authorize" && (r.URL.Query().Get("state") != "opaque" || r.Header.Get("Accept-Encoding") != "identity") {
			t.Error("authorization request changed or response encoding not negotiated")
		}
		w.Header().Set("Content-Type", "text/html; charset=UTF-8")
		w.Header().Set("Content-Security-Policy", policy)
		io.WriteString(w, page)
	}))
	defer core.Close()
	base, _ := url.Parse(core.URL)
	app := newRouter(t.TempDir(), base)
	for _, tc := range []struct{ path, title string }{
		{"/auth/authorize?state=opaque&stevora_lang=bg", "Вход в STEVORA"},
		{"/auth/authorize?state=opaque&stevora_lang=en", "Sign in to STEVORA"},
		{"/auth/providers", ""},
	} {
		w := httptest.NewRecorder()
		app.ServeHTTP(w, httptest.NewRequest("GET", tc.path, nil))
		body := w.Body.String()
		if tc.title == "" {
			if body != page { t.Error("non-presentation response changed") }
			continue
		}
		if w.Code != 200 || w.Header().Get("Content-Security-Policy") != policy ||
			!strings.Contains(body, tc.title) || !strings.Contains(body, "/stevora-login.png") ||
			!strings.Contains(body, "<ha-authorize></ha-authorize>") || !strings.Contains(body, "/frontend_latest/auth.js") {
			t.Errorf("authorization page mismatch for %s", tc.path)
		}
	}
}
