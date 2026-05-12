package handlers

import (
	"fmt"
	"log"
	"time"

	"backend-golang/internal/config"
	"backend-golang/internal/models"
	"backend-golang/internal/services/expiration"
	"backend-golang/internal/services/gemini"
	"backend-golang/internal/services/osrm"
	ws "backend-golang/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ============================================================================
// HTTP Handlers — All API Endpoints
// ============================================================================

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	DB       *gorm.DB // MySQL (Core System)
	CustomDB *gorm.DB // SQLite (Customized Settings)
	Config   *config.Config
	Gemini   *gemini.Client
	OSRM     *osrm.Client
	WSHub    *ws.Hub
}

// NewHandler creates a new Handler with all dependencies injected.
func NewHandler(dbCore *gorm.DB, dbCustom *gorm.DB, cfg *config.Config, osrmClient *osrm.Client, hub *ws.Hub) *Handler {
	return &Handler{
		DB:       dbCore,
		CustomDB: dbCustom,
		Config:   cfg,
		Gemini:   gemini.NewClient(cfg.GeminiAPIKey, cfg.GeminiModel),
		OSRM:     osrmClient,
		WSHub:    hub,
	}
}

// JSON is a shorthand for standardized API response.
func JSON(c *gin.Context, status int, message string, data interface{}) {
	c.JSON(status, gin.H{
		"status":  status,
		"message": message,
		"data":    data,
	})
}

// ============================================================================
// Auth Handlers
// ============================================================================

// Login authenticates a user and returns a JWT token.
// POST /api/auth/login
func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		JSON(c, 401, "Invalid email or password", nil)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		JSON(c, 401, "Invalid email or password", nil)
		return
	}

	token, err := generateJWT(user.ID, user.Role, user.DapurID, h.Config)
	if err != nil {
		JSON(c, 500, "Failed to generate token", nil)
		return
	}

	JSON(c, 200, "Login successful", gin.H{
		"token": token,
		"user": gin.H{
			"id": user.ID, "name": user.Name,
			"email": user.Email, "role": user.Role,
			"dapur_id": user.DapurID,
		},
	})
}

// Register creates a new user account.
// POST /api/auth/register
func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		JSON(c, 500, "Failed to hash password", nil)
		return
	}

	user := models.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashedPassword),
		Role:     req.Role,
		DapurID:  req.DapurID,
	}

	if err := h.DB.Create(&user).Error; err != nil {
		JSON(c, 500, "Registration failed: "+err.Error(), nil)
		return
	}

	JSON(c, 201, "User registered successfully", gin.H{
		"id": user.ID, "email": user.Email, "role": user.Role, "dapur_id": user.DapurID,
	})
}

// ============================================================================
// Schools CRUD
// ============================================================================

func (h *Handler) GetSchools(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.DB.First(&user, "id = ?", userID).Error; err != nil {
		JSON(c, 401, "User not found", nil)
		return
	}

	var schools []models.School
	query := h.DB.Order("name ASC")
	if user.Role != "admin" && user.DapurID != nil {
		query = query.Where("dapur_id = ?", *user.DapurID)
	}
	query.Find(&schools)
	JSON(c, 200, "Schools retrieved", schools)
}

func (h *Handler) CreateSchool(c *gin.Context) {
	var school models.School
	if err := c.ShouldBindJSON(&school); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}
	// Scope to caller's dapur if they have one
	userID, _ := c.Get("user_id")
	var user models.User
	h.DB.First(&user, "id = ?", userID)
	if user.DapurID != nil && school.DapurID == nil {
		school.DapurID = user.DapurID
	}
	h.DB.Create(&school)
	JSON(c, 201, "School created", school)
}

func (h *Handler) UpdateSchool(c *gin.Context) {
	id := c.Param("id")
	var school models.School
	if err := h.DB.First(&school, id).Error; err != nil {
		JSON(c, 404, "School not found", nil)
		return
	}
	if err := c.ShouldBindJSON(&school); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}
	h.DB.Save(&school)
	JSON(c, 200, "School updated", school)
}

func (h *Handler) DeleteSchool(c *gin.Context) {
	id := c.Param("id")
	// Verify school belongs to user's tenant
	userID, _ := c.Get("user_id")
	var user models.User
	h.DB.First(&user, "id = ?", userID)
	if user.Role != "admin" && user.DapurID != nil {
		var count int64
		h.DB.Model(&models.School{}).Where("id = ? AND dapur_id = ?", id, *user.DapurID).Count(&count)
		if count == 0 {
			JSON(c, 403, "Cannot delete school outside your tenant", nil)
			return
		}
	}
	h.DB.Delete(&models.School{}, id)
	JSON(c, 200, "School deleted", nil)
}

