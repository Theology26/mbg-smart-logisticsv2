package database

import (
	"fmt"
	"log"
	"time"

	"backend-golang/internal/config"
	"backend-golang/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ============================================================================
// MySQL Connection & Auto-Migration
// ============================================================================

// Connect establishes a connection to MySQL and runs auto-migrations.
func Connect(cfg *config.Config) *gorm.DB {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Asia%%2FJakarta",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		NowFunc: func() time.Time {
			loc, _ := time.LoadLocation("Asia/Jakarta")
			return time.Now().In(loc)
		},
	})
	if err != nil {
		log.Fatalf("❌ Failed to connect to MySQL: %v", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("❌ Failed to get underlying SQL DB: %v", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

	log.Printf("✅ Connected to MySQL [%s:%s/%s]", cfg.DBHost, cfg.DBPort, cfg.DBName)

	// Run auto-migrations for all 7 tables
	autoMigrate(db)

	return db
}

// autoMigrate creates or updates all database tables.
func autoMigrate(db *gorm.DB) {
	log.Println("🔄 Running auto-migrations...")

	err := db.AutoMigrate(
		&models.User{},
		&models.School{},
		&models.Ingredient{},
		&models.Menu{},
		&models.Schedule{},
		&models.Delivery{},
		&models.TrackingHistory{},
		&models.Feedback{},
	)
	if err != nil {
		log.Fatalf("❌ Auto-migration failed: %v", err)
	}

	log.Println("✅ Auto-migration completed (8 tables)")
}
