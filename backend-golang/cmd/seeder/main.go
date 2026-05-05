package main

import (
	"fmt"
	"log"
	"time"

	"backend-golang/internal/config"
	"backend-golang/internal/database"
	"backend-golang/internal/models"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	fmt.Println("🌱 Starting MBG Smart Logistics Database Seeder...")

	// 1. Load config and connect to DB
	cfg := config.Load()
	db := database.Connect(cfg)

	// Clear existing data (in correct order to prevent FK constraints issues)
	fmt.Println("🧹 Clearing existing data...")
	db.Exec("SET FOREIGN_KEY_CHECKS = 0;")
	db.Exec("TRUNCATE TABLE tracking_histories;")
	db.Exec("TRUNCATE TABLE deliveries;")
	db.Exec("TRUNCATE TABLE schedules;")
	db.Exec("TRUNCATE TABLE menus;")
	db.Exec("TRUNCATE TABLE ingredients;")
	db.Exec("TRUNCATE TABLE schools;")
	db.Exec("TRUNCATE TABLE users;")
	db.Exec("SET FOREIGN_KEY_CHECKS = 1;")

	// Generate standard password hash
	hashedPasswordBytes, err := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("Failed to hash password:", err)
	}
	hashedPassword := string(hashedPasswordBytes)

	// 2. Users Table
	fmt.Println("👤 Seeding Users...")
	users := []models.User{
		{Name: "Yosua Gracetheo Boimau", Role: "admin", Email: "admin@mbg.com", Password: hashedPassword},
		{Name: "Faizal", Role: "kurir", Email: "kurir@mbg.com", Password: hashedPassword},
		{Name: "Gevura", Role: "dapur", Email: "dapur@mbg.com", Password: hashedPassword},
		{Name: "Evan Novandi Krismanuel", Role: "guru", Email: "guru@mbg.com", Password: hashedPassword},
	}
	if err := db.Create(&users).Error; err != nil {
		log.Fatal("Failed to seed users:", err)
	}

	// 3. Schools Table
	fmt.Println("🏫 Seeding Schools...")
	schools := []models.School{
		{Name: "SMA Kalam Kudus Malang", Latitude: -7.9734, Longitude: 112.6321, DemandQuantity: 150},
		{Name: "SMAN 3 Malang", Latitude: -7.9768, Longitude: 112.6335, DemandQuantity: 200},
		{Name: "SMAN 4 Malang", Latitude: -7.9772, Longitude: 112.6332, DemandQuantity: 120},
	}
	if err := db.Create(&schools).Error; err != nil {
		log.Fatal("Failed to seed schools:", err)
	}

	// 4. Ingredients & Menus
	fmt.Println("🥘 Seeding Ingredients and Menus...")
	now := time.Now()
	ingredients := []models.Ingredient{
		{Name: "Beras", Quantity: 100, Unit: "kg", ScannedAt: &now},
		{Name: "Ayam", Quantity: 50, Unit: "kg", ScannedAt: &now},
		{Name: "Santan", Quantity: 20, Unit: "L", ScannedAt: &now},
		{Name: "Sayur Sawi", Quantity: 30, Unit: "kg", ScannedAt: &now},
	}
	if err := db.Create(&ingredients).Error; err != nil {
		log.Fatal("Failed to seed ingredients:", err)
	}

	menus := []models.Menu{
		{Name: "Nasi Ayam Bakar", Category: "Kering", IngredientsRequired: "Beras, Ayam"},
		{Name: "Sayur Sop Ayam", Category: "Basah", IngredientsRequired: "Beras, Ayam, Sayur Sawi"},
		{Name: "Opor Ayam Santan", Category: "Santan", IngredientsRequired: "Beras, Ayam, Santan"},
	}
	if err := db.Create(&menus).Error; err != nil {
		log.Fatal("Failed to seed menus:", err)
	}

	// 5. Schedules & Deliveries
	fmt.Println("📅 Seeding Schedules and Deliveries...")
	oneHourAgo := now.Add(-1 * time.Hour)

	schedules := []models.Schedule{
		// Kering - 12 hours shelf life. Expiration = 11 hours left. Low epsilon.
		{MenuID: menus[0].ID, CookingCompletionTime: oneHourAgo, ExpirationTime: oneHourAgo.Add(12 * time.Hour), EpsilonScore: 0.20},
		// Basah - 6 hours shelf life. Expiration = 5 hours left. Medium epsilon.
		{MenuID: menus[1].ID, CookingCompletionTime: oneHourAgo, ExpirationTime: oneHourAgo.Add(6 * time.Hour), EpsilonScore: 0.55},
		// Santan - 4 hours shelf life. Expiration = 3 hours left. High epsilon.
		{MenuID: menus[2].ID, CookingCompletionTime: oneHourAgo, ExpirationTime: oneHourAgo.Add(4 * time.Hour), EpsilonScore: 0.85},
	}
	if err := db.Create(&schedules).Error; err != nil {
		log.Fatal("Failed to seed schedules:", err)
	}

	kurirID := users[1].ID // Faizal
	deliveries := []models.Delivery{
		{ScheduleID: schedules[0].ID, SchoolID: schools[0].ID, CourierID: kurirID, Status: "in_transit"},
		{ScheduleID: schedules[1].ID, SchoolID: schools[1].ID, CourierID: kurirID, Status: "in_transit"},
		{ScheduleID: schedules[2].ID, SchoolID: schools[2].ID, CourierID: kurirID, Status: "in_transit"},
	}
	if err := db.Create(&deliveries).Error; err != nil {
		log.Fatal("Failed to seed deliveries:", err)
	}

	// 6. Tracking Histories
	fmt.Println("📍 Seeding Tracking Histories...")
	// Realistic GPS points tracing a route in Malang
	floatPtr := func(v float64) *float64 { return &v }
	trackings := []models.TrackingHistory{
		{CourierID: kurirID, DeliveryID: &deliveries[0].ID, Latitude: -7.9700, Longitude: 112.6310, RecordedAt: now.Add(-10 * time.Minute), Speed: floatPtr(25.5), Heading: floatPtr(90.0), Accuracy: floatPtr(5.0)},
		{CourierID: kurirID, DeliveryID: &deliveries[0].ID, Latitude: -7.9715, Longitude: 112.6315, RecordedAt: now.Add(-5 * time.Minute), Speed: floatPtr(30.2), Heading: floatPtr(95.0), Accuracy: floatPtr(4.5)},
		{CourierID: kurirID, DeliveryID: &deliveries[0].ID, Latitude: -7.9725, Longitude: 112.6318, RecordedAt: now.Add(-2 * time.Minute), Speed: floatPtr(15.0), Heading: floatPtr(120.0), Accuracy: floatPtr(5.2)},
		{CourierID: kurirID, DeliveryID: &deliveries[0].ID, Latitude: -7.9730, Longitude: 112.6320, RecordedAt: now, Speed: floatPtr(5.5), Heading: floatPtr(130.0), Accuracy: floatPtr(3.0)}, // Very close to SMA Kalam Kudus
	}
	if err := db.Create(&trackings).Error; err != nil {
		log.Fatal("Failed to seed tracking histories:", err)
	}

	fmt.Println("✅ Database successfully seeded!")
}
