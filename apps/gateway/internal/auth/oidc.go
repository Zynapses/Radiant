package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type OIDCIdentity struct {
	Subject   string
	TenantID  string
	Email     string
	Scopes    []string
	ExpiresAt time.Time
}

type OIDCValidator struct {
	issuer   string
	audience string
	// Add JWKS cache in production
}

func NewOIDCValidator(issuer, audience string) *OIDCValidator {
	return &OIDCValidator{issuer: issuer, audience: audience}
}

func (v *OIDCValidator) Validate(ctx context.Context, authHeader string) (*OIDCIdentity, error) {
	if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return nil, errors.New("invalid authorization header")
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	tokenStr = strings.TrimPrefix(tokenStr, "bearer ")

	// In production: validate signature with JWKS
	token, _, err := jwt.NewParser().ParseUnverified(tokenStr, jwt.MapClaims{})
	if err != nil {
		return nil, err
	}

	claims := token.Claims.(jwt.MapClaims)

	sub, _ := claims["sub"].(string)
	tenantID, _ := claims["tenant_id"].(string)
	email, _ := claims["email"].(string)
	scope, _ := claims["scope"].(string)
	exp, _ := claims["exp"].(float64)

	return &OIDCIdentity{
		Subject:   sub,
		TenantID:  tenantID,
		Email:     email,
		Scopes:    strings.Split(scope, " "),
		ExpiresAt: time.Unix(int64(exp), 0),
	}, nil
}
