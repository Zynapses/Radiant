package protocol

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Protocol string

const (
	MCP       Protocol = "mcp"
	A2A       Protocol = "a2a"
	OpenAI    Protocol = "openai"
	Anthropic Protocol = "anthropic"
	Google    Protocol = "google"
	Unknown   Protocol = "unknown"
)

type Detection struct {
	Protocol Protocol
	Version  string
}

func DetectFromHeaders(h http.Header) *Detection {
	if v := h.Get("X-MCP-Version"); v != "" {
		return &Detection{MCP, v}
	}
	if v := h.Get("Anthropic-Version"); v != "" {
		return &Detection{Anthropic, v}
	}
	if p := h.Get("X-Protocol"); p != "" {
		return &Detection{Protocol(strings.ToLower(p)), h.Get("X-Protocol-Version")}
	}
	return nil
}

func DetectFromPayload(data []byte) *Detection {
	var msg map[string]interface{}
	if json.Unmarshal(data, &msg) != nil {
		return &Detection{Unknown, ""}
	}

	if _, ok := msg["jsonrpc"]; ok {
		method, _ := msg["method"].(string)
		if strings.HasPrefix(method, "tools/") || method == "initialize" {
			return &Detection{MCP, "2025-03-26"}
		}
		if strings.HasPrefix(method, "tasks/") {
			return &Detection{A2A, "0.3.0"}
		}
	}

	if _, ok := msg["messages"]; ok {
		return &Detection{OpenAI, "v1"}
	}

	return &Detection{Unknown, ""}
}
