package database

import (
	"log"

	"backend-golang/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ============================================================================
// SQLite Connection & Auto-Migration (Customized System)
// ============================================================================

// ConnectSQLite establishes a connection to SQLite for customized settings.
func ConnectSQLite() *gorm.DB {
	db, err := gorm.Open(sqlite.Open("customized.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("❌ Failed to connect to SQLite: %v", err)
	}

	log.Printf("✅ Connected to SQLite [customized.db]")

	// Run auto-migrations for custom tables
	autoMigrateSQLite(db)

	return db
}

// autoMigrateSQLite creates or updates custom database tables.
func autoMigrateSQLite(db *gorm.DB) {
	log.Println("🔄 Running auto-migrations for SQLite...")

	err := db.AutoMigrate(
		&models.Widget{},
		&models.Chart{},
		&models.UIStyle{},
		&models.CustomMenu{},
		&models.SystemRule{},
		&models.IndustryConfig{},
		&models.CustomLabel{},
		&models.GlobalSetting{},
	)
	if err != nil {
		log.Fatalf("❌ SQLite auto-migration failed: %v", err)
	}

	// Seed some default customized settings if empty
	seedSQLite(db)

	log.Println("✅ SQLite auto-migration completed (4 tables)")
}

func seedSQLite(db *gorm.DB) {
	var count int64
	db.Model(&models.Widget{}).Count(&count)
	if count == 0 {
		db.Create(&models.Widget{Name: "Summary Stats", Type: "stats", Config: `{"show_courier": true}`, IsActive: true})
		db.Create(&models.Chart{Title: "Delivery Performance", ChartType: "bar", DataQuery: "delivery_performance"})
		db.Create(&models.UIStyle{ThemeName: "Default Dark", Primary: "#22c55e", Secondary: "#3b82f6", IsActive: true})
		db.Create(&models.CustomMenu{Label: "Custom Reports", Path: "/reports", Icon: "chart", Role: "admin", Order: 99})
		log.Println("🌱 Seeded default SQLite customized settings")
	}

	// Seed System Rules (Food Logistics Defaults)
	var ruleCount int64
	db.Model(&models.SystemRule{}).Count(&ruleCount)
	if ruleCount == 0 {
		db.Create(&models.SystemRule{CategoryName: "Kering", UrgencyFactor: 0.2, ExpiryHours: 12, Description: "Food with low moisture (shelf life 12h)"})
		db.Create(&models.SystemRule{CategoryName: "Basah", UrgencyFactor: 0.5, ExpiryHours: 6, Description: "Food with medium moisture (shelf life 6h)"})
		db.Create(&models.SystemRule{CategoryName: "Santan", UrgencyFactor: 0.8, ExpiryHours: 4, Description: "Food containing coconut milk (shelf life 4h)"})
		log.Println("🌱 Seeded default AI System Rules (Food)")
	}

	// Seed Industry Config
	var configCount int64
	db.Model(&models.IndustryConfig{}).Count(&configCount)
	if configCount == 0 {
		db.Create(&models.IndustryConfig{
			IndustryName:     "MBG Smart Logistics",
			DestinationLabel: "Sekolah",
			ItemLabel:        "Menu",
			CompanyAddress:   "Jl. Raya MBG No. 123, Jakarta, Indonesia",
			CompanyEmail:     "info@mbglogistics.com",
			CompanyPhone:     "+62 812 3456 7890",
			DefaultLat:       -6.2000,
			DefaultLng:       106.8166,
			DefaultZoom:      13,
			Currency:         "IDR",
			DistanceUnit:     "km",
			WeightUnit:       "kg",
		})
		log.Println("🌱 Seeded default Detailed Industry Configuration")
	}

	// Seed Custom Labels
	var labelCount int64
	db.Model(&models.CustomLabel{}).Count(&labelCount)
	if labelCount == 0 {
		db.Create(&models.CustomLabel{LabelKey: "Dest_Label", LabelValue: "Sekolah", Category: "General"})
		db.Create(&models.CustomLabel{LabelKey: "Item_Label", LabelValue: "Menu", Category: "General"})
		db.Create(&models.CustomLabel{LabelKey: "Delivery_Label", LabelValue: "Pengiriman", Category: "General"})
		log.Println("🌱 Seeded default Custom Labels")
	}

	// Seed Global Settings (White-labeling)
	var settingsCount int64
	db.Model(&models.GlobalSetting{}).Count(&settingsCount)
	if settingsCount == 0 {
		settings := []models.GlobalSetting{
			{Key: "app_name", Value: "MBG Smart Logistics"},
			{Key: "theme_color", Value: "#3b82f6"},
			{Key: "enable_ai_menu", Value: "true"},
			{Key: "delivery_radius_km", Value: "15"},
			{Key: "company_logo_url", Value: "https://via.placeholder.com/150"},
			{Key: "currency_symbol", Value: "Rp"},
			{Key: "contact_email", Value: "admin@mbg-saas.com"},
			{Key: "map_center_lat", Value: "-7.9839"},
			{Key: "map_center_lng", Value: "112.6214"},
			{Key: "max_courier_load_kg", Value: "50"},
			{Key: "strict_expiration_mode", Value: "true"},
		}
		db.Create(&settings)
		log.Println("🌱 Seeded exhaustive Global Settings in SQLite")
	}
}
