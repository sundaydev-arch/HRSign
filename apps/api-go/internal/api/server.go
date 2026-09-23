package api

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const Backend = "go"
const Version = "0.4.0"

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func now() string { return time.Now().UTC().Format(time.RFC3339) }

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code}})
}

func token() string {
	b := make([]byte, 18)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

type Tab struct {
	ID                 string         `json:"id"`
	TabType            string         `json:"tabType"`
	EnvelopeDocumentID *string        `json:"envelopeDocumentId"`
	RecipientID        *string        `json:"recipientId"`
	Coordinates        map[string]any `json:"coordinates"`
	Required           bool           `json:"required"`
	Value              *string        `json:"value"`
	Conditional        any            `json:"conditional"`
}

type Envelope struct {
	ID          string           `json:"id"`
	AccountID   *string          `json:"accountId"`
	Status      string           `json:"status"`
	Subject     string           `json:"subject"`
	EmailBlurb  *string          `json:"emailBlurb"`
	SentAt      *string          `json:"sentAt"`
	CompletedAt *string          `json:"completedAt"`
	VoidedAt    *string          `json:"voidedAt"`
	VoidReason  *string          `json:"voidReason"`
	ExpiresAt   *string          `json:"expiresAt"`
	Documents   []Document       `json:"documents"`
	Recipients  []Recipient      `json:"recipients"`
	Tabs        []Tab            `json:"tabs"`
	CreatedAt   string           `json:"createdAt"`
	UpdatedAt   string           `json:"updatedAt"`
	Comments    []Comment        `json:"-"`
	Events      []map[string]any `json:"-"`
}

type Document struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	DocumentOrder int     `json:"documentOrder"`
	StorageKey    *string `json:"storageKey"`
	SHA256        *string `json:"sha256"`
	PageCount     int     `json:"pageCount"`
	FileURL       *string `json:"fileUrl"`
}

type Recipient struct {
	ID              string  `json:"id"`
	RecipientType   string  `json:"recipientType"`
	RoutingOrder    int     `json:"routingOrder"`
	Name            string  `json:"name"`
	Email           string  `json:"email"`
	PhoneE164       *string `json:"phoneE164"`
	DeliveryChannel string  `json:"deliveryChannel"`
	IDVMethod       string  `json:"idvMethod"`
	IDVStatus       string  `json:"idvStatus"`
	Status          string  `json:"status"`
	UserID          *string `json:"userId"`
	SignedAt        *string `json:"signedAt"`
	DeclinedAt      *string `json:"declinedAt"`
	DeclineReason   *string `json:"declineReason"`
	AccessURL       *string `json:"accessUrl"`
	AccessToken     string  `json:"-"`
}

type Comment struct {
	ID         string  `json:"id"`
	Body       string  `json:"body"`
	AuthorName string  `json:"authorName"`
	DocumentID *string `json:"documentId"`
	Page       *int    `json:"page"`
	CreatedAt  string  `json:"createdAt"`
}

type Account struct {
	AccountID string           `json:"accountId"`
	Name      string           `json:"name"`
	Slug      string           `json:"slug"`
	Members   []map[string]any `json:"members"`
	Brands    []map[string]any `json:"brands"`
	CreatedAt string           `json:"createdAt"`
	UpdatedAt string           `json:"updatedAt"`
}

type ConnectConfig struct {
	ConfigurationID string   `json:"configurationId"`
	Name            string   `json:"name"`
	URL             string   `json:"url"`
	Events          []string `json:"events"`
	Enabled         bool     `json:"enabled"`
	Secret          string   `json:"-"`
	SecretPrefix    string   `json:"secretPrefix"`
	CreatedAt       string   `json:"createdAt"`
}

type Store struct {
	mu         sync.RWMutex
	envelopes  map[string]*Envelope
	powerForms []map[string]any
	clickwraps map[string]map[string]any
	rooms      map[string]map[string]any
	clm        map[string]map[string]any
	notary     map[string]map[string]any
	accounts   map[string]*Account
	connect    map[string]*ConnectConfig
}

func NewStore() *Store {
	t := now()
	return &Store{
		envelopes:  map[string]*Envelope{},
		powerForms: []map[string]any{},
		clickwraps: map[string]map[string]any{},
		rooms:      map[string]map[string]any{},
		clm:        map[string]map[string]any{},
		notary:     map[string]map[string]any{},
		connect:    map[string]*ConnectConfig{},
		accounts: map[string]*Account{
			"acct_default": {
				AccountID: "acct_default", Name: "Default", Slug: "default",
				Members: []map[string]any{}, Brands: []map[string]any{},
				CreatedAt: t, UpdatedAt: t,
			},
		},
	}
}

