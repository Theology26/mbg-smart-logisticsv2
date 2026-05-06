package router

import (
	"net/http"

	"backend-golang/internal/config"
	"backend-golang/internal/handlers"
	"backend-golang/internal/middleware"
	"backend-golang/internal/services/osrm"
	ws "backend-golang/internal/websocket"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ============================================================================
// Router — Gin Route Definitions with Role-Based Access
// ============================================================================
// Role Isolation (Lecturer's Feedback):
//   admin  → Full access to all endpoints
//   dapur  → OCR endpoint (via AI service), Gemini Menu Recommender, ingredients
//   kurir  → Routing sequence, expiration constraints, batch tracking upload
//   guru   → Read-only dashboard access (tracking history, deliveries, schools)
// ============================================================================

// Setup creates and configures the Gin router with all routes.
func Setup(dbCore *gorm.DB, dbCustom *gorm.DB, cfg *config.Config, osrmClient *osrm.Client, hub *ws.Hub) *gin.Engine {
	r := gin.Default()

	// Global middleware
	r.Use(middleware.CORS())

	// Initialize handler with all dependencies
	h := handlers.NewHandler(dbCore, dbCustom, cfg, osrmClient, hub)

	// ── WebSocket — Lightweight dashboard refresh ────────────────
	r.GET("/ws/tracking", func(c *gin.Context) {
		hub.HandleWebSocket(c.Writer, c.Request)
	})

	// API group
	api := r.Group("/api")

	// ── System (Public) ──────────────────────────────────────────
	api.GET("/health", h.HealthCheck)

	// ── Authentication (Public) ──────────────────────────────────
	auth := api.Group("/auth")
	{
		auth.POST("/login", h.Login)
		auth.POST("/register", h.Register)
	}

	// ── Protected routes (JWT required) ──────────────────────────
	protected := api.Group("/")
	protected.Use(middleware.AuthRequired(cfg))

	// ── Schools (admin: full CRUD, guru: read-only) ──────────────
	schools := protected.Group("/schools")
	{
		schools.GET("/", h.GetSchools)                                          // all roles
		schools.POST("/", middleware.RoleRequired("admin"), h.CreateSchool)     // admin only
		schools.PUT("/:id", middleware.RoleRequired("admin"), h.UpdateSchool)   // admin only
		schools.DELETE("/:id", middleware.RoleRequired("admin"), h.DeleteSchool) // admin only
	}

	// ── Ingredients (admin + dapur) ──────────────────────────────
	ingredients := protected.Group("/ingredients")
	{
		ingredients.GET("/", h.GetIngredients)
		ingredients.POST("/", middleware.RoleRequired("admin", "dapur"), h.CreateIngredient)
	}

	// ── Menus (admin + dapur) ────────────────────────────────────
	menus := protected.Group("/menus")
	{
		menus.GET("/", h.GetMenus)
		menus.POST("/", middleware.RoleRequired("admin", "dapur"), h.CreateMenu)
	}

	// ── Menu Recommender — Dapur only (Gemini AI) ────────────────
	protected.POST("/menu/recommend",
		middleware.RoleRequired("admin", "dapur"), h.RecommendMenu)

	// ── Schedules (admin + dapur) ────────────────────────────────
	schedules := protected.Group("/schedules")
	{
		schedules.GET("/", h.GetSchedules)
		schedules.POST("/", middleware.RoleRequired("admin", "dapur"), h.CreateSchedule)
	}

	// ── Expiration Calculator (admin + dapur + kurir) ────────────
	protected.POST("/expiration/calculate",
		middleware.RoleRequired("admin", "dapur", "kurir"), h.CalculateExpiration)

	// ── Couriers (admin only) ────────────────────────────────────
	protected.GET("/couriers", middleware.RoleRequired("admin"), h.GetCouriers)

	// ── Deliveries (admin + kurir) ───────────────────────────────
	deliveries := protected.Group("/deliveries")
	{
		deliveries.GET("/", h.GetDeliveries)                                              // all roles
		deliveries.POST("/", middleware.RoleRequired("admin"), h.CreateDelivery)           // admin only
		deliveries.PUT("/:id/status", middleware.RoleRequired("admin", "kurir"), h.UpdateDeliveryStatus)
		deliveries.PUT("/:id/assign", middleware.RoleRequired("admin"), h.AssignCourier)   // admin only
	}

	// ── Customized Settings (SQLite) — Admin only ───────────────
	customized := protected.Group("/customized")
	customized.Use(middleware.RoleRequired("admin"))
	{
		customized.GET("/styles", h.GetStyles)
		customized.PUT("/styles/:id", h.UpdateStyle)
	}

	// ── Batch Tracking — Kurir only ──────────────────────────────
	// Courier app caches GPS locally, sends bulk every few minutes.
	tracking := protected.Group("/tracking")
	{
		tracking.POST("/batch", middleware.RoleRequired("kurir"), h.BatchTracking)
		tracking.GET("/history/:courier_id", h.GetTrackingHistory) // admin + guru can view
	}

	// ── Routing Geometry — Kurir only ────────────────────────────
	routing := protected.Group("/routing")
	{
		routing.POST("/geometry", middleware.RoleRequired("kurir", "admin"), h.GetRoutingGeometry)
	}

	// ── Fallback 404 ─────────────────────────────────────────────
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  404,
			"message": "Route not found",
		})
	})

	return r
}
