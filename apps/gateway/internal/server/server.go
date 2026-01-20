package server

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gobwas/ws"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/radiant/gateway/internal/config"
	"github.com/radiant/gateway/internal/resume"
	"github.com/radiant/gateway/internal/session"
	"go.uber.org/zap"
)

type Server struct {
	cfg    *config.Config
	logger *zap.Logger

	// NATS
	nc *nats.Conn          // Core NATS (egress live)
	js jetstream.JetStream // JetStream (ingress + history)

	// Resume service
	resumeSvc *resume.Service

	// Session tracking
	sessions sync.Map
	conns    sync.Map

	// Stats
	activeConns int64
	totalConns  int64
	msgIn       int64
	msgOut      int64

	// Lifecycle
	done chan struct{}
	wg   sync.WaitGroup
}

func New(cfg *config.Config, logger *zap.Logger) (*Server, error) {
	nc, err := nats.Connect(cfg.NATSURL,
		nats.Name("radiant-gateway"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to create JetStream context: %w", err)
	}

	return &Server{
		cfg:       cfg,
		logger:    logger,
		nc:        nc,
		js:        js,
		resumeSvc: resume.NewService([]byte(cfg.ResumeTokenSecret), cfg.ResumeTokenTTL),
		done:      make(chan struct{}),
	}, nil
}

func (s *Server) Start(ctx context.Context) error {
	// Configure TLS if enabled
	tlsConfig, err := NewTLSConfig(s.cfg)
	if err != nil {
		return fmt.Errorf("failed to configure TLS: %w", err)
	}

	var ln net.Listener
	if tlsConfig != nil {
		ln, err = tls.Listen("tcp", s.cfg.ListenAddr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to listen with TLS on %s: %w", s.cfg.ListenAddr, err)
		}
		s.logger.Info("TLS enabled",
			zap.Bool("mtls", tlsConfig.ClientAuth == tls.VerifyClientCertIfGiven),
		)
	} else {
		ln, err = net.Listen("tcp", s.cfg.ListenAddr)
		if err != nil {
			return fmt.Errorf("failed to listen on %s: %w", s.cfg.ListenAddr, err)
		}
		s.logger.Warn("TLS disabled - not recommended for production")
	}

	// Start health server
	go s.startHealthServer()

	s.logger.Info("Gateway started",
		zap.String("addr", s.cfg.ListenAddr),
		zap.String("health", s.cfg.HealthAddr),
		zap.Bool("tls", tlsConfig != nil),
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.handleWS)

	server := &http.Server{
		Handler:      mux,
		ReadTimeout:  s.cfg.ReadTimeout,
		WriteTimeout: s.cfg.WriteTimeout,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), s.cfg.DrainTimeout)
		defer cancel()
		server.Shutdown(shutdownCtx)
	}()

	return server.Serve(ln)
}

func (s *Server) startHealthServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","active_connections":%d,"total_connections":%d,"messages_in":%d,"messages_out":%d}`,
			atomic.LoadInt64(&s.activeConns),
			atomic.LoadInt64(&s.totalConns),
			atomic.LoadInt64(&s.msgIn),
			atomic.LoadInt64(&s.msgOut),
		)
	})

	http.ListenAndServe(s.cfg.HealthAddr, mux)
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, _, _, err := ws.UpgradeHTTP(r, w)
	if err != nil {
		s.logger.Error("WebSocket upgrade failed", zap.Error(err))
		return
	}

	atomic.AddInt64(&s.activeConns, 1)
	atomic.AddInt64(&s.totalConns, 1)
	defer atomic.AddInt64(&s.activeConns, -1)
	defer conn.Close()

	// Check for resume token
	resumeToken := r.URL.Query().Get("resume")
	lastSeqNum := parseInt64(r.URL.Query().Get("last_seq"), 0)

	var sess *session.Context

	if resumeToken != "" {
		// Attempt resume
		sess, err = s.handleResume(conn, resumeToken, lastSeqNum)
		if err != nil {
			s.logger.Warn("Resume failed, creating new session", zap.Error(err))
			sess = nil
		}
	}

	if sess == nil {
		// New session
		sid := uuid.New().String()
		sess = &session.Context{
			SessionID:       sid,
			ConnectionID:    uuid.New().String(),
			TenantID:        extractTenantID(r),
			PrincipalID:     extractPrincipalID(r),
			PrincipalType:   "agent",
			Protocol:        "mcp",
			ProtocolVersion: "2025-03-26",
			InboxSubject:    fmt.Sprintf("in.mcp.%s.%s", extractTenantID(r), extractPrincipalID(r)),
			OutboxSubject:   "out." + sid,
			HistorySubject:  "history." + sid,
			RemoteAddr:      r.RemoteAddr,
			ConnectedAt:     time.Now(),
		}
	}

	s.sessions.Store(sess.SessionID, sess)
	s.conns.Store(sess.ConnectionID, conn)
	defer func() {
		s.sessions.Delete(sess.SessionID)
		s.conns.Delete(sess.ConnectionID)
	}()

	s.logger.Info("Connection established",
		zap.String("session_id", sess.SessionID),
		zap.Bool("resumed", sess.Resumed),
	)

	// CORRECTION #2: Defensive Context Management (Zombie Fix)
	// The context MUST be cancelled when EITHER pump exits.
	// This ensures the other pump doesn't hang forever.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Channels to signal pump completion
	ingressDone := make(chan error, 1)
	egressDone := make(chan error, 1)

	// Start ingress pump
	go func() {
		err := s.pumpIngress(ctx, conn, sess)
		ingressDone <- err
		cancel() // CRITICAL: Kill egress if ingress dies
	}()

	// Start egress pump
	go func() {
		err := s.pumpEgress(ctx, conn, sess)
		egressDone <- err
		cancel() // Kill ingress if egress dies
	}()

	// Wait for first error
	select {
	case err := <-ingressDone:
		s.logger.Debug("Ingress exited", zap.Error(err))
	case err := <-egressDone:
		s.logger.Debug("Egress exited", zap.Error(err))
	}

	// Wait for both pumps with timeout (defensive cleanup)
	cleanup := time.After(5 * time.Second)
	for i := 0; i < 2; i++ {
		select {
		case <-ingressDone:
		case <-egressDone:
		case <-cleanup:
			s.logger.Warn("Pump cleanup timeout, forcing close",
				zap.String("session_id", sess.SessionID),
			)
			return
		}
	}
}

func (s *Server) Close() error {
	close(s.done)
	s.wg.Wait()
	s.nc.Close()
	return nil
}

func parseInt64(s string, fallback int64) int64 {
	if s == "" {
		return fallback
	}
	var v int64
	fmt.Sscanf(s, "%d", &v)
	return v
}

func extractTenantID(r *http.Request) string {
	if tid := r.Header.Get("X-Tenant-ID"); tid != "" {
		return tid
	}
	return "tenant-dev"
}

func extractPrincipalID(r *http.Request) string {
	if pid := r.Header.Get("X-Principal-ID"); pid != "" {
		return pid
	}
	return "agent-dev"
}