// ============================================================================
// Ingredients CRUD
// ============================================================================

func (h *Handler) GetIngredients(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.DB.First(&user, "id = ?", userID).Error; err != nil {
		JSON(c, 401, "User not found", nil)
		return
	}

	var items []models.Ingredient
	query := h.DB.Order("name ASC")
	if user.Role != "admin" && user.DapurID != nil {
		query = query.Where("dapur_id = ?", *user.DapurID)
	}
	query.Find(&items)
	JSON(c, 200, "Ingredients retrieved", items)
}

func (h *Handler) CreateIngredient(c *gin.Context) {
	var item models.Ingredient
	if err := c.ShouldBindJSON(&item); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}
	userID, _ := c.Get("user_id")
	var user models.User
	h.DB.First(&user, "id = ?", userID)
	if user.DapurID != nil {
		item.DapurID = user.DapurID
	}
	h.DB.Create(&item)
	JSON(c, 201, "Ingredient created", item)
}

func (h *Handler) DeleteIngredient(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("user_id")
	var user models.User
	h.DB.First(&user, "id = ?", userID)
	if user.DapurID != nil {
		var count int64
		h.DB.Model(&models.Ingredient{}).Where("id = ? AND dapur_id = ?", id, *user.DapurID).Count(&count)
		if count == 0 {
			JSON(c, 403, "Cannot delete ingredient outside your tenant", nil)
			return
		}
	}
	h.DB.Delete(&models.Ingredient{}, id)
	JSON(c, 200, "Ingredient deleted", nil)
}

// ============================================================================
// Menus CRUD
// ============================================================================

func (h *Handler) GetMenus(c *gin.Context) {
	var menus []models.Menu
	h.DB.Order("name ASC").Find(&menus)
	JSON(c, 200, "Menus retrieved", menus)
}

func (h *Handler) CreateMenu(c *gin.Context) {
	var menu models.Menu
	if err := c.ShouldBindJSON(&menu); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}
	h.DB.Create(&menu)
	JSON(c, 201, "Menu created", menu)
}

// ============================================================================
// Schedules — with Expiration Calculation
// ============================================================================

func (h *Handler) GetSchedules(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.DB.First(&user, "id = ?", userID).Error; err != nil {
		JSON(c, 401, "User not found", nil)
		return
	}

	var schedules []models.Schedule
	query := h.DB.Preload("Menu").Order("cooking_completion_time DESC")
	if user.Role != "admin" && user.DapurID != nil {
		query = query.Where("dapur_id = ?", *user.DapurID)
	}
	query.Find(&schedules)
	JSON(c, 200, "Schedules retrieved", schedules)
}

func (h *Handler) CreateSchedule(c *gin.Context) {
	var schedule models.Schedule
	if err := c.ShouldBindJSON(&schedule); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	// Load the menu to get category
	var menu models.Menu
	if err := h.DB.First(&menu, schedule.MenuID).Error; err != nil {
		JSON(c, 404, "Item/Menu not found", nil)
		return
	}

	// Fetch Dynamic AI Rule from SQLite
	var rule models.SystemRule
	if err := h.CustomDB.Where("category_name = ?", menu.Category).First(&rule).Error; err != nil {
		// Fallback defaults if rule not found
		rule = models.SystemRule{UrgencyFactor: 0.5, ExpiryHours: 6}
	}

	var cookTime time.Time
	if schedule.CookingCompletionTime != nil {
		cookTime = *schedule.CookingCompletionTime
		schedule.IsCooked = true
	} else {
		cookTime = time.Now() // placeholder if not cooked
	}

	// Calculate expiration using the dynamic parameters
	result := expiration.CalculateExpiration(menu.Category, cookTime, 28.0, rule.ExpiryHours, rule.UrgencyFactor)
	if schedule.IsCooked {
		schedule.ExpirationTime = &result.ExpirationTime
	} else {
		schedule.ExpirationTime = nil
	}
	schedule.EpsilonScore = result.EpsilonScore
	
	userID, _ := c.Get("user_id")
	var user models.User
	h.DB.First(&user, "id = ?", userID)
	if user.DapurID != nil {
		schedule.DapurID = user.DapurID
	}

	h.DB.Create(&schedule)
	JSON(c, 201, "Operation created with AI optimization", gin.H{
		"schedule":   schedule,
		"expiration": result,
	})
}

