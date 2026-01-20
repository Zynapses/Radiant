package server

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"sync/atomic"
	"time"

	"github.com/gobwas/ws"
	"github.com/gobwas/ws/wsutil"
	"github.com/nats-io/nats.go"
	"github.com/radiant/gateway/internal/session"
	"github.com/radiant/gateway/pkg/messages"
	"go.uber.org/zap"
)

// pumpEgress subscribes to Core NATS and writes to WebSocket.
//
// CRITICAL DESIGN DECISION: Core NATS for Egress
//
// WHY NOT JetStream consumers?
// - At 1M connections, 1M Raft-backed consumers would crush NATS
// - The control plane cannot handle that much state replication
//
// WHY Core NATS?
// - nc.SubscribeSync() is stateless — scales to millions of subjects
// - Fire-and-forget semantics (no Ack required)
// - Near-zero overhead per subscription
//
// TRADE-OFF:
// - Messages during disconnect are lost on Core NATS
// - SOLUTION: Dual-publish to JetStream HISTORY (see worker code)
// - On reconnect, replay from HISTORY before subscribing to live
func (s *Server) pumpEgress(ctx context.Context, conn net.Conn, sess *session.Context) error {
	// Subscribe to Core NATS (NOT JetStream — avoids consumer trap)
	sub, err := s.nc.SubscribeSync(sess.OutboxSubject)
	if err != nil {
		return err
	}
	defer sub.Unsubscribe()

	s.logger.Debug("Egress pump started",
		zap.String("session_id", sess.SessionID),
		zap.String("subject", sess.OutboxSubject),
	)

	for {
		// CRITICAL: NextMsgWithContext returns when ctx is cancelled
		// This prevents the "Zombie Egress" leak identified in review
		msg, err := sub.NextMsgWithContext(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return nil // Clean shutdown
			}
			if errors.Is(err, nats.ErrConnectionClosed) {
				return errors.New("NATS connection closed")
			}
			return err
		}

		var outMsg messages.Outbound
		if err := json.Unmarshal(msg.Data, &outMsg); err != nil {
			s.logger.Warn("Invalid outbound message", zap.Error(err))
			continue
		}

		// Write to WebSocket
		conn.SetWriteDeadline(time.Now().Add(s.cfg.WriteTimeout))
		if err := wsutil.WriteServerMessage(conn, ws.OpText, outMsg.Payload); err != nil {
			return err
		}

		// Track last sequence for replay
		if outMsg.SeqNum > sess.LastSeqNum {
			sess.LastSeqNum = outMsg.SeqNum
		}

		atomic.AddInt64(&s.msgOut, 1)

		// NO ACK — Core NATS is fire-and-forget (intentional for scale)
	}
}
