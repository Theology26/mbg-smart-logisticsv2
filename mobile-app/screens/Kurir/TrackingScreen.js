import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, SafeAreaView, AppState,
} from 'react-native'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_CONFIG, TRACKING_CONFIG, STORAGE_KEYS } from '../../constants/config'

// ============================================================================
// TrackingScreen — Kurir (Courier) Role
// ============================================================================
// Architecture (Lecturer's Batch Cache & Sync):
//   - Caches GPS point every 10 seconds → AsyncStorage
//   - Uploads batch to POST /api/tracking/batch every 3 minutes
//   - Flushes early if cache reaches 50 points
//   - Displays A2C routing sequence from the backend
//   - Works in background via AppState change handling
// ============================================================================

export default function TrackingScreen() {
  // ── State ─────────────────────────────────────────────────────
  const [trackingActive, setTrackingActive] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [cachedPoints, setCachedPoints] = useState(0)
  const [lastUpload, setLastUpload] = useState(null)
  const [uploadCount, setUploadCount] = useState(0)
  const [routeSequence, setRouteSequence] = useState([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [deliveryId, setDeliveryId] = useState(null)
  const [statusLog, setStatusLog] = useState([])

  // ── Refs ──────────────────────────────────────────────────────
  const locationSubscription = useRef(null)
  const gpsCacheInterval = useRef(null)
  const batchUploadInterval = useRef(null)
  const appStateRef = useRef(AppState.currentState)

  // ── Lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    requestPermissions()
    loadCachedRoute()

    const appStateSub = AppState.addEventListener('change', handleAppStateChange)
    return () => {
      stopTracking()
      appStateSub.remove()
    }
  }, [])

  // Resume tracking after app returns to foreground
  function handleAppStateChange(nextState) {
    if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
      if (trackingActive) {
        addLog('📱 App kembali ke foreground, tracking dilanjutkan')
      }
    }
    appStateRef.current = nextState
  }

  // ── Permissions ───────────────────────────────────────────────
  async function requestPermissions() {
    const { status: fg } = await Location.requestForegroundPermissionsAsync()
    if (fg !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izin lokasi diperlukan untuk tracking pengiriman.')
      return false
    }
    const { status: bg } = await Location.requestBackgroundPermissionsAsync()
    if (bg !== 'granted') {
      addLog('⚠️ Izin background terbatas — tracking akan berhenti saat app tertutup')
    }
    return true
  }

  // ── Auth ──────────────────────────────────────────────────────
  async function getAuthHeaders() {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  async function getCourierInfo() {
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA)
    return userData ? JSON.parse(userData) : null
  }

  // ── GPS Cache (AsyncStorage) ──────────────────────────────────
  // Loads existing cached points from storage
  async function loadCachedPoints() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.GPS_CACHE)
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  }

  // Appends a new GPS point to the AsyncStorage cache
  async function cacheGPSPoint(location) {
    try {
      const existing = await loadCachedPoints()
      const point = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        recorded_at: new Date().toISOString(),
        speed: location.coords.speed,
        heading: location.coords.heading,
        accuracy: location.coords.accuracy,
      }

      // Only cache if accuracy is good enough
      if (location.coords.accuracy > TRACKING_CONFIG.GPS_ACCURACY_THRESHOLD_M) {
        addLog(`⚠️ GPS kurang akurat (${location.coords.accuracy?.toFixed(0)}m) — dilewati`)
        return existing.length
      }

      const updated = [...existing, point]
      await AsyncStorage.setItem(STORAGE_KEYS.GPS_CACHE, JSON.stringify(updated))
      setCachedPoints(updated.length)

      // Auto-flush if cache is full
      if (updated.length >= TRACKING_CONFIG.MAX_BATCH_SIZE) {
        addLog(`📦 Cache penuh (${updated.length} titik), upload otomatis...`)
        await uploadBatch(updated)
      }

      return updated.length
    } catch (err) {
      addLog(`❌ Gagal cache GPS: ${err.message}`)
      return 0
    }
  }

  // ── Start Tracking ────────────────────────────────────────────
  async function startTracking() {
    const hasPermission = await requestPermissions()
    if (!hasPermission) return

    setTrackingActive(true)
    addLog('🟢 Tracking dimulai')

    // 1. Get initial position immediately
    const initial = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    })
    setCurrentLocation(initial)
    await cacheGPSPoint(initial)

    // 2. Cache a GPS point every 10 seconds
    gpsCacheInterval.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: TRACKING_CONFIG.GPS_CACHE_INTERVAL_MS,
        })
        setCurrentLocation(loc)
        const count = await cacheGPSPoint(loc)
        addLog(`📍 GPS dicache (${count} titik tersimpan)`)
      } catch (err) {
        addLog(`⚠️ GPS error: ${err.message}`)
      }
    }, TRACKING_CONFIG.GPS_CACHE_INTERVAL_MS)

    // 3. Upload batch every 3 minutes
    batchUploadInterval.current = setInterval(async () => {
      const points = await loadCachedPoints()
      if (points.length === 0) {
        addLog('📡 Tidak ada titik baru untuk diupload')
        return
      }
      await uploadBatch(points)
    }, TRACKING_CONFIG.BATCH_UPLOAD_INTERVAL_MS)
  }

  // ── Stop Tracking ─────────────────────────────────────────────
  function stopTracking() {
    if (locationSubscription.current) {
      locationSubscription.current.remove()
      locationSubscription.current = null
    }
    if (gpsCacheInterval.current) {
      clearInterval(gpsCacheInterval.current)
      gpsCacheInterval.current = null
    }
    if (batchUploadInterval.current) {
      clearInterval(batchUploadInterval.current)
      batchUploadInterval.current = null
    }
    setTrackingActive(false)
    addLog('🔴 Tracking dihentikan')
  }

  // ── Upload Batch to Golang Backend ────────────────────────────
  // POST /api/tracking/batch — sends accumulated GPS points
  async function uploadBatch(points) {
    if (!points?.length) return

    try {
      const headers = await getAuthHeaders()
      const user = await getCourierInfo()

      const payload = {
        courier_id: user?.id || 1,
        delivery_id: deliveryId || null,
        points: points.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude,
          recorded_at: p.recorded_at,
          speed: p.speed ?? null,
          heading: p.heading ?? null,
          accuracy: p.accuracy ?? null,
        })),
      }

      const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/tracking/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })

      const data = await response.json()

      if (response.ok) {
        // Clear the cache after successful upload
        await AsyncStorage.removeItem(STORAGE_KEYS.GPS_CACHE)
        setCachedPoints(0)
        setUploadCount(prev => prev + points.length)
        setLastUpload(new Date().toLocaleTimeString('id-ID'))
        addLog(`✅ ${points.length} titik GPS berhasil diupload ke server`)
      } else {
        addLog(`❌ Upload gagal: ${data.message || 'Server error'}`)
      }
    } catch (err) {
      addLog(`❌ Upload gagal: ${err.message} — data tetap tersimpan lokal`)
    }
  }

  // ── Manual Flush ──────────────────────────────────────────────
  async function manualFlush() {
    const points = await loadCachedPoints()
    if (points.length === 0) {
      Alert.alert('Info', 'Tidak ada data GPS yang tersimpan untuk diupload.')
      return
    }
    addLog(`📤 Manual upload: ${points.length} titik...`)
    await uploadBatch(points)
  }

  // ── Fetch A2C Route Sequence ──────────────────────────────────
  async function fetchRouteSequence() {
    setRouteLoading(true)
    try {
      const headers = await getAuthHeaders()

      // Get deliveries for this courier
      const deliveriesRes = await fetch(`${API_CONFIG.BACKEND_URL}/api/deliveries`, { headers })
      const deliveriesData = await deliveriesRes.json()
      const pending = (deliveriesData.data || []).filter(d => d.status === 'in_transit' || d.status === 'pending')

      if (pending.length === 0) {
        addLog('ℹ️ Tidak ada pengiriman aktif saat ini')
        return
      }

      // Build schools for A2C optimization request
      const schoolsRes = await fetch(`${API_CONFIG.BACKEND_URL}/api/schools`, { headers })
      const schoolsData = await schoolsRes.json()

      const schools = schoolsData.data?.slice(0, 20).map((s, i) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        demand: s.demand_quantity || 1,
        time_window_minutes: 90,
      })) || []

      // Call Python A2C optimizer
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const optimizeRes = await fetch(`${API_CONFIG.AI_SERVICE_URL}/routing/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depot_lat: -7.9666,
          depot_lng: 112.6326,
          schools,
          vehicle_capacity: 50,
          max_time_minutes: 120,
          temperature: 28,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId);

      const optimizeData = await optimizeRes.json()

      if (optimizeRes.ok) {
        setRouteSequence(optimizeData.route || [])
        setDeliveryId(pending[0]?.id || null)
        addLog(`🧠 Rute A2C: ${optimizeData.route?.length} sekolah dioptimasi (${optimizeData.device})`)
      } else {
        addLog('❌ Optimasi rute gagal')
      }
    } catch (err) {
      addLog(`❌ Fetch rute gagal: ${err.message}`)
    } finally {
      setRouteLoading(false)
    }
  }

  // ── Load Cached Route from Storage ───────────────────────────
  async function loadCachedRoute() {
    const cached = await loadCachedPoints()
    setCachedPoints(cached.length)
  }

  // ── Status Log ────────────────────────────────────────────────
  function addLog(message) {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setStatusLog(prev => [`[${time}] ${message}`, ...prev].slice(0, 15))
  }

  // ── UI Helpers ────────────────────────────────────────────────
  const epsilonColor = (epsilon) => {
    if (epsilon >= 0.8) return '#ef4444'
    if (epsilon >= 0.5) return '#f97316'
    return '#22c55e'
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🚚 GPS Tracker</Text>
          <View style={[styles.statusPill, trackingActive ? styles.pillActive : styles.pillInactive]}>
            <View style={[styles.statusDot, { backgroundColor: trackingActive ? '#22c55e' : '#6b7280' }]} />
            <Text style={[styles.pillText, { color: trackingActive ? '#4ade80' : '#9ca3af' }]}>
              {trackingActive ? 'AKTIF' : 'NONAKTIF'}
            </Text>
          </View>
        </View>

        {/* Main Toggle Button */}
        <TouchableOpacity
          style={[styles.mainBtn, trackingActive ? styles.mainBtnStop : styles.mainBtnStart]}
          onPress={trackingActive ? stopTracking : startTracking}
          activeOpacity={0.85}>
          <Text style={styles.mainBtnIcon}>{trackingActive ? '⏹' : '▶'}</Text>
          <Text style={styles.mainBtnText}>
            {trackingActive ? 'Hentikan Tracking' : 'Mulai Tracking GPS'}
          </Text>
        </TouchableOpacity>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{cachedPoints}</Text>
            <Text style={styles.statLabel}>Titik Cached</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{uploadCount}</Text>
            <Text style={styles.statLabel}>Total Diupload</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{lastUpload || '—'}</Text>
            <Text style={styles.statLabel}>Upload Terakhir</Text>
          </View>
        </View>

        {/* Current GPS */}
        {currentLocation && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 Posisi Saat Ini</Text>
            <Text style={styles.coordText}>
              {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
            </Text>
            <View style={styles.gpsDetails}>
              {currentLocation.coords.speed != null && (
                <Text style={styles.gpsDetail}>🏃 {(currentLocation.coords.speed * 3.6).toFixed(1)} km/h</Text>
              )}
              <Text style={styles.gpsDetail}>🎯 ±{currentLocation.coords.accuracy?.toFixed(0)}m</Text>
            </View>

            {/* Manual flush */}
            <TouchableOpacity style={styles.flushBtn} onPress={manualFlush} activeOpacity={0.8}>
              <Text style={styles.flushText}>📤 Upload Sekarang ({cachedPoints} titik)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Route Sequence — A2C */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>🧠 Urutan Pengiriman (A2C)</Text>
            <TouchableOpacity
              style={styles.routeBtn}
              onPress={fetchRouteSequence}
              disabled={routeLoading}
              activeOpacity={0.8}>
              <Text style={styles.routeBtnText}>{routeLoading ? '...' : 'Hitung Ulang'}</Text>
            </TouchableOpacity>
          </View>

          {routeSequence.length === 0 ? (
            <View style={styles.emptyRoute}>
              <Text style={styles.emptyIcon}>🗺️</Text>
              <Text style={styles.emptyText}>Belum ada rute. Tekan "Hitung Ulang" untuk optimasi.</Text>
              <Text style={styles.emptySubText}>Model A2C akan berjalan di GPU server.</Text>
            </View>
          ) : (
            routeSequence.map((stop, index) => (
              <View key={stop.school_id} style={styles.routeStop}>
                <View style={styles.routeSeqBadge}>
                  <Text style={styles.routeSeqNum}>{stop.sequence}</Text>
                </View>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeName}>{stop.school_name}</Text>
                  <Text style={styles.routeTime}>⏱ ~{stop.estimated_minutes} menit</Text>
                </View>
                {index < routeSequence.length - 1 && (
                  <View style={styles.routeConnector} />
                )}
              </View>
            ))
          )}
        </View>

        {/* Status Log */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Log Aktivitas</Text>
          {statusLog.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada aktivitas. Mulai tracking untuk melihat log.</Text>
          ) : (
            statusLog.map((log, i) => (
              <Text key={i} style={[
                styles.logEntry,
                log.includes('✅') ? styles.logSuccess :
                log.includes('❌') ? styles.logError :
                log.includes('⚠️') ? styles.logWarn : styles.logInfo
              ]}>
                {log}
              </Text>
            ))
          )}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Cara Kerja Batch Tracking</Text>
          <Text style={styles.infoText}>• GPS dicache lokal setiap <Text style={styles.infoEmphasis}>10 detik</Text></Text>
          <Text style={styles.infoText}>• Dikirim ke server setiap <Text style={styles.infoEmphasis}>3 menit</Text></Text>
          <Text style={styles.infoText}>• Max <Text style={styles.infoEmphasis}>50 titik</Text> sebelum flush otomatis</Text>
          <Text style={styles.infoText}>• Data aman jika internet terputus</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  scroll: { padding: 16, gap: 14 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillActive: { backgroundColor: '#022c16', borderColor: '#166534' },
  pillInactive: { backgroundColor: '#111827', borderColor: '#374151' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  mainBtn: { borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mainBtnStart: { backgroundColor: '#15803d' },
  mainBtnStop: { backgroundColor: '#991b1b' },
  mainBtnIcon: { fontSize: 20 },
  mainBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#111827', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1f2937' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#6b7280', fontSize: 10, marginTop: 2, textAlign: 'center' },

  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1f2937' },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  coordText: { color: '#22c55e', fontFamily: 'monospace', fontSize: 14, marginBottom: 8 },
  gpsDetails: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  gpsDetail: { color: '#6b7280', fontSize: 12 },
  flushBtn: { backgroundColor: '#1e3a2f', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#166534' },
  flushText: { color: '#4ade80', fontWeight: '600', fontSize: 13 },

  routeBtn: { backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#1d4ed8' },
  routeBtnText: { color: '#60a5fa', fontSize: 12, fontWeight: '600' },
  emptyRoute: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 32 },
  emptyText: { color: '#6b7280', fontSize: 13, textAlign: 'center' },
  emptySubText: { color: '#374151', fontSize: 11, textAlign: 'center' },

  routeStop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  routeSeqBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1e3a2f', borderWidth: 1, borderColor: '#166534', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  routeSeqNum: { color: '#4ade80', fontSize: 12, fontWeight: '700' },
  routeInfo: { flex: 1 },
  routeName: { color: '#f3f4f6', fontWeight: '500', fontSize: 13 },
  routeTime: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  routeConnector: { position: 'absolute', left: 13, top: 30, width: 2, height: 16, backgroundColor: '#1f2937' },

  logEntry: { fontSize: 11, marginBottom: 4, fontFamily: 'monospace', lineHeight: 16 },
  logSuccess: { color: '#4ade80' },
  logError: { color: '#f87171' },
  logWarn: { color: '#fbbf24' },
  logInfo: { color: '#6b7280' },

  infoBox: { backgroundColor: '#0f172a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e293b', gap: 4 },
  infoTitle: { color: '#94a3b8', fontWeight: '600', fontSize: 12, marginBottom: 6 },
  infoText: { color: '#475569', fontSize: 11 },
  infoEmphasis: { color: '#60a5fa', fontWeight: '600' },
})