func (s *Store) addEvent(env *Envelope, action string, meta map[string]any) {
	env.Events = append(env.Events, map[string]any{
		"id": newID("evt_"), "action": action, "meta": meta, "createdAt": now(),
	})
}

func isTabVisible(tab Tab, all []Tab) bool {
	rule, ok := tab.Conditional.(map[string]any)
	if !ok || rule == nil {
		return true
	}
	showIf, ok := rule["showIf"].(map[string]any)
	if !ok {
		return true
	}
	tabID, _ := showIf["tabId"].(string)
	if tabID == "" {
		return true
	}
	var val string
	for _, t := range all {
		if t.ID == tabID {
			if t.Value != nil {
				val = *t.Value
			}
			break
		}
	}
	if notEmpty, _ := showIf["notEmpty"].(bool); notEmpty {
		return strings.TrimSpace(val) != ""
	}
	if eq, ok := showIf["equals"].(string); ok {
		return val == eq
	}
	return true
}

func filterVisibleTabs(tabs []Tab) []Tab {
	out := make([]Tab, 0, len(tabs))
	for _, t := range tabs {
		if isTabVisible(t, tabs) {
			out = append(out, t)
		}
	}
	return out
}

func (s *Store) dispatchConnect(event string, data map[string]any) {
	payload := map[string]any{"event": event, "timestamp": now(), "data": data}
	body, _ := json.Marshal(payload)
	for _, hook := range s.connect {
		if !hook.Enabled {
			continue
		}
		ok := false
		for _, e := range hook.Events {
			if e == event {
				ok = true
				break
			}
		}
		if !ok {
			continue
		}
		mac := hmac.New(sha256.New, []byte(hook.Secret))
		_, _ = mac.Write(body)
		sig := hex.EncodeToString(mac.Sum(nil))
		req, err := http.NewRequest(http.MethodPost, hook.URL, strings.NewReader(string(body)))
		if err != nil {
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-HRSign-Event", event)
		req.Header.Set("X-HRSign-Signature", "sha256="+sig)
		client := &http.Client{Timeout: 3 * time.Second}
		resp, err := client.Do(req)
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
		}
	}
}

func (s *Store) assertRecipientToken(env *Envelope, recipientID, raw string) (*Recipient, bool) {
	for i := range env.Recipients {
		rr := &env.Recipients[i]
		if rr.ID == recipientID && rr.AccessToken != "" && hmac.Equal([]byte(rr.AccessToken), []byte(raw)) {
			return rr, true
		}
	}
	return nil, false
}

