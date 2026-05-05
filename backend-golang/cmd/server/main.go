package main

import (
	"log"
	"os"

	"backend-golang/internal/config"
	"backend-golang/internal/database"
	"backend-golang/internal/router"
	"backend-golang/internal/services/osrm"
	ws "backend-golang/internal/websocket"
)

// ============================================================================
// MBG Smart Logistics — Monorepo Backend API Server
// ============================================================================
// Architecture:
//   Database:  MySQL 8.0 (7 tables via GORM auto-migration)
//   API:       Gin Gonic REST + lightweight WebSocket
//   Services:  Rule-Based Expiration, OSRM/CVRPTW, Gemini Menu Recommender
//   Tracking:  Batch Cache & Sync (not real-time per-second)
//   Roles:     admin, guru, dapur, kurir
// ============================================================================

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)

	// Load configuration from .env
	cfg := config.Load()

	// Connect to MySQL + auto-migrate 7 tables
	db := database.Connect(cfg)

	// Initialize OSRM client for routing
	osrmClient := osrm.NewClient(cfg.OSRMBaseURL)

	// Initialize WebSocket hub for dashboard refresh notifications
	hub := ws.NewHub()
	go hub.Run()

	// Setup Gin router with all routes, middleware, and services
	r := router.Setup(db, cfg, osrmClient, hub)

	port := cfg.ServerPort
	if port == "" {
		port = "8080"
	}

	log.Println("╔══════════════════════════════════════════════════════════╗")
	log.Println("║   🚀 MBG Smart Logistics API Server (Monorepo v3.0)    ║")
	log.Println("║   📍 Kota Malang, Jawa Timur                           ║")
	log.Printf("║   🌐 http://localhost:%s                             ║\n", port)
	log.Println("║   📦 MySQL + OSRM + Gemini AI + WebSocket              ║")
	log.Println("║   🔐 Roles: admin | guru | dapur | kurir               ║")
	log.Println("╚══════════════════════════════════════════════════════════╝")

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
		os.Exit(1)
	}
}
