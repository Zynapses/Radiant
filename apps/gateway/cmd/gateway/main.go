package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/radiant/gateway/internal/config"
	"github.com/radiant/gateway/internal/server"
	"go.uber.org/zap"
)

func main() {
	// Initialize logger
	var logger *zap.Logger
	var err error
	
	if os.Getenv("GATEWAY_DEV") == "true" {
		logger, err = zap.NewDevelopment()
	} else {
		logger, err = zap.NewProduction()
	}
	if err != nil {
		// Use fmt.Fprintf to stderr instead of panic for graceful degradation
		os.Stderr.WriteString("FATAL: failed to create logger: " + err.Error() + "\n")
		os.Exit(1)
	}
	defer logger.Sync()

	// Load configuration
	cfg := config.Load()

	logger.Info("Starting RADIANT Gateway",
		zap.String("listen_addr", cfg.ListenAddr),
		zap.String("health_addr", cfg.HealthAddr),
		zap.String("nats_url", cfg.NATSURL),
		zap.String("egress_proxy_url", cfg.EgressProxyURL),
	)

	// Create server
	srv, err := server.New(cfg, logger)
	if err != nil {
		logger.Fatal("Failed to create server", zap.Error(err))
	}

	// Handle shutdown signals
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigCh
		logger.Info("Received shutdown signal", zap.String("signal", sig.String()))
		cancel()
	}()

	// Start server
	if err := srv.Start(ctx); err != nil {
		logger.Fatal("Server error", zap.Error(err))
	}

	logger.Info("Gateway shutdown complete")
}
