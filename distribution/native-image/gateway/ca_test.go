package main

import (
 "bytes"
 "crypto/tls"
 "crypto/x509"
 "testing"
)

func TestOptionalTLSUsesInstallationRoot(t *testing.T) {
 dir:=t.TempDir()
 leaf,key,err:=ensureCertificate(dir);if err!=nil{t.Fatal(err)}
 pair,err:=tls.LoadX509KeyPair(leaf,key);if err!=nil{t.Fatal(err)}
 cert,err:=x509.ParseCertificate(pair.Certificate[0]);if err!=nil{t.Fatal(err)}
 root,_,err:=installationCA(dir);if err!=nil{t.Fatal(err)}
 roots:=x509.NewCertPool();roots.AddCert(root)
 if _,err=cert.Verify(x509.VerifyOptions{Roots:roots,DNSName:"127.0.0.1"});err!=nil{t.Fatal(err)}
 other,_,err:=installationCA(t.TempDir());if err!=nil||bytes.Equal(other.Raw,root.Raw){t.Fatal("installations must not share a CA")}
}
