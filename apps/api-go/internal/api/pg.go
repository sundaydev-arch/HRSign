package api

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// PgStore is an optional Postgres-backed envelope reader/writer (shared Prisma schema).
type PgStore struct {
	db *sql.DB
}

func OpenPgStore() (*PgStore, error) {
	url := os.Getenv("HRSIGN_DATABASE_URL")
	if url == "" {
		url = os.Getenv("DATABASE_URL")
	}
	if url == "" {
		return nil, nil
	}
	db, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(8)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &PgStore{db: db}, nil
}

func (p *PgStore) ListEnvelopes(status string, limit int) ([]Envelope, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, "accountId", status::text, subject, "emailBlurb", "createdAt", "updatedAt" FROM envelopes`
	args := []any{}
	if status != "" {
		q += ` WHERE status = $1`
		args = append(args, status)
		q += ` ORDER BY "updatedAt" DESC LIMIT $2`
		args = append(args, limit)
	} else {
		q += ` ORDER BY "updatedAt" DESC LIMIT $1`
		args = append(args, limit)
	}
	rows, err := p.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Envelope
	for rows.Next() {
		var e Envelope
		var accountID, blurb sql.NullString
		var created, updated time.Time
		if err := rows.Scan(&e.ID, &accountID, &e.Status, &e.Subject, &blurb, &created, &updated); err != nil {
			return nil, err
		}
		if accountID.Valid {
			e.AccountID = &accountID.String
		}
		if blurb.Valid {
			e.EmailBlurb = &blurb.String
		}
		e.CreatedAt = created.UTC().Format(time.RFC3339)
		e.UpdatedAt = updated.UTC().Format(time.RFC3339)
		e.Documents = []Document{}
		e.Recipients = []Recipient{}
		e.Tabs = []Tab{}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (p *PgStore) GetEnvelope(id string) (*Envelope, error) {
	row := p.db.QueryRow(
		`SELECT id, "accountId", status::text, subject, "emailBlurb", "createdAt", "updatedAt" FROM envelopes WHERE id = $1`,
		id,
	)
	var e Envelope
	var accountID, blurb sql.NullString
	var created, updated time.Time
	if err := row.Scan(&e.ID, &accountID, &e.Status, &e.Subject, &blurb, &created, &updated); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if accountID.Valid {
		e.AccountID = &accountID.String
	}
	if blurb.Valid {
		e.EmailBlurb = &blurb.String
	}
	e.CreatedAt = created.UTC().Format(time.RFC3339)
	e.UpdatedAt = updated.UTC().Format(time.RFC3339)
	e.Documents = []Document{}
	e.Recipients = []Recipient{}
	e.Tabs = []Tab{}
	return &e, nil
}

func (p *PgStore) CreateEnvelope(subject string, accountID *string, createdBy string) (*Envelope, error) {
	id := newID("env_")
	_, err := p.db.Exec(
		`INSERT INTO envelopes (id, "accountId", status, subject, "createdBy", "createdAt", "updatedAt")
		 VALUES ($1, $2, 'created', $3, $4, NOW(), NOW())`,
		id, accountID, subject, createdBy,
	)
	if err != nil {
		return nil, fmt.Errorf("insert envelope: %w", err)
	}
	_, _ = p.db.Exec(
		`INSERT INTO envelope_documents (id, "envelopeId", name, "documentOrder", "pageCount", "createdAt")
		 VALUES ($1, $2, $3, 1, 1, NOW())`,
		newID("doc_"), id, "Document 1",
	)
	return p.GetEnvelope(id)
}
