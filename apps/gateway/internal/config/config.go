package config

import (
	"os"
	"time"
)

type Config struct {
	// Network
	ListenAddr string
	HealthAddr string

	// TLS
	TLSCertFile string
	TLSKeyFile  string
	TLSCAFile   string

	// NATS
	NATSURL string

	// Egress Proxy (HTTP/2 pool runs on Fargate, not Lambda)
	EgressProxyURL string

	// Timeouts
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	DrainTimeout time.Duration

	// Resume
	ResumeTokenSecret string
	ResumeTokenTTL    time.Duration

	// Limits
	MaxConnections int
}

func Load() *Config {
	return &Config{
		ListenAddr:        getEnv("GATEWAY_LISTEN_ADDR", ":8443"),
		HealthAddr:        getEnv("GATEWAY_HEALTH_ADDR", ":8080"),
		TLSCertFile:       getEnv("GATEWAY_TLS_CERT_FILE", ""),
		TLSKeyFile:        getEnv("GATEWAY_TLS_KEY_FILE", ""),
		TLSCAFile:         getEnv("GATEWAY_TLS_CA_FILE", ""),
		NATSURL:           getEnv("NATS_URL", "nats://localhost:4222"),
		EgressProxyURL:    getEnv("EGRESS_PROXY_URL", "http://localhost:9000"),
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      10 * time.Second,
		DrainTimeout:      30 * time.Second,
		ResumeTokenSecret: getEnv("RESUME_TOKEN_SECRET", "dev-secret-change-me"),
		ResumeTokenTTL:    time.Hour,
		MaxConnections:    100000,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
