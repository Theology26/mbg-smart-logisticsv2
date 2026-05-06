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
// ============================================================================
// Features:
//   1. Camera capture for receipt/nota scanning → PaddleOCR (port 9000)
//   2. Display extracted ingredients from OCR result
//   3. Gemini Menu Recommender → Golang backend (port 8080)
// ============================================================================

export default function ScannerScreen() {
  // ── Permissions ──────────────────────────────────────────────
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  // ── State ────────────────────────────────────────────────────
  const [mode, setMode] = useState('home')           // 'home' | 'camera' | 'result'
  const [capturedImage, setCapturedImage] = useState(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)   // { ingredients: [], raw_texts: [], gpu_used: bool }
  const [menuRecs, setMenuRecs] = useState(null)     // { recommendations: [] }
  const [flashOn, setFlashOn] = useState(false)
  const cameraRef = useRef(null)

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission()
  }, [])

  // ── Auth Token ───────────────────────────────────────────────
  async function getAuthHeaders() {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  // ── Take Photo ───────────────────────────────────────────────
  async function takePhoto() {
    if (!cameraRef.current) return
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      })
      setCapturedImage(photo)
      setMode('result')
      setOcrResult(null)
      setMenuRecs(null)
    } catch (err) {
      Alert.alert('Error', 'Gagal mengambil foto: ' + err.message)
    }
  }

  // ── Pick from Gallery ─────────────────────────────────────────
  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    })
    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0])
      setMode('result')
      setOcrResult(null)
      setMenuRecs(null)
    }
  }

  // ── POST to PaddleOCR Service ─────────────────────────────────
  // Sends the captured image to the Python AI service (port 9000)
  async function scanWithOCR() {
    if (!capturedImage) return
    setOcrLoading(true)
    setOcrResult(null)

    try {
      // Build multipart form data
      const formData = new FormData()
      formData.append('file', {
        uri: Platform.OS === 'android' ? capturedImage.uri : capturedImage.uri.replace('file://', ''),
        type: 'image/jpeg',
        name: 'nota_belanja.jpg',
      })

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.OCR_TIMEOUT_MS);

      const response = await fetch(`${API_CONFIG.AI_SERVICE_URL}/ocr/scan`, {
        method: 'POST',
        body: formData,
        headers: {
          // Note: Do NOT set Content-Type manually for multipart — React Native handles it
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'OCR request failed')
      }

      const data = await response.json()
      setOcrResult(data)
    } catch (err) {
      Alert.alert(
        'OCR Gagal',
        err.message.includes('timeout')
          ? 'Server AI tidak merespons. Pastikan layanan AI berjalan.'
          : err.message
      )
    } finally {
      setOcrLoading(false)
    }
  }

  // ── POST to Gemini Menu Recommender ──────────────────────────
  // Uses ingredient names from OCR result to get AI menu recommendations
  async function recommendMenu() {
    if (!ocrResult?.ingredients?.length) {
      Alert.alert('Info', 'Scan nota terlebih dahulu untuk mendapatkan daftar bahan.')
      return
    }
    setRecommendLoading(true)
    setMenuRecs(null)

    try {
      const headers = await getAuthHeaders()
      const ingredientNames = ocrResult.ingredients.map(i => i.name)

      const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/menu/recommend`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          available_ingredients: ingredientNames,
          student_count: 100,
          preferences: 'Bergizi, tidak pedas berlebihan untuk anak sekolah',
        }),
        signal: AbortSignal.timeout(API_CONFIG.DEFAULT_TIMEOUT_MS),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Request failed')
      setMenuRecs(data.data)
    } catch (err) {
      Alert.alert('Rekomendasi Gagal', err.message)
    } finally {
      setRecommendLoading(false)
    }
  }

  // ── Category Color ────────────────────────────────────────────
  function categoryStyle(category) {
    const styles = {
      Kering: { bg: '#1e3a2f', border: '#22c55e', text: '#4ade80' },
      Basah: { bg: '#1e2a3a', border: '#3b82f6', text: '#60a5fa' },
      Santan: { bg: '#3a1e1e', border: '#ef4444', text: '#f87171' },
    }
    return styles[category] || styles.Basah
  }

  // ── Screens ───────────────────────────────────────────────────

  // Home screen
  if (mode === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📸 Scanner Nota</Text>
          <Text style={styles.headerSub}>Scan nota belanja untuk inventaris & rekomendasi menu</Text>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { borderColor: '#22c55e' }]}
            onPress={() => setMode('camera')}
            activeOpacity={0.8}>
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionTitle}>Kamera</Text>
            <Text style={styles.actionDesc}>Foto nota belanja</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { borderColor: '#3b82f6' }]}
            onPress={pickFromGallery}
            activeOpacity={0.8}>
            <Text style={styles.actionIcon}>🖼️</Text>
            <Text style={styles.actionTitle}>Galeri</Text>
            <Text style={styles.actionDesc}>Pilih dari galeri</Text>
          </TouchableOpacity>
        </View>

        {/* GPU status indicator */}
        <View style={styles.statusBar}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>AI Service: PaddleOCR GPU Ready</Text>
        </View>
      </SafeAreaView>
    )
  }

  // Camera screen
  if (mode === 'camera') {
    if (!cameraPermission?.granted) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.permText}>Izin kamera diperlukan</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestCameraPermission}>
            <Text style={styles.permBtnText}>Berikan Izin</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )
    }
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back"
          flash={flashOn ? 'on' : 'off'}>
          {/* Viewfinder overlay */}
          <View style={styles.cameraOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Arahkan ke nota belanja</Text>
          </View>

          {/* Camera controls */}
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => setMode('home')}>
              <Text style={styles.ctrlIcon}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => setFlashOn(!flashOn)}>
              <Text style={styles.ctrlIcon}>{flashOn ? '⚡' : '🔦'}</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    )
  }

  // Result screen
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.resultContainer}>
        {/* Preview */}
        {capturedImage && (
          <Image source={{ uri: capturedImage.uri }} style={styles.preview} resizeMode="cover" />
        )}

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setMode('camera')} activeOpacity={0.8}>
            <Text style={styles.btnSecText}>🔄 Foto Ulang</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, ocrLoading && styles.btnDisabled]}
            onPress={scanWithOCR}
            disabled={ocrLoading}
            activeOpacity={0.8}>
            {ocrLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>🔍 Scan OCR</Text>}
          </TouchableOpacity>
        </View>

        {/* OCR Results */}
        {ocrResult && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📦 Bahan Terdeteksi</Text>
              <View style={[styles.badge, { borderColor: ocrResult.gpu_used ? '#22c55e' : '#f59e0b' }]}>
                <Text style={[styles.badgeText, { color: ocrResult.gpu_used ? '#4ade80' : '#fbbf24' }]}>
                  {ocrResult.gpu_used ? '⚡ GPU' : '🖥 CPU'} · {ocrResult.scan_time_ms?.toFixed(0)}ms
                </Text>
              </View>
            </View>

            {ocrResult.ingredients.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada bahan terdeteksi. Coba foto lebih jelas.</Text>
            ) : (
              ocrResult.ingredients.map((item, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{item.name}</Text>
                    {item.quantity && (
                      <Text style={styles.ingredientDetail}>
                        {item.quantity} {item.unit}
                        {item.price ? ` · Rp${item.price.toLocaleString('id')}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.confBar}>
                    <View style={[styles.confFill, {
                      width: `${(item.confidence || 0.8) * 100}%`,
                      backgroundColor: item.confidence > 0.7 ? '#22c55e' : '#f59e0b',
                    }]} />
                  </View>
                </View>
              ))
            )}

            {/* Gemini Recommend Button */}
            <TouchableOpacity
              style={[styles.btnGemini, recommendLoading && styles.btnDisabled]}
              onPress={recommendMenu}
              disabled={recommendLoading}
              activeOpacity={0.8}>
              {recommendLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>✨ Rekomendasikan Menu (AI)</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Menu Recommendations */}
        {menuRecs && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🍽️ Rekomendasi Menu</Text>
            {menuRecs.recommendations?.map((rec, i) => {
              const cs = categoryStyle(rec.category)
              return (
                <View key={i} style={[styles.recCard, { backgroundColor: cs.bg, borderColor: cs.border }]}>
                  <View style={styles.recHeader}>
                    <Text style={styles.recName}>{rec.name}</Text>
                    <View style={[styles.badge, { borderColor: cs.border }]}>
                      <Text style={[styles.badgeText, { color: cs.text }]}>{rec.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.recReason}>{rec.reasoning}</Text>
                  <Text style={styles.recDetail}>⏱ {rec.shelf_life_estimate} · 🥘 {rec.ingredients}</Text>
                </View>
              )
            })}
            {menuRecs.notes && (
              <Text style={styles.noteText}>{menuRecs.notes}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#6b7280', fontSize: 13, marginTop: 4 },
  actionGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 8 },
  actionCard: {
    flex: 1, backgroundColor: '#111827', borderRadius: 16, borderWidth: 1,
    padding: 20, alignItems: 'center', gap: 8,
  },
  actionIcon: { fontSize: 36 },
  actionTitle: { color: '#fff', fontWeight: '600', fontSize: 16 },
  actionDesc: { color: '#6b7280', fontSize: 12 },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 20, padding: 12, backgroundColor: '#111827',
    borderRadius: 10, borderWidth: 1, borderColor: '#1f2937',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  statusText: { color: '#6b7280', fontSize: 12 },
  permText: { color: '#fff', textAlign: 'center', margin: 40 },
  permBtn: { backgroundColor: '#22c55e', padding: 14, borderRadius: 12, margin: 20 },
  permBtnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },

  cameraOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 280, height: 200, borderWidth: 2,
    borderColor: '#22c55e', borderRadius: 12, borderStyle: 'dashed',
  },
  scanHint: { color: '#fff', marginTop: 16, fontSize: 13, opacity: 0.8 },
  cameraControls: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingBottom: 48, paddingHorizontal: 40,
  },
  ctrlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  ctrlIcon: { fontSize: 20 },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  resultContainer: { padding: 16, gap: 16 },
  preview: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#111827' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    flex: 2, backgroundColor: '#22c55e', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnSecondary: {
    flex: 1, backgroundColor: '#1f2937', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#374151',
  },
  btnGemini: {
    backgroundColor: '#4f46e5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnSecText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },

  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1f2937' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 12 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyText: { color: '#6b7280', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  ingredientRow: { marginBottom: 12 },
  ingredientInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  ingredientName: { color: '#f3f4f6', fontWeight: '500', fontSize: 13 },
  ingredientDetail: { color: '#6b7280', fontSize: 12 },
  confBar: { height: 3, backgroundColor: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  confFill: { height: '100%', borderRadius: 2 },

  recCard: { borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1 },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  recName: { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 },
  recReason: { color: '#9ca3af', fontSize: 12, marginBottom: 6, lineHeight: 18 },
  recDetail: { color: '#6b7280', fontSize: 11 },
  noteText: { color: '#4b5563', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
})
