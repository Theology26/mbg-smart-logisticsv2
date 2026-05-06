import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image, SafeAreaView, Platform,
  FlatList,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRef } from 'react'
import { API_CONFIG, STORAGE_KEYS } from '../../constants/config'

// ============================================================================
// ScannerScreen — Dapur (Kitchen) Role
// Tabs:
//   [Bahan]   — View & manage all ingredients from database
//   [Scan]    — Scan nota with OCR to add new ingredients
// Features:
//   - Recommend menu using ALL available ingredients from database
//   - OCR scan to add new ingredients from nota belanja
// ============================================================================

const TABS = ['Bahan & Menu', 'Scan Nota OCR']

export default function ScannerScreen() {
  const [tab, setTab] = useState(0)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  // ── Ingredients tab state ──────────────────────────────────────
  const [ingredients, setIngredients] = useState([])
  const [ingredientsLoading, setIngredientsLoading] = useState(false)
  const [recLoading, setRecLoading] = useState(false)
  const [menuRecs, setMenuRecs] = useState(null)

  // ── OCR tab state ──────────────────────────────────────────────
  const [cameraMode, setCameraMode] = useState('home') // 'home' | 'camera' | 'result'
  const [capturedImage, setCapturedImage] = useState(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const cameraRef = useRef(null)

  useEffect(() => {
    fetchIngredients()
  }, [])

  async function getToken() {
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
  }

  // ── Fetch all ingredients from database ──────────────────────────
  async function fetchIngredients() {
    setIngredientsLoading(true)
    try {
      const token = await getToken()
      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 10000)
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/ingredients/`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      const data = await res.json()
      setIngredients(data.data || [])
    } catch (e) {
      Alert.alert('Error', 'Gagal mengambil data bahan: ' + (e.name === 'AbortError' ? 'Timeout' : e.message))
    } finally {
      setIngredientsLoading(false)
    }
  }

  // ── Recommend menu using ALL ingredients from database ────────────
  async function recommendMenuFromDB() {
    if (ingredients.length === 0) {
      Alert.alert('Info', 'Belum ada bahan di database. Scan nota terlebih dahulu.')
      return
    }
    setRecLoading(true)
    setMenuRecs(null)
    try {
      const token = await getToken()
      const names = ingredients.map(i => i.name)
      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), API_CONFIG.DEFAULT_TIMEOUT_MS)
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/menu/recommend/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          available_ingredients: names,
          student_count: 100,
          preferences: 'Bergizi, seimbang, cocok untuk anak SD, tidak terlalu pedas',
        }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
      setMenuRecs(data.data)
    } catch (e) {
      Alert.alert('Gagal', e.name === 'AbortError' ? 'Server tidak merespons (timeout).' : e.message)
    } finally {
      setRecLoading(false)
    }
  }

  // ── OCR Scan ─────────────────────────────────────────────────────
  async function takePhoto() {
    if (!cameraRef.current) return
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
      setCapturedImage(photo)
      setCameraMode('result')
      setOcrResult(null)
    } catch (e) { Alert.alert('Error', e.message) }
  }

  async function pickGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    })
    if (!res.canceled && res.assets?.[0]) {
      setCapturedImage(res.assets[0])
      setCameraMode('result')
      setOcrResult(null)
    }
  }

  async function scanOCR() {
    if (!capturedImage) return
    setOcrLoading(true)
    setOcrResult(null)
    try {
      const formData = new FormData()
      const uri = Platform.OS === 'android' ? capturedImage.uri : capturedImage.uri.replace('file://', '')
      formData.append('file', { uri, type: 'image/jpeg', name: 'nota.jpg' })

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), API_CONFIG.OCR_TIMEOUT_MS)
      const res = await fetch(`${API_CONFIG.AI_SERVICE_URL}/ocr/scan/`, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
        signal: ctrl.signal,
      })
      clearTimeout(tid)

      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        const raw = await res.text()
        throw new Error(`Server error (${res.status}): ${raw.substring(0, 80)}`)
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      setOcrResult(data)
    } catch (e) {
      Alert.alert('OCR Gagal', e.name === 'AbortError' ? 'Server AI tidak merespons (timeout 60s). Pastikan AI service berjalan.' : e.message)
    } finally {
      setOcrLoading(false)
    }
  }

  // ── Save OCR ingredients to database ─────────────────────────────
  async function saveIngredientsToDB() {
    if (!ocrResult?.ingredients?.length) return
    setSaveLoading(true)
    try {
      const token = await getToken()
      const promises = ocrResult.ingredients.map(item =>
        fetch(`${API_CONFIG.BACKEND_URL}/api/ingredients/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: item.name,
            quantity: item.quantity || 1,
            unit: item.unit || 'pcs',
          }),
        })
      )
      await Promise.all(promises)
      Alert.alert('Berhasil!', `${ocrResult.ingredients.length} bahan berhasil disimpan ke database.`)
      await fetchIngredients()  // Refresh ingredient list
      setTab(0)                 // Switch to ingredient tab
      setCameraMode('home')
    } catch (e) {
      Alert.alert('Gagal Simpan', e.message)
    } finally {
      setSaveLoading(false)
    }
  }

  function categoryColor(cat) {
    return { Kering: { bg: '#1e3a2f', border: '#22c55e', text: '#4ade80' }, Basah: { bg: '#1e2a3a', border: '#3b82f6', text: '#60a5fa' }, Santan: { bg: '#3a1e1e', border: '#ef4444', text: '#f87171' } }[cat] || { bg: '#1e2a3a', border: '#3b82f6', text: '#60a5fa' }
  }

  // ── TAB 0: Ingredients & Menu Recommendation ──────────────────────
  function renderIngredientsTab() {
    return (
      <ScrollView contentContainerStyle={st.tabContent}>
        {/* Recommend Button */}
        <TouchableOpacity
          style={[st.btnRec, recLoading && st.btnDis]}
          onPress={recommendMenuFromDB}
          disabled={recLoading}
          activeOpacity={0.8}
        >
          {recLoading
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={[st.btnTxt, { marginLeft: 10 }]}>AI sedang berpikir...</Text></>
            : <Text style={st.btnTxt}>✨ Rekomendasikan Menu dari {ingredients.length} Bahan</Text>}
        </TouchableOpacity>

        {/* Menu Recommendations */}
        {menuRecs && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>🍽️ Rekomendasi Menu AI</Text>
            {menuRecs.recommendations?.map((rec, i) => {
              const c = categoryColor(rec.category)
              return (
                <View key={i} style={[st.recCard, { backgroundColor: c.bg, borderColor: c.border }]}>
                  <View style={st.recRow}>
                    <Text style={st.recName}>{rec.name}</Text>
                    <View style={[st.badge, { borderColor: c.border }]}>
                      <Text style={[st.badgeTxt, { color: c.text }]}>{rec.category}</Text>
                    </View>
                  </View>
                  <Text style={st.recReason}>{rec.reasoning}</Text>
                  <Text style={st.recMeta}>⏱ {rec.shelf_life_estimate} · 🥘 {rec.ingredients}</Text>
                </View>
              )
            })}
            {menuRecs.notes && <Text style={st.note}>{menuRecs.notes}</Text>}
          </View>
        )}

        {/* Ingredient List */}
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>📦 Bahan di Database ({ingredients.length})</Text>
            <TouchableOpacity onPress={fetchIngredients} style={st.refreshBtn}>
              <Text style={st.refreshTxt}>🔄</Text>
            </TouchableOpacity>
          </View>

          {ingredientsLoading && <ActivityIndicator color="#22c55e" style={{ marginVertical: 20 }} />}

          {!ingredientsLoading && ingredients.length === 0 && (
            <View style={st.emptyBox}>
              <Text style={st.emptyIcon}>📭</Text>
              <Text style={st.emptyTitle}>Belum Ada Bahan</Text>
              <Text style={st.emptyDesc}>Scan nota belanja di tab "Scan Nota OCR" untuk menambah bahan.</Text>
            </View>
          )}

          {ingredients.map((item, i) => (
            <View key={item.id || i} style={st.ingCard}>
              <View style={st.ingIcon}><Text style={{ fontSize: 18 }}>🥬</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={st.ingName}>{item.name}</Text>
                <Text style={st.ingDetail}>{item.quantity} {item.unit}</Text>
              </View>
              <View style={st.ingDate}>
                <Text style={st.ingDateTxt}>
                  {item.scanned_at ? new Date(item.scanned_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    )
  }

  // ── TAB 1: OCR Scanner ────────────────────────────────────────────
  function renderScanTab() {
    if (cameraMode === 'camera') {
      if (!cameraPermission?.granted) return (
        <View style={st.centerBox}>
          <Text style={st.permText}>Izin kamera diperlukan</Text>
          <TouchableOpacity style={st.permBtn} onPress={requestCameraPermission}>
            <Text style={st.btnTxt}>Berikan Izin</Text>
          </TouchableOpacity>
        </View>
      )
      return (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" flash={flashOn ? 'on' : 'off'}>
            <View style={st.camOverlay}>
              <View style={st.scanFrame} />
              <Text style={st.scanHint}>Arahkan ke nota belanja</Text>
            </View>
            <View style={st.camControls}>
              <TouchableOpacity style={st.ctrlBtn} onPress={() => setCameraMode('home')}>
                <Text style={st.ctrlTxt}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.shutterBtn} onPress={takePhoto}>
                <View style={st.shutterInner} />
              </TouchableOpacity>
              <TouchableOpacity style={st.ctrlBtn} onPress={() => setFlashOn(f => !f)}>
                <Text style={st.ctrlTxt}>{flashOn ? '⚡' : '🔦'}</Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      )
    }

    if (cameraMode === 'result') {
      return (
        <ScrollView contentContainerStyle={st.tabContent}>
          {capturedImage && <Image source={{ uri: capturedImage.uri }} style={st.preview} resizeMode="cover" />}

          <View style={st.btnRow}>
            <TouchableOpacity style={st.btnSec} onPress={() => setCameraMode('home')} activeOpacity={0.8}>
              <Text style={st.btnSecTxt}>← Kembali</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.btnPri, ocrLoading && st.btnDis]}
              onPress={scanOCR}
              disabled={ocrLoading}
              activeOpacity={0.8}
            >
              {ocrLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnTxt}>🔍 Scan OCR</Text>}
            </TouchableOpacity>
          </View>

          {ocrResult && (
            <View style={st.ocrCard}>
              <View style={st.cardRow}>
                <Text style={st.sectionTitle}>📦 Bahan Terdeteksi ({ocrResult.ingredients.length})</Text>
                <View style={[st.badge, { borderColor: ocrResult.gpu_used ? '#22c55e' : '#f59e0b' }]}>
                  <Text style={[st.badgeTxt, { color: ocrResult.gpu_used ? '#4ade80' : '#fbbf24' }]}>
                    {ocrResult.gpu_used ? '⚡GPU' : '🖥CPU'} · {ocrResult.scan_time_ms?.toFixed(0)}ms
                  </Text>
                </View>
              </View>

              {ocrResult.ingredients.length === 0
                ? <Text style={st.emptyDesc}>Tidak ada bahan terdeteksi. Coba foto lebih jelas.</Text>
                : ocrResult.ingredients.map((item, i) => (
                  <View key={i} style={st.ingCard}>
                    <Text style={st.ingName}>{item.name}</Text>
                    <Text style={st.ingDetail}>{item.quantity > 0 ? `${item.quantity} ${item.unit}` : '—'}</Text>
                  </View>
                ))}

              <TouchableOpacity
                style={[st.btnSave, saveLoading && st.btnDis]}
                onPress={saveIngredientsToDB}
                disabled={saveLoading || ocrResult.ingredients.length === 0}
                activeOpacity={0.8}
              >
                {saveLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={st.btnTxt}>💾 Simpan ke Database</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )
    }

    // Home camera mode
    return (
      <ScrollView contentContainerStyle={st.tabContent}>
        <View style={st.scanHomeCard}>
          <Text style={st.scanHomeIcon}>📸</Text>
          <Text style={st.scanHomeTitle}>Scan Nota Belanja</Text>
          <Text style={st.scanHomeSub}>Foto nota untuk menambah bahan ke database secara otomatis</Text>
        </View>
        <TouchableOpacity style={[st.btnPri, { marginBottom: 10 }]} onPress={() => {
          if (!cameraPermission?.granted) requestCameraPermission()
          setCameraMode('camera')
        }} activeOpacity={0.8}>
          <Text style={st.btnTxt}>📷 Buka Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.btnSec} onPress={pickGallery} activeOpacity={0.8}>
          <Text style={st.btnSecTxt}>🖼️ Pilih dari Galeri</Text>
        </TouchableOpacity>

        <View style={st.aiInfoBox}>
          <Text style={st.aiInfoTitle}>🤖 AI Service (PaddleOCR)</Text>
          <Text style={st.aiInfoUrl}>{API_CONFIG.AI_SERVICE_URL}/ocr/scan/</Text>
          <Text style={st.aiInfoNote}>Pastikan AI service berjalan di laptop pada port 9000</Text>
        </View>
      </ScrollView>
    )
  }

  return (
    <SafeAreaView style={st.container}>
      {/* Tab Bar */}
      <View style={st.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={i} style={[st.tabBtn, tab === i && st.tabBtnActive]} onPress={() => setTab(i)} activeOpacity={0.8}>
            <Text style={[st.tabTxt, tab === i && st.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 0 ? renderIngredientsTab() : renderScanTab()}
      </View>
    </SafeAreaView>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  tabBar: { flexDirection: 'row', backgroundColor: '#0a0f19', borderBottomWidth: 1, borderColor: '#1f2937' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#22c55e' },
  tabTxt: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  tabTxtActive: { color: '#22c55e' },

  tabContent: { padding: 16, gap: 14, paddingBottom: 40 },

  // Recommend button
  btnRec: {
    backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  btnDis: { opacity: 0.5 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Sections
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  refreshBtn: { padding: 6 },
  refreshTxt: { fontSize: 16 },

  // Rec cards
  recCard: { borderRadius: 12, padding: 12, borderWidth: 1 },
  recRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  recName: { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 },
  recReason: { color: '#9ca3af', fontSize: 12, lineHeight: 18, marginBottom: 6 },
  recMeta: { color: '#6b7280', fontSize: 11 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: '600' },
  note: { color: '#4b5563', fontSize: 11, fontStyle: 'italic' },

  // Ingredient cards
  ingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0f1827', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#1f2937',
  },
  ingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a2a1a', alignItems: 'center', justifyContent: 'center' },
  ingName: { color: '#f3f4f6', fontWeight: '600', fontSize: 14 },
  ingDetail: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  ingDate: { alignItems: 'flex-end' },
  ingDateTxt: { color: '#4b5563', fontSize: 11 },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: '#9ca3af', fontSize: 16, fontWeight: '600' },
  emptyDesc: { color: '#6b7280', fontSize: 13, textAlign: 'center' },

  // Camera
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  permText: { color: '#fff', fontSize: 15, textAlign: 'center' },
  permBtn: { backgroundColor: '#22c55e', padding: 14, borderRadius: 12, paddingHorizontal: 24 },
  camOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 280, height: 180, borderWidth: 2, borderColor: '#22c55e', borderRadius: 12, borderStyle: 'dashed' },
  scanHint: { color: '#fff', marginTop: 14, fontSize: 13, opacity: 0.8 },
  camControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 40, paddingHorizontal: 40 },
  ctrlBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ctrlTxt: { fontSize: 20, color: '#fff' },
  shutterBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  // Scan result
  preview: { width: '100%', height: 220, borderRadius: 16 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnPri: { flex: 2, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnSec: { flex: 1, backgroundColor: '#1f2937', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  btnSecTxt: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
  btnSave: { backgroundColor: '#0369a1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  ocrCard: { backgroundColor: '#0f1827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1f2937', gap: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // AI info
  aiInfoBox: { backgroundColor: '#0a0f19', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1f2937', gap: 4 },
  aiInfoTitle: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
  aiInfoUrl: { color: '#4b5563', fontSize: 11, fontFamily: 'monospace' },
  aiInfoNote: { color: '#374151', fontSize: 11 },

  // Scan home
  scanHomeCard: { alignItems: 'center', padding: 24, gap: 8 },
  scanHomeIcon: { fontSize: 48 },
  scanHomeTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scanHomeSub: { color: '#6b7280', fontSize: 13, textAlign: 'center' },
})
