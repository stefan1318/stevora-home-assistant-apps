package main

import (
 "crypto/tls"
 "net/http"
 "net/http/httptest"
 "net/url"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func TestCoreRouteAllowlist(t *testing.T){
 allow:=[]string{"/auth/authorize","/auth/token","/api/websocket","/api/states","/frontend_latest/a.js"}
 for _,route:=range allow{if !isCorePath(route){t.Errorf("%s must proxy to HA Core",route)}}
 deny:=[]string{"/","/app.js","/stevora-192.png","/etc/passwd","/api-root","/supervisor"}
 for _,route:=range deny{if isCorePath(route){t.Errorf("%s must not proxy",route)}}
}

func TestNativeFrontendAndProxy(t *testing.T){
 calls:=0
 upstream:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  calls++
  if v:=r.Header.Get("X-Forwarded-For");v!=""{t.Errorf("forwarded-for leaked: %q",v)}
  w.WriteHeader(200);w.Write([]byte("CORE "+r.URL.Path))
 }))
 defer upstream.Close()
 base,_:=url.Parse(upstream.URL)
 root:=t.TempDir()
 if err:=os.WriteFile(filepath.Join(root,"index.html"),[]byte("STEVORA OS native root"),0644);err!=nil{t.Fatal(err)}
 if err:=os.WriteFile(filepath.Join(root,"app.js"),[]byte("native-js"),0644);err!=nil{t.Fatal(err)}
 app:=newRouter(root,base)
 w:=httptest.NewRecorder();app.ServeHTTP(w,httptest.NewRequest("GET","https://stevora.local/",nil))
 if w.Code!=200 || !strings.Contains(w.Body.String(),"STEVORA OS native"){t.Fatalf("wrong root: %d %s",w.Code,w.Body.String())}
 if w.Header().Get("Content-Security-Policy")==""{t.Fatal("missing native frontend CSP")}
 w=httptest.NewRecorder();app.ServeHTTP(w,httptest.NewRequest("GET","https://stevora.local/api/states",nil))
 if w.Code!=200 || w.Body.String()!="CORE /api/states"{t.Fatalf("proxy failed %d %s",w.Code,w.Body.String())}
 if calls!=1{t.Fatalf("expected only authorized Core path to proxy, got %d",calls)}
 w=httptest.NewRecorder();app.ServeHTTP(w,httptest.NewRequest("POST","https://stevora.local/app.js",nil))
 if w.Code!=405{t.Fatalf("static POST not refused: %d",w.Code)}
 w=httptest.NewRecorder();app.ServeHTTP(w,httptest.NewRequest("GET","https://stevora.local/private",nil))
 if !strings.Contains(w.Body.String(),"STEVORA OS native root"){t.Fatal("SPA route lost")}
 w=httptest.NewRecorder();app.ServeHTTP(w,httptest.NewRequest("GET","https://stevora.local/not-found.js",nil))
 if w.Code!=404{t.Fatal("unknown JS file should not fall back to index")}
}

func TestLocalTLSCertificate(t *testing.T){
 dir:=filepath.Join(t.TempDir(),"tls")
 if err:=os.MkdirAll(dir,0700);err!=nil{t.Fatal(err)}
 cert,key,err:=ensureCertificate(dir);if err!=nil{t.Fatal(err)}
 pair,err:=tls.LoadX509KeyPair(cert,key);if err!=nil{t.Fatal(err)}
 if len(pair.Certificate)==0{t.Fatal("empty cert")}
 info,err:=os.Stat(key);if err!=nil{t.Fatal(err)}
 if info.Mode().Perm()!=0600{t.Fatalf("private key permissions %o",info.Mode().Perm())}
 cert2,key2,err:=ensureCertificate(dir);if err!=nil{t.Fatal(err)}
 if cert!=cert2 || key!=key2{t.Fatal("cert path changed unexpectedly")}
}
