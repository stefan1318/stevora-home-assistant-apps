package main

import (
 "net/http"
 "net/http/httptest"
 "net/url"
 "testing"
)

func TestUpdateRequiresAuthorizedAdministrator(t *testing.T){
 core:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/api/stevora/native/admin"{t.Fatal(r.URL.Path)}
  if r.Header.Get("Authorization")=="Bearer owner"{w.WriteHeader(204);return}
  w.WriteHeader(403)
 }))
 defer core.Close()
 address,_:=url.Parse(core.URL);update:=newUpdateHandler(address)
 for _,c:=range []struct{method,token string;status int}{{"GET","",401},{"POST","Bearer user",403},{"GET","Bearer owner",200},{"POST","Bearer owner",400}}{
  req:=httptest.NewRequest(c.method,"https://stevora.local/stevora-update",nil);req.Header.Set("Authorization",c.token)
  w:=httptest.NewRecorder();update.ServeHTTP(w,req);if w.Code!=c.status{t.Fatalf("%s got %d",c.method,w.Code)}
 }
}
