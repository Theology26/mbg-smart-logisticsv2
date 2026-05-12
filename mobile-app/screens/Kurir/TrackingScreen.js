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
  const [activeRouteCoords, setActiveRouteCoords] = useState([])
  const [futureRouteCoords, setFutureRouteCoords] = useState([])
  const [routeMode, setRouteMode] = useState(null)   // 'osrm' | 'straight'
  const [statusLog, setStatusLog] = useState([])
  const [uploadCount, setUploadCount] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isNavigating, setIsNavigating] = useState(true)

  const mapRef = useRef(null)
  const gpsWatcher = useRef(null)
  const lastCacheTime = useRef(0)
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

    // 1. Get initial location
    let initialLoc = null;
    try {
      initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation(initialLoc);
    } catch {}

    // 2. Start GPS background tracking (silent)
    startGPSBackground()

    // 3. Fetch today's deliveries for this courier
    await fetchDeliveries(initialLoc)

    setIsReady(true)
  }

  function cleanup() {
    if (gpsWatcher.current) gpsWatcher.current.remove()
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
  async function startGPSBackground() {
    addLog('🟢 GPS live tracking berjalan (1 detik update)')

    // Real-time location watcher (Smooth map movement)
    gpsWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,     // UI updates every 1 second
        distanceInterval: 1,    // UI updates every 1 meter
      },
      (loc) => {
        setCurrentLocation(loc)

        // Throttle saving to local storage (only every 10 seconds)
        const now = Date.now()
        if (now - lastCacheTime.current > TRACKING_CONFIG.GPS_CACHE_INTERVAL_MS) {
          cachePoint(loc)
          lastCacheTime.current = now
        }

        // Auto-center map on current position if in Navigation Mode
        if (mapRef.current && isNavigating) {
          mapRef.current.animateCamera({
            center: {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            },
            heading: loc.coords.heading || 0,
            pitch: 60,
            zoom: 18,
          }, { duration: 1000 })
        }
      }
    )

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
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/tracking/batch`, {
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
  async function fetchDeliveries(loc = currentLocation) {
    addLog('📦 Mengambil data pengiriman hari ini...')
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const userRaw = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA)
      const user = userRaw ? JSON.parse(userRaw) : null

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 15000)
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/deliveries`, {
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

      // Sort by AI urgency (epsilon_score descending)
      mine.sort((a, b) => {
        const scoreA = a.schedule?.epsilon_score || 0;
        const scoreB = b.schedule?.epsilon_score || 0;
        return scoreB - scoreA;
      });

      setDeliveries(mine)
      addLog(`✅ ${mine.length} sekolah perlu diantarkan`)

      if (mine.length > 0) {
        await buildRoute(mine, loc)
      }
    } catch (e) {
      addLog(`❌ Gagal ambil data: ${e.name === 'AbortError' ? 'Timeout' : e.message}`)
    }
  }

  // ── Build Route from Deliveries ────────────────────────────────
  async function buildRoute(deliveryList, loc) {
    addLog('🧠 Menghitung rute optimal...')

    const schools = deliveryList
      .filter(d => d.school?.latitude && d.school?.longitude)
      .map(d => ({
        id: d.school.id,
        name: d.school.name,
        latitude: parseFloat(d.school.latitude),
        longitude: parseFloat(d.school.longitude),
      }))

    if (schools.length === 0) {
      addLog('⚠️ Sekolah belum punya koordinat GPS')
      return
    }

    const startLoc = loc ? { latitude: loc.coords.latitude, longitude: loc.coords.longitude } : DEPOT;

    // Active Route (Courier -> First Destination)
    const activeWaypoints = [
      { lat: startLoc.latitude, lng: startLoc.longitude },
      { lat: schools[0].latitude, lng: schools[0].longitude }
    ];

    // Future Route (First Destination -> Rest of schools)
    let futureWaypoints = [];
    if (schools.length > 1) {
      futureWaypoints = schools.map(s => ({ lat: s.latitude, lng: s.longitude }));
    }

    let usedRoad = false;
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      
      const fetchOSRM = async (pts) => {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        const geoRes = await fetch(`${API_CONFIG.BACKEND_URL}/api/routing/geometry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ points: pts }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData?.data?.geometry) {
            return decodePolyline(geoData.data.geometry);
          }
        }
        return [];
      };

      const activeDecoded = await fetchOSRM(activeWaypoints);
      const futureDecoded = futureWaypoints.length > 1 ? await fetchOSRM(futureWaypoints) : [];

      if (activeDecoded.length > 1) {
        setActiveRouteCoords(activeDecoded);
        setFutureRouteCoords(futureDecoded);
        setRouteMode('osrm');
        usedRoad = true;
        addLog('🗺️ Rute navigasi aktif berhasil');
      }
    } catch {}

    if (!usedRoad) {
      setActiveRouteCoords([ { latitude: startLoc.latitude, longitude: startLoc.longitude }, { latitude: schools[0].latitude, longitude: schools[0].longitude } ]);
      setFutureRouteCoords(futureWaypoints.map(w => ({ latitude: w.lat, longitude: w.lng })));
      setRouteMode('straight');
      addLog('📏 Rute garis lurus (OSRM tidak tersedia)');
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

  // ── Update Delivery Status ─────────────────────────────────────
  async function updateStatus(deliveryId, newStatus) {
    addLog(`🔄 Mengupdate status ke ${newStatus}...`)
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        addLog(`✅ Status berhasil diupdate: ${newStatus}`)
        await fetchDeliveries() // Refresh list
      } else {
        addLog(`❌ Gagal update status.`)
      }
    } catch (e) {
      addLog(`❌ Error update status: ${e.message}`)
    }
  }

  // Google Maps dark navigation style
  const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ ...DEPOT, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
        customMapStyle={darkMapStyle}
        showsUserLocation={true}
        showsCompass={false}
        onPanDrag={() => setIsNavigating(false)}
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

        {/* Future dimmed route */}
        {futureRouteCoords.length > 1 && (
          <Polyline
            coordinates={futureRouteCoords}
            strokeColor="#4b5563" /* Grayed out */
            strokeWidth={4}
            lineDashPattern={[10, 10]}
            lineJoin="round"
          />
        )}

        {/* Active Spotlight Route */}
        {activeRouteCoords.length > 1 && (
          <Polyline
            coordinates={activeRouteCoords}
            strokeColor={routeMode === 'osrm' ? '#0ea5e9' : '#f97316'} /* Bright cyan blue for active */
            strokeWidth={6}
            lineDashPattern={routeMode === 'straight' ? [8, 5] : undefined}
            lineJoin="round"
          />
        )}
      </MapView>

        {/* Floating status panel */}
      <View style={styles.panel}>
        {/* Recenter Button */}
        {!isNavigating && (
          <TouchableOpacity 
            style={styles.recenterBtn} 
            onPress={() => setIsNavigating(true)}
          >
            <Text style={styles.recenterBtnTxt}>⌖ Tengahkan</Text>
          </TouchableOpacity>
        )}

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
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {d.status === 'pending' && (
                  <TouchableOpacity onPress={() => updateStatus(d.id, 'in_transit')} style={styles.actionBtn}>
                    <Text style={styles.actionBtnTxt}>Perjalanan ke {d.school?.name}</Text>
                  </TouchableOpacity>
                )}
                {d.status === 'in_transit' && (
                  <TouchableOpacity onPress={() => updateStatus(d.id, 'delivered')} style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}>
                    <Text style={styles.actionBtnTxt}>Tiba (Selesai)</Text>
                  </TouchableOpacity>
                )}
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
  logBox: { maxHeight: 70, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 8, marginTop: 10 },
  logTxt: { color: '#6b7280', fontSize: 10, marginBottom: 2, fontFamily: 'monospace' },
  actionBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  actionBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  recenterBtn: { position: 'absolute', top: -50, right: 16, backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 5 },
  recenterBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
})
