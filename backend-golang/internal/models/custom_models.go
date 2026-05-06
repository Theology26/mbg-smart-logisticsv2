package models

import (
	"time"
)

// ============================================================================
// Customized Settings Models (SQLite)
// ============================================================================

// Widget represents a customized dashboard widget configuration.
type Widget struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string    `json:"name" gorm:"type:varchar(255);not null"`
	Type      string    `json:"type" gorm:"type:varchar(50);not null"`
	Config    string    `json:"config" gorm:"type:text"` // JSON encoded config
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Widget) TableName() string { return "custom_widgets" }

// Chart represents a customized chart configuration for the dashboard.
type Chart struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Title     string    `json:"title" gorm:"type:varchar(255);not null"`
	ChartType string    `json:"chart_type" gorm:"type:varchar(50);not null"`
	DataQuery string    `json:"data_query" gorm:"type:text"` // Pre-defined query identifier
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Chart) TableName() string { return "custom_charts" }

// UIStyle represents customized styling for the web or mobile app.
type UIStyle struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	ThemeName string    `json:"theme_name" gorm:"type:varchar(100);not null"`
	Primary   string    `json:"primary_color" gorm:"type:varchar(20)"`
	Secondary string    `json:"secondary_color" gorm:"type:varchar(20)"`
	IsActive  bool      `json:"is_active" gorm:"default:false"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (UIStyle) TableName() string { return "custom_styles" }

// CustomMenu represents custom navigation menus configured by the admin.
type CustomMenu struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Label     string    `json:"label" gorm:"type:varchar(100);not null"`
	Path      string    `json:"path" gorm:"type:varchar(255);not null"`
	Icon      string    `json:"icon" gorm:"type:varchar(50)"`
	Role      string    `json:"role" gorm:"type:varchar(50);default:'admin'"`
	Order     int       `json:"order" gorm:"default:0"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (CustomMenu) TableName() string { return "custom_menus" }
