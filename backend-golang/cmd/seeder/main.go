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

func ptr(i uint) *uint { return &i }
func floatPtr(v float64) *float64 { return &v }

func main() {
	fmt.Println("🌱 Starting MBG Smart Logistics Database Seeder (Scale: 50 Schools, 5 Kitchens)...")

	cfg := config.Load()
	db := database.Connect(cfg)

	fmt.Println("🧹 Clearing existing data...")
	db.Exec("SET FOREIGN_KEY_CHECKS = 0;")
	db.Exec("TRUNCATE TABLE feedbacks;")
	db.Exec("TRUNCATE TABLE tracking_histories;")
	db.Exec("TRUNCATE TABLE deliveries;")
	db.Exec("TRUNCATE TABLE schedules;")
	db.Exec("TRUNCATE TABLE menus;")
	db.Exec("TRUNCATE TABLE ingredients;")
	db.Exec("TRUNCATE TABLE schools;")
	db.Exec("TRUNCATE TABLE users;")
	db.Exec("SET FOREIGN_KEY_CHECKS = 1;")

	hashedPasswordBytes, err := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("Failed to hash password:", err)
	}
	hashedPassword := string(hashedPasswordBytes)

	// 2. Users Table
	fmt.Println("👤 Seeding Users (5 Kitchens, 5 Couriers)...")
	users := []models.User{
		{Name: "Yosua Admin", Role: "admin", Email: "admin@mbg.com", Password: hashedPassword},
		// 5 Dapurs (Kitchens) - Exact Tenants as requested
		{Name: "Dapur SPPG Blimbing", Role: "dapur", Email: "dapur1@mbg.com", Password: hashedPassword, DapurID: ptr(1)},
		{Name: "Dapur SPPG Klojen", Role: "dapur", Email: "dapur2@mbg.com", Password: hashedPassword, DapurID: ptr(2)},
		{Name: "Dapur SPPG Lowokwaru", Role: "dapur", Email: "dapur3@mbg.com", Password: hashedPassword, DapurID: ptr(3)},
		{Name: "Dapur SPPG Sukun", Role: "dapur", Email: "dapur4@mbg.com", Password: hashedPassword, DapurID: ptr(4)},
		{Name: "Dapur SPPG Kedungkandang", Role: "dapur", Email: "dapur5@mbg.com", Password: hashedPassword, DapurID: ptr(5)},
		// 5 Kurirs
		{Name: "Kurir Blimbing", Role: "kurir", Email: "kurir@mbg.com", Password: hashedPassword, DapurID: ptr(1)},
		{Name: "Kurir Klojen", Role: "kurir", Email: "kurir2@mbg.com", Password: hashedPassword, DapurID: ptr(2)},
		{Name: "Kurir Lowokwaru", Role: "kurir", Email: "kurir3@mbg.com", Password: hashedPassword, DapurID: ptr(3)},
		{Name: "Kurir Sukun", Role: "kurir", Email: "kurir4@mbg.com", Password: hashedPassword, DapurID: ptr(4)},
		{Name: "Kurir Kedungkandang", Role: "kurir", Email: "kurir5@mbg.com", Password: hashedPassword, DapurID: ptr(5)},
	}
	if err := db.Create(&users).Error; err != nil {
		log.Fatal("Failed to seed users:", err)
	}

	// 3. Schools Table (50 Schools in Malang)
	fmt.Println("🏫 Seeding 50 Schools...")
	schools := []models.School{
		{Name: "SDN Klojen 1", Latitude: -7.9723, Longitude: 112.6321, DemandQuantity: 120},
		{Name: "SDN Klojen 2", Latitude: -7.9734, Longitude: 112.6300, DemandQuantity: 150},
		{Name: "SDK Cor Jesu", Latitude: -7.9754, Longitude: 112.6311, DemandQuantity: 200},
		{Name: "SDN Rampal Celaket 1", Latitude: -7.9712, Longitude: 112.6345, DemandQuantity: 180},
		{Name: "SDN Kiduldalem 1", Latitude: -7.9801, Longitude: 112.6322, DemandQuantity: 90},
		{Name: "SDN Purwantoro 1", Latitude: -7.9621, Longitude: 112.6388, DemandQuantity: 210},
		{Name: "SMPN 1 Malang", Latitude: -7.9711, Longitude: 112.6288, DemandQuantity: 300},
		{Name: "SMPN 3 Malang", Latitude: -7.9768, Longitude: 112.6335, DemandQuantity: 250},
		{Name: "SMPN 5 Malang", Latitude: -7.9822, Longitude: 112.6211, DemandQuantity: 220},
		{Name: "SMPN 20 Malang", Latitude: -7.9901, Longitude: 112.6100, DemandQuantity: 150},
		{Name: "SMAN 1 Malang", Latitude: -7.9755, Longitude: 112.6266, DemandQuantity: 400},
		{Name: "SMAN 3 Malang", Latitude: -7.9765, Longitude: 112.6340, DemandQuantity: 350},
		{Name: "SMAN 4 Malang", Latitude: -7.9772, Longitude: 112.6332, DemandQuantity: 320},
		{Name: "SMAN 8 Malang", Latitude: -7.9521, Longitude: 112.6188, DemandQuantity: 280},
		{Name: "SMAK St. Albertus", Latitude: -7.9710, Longitude: 112.6355, DemandQuantity: 450},
		{Name: "SDN Blimbing 1", Latitude: -7.9400, Longitude: 112.6450, DemandQuantity: 130},
		{Name: "SDN Blimbing 3", Latitude: -7.9412, Longitude: 112.6420, DemandQuantity: 140},
		{Name: "SDN Purwodadi 1", Latitude: -7.9350, Longitude: 112.6500, DemandQuantity: 110},
		{Name: "SDN Jatimulyo 1", Latitude: -7.9480, Longitude: 112.6200, DemandQuantity: 160},
		{Name: "SDN Tunjungsekar 1", Latitude: -7.9300, Longitude: 112.6300, DemandQuantity: 175},
		{Name: "SDN Mojolangu 1", Latitude: -7.9450, Longitude: 112.6250, DemandQuantity: 125},
		{Name: "SMPN 11 Malang", Latitude: -7.9380, Longitude: 112.6400, DemandQuantity: 260},
		{Name: "SMPN 14 Malang", Latitude: -7.9320, Longitude: 112.6480, DemandQuantity: 240},
		{Name: "SMAN 9 Malang", Latitude: -7.9310, Longitude: 112.6250, DemandQuantity: 310},
		{Name: "SDN Dinoyo 1", Latitude: -7.9500, Longitude: 112.6050, DemandQuantity: 190},
		{Name: "SDN Dinoyo 2", Latitude: -7.9510, Longitude: 112.6030, DemandQuantity: 180},
		{Name: "SDN Ketawanggede", Latitude: -7.9550, Longitude: 112.6100, DemandQuantity: 140},
		{Name: "SDN Sumbersari 1", Latitude: -7.9600, Longitude: 112.6150, DemandQuantity: 160},
		{Name: "SDN Penanggungan", Latitude: -7.9650, Longitude: 112.6200, DemandQuantity: 200},
		{Name: "SMPN 4 Malang", Latitude: -7.9680, Longitude: 112.6250, DemandQuantity: 270},
		{Name: "SMPN 13 Malang", Latitude: -7.9520, Longitude: 112.6120, DemandQuantity: 230},
		{Name: "SMAN 2 Malang", Latitude: -7.9650, Longitude: 112.6300, DemandQuantity: 380},
		{Name: "SDN Madyopuro 1", Latitude: -7.9800, Longitude: 112.6600, DemandQuantity: 150},
		{Name: "SDN Madyopuro 2", Latitude: -7.9820, Longitude: 112.6580, DemandQuantity: 140},
		{Name: "SDN Sawojajar 1", Latitude: -7.9750, Longitude: 112.6550, DemandQuantity: 220},
		{Name: "SDN Sawojajar 3", Latitude: -7.9780, Longitude: 112.6520, DemandQuantity: 210},
		{Name: "SDN Lesanpuro 1", Latitude: -7.9900, Longitude: 112.6500, DemandQuantity: 170},
		{Name: "SMPN 21 Malang", Latitude: -7.9850, Longitude: 112.6550, DemandQuantity: 260},
		{Name: "SMAN 6 Malang", Latitude: -7.9880, Longitude: 112.6450, DemandQuantity: 330},
		{Name: "SMAN 10 Malang", Latitude: -7.9700, Longitude: 112.6500, DemandQuantity: 290},
		{Name: "SDN Bumiayu 1", Latitude: -8.0100, Longitude: 112.6350, DemandQuantity: 130},
		{Name: "SDN Gadang 1", Latitude: -8.0050, Longitude: 112.6300, DemandQuantity: 145},
		{Name: "SDN Kebonsari 1", Latitude: -8.0000, Longitude: 112.6250, DemandQuantity: 120},
		{Name: "SDN Sukun 1", Latitude: -7.9900, Longitude: 112.6200, DemandQuantity: 160},
		{Name: "SDN Tanjungrejo 1", Latitude: -7.9850, Longitude: 112.6250, DemandQuantity: 180},
		{Name: "SMPN 12 Malang", Latitude: -8.0000, Longitude: 112.6200, DemandQuantity: 250},
		{Name: "SMPN 17 Malang", Latitude: -7.9950, Longitude: 112.6250, DemandQuantity: 220},
		{Name: "SMAN 5 Malang", Latitude: -7.9800, Longitude: 112.6200, DemandQuantity: 340},
		{Name: "SDK Sang Timur", Latitude: -7.9705, Longitude: 112.6280, DemandQuantity: 190},
		{Name: "SDK Mardi Wiyata", Latitude: -7.9750, Longitude: 112.6300, DemandQuantity: 210},
	}
	
	// Assign DapurID (1 to 5) to Schools (10 per Dapur)
	for i := range schools {
		dapurIdx := uint((i / 10) + 1)
		schools[i].DapurID = &dapurIdx
	}
	
	if err := db.Create(&schools).Error; err != nil {
		log.Fatal("Failed to seed schools:", err)
	}

	fmt.Println("👨‍🏫 Seeding 50 Guru Users...")
	gurus := []models.User{}
	for i, school := range schools {
		gurus = append(gurus, models.User{
			Name: "Guru " + school.Name,
			Role: "guru",
			Email: fmt.Sprintf("guru%d@mbg.com", i+1),
			Password: hashedPassword,
			DapurID: school.DapurID,
			SchoolID: &school.ID,
		})
	}
	if err := db.Create(&gurus).Error; err != nil {
		log.Fatal("Failed to seed gurus:", err)
	}

	// 4. Ingredients & Menus
	fmt.Println("🥘 Seeding Ingredients and Menus...")
	now := time.Now()
	
	ingredients := []models.Ingredient{}
	for dID := uint(1); dID <= 5; dID++ {
		ingredients = append(ingredients,
			models.Ingredient{Name: "Beras", Quantity: 500, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Beras Danau B", Quantity: 100, Unit: "sak", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Ayam", Quantity: 200, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Daging Sapi", Quantity: 100, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Santan", Quantity: 50, Unit: "L", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Minyak Goreng", Quantity: 160, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Sayur Sawi", Quantity: 40, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Sayur Bayam", Quantity: 30, Unit: "ikat", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Bawang Merah", Quantity: 20, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Bawang Putih", Quantity: 15, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Telur", Quantity: 100, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Garam", Quantity: 5, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Gula", Quantity: 10, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Kopi AAA", Quantity: 10, Unit: "kg", DapurID: ptr(dID), ScannedAt: &now},
			models.Ingredient{Name: "Kecap Manis", Quantity: 20, Unit: "botol", DapurID: ptr(dID), ScannedAt: &now},
		)
	}
	if err := db.Create(&ingredients).Error; err != nil {
		log.Fatal("Failed to seed ingredients:", err)
	}

	menus := []models.Menu{
		{Name: "Nasi Ayam Bakar", Category: "Kering", IngredientsRequired: "Beras, Ayam, Bawang Merah, Bawang Putih, Kecap Manis"},
		{Name: "Sayur Sop Ayam", Category: "Basah", IngredientsRequired: "Beras, Ayam, Sayur Sawi, Bawang Putih"},
		{Name: "Opor Ayam Santan", Category: "Santan", IngredientsRequired: "Beras, Ayam, Santan, Bawang Merah"},
		{Name: "Nasi Goreng Spesial", Category: "Kering", IngredientsRequired: "Beras, Telur, Ayam, Minyak Goreng, Kecap Manis"},
		{Name: "Rendang Daging", Category: "Santan", IngredientsRequired: "Beras, Daging Sapi, Santan, Bawang Merah, Bawang Putih"},
		{Name: "Sayur Bayam Bening", Category: "Basah", IngredientsRequired: "Beras, Sayur Bayam, Bawang Merah"},
		{Name: "Nasi Telur Dadar", Category: "Kering", IngredientsRequired: "Beras, Telur, Minyak Goreng"},
		{Name: "Ayam Goreng Lengkuas", Category: "Kering", IngredientsRequired: "Beras, Ayam, Minyak Goreng"},
	}
	if err := db.Create(&menus).Error; err != nil {
		log.Fatal("Failed to seed menus:", err)
	}

	// 5. Schedules & Deliveries
	fmt.Println("📅 Seeding Schedules and Deliveries...")
	oneHourAgo := now.Add(-1 * time.Hour)
	
	t12 := oneHourAgo.Add(12 * time.Hour)
	t6 := oneHourAgo.Add(6 * time.Hour)
	t4 := oneHourAgo.Add(4 * time.Hour)

	schedules := []models.Schedule{
		{MenuID: menus[0].ID, CookingCompletionTime: &oneHourAgo, ExpirationTime: &t12, EpsilonScore: 0.20, IsCooked: true, DapurID: ptr(1)},
		{MenuID: menus[1].ID, CookingCompletionTime: &oneHourAgo, ExpirationTime: &t6, EpsilonScore: 0.55, IsCooked: true, DapurID: ptr(1)},
		{MenuID: menus[2].ID, CookingCompletionTime: &oneHourAgo, ExpirationTime: &t4, EpsilonScore: 0.85, IsCooked: true, DapurID: ptr(1)},
		{MenuID: menus[4].ID, CookingCompletionTime: &oneHourAgo, ExpirationTime: &t4, EpsilonScore: 0.90, IsCooked: true, DapurID: ptr(1)}, // Rendang
	}
	if err := db.Create(&schedules).Error; err != nil {
		log.Fatal("Failed to seed schedules:", err)
	}

	// Spread deliveries across couriers
	deliveries := []models.Delivery{}
	kurirs := []uint{users[6].ID, users[7].ID, users[8].ID, users[9].ID, users[10].ID} // Faizal, Budi, Cahyo, Dani, Eko

	// Assign 10 schools per courier
	for i, school := range schools {
		courierIndex := i / 10
		if courierIndex > 4 {
			courierIndex = 4
		}
		scheduleIndex := i % len(schedules)
		deliveries = append(deliveries, models.Delivery{
			ScheduleID: schedules[scheduleIndex].ID, 
			SchoolID: school.ID, 
			CourierID: kurirs[courierIndex], 
			Status: "pending",
		})
	}
	
	// Mark some as in_transit for Faizal (Courier 0)
	for i := 0; i < 3; i++ {
		deliveries[i].Status = "in_transit"
	}

	if err := db.Create(&deliveries).Error; err != nil {
		log.Fatal("Failed to seed deliveries:", err)
	}

	// 6. Tracking Histories
	fmt.Println("📍 Seeding Tracking Histories...")
	kurirID := users[6].ID // Faizal
	trackings := []models.TrackingHistory{
		{CourierID: kurirID, DeliveryID: &deliveries[0].ID, Latitude: -7.9700, Longitude: 112.6310, RecordedAt: now.Add(-10 * time.Minute), Speed: floatPtr(25.5), Heading: floatPtr(90.0), Accuracy: floatPtr(5.0)},
		{CourierID: kurirID, DeliveryID: &deliveries[0].ID, Latitude: -7.9715, Longitude: 112.6315, RecordedAt: now.Add(-5 * time.Minute), Speed: floatPtr(30.2), Heading: floatPtr(95.0), Accuracy: floatPtr(4.5)},
		{CourierID: kurirID, DeliveryID: &deliveries[0].ID, Latitude: -7.9725, Longitude: 112.6318, RecordedAt: now.Add(-2 * time.Minute), Speed: floatPtr(15.0), Heading: floatPtr(120.0), Accuracy: floatPtr(5.2)},
		{CourierID: kurirID, DeliveryID: &deliveries[0].ID, Latitude: -7.9730, Longitude: 112.6320, RecordedAt: now, Speed: floatPtr(5.5), Heading: floatPtr(130.0), Accuracy: floatPtr(3.0)},
	}
	if err := db.Create(&trackings).Error; err != nil {
		log.Fatal("Failed to seed tracking histories:", err)
	}

	fmt.Println("✅ Database successfully seeded!")
}
