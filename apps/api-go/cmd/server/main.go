package main

import (
	"log"
	"net/http"
	"os"

	"github.com/hrsign/hrsign/apps/api-go/internal/api"
)

func main() {
	addr := ":8080"
	if v := os.Getenv("PORT"); v != "" {
		addr = ":" + v
	}
	store := api.NewStore()
	log.Printf("HRSign Go API listening on %s (backend=%s version=%s)", addr, api.Backend, api.Version)
	log.Fatal(http.ListenAndServe(addr, withCORS(store.Routes())))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