func (h *Handler) UpdateSchedule(c *gin.Context) {
	id := c.Param("id")
	var schedule models.Schedule
	if err := h.DB.First(&schedule, id).Error; err != nil {
		JSON(c, 404, "Schedule not found", nil)
		return
	}

	var req struct {
		IsCooked              bool       `json:"is_cooked"`
		CookingCompletionTime *time.Time `json:"cooking_completion_time"`
		ExpirationTime        *time.Time `json:"expiration_time"`
		EpsilonScore          float64    `json:"epsilon_score"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	schedule.IsCooked = req.IsCooked
	if req.CookingCompletionTime != nil {
		schedule.CookingCompletionTime = req.CookingCompletionTime
	}
	if req.ExpirationTime != nil {
		schedule.ExpirationTime = req.ExpirationTime
	}
	if req.EpsilonScore > 0 {
		schedule.EpsilonScore = req.EpsilonScore
	}

	h.DB.Save(&schedule)
	JSON(c, 200, "Schedule updated", schedule)
}

// ============================================================================
// Expiration Calculator (standalone endpoint)
// ============================================================================

// CalculateExpiration computes expiration without creating a schedule.
// POST /api/expiration/calculate
func (h *Handler) CalculateExpiration(c *gin.Context) {
	var req models.ExpirationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	cookTime, err := time.Parse(time.RFC3339, req.CookTime)
	if err != nil {
		JSON(c, 400, "Invalid cook_time format (use RFC3339)", nil)
		return
	}

	// Fetch Dynamic AI Rule from SQLite
	var rule models.SystemRule
	if err := h.CustomDB.Where("category_name = ?", req.Category).First(&rule).Error; err != nil {
		rule = models.SystemRule{UrgencyFactor: 0.5, ExpiryHours: 6}
	}

	result := expiration.CalculateExpiration(req.Category, cookTime, req.Temperature, rule.ExpiryHours, rule.UrgencyFactor)

	JSON(c, 200, "Expiration calculated", models.ExpirationResponse{
		Category:       result.Category,
		CookTime:       result.CookTime,
		ExpirationTime: result.ExpirationTime,
		ShelfLifeHours: result.ShelfLifeHours,
		EpsilonScore:   result.EpsilonScore,
		Temperature:    result.Temperature,
		TempAdjusted:   result.TempAdjusted,
	})
}

// ============================================================================
// Deliveries CRUD
// ============================================================================

func (h *Handler) GetDeliveries(c *gin.Context) {
	var deliveries []models.Delivery
	query := h.DB.Preload("Schedule.Menu").Preload("School").Preload("Courier").Order("created_at DESC")

	// Kurir: only see their own deliveries
	if userID, exists := c.Get("user_id"); exists {
		if role, _ := c.Get("role"); role == "kurir" {
			query = query.Where("courier_id = ?", userID)
		} else if role == "guru" {
			var guru models.User
			h.DB.First(&guru, "id = ?", userID)
			if guru.SchoolID != nil {
				query = query.Where("school_id = ?", *guru.SchoolID)
			}
		} else if role == "admin" || role == "dapur" {
			// Admin/Dapur: only see deliveries belonging to couriers in their dapur
			if dapurID, ok := c.Get("dapur_id"); ok && dapurID != nil {
				// Get all courier IDs in this dapur
				var courierIDs []uint
				h.DB.Model(&models.User{}).Where("dapur_id = ? AND role = 'kurir'", dapurID).Pluck("id", &courierIDs)
				if len(courierIDs) > 0 {
					query = query.Where("courier_id IN ?", courierIDs)
				}
			}
		}
	}

	query.Find(&deliveries)
	JSON(c, 200, "Deliveries retrieved", deliveries)
}

func (h *Handler) CreateDelivery(c *gin.Context) {
	var delivery models.Delivery
	if err := c.ShouldBindJSON(&delivery); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}
	h.DB.Create(&delivery)
	JSON(c, 201, "Delivery created", delivery)
}

func (h *Handler) UpdateDeliveryStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required,oneof=pending in_transit delivered failed"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	var delivery models.Delivery
	if err := h.DB.First(&delivery, id).Error; err != nil {
		JSON(c, 404, "Delivery not found", nil)
		return
	}

	updates := map[string]interface{}{"status": req.Status}
	if req.Status == "delivered" {
		now := time.Now()
		updates["actual_delivery_time"] = &now
		
		// Hapus demand sekolah dari daftar antrean
		h.DB.Model(&models.School{}).Where("id = ?", delivery.SchoolID).Update("demand_quantity", 0)
	}

	h.DB.Model(&delivery).Updates(updates)
	JSON(c, 200, "Delivery status updated", delivery)
}

func (h *Handler) CancelDeliveriesForSchool(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var guru models.User
	if err := h.DB.First(&guru, "id = ?", userID).Error; err != nil || guru.SchoolID == nil {
		JSON(c, 403, "Not assigned to a school", nil)
		return
	}

	h.DB.Model(&models.Delivery{}).
		Where("school_id = ? AND status IN ('pending', 'in_transit')", *guru.SchoolID).
		Update("status", "failed") // Failed or Cancelled. For now "failed" stops the delivery.

	JSON(c, 200, "Semua pengiriman hari ini telah dibatalkan karena libur.", nil)
}

func (h *Handler) AssignCourier(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		CourierID uint `json:"courier_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	var delivery models.Delivery
	if err := h.DB.First(&delivery, id).Error; err != nil {
		JSON(c, 404, "Delivery not found", nil)
		return
	}

	// Verify courier exists and is a courier
	var courier models.User
	if err := h.DB.First(&courier, req.CourierID).Error; err != nil || courier.Role != "kurir" {
		JSON(c, 400, "Invalid courier ID", nil)
		return
	}

	h.DB.Model(&delivery).Update("courier_id", req.CourierID)
	JSON(c, 200, "Courier assigned to delivery", delivery)
}

// GetCouriers returns couriers scoped to the admin's dapur.
// GET /api/couriers
func (h *Handler) GetCouriers(c *gin.Context) {
	var couriers []models.User
	query := h.DB.Where("role = ?", "kurir").Order("name ASC")

	// Scope to admin's dapur if they have one
	if dapurID, ok := c.Get("dapur_id"); ok && dapurID != nil {
		query = query.Where("dapur_id = ?", dapurID)
	}

	query.Find(&couriers)
	JSON(c, 200, "Couriers retrieved", couriers)
}

// ============================================================================
// Batch Tracking — POST /api/tracking/batch
// ============================================================================
// Courier app caches GPS points locally, sends them in bulk every few minutes.
// After saving, broadcasts a refresh signal via WebSocket to dashboard clients.

func (h *Handler) BatchTracking(c *gin.Context) {
	var req models.BatchTrackingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	var records []models.TrackingHistory
	for _, pt := range req.Points {
		recordedAt, err := time.Parse(time.RFC3339, pt.RecordedAt)
		if err != nil {
			JSON(c, 400, "Invalid recorded_at format for point: "+pt.RecordedAt, nil)
			return
		}

		records = append(records, models.TrackingHistory{
			CourierID:  req.CourierID,
			DeliveryID: req.DeliveryID,
			Latitude:   pt.Latitude,
			Longitude:  pt.Longitude,
			RecordedAt: recordedAt,
			Speed:      pt.Speed,
			Heading:    pt.Heading,
			Accuracy:   pt.Accuracy,
		})
	}

	// Bulk insert
	if err := h.DB.Create(&records).Error; err != nil {
		JSON(c, 500, "Failed to save tracking data: "+err.Error(), nil)
		return
	}

	// Get the latest position for context
	latest := records[len(records)-1]

	// Broadcast refresh signal to dashboard WebSocket clients
	h.WSHub.BroadcastRefresh("tracking_update", fmt.Sprintf(
		`{"courier_id":%d,"points_count":%d,"latest_lat":%.6f,"latest_lng":%.6f}`,
		req.CourierID, len(records), latest.Latitude, latest.Longitude,
	))

	log.Printf("📡 [TRACKING] Courier %d: %d GPS points saved, dashboard notified",
		req.CourierID, len(records))

	JSON(c, 200, "Tracking data saved", gin.H{
		"points_saved": len(records),
		"courier_id":   req.CourierID,
	})
}

// GetTrackingHistory returns GPS history for a courier or delivery.
// GET /api/tracking/history/:courier_id
func (h *Handler) GetTrackingHistory(c *gin.Context) {
	courierID := c.Param("courier_id")
	limit := 200

	var tracks []models.TrackingHistory
	h.DB.Where("courier_id = ?", courierID).
		Order("recorded_at DESC").
		Limit(limit).
		Find(&tracks)

	JSON(c, 200, "Tracking history retrieved", tracks)
}

// ============================================================================
// Gemini Menu Recommender — Dapur (Kitchen) Only
// ============================================================================

// RecommendMenu uses Gemini AI to suggest menus based on available ingredients.
// POST /api/menu/recommend
func (h *Handler) RecommendMenu(c *gin.Context) {
	var req models.MenuRecommendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	result, err := h.Gemini.RecommendMenu(req.AvailableIngredients, req.StudentCount, req.Preferences)
	if err != nil {
		JSON(c, 500, "Menu recommendation failed: "+err.Error(), nil)
		return
	}

	JSON(c, 200, "Menu recommendations generated", result)
}

// ============================================================================
// OSRM Routing Geometry — Kurir (Courier) Map Polyline
// ============================================================================

// GetRoutingGeometry returns the encoded polyline geometry from OSRM.
// POST /api/routing/geometry
func (h *Handler) GetRoutingGeometry(c *gin.Context) {
	var req struct {
		Points []osrm.Coordinate `json:"points" binding:"required,min=2"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	route, err := h.OSRM.GetRoute(req.Points)
	if err != nil {
		JSON(c, 500, "OSRM routing failed: "+err.Error(), nil)
		return
	}

	if len(route.Routes) == 0 {
		JSON(c, 404, "No route found", nil)
		return
	}

	JSON(c, 200, "Route geometry retrieved", gin.H{
		"geometry": route.Routes[0].Geometry,
		"distance": route.Routes[0].Distance,
		"duration": route.Routes[0].Duration,
	})
}

// ============================================================================
// Customized Settings (SQLite)
// ============================================================================

// GetStyles returns the available UI themes from customized.db
// GET /api/customized/styles
func (h *Handler) GetStyles(c *gin.Context) {
	var styles []models.UIStyle
	if err := h.CustomDB.Find(&styles).Error; err != nil {
		JSON(c, 500, "Failed to retrieve styles", nil)
		return
	}
	JSON(c, 200, "Styles retrieved", styles)
}

// UpdateStyle updates a specific UI theme in customized.db
// PUT /api/customized/styles/:id
func (h *Handler) UpdateStyle(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Primary   string `json:"primary_color"`
		Secondary string `json:"secondary_color"`
		IsActive  bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request", nil)
		return
	}

	var style models.UIStyle
	if err := h.CustomDB.First(&style, id).Error; err != nil {
		JSON(c, 404, "Style not found", nil)
		return
	}

	style.Primary = req.Primary
	style.Secondary = req.Secondary
	if req.IsActive {
		// Set all others to false so only one is active
		h.CustomDB.Model(&models.UIStyle{}).Where("id != ?", id).Update("is_active", false)
	}
	style.IsActive = req.IsActive

	h.CustomDB.Save(&style)
	JSON(c, 200, "Style updated successfully", style)
}

// GetSystemRules returns dynamic AI rules from SQLite
// GET /api/customized/rules
func (h *Handler) GetSystemRules(c *gin.Context) {
	var rules []models.SystemRule
	h.CustomDB.Find(&rules)
	JSON(c, 200, "System rules retrieved", rules)
}

// UpdateSystemRule updates an AI rule (e.g., expiry hours for a category)
// PUT /api/customized/rules/:id
func (h *Handler) UpdateSystemRule(c *gin.Context) {
	id := c.Param("id")
	var req models.SystemRule
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request", nil)
		return
	}
	h.CustomDB.Model(&models.SystemRule{}).Where("id = ?", id).Updates(req)
	JSON(c, 200, "Rule updated", req)
}

// GetIndustryConfig returns global system identity settings
// GET /api/customized/config
func (h *Handler) GetIndustryConfig(c *gin.Context) {
	var config models.IndustryConfig
	h.CustomDB.First(&config)
	JSON(c, 200, "Industry config retrieved", config)
}

// UpdateIndustryConfig updates the system identity (e.g., name, labels)
// PUT /api/customized/config
func (h *Handler) UpdateIndustryConfig(c *gin.Context) {
	var req models.IndustryConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request", nil)
		return
	}
	h.CustomDB.Model(&models.IndustryConfig{}).Where("id = 1").Updates(req)
	JSON(c, 200, "System configuration updated", req)
}

// GetCustomLabels returns all custom UI labels
// GET /api/customized/labels
func (h *Handler) GetCustomLabels(c *gin.Context) {
	var labels []models.CustomLabel
	h.CustomDB.Find(&labels)
	JSON(c, 200, "Custom labels retrieved", labels)
}

// UpdateCustomLabel updates or creates a custom UI label
// PUT /api/customized/labels
func (h *Handler) UpdateCustomLabel(c *gin.Context) {
	var req models.CustomLabel
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request", nil)
		return
	}
	
	if req.LabelKey == "" {
		JSON(c, 400, "Label Key is required", nil)
		return
	}

	h.CustomDB.Where("label_key = ?", req.LabelKey).FirstOrCreate(&req)
	h.CustomDB.Model(&models.CustomLabel{}).Where("label_key = ?", req.LabelKey).Update("label_value", req.LabelValue)
	
	JSON(c, 200, "Label updated", req)
}

// ============================================================================
// Global Settings (MySQL) — For SaaS White-labeling
// ============================================================================

// GetSettings returns all global settings as a key-value map.
// GET /api/settings
func (h *Handler) GetSettings(c *gin.Context) {
	var settings []models.GlobalSetting
	h.CustomDB.Find(&settings)

	// Map them for easier frontend consumption
	resp := make(map[string]string)
	for _, s := range settings {
		resp[s.Key] = s.Value
	}

	JSON(c, 200, "Settings retrieved", resp)
}

// UpdateSettings updates multiple settings at once.
// PUT /api/settings
func (h *Handler) UpdateSettings(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request body", nil)
		return
	}

	for k, v := range req {
		var setting models.GlobalSetting
		// Upsert logic
		h.CustomDB.Where("key = ?", k).FirstOrCreate(&setting)
		h.CustomDB.Model(&setting).Where("key = ?", k).Update("value", v)
	}

	JSON(c, 200, "Settings updated successfully", req)
}

// ============================================================================
// Health Check
// ============================================================================

func (h *Handler) HealthCheck(c *gin.Context) {
	sqlDB, err := h.DB.DB()
	dbStatus := "connected"
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "disconnected"
	}

	osrmStatus := "unreachable"
	if h.OSRM.IsHealthy() {
		osrmStatus = "healthy"
	}

	geminiStatus := "configured"
	if h.Config.GeminiAPIKey == "" {
		geminiStatus = "not configured (using fallback)"
	}

	JSON(c, 200, "MBG Smart Logistics API is running", gin.H{
		"version":  "3.0.0-monorepo",
		"database": dbStatus,
		"osrm":     osrmStatus,
		"gemini":   geminiStatus,
		"time":     time.Now().Format("2006-01-02 15:04:05 MST"),
		"timezone": "Asia/Jakarta (WIB)",
	})
}

// ============================================================================
// JWT helper (uses middleware package)
// ============================================================================

func generateJWT(userID uint, role string, dapurID *uint, cfg *config.Config) (string, error) {
	claims := struct {
		UserID  uint   `json:"user_id"`
		Role    string `json:"role"`
		DapurID *uint  `json:"dapur_id"`
		jwt.RegisteredClaims
	}{
		UserID:  userID,
		Role:    role,
		DapurID: dapurID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "mbg-smart-logistics",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

// ============================================================================
// Feedbacks CRUD
// ============================================================================

func (h *Handler) CreateFeedback(c *gin.Context) {
	var req struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		JSON(c, 400, "Invalid request: "+err.Error(), nil)
		return
	}

	userID, _ := c.Get("user_id")
	uID := userID.(uint)
	
	// Get the guru's school and dapur
	var guru models.User
	if err := h.DB.First(&guru, "id = ?", uID).Error; err != nil || guru.SchoolID == nil || guru.DapurID == nil {
		JSON(c, 403, "Guru is not assigned to a school or dapur", nil)
		return
	}

	feedback := models.Feedback{
		GuruID:   uID,
		SchoolID: *guru.SchoolID,
		DapurID:  *guru.DapurID,
		Message:  req.Message,
	}

	if err := h.DB.Create(&feedback).Error; err != nil {
		JSON(c, 500, "Failed to save feedback", nil)
		return
	}

	JSON(c, 201, "Feedback submitted", feedback)
}

func (h *Handler) GetFeedbacks(c *gin.Context) {
	var feedbacks []models.Feedback
	query := h.DB.Preload("Guru").Preload("School").Order("created_at DESC")

	role, _ := c.Get("role")
	if role == "guru" {
		userID, _ := c.Get("user_id")
		query = query.Where("guru_id = ?", userID.(uint))
	} else if role == "dapur" || role == "admin" {
		if dapurID, exists := c.Get("dapur_id"); exists && dapurID != nil {
			query = query.Where("dapur_id = ?", dapurID)
		}
	}

	query.Find(&feedbacks)
	JSON(c, 200, "Feedbacks retrieved", feedbacks)
}
