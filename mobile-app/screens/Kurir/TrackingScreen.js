import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, SafeAreaView, AppState, Dimensions
} from 'react-native'
import * as Location from 'expo-location'
import MapView, { Marker, Polyline } from 'react-native-maps'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_CONFIG, TRACKING_CONFIG, STORAGE_KEYS } from '../../constants/config'

const { width, height } = Dimensions.get('window')

export default function TrackingScreen() {
  // ── State ────────────────────────────────────────────────────
  const [trackingActive, setTrackingActive] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [cachedPoints, setCachedPoints] = useState(0)
  const [uploadCount, setUploadCount] = useState(0)
  const [routeSequence, setRouteSequence] = useState([])
  const [routeGeometry, setRouteGeometry] = useState([])  // decoded polyline coords
  const [routeLoading, setRouteLoading] = useState(false)
  const [statusLog, setStatusLog] = useState([])

  // ── Refs ─────────────────────────────────────────────────────
  const mapRef = useRef(null)
  const gpsCacheInterval = useRef(null)
  const batchUploadInterval = useRef(null)
  const appStateRef = useRef(AppState.currentState)

  // ── Lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    requestPermissions()
    loadInitialData()
    const appStateSub = AppState.addEventListener('change', handleAppStateChange)
    return () => {
      stopTracking()
      appStateSub.remove()
    }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────
  function addLog(msg) {
    const time = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
    setStatusLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10))
  }

  function handleAppStateChange(nextState) {
    if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
      if (trackingActive) addLog('📱 App aktif kembali')
    }
    appStateRef.current = nextState
  }

  // Decode Google-encoded polyline to [{latitude, longitude}] array
  function decodePolyline(encoded) {
    const points = []
    let index = 0
    const len = encoded.length
    let lat = 0
    let lng = 0
    while (index < len) {
      let b, shift = 0, result = 0
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      lat += ((result & 1) ? ~(result >> 1) : (result >> 1))
      shift = 0
      result = 0
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      lng += ((result & 1) ? ~(result >> 1) : (result >> 1))
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
    }
    return points
  }

  // ── Permissions ───────────────────────────────────────────────
  async function requestPermissions() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Izin Lokasi', 'Aplikasi butuh izin lokasi untuk tracking.')
      return false
    }
    return true
  }

  // ── Cache GPS to AsyncStorage ─────────────────────────────────
  async function loadInitialData() {
    const points = await loadCachedPointsFromStorage()
    setCachedPoints(points.length)
  }

  async function loadCachedPointsFromStorage() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.GPS_CACHE)
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  }

  async function cacheGPSPoint(location) {
    try {
      const existing = await loadCachedPointsFromStorage()
      const newPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        recorded_at: new Date().toISOString(),
        speed: location.coords.speed ?? 0,
        accuracy: location.coords.accuracy ?? 0,
      }
      const updated = [...existing, newPoint]
      await AsyncStorage.setItem(STORAGE_KEYS.GPS_CACHE, JSON.stringify(updated))
      setCachedPoints(updated.length)
      // Auto-upload when batch is full
      if (updated.length >= TRACKING_CONFIG.MAX_BATCH_SIZE) {
        await uploadBatch(updated)
      }
    } catch (err) {
      console.error('GPS cache error:', err)
    }
  }

  // ── Tracking Start / Stop ─────────────────────────────────────
  async function startTracking() {
    if (!await requestPermissions()) return
    setTrackingActive(true)
    addLog('🟢 Tracking GPS Aktif')

    // Record GPS every interval
    gpsCacheInterval.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        })
        setCurrentLocation(loc)
        await cacheGPSPoint(loc)
        // Auto-center map on current position
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000)
        }
      } catch (err) {
        addLog(`⚠️ GPS Error: ${err.message}`)
      }
    }, TRACKING_CONFIG.GPS_CACHE_INTERVAL_MS)

    // Batch upload every interval
    batchUploadInterval.current = setInterval(async () => {
      const points = await loadCachedPointsFromStorage()
      if (points.length > 0) await uploadBatch(points)
    }, TRACKING_CONFIG.BATCH_UPLOAD_INTERVAL_MS)
  }

  function stopTracking() {
    if (gpsCacheInterval.current) clearInterval(gpsCacheInterval.current)
    if (batchUploadInterval.current) clearInterval(batchUploadInterval.current)
    gpsCacheInterval.current = null
    batchUploadInterval.current = null
    setTrackingActive(false)
    addLog('🔴 Tracking Berhenti')
  }

  // ── Upload Batch to Backend ───────────────────────────────────
  async function uploadBatch(points) {
    if (!points || points.length === 0) return
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA)
      const user = userStr ? JSON.parse(userStr) : { id: 1 }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/tracking/batch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          courier_id: user.id,
          points: points,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        await AsyncStorage.removeItem(STORAGE_KEYS.GPS_CACHE)
        setCachedPoints(0)
        setUploadCount(prev => prev + points.length)
        addLog(`✅ Upload ${points.length} titik berhasil`)
      } else {
        let msg = 'Error tidak diketahui'
        try { const d = await response.json(); msg = d.message || msg } catch {}
        addLog(`❌ Upload gagal ${response.status}: ${msg}`)
      }
    } catch (err) {
      addLog(`❌ Koneksi Gagal: ${err.message}`)
    }
  }

  async function handleManualUpload() {
    const points = await loadCachedPointsFromStorage()
    if (points.length === 0) {
      Alert.alert('Info', 'Tidak ada data GPS yang di-cache.')
      return
    }
    addLog(`📤 Upload manual ${points.length} titik...`)
    await uploadBatch(points)
  }

  // ── AI Route Optimization + OSRM Polyline ─────────────────────
  async function optimizeRoute() {
    setRouteLoading(true)
    setRouteGeometry([])
    setRouteSequence([])
    try {
      addLog('🧠 Menghitung urutan sekolah (AI)...')

      // Sekolah-sekolah yang perlu diantarkan hari ini
      // Idealnya diambil dari API, untuk demo kita hardcode dulu
      const schools = [
        { id: 1, name: 'SDN 1 Malang', latitude: -7.975, longitude: 112.628, demand: 10, time_window_minutes: 120 },
        { id: 2, name: 'SDN 2 Malang', latitude: -7.985, longitude: 112.618, demand: 8, time_window_minutes: 90 },
      ]

      // Step 1: Tanya AI (Python A2C) untuk urutan terbaik
      const aiController = new AbortController()
      const aiTimeout = setTimeout(() => aiController.abort(), 15000)
      const aiRes = await fetch(`${API_CONFIG.AI_SERVICE_URL}/routing/optimize/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depot_lat: -7.9666,
          depot_lng: 112.6326,
          vehicle_capacity: 50,
          max_time_minutes: 180,
          schools: schools,
        }),
        signal: aiController.signal,
      })
      clearTimeout(aiTimeout)

      if (!aiRes.ok) {
        addLog('⚠️ AI service tidak bisa dihubungi.')
        return
      }
      const aiData = await aiRes.json()
      const orderedRoute = aiData.route || []
      setRouteSequence(orderedRoute)
      addLog(`✅ Urutan ${orderedRoute.length} sekolah didapat (AI)`)

      if (orderedRoute.length === 0) {
        addLog('⚠️ Tidak ada sekolah dalam rute.')
        return
      }

      // Step 2: Minta Golang + OSRM untuk bentuk jalanan sesungguhnya
      addLog('🗺️ Mengambil jalur jalan (OSRM)...')
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)

      // Bangun array koordinat: Depot → Sekolah 1 → Sekolah 2 → ...
      const waypoints = [{ lat: -7.9666, lng: 112.6326 }]
      orderedRoute.forEach(step => {
        const school = schools.find(s => s.id === step.school_id)
        if (school) waypoints.push({ lat: school.latitude, lng: school.longitude })
      })

      const geoController = new AbortController()
      const geoTimeout = setTimeout(() => geoController.abort(), 15000)
      const geoRes = await fetch(`${API_CONFIG.BACKEND_URL}/api/routing/geometry/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ points: waypoints }),
        signal: geoController.signal,
      })
      clearTimeout(geoTimeout)

      if (geoRes.ok) {
        const geoData = await geoRes.json()
        const encoded = geoData?.data?.geometry
        if (encoded) {
          const coords = decodePolyline(encoded)
          setRouteGeometry(coords)
          addLog(`✅ Rute jalanan berhasil! (${coords.length} poin)`)
          // Fit map to show the full route
          if (mapRef.current && coords.length > 0) {
            mapRef.current.fitToCoordinates(coords, {
              edgePadding: { top: 60, right: 60, bottom: 300, left: 60 },
              animated: true,
            })
          }
        } else {
          addLog('⚠️ Data geometri rute kosong.')
        }
      } else {
        addLog('⚠️ OSRM tidak bisa dihubungi, pakai rute lurus.')
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        addLog('❌ Timeout: Server tidak merespons.')
      } else {
        addLog(`❌ Error: ${err.message}`)
      }
    } finally {
      setRouteLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Full-screen Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: -7.9666,
          longitude: 112.6326,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Blue dot: My current location */}
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }}
            title="Posisi Saya"
            pinColor="#3b82f6"
          />
        )}

        {/* Yellow dashed line: fallback when OSRM is not available */}
        {routeGeometry.length === 0 && routeSequence.length > 0 && (
          <Polyline
            coordinates={routeSequence
              .filter(r => r.latitude && r.longitude)
              .map(r => ({ latitude: r.latitude, longitude: r.longitude }))}
            strokeColor="#f59e0b"
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}

        {/* Blue solid line: actual road path from OSRM */}
        {routeGeometry.length > 0 && (
          <Polyline
            coordinates={routeGeometry}
            strokeColor="#3b82f6"
            strokeWidth={5}
            lineJoin="round"
            lineCap="round"
          />
        )}
      </MapView>

      {/* Floating overlay UI */}
      <View style={styles.overlay}>
        {/* Header Card */}
        <View style={styles.topCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>🚚 Kurir Tracker</Text>
            <View style={[styles.statusDot, { backgroundColor: trackingActive ? '#22c55e' : '#6b7280' }]} />
          </View>
          <TouchableOpacity
            style={[styles.btnToggle, trackingActive ? styles.btnRed : styles.btnGreen]}
            onPress={trackingActive ? stopTracking : startTracking}
            activeOpacity={0.8}
          >
            <Text style={styles.btnToggleText}>
              {trackingActive ? '⏹  STOP TRACKING' : '▶  MULAI TRACKING'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Log */}
        <ScrollView style={styles.logScroll} showsVerticalScrollIndicator={false}>
          {statusLog.length === 0 && (
            <Text style={[styles.logText, { color: '#4b5563' }]}>Tekan "MULAI TRACKING" untuk memulai...</Text>
          )}
          {statusLog.map((log, i) => (
            <Text
              key={i}
              style={[
                styles.logText,
                log.includes('✅') && { color: '#4ade80' },
                log.includes('❌') && { color: '#f87171' },
                log.includes('⚠️') && { color: '#fbbf24' },
              ]}
            >
              {log}
            </Text>
          ))}
        </ScrollView>

        {/* Bottom Action Row */}
        <View style={styles.bottomActions}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>CACHE</Text>
            <Text style={styles.statVal}>{cachedPoints}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>UPLOAD</Text>
            <Text style={styles.statVal}>{uploadCount}</Text>
          </View>
          <TouchableOpacity
            style={styles.btnAction}
            onPress={handleManualUpload}
            activeOpacity={0.8}
          >
            <Text style={styles.btnActionText}>📤 UPLOAD</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnAction, { backgroundColor: '#4f46e5' }]}
            onPress={optimizeRoute}
            disabled={routeLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnActionText}>
              {routeLoading ? '⏳ ...' : '🗺️ RUTE'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: width, height: height },
  overlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 16,
    gap: 8,
  },
  topCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.93)',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  btnToggle: { padding: 12, borderRadius: 12, alignItems: 'center' },
  btnGreen: { backgroundColor: '#15803d' },
  btnRed: { backgroundColor: '#991b1b' },
  btnToggleText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  logScroll: {
    height: 90,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 14,
    padding: 10,
  },
  logText: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 3,
    fontFamily: 'monospace',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingBottom: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.93)',
    padding: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  statLabel: { color: '#6b7280', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  statVal: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  btnAction: {
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  btnActionText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
})
