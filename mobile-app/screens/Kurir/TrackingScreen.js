import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, SafeAreaView, AppState,
} from 'react-native'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_CONFIG, TRACKING_CONFIG, STORAGE_KEYS } from '../../constants/config'

export default function TrackingScreen() {
  const [trackingActive, setTrackingActive] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [cachedPoints, setCachedPoints] = useState(0)
  const [lastUpload, setLastUpload] = useState(null)
  const [uploadCount, setUploadCount] = useState(0)
  const [routeSequence, setRouteSequence] = useState([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [deliveryId, setDeliveryId] = useState(null)
  const [statusLog, setStatusLog] = useState([])

  const locationSubscription = useRef(null)
  const gpsCacheInterval = useRef(null)
  const batchUploadInterval = useRef(null)
  const appStateRef = useRef(AppState.currentState)

  useEffect(() => {
    requestPermissions()
    loadCachedRoute()
    const appStateSub = AppState.addEventListener('change', handleAppStateChange)
    return () => {
      stopTracking()
      appStateSub.remove()
    }
  }, [])

  function handleAppStateChange(nextState) {
    if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
      if (trackingActive) addLog('📱 App kembali ke foreground')
    }
    appStateRef.current = nextState
  }

  async function requestPermissions() {
    const { status: fg } = await Location.requestForegroundPermissionsAsync()
    if (fg !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izin lokasi diperlukan.')
      return false
    }
    return true
  }

  async function getAuthHeaders() {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  async function loadCachedPoints() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.GPS_CACHE)
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  }

  async function cacheGPSPoint(location) {
    try {
      const existing = await loadCachedPoints()
      if (location.coords.accuracy > TRACKING_CONFIG.GPS_ACCURACY_THRESHOLD_M) {
        addLog(`⚠️ GPS tidak akurat (${location.coords.accuracy?.toFixed(0)}m)`)
        return existing.length
      }
      const updated = [...existing, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        recorded_at: new Date().toISOString(),
        speed: location.coords.speed,
        accuracy: location.coords.accuracy,
      }]
      await AsyncStorage.setItem(STORAGE_KEYS.GPS_CACHE, JSON.stringify(updated))
      setCachedPoints(updated.length)
      if (updated.length >= TRACKING_CONFIG.MAX_BATCH_SIZE) await uploadBatch(updated)
      return updated.length
    } catch (err) { return 0 }
  }

  async function startTracking() {
    if (!await requestPermissions()) return
    setTrackingActive(true)
    addLog('🟢 Tracking dimulai')
    gpsCacheInterval.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setCurrentLocation(loc)
        await cacheGPSPoint(loc)
        addLog(`📍 GPS dicache`)
      } catch (err) { addLog(`⚠️ GPS error: ${err.message}`) }
    }, TRACKING_CONFIG.GPS_CACHE_INTERVAL_MS)

    batchUploadInterval.current = setInterval(async () => {
      const points = await loadCachedPoints()
      if (points.length > 0) await uploadBatch(points)
    }, TRACKING_CONFIG.BATCH_UPLOAD_INTERVAL_MS)
  }

  function stopTracking() {
    if (gpsCacheInterval.current) clearInterval(gpsCacheInterval.current)
    if (batchUploadInterval.current) clearInterval(batchUploadInterval.current)
    setTrackingActive(false)
    addLog('🔴 Tracking dihentikan')
  }

  async function uploadBatch(points) {
    try {
      const headers = await getAuthHeaders()
      // Fix: Use AbortController for compatibility
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/tracking/batch/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          courier_id: 1, // Default to 1 if not found
          points: points
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        await AsyncStorage.removeItem(STORAGE_KEYS.GPS_CACHE)
        setCachedPoints(0)
        setUploadCount(prev => prev + points.length)
        setLastUpload(new Date().toLocaleTimeString('id-ID'))
        addLog(`✅ ${points.length} titik berhasil diupload`)
      } else {
        addLog(`❌ Upload gagal: ${response.status}`)
      }
    } catch (err) {
      addLog(`❌ Upload error: ${err.message}`)
    }
  }

  async function fetchRouteSequence() {
    setRouteLoading(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      const res = await fetch(`${API_CONFIG.AI_SERVICE_URL}/routing/optimize/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depot_lat: -7.96, depot_lng: 112.6, schools: [] }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      setRouteSequence(data.route || [])
      addLog('🧠 Rute optimasi diterima')
    } catch (err) { addLog(`❌ A2C error: ${err.message}`) }
    finally { setRouteLoading(false) }
  }

  async function loadCachedRoute() {
    const cached = await loadCachedPoints()
    setCachedPoints(cached.length)
  }

  function addLog(message) {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setStatusLog(prev => [`[${time}] ${message}`, ...prev].slice(0, 15))
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kurir Tracker</Text>
        </View>
        <TouchableOpacity
          style={[styles.mainBtn, trackingActive ? styles.mainBtnStop : styles.mainBtnStart]}
          onPress={trackingActive ? stopTracking : startTracking}>
          <Text style={styles.mainBtnText}>{trackingActive ? '⏹ Hentikan Tracking' : '▶ Mulai Tracking'}</Text>
        </TouchableOpacity>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Text style={styles.statValue}>{cachedPoints}</Text><Text style={styles.statLabel}>Cached</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{uploadCount}</Text><Text style={styles.statLabel}>Total</Text></View>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Log Aktivitas</Text>
          {statusLog.map((log, i) => <Text key={i} style={[styles.logEntry, log.includes('✅') ? styles.logSuccess : log.includes('❌') ? styles.logError : styles.logInfo]}>{log}</Text>)}
        </View>
        <TouchableOpacity style={styles.flushBtn} onPress={() => uploadBatch(loadCachedPoints())}>
           <Text style={styles.flushText}>Upload Sekarang</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  scroll: { padding: 16, gap: 14 },
  header: { marginBottom: 10 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  mainBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  mainBtnStart: { backgroundColor: '#15803d' },
  mainBtnStop: { backgroundColor: '#991b1b' },
  mainBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#111827', borderRadius: 14, padding: 14, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#6b7280', fontSize: 10 },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16 },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 12 },
  logEntry: { fontSize: 11, marginBottom: 4, fontFamily: 'monospace' },
  logSuccess: { color: '#4ade80' },
  logError: { color: '#f87171' },
  logInfo: { color: '#6b7280' },
  flushBtn: { backgroundColor: '#1e3a2f', padding: 12, borderRadius: 12, alignItems: 'center' },
  flushText: { color: '#4ade80', fontWeight: 'bold' }
})
