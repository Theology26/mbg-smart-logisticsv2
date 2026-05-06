// ============================================================================
// MBG Smart Logistics — API Service Constants
// ============================================================================

export const API_CONFIG = {
  // Golang backend
  BACKEND_URL: 'http://10.40.47.159:8080',      // ← Your Laptop's IP
  // Python AI service
  AI_SERVICE_URL: 'http://10.40.47.159:9000',   // ← Your Laptop's IP

  // Timeouts
  DEFAULT_TIMEOUT_MS: 30000,
  OCR_TIMEOUT_MS: 60000,
}

// GPS Tracking configuration (Batch Cache & Sync)
export const TRACKING_CONFIG = {
  GPS_CACHE_INTERVAL_MS: 10 * 1000,       // Cache a GPS point every 10 seconds
  BATCH_UPLOAD_INTERVAL_MS: 3 * 60 * 1000, // Upload batch every 3 minutes
  MAX_BATCH_SIZE: 50,                       // Flush if cache hits 50 points
  GPS_ACCURACY_THRESHOLD_M: 20,            // Discard readings > 20m accuracy
}

// AsyncStorage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@mbg_token',
  USER_DATA: '@mbg_user',
  GPS_CACHE: '@mbg_gps_cache',
}
