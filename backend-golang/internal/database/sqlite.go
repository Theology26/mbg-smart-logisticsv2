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
			IndustryName: "MBG Smart Logistics",
			DestinationLabel: "Sekolah",
			ItemLabel: "Menu",
			Currency: "IDR",
		})
		log.Println("🌱 Seeded default Industry Configuration")
	}
}
