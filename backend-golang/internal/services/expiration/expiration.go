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

// rules maps each category to its expiration parameters.
var rules = map[string]categoryRule{
	"Santan": {ShelfLifeHours: 4.0, Epsilon: 0.8},
	"Basah":  {ShelfLifeHours: 6.0, Epsilon: 0.5},
	"Kering": {ShelfLifeHours: 12.0, Epsilon: 0.2},
}

// CalculateExpiration computes the expiration time and epsilon score.
//
// Parameters:
//   - category: "Santan", "Basah", or "Kering"
//   - cookTime: when the food finished cooking
//   - temperature: ambient temperature in °C
//
// Returns:
//   - expirationTime: absolute deadline for safe consumption
//   - epsilonScore: urgency factor (0.0–1.0, higher = more urgent)
//
// Rules:
//   - "Santan" → 4 hrs shelf-life, ε = 0.8
//   - "Basah"  → 6 hrs shelf-life, ε = 0.5
//   - "Kering" → 12 hrs shelf-life, ε = 0.2
//   - If temperature > 30°C → reduce shelf-life by 20%, add 0.1 to ε
func CalculateExpiration(category string, cookTime time.Time, temperature float64) *Result {
	rule, exists := rules[category]
	if !exists {
		// Default to most conservative (Santan) if unknown category
		rule = rules["Santan"]
		category = "Santan"
	}

	shelfLife := rule.ShelfLifeHours
	epsilon := rule.Epsilon
	tempAdjusted := false

	// Temperature adjustment: >30°C degrades food faster
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
