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

// School coordinates — in production these should come from the API
// We need them locally so we can draw the route even without OSRM
const DEPOT = { latitude: -7.9666, longitude: 112.6326, name: 'Dapur Pusat' }
const DEFAULT_SCHOOLS = [
  { id: 1, name: 'SDN 1 Malang', latitude: -7.975, longitude: 112.628, demand: 10, time_window_minutes: 120 },
  { id: 2, name: 'SDN 2 Malang', latitude: -7.985, longitude: 112.618, demand: 8, time_window_minutes: 90 },
  { id: 3, name: 'SDN 3 Malang', latitude: -7.970, longitude: 112.635, demand: 12, time_window_minutes: 150 },
]

export default function TrackingScreen() {
  const [trackingActive, setTrackingActive] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [cachedPoints, setCachedPoints] = useState(0)
  const [uploadCount, setUploadCount] = useState(0)
  const [routeCoords, setRouteCoords] = useState([])      // polyline coords to draw
  const [schoolMarkers, setSchoolMarkers] = useState([])  // school pins on map
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeMode, setRouteMode] = useState(null)        // 'osrm' | 'straight' | null
  const [statusLog, setStatusLog] = useState([])

  const mapRef = useRef(null)
  const gpsCacheInterval = useRef(null)
  const batchUploadInterval = useRef(null)
  const appStateRef = useRef(AppState.currentState)

  useEffect(() => {
    requestPermissions()
    loadInitialData()
    const sub = AppState.addEventListener('change', next => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        if (trackingActive) addLog('📱 App aktif kembali')
      }
      appStateRef.current = next
    })
    return () => { stopTracking(); sub.remove() }
  }, [])

  function addLog(msg) {
    const t = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setStatusLog(prev => [`[${t}] ${msg}`, ...prev].slice(0, 12))
  }

  async function loadInitialData() {
    const pts = await getCachedPoints()
    setCachedPoints(pts.length)
  }

  async function requestPermissions() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Izin Lokasi', 'Aplikasi butuh izin lokasi.')
      return false
    }
    return true
  }

  async function getCachedPoints() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.GPS_CACHE)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  async function cachePoint(loc) {
    try {
      const existing = await getCachedPoints()
      const pt = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        recorded_at: new Date().toISOString(),
        speed: loc.coords.speed ?? 0,
        accuracy: loc.coords.accuracy ?? 0,
      }
      const updated = [...existing, pt]
      await AsyncStorage.setItem(STORAGE_KEYS.GPS_CACHE, JSON.stringify(updated))
      setCachedPoints(updated.length)
      if (updated.length >= TRACKING_CONFIG.MAX_BATCH_SIZE) await uploadBatch(updated)
    } catch (e) { console.error('Cache error:', e) }
  }

  async function startTracking() {
    if (!await requestPermissions()) return
    setTrackingActive(true)
    addLog('🟢 GPS Tracking Aktif')

    gpsCacheInterval.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setCurrentLocation(loc)
        await cachePoint(loc)
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.015, longitudeDelta: 0.015,
          }, 800)
        }
      } catch (e) { addLog(`⚠️ GPS: ${e.message}`) }
    }, TRACKING_CONFIG.GPS_CACHE_INTERVAL_MS)

    batchUploadInterval.current = setInterval(async () => {
      const pts = await getCachedPoints()
      if (pts.length > 0) await uploadBatch(pts)
    }, TRACKING_CONFIG.BATCH_UPLOAD_INTERVAL_MS)
  }

  function stopTracking() {
    if (gpsCacheInterval.current) { clearInterval(gpsCacheInterval.current); gpsCacheInterval.current = null }
    if (batchUploadInterval.current) { clearInterval(batchUploadInterval.current); batchUploadInterval.current = null }
    setTrackingActive(false)
    addLog('🔴 Tracking Berhenti')
  }

  async function uploadBatch(points) {
    if (!points?.length) return
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const userRaw = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA)
      const user = userRaw ? JSON.parse(userRaw) : { id: 1 }

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 15000)
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/tracking/batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ courier_id: user.id, points }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      if (res.ok) {
        await AsyncStorage.removeItem(STORAGE_KEYS.GPS_CACHE)
        setCachedPoints(0)
        setUploadCount(p => p + points.length)
        addLog(`✅ Upload ${points.length} titik GPS berhasil`)
      } else {
        let msg = 'Error'
        try { const d = await res.json(); msg = d.message || msg } catch {}
        addLog(`❌ Upload gagal ${res.status}: ${msg}`)
      }
    } catch (e) {
      addLog(`❌ Koneksi gagal: ${e.name === 'AbortError' ? 'Timeout' : e.message}`)
    }
  }

  async function manualUpload() {
    const pts = await getCachedPoints()
    if (!pts.length) { Alert.alert('Info', 'Tidak ada data GPS untuk diupload.'); return }
    addLog(`📤 Upload manual ${pts.length} titik...`)
    await uploadBatch(pts)
  }

  // ── Route Optimization ────────────────────────────────────────
  // Step 1: Ask AI for optimized school order
  // Step 2: Try to get real road polyline from Golang/OSRM
  // Step 3: If OSRM fails → draw straight lines (still useful!)
  async function optimizeRoute() {
    setRouteLoading(true)
    setRouteCoords([])
    setSchoolMarkers([])
    setRouteMode(null)
    try {
      addLog('🧠 Tanya AI untuk urutan sekolah...')

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 20000)
      const aiRes = await fetch(`${API_CONFIG.AI_SERVICE_URL}/routing/optimize/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depot_lat: DEPOT.latitude,
          depot_lng: DEPOT.longitude,
          vehicle_capacity: 50,
          max_time_minutes: 180,
          schools: DEFAULT_SCHOOLS,
        }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)

      if (!aiRes.ok) { addLog('❌ AI service error'); setRouteLoading(false); return }
      const aiData = await aiRes.json()
      const orderedStops = aiData.route || []

      if (!orderedStops.length) { addLog('⚠️ Tidak ada rute dari AI'); setRouteLoading(false); return }
      addLog(`✅ AI: ${orderedStops.length} sekolah diurutkan`)

      // Build ordered school array from AI sequence
      const orderedSchools = orderedStops
        .map(s => DEFAULT_SCHOOLS.find(d => d.id === s.school_id))
        .filter(Boolean)

      // Show school markers on map
      setSchoolMarkers(orderedSchools)

      // Build straight-line waypoints (Depot → S1 → S2 → ...)
      const straightLine = [
        { latitude: DEPOT.latitude, longitude: DEPOT.longitude },
        ...orderedSchools.map(s => ({ latitude: s.latitude, longitude: s.longitude })),
      ]

      // Step 2: Try OSRM via Golang backend
      addLog('🗺️ Mencoba ambil jalur jalan via OSRM...')
      let usedOSRM = false
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
        const waypoints = [
          { lat: DEPOT.latitude, lng: DEPOT.longitude },
          ...orderedSchools.map(s => ({ lat: s.latitude, lng: s.longitude })),
        ]
        const geoCtrl = new AbortController()
        const geoTid = setTimeout(() => geoCtrl.abort(), 10000) // 10s timeout for OSRM
        const geoRes = await fetch(`${API_CONFIG.BACKEND_URL}/api/routing/geometry/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ points: waypoints }),
          signal: geoCtrl.signal,
        })
        clearTimeout(geoTid)

        if (geoRes.ok) {
          const geoData = await geoRes.json()
          const encoded = geoData?.data?.geometry
          if (encoded && encoded.length > 0) {
            const decoded = decodePolyline(encoded)
            if (decoded.length > 1) {
              setRouteCoords(decoded)
              setRouteMode('osrm')
              usedOSRM = true
              addLog(`✅ Rute jalanan OSRM berhasil (${decoded.length} poin)`)
              fitMapToRoute(decoded)
            }
          }
        }
      } catch {
        // OSRM failed — this is expected when phone can't reach Docker
      }

      // Fallback: straight lines — always works!
      if (!usedOSRM) {
        setRouteCoords(straightLine)
        setRouteMode('straight')
        addLog('📏 OSRM tidak tersedia — menggunakan rute garis lurus')
        fitMapToRoute(straightLine)
      }

    } catch (e) {
      addLog(`❌ Error: ${e.name === 'AbortError' ? 'AI timeout' : e.message}`)
    } finally {
      setRouteLoading(false)
    }
  }

  function fitMapToRoute(coords) {
    if (!mapRef.current || !coords.length) return
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 40, bottom: 320, left: 40 },
      animated: true,
    })
  }

  // Decode Google-encoded polyline → [{latitude, longitude}]
  function decodePolyline(encoded) {
    const pts = []
    let i = 0, lat = 0, lng = 0
    while (i < encoded.length) {
      let b, s = 0, r = 0
      do { b = encoded.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5 } while (b >= 32)
      lat += r & 1 ? ~(r >> 1) : r >> 1
      s = 0; r = 0
      do { b = encoded.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5 } while (b >= 32)
      lng += r & 1 ? ~(r >> 1) : r >> 1
      pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
    }
    return pts
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: DEPOT.latitude, longitude: DEPOT.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
      >
        {/* Depot marker */}
        <Marker coordinate={{ latitude: DEPOT.latitude, longitude: DEPOT.longitude }} title="Dapur Pusat" pinColor="#22c55e" />

        {/* Current position */}
        {currentLocation && (
          <Marker
            coordinate={{ latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }}
            title="Posisi Saya"
            pinColor="#3b82f6"
          />
        )}

        {/* School markers */}
        {schoolMarkers.map((s, i) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.latitude, longitude: s.longitude }}
            title={`${i + 1}. ${s.name}`}
            pinColor="#f59e0b"
          />
        ))}

        {/* Route line — blue solid = OSRM road, orange dashed = straight line */}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={routeMode === 'osrm' ? '#3b82f6' : '#f97316'}
            strokeWidth={routeMode === 'osrm' ? 5 : 3}
            lineDashPattern={routeMode === 'straight' ? [8, 5] : undefined}
            lineJoin="round"
          />
        )}
      </MapView>

      {/* Overlay UI */}
      <View style={styles.overlay}>
        <View style={styles.topCard}>
          <View style={styles.row}>
            <Text style={styles.title}>🚚 Kurir Tracker</Text>
            <View style={[styles.dot, { backgroundColor: trackingActive ? '#22c55e' : '#4b5563' }]} />
          </View>
          {routeMode && (
            <Text style={[styles.routeTag, { color: routeMode === 'osrm' ? '#60a5fa' : '#fb923c' }]}>
              {routeMode === 'osrm' ? '🗺️ Rute Jalanan (OSRM)' : '📏 Rute Garis Lurus (OSRM tidak tersedia)'}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.btnToggle, trackingActive ? styles.btnRed : styles.btnGreen]}
            onPress={trackingActive ? stopTracking : startTracking}
          >
            <Text style={styles.btnToggleText}>{trackingActive ? '⏹  STOP TRACKING' : '▶  MULAI TRACKING'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.log} showsVerticalScrollIndicator={false}>
          {!statusLog.length && <Text style={styles.logEmpty}>Log aktivitas akan muncul di sini...</Text>}
          {statusLog.map((l, i) => (
            <Text key={i} style={[styles.logText,
              l.includes('✅') && { color: '#4ade80' },
              l.includes('❌') && { color: '#f87171' },
              l.includes('⚠️') && { color: '#fbbf24' },
            ]}>{l}</Text>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          <View style={styles.stat}>
            <Text style={styles.statL}>CACHE</Text>
            <Text style={styles.statV}>{cachedPoints}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statL}>UPLOAD</Text>
            <Text style={styles.statV}>{uploadCount}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={manualUpload}>
            <Text style={styles.btnTxt}>📤 UPLOAD</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#4f46e5' }]} onPress={optimizeRoute} disabled={routeLoading}>
            <Text style={styles.btnTxt}>{routeLoading ? '⏳' : '🗺️ RUTE'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, gap: 8 },
  topCard: {
    backgroundColor: 'rgba(10, 15, 25, 0.93)', borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: '#1f2937',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeTag: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  btnToggle: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnGreen: { backgroundColor: '#15803d' },
  btnRed: { backgroundColor: '#991b1b' },
  btnToggleText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  log: { maxHeight: 90, backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 14, padding: 10 },
  logEmpty: { color: '#4b5563', fontSize: 11 },
  logText: { color: '#9ca3af', fontSize: 11, marginBottom: 3, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 6 },
  stat: {
    flex: 1, backgroundColor: 'rgba(10,15,25,0.93)', borderRadius: 14,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1f2937',
  },
  statL: { color: '#6b7280', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  statV: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 2 },
  btn: {
    backgroundColor: '#1f2937', paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: '#374151',
  },
  btnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
})
