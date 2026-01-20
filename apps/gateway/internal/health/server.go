package health

import (
	"encoding/json"
	"net/http"
	"sync/atomic"
)

type Stats struct {
	ActiveConns *int64
	TotalConns  *int64
	MsgIn       *int64
	MsgOut      *int64
}

type Response struct {
	Status            string `json:"status"`
	ActiveConnections int64  `json:"active_connections"`
	TotalConnections  int64  `json:"total_connections"`
	MessagesIn        int64  `json:"messages_in"`
	MessagesOut       int64  `json:"messages_out"`
}

func Handler(stats *Stats) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := Response{
			Status:            "ok",
			ActiveConnections: atomic.LoadInt64(stats.ActiveConns),
			TotalConnections:  atomic.LoadInt64(stats.TotalConns),
			MessagesIn:        atomic.LoadInt64(stats.MsgIn),
			MessagesOut:       atomic.LoadInt64(stats.MsgOut),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func ReadyHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ready"))
	}
}

func LiveHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("alive"))
	}
}
