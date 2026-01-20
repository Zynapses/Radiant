package auth

import (
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"regexp"
	"time"
)

var cnPattern = regexp.MustCompile(`^([a-zA-Z0-9-]+)\.([a-zA-Z0-9-]+)\.radiant\.ai$`)

type MTLSIdentity struct {
	AgentID     string
	TenantID    string
	Fingerprint string
	ExpiresAt   time.Time
}

func ExtractMTLS(conn *tls.Conn) (*MTLSIdentity, error) {
	state := conn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		return nil, errors.New("no client certificate")
	}

	cert := state.PeerCertificates[0]
	if time.Now().After(cert.NotAfter) {
		return nil, errors.New("certificate expired")
	}

	matches := cnPattern.FindStringSubmatch(cert.Subject.CommonName)
	if matches == nil {
		return nil, errors.New("invalid CN format")
	}

	hash := sha256.Sum256(cert.Raw)

	return &MTLSIdentity{
		AgentID:     matches[1],
		TenantID:    matches[2],
		Fingerprint: hex.EncodeToString(hash[:]),
		ExpiresAt:   cert.NotAfter,
	}, nil
}
