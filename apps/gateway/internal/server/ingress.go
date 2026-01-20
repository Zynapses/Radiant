package server

import (
	"context"
	"encoding/json"
	"net"
	"sync/atomic"
	"time"

	"github.com/gobwas/ws"
	"github.com/gobwas/ws/wsutil"
	"github.com/google/uuid"
	"github.com/radiant/gateway/internal/session"
	"github.com/radiant/gateway/pkg/messages"
	"go.uber.org/zap"
)

// pumpIngress reads from WebSocket and publishes to JetStream INBOX.
// Uses JetStream for guaranteed delivery to Lambda workers.
func (s *Server) pumpIngress(ctx context.Context, conn net.Conn, sess *session.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		conn.SetReadDeadline(time.Now().Add(s.cfg.ReadTimeout))

		data, op, err := wsutil.ReadClientData(conn)
		if err != nil {
			return err
		}

		if op == ws.OpClose {
			return nil
		}

		if op != ws.OpText && op != ws.OpBinary {
			continue
		}

		atomic.AddInt64(&s.msgIn, 1)
		sess.LastActivityAt = time.Now()

		msg := messages.Inbound{
			MessageID:    uuid.New().String(),
			SessionID:    sess.SessionID,
			ConnectionID: sess.ConnectionID,
			TenantID:     sess.TenantID,
			SecurityContext: map[string]interface{}{
				"principal_id":   sess.PrincipalID,
				"principal_type": sess.PrincipalType,
				"tenant_id":      sess.TenantID,
				"scopes":         sess.Scopes,
			},
			Protocol:        sess.Protocol,
			ProtocolVersion: sess.ProtocolVersion,
			Payload:         data,
			ReceivedAt:      time.Now(),
		}

		msgBytes, err := json.Marshal(msg)
		if err != nil {
			s.logger.Error("Failed to marshal inbound message", zap.Error(err))
			continue
		}

		// Publish to JetStream (guaranteed delivery)
		_, err = s.js.Publish(ctx, sess.InboxSubject, msgBytes)
		if err != nil {
			s.logger.Error("JetStream publish failed",
				zap.String("subject", sess.InboxSubject),
				zap.Error(err),
			)
			// Don't fail connection — client can retry
		}
	}
}