func (s *Store) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /v1/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "backend": Backend, "version": Version})
	})

	mux.HandleFunc("GET /v1/tabs/types", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"types": []string{
			"signHere", "initialHere", "dateSigned", "text", "fullName", "emailAddress",
			"checkbox", "radioGroup", "formula", "attachment", "payment", "company", "title", "note",
		}})
	})

	mux.HandleFunc("GET /v1/identity/methods", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{
			"methods": []string{"email_otp", "sms_otp", "kba", "id_document", "face"},
			"plugins": []map[string]any{
				{"id": "email_otp", "status": "partial"},
				{"id": "sms_otp", "status": "partial"},
				{"id": "kba", "status": "stub"},
			},
		})
	})

	mux.HandleFunc("GET /v1/trust/providers", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"providers": []map[string]any{
			{"id": "IMAGE_SEAL", "kind": "visual", "status": "done"},
			{"id": "HANDWRITE", "kind": "visual", "status": "done"},
			{"id": "PADES", "kind": "cms_pkcs7", "status": "stub", "configured": false},
			{"id": "GM_SM2", "kind": "national_crypto", "status": "stub", "configured": false},
		}})
	})

	mux.HandleFunc("GET /v1/envelopes", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()
		list := make([]*Envelope, 0, len(s.envelopes))
		st := r.URL.Query().Get("status")
		for _, e := range s.envelopes {
			if st == "" || e.Status == st {
				list = append(list, e)
			}
		}
		writeJSON(w, 200, map[string]any{"envelopes": list})
	})

	mux.HandleFunc("POST /v1/envelopes", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Subject    string  `json:"subject"`
			EmailBlurb *string `json:"emailBlurb"`
			AccountID  *string `json:"accountId"`
			Documents  []struct {
				Name          string `json:"name"`
				DocumentOrder int    `json:"documentOrder"`
				PageCount     int    `json:"pageCount"`
			} `json:"documents"`
			Recipients []struct {
				RecipientType   string  `json:"recipientType"`
				RoutingOrder    int     `json:"routingOrder"`
				Name            string  `json:"name"`
				Email           string  `json:"email"`
				PhoneE164       *string `json:"phoneE164"`
				DeliveryChannel string  `json:"deliveryChannel"`
				IDVMethod       string  `json:"idvMethod"`
			} `json:"recipients"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Subject == "" {
			writeErr(w, 400, "ENVELOPE_SUBJECT_REQUIRED")
			return
		}
		id := newID("env_")
		acct := "acct_default"
		if body.AccountID != nil && *body.AccountID != "" {
			acct = *body.AccountID
		}
		docs := []Document{}
		if len(body.Documents) == 0 {
			docs = append(docs, Document{ID: newID("doc_"), Name: "Document 1", DocumentOrder: 1, PageCount: 1})
		} else {
			for i, d := range body.Documents {
				ord, pc := d.DocumentOrder, d.PageCount
				if ord == 0 {
					ord = i + 1
				}
				if pc == 0 {
					pc = 1
				}
				docs = append(docs, Document{ID: newID("doc_"), Name: d.Name, DocumentOrder: ord, PageCount: pc})
			}
		}
		recs := []Recipient{}
		for _, rr := range body.Recipients {
			rt := rr.RecipientType
			if rt == "" {
				rt = "signer"
			}
			st := "created"
			if rt == "cc" || rt == "carbonCopy" || rt == "certifiedDelivery" {
				st = "completed"
			}
			ch := rr.DeliveryChannel
			if ch == "" {
				ch = "email"
			}
			idv := rr.IDVMethod
			if idv == "" {
				idv = "none"
			}
			idvSt := "skipped"
			if idv != "none" {
				idvSt = "pending"
			}
			recs = append(recs, Recipient{
				ID: newID("rec_"), RecipientType: rt, RoutingOrder: rr.RoutingOrder,
				Name: rr.Name, Email: rr.Email, PhoneE164: rr.PhoneE164,
				DeliveryChannel: ch, IDVMethod: idv, IDVStatus: idvSt, Status: st,
			})
		}
		env := &Envelope{
			ID: id, AccountID: &acct, Status: "created", Subject: body.Subject, EmailBlurb: body.EmailBlurb,
			Documents: docs, Recipients: recs, Tabs: []Tab{}, CreatedAt: now(), UpdatedAt: now(),
		}
		s.mu.Lock()
		s.envelopes[id] = env
		s.addEvent(env, "created", nil)
		s.mu.Unlock()
		writeJSON(w, 201, env)
	})

	mux.HandleFunc("GET /v1/envelopes/{id}", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		env := s.envelopes[r.PathValue("id")]
		s.mu.RUnlock()
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		writeJSON(w, 200, env)
	})

	mux.HandleFunc("POST /v1/envelopes/{id}/send", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		s.mu.Lock()
		defer s.mu.Unlock()
		env := s.envelopes[id]
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		if env.Status != "created" {
			writeErr(w, 409, "ENVELOPE_INVALID_STATE")
			return
		}
		if len(env.Recipients) == 0 {
			writeErr(w, 400, "ENVELOPE_NO_RECIPIENTS")
			return
		}
		if len(env.Documents) == 0 {
			writeErr(w, 400, "ENVELOPE_NO_DOCUMENTS")
			return
		}
		for i := range env.Recipients {
			rr := &env.Recipients[i]
			if rr.RecipientType == "cc" || rr.RecipientType == "carbonCopy" || rr.RecipientType == "certifiedDelivery" {
				rr.Status = "completed"
				continue
			}
			tok := token()
			rr.AccessToken = tok
			u := "/sign/envelope/" + id + "?r=" + rr.ID + "&t=" + tok
			rr.Status = "sent"
			rr.AccessURL = &u
		}
		if len(env.Tabs) == 0 && len(env.Documents) > 0 {
			docID := env.Documents[0].ID
			for i, rr := range env.Recipients {
				if rr.RecipientType == "cc" || rr.RecipientType == "carbonCopy" || rr.RecipientType == "certifiedDelivery" {
					continue
				}
				rid := rr.ID
				env.Tabs = append(env.Tabs, Tab{
					ID: newID("tab_"), TabType: "signHere", EnvelopeDocumentID: &docID, RecipientID: &rid,
					Coordinates: map[string]any{"page": 1, "x": 72, "y": 120 + i*60, "width": 160, "height": 48},
					Required:    true,
				})
			}
		}
		t := now()
		env.Status = "sent"
		env.SentAt = &t
		env.UpdatedAt = t
		s.addEvent(env, "sent", nil)
		s.dispatchConnect("envelope.sent", map[string]any{"envelopeId": id, "subject": env.Subject})
		writeJSON(w, 200, env)
	})

	mux.HandleFunc("POST /v1/envelopes/{id}/void", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Reason string `json:"reason"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Reason == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		env := s.envelopes[r.PathValue("id")]
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		t := now()
		env.Status = "voided"
		env.VoidedAt = &t
		env.VoidReason = &body.Reason
		env.UpdatedAt = t
		s.addEvent(env, "voided", map[string]any{"reason": body.Reason})
		s.dispatchConnect("envelope.voided", map[string]any{"envelopeId": env.ID, "reason": body.Reason})
		writeJSON(w, 200, env)
	})

	mux.HandleFunc("GET /v1/envelopes/{id}/tabs", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		env := s.envelopes[r.PathValue("id")]
		s.mu.RUnlock()
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		writeJSON(w, 200, map[string]any{"tabs": env.Tabs})
	})

	mux.HandleFunc("PUT /v1/envelopes/{id}/tabs", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Tabs []struct {
				TabType            string         `json:"tabType"`
				EnvelopeDocumentID *string        `json:"envelopeDocumentId"`
				RecipientID        *string        `json:"recipientId"`
				Coordinates        map[string]any `json:"coordinates"`
				Required           *bool          `json:"required"`
				Value              *string        `json:"value"`
				Conditional        any            `json:"conditional"`
			} `json:"tabs"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		s.mu.Lock()
		defer s.mu.Unlock()
		env := s.envelopes[r.PathValue("id")]
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		if env.Status != "created" {
			writeErr(w, 409, "ENVELOPE_INVALID_STATE")
			return
		}
		tabs := []Tab{}
		for _, t := range body.Tabs {
			req := true
			if t.Required != nil {
				req = *t.Required
			}
			tt := t.TabType
			if tt == "" {
				tt = "signHere"
			}
			coords := t.Coordinates
			if coords == nil {
				coords = map[string]any{"page": 1, "x": 72, "y": 72, "width": 160, "height": 40}
			}
			var docID *string
			if t.EnvelopeDocumentID != nil {
				docID = t.EnvelopeDocumentID
			} else if len(env.Documents) > 0 {
				d := env.Documents[0].ID
				docID = &d
			}
			tabs = append(tabs, Tab{
				ID: newID("tab_"), TabType: tt, EnvelopeDocumentID: docID, RecipientID: t.RecipientID,
				Coordinates: coords, Required: req, Value: t.Value, Conditional: t.Conditional,
			})
		}
		env.Tabs = tabs
		env.UpdatedAt = now()
		writeJSON(w, 200, map[string]any{"tabs": tabs})
	})

	mux.HandleFunc("POST /v1/envelopes/{id}/recipients/{rid}/sign", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		rid := r.PathValue("rid")
		s.mu.Lock()
		defer s.mu.Unlock()
		env := s.envelopes[id]
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		if env.Status != "sent" && env.Status != "delivered" && env.Status != "signed" {
			writeErr(w, 409, "ENVELOPE_INVALID_STATE")
			return
		}
		var rec *Recipient
		for i := range env.Recipients {
			if env.Recipients[i].ID == rid {
				rec = &env.Recipients[i]
				break
			}
		}
		if rec == nil {
			writeErr(w, 404, "RECIPIENT_NOT_FOUND")
			return
		}
		if rec.RecipientType == "cc" || rec.RecipientType == "carbonCopy" {
			writeErr(w, 400, "RECIPIENT_CC_NO_SIGN")
			return
		}
		if rec.Status == "signed" || rec.Status == "completed" {
			writeErr(w, 409, "RECIPIENT_ALREADY_SIGNED")
			return
		}
		if rec.IDVMethod != "none" && rec.IDVStatus != "verified" {
			writeErr(w, 403, "IDV_REQUIRED")
			return
		}
		t := now()
		rec.Status = "signed"
		rec.SignedAt = &t
		s.dispatchConnect("recipient.completed", map[string]any{"envelopeId": id, "recipientId": rid})
		allDone := true
		for _, rr := range env.Recipients {
			if rr.RecipientType == "signer" || rr.RecipientType == "inPersonSigner" || rr.RecipientType == "editor" || rr.RecipientType == "witness" || rr.RecipientType == "notary" {
				if rr.Status != "signed" && rr.Status != "completed" && rr.Status != "declined" {
					allDone = false
				}
			}
		}
		if allDone {
			env.Status = "completed"
			env.CompletedAt = &t
			s.addEvent(env, "completed", nil)
			s.dispatchConnect("envelope.completed", map[string]any{"envelopeId": id})
		} else if env.Status == "sent" {
			env.Status = "delivered"
		} else {
			env.Status = "signed"
		}
		env.UpdatedAt = t
		writeJSON(w, 200, env)
	})

	mux.HandleFunc("GET /v1/envelopes/{id}/certificate", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		env := s.envelopes[r.PathValue("id")]
		s.mu.RUnlock()
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		if env.Status != "completed" {
			writeErr(w, 409, "ENVELOPE_NOT_COMPLETED")
			return
		}
		writeJSON(w, 200, map[string]any{
			"envelopeId": env.ID, "status": env.Status, "subject": env.Subject, "completedAt": env.CompletedAt,
			"recipients": env.Recipients, "documents": env.Documents,
		})
	})

	mux.HandleFunc("GET /v1/envelopes/{id}/evidence", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		env := s.envelopes[r.PathValue("id")]
		s.mu.RUnlock()
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		if env.Status != "completed" {
			writeErr(w, 409, "ENVELOPE_NOT_COMPLETED")
			return
		}
		pack := map[string]any{
			"format": "hrsign.evidence.v1", "generatedAt": now(),
			"envelope": map[string]any{
				"id": env.ID, "accountId": env.AccountID, "subject": env.Subject,
				"status": env.Status, "sentAt": env.SentAt, "completedAt": env.CompletedAt,
			},
			"documents": env.Documents, "recipients": env.Recipients, "tabs": env.Tabs,
			"timeline": env.Events,
			"trust":    map[string]any{"signatureProviders": []string{"IMAGE_SEAL", "HANDWRITE", "PADES", "GM_SM2"}},
		}
		raw, _ := json.Marshal(pack)
		sum := sha256.Sum256(raw)
		pack["integrity"] = map[string]string{"sha256": hex.EncodeToString(sum[:]), "algorithm": "sha256"}
		if r.URL.Query().Get("download") == "1" {
			w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="evidence-%s.json"`, env.ID))
		}
		writeJSON(w, 200, pack)
	})

	mux.HandleFunc("GET /v1/envelopes/{id}/comments", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		env := s.envelopes[r.PathValue("id")]
		s.mu.RUnlock()
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		writeJSON(w, 200, map[string]any{"comments": env.Comments})
	})

	mux.HandleFunc("POST /v1/envelopes/{id}/comments", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Body string `json:"body"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Body == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		env := s.envelopes[r.PathValue("id")]
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		c := Comment{ID: newID("cmt_"), Body: body.Body, AuthorName: "api", CreatedAt: now()}
		env.Comments = append(env.Comments, c)
		writeJSON(w, 201, c)
	})

	mux.HandleFunc("POST /v1/envelopes/{id}/views/recipient", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			RecipientID string `json:"recipientId"`
			ReturnURL   string `json:"returnUrl"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.RecipientID == "" || body.ReturnURL == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		id := r.PathValue("id")
		s.mu.Lock()
		defer s.mu.Unlock()
		env := s.envelopes[id]
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		var rec *Recipient
		for i := range env.Recipients {
			if env.Recipients[i].ID == body.RecipientID {
				rec = &env.Recipients[i]
				break
			}
		}
		if rec == nil {
			writeErr(w, 404, "RECIPIENT_NOT_FOUND")
			return
		}
		tok := token()
		rec.AccessToken = tok
		writeJSON(w, 201, map[string]any{
			"url":       strings.TrimRight(body.ReturnURL, "/") + "/sign/envelope/" + id + "?r=" + body.RecipientID + "&t=" + tok + "&embed=" + tok,
			"expiresAt": now(),
		})
	})

	mux.HandleFunc("GET /v1/sign/envelope/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		rid := r.URL.Query().Get("r")
		raw := r.URL.Query().Get("t")
		if raw == "" {
			raw = r.URL.Query().Get("embed")
		}
		if rid == "" || raw == "" {
			writeErr(w, 401, "SIGN_LINK_INVALID")
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		env := s.envelopes[id]
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		rec, ok := s.assertRecipientToken(env, rid, raw)
		if !ok {
			writeErr(w, 401, "SIGN_LINK_INVALID")
			return
		}
		if rec.Status == "sent" {
			rec.Status = "delivered"
			if env.Status == "sent" {
				env.Status = "delivered"
				env.UpdatedAt = now()
			}
			s.addEvent(env, "recipient_viewed", map[string]any{"recipientId": rid})
		}
		myTabs := []Tab{}
		for _, tab := range env.Tabs {
			if tab.RecipientID == nil || *tab.RecipientID == rid {
				myTabs = append(myTabs, tab)
			}
		}
		visible := filterVisibleTabs(myTabs)
		idvRequired := rec.IDVMethod != "none" && rec.IDVStatus != "verified"
		writeJSON(w, 200, map[string]any{
			"envelope": map[string]any{
				"id": env.ID, "subject": env.Subject, "status": env.Status,
				"emailBlurb": env.EmailBlurb, "documents": env.Documents,
			},
			"recipient": map[string]any{
				"id": rec.ID, "name": rec.Name, "email": rec.Email, "status": rec.Status,
				"recipientType": rec.RecipientType, "phoneE164": rec.PhoneE164,
				"idvMethod": rec.IDVMethod, "idvStatus": rec.IDVStatus, "deliveryChannel": rec.DeliveryChannel,
			},
			"tabs":        visible,
			"idvRequired": idvRequired,
		})
	})

	mux.HandleFunc("POST /v1/sign/envelope/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			RecipientID          string            `json:"recipientId"`
			Token                string            `json:"token"`
			TabValues            map[string]string `json:"tabValues"`
			SignatureImageBase64 string            `json:"signatureImageBase64"`
			Decline              bool              `json:"decline"`
			DeclineReason        string            `json:"declineReason"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.RecipientID == "" || body.Token == "" {
			writeErr(w, 401, "SIGN_LINK_INVALID")
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		env := s.envelopes[id]
		if env == nil {
			writeErr(w, 404, "ENVELOPE_NOT_FOUND")
			return
		}
		rec, ok := s.assertRecipientToken(env, body.RecipientID, body.Token)
		if !ok {
			writeErr(w, 401, "SIGN_LINK_INVALID")
			return
		}
		if body.Decline {
			t := now()
			rec.Status = "declined"
			rec.DeclinedAt = &t
			if body.DeclineReason != "" {
				rec.DeclineReason = &body.DeclineReason
			}
			env.Status = "declined"
			env.UpdatedAt = t
			s.addEvent(env, "recipient_declined", map[string]any{"recipientId": body.RecipientID})
			s.dispatchConnect("envelope.declined", map[string]any{"envelopeId": id, "recipientId": body.RecipientID})
			writeJSON(w, 200, env)
			return
		}
		if body.TabValues != nil {
			for i := range env.Tabs {
				tab := &env.Tabs[i]
				if v, ok := body.TabValues[tab.ID]; ok && tab.RecipientID != nil && *tab.RecipientID == body.RecipientID {
					if isTabVisible(*tab, env.Tabs) {
						val := v
						tab.Value = &val
					}
				}
			}
		}
		t := now()
		rec.Status = "signed"
		rec.SignedAt = &t
		s.dispatchConnect("recipient.completed", map[string]any{"envelopeId": id, "recipientId": body.RecipientID})
		allDone := true
		for _, rr := range env.Recipients {
			if rr.RecipientType == "signer" || rr.RecipientType == "inPersonSigner" || rr.RecipientType == "editor" || rr.RecipientType == "witness" || rr.RecipientType == "notary" {
				if rr.Status != "signed" && rr.Status != "completed" && rr.Status != "declined" {
					allDone = false
				}
			}
		}
		if allDone {
			env.Status = "completed"
			env.CompletedAt = &t
			s.addEvent(env, "completed", nil)
			s.dispatchConnect("envelope.completed", map[string]any{"envelopeId": id})
		} else if env.Status == "sent" {
			env.Status = "delivered"
		} else {
			env.Status = "signed"
		}
		env.UpdatedAt = t
		writeJSON(w, 200, env)
	})

	mux.HandleFunc("GET /v1/connect/configurations", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()
		list := make([]*ConnectConfig, 0, len(s.connect))
		for _, c := range s.connect {
			list = append(list, c)
		}
		writeJSON(w, 200, map[string]any{"configurations": list})
	})
	mux.HandleFunc("POST /v1/connect/configurations", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name    string   `json:"name"`
			URL     string   `json:"url"`
			Events  []string `json:"events"`
			Enabled *bool    `json:"enabled"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Name == "" || body.URL == "" || len(body.Events) == 0 {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		secret := "whsec_" + token()
		enabled := true
		if body.Enabled != nil {
			enabled = *body.Enabled
		}
		id := newID("conn_")
		cfg := &ConnectConfig{
			ConfigurationID: id, Name: body.Name, URL: body.URL, Events: body.Events,
			Enabled: enabled, Secret: secret, SecretPrefix: secret[:12], CreatedAt: now(),
		}
		s.mu.Lock()
		s.connect[id] = cfg
		s.mu.Unlock()
		writeJSON(w, 201, map[string]any{
			"configurationId": id, "name": cfg.Name, "url": cfg.URL, "events": cfg.Events,
			"enabled": cfg.Enabled, "secretPrefix": cfg.SecretPrefix, "secret": secret, "createdAt": cfg.CreatedAt,
		})
	})
	mux.HandleFunc("GET /v1/connect/configurations/{id}", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		cfg := s.connect[r.PathValue("id")]
		s.mu.RUnlock()
		if cfg == nil {
			writeErr(w, 404, "CONNECT_NOT_FOUND")
			return
		}
		writeJSON(w, 200, cfg)
	})
	mux.HandleFunc("DELETE /v1/connect/configurations/{id}", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		if _, ok := s.connect[r.PathValue("id")]; !ok {
			writeErr(w, 404, "CONNECT_NOT_FOUND")
			return
		}
		delete(s.connect, r.PathValue("id"))
		w.WriteHeader(204)
	})

	// PowerForms
	mux.HandleFunc("GET /v1/powerforms", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()
		writeJSON(w, 200, map[string]any{"powerForms": s.powerForms})
	})
	mux.HandleFunc("POST /v1/powerforms", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name       string `json:"name"`
			TemplateID string `json:"templateId"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Name == "" || body.TemplateID == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		slug := newID("pf-")
		row := map[string]any{
			"id": newID("pf_"), "name": body.Name, "templateId": body.TemplateID,
			"url": "/powerforms/" + slug, "urlSlug": slug,
		}
		s.mu.Lock()
		s.powerForms = append(s.powerForms, row)
		s.mu.Unlock()
		writeJSON(w, 201, row)
	})

	mux.HandleFunc("POST /v1/bulk_send_batches", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 201, map[string]any{"batchId": newID("bulk_"), "accepted": 0, "status": "queued"})
	})

	// Accounts
	mux.HandleFunc("GET /v1/accounts", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()
		list := make([]*Account, 0, len(s.accounts))
		for _, a := range s.accounts {
			list = append(list, a)
		}
		writeJSON(w, 200, map[string]any{"accounts": list})
	})
	mux.HandleFunc("POST /v1/accounts", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
			Slug string `json:"slug"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Name == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		slug := body.Slug
		if slug == "" {
			slug = newID("acct-")
		}
		id := newID("acct_")
		t := now()
		a := &Account{AccountID: id, Name: body.Name, Slug: slug, Members: []map[string]any{}, Brands: []map[string]any{}, CreatedAt: t, UpdatedAt: t}
		s.mu.Lock()
		s.accounts[id] = a
		s.mu.Unlock()
		writeJSON(w, 201, a)
	})
	mux.HandleFunc("GET /v1/accounts/{id}", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		a := s.accounts[r.PathValue("id")]
		s.mu.RUnlock()
		if a == nil {
			writeErr(w, 404, "ACCOUNT_NOT_FOUND")
			return
		}
		writeJSON(w, 200, a)
	})
	mux.HandleFunc("GET /v1/accounts/{id}/members", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		a := s.accounts[r.PathValue("id")]
		s.mu.RUnlock()
		if a == nil {
			writeErr(w, 404, "ACCOUNT_NOT_FOUND")
			return
		}
		writeJSON(w, 200, map[string]any{"members": a.Members})
	})
	mux.HandleFunc("POST /v1/accounts/{id}/members", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Email string `json:"email"`
			Role  string `json:"role"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Email == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		role := body.Role
		if role == "" {
			role = "sender"
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		a := s.accounts[r.PathValue("id")]
		if a == nil {
			writeErr(w, 404, "ACCOUNT_NOT_FOUND")
			return
		}
		m := map[string]any{"memberId": newID("mem_"), "email": body.Email, "role": role}
		a.Members = append(a.Members, m)
		writeJSON(w, 201, m)
	})
	mux.HandleFunc("GET /v1/accounts/{id}/brands", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		a := s.accounts[r.PathValue("id")]
		s.mu.RUnlock()
		if a == nil {
			writeErr(w, 404, "ACCOUNT_NOT_FOUND")
			return
		}
		writeJSON(w, 200, map[string]any{"brands": a.Brands})
	})
	mux.HandleFunc("POST /v1/accounts/{id}/brands", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			BrandName    string `json:"brandName"`
			PrimaryColor string `json:"primaryColor"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.BrandName == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		color := body.PrimaryColor
		if color == "" {
			color = "#1a1a1a"
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		a := s.accounts[r.PathValue("id")]
		if a == nil {
			writeErr(w, 404, "ACCOUNT_NOT_FOUND")
			return
		}
		b := map[string]any{"brandId": newID("br_"), "brandName": body.BrandName, "primaryColor": color}
		a.Brands = append(a.Brands, b)
		writeJSON(w, 201, b)
	})

	// Clickwrap
	mux.HandleFunc("GET /v1/clickwraps", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()
		list := []map[string]any{}
		for _, c := range s.clickwraps {
			acc, _ := c["acceptances"].([]map[string]any)
			list = append(list, map[string]any{
				"clickwrapId": c["id"], "name": c["name"], "displayName": c["displayName"],
				"status": c["status"], "version": c["version"], "acceptanceCount": len(acc),
			})
		}
		writeJSON(w, 200, map[string]any{"clickwraps": list})
	})
	mux.HandleFunc("POST /v1/clickwraps", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name     string `json:"name"`
			BodyHTML string `json:"bodyHtml"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Name == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		id := newID("cw_")
		html := body.BodyHTML
		if html == "" {
			html = "<p>I agree.</p>"
		}
		row := map[string]any{
			"id": id, "name": body.Name, "displayName": body.Name, "status": "active",
			"bodyHtml": html, "version": 1, "acceptances": []map[string]any{},
		}
		s.mu.Lock()
		s.clickwraps[id] = row
		s.mu.Unlock()
		writeJSON(w, 201, map[string]any{
			"clickwrapId": id, "name": body.Name, "displayName": body.Name, "status": "active", "version": 1, "bodyHtml": html,
		})
	})
	mux.HandleFunc("POST /v1/clickwraps/{id}/accept", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			AcceptorEmail string `json:"acceptorEmail"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.AcceptorEmail == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		cw := s.clickwraps[r.PathValue("id")]
		if cw == nil || cw["status"] != "active" {
			writeErr(w, 404, "CLICKWRAP_NOT_FOUND")
			return
		}
		sum := sha256.Sum256([]byte(fmt.Sprintf("%v:%v:%v", cw["id"], cw["version"], cw["bodyHtml"])))
		acc := map[string]any{
			"acceptanceId": newID("acc_"), "clickwrapId": cw["id"], "version": cw["version"],
			"documentHash": hex.EncodeToString(sum[:]), "acceptedAt": now(),
		}
		list, _ := cw["acceptances"].([]map[string]any)
		cw["acceptances"] = append(list, acc)
		writeJSON(w, 201, acc)
	})

	mux.HandleFunc("GET /v1/rooms", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()
		list := []map[string]any{}
		for _, x := range s.rooms {
			list = append(list, x)
		}
		writeJSON(w, 200, map[string]any{"rooms": list})
	})
	mux.HandleFunc("POST /v1/rooms", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Name == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		id := newID("room_")
		row := map[string]any{
			"roomId": id, "name": body.Name, "status": "active", "description": body.Description,
			"members": []any{}, "documents": []any{}, "createdAt": now(), "updatedAt": now(),
		}
		s.mu.Lock()
		s.rooms[id] = row
		s.mu.Unlock()
		writeJSON(w, 201, row)
	})

	mux.HandleFunc("GET /v1/clm/agreements", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()
		list := []map[string]any{}
		for _, x := range s.clm {
			list = append(list, x)
		}
		writeJSON(w, 200, map[string]any{"agreements": list})
	})
	mux.HandleFunc("POST /v1/clm/agreements", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name         string `json:"name"`
			Counterparty string `json:"counterparty"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Name == "" {
			writeErr(w, 400, "VALIDATION_FAILED")
			return
		}
		id := newID("clm_")
		row := map[string]any{
			"agreementId": id, "name": body.Name, "status": "draft", "counterparty": body.Counterparty,
			"createdAt": now(), "updatedAt": now(),
		}
		s.mu.Lock()
		s.clm[id] = row
		s.mu.Unlock()
		writeJSON(w, 201, row)
	})
	mux.HandleFunc("PATCH /v1/clm/agreements/{id}", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Status string `json:"status"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		s.mu.Lock()
		defer s.mu.Unlock()
		row := s.clm[r.PathValue("id")]
		if row == nil {
			writeErr(w, 404, "CLM_AGREEMENT_NOT_FOUND")
			return
		}
		if body.Status != "" {
			row["status"] = body.Status
		}
		row["updatedAt"] = now()
		writeJSON(w, 200, row)
	})

	mux.HandleFunc("GET /v1/notary/transactions", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		defer s.mu.RUnlock()
		list := []map[string]any{}
		for _, x := range s.notary {
			list = append(list, x)
		}
		writeJSON(w, 200, map[string]any{"transactions": list})
	})
	mux.HandleFunc("POST /v1/notary/transactions", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			NotaryName   string `json:"notaryName"`
			Jurisdiction string `json:"jurisdiction"`
			EnvelopeID   string `json:"envelopeId"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		id := newID("not_")
		row := map[string]any{
			"transactionId": id, "status": "created", "notaryName": body.NotaryName,
			"jurisdiction": body.Jurisdiction, "envelopeId": body.EnvelopeID,
			"createdAt": now(), "updatedAt": now(),
		}
		s.mu.Lock()
		s.notary[id] = row
		s.mu.Unlock()
		writeJSON(w, 201, row)
	})
	mux.HandleFunc("PATCH /v1/notary/transactions/{id}", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Status string `json:"status"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		s.mu.Lock()
		defer s.mu.Unlock()
		row := s.notary[r.PathValue("id")]
		if row == nil {
			writeErr(w, 404, "NOTARY_TX_NOT_FOUND")
			return
		}
		if body.Status != "" {
			row["status"] = body.Status
			if body.Status == "completed" {
				row["completedAt"] = now()
			}
		}
		row["updatedAt"] = now()
		writeJSON(w, 200, row)
	})

	return mux
}
