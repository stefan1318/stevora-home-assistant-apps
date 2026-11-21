package main

import (
 "crypto/ecdsa"
 "crypto/elliptic"
 "crypto/rand"
 "crypto/sha256"
 "crypto/tls"
 "crypto/x509"
 "crypto/x509/pkix"
 "encoding/pem"
 "errors"
 "fmt"
 "math/big"
 "net/http"
 "os"
 "path/filepath"
 "time"
)

// The private signing identity lives only on this installation's data partition.
func installationCA(dir string) (*x509.Certificate, *ecdsa.PrivateKey, error) {
 file := filepath.Join(dir,"installation-ca.pem")
 stored, err := os.ReadFile(file)
 if err == nil {
  ca, err := tls.X509KeyPair(stored, stored)
  if err != nil { return nil,nil,err }
  parsed,err := x509.ParseCertificate(ca.Certificate[0])
  key,ok := ca.PrivateKey.(*ecdsa.PrivateKey)
  if err != nil || !ok || !parsed.IsCA { return nil,nil,errors.New("invalid installation CA") }
  return parsed,key,nil
 }
 if !os.IsNotExist(err) {return nil,nil,err}
 key,err := ecdsa.GenerateKey(elliptic.P256(),rand.Reader); if err!=nil{return nil,nil,err}
 serial,err:=rand.Int(rand.Reader,new(big.Int).Lsh(big.NewInt(1),128));if err!=nil{return nil,nil,err}
 now:=time.Now()
 ca:= &x509.Certificate{SerialNumber:serial, Subject:pkix.Name{CommonName:"STEVORA Local CA "+serial.Text(16)},
  NotBefore:now.Add(-time.Hour),NotAfter:now.AddDate(10,0,0),IsCA:true,
  BasicConstraintsValid:true,MaxPathLenZero:true,KeyUsage:x509.KeyUsageCertSign|x509.KeyUsageCRLSign}
 cert,err:=x509.CreateCertificate(rand.Reader,ca,ca,&key.PublicKey,key);if err!=nil{return nil,nil,err}
 secret,err:=x509.MarshalECPrivateKey(key);if err!=nil{return nil,nil,err}
 identity:=append(pem.EncodeToMemory(&pem.Block{Type:"CERTIFICATE",Bytes:cert}),pem.EncodeToMemory(&pem.Block{Type:"EC PRIVATE KEY",Bytes:secret})...)
 if err=writeAtomic(file,identity,0600);err!=nil{return nil,nil,err}
 parsed,err:=x509.ParseCertificate(cert)
 return parsed,key,err
}

func publicCA(cert *x509.Certificate) http.HandlerFunc {
 return func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET" && r.Method!="HEAD"{http.Error(w,"Method not allowed",405);return}
  w.Header().Set("Content-Disposition",`attachment; filename="stevora-local-ca.cer"`)
  w.Header().Set("Content-Type","application/x-x509-ca-cert")
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("X-STEVORA-SHA256",fmt.Sprintf("%X",sha256.Sum256(cert.Raw)))
  if r.Method=="GET"{w.Write(cert.Raw)}
 }
}
