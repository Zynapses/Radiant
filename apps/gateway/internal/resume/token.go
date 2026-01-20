package resume

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var (
	ErrTokenExpired   = errors.New("resume token expired")
	ErrTokenInvalid   = errors.New("resume token invalid signature")
	ErrTokenMalformed = errors.New("resume token malformed")
)

type TokenData struct {
	SessionID       string    `json:"sid"`
	TenantID        string    `json:"tid"`
	PrincipalID     string    `json:"pid"`
	PrincipalType   string    `json:"pty"`
	Protocol        string    `json:"pro"`
	ProtocolVersion string    `json:"pv"`
	InboxSubject    string    `json:"in"`
	OutboxSubject   string    `json:"out"`
	IssuedAt        time.Time `json:"iat"`
	ExpiresAt       time.Time `json:"exp"`
}

type Service struct {
	secret []byte
	ttl    time.Duration
}

func NewService(secret []byte, ttl time.Duration) *Service {
	return &Service{secret: secret, ttl: ttl}
}

func (s *Service) Generate(data TokenData) (string, time.Time) {
	data.IssuedAt = time.Now()
	data.ExpiresAt = data.IssuedAt.Add(s.ttl)

	jsonBytes, _ := json.Marshal(data)

	mac := hmac.New(sha256.New, s.secret)
	mac.Write(jsonBytes)
	sig := mac.Sum(nil)

	return base64.RawURLEncoding.EncodeToString(jsonBytes) + "." +
		base64.RawURLEncoding.EncodeToString(sig), data.ExpiresAt
}

func (s *Service) Validate(token string) (*TokenData, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, ErrTokenMalformed
	}

	jsonBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, ErrTokenMalformed
	}

	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrTokenMalformed
	}

	mac := hmac.New(sha256.New, s.secret)
	mac.Write(jsonBytes)
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return nil, ErrTokenInvalid
	}

	var data TokenData
	if err := json.Unmarshal(jsonBytes, &data); err != nil {
		return nil, ErrTokenMalformed
	}

	if time.Now().After(data.ExpiresAt) {
		return nil, ErrTokenExpired
	}

	return &data, nil
}
