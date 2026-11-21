// STEVORA OS native gateway: the device's own root application, not an HA panel.
// It serves no credentials and proxies only HA Core auth/API routes. HA Core
// itself enforces user permissions and the Supervisor API is never reachable
// directly from an unprivileged browser.
package main

import (
 "context"
 "crypto/ecdsa"
 "crypto/elliptic"
 "crypto/rand"
 "crypto/tls"
 "crypto/x509"
 "crypto/x509/pkix"
 "encoding/pem"
 "errors"
 "flag"
 "io"
 "log"
 "math/big"
 "net"
 "net/http"
 "net/http/httputil"
 "net/url"
 "os"
 "path"
 "path/filepath"
 "strings"
 "time"
)

const version = "native-integrated-dev.0"

func main() {
 root := flag.String("root", "/usr/share/stevora-os", "read-only static frontend root")
 certDir := flag.String("cert-dir", "/mnt/data/stevora/https", "private persistent TLS key directory")
 httpsAddr := flag.String("https", ":443", "TLS listen address")
 httpAddr := flag.String("http", ":80", "HTTP redirect listen address")
 upstream := flag.String("upstream", "http://127.0.0.1:8123", "local HA Core address")
 flag.Parse()

 u, err := url.Parse(*upstream)
 if err != nil || u.Scheme != "http" || u.Hostname() != "127.0.0.1" || u.Port() != "8123" {
  log.Fatal("HA upstream must be strictly http://127.0.0.1:8123")
 }
 if err = os.MkdirAll(*certDir,0700);err != nil {log.Fatal(err)}
 cert, key, err := ensureCertificate(*certDir)
 if err != nil {log.Fatal(err)}
 tlsKeyPair, err := tls.LoadX509KeyPair(cert,key)
 if err != nil {log.Fatal(err)}
 router := newRouter(*root,u)
 server := &http.Server{
  Addr:*httpsAddr,Handler:router,ReadHeaderTimeout:10*time.Second,
  IdleTimeout:75*time.Second,MaxHeaderBytes:1<<20,
  TLSConfig:&tls.Config{MinVersion:tls.VersionTLS12,Certificates:[]tls.Certificate{tlsKeyPair}},
 }
 redirect := &http.Server{Addr:*httpAddr,ReadHeaderTimeout:5*time.Second,
  Handler:http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
   if r.URL.Path=="/healthz" {
    w.Header().Set("Content-Type","text/plain; charset=utf-8")
    _,_ = io.WriteString(w,"STEVORA native gateway online\n")
    return
   }
   hostname,_,err:=net.SplitHostPort(r.Host)
   if err!=nil {hostname=r.Host}
   if strings.ContainsAny(hostname,"/\\@") || hostname=="" {http.Error(w,"Invalid host",400);return}
   if strings.Contains(hostname,":") && !strings.HasPrefix(hostname,"[") {hostname="["+hostname+"]"}
   dest:="https://"+hostname+r.URL.RequestURI()
   http.Redirect(w,r,dest,http.StatusPermanentRedirect)
  }),
 }
 go func(){log.Printf("STEVORA HTTP redirect on %s",*httpAddr);if err:=redirect.ListenAndServe();err!=nil&&!errors.Is(err,http.ErrServerClosed){log.Printf("http: %v",err)}}()
 log.Printf("STEVORA Native %s HTTPS %s, HA authentication forwarded to Core",version,*httpsAddr)
 if err=server.ListenAndServeTLS("","");err != nil && !errors.Is(err,http.ErrServerClosed){log.Fatal(err)}
 _ = server.Shutdown(context.Background())
}

func newRouter(staticRoot string,core *url.URL) http.Handler {
 proxy:=httputil.NewSingleHostReverseProxy(core)
 proxy.Director=func(r *http.Request){
  r.URL.Scheme=core.Scheme
  r.URL.Host=core.Host
  r.Header.Del("X-Forwarded-For")
  r.Header.Del("X-Forwarded-Host")
  r.Header.Del("X-Forwarded-Proto")
  r.Header.Del("Forwarded")
  // A nil forwarded-for header tells ReverseProxy not to generate the header;
  // HA Core must not require a trusted-proxy override for a loopback tunnel.
  r.Header["X-Forwarded-For"]=nil
 }
 proxy.ErrorHandler=func(w http.ResponseWriter,r *http.Request,err error){
  w.Header().Set("Cache-Control","no-store")
  http.Error(w,"Home Assistant Core is starting or unavailable",http.StatusServiceUnavailable)
 }
 fs:=http.FileServer(http.Dir(staticRoot))
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("X-Content-Type-Options","nosniff")
  w.Header().Set("X-Frame-Options","DENY")
  w.Header().Set("Referrer-Policy","same-origin")
  w.Header().Set("Cache-Control","no-store")
  if r.URL.Path=="/healthz" {
   w.Header().Set("Content-Type","application/json")
   _,_=io.WriteString(w,`{"service":"stevora-native","status":"ready","backend_auth":"home-assistant-core"}`)
   return
  }
  if isCorePath(r.URL.Path){
   proxy.ServeHTTP(w,r)
   return
  }
  if r.Method!=http.MethodGet && r.Method!=http.MethodHead {http.Error(w,"Method not allowed",405);return}
  if r.URL.Path=="/recovery" {
    http.Redirect(w,r,"https://"+r.Host+"/auth/authorize",http.StatusTemporaryRedirect)
    return
  }
  file:=path.Clean("/"+r.URL.Path)
  if strings.HasSuffix(file,"/") || file=="/" {file="/index.html"}
  abs:=filepath.Join(staticRoot,filepath.FromSlash(strings.TrimPrefix(file,"/")))
  st,err:=os.Stat(abs)
  if err!=nil || st.IsDir() {
   if !strings.Contains(path.Base(file),".") {
    file="/index.html"
   } else {http.NotFound(w,r);return}
  }
  if file=="/index.html" {
   w.Header().Set("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' wss:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
   w.Header().Set("Content-Type","text/html; charset=utf-8")
   entry,err:=os.Open(filepath.Join(staticRoot,"index.html"))
   if err!=nil {http.NotFound(w,r);return}
   defer entry.Close()
   meta,err:=entry.Stat();if err!=nil {http.Error(w,"Unable to serve STEVORA",500);return}
   // FileServer redirects every /index.html to /. ServeContent prevents a
   // self-redirect loop when serving our root SPA and its nested routes.
   http.ServeContent(w,r,"stevora-root",meta.ModTime(),entry)
   return
  }
  if strings.HasSuffix(file,".js"){w.Header().Set("Content-Type","application/javascript; charset=utf-8")}
  clone:=r.Clone(r.Context());clone.URL.Path=file
  fs.ServeHTTP(w,clone)
 })
}

