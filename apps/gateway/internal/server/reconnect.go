package server

import (
	"context"
	"encoding/json"
	"net"
	"time"

	"github.com/gobwas/ws"
	"github.com/gobwas/ws/wsutil"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/radiant/gateway/internal/session"
	"github.com/radiant/gateway/pkg/messages"
	"go.uber.org/zap"
)

// handleResume validates resume token and replays missed messages from HISTORY.
//
// CORRECTION #3: JetStream HISTORY Replay (Not DynamoDB)
//
// WHY NOT DynamoDB?
// - Writing every streaming token to DynamoDB is prohibitively expensive
// - Latency adds up: 5-10ms per write × 500 tokens = 2.5-5 seconds
//
// WHY JetStream HISTORY?
// - Zero additional cost (NATS is already running)
// - Sub-millisecond writes
// - Automatic TTL cleanup (1 hour retention)
// - Ephemeral consumers for replay don't trigger "1M Consumer" problem
//   (they only exist for seconds during reconnect)
func (s *Server) handleResume(conn net.Conn, token string, lastSeqNum int64) (*session.Context, error) {
	// Validate resume token
	data, err := s.resumeSvc.Validate(token)
	if err != nil {
		return nil, err
	}

	s.logger.Info("Resuming session",
		zap.String("session_id", data.SessionID),
		zap.Int64("last_seq", lastSeqNum),
	)

	// Create session from token
	sess := &session.Context{
		SessionID:       data.SessionID,      // SAME — preserves subjects
		ConnectionID:    uuid.New().String(), // NEW — this is a new TCP connection
		TenantID:        data.TenantID,
		PrincipalID:     data.PrincipalID,
		PrincipalType:   data.PrincipalType,
		Protocol:        data.Protocol,
		ProtocolVersion: data.ProtocolVersion,
		InboxSubject:    data.InboxSubject,
		OutboxSubject:   data.OutboxSubject,
		HistorySubject:  "history." + data.SessionID,
		RemoteAddr:      conn.RemoteAddr().String(),
		ConnectedAt:     time.Now(),
		LastSeqNum:      lastSeqNum,
		Resumed:         true,
	}

	// Replay missed messages from JetStream HISTORY
	if err := s.replayHistory(conn, sess, lastSeqNum); err != nil {
		s.logger.Warn("History replay failed", zap.Error(err))
		// Continue anyway — better to have live than nothing
	}

	return sess, nil
}

// replayHistory fetches missed messages from JetStream HISTORY stream.
func (s *Server) replayHistory(conn net.Conn, sess *session.Context, afterSeq int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create EPHEMERAL consumer for replay
	// This is safe at scale because:
	// 1. It only exists for seconds
	// 2. At 0.1% reconnect rate with 1M connections = ~1000 ephemeral consumers
	// 3. Auto-deletes after InactiveThreshold
	consumer, err := s.js.CreateConsumer(ctx, "HISTORY", jetstream.ConsumerConfig{
		FilterSubject:     sess.HistorySubject,
		DeliverPolicy:     jetstream.DeliverByStartSequencePolicy,
		OptStartSeq:       uint64(afterSeq + 1),
		AckPolicy:         jetstream.AckNonePolicy, // No acks for replay
		InactiveThreshold: 30 * time.Second,        // Auto-delete
	})
	if err != nil {
		return err
	}

	// Fetch missed messages
	batch, err := consumer.Fetch(10000) // Max reasonable replay
	if err != nil {
		return err
	}

	count := 0
	for msg := range batch.Messages() {
		var outMsg messages.Outbound
		if err := json.Unmarshal(msg.Data(), &outMsg); err != nil {
			continue
		}

		// Write to WebSocket
		if err := wsutil.WriteServerMessage(conn, ws.OpText, outMsg.Payload); err != nil {
			return err
		}

		// Update last seq
		if outMsg.SeqNum > sess.LastSeqNum {
			sess.LastSeqNum = outMsg.SeqNum
		}

		count++
	}

	s.logger.Info("History replay complete",
		zap.String("session_id", sess.SessionID),
		zap.Int("messages_replayed", count),
	)

	// Consumer auto-deletes after InactiveThreshold

	return nil
}
