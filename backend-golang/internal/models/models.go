package models

import (
	"time"

	"gorm.io/gorm"
)

// ============================================================================
// MBG Smart Logistics — GORM Models (MySQL)
// ============================================================================
// 7 Tables: users, schools, ingredients, menus, schedules, deliveries,
//           tracking_histories
// Roles: admin, guru, dapur, kurir
// ============================================================================

// User represents any system user.
// Roles: admin (full access), guru (read-only dashboard), dapur (kitchen OCR + menu),
//        kurir (routing + tracking upload).
type User struct {
	ID        uint           `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string         `json:"name" gorm:"type:varchar(255);not null"`
	Role      string         `json:"role" gorm:"type:enum('admin','guru','dapur','kurir');not null;default:'guru'"`
	Email     string         `json:"email" gorm:"type:varchar(255);uniqueIndex;not null"`
	Password  string         `json:"-" gorm:"type:varchar(255);not null"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

func (User) TableName() string { return "users" }

// School represents a target school for food delivery.
type School struct {
	ID             uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Name           string    `json:"name" gorm:"type:varchar(255);not null"`
	Latitude       float64   `json:"latitude" gorm:"type:double;not null"`
	Longitude      float64   `json:"longitude" gorm:"type:double;not null"`
	DemandQuantity int       `json:"demand_quantity" gorm:"not null;default:0"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (School) TableName() string { return "schools" }

// Ingredient represents a raw ingredient scanned via PaddleOCR.
type Ingredient struct {
	ID        uint       `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string     `json:"name" gorm:"type:varchar(255);not null"`
	Quantity  float64    `json:"quantity" gorm:"type:double;not null;default:0"`
	Unit      string     `json:"unit" gorm:"type:varchar(50);not null"`
	ScannedAt *time.Time `json:"scanned_at" gorm:"type:datetime"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (Ingredient) TableName() string { return "ingredients" }

// Menu represents a food menu with its category for expiration rules.
// Category determines the expiration rules:
//   - "Kering"  → 12 hrs shelf-life, ε = 0.2
//   - "Basah"   → 6 hrs shelf-life,  ε = 0.5
//   - "Santan"  → 4 hrs shelf-life,  ε = 0.8
type Menu struct {
	ID                  uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Name                string    `json:"name" gorm:"type:varchar(255);not null"`
	Category            string    `json:"category" gorm:"type:enum('Kering','Basah','Santan');not null"`
	IngredientsRequired string    `json:"ingredients_required" gorm:"type:text"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`

	// Relations
	Schedules []Schedule `json:"schedules,omitempty" gorm:"foreignKey:MenuID"`
}

func (Menu) TableName() string { return "menus" }

// Schedule represents a cooking schedule with computed expiration.
// EpsilonScore measures food spoilage urgency (higher = more urgent).
type Schedule struct {
	ID                    uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	MenuID                uint      `json:"menu_id" gorm:"not null;index"`
	CookingCompletionTime time.Time `json:"cooking_completion_time" gorm:"type:datetime;not null"`
	ExpirationTime        time.Time `json:"expiration_time" gorm:"type:datetime;not null"`
	EpsilonScore          float64   `json:"epsilon_score" gorm:"type:double;not null;default:0"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`

	// Relations
	Menu       *Menu      `json:"menu,omitempty" gorm:"foreignKey:MenuID"`
	Deliveries []Delivery `json:"deliveries,omitempty" gorm:"foreignKey:ScheduleID"`
}

func (Schedule) TableName() string { return "schedules" }

// Delivery tracks the delivery of food from schedule to school by courier.
type Delivery struct {
	ID                 uint       `json:"id" gorm:"primaryKey;autoIncrement"`
	ScheduleID         uint       `json:"schedule_id" gorm:"not null;index"`
	SchoolID           uint       `json:"school_id" gorm:"not null;index"`
	CourierID          uint       `json:"courier_id" gorm:"not null;index"`
	Status             string     `json:"status" gorm:"type:enum('pending','in_transit','delivered','failed');not null;default:'pending'"`
	ActualDeliveryTime *time.Time `json:"actual_delivery_time" gorm:"type:datetime"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`

	// Relations
	Schedule *Schedule `json:"schedule,omitempty" gorm:"foreignKey:ScheduleID"`
	School   *School   `json:"school,omitempty" gorm:"foreignKey:SchoolID"`
	Courier  *User     `json:"courier,omitempty" gorm:"foreignKey:CourierID"`
}

func (Delivery) TableName() string { return "deliveries" }

// TrackingHistory stores batched GPS coordinates from courier devices.
// Couriers cache GPS locally and sync in bulk every few minutes.
type TrackingHistory struct {
	ID         uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	CourierID  uint      `json:"courier_id" gorm:"not null;index"`
	DeliveryID *uint     `json:"delivery_id" gorm:"index"`
	Latitude   float64   `json:"latitude" gorm:"type:double;not null"`
	Longitude  float64   `json:"longitude" gorm:"type:double;not null"`
	RecordedAt time.Time `json:"recorded_at" gorm:"type:datetime;not null"`
	Speed      *float64  `json:"speed" gorm:"type:double"`
	Heading    *float64  `json:"heading" gorm:"type:double"`
	Accuracy   *float64  `json:"accuracy" gorm:"type:double"`
	CreatedAt  time.Time `json:"created_at"`

	// Relations
	Courier  *User     `json:"courier,omitempty" gorm:"foreignKey:CourierID"`
	Delivery *Delivery `json:"delivery,omitempty" gorm:"foreignKey:DeliveryID"`
}

func (TrackingHistory) TableName() string { return "tracking_histories" }

// ============================================================================
// Request/Response DTOs
// ============================================================================

// LoginRequest is the payload for POST /api/auth/login.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// RegisterRequest is the payload for POST /api/auth/register.
type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role" binding:"required,oneof=admin guru dapur kurir"`
}

// ExpirationRequest is the payload for calculating expiration.
type ExpirationRequest struct {
	Category    string  `json:"category" binding:"required,oneof=Kering Basah Santan"`
	CookTime    string  `json:"cook_time" binding:"required"` // RFC3339
	Temperature float64 `json:"temperature"`
}

// ExpirationResponse is the result of expiration calculation.
type ExpirationResponse struct {
	Category       string    `json:"category"`
	CookTime       time.Time `json:"cook_time"`
	ExpirationTime time.Time `json:"expiration_time"`
	ShelfLifeHours float64   `json:"shelf_life_hours"`
	EpsilonScore   float64   `json:"epsilon_score"`
	Temperature    float64   `json:"temperature"`
	TempAdjusted   bool      `json:"temp_adjusted"`
}

// BatchTrackingRequest accepts an array of GPS coordinates from the courier app.
type BatchTrackingRequest struct {
	CourierID  uint                 `json:"courier_id" binding:"required"`
	DeliveryID *uint               `json:"delivery_id"`
	Points    []TrackingPointInput `json:"points" binding:"required,min=1"`
}

// TrackingPointInput is a single GPS point in a batch upload.
type TrackingPointInput struct {
	Latitude   float64  `json:"latitude" binding:"required"`
	Longitude  float64  `json:"longitude" binding:"required"`
	RecordedAt string   `json:"recorded_at" binding:"required"` // RFC3339
	Speed      *float64 `json:"speed"`
	Heading    *float64 `json:"heading"`
	Accuracy   *float64 `json:"accuracy"`
}

// MenuRecommendRequest is the payload for Gemini Menu Recommender.
type MenuRecommendRequest struct {
	AvailableIngredients []string `json:"available_ingredients" binding:"required,min=1"`
	StudentCount         int      `json:"student_count" binding:"required,min=1"`
	Preferences          string   `json:"preferences"`
}
