import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image, SafeAreaView, Platform,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_CONFIG, STORAGE_KEYS } from '../../constants/config'

export default function ScannerScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [mode, setMode] = useState('home')
  const [capturedImage, setCapturedImage] = useState(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const cameraRef = useRef(null)

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission()
  }, [])

  async function takePhoto() {
    if (!cameraRef.current) return
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
      setCapturedImage(photo)
      setMode('result')
      setOcrResult(null)
    } catch (err) { Alert.alert('Error', err.message) }
  }

  async function scanWithOCR() {
    if (!capturedImage) return
    setOcrLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', {
        uri: Platform.OS === 'android' ? capturedImage.uri : capturedImage.uri.replace('file://', ''),
        type: 'image/jpeg',
        name: 'nota.jpg',
      })
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.OCR_TIMEOUT_MS)

      // Fix: Use the correct endpoint /ocr/scan/
      const response = await fetch(`${API_CONFIG.AI_SERVICE_URL}/ocr/scan/`, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Server Error: ${text.substring(0, 50)}`)
      }

      const data = await response.json()
      setOcrResult(data)
    } catch (err) { 
      Alert.alert('OCR Gagal', err.message) 
    } finally { setOcrLoading(false) }
  }

  if (mode === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>📸 Scanner Nota</Text>
        <TouchableOpacity style={styles.btn} onPress={() => setMode('camera')}><Text style={styles.btnText}>Buka Kamera</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, {marginTop: 10}]} onPress={() => {}}><Text style={styles.btnText}>Pilih Galeri</Text></TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
       <ScrollView>
          <TouchableOpacity onPress={() => setMode('home')}><Text style={{color: '#6b7280', marginBottom: 10}}>← Kembali</Text></TouchableOpacity>
          {capturedImage && <Image source={{ uri: capturedImage.uri }} style={styles.preview} />}
          <TouchableOpacity style={styles.btnScan} onPress={scanWithOCR} disabled={ocrLoading}>
            <Text style={styles.btnText}>{ocrLoading ? 'Sedang Memproses...' : 'Scan Nota Sekarang'}</Text>
          </TouchableOpacity>
          {ocrResult && (
            <View style={styles.resCard}>
               <Text style={styles.resTitle}>Hasil OCR:</Text>
               {ocrResult.ingredients?.map((it, i) => <Text key={i} style={styles.it}>• {it.name}</Text>)}
            </View>
          )}
       </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  btn: { backgroundColor: '#111827', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#1f2937' },
  btnText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  preview: { width: '100%', height: 350, borderRadius: 12, marginBottom: 20 },
  btnScan: { backgroundColor: '#22c55e', padding: 18, borderRadius: 12 },
  resCard: { marginTop: 20, padding: 15, backgroundColor: '#111827', borderRadius: 12 },
  resTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 10 },
  it: { color: '#9ca3af', marginBottom: 5 }
})
