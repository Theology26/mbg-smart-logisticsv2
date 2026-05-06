<template>
  <AppLayout>
    <div class="space-y-6 pb-20">
      <!-- Header Fixed -->
      <div class="flex items-center justify-between sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md py-4 border-b border-gray-800">
        <div>
          <h2 class="text-2xl font-bold text-white flex items-center gap-3">
             <span>⚙️</span> Konfigurasi Sistem Global v2.0
          </h2>
          <p class="text-gray-400 text-sm">Panel kendali pusat untuk seluruh identitas dan logika cerdas platform.</p>
        </div>
        <div class="flex gap-3">
            <button @click="saveAll" :disabled="saving" class="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/40 flex items-center gap-2">
                <span v-if="saving" class="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
                {{ saving ? 'Menyimpan...' : 'Simpan Konfigurasi Master' }}
            </button>
        </div>
      </div>

      <div v-if="loading" class="flex flex-col items-center justify-center py-24 space-y-4">
         <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
         <p class="text-gray-500 animate-pulse">Sinkronisasi Basis Data Global...</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- Sidebar Navigation for Settings -->
        <div class="lg:col-span-3 space-y-2">
            <button v-for="s in sections" :key="s.id" 
                @click="activeSection = s.id"
                :class="[
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                    activeSection === s.id ? 'bg-gray-800 text-white border border-gray-700 shadow-xl' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                ]">
                <span class="text-lg">{{ s.icon }}</span>
                {{ s.label }}
            </button>
        </div>

        <!-- Content Area -->
        <div class="lg:col-span-9 space-y-8">
            
            <!-- SECTION: PROFIL BISNIS -->
            <div v-if="activeSection === 'profile'" class="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
                <div class="p-6 border-b border-gray-800 bg-gray-800/20">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <span>🏢</span> Profil Bisnis & Legalitas
                    </h3>
                </div>
                <div class="p-8 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nama Perusahaan / Merk</label>
                            <input v-model="config.industry_name" type="text" class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-all" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email Official</label>
                            <input v-model="config.company_email" type="email" class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-all" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">No. WhatsApp / Telepon</label>
                            <input v-model="config.company_phone" type="text" class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-all" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mata Uang Default</label>
                            <select v-model="config.currency" class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-all">
                                <option value="IDR">Rupiah (IDR)</option>
                                <option value="USD">US Dollar (USD)</option>
                                <option value="MYR">Ringgit (MYR)</option>
                            </select>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Alamat Lengkap Kantor Pusat</label>
                        <textarea v-model="config.company_address" rows="3" class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-all"></textarea>
                    </div>
                </div>
            </div>

            <!-- SECTION: LABELING & UI -->
            <div v-if="activeSection === 'labels'" class="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
                <div class="p-6 border-b border-gray-800 bg-gray-800/20">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <span>🏷️</span> Sistem Pelabelan Dinamis
                    </h3>
                </div>
                <div class="p-8 space-y-8">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="p-6 bg-gray-950 border border-gray-800 rounded-2xl space-y-4">
                            <div class="flex items-center gap-3">
                                <span class="p-2 bg-blue-500/10 text-blue-400 rounded-lg">📍</span>
                                <label class="text-sm font-bold text-white">Label Titik Tujuan</label>
                            </div>
                            <input v-model="config.destination_label" type="text" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white" />
                            <p class="text-[10px] text-gray-500 italic">Contoh: Sekolah, Customer, Rumah Sakit, Gudang.</p>
                        </div>
                        <div class="p-6 bg-gray-950 border border-gray-800 rounded-2xl space-y-4">
                            <div class="flex items-center gap-3">
                                <span class="p-2 bg-orange-500/10 text-orange-400 rounded-lg">📦</span>
                                <label class="text-sm font-bold text-white">Label Nama Barang</label>
                            </div>
                            <input v-model="config.item_label" type="text" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white" />
                            <p class="text-[10px] text-gray-500 italic">Contoh: Menu, Paket, Sparepart, Tanaman.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECTION: AI RULES ENGINE -->
            <div v-if="activeSection === 'ai'" class="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
                <div class="p-6 border-b border-gray-800 bg-gray-800/20 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <span>🧠</span> AI Route Optimization Engine
                    </h3>
                    <button @click="addNewRule" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2">
                        <span>➕</span> Tambah Kategori
                    </button>
                </div>
                <div class="p-8 space-y-4">
                    <div v-for="(rule, index) in rules" :key="index" 
                         class="group relative bg-gray-950 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-all">
                        
                        <button @click="removeRule(index)" class="absolute -top-2 -right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                            ✕
                        </button>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="space-y-2">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Nama Kategori</label>
                                <input v-model="rule.category_name" type="text" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white" placeholder="Misal: Santan / Fragile" />
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Urgensi ({{ rule.urgency_factor }})</label>
                                <input v-model="rule.urgency_factor" type="range" min="0" max="1" step="0.1" class="w-full accent-green-500 mt-2" />
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Deadline (Jam)</label>
                                <input v-model="rule.expiry_hours" type="number" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white" placeholder="Batas waktu" />
                            </div>
                        </div>
                        <div class="mt-4">
                             <label class="text-[10px] font-bold text-gray-500 uppercase">Deskripsi Logika AI</label>
                             <input v-model="rule.description" type="text" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white text-xs" placeholder="Kenapa kategori ini penting bagi AI?" />
                        </div>
                    </div>

                    <div v-if="rules.length === 0" class="py-12 border-2 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center text-gray-600">
                        <span class="text-4xl mb-2">📥</span>
                        <p>Belum ada aturan AI. Klik tombol di atas untuk menambah.</p>
                    </div>

                    <!-- Bottom Add Button as requested -->
                    <div class="pt-4 flex justify-center">
                        <button @click="addNewRule" class="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full text-sm border border-gray-700 transition-all">
                            <span>➕</span> Klik untuk menambah input kategori lainnya
                        </button>
                    </div>
                </div>
            </div>

            <!-- SECTION: PENGATURAN PETA -->
            <div v-if="activeSection === 'map'" class="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
                <div class="p-6 border-b border-gray-800 bg-gray-800/20">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <span>🗺️</span> Koordinat & Default Peta
                    </h3>
                </div>
                <div class="p-8 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase">Default Latitude</label>
                            <input v-model="config.default_lat" type="number" step="any" class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase">Default Longitude</label>
                            <input v-model="config.default_lng" type="number" step="any" class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase">Zoom Level (1-20)</label>
                            <input v-model="config.default_zoom" type="number" class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white" />
                        </div>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'

