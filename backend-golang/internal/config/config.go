package config

import (
	"log"
	"os"
	"strconv"
)

// ============================================================================
// MBG Smart Logistics — Configuration
// ============================================================================

// Config holds all application configuration from environment variables.
type Config struct {
	// Database (MySQL)
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	// OSRM Routing Engine
	OSRMBaseURL string

	// AI Services (Python FastAPI)
	AIServiceURL string

	// Gemini AI (Menu Recommender)
	GeminiAPIKey string
	GeminiModel  string

	// Server
	ServerPort string
	JWTSecret  string

	// Logistics Parameters
	ShelfLifeBufferMinutes    int
	DefaultServiceTimeSeconds int
	MaxImprovementIterations  int
}

// Load reads configuration from environment variables.
func Load() *Config {
	loadDotEnv()

	return &Config{
		// Database (MySQL)
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBUser:     getEnv("DB_USER", "mbg_admin"),
		DBPassword: getEnv("DB_PASSWORD", "mbg_secure_2026"),
		DBName:     getEnv("DB_NAME", "mbg_smart_logistics"),

		// OSRM
		OSRMBaseURL: getEnv("OSRM_BASE_URL", "http://localhost:5000"),

		// AI Services
		AIServiceURL: getEnv("AI_SERVICE_URL", "http://localhost:9000"),

		// Gemini (Menu Recommender only)
		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		GeminiModel:  getEnv("GEMINI_MODEL", "gemini-2.0-flash"),

		// Server
		ServerPort: getEnv("SERVER_PORT", "8080"),
		JWTSecret:  getEnv("JWT_SECRET", "mbg-default-secret-change-me"),

		// Logistics
		ShelfLifeBufferMinutes:    getEnvInt("SHELF_LIFE_BUFFER_MINUTES", 30),
		DefaultServiceTimeSeconds: getEnvInt("DEFAULT_SERVICE_TIME_SECONDS", 300),
		MaxImprovementIterations:  getEnvInt("MAX_IMPROVEMENT_ITERATIONS", 1000),
	}
}

// loadDotEnv reads key=value pairs from a .env file.
func loadDotEnv() {
	data, err := os.ReadFile(".env")
	if err != nil {
		log.Println("⚠️  No .env file found, using system environment variables")
		return
	}

	lines := splitLines(string(data))
	for _, line := range lines {
		line = trimSpace(line)
		if line == "" || line[0] == '#' {
			continue
		}
		parts := splitFirst(line, '=')
		if len(parts) == 2 {
			key := trimSpace(parts[0])
			val := trimSpace(parts[1])
			if os.Getenv(key) == "" {
				os.Setenv(key, val)
			}
		}
	}
	log.Println("✅ Loaded configuration from .env file")
}

func getEnv(key, fallback string) string {
	if v, exists := os.LookupEnv(key); exists {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

// String helper functions (zero-dependency .env parser).
func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			line := s[start:i]
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			lines = append(lines, line)
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\r' || s[start] == '\n') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\r' || s[end-1] == '\n') {
		end--
	}
	return s[start:end]
}

func splitFirst(s string, sep byte) []string {
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			return []string{s[:i], s[i+1:]}
		}
	}
	return []string{s}
}
