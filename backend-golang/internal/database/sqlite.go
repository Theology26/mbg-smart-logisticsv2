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
}
