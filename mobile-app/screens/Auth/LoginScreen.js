import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../../constants/config';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Harap isi email dan password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_CONFIG.BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Store JWT token and user info
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.data.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.data.user));

        const role = data.data.user.role;

        // Auto-route based on role
        if (role === 'dapur') {
          navigation.replace('ScannerScreen'); // Adjust based on your actual Navigator route name
        } else if (role === 'kurir') {
          navigation.replace('TrackingScreen');
        } else if (role === 'guru') {
          navigation.replace('GuruScreen');
        } else {
          Alert.alert('Akses Ditolak', 'Aplikasi ini hanya untuk Kurir, Dapur, dan Guru.');
        }
      } else {
        Alert.alert('Login Gagal', data.message || 'Email atau password salah.');
      }
    } catch (err) {
      Alert.alert('Error Koneksi', 'Gagal terhubung ke server. Periksa jaringan Anda.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={styles.title}>MBG Logistics</Text>
          <Text style={styles.subtitle}>Mobile App (Kurir & Dapur)</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="kurir@mbg.com"
              placeholderTextColor="#6b7280"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              secureTextEntry={true}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Masuk (Login)</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712', // gray-950
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9ca3af', // gray-400
    fontSize: 14,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#d1d5db', // gray-300
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f2937', // gray-800
    borderWidth: 1,
    borderColor: '#374151', // gray-700
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#059669', // emerald-600
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