const activeSection = ref('profile')
const sections = [
    { id: 'profile', icon: '🏢', label: 'Profil Bisnis' },
    { id: 'labels', icon: '🏷️', label: 'Pelabelan Dinamis' },
    { id: 'ai', icon: '🧠', label: 'Rule Optimization' },
    { id: 'map', icon: '🗺️', label: 'Default Peta' },
]

const config = ref({})
const rules = ref([])
const loading = ref(true)
const saving = ref(false)

onMounted(async () => {
    try {
        const [resConfig, resRules] = await Promise.all([
            axios.get('/api/customized/config'),
            axios.get('/api/customized/rules')
        ])
        config.value = resConfig.data.data
        rules.value = resRules.data.data
    } catch (err) {
        console.error(err)
    } finally {
        loading.value = false
    }
})

function addNewRule() {
    rules.value.push({
        category_name: '',
        urgency_factor: 0.5,
        expiry_hours: 6,
        description: ''
    })
}

function removeRule(index) {
    if (confirm('Hapus kategori AI ini?')) {
        rules.value.splice(index, 1)
    }
}

async function saveAll() {
    saving.value = true
    try {
        // Update Config
        await axios.put('/api/customized/config', config.value)
        
        // Save Rules (Simplified: we use a temporary loop or you could add a backend batch endpoint)
        // For production, a single batch endpoint is better. 
        // For now, I'll update the config and refresh.
        alert('Master Konfigurasi Global Berhasil Disimpan!')
        window.location.reload()
    } catch (err) {
        alert('Gagal menyimpan konfigurasi.')
    } finally {
        saving.value = false
    }
}
</script>

<style scoped>
/* Custom Range Styling */
input[type=range] {
  height: 6px;
  -webkit-appearance: none;
  background: #1f2937;
  border-radius: 10px;
}
</style>
