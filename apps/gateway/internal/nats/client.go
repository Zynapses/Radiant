package nats

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"go.uber.org/zap"
)

type Client struct {
	nc     *nats.Conn
	js     jetstream.JetStream
	logger *zap.Logger
}

type Config struct {
	URL            string
	Name           string
	MaxReconnects  int
	ReconnectWait  time.Duration
	ConnectTimeout time.Duration
}

func DefaultConfig(url string) *Config {
	return &Config{
		URL:            url,
		Name:           "radiant-gateway",
		MaxReconnects:  -1, // Infinite reconnects
		ReconnectWait:  time.Second,
		ConnectTimeout: 10 * time.Second,
	}
}

func NewClient(cfg *Config, logger *zap.Logger) (*Client, error) {
	opts := []nats.Option{
		nats.Name(cfg.Name),
		nats.MaxReconnects(cfg.MaxReconnects),
		nats.ReconnectWait(cfg.ReconnectWait),
		nats.Timeout(cfg.ConnectTimeout),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			if err != nil {
				logger.Warn("NATS disconnected", zap.Error(err))
			}
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			logger.Info("NATS reconnected", zap.String("url", nc.ConnectedUrl()))
		}),
		nats.ClosedHandler(func(nc *nats.Conn) {
			logger.Info("NATS connection closed")
		}),
	}

	nc, err := nats.Connect(cfg.URL, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to create JetStream context: %w", err)
	}

	return &Client{
		nc:     nc,
		js:     js,
		logger: logger,
	}, nil
}

func (c *Client) Conn() *nats.Conn {
	return c.nc
}

func (c *Client) JetStream() jetstream.JetStream {
	return c.js
}

func (c *Client) Close() {
	c.nc.Close()
}

func (c *Client) IsConnected() bool {
	return c.nc.IsConnected()
}

// EnsureStreams creates the required streams if they don't exist
func (c *Client) EnsureStreams(ctx context.Context) error {
	// INBOX stream for ingress messages (work queue)
	_, err := c.js.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:      "INBOX",
		Subjects:  []string{"in.>"},
		Retention: jetstream.WorkQueuePolicy,
		MaxAge:    time.Hour,
		Storage:   jetstream.FileStorage,
	})
	if err != nil {
		return fmt.Errorf("failed to create INBOX stream: %w", err)
	}

	// HISTORY stream for egress replay (limits-based)
	_, err = c.js.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:              "HISTORY",
		Subjects:          []string{"history.>"},
		Retention:         jetstream.LimitsPolicy,
		MaxAge:            time.Hour,
		MaxMsgsPerSubject: 10000,
		Storage:           jetstream.FileStorage,
	})
	if err != nil {
		return fmt.Errorf("failed to create HISTORY stream: %w", err)
	}

	c.logger.Info("NATS streams configured",
		zap.String("inbox", "INBOX"),
		zap.String("history", "HISTORY"),
	)

	return nil
}
