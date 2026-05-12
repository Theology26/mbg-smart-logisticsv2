<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-slate-900 text-2xl font-black tracking-tight">📊 Dashboard Summary</h2>
        <div class="text-[10px] text-emerald-600 font-black bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full uppercase tracking-widest">System Online</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div v-for="stat in stats" :key="stat.label" class="bg-white border border-slate-200 p-6 rounded-[32px] shadow-sm hover:shadow-md transition-all">
          <p class="text-slate-400 text-[10px] uppercase font-black tracking-widest">{{ stat.label }}</p>
          <p class="text-slate-900 text-4xl font-black mt-2 tracking-tight">{{ stat.value }}</p>
        </div>
      </div>

      <div class="flex gap-4">
        <button v-if="userRole === 'admin'" @click="showDapurModal = true" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-sm transition-all flex items-center gap-2">
          <span>🏢</span> Tambah Unit Dapur MBG
        </button>
      </div>
      
      <!-- Modal Tambah Dapur -->
      <div v-if="showDapurModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white rounded-[32px] p-8 w-full max-w-md">
          <h3 class="text-xl font-black text-slate-900 mb-6">Buat Unit Dapur Baru</h3>
          <div class="space-y-4">
            <div>
              <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Nama Dapur</label>
              <input v-model="dapurForm.name" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mt-1" placeholder="Misal: Dapur SPPG Singosari" />
            </div>
            <div>
              <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Dapur</label>
              <input v-model="dapurForm.email" type="email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mt-1" placeholder="singosari@mbg.com" />
            </div>
            <div>
              <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Password</label>
              <input v-model="dapurForm.password" type="password" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mt-1" placeholder="Minimal 6 karakter" />
            </div>
            <div>
              <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Dapur ID (Sesuai Wilayah)</label>
              <input v-model.number="dapurForm.dapur_id" type="number" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 mt-1" placeholder="Contoh: 6" />
            </div>
          </div>
          <div class="flex gap-3 mt-8">
            <button @click="showDapurModal = false" class="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Batal</button>
            <button @click="createDapur" :disabled="isSubmitting" class="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 disabled:opacity-50">
              {{ isSubmitting ? 'Memproses...' : 'Buat Dapur' }}
            </button>
          </div>
        </div>
      </div>
      
      <div class="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
         <h3 class="text-slate-900 font-black text-lg mb-6 flex items-center gap-2">
           <span class="p-2 bg-blue-50 rounded-xl">🏫</span> Daftar Sekolah Aktif
         </h3>
         <div v-if="loading" class="text-slate-400 italic text-sm">Loading data dari database...</div>
         <div v-else class="space-y-3">
            <div v-for="s in schools" :key="s.id" class="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:bg-blue-50/50 transition-all">
               <span class="text-slate-900 font-bold">{{ s.name }}</span>
               <span class="text-slate-400 text-xs font-medium">{{ s.address }}</span>
            </div>
            <div v-if="schools.length === 0" class="text-red-500 text-sm font-bold">Database kosong atau tidak terbaca.</div>
         </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'
import { API_BASE_URL } from '@/config'

const userRole = ref(localStorage.getItem('mbg_role') || 'guest')

const schools = ref([])
const stats = ref([
  { label: 'Sekolah', value: 0 },
  { label: 'Bahan Baku', value: 0 },
  { label: 'Jadwal', value: 0 },
  { label: 'Kurir', value: 0 }
])
const loading = ref(true)

const showDapurModal = ref(false)
const isSubmitting = ref(false)
const dapurForm = ref({
  name: '',
  email: '',
  password: '',
  role: 'dapur',
  dapur_id: null
})

async function createDapur() {
  if (!dapurForm.value.name || !dapurForm.value.email || !dapurForm.value.password || !dapurForm.value.dapur_id) {
    return alert('Semua kolom harus diisi!');
  }
  isSubmitting.value = true;
  try {
    const res = await axios.post(`${API_BASE_URL.replace('/api', '/api/auth')}/register`, dapurForm.value);
    alert('Dapur berhasil dibuat!');
    showDapurModal.value = false;
    dapurForm.value = { name: '', email: '', password: '', role: 'dapur', dapur_id: null };
  } catch (e) {
    console.error(e);
    alert('Gagal membuat Dapur.');
  } finally {
    isSubmitting.value = false;
  }
}

async function fetchData() {
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    const [s, i, sc, d] = await Promise.all([
      axios.get(`${API_BASE_URL}/schools`, { headers }),
      axios.get(`${API_BASE_URL}/ingredients`, { headers }),
      axios.get(`${API_BASE_URL}/schedules`, { headers }),
      axios.get(`${API_BASE_URL}/deliveries`, { headers }),
    ])
    schools.value = s.data.data || []
    stats.value[0].value = schools.value.length
    stats.value[1].value = (i.data.data || []).length
    stats.value[2].value = (sc.data.data || []).length
    stats.value[3].value = (d.data.data || []).filter(x => x.status === 'in_transit').length
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>
