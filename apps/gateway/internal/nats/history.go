package nats

import (
	"context"
	"time"

	"github.com/nats-io/nats.go/jetstream"
	"go.uber.org/zap"
)

// HistoryService handles message history for session replay
type HistoryService struct {
	js     jetstream.JetStream
	logger *zap.Logger
}

func NewHistoryService(js jetstream.JetStream, logger *zap.Logger) *HistoryService {
	return &HistoryService{
		js:     js,
		logger: logger,
	}
}

// FetchAfterSequence retrieves messages from HISTORY stream after the given sequence number
func (h *HistoryService) FetchAfterSequence(ctx context.Context, sessionID string, afterSeq uint64, maxMsgs int) ([]jetstream.Msg, error) {
	subject := "history." + sessionID

	// Create ephemeral consumer for replay
	consumer, err := h.js.CreateConsumer(ctx, "HISTORY", jetstream.ConsumerConfig{
		FilterSubject:     subject,
		DeliverPolicy:     jetstream.DeliverByStartSequencePolicy,
		OptStartSeq:       afterSeq + 1,
		AckPolicy:         jetstream.AckNonePolicy,
		InactiveThreshold: 30 * time.Second,
	})
	if err != nil {
		return nil, err
	}

	// Fetch messages
	batch, err := consumer.Fetch(maxMsgs)
	if err != nil {
		return nil, err
	}

	var messages []jetstream.Msg
	for msg := range batch.Messages() {
		messages = append(messages, msg)
	}

	h.logger.Debug("Fetched history messages",
		zap.String("session_id", sessionID),
		zap.Uint64("after_seq", afterSeq),
		zap.Int("count", len(messages)),
	)

	return messages, nil
}

// GetLastSequence returns the last sequence number for a session
func (h *HistoryService) GetLastSequence(ctx context.Context, sessionID string) (uint64, error) {
	subject := "history." + sessionID

	stream, err := h.js.Stream(ctx, "HISTORY")
	if err != nil {
		return 0, err
	}

	// Get the last message for this specific subject
	msg, err := stream.GetLastMsgForSubject(ctx, subject)
	if err != nil {
		// If no messages exist for this subject, return 0
		if err.Error() == "nats: no message found" {
			return 0, nil
		}
		return 0, err
	}

	return msg.Sequence, nil
}
