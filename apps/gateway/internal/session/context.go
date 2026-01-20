package session

import "time"

type Context struct {
	// Identity
	SessionID     string
	ConnectionID  string
	TenantID      string
	PrincipalID   string
	PrincipalType string // "agent", "user", "service"

	// Protocol
	Protocol        string
	ProtocolVersion string

	// NATS Subjects
	InboxSubject   string // in.{protocol}.{tenant}.{agent}
	OutboxSubject  string // out.{session_id}
	HistorySubject string // history.{session_id} (for replay)

	// Security
	Scopes      []string
	Permissions *Permissions

	// Connection
	RemoteAddr     string
	ConnectedAt    time.Time
	LastActivityAt time.Time

	// Resume
	LastSeqNum  int64
	ResumeToken string
	Resumed     bool // True if this is a resumed session
}

type Permissions struct {
	AllowedTools   []string
	DeniedTools    []string
	AllowedActions []string
	ResourceLabels map[string]string
}
