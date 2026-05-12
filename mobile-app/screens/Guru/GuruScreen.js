import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../../constants/config';
import axios from 'axios';

export default function GuruScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (storedUser) {
        setUserData(JSON.parse(storedUser));
      }
      await fetchDeliveries();
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchDeliveries() {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const res = await axios.get(`${API_CONFIG.BACKEND_URL}/api/deliveries/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeliveries(res.data.data || []);
    } catch (err) {
      console.error("Error fetching deliveries:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    navigation.replace('LoginScreen');
  }

  async function submitFeedback() {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      await axios.post(`${API_CONFIG.BACKEND_URL}/api/feedbacks/`, { message: feedback }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert("Sukses", "Feedback berhasil dikirim!");
      setFeedback('');
    } catch (err) {
      console.error(err);
      Alert.alert("Gagal", "Gagal mengirim feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  async function markHoliday() {
    Alert.alert(
      "Konfirmasi Libur",
      "Apakah Anda yakin sekolah hari ini libur? Ini akan MEMBATALKAN semua pengiriman makanan hari ini.",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Libur", 
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
              await axios.put(`${API_CONFIG.BACKEND_URL}/api/deliveries/cancel-for-school`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              });
              Alert.alert("Dibatalkan", "Pengiriman hari ini telah dibatalkan.");
              fetchDeliveries();
            } catch(e) {
              Alert.alert("Gagal", "Gagal membatalkan pengiriman.");
            }
          }
        }
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Halo, {userData?.name}</Text>
          <Text style={styles.subtitle}>Dashboard Guru Sekolah</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionHeader}>
        <Text style={styles.sectionTitle}>Status Pengiriman Hari Ini</Text>
        <TouchableOpacity style={styles.holidayBtn} onPress={markHoliday}>
          <Text style={styles.holidayText}>Sekolah Libur ❌</Text>
        </TouchableOpacity>
      </View>
      {deliveries.length === 0 ? (
        <Text style={styles.noData}>Belum ada pengiriman untuk sekolah ini.</Text>
      ) : (
        deliveries.map(item => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.schoolName}>{item.school.name}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Kurir:</Text>
              <Text style={styles.value}>{item.courier.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Menu:</Text>
              <Text style={styles.value}>{item.schedule.menu.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <Text style={[styles.status, item.status === 'delivered' ? styles.statusSuccess : styles.statusWarning]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
        ))
      )}

      <View style={styles.feedbackSection}>
        <Text style={styles.sectionTitle}>Beri Feedback Menu Hari Ini</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          placeholder="Tuliskan komentar atau masukan untuk makanan hari ini..."
          placeholderTextColor="#6b7280"
          value={feedback}
          onChangeText={setFeedback}
        />
        <TouchableOpacity 
          style={[styles.submitBtn, submitting && styles.disabledBtn]} 
          onPress={submitFeedback}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>{submitting ? "Mengirim..." : "Kirim Feedback"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  holidayBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  holidayText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noData: {
    marginHorizontal: 20,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#6b7280',
    fontSize: 14,
  },
  value: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  status: {
    fontWeight: 'bold',
  },
  statusSuccess: {
    color: '#10b981',
  },
  statusWarning: {
    color: '#f59e0b',
  },
  feedbackSection: {
    margin: 20,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