func isCorePath(p string) bool {
 // Narrow allowlist for official Core login, OAuth exchange, WebSockets and
 // frontend assets used by the official login screen. No arbitrary proxy.
 prefixes:=[]string{"/auth/","/api/","/frontend_latest/","/frontend_es5/","/stevora_static/","/onboarding/","/static/","/local/","/hacsfiles/"}
 for _,v:=range prefixes {if strings.HasPrefix(p,v){return true}}
 return p=="/onboarding.html" || p=="/stevora" || p=="/stevora/" || p=="/auth" || p=="/manifest.json" || p=="/service_worker.js"
}

func ensureCertificate(dir string)(string,string,error){
 certPath:=filepath.Join(dir,"server.crt")
 keyPath:=filepath.Join(dir,"server.key")
 if pair,err:=tls.LoadX509KeyPair(certPath,keyPath);err==nil && len(pair.Certificate)>0 {
  parsed,err:=x509.ParseCertificate(pair.Certificate[0])
  if err==nil && time.Until(parsed.NotAfter)>15*24*time.Hour && certCoversInterfaces(parsed){
   return certPath,keyPath,nil
  }
 }
 priv,err:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if err!=nil{return "","",err}
 serial,err:=rand.Int(rand.Reader,new(big.Int).Lsh(big.NewInt(1),128));if err!=nil{return "","",err}
 now:=time.Now()
 template:=&x509.Certificate{
  SerialNumber:serial,Subject:pkix.Name{CommonName:"STEVORA OS Local Test"},
  NotBefore:now.Add(-time.Hour),NotAfter:now.Add(365*24*time.Hour),
  KeyUsage:x509.KeyUsageDigitalSignature,ExtKeyUsage:[]x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
  DNSNames:[]string{"localhost","stevora.local","homeassistant.local"},
  IPAddresses:append([]net.IP{net.ParseIP("127.0.0.1"),net.ParseIP("::1")},interfaceIPs()...),
 }
 der,err:=x509.CreateCertificate(rand.Reader,template,template,&priv.PublicKey,priv)
 if err!=nil{return "","",err}
 encoded,err:=x509.MarshalECPrivateKey(priv);if err!=nil{return "","",err}
 if err=writeAtomic(certPath,pem.EncodeToMemory(&pem.Block{Type:"CERTIFICATE",Bytes:der}),0600);err!=nil{return "","",err}
 if err=writeAtomic(keyPath,pem.EncodeToMemory(&pem.Block{Type:"EC PRIVATE KEY",Bytes:encoded}),0600);err!=nil{return "","",err}
 return certPath,keyPath,nil
}

func writeAtomic(filename string,contents []byte,mode os.FileMode) error {
 file,err:=os.CreateTemp(filepath.Dir(filename),".stevora-tls-")
 if err!=nil{return err}
 defer os.Remove(file.Name())
 if err=file.Chmod(mode);err!=nil{file.Close();return err}
 if _,err=file.Write(contents);err!=nil{file.Close();return err}
 if err=file.Sync();err!=nil{file.Close();return err}
 if err=file.Close();err!=nil{return err}
 return os.Rename(file.Name(),filename)
}

func interfaceIPs() []net.IP {
 interfaces,err:=net.Interfaces();if err!=nil{return nil}
 seen:=map[string]bool{}
 var ips []net.IP
 for _,iface:=range interfaces{
  if iface.Flags&net.FlagUp==0 || iface.Flags&net.FlagLoopback!=0 {continue}
  addrs,_:=iface.Addrs()
  for _,addr:=range addrs{
   ip,_,err:=net.ParseCIDR(addr.String())
   if err==nil&&!seen[ip.String()]&&!ip.IsLoopback() {
    ips=append(ips,ip);seen[ip.String()]=true
   }
  }
 }
 return ips
}

func certCoversInterfaces(cert *x509.Certificate) bool {
 for _,ip:=range interfaceIPs(){
  found:=false
  for _,san:=range cert.IPAddresses{if ip.Equal(san){found=true;break}}
  if !found{return false}
 }
 return true
}
