import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image, SafeAreaView, Platform,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_CONFIG, STORAGE_KEYS } from '../../constants/config'

// ============================================================================
// ScannerScreen — Dapur (Kitchen) Role
// Features:
//   1. Camera / Gallery → PaddleOCR (port 9000) → ingredient list
//   2. Gemini AI Menu Recommendation → Golang backend (port 8080)
// ============================================================================

export default function ScannerScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [mode, setMode] = useState('home')         // 'home' | 'camera' | 'result'
  const [capturedImage, setCapturedImage] = useState(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [recLoading, setRecLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState(null) // { ingredients, raw_texts, gpu_used, scan_time_ms }
  const [menuRecs, setMenuRecs] = useState(null)
  const [flashOn, setFlashOn] = useState(false)
  const cameraRef = useRef(null)

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission()
  }, [])

  async function getToken() {
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
  }

  // ── Camera ────────────────────────────────────────────────────
  async function takePhoto() {
    if (!cameraRef.current) return
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
      setCapturedImage(photo)
      setMode('result')
      setOcrResult(null)
      setMenuRecs(null)
    } catch (e) {
      Alert.alert('Error', 'Gagal mengambil foto: ' + e.message)
    }
  }

  async function pickFromGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    })
    if (!res.canceled && res.assets?.[0]) {
      setCapturedImage(res.assets[0])
      setMode('result')
      setOcrResult(null)
      setMenuRecs(null)
    }
  }

  // ── OCR Scan ──────────────────────────────────────────────────
  async function scanWithOCR() {
    if (!capturedImage) return
    setOcrLoading(true)
    setOcrResult(null)
    try {
      const formData = new FormData()
      const uri = Platform.OS === 'android'
        ? capturedImage.uri
        : capturedImage.uri.replace('file://', '')
      formData.append('file', { uri, type: 'image/jpeg', name: 'nota.jpg' })

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), API_CONFIG.OCR_TIMEOUT_MS)
      const res = await fetch(`${API_CONFIG.AI_SERVICE_URL}/ocr/scan/`, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
        signal: ctrl.signal,
      })
      clearTimeout(tid)

      // Safety check: ensure the response is actually JSON before parsing
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const raw = await res.text()
        throw new Error(`Server mengembalikan error (${res.status}): ${raw.substring(0, 80)}`)
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      setOcrResult(data)
    } catch (e) {
      Alert.alert(
        'OCR Gagal',
        e.name === 'AbortError'
          ? 'Server AI tidak merespons (timeout 60s). Pastikan AI service berjalan di port 9000.'
          : e.message
      )
    } finally {
      setOcrLoading(false)
    }
  }

  // ── Gemini Menu Recommendation ────────────────────────────────
  async function recommendMenu() {
    if (!ocrResult?.ingredients?.length) {
      Alert.alert('Info', 'Scan nota terlebih dahulu untuk mendapatkan daftar bahan.')
      return
    }
    setRecLoading(true)
    setMenuRecs(null)
    try {
      const token = await getToken()
      const names = ocrResult.ingredients.map(i => i.name)

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), API_CONFIG.DEFAULT_TIMEOUT_MS)
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/menu/recommend/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          available_ingredients: names,
          student_count: 100,
          preferences: 'Bergizi, tidak pedas berlebihan untuk anak sekolah SD',
        }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
      setMenuRecs(data.data)
    } catch (e) {
      Alert.alert(
        'Rekomendasi Gagal',
        e.name === 'AbortError' ? 'Server tidak merespons (timeout).' : e.message
      )
    } finally {
      setRecLoading(false)
    }
  }

  function categoryColor(cat) {
    return {
      Kering: { bg: '#1e3a2f', border: '#22c55e', text: '#4ade80' },
      Basah:  { bg: '#1e2a3a', border: '#3b82f6', text: '#60a5fa' },
      Santan: { bg: '#3a1e1e', border: '#ef4444', text: '#f87171' },
    }[cat] || { bg: '#1e2a3a', border: '#3b82f6', text: '#60a5fa' }
  }

  // ── HOME ──────────────────────────────────────────────────────
  if (mode === 'home') return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>📸 Scanner Nota</Text>
        <Text style={s.sub}>Scan nota belanja untuk inventaris & rekomendasi menu AI</Text>
      </View>

      <View style={s.grid}>
        <TouchableOpacity style={[s.card, { borderColor: '#22c55e' }]} onPress={() => setMode('camera')} activeOpacity={0.8}>
          <Text style={s.cardIcon}>📷</Text>
          <Text style={s.cardTitle}>Kamera</Text>
          <Text style={s.cardDesc}>Foto langsung nota</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.card, { borderColor: '#3b82f6' }]} onPress={pickFromGallery} activeOpacity={0.8}>
          <Text style={s.cardIcon}>🖼️</Text>
          <Text style={s.cardTitle}>Galeri</Text>
          <Text style={s.cardDesc}>Pilih dari galeri</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statusBar}>
        <View style={s.statusDot} />
        <Text style={s.statusText}>AI Service (PaddleOCR) • port 9000</Text>
      </View>
    </SafeAreaView>
  )

  // ── CAMERA ────────────────────────────────────────────────────
  if (mode === 'camera') {
    if (!cameraPermission?.granted) return (
      <SafeAreaView style={s.container}>
        <Text style={s.permText}>Izin kamera diperlukan untuk scan nota</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestCameraPermission}>
          <Text style={s.permBtnText}>Berikan Izin Kamera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" flash={flashOn ? 'on' : 'off'}>
          <View style={s.overlay}>
            <View style={s.frame} />
            <Text style={s.hint}>Arahkan ke nota belanja</Text>
          </View>
          <View style={s.camControls}>
            <TouchableOpacity style={s.ctrlBtn} onPress={() => setMode('home')}>
              <Text style={s.ctrlTxt}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shutterBtn} onPress={takePhoto}>
              <View style={s.shutterInner} />
            </TouchableOpacity>
            <TouchableOpacity style={s.ctrlBtn} onPress={() => setFlashOn(f => !f)}>
              <Text style={s.ctrlTxt}>{flashOn ? '⚡' : '🔦'}</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    )
  }

  // ── RESULT ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.resultWrap}>
        {/* Photo preview */}
        {capturedImage && (
          <Image source={{ uri: capturedImage.uri }} style={s.preview} resizeMode="cover" />
        )}

        {/* Buttons row */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.btnSec} onPress={() => setMode('camera')} activeOpacity={0.8}>
            <Text style={s.btnSecTxt}>🔄 Foto Ulang</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btnPri, ocrLoading && s.btnDis]}
            onPress={scanWithOCR}
            disabled={ocrLoading}
            activeOpacity={0.8}
          >
            {ocrLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnTxt}>🔍 Scan OCR Sekarang</Text>}
          </TouchableOpacity>
        </View>

        {/* OCR Result */}
        {ocrResult && (
          <View style={s.card2}>
            <View style={s.cardRow}>
              <Text style={s.cardTitle2}>📦 Bahan Terdeteksi</Text>
              <View style={[s.badge, { borderColor: ocrResult.gpu_used ? '#22c55e' : '#f59e0b' }]}>
                <Text style={[s.badgeTxt, { color: ocrResult.gpu_used ? '#4ade80' : '#fbbf24' }]}>
                  {ocrResult.gpu_used ? '⚡ GPU' : '🖥 CPU'} · {ocrResult.scan_time_ms?.toFixed(0)}ms
                </Text>
              </View>
            </View>

            {ocrResult.ingredients.length === 0
              ? <Text style={s.empty}>Tidak ada bahan terdeteksi. Coba foto lebih jelas atau dekat.</Text>
              : ocrResult.ingredients.map((item, i) => (
                <View key={i} style={s.ingRow}>
                  <View style={s.ingInfo}>
                    <Text style={s.ingName}>{item.name}</Text>
                    {item.quantity > 0 && (
                      <Text style={s.ingDetail}>
                        {item.quantity} {item.unit}{item.price ? ` · Rp${item.price.toLocaleString('id')}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={s.bar}>
                    <View style={[s.barFill, {
                      width: `${(item.confidence || 0.8) * 100}%`,
                      backgroundColor: (item.confidence || 0.8) > 0.7 ? '#22c55e' : '#f59e0b',
                    }]} />
                  </View>
                </View>
              ))}

            <TouchableOpacity
              style={[s.btnGemini, recLoading && s.btnDis]}
              onPress={recommendMenu}
              disabled={recLoading}
              activeOpacity={0.8}
            >
              {recLoading
                ? <><ActivityIndicator color="#fff" size="small" /><Text style={[s.btnTxt, { marginLeft: 8 }]}>AI sedang berpikir...</Text></>
                : <Text style={s.btnTxt}>✨ Rekomendasikan Menu (Gemini AI)</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Menu Recommendations */}
        {menuRecs && (
          <View style={s.card2}>
            <Text style={s.cardTitle2}>🍽️ Rekomendasi Menu</Text>
            {menuRecs.recommendations?.map((rec, i) => {
              const c = categoryColor(rec.category)
              return (
                <View key={i} style={[s.recCard, { backgroundColor: c.bg, borderColor: c.border }]}>
                  <View style={s.recHead}>
                    <Text style={s.recName}>{rec.name}</Text>
                    <View style={[s.badge, { borderColor: c.border }]}>
                      <Text style={[s.badgeTxt, { color: c.text }]}>{rec.category}</Text>
                    </View>
                  </View>
                  <Text style={s.recReason}>{rec.reasoning}</Text>
                  <Text style={s.recMeta}>⏱ {rec.shelf_life_estimate} · 🥘 {rec.ingredients}</Text>
                </View>
              )
            })}
            {menuRecs.notes && <Text style={s.note}>{menuRecs.notes}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  sub: { color: '#6b7280', fontSize: 13, marginTop: 4 },
  grid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 8 },
  card: { flex: 1, backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', gap: 6 },
  cardIcon: { fontSize: 34 },
  cardTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cardDesc: { color: '#6b7280', fontSize: 12, textAlign: 'center' },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 20, padding: 12, backgroundColor: '#111827', borderRadius: 10, borderWidth: 1, borderColor: '#1f2937' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  statusText: { color: '#6b7280', fontSize: 12 },
  permText: { color: '#fff', textAlign: 'center', margin: 40, fontSize: 14 },
  permBtn: { backgroundColor: '#22c55e', padding: 14, borderRadius: 12, marginHorizontal: 20 },
  permBtnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 280, height: 200, borderWidth: 2, borderColor: '#22c55e', borderRadius: 12, borderStyle: 'dashed' },
  hint: { color: '#fff', marginTop: 14, fontSize: 13, opacity: 0.8 },
  camControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 48, paddingHorizontal: 40 },
  ctrlBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ctrlTxt: { fontSize: 20, color: '#fff' },
  shutterBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  resultWrap: { padding: 16, gap: 14 },
  preview: { width: '100%', height: 230, borderRadius: 16, backgroundColor: '#111827' },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnPri: { flex: 2, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnSec: { flex: 1, backgroundColor: '#1f2937', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  btnGemini: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12, flexDirection: 'row', justifyContent: 'center' },
  btnDis: { opacity: 0.5 },
  btnTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnSecTxt: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
  card2: { backgroundColor: '#111827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1f2937' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle2: { color: '#fff', fontWeight: '700', fontSize: 15 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: '600' },
  empty: { color: '#6b7280', fontSize: 13, textAlign: 'center', paddingVertical: 14 },
  ingRow: { marginBottom: 10 },
  ingInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  ingName: { color: '#f3f4f6', fontWeight: '500', fontSize: 13 },
  ingDetail: { color: '#6b7280', fontSize: 12 },
  bar: { height: 3, backgroundColor: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  recCard: { borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1 },
  recHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  recName: { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 },
  recReason: { color: '#9ca3af', fontSize: 12, marginBottom: 6, lineHeight: 18 },
  recMeta: { color: '#6b7280', fontSize: 11 },
  note: { color: '#4b5563', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
})
