package messages

import "time"

// Inbound: Client → Gateway → JetStream INBOX
type Inbound struct {
	MessageID       string                 `json:"message_id"`
	SessionID       string                 `json:"session_id"`
	ConnectionID    string                 `json:"connection_id"`
	TenantID        string                 `json:"tenant_id"`
	SecurityContext map[string]interface{} `json:"security_context"`
	Protocol        string                 `json:"protocol"`
	ProtocolVersion string                 `json:"protocol_version"`
	Payload         []byte                 `json:"payload"`
	ReceivedAt      time.Time              `json:"received_at"`
}

// Outbound: Lambda → Core NATS + JetStream HISTORY → Gateway → Client
type Outbound struct {
	MessageID string `json:"message_id"`
	SessionID string `json:"session_id"`
	Payload   []byte `json:"payload"`
	SeqNum    int64  `json:"seq_num"`
	IsPartial bool   `json:"is_partial"`
	IsFinal   bool   `json:"is_final"`
}
