package gemini

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// ============================================================================
// Gemini AI Client — Menu Recommender
// ============================================================================
// Used exclusively by role "dapur" (kitchen) for text-based menu recommendations
// based on available ingredients and student count.
// ============================================================================

// Client is the Gemini API client using REST.
type Client struct {
	APIKey     string
	Model      string
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient creates a new Gemini API client.
func NewClient(apiKey, model string) *Client {
	return &Client{
		APIKey:  apiKey,
		Model:   model,
		BaseURL: "https://generativelanguage.googleapis.com/v1beta",
		HTTPClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// MenuRecommendation holds a single menu suggestion.
type MenuRecommendation struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Ingredients string `json:"ingredients"`
	Reasoning   string `json:"reasoning"`
	ShelfLife   string `json:"shelf_life_estimate"`
}

// MenuRecommendResult contains the full recommendation response.
type MenuRecommendResult struct {
	Recommendations []MenuRecommendation `json:"recommendations"`
	Notes           string               `json:"notes"`
}

// RecommendMenu asks Gemini to suggest menus based on available ingredients.
func (c *Client) RecommendMenu(ingredients []string, studentCount int, preferences string) (*MenuRecommendResult, error) {
	if c.APIKey == "" {
		log.Println("⚠️  Gemini API key not set, returning fallback menu recommendations")
		return c.fallbackRecommend(ingredients), nil
	}

	userPrompt := fmt.Sprintf(
		"Bahan tersedia: %v. Jumlah siswa: %d. Preferensi: %s",
		ingredients, studentCount, preferences,
	)

	responseText, err := c.generateContent(MenuRecommenderPrompt, userPrompt)
	if err != nil {
		log.Printf("⚠️  Gemini API error, using fallback: %v", err)
		return c.fallbackRecommend(ingredients), nil
	}

	var result MenuRecommendResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		log.Printf("⚠️  Failed to parse Gemini response, using fallback: %v", err)
		return c.fallbackRecommend(ingredients), nil
	}

	log.Printf("🤖 [GEMINI] Recommended %d menus for %d students",
		len(result.Recommendations), studentCount)

	return &result, nil
}

// ============================================================================
// Gemini REST API Communication
// ============================================================================

type geminiRequest struct {
	Contents       []geminiContent       `json:"contents"`
	SystemInstruct *geminiSystemInstruct `json:"system_instruction,omitempty"`
	GenConfig      *geminiGenConfig      `json:"generationConfig,omitempty"`
}

type geminiSystemInstruct struct {
	Parts []geminiPart `json:"parts"`
}

type geminiContent struct {
	Role  string       `json:"role"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text,omitempty"`
}

type geminiGenConfig struct {
	Temperature     float64 `json:"temperature"`
	MaxOutputTokens int     `json:"maxOutputTokens"`
	ResponseMime    string  `json:"responseMimeType,omitempty"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error,omitempty"`
}

func (c *Client) generateContent(systemPrompt, userPrompt string) (string, error) {
	reqBody := geminiRequest{
		SystemInstruct: &geminiSystemInstruct{
			Parts: []geminiPart{{Text: systemPrompt}},
		},
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: userPrompt}}},
		},
		GenConfig: &geminiGenConfig{
			Temperature:     0.4,
			MaxOutputTokens: 2048,
			ResponseMime:    "application/json",
		},
	}

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", c.BaseURL, c.Model, c.APIKey)
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Gemini API returned status %d: %s", resp.StatusCode, string(body))
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", fmt.Errorf("failed to parse Gemini response: %w", err)
	}

	if geminiResp.Error != nil {
		return "", fmt.Errorf("Gemini error: %s (code: %d)", geminiResp.Error.Message, geminiResp.Error.Code)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

// fallbackRecommend provides static recommendations when Gemini is unavailable.
func (c *Client) fallbackRecommend(ingredients []string) *MenuRecommendResult {
	return &MenuRecommendResult{
		Recommendations: []MenuRecommendation{
			{Name: "Nasi Goreng Spesial", Category: "Kering", Ingredients: "beras, telur, bawang, kecap", Reasoning: "Praktis dan disukai anak-anak", ShelfLife: "12 jam"},
			{Name: "Sayur Sop Ayam", Category: "Basah", Ingredients: "ayam, wortel, kentang, seledri", Reasoning: "Bergizi tinggi protein", ShelfLife: "6 jam"},
			{Name: "Opor Ayam", Category: "Santan", Ingredients: "ayam, santan, bumbu opor", Reasoning: "Menu favorit nasional", ShelfLife: "4 jam"},
		},
		Notes: "(Fallback Mode) Gemini API unavailable. Showing default recommendations.",
	}
}

// MenuRecommenderPrompt is the system prompt for menu recommendations.
const MenuRecommenderPrompt = `Kamu adalah ahli gizi dan chef untuk program Makanan Bergizi Gratis (MBG) di Kota Malang. Tugasmu merekomendasikan menu masakan berdasarkan bahan yang tersedia.

KONTEKS:
- Program MBG menyediakan makan siang untuk siswa sekolah
- Menu harus bergizi seimbang sesuai standar Kemenkes
- Kategori masakan: Kering (tahan 12 jam), Basah (tahan 6 jam), Santan (tahan 4 jam)
- Prioritaskan menu Kering jika waktu pengiriman panjang

FORMAT OUTPUT — WAJIB JSON VALID:
{
  "recommendations": [
    {
      "name": "nama menu",
      "category": "Kering|Basah|Santan",
      "ingredients": "daftar bahan yang digunakan",
      "reasoning": "alasan rekomendasi (gizi, preferensi anak)",
      "shelf_life_estimate": "estimasi ketahanan"
    }
  ],
  "notes": "catatan tambahan"
}

Berikan 3-5 rekomendasi menu. HANYA output JSON.`
