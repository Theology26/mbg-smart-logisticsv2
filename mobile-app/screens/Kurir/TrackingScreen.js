import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, Dimensions,
  AppState, TouchableOpacity, ScrollView
} from 'react-native'
import * as Location from 'expo-location'
import MapView, { Marker, Polyline } from 'react-native-maps'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_CONFIG, TRACKING_CONFIG, STORAGE_KEYS } from '../../constants/config'

const { width, height } = Dimensions.get('window')

const DEPOT = { latitude: -7.9666, longitude: 112.6326 }

export default function TrackingScreen() {
  const [currentLocation, setCurrentLocation] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [routeCoords, setRouteCoords] = useState([])
  const [routeMode, setRouteMode] = useState(null)   // 'osrm' | 'straight'
  const [statusLog, setStatusLog] = useState([])
  const [uploadCount, setUploadCount] = useState(0)
  const [isReady, setIsReady] = useState(false)

  const mapRef = useRef(null)
  const gpsCacheInterval = useRef(null)
  const batchUploadInterval = useRef(null)
  const appStateRef = useRef(AppState.currentState)

  // ── Fully Automated on Mount ───────────────────────────────────
  useEffect(() => {
    bootstrap()
    const sub = AppState.addEventListener('change', next => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        addLog('📱 App aktif kembali — tracking berlanjut')
      }
      appStateRef.current = next
    })
    return () => {
      cleanup()
      sub.remove()
    }
  }, [])

  async function bootstrap() {
    addLog('🔧 Memulai sistem otomatis...')
    const ok = await requestLocation()
    if (!ok) return

    // 1. Start GPS background tracking (silent)
    startGPSBackground()

    // 2. Fetch today's deliveries for this courier
    await fetchDeliveries()

    setIsReady(true)
  }

  function cleanup() {
    if (gpsCacheInterval.current) clearInterval(gpsCacheInterval.current)
    if (batchUploadInterval.current) clearInterval(batchUploadInterval.current)
  }

  function addLog(msg) {
    const t = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setStatusLog(prev => [`[${t}] ${msg}`, ...prev].slice(0, 8))
  }

  // ── GPS Permission ─────────────────────────────────────────────
  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      addLog('❌ Izin lokasi ditolak')
      return false
    }
    addLog('✅ Izin lokasi OK')
    return true
  }

  // ── Background GPS (silent, fully automatic) ──────────────────
  function startGPSBackground() {
    addLog('🟢 GPS tracking berjalan otomatis')

    // Record position every 10 seconds
    gpsCacheInterval.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        setCurrentLocation(loc)
        await cachePoint(loc)

        // Auto-center map on current position
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }, 1000)
        }
      } catch {}
    }, TRACKING_CONFIG.GPS_CACHE_INTERVAL_MS)

    // Auto-upload batch every 3 minutes
    batchUploadInterval.current = setInterval(async () => {
      const pts = await getCachedPoints()
      if (pts.length > 0) {
        await uploadBatch(pts)
      }
    }, TRACKING_CONFIG.BATCH_UPLOAD_INTERVAL_MS)
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
      if (updated.length >= TRACKING_CONFIG.MAX_BATCH_SIZE) {
        await uploadBatch(updated)
      }
    } catch {}
  }

  async function getCachedPoints() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.GPS_CACHE)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
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
        setUploadCount(p => p + points.length)
        addLog(`📡 ${points.length} titik GPS terkirim ke server`)
      }
    } catch {}
  }

  // ── Fetch Today's Deliveries ───────────────────────────────────
  async function fetchDeliveries() {
    addLog('📦 Mengambil data pengiriman hari ini...')
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const userRaw = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA)
      const user = userRaw ? JSON.parse(userRaw) : null

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 15000)
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/deliveries/`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: ctrl.signal,
      })
      clearTimeout(tid)

      const data = await res.json()
      const all = data.data || []

      // Filter by this courier's ID and only pending/in_transit
      const mine = user
        ? all.filter(d => d.courier_id === user.id && ['pending', 'in_transit'].includes(d.status))
        : all.filter(d => ['pending', 'in_transit'].includes(d.status))

      setDeliveries(mine)
      addLog(`✅ ${mine.length} sekolah perlu diantarkan`)

      if (mine.length > 0) {
        await buildRoute(mine)
      }
    } catch (e) {
      addLog(`❌ Gagal ambil data: ${e.name === 'AbortError' ? 'Timeout' : e.message}`)
    }
  }

  // ── Build Route from Deliveries ────────────────────────────────
  async function buildRoute(deliveryList) {
    addLog('🧠 Menghitung rute optimal...')

    const schools = deliveryList
      .filter(d => d.school?.latitude && d.school?.longitude)
      .map(d => ({
        id: d.school.id,
        name: d.school.name,
        latitude: parseFloat(d.school.latitude),
        longitude: parseFloat(d.school.longitude),
        demand: d.school.demand_quantity || 10,
        time_window_minutes: 120,
      }))

    if (schools.length === 0) {
      addLog('⚠️ Sekolah belum punya koordinat GPS')
      return
    }

    // Build straight-line route (Depot → schools)
    const straightLine = [
      { latitude: DEPOT.latitude, longitude: DEPOT.longitude },
      ...schools.map(s => ({ latitude: s.latitude, longitude: s.longitude })),
    ]

    // Try to get road-following route from OSRM via Golang backend
    let usedRoad = false
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const waypoints = [
        { lat: DEPOT.latitude, lng: DEPOT.longitude },
        ...schools.map(s => ({ lat: s.latitude, lng: s.longitude })),
      ]
      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 8000) // short timeout
      const geoRes = await fetch(`${API_CONFIG.BACKEND_URL}/api/routing/geometry/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ points: waypoints }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      if (geoRes.ok) {
        const geoData = await geoRes.json()
        const encoded = geoData?.data?.geometry
        if (encoded) {
          const decoded = decodePolyline(encoded)
          if (decoded.length > 1) {
            setRouteCoords(decoded)
            setRouteMode('osrm')
            usedRoad = true
            addLog('🗺️ Rute jalan (OSRM) berhasil')
            fitMap(decoded)
          }
        }
      }
    } catch {}

    if (!usedRoad) {
      setRouteCoords(straightLine)
      setRouteMode('straight')
      addLog('📏 Rute garis lurus (OSRM tidak tersedia)')
      fitMap(straightLine)
    }
  }

  function fitMap(coords) {
    if (!mapRef.current || !coords.length) return
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 40, bottom: 280, left: 40 },
      animated: true,
    })
  }

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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ ...DEPOT, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
      >
        {/* Depot — starting point */}
        <Marker coordinate={DEPOT} title="Dapur Pusat" description="Titik awal pengiriman" pinColor="#22c55e" />

        {/* Current courier position */}
        {currentLocation && (
          <Marker
            coordinate={{ latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }}
            title="Posisi Saya"
            pinColor="#3b82f6"
          />
        )}

        {/* School markers from deliveries */}
        {deliveries
          .filter(d => d.school?.latitude && d.school?.longitude)
          .map((d, i) => (
            <Marker
              key={d.id}
              coordinate={{ latitude: parseFloat(d.school.latitude), longitude: parseFloat(d.school.longitude) }}
              title={`${i + 1}. ${d.school.name}`}
              description={`Status: ${d.status}`}
              pinColor={d.status === 'in_transit' ? '#f59e0b' : '#ef4444'}
            />
          ))}

        {/* Route line */}
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

      {/* Floating status panel */}
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>🚚 Pengiriman Hari Ini</Text>
            <Text style={styles.panelSub}>
              {deliveries.length} sekolah · {uploadCount} titik GPS terkirim
            </Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>LIVE</Text>
          </View>
        </View>

        {/* Route mode badge */}
        {routeMode && (
          <View style={[styles.routeBadge, { borderColor: routeMode === 'osrm' ? '#3b82f6' : '#f97316' }]}>
            <Text style={[styles.routeBadgeTxt, { color: routeMode === 'osrm' ? '#60a5fa' : '#fb923c' }]}>
              {routeMode === 'osrm' ? '🗺️ Rute Jalanan (OSRM)' : '📏 Rute Garis Lurus'}
            </Text>
          </View>
        )}

        {/* Delivery list */}
        <ScrollView style={styles.deliveryList} showsVerticalScrollIndicator={false}>
          {deliveries.length === 0 && isReady && (
            <Text style={styles.emptyTxt}>Tidak ada pengiriman aktif hari ini.</Text>
          )}
          {deliveries.map((d, i) => (
            <View key={d.id} style={styles.deliveryItem}>
              <View style={styles.deliveryNum}>
                <Text style={styles.deliveryNumTxt}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deliverySchool}>{d.school?.name || 'Sekolah #' + d.school_id}</Text>
                <Text style={styles.deliveryStatus}>{d.status?.replace('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Activity log */}
        <ScrollView style={styles.logBox} showsVerticalScrollIndicator={false}>
          {statusLog.map((l, i) => (
            <Text key={i} style={[styles.logTxt,
              l.includes('✅') && { color: '#4ade80' },
              l.includes('❌') && { color: '#f87171' },
              l.includes('⚠️') && { color: '#fbbf24' },
            ]}>{l}</Text>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width, height },
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10, 15, 25, 0.94)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: '#1f2937',
    padding: 16, paddingBottom: 24, gap: 10,
    maxHeight: height * 0.45,
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  panelTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  panelSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1a2a1a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  liveTxt: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  routeBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  routeBadgeTxt: { fontSize: 12, fontWeight: '600' },
  deliveryList: { maxHeight: 100 },
  deliveryItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  deliveryNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  deliveryNumTxt: { color: '#000', fontSize: 12, fontWeight: '700' },
  deliverySchool: { color: '#fff', fontSize: 13, fontWeight: '500' },
  deliveryStatus: { color: '#6b7280', fontSize: 10, marginTop: 1 },
  emptyTxt: { color: '#4b5563', fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  logBox: { maxHeight: 70, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 8 },
  logTxt: { color: '#6b7280', fontSize: 10, marginBottom: 2, fontFamily: 'monospace' },
})
