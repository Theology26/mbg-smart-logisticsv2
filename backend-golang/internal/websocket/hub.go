package websocket

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// ============================================================================
// Lightweight WebSocket Hub — Dashboard Refresh Notifications
// ============================================================================
// This WebSocket is NOT for continuous per-second GPS tracking.
// It only sends a "refresh" signal to connected dashboard clients when
// a new batch of tracking data arrives via POST /api/tracking/batch.
//
// Architecture (Lecturer's Feedback):
//   Courier App → caches GPS locally → POST /api/tracking/batch (bulk REST)
//   Backend     → saves to tracking_histories table
//   Backend     → broadcasts "new_data" event via this WebSocket
//   Dashboard   → receives event → fetches latest data via REST
// ============================================================================

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true }, // Allow all origins in dev
}

// Hub maintains the set of active WebSocket clients and broadcasts messages.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// Client represents a single WebSocket connection (e.g., a dashboard tab).
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// NewHub creates a new WebSocket Hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the Hub's event loop. Call this in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("🔌 [WS] Client connected. Total: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("🔌 [WS] Client disconnected. Total: %d", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastRefresh sends a refresh notification to all connected dashboard clients.
// Called after a successful batch tracking upload.
func (h *Hub) BroadcastRefresh(eventType string, data string) {
	msg := []byte(`{"event":"` + eventType + `","data":` + data + `}`)
	h.broadcast <- msg
}

// HandleWebSocket upgrades an HTTP connection to WebSocket and registers the client.
// Mount this on GET /ws/tracking in the router.
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ [WS] Upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.register <- client

	// Writer goroutine: sends messages from the hub to this client
	go client.writePump()

	// Reader goroutine: reads (and discards) messages from client to keep connection alive
	go client.readPump()
}

// writePump pumps messages from the hub to the WebSocket connection.
func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()

	for message := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return
		}
	}
}

// readPump reads messages from the WebSocket (keeps connection alive, discards input).
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
		// We don't process incoming messages — this WS is broadcast-only
	}
}
