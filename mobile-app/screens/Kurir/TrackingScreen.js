import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, SafeAreaView, AppState, Dimensions
} from 'react-native'
import * as Location from 'expo-location'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_CONFIG, TRACKING_CONFIG, STORAGE_KEYS } from '../../constants/config'

const { width, height } = Dimensions.get('window')

export default function TrackingScreen() {
  const [trackingActive, setTrackingActive] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [cachedPoints, setCachedPoints] = useState(0)
  const [lastUpload, setLastUpload] = useState(null)
  const [uploadCount, setUploadCount] = useState(0)
  const [routeSequence, setRouteSequence] = useState([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [statusLog, setStatusLog] = useState([])

  const mapRef = useRef(null)
  const gpsCacheInterval = useRef(null)
  const batchUploadInterval = useRef(null)
  const appStateRef = useRef(AppState.currentState)

  useEffect(() => {
    requestPermissions()
    loadInitialData()
    const appStateSub = AppState.addEventListener('change', handleAppStateChange)
    return () => {
      stopTracking()
      appStateSub.remove()
    }
  }, [])

  async function loadInitialData() {
    const cached = await loadCachedPointsFromStorage()
    setCachedPoints(cached.length)
  }

  function handleAppStateChange(nextState) {
    if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
      if (trackingActive) addLog('📱 App aktif kembali')
    }
    appStateRef.current = nextState
  }

  async function requestPermissions() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Izin Lokasi', 'Aplikasi butuh izin lokasi.')
      return false
    }
    return true
  }

  async function loadCachedPointsFromStorage() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.GPS_CACHE)
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  }

  async function cacheGPSPoint(location) {
    try {
      const existing = await loadCachedPointsFromStorage()
      const newPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        recorded_at: new Date().toISOString(),
        speed: location.coords.speed || 0,
        accuracy: location.coords.accuracy || 0
      }
      const updated = [...existing, newPoint]
      await AsyncStorage.setItem(STORAGE_KEYS.GPS_CACHE, JSON.stringify(updated))
      setCachedPoints(updated.length)
      
      if (updated.length >= TRACKING_CONFIG.MAX_BATCH_SIZE) {
        await uploadBatch(updated)
      }
    } catch (err) { console.error(err) }
  }

  async function startTracking() {
    if (!await requestPermissions()) return
    setTrackingActive(true)
    addLog('🟢 Tracking GPS Aktif')

    gpsCacheInterval.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        setCurrentLocation(loc)
        await cacheGPSPoint(loc)
        
        // Auto center map
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
          }, 1000)
        }
      } catch (err) { addLog(`⚠️ GPS Error: ${err.message}`) }
    }, TRACKING_CONFIG.GPS_CACHE_INTERVAL_MS)

    batchUploadInterval.current = setInterval(async () => {
      const points = await loadCachedPointsFromStorage()
      if (points.length > 0) await uploadBatch(points)
    }, TRACKING_CONFIG.BATCH_UPLOAD_INTERVAL_MS)
  }

  function stopTracking() {
    if (gpsCacheInterval.current) clearInterval(gpsCacheInterval.current)
    if (batchUploadInterval.current) clearInterval(batchUploadInterval.current)
    setTrackingActive(false)
    addLog('🔴 Tracking Berhenti')
  }

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
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          courier_id: user.id,
          points: points
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        await AsyncStorage.removeItem(STORAGE_KEYS.GPS_CACHE)
        setCachedPoints(0)
        setUploadCount(prev => prev + points.length)
        setLastUpload(new Date().toLocaleTimeString())
        addLog(`✅ Berhasil upload ${points.length} titik`)
      } else {
        const errData = await response.json()
        addLog(`❌ Gagal ${response.status}: ${errData.message || 'Error'}`)
      }
    } catch (err) {
      addLog(`❌ Koneksi Gagal: ${err.message}`)
    }
  }

  async function handleManualUpload() {
    const points = await loadCachedPointsFromStorage()
    if (points.length === 0) return Alert.alert('Info', 'Tidak ada cache.')
    addLog('📤 Upload manual...')
    await uploadBatch(points)
  }

  function decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      points.push({ latitude: (lat / 1E5), longitude: (lng / 1E5) });
    }
    return points;
  }

  async function optimizeRoute() {
    setRouteLoading(true)
    try {
      addLog('🧠 Menghitung urutan sekolah (AI)...')
      
      const schools = [
        { id: 1, name: 'SDN 1 Malang', latitude: -7.98, longitude: 112.62, demand: 10 }
      ]
      
      const res = await fetch(`${API_CONFIG.AI_SERVICE_URL}/routing/optimize/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depot_lat: -7.9666,
          depot_lng: 112.6326,
          schools: schools
        })
      })
      const data = await res.json()
      setRouteSequence(data.route || [])

      addLog('🗺️ Mengambil jalur jalanan (OSRM)...')
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      
      const coords = [{ lat: -7.9666, lng: 112.6326 }]
      data.route?.forEach(step => {
        const s = schools.find(sc => sc.id === step.school_id)
        if(s) coords.push({ lat: s.latitude, lng: s.longitude })
      })

      const geoRes = await fetch(`${API_CONFIG.BACKEND_URL}/api/routing/geometry/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ points: coords })
      })
      
      if(geoRes.ok) {
        const geoData = await geoRes.json()
        const points = decodePolyline(geoData.data.geometry)
        setRouteGeometry(points)
        addLog('✅ Rute Google Maps berhasil dimuat!')
      } else {
        addLog('⚠️ Gagal memuat bentuk jalanan.')
      }

    } catch (err) { addLog(`❌ AI Error: ${err.message}`) }
    finally { setRouteLoading(false) }
  }

  function addLog(msg) {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setStatusLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10))
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: -7.9666,
            longitude: 112.6326,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05
          }}
          userInterfaceStyle="dark"
        >
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude
              }}
              title="Posisi Saya"
              pinColor="#3b82f6"
            />
          )}
          {/* Mock Route Line (Fallback) */}
          {routeGeometry.length === 0 && routeSequence.length > 0 && (
            <Polyline
              coordinates={routeSequence.map(r => ({ latitude: r.latitude, longitude: r.longitude }))}
              strokeColor="#f59e0b"
              strokeWidth={3}
              lineDashPattern={[5, 5]}
            />
          )}

          {/* Actual Google Maps Style Route */}
          {routeGeometry.length > 0 && (
            <Polyline
              coordinates={routeGeometry}
              strokeColor="#3b82f6"
              strokeWidth={5}
            />
          )}
        </MapView>
      </View>

      {/* Floating UI Overlay */}
      <View style={styles.overlay}>
         <View style={styles.topCard}>
            <Text style={styles.title}>🚚 Kurir Tracker</Text>
            <TouchableOpacity 
              style={[styles.btnToggle, trackingActive ? styles.btnRed : styles.btnGreen]}
              onPress={trackingActive ? stopTracking : startTracking}
            >
               <Text style={styles.btnText}>{trackingActive ? 'STOP TRACKING' : 'MULAI TRACKING'}</Text>
            </TouchableOpacity>
         </View>

         <ScrollView style={styles.logScroll}>
            {statusLog.map((log, i) => (
              <Text key={i} style={[styles.logText, log.includes('✅') && {color: '#4ade80'}, log.includes('❌') && {color: '#f87171'}]}>{log}</Text>
            ))}
         </ScrollView>

         <View style={styles.bottomActions}>
            <View style={styles.statBox}>
               <Text style={styles.statLabel}>CACHE</Text>
               <Text style={styles.statVal}>{cachedPoints}</Text>
            </View>
            <TouchableOpacity style={styles.btnAction} onPress={handleManualUpload}>
               <Text style={styles.btnActionText}>UPLOAD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#4f46e5'}]} onPress={optimizeRoute}>
               <Text style={styles.btnActionText}>{routeLoading ? '...' : 'RUTE AI'}</Text>
            </TouchableOpacity>
         </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapContainer: { flex: 1 },
  map: { width: width, height: height },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, gap: 10 },
  topCard: { backgroundColor: 'rgba(17, 24, 39, 0.9)', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#374151' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  btnToggle: { padding: 12, borderRadius: 12, alignItems: 'center' },
  btnGreen: { backgroundColor: '#15803d' },
  btnRed: { backgroundColor: '#991b1b' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  logScroll: { height: 100, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 15, padding: 10 },
  logText: { color: '#9ca3af', fontSize: 11, marginBottom: 4, fontFamily: 'monospace' },
  bottomActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  statBox: { backgroundColor: '#1f2937', padding: 10, borderRadius: 12, flex: 1, alignItems: 'center' },
  statLabel: { color: '#6b7280', fontSize: 9, fontWeight: 'bold' },
  statVal: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnAction: { backgroundColor: '#374151', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12 },
  btnActionText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
})
