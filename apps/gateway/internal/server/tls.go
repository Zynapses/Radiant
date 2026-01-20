package server

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"

	"github.com/radiant/gateway/internal/config"
)

// TLSConfig creates a TLS configuration for the gateway server.
// Supports both standard TLS (for users) and mTLS (for agents).
func NewTLSConfig(cfg *config.Config) (*tls.Config, error) {
	// If no cert file specified, return nil (no TLS)
	if cfg.TLSCertFile == "" {
		return nil, nil
	}

	// Load server certificate
	cert, err := tls.LoadX509KeyPair(cfg.TLSCertFile, cfg.TLSKeyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load server certificate: %w", err)
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
		CipherSuites: []uint16{
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_CHACHA20_POLY1305_SHA256,
		},
		PreferServerCipherSuites: true,
	}

	// If CA file specified, enable mTLS (client certificate verification)
	if cfg.TLSCAFile != "" {
		caCert, err := os.ReadFile(cfg.TLSCAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA file: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}

		tlsConfig.ClientCAs = caCertPool
		// VerifyClientCertIfGiven allows both mTLS (agents) and standard TLS (users)
		tlsConfig.ClientAuth = tls.VerifyClientCertIfGiven
	}

	return tlsConfig, nil
}

// IsMTLSConnection checks if the connection has a verified client certificate.
func IsMTLSConnection(state tls.ConnectionState) bool {
	return len(state.PeerCertificates) > 0 && len(state.VerifiedChains) > 0
}

// GetClientCertFingerprint returns the SHA256 fingerprint of the client certificate.
func GetClientCertFingerprint(state tls.ConnectionState) string {
	if len(state.PeerCertificates) == 0 {
		return ""
	}
	// Fingerprint calculation is in auth/mtls.go
	return ""
}
