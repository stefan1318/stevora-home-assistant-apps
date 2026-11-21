package main

import (
	"bytes"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"
)

// Only the public authorization document receives the STEVORA presentation.
// Core owns the scripts, provider selection, OAuth parameters and all form steps.
func brandLogin(res *http.Response) error {
	req := res.Request
	if req.Method != http.MethodGet || req.URL.Path != "/auth/authorize" || res.StatusCode != http.StatusOK {
		return nil
	}
	kind, _, _ := mime.ParseMediaType(res.Header.Get("Content-Type"))
	if kind != "text/html" || res.Header.Get("Content-Encoding") != "" {
		return nil
	}
	const limit = 512 << 10
	original := res.Body
	page, err := io.ReadAll(io.LimitReader(original, limit+1))
	if err != nil {
		original.Close()
		return err
	}
	if len(page) > limit {
		res.Body = struct {
			io.Reader
			io.Closer
		}{io.MultiReader(bytes.NewReader(page), original), original}
		return nil
	}
	original.Close()
	res.Body = io.NopCloser(bytes.NewReader(page))
	if !bytes.Contains(page, []byte("<ha-authorize>")) || !bytes.Contains(page, []byte("</head>")) {
		return nil
	}

	lang := req.URL.Query().Get("stevora_lang")
	if lang != "en" && lang != "bg" {
		lang = "en"
		if strings.HasPrefix(strings.ToLower(req.Header.Get("Accept-Language")), "bg") {
			lang = "bg"
		}
	}
	title := "Sign in to STEVORA"
	if lang == "bg" {
		title = "Вход в STEVORA"
	}
	page = bytes.Replace(page, []byte("<title>Home Assistant</title>"), []byte("<title>"+title+"</title>"), 1)
	page = bytes.Replace(page, []byte("</head>"), []byte(`<link rel="stylesheet" href="/stevora-login.css"><link rel="icon" href="/stevora-login.png"></head>`), 1)
	header := `<header class="stevora-login-heading" lang="` + lang + `"><img src="/stevora-login.png" width="72" height="72" alt=""><h1>` + title + `</h1></header>`
	page = bytes.Replace(page, []byte("<ha-authorize>"), []byte(header+"<ha-authorize>"), 1)
	res.Body = io.NopCloser(bytes.NewReader(page))
	res.ContentLength = int64(len(page))
	res.Header.Set("Content-Length", strconv.Itoa(len(page)))
	res.Header.Set("Cache-Control", "no-store")
	res.Header.Del("ETag")
	res.Header.Del("Last-Modified")
	return nil
}
