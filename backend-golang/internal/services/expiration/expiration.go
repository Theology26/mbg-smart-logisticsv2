package expiration

import (
	"time"
)

// ============================================================================
// Rule-Based Expiration Service
// ============================================================================
// Calculates food expiration time and epsilon (urgency) score based on:
//   - Category: "Santan" → 4h (ε=0.8), "Basah" → 6h (ε=0.5), "Kering" → 12h (ε=0.2)
//   - Temperature: If >30°C → reduce time by 20%, add 0.1 to ε
// ============================================================================

// Result holds the computed expiration data.
type Result struct {
	Category       string    `json:"category"`
	CookTime       time.Time `json:"cook_time"`
	ExpirationTime time.Time `json:"expiration_time"`
	ShelfLifeHours float64   `json:"shelf_life_hours"`
	EpsilonScore   float64   `json:"epsilon_score"`
	Temperature    float64   `json:"temperature"`
	TempAdjusted   bool      `json:"temp_adjusted"`
}

// categoryRule defines the shelf-life and epsilon for a food category.
type categoryRule struct {
	ShelfLifeHours float64
	Epsilon        float64
}

// CalculateExpiration computes the expiration time and epsilon score based on dynamic rules.
func CalculateExpiration(category string, cookTime time.Time, temperature float64, shelfLife float64, epsilon float64) *Result {
	tempAdjusted := false

	// Temperature adjustment: >30°C degrades items faster (if applicable)
	if temperature > 30.0 {
		shelfLife *= 0.8  // Reduce by 20%
		epsilon += 0.1    // Increase urgency
		tempAdjusted = true
	}

	// Cap epsilon at 1.0
	if epsilon > 1.0 {
		epsilon = 1.0
	}

	expirationTime := cookTime.Add(time.Duration(shelfLife * float64(time.Hour)))

	return &Result{
		Category:       category,
		CookTime:       cookTime,
		ExpirationTime: expirationTime,
		ShelfLifeHours: shelfLife,
		EpsilonScore:   epsilon,
		Temperature:    temperature,
		TempAdjusted:   tempAdjusted,
	}
}
