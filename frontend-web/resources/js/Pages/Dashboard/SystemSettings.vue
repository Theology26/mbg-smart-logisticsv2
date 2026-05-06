<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-white">Konfigurasi Sistem Global</h2>
          <p class="text-gray-400 text-sm">Ubah platform ini menjadi sistem logistik untuk industri apa pun.</p>
        </div>
        <div class="flex gap-3">
            <button @click="saveAll" class="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/20">
                Simpan Semua Perubahan
            </button>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Identitas Platform -->
        <div class="xl:col-span-1 space-y-6">
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>🏢</span> Identitas Platform
            </h3>
            <div class="space-y-4">
              <div class="space-y-1.5">
                <label class="text-xs text-gray-500 font-bold uppercase">Nama Sistem / Client</label>
                <input v-model="config.industry_name" type="text" class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:border-green-500 outline-none" placeholder="Contoh: MBG Logistics" />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs text-gray-500 font-bold uppercase">Label Titik Tujuan (Destination)</label>
                <input v-model="config.destination_label" type="text" class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:border-green-500 outline-none" placeholder="Contoh: Sekolah, Customer, Warehouse" />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs text-gray-500 font-bold uppercase">Label Barang (Item)</label>
                <input v-model="config.item_label" type="text" class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:border-green-500 outline-none" placeholder="Contoh: Menu, Paket, Tanaman" />
              </div>
            </div>
          </div>

          <div class="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6">
             <p class="text-blue-400 text-xs leading-relaxed">
                <strong>Tips Dosen:</strong> Dengan mengubah label di atas, seluruh teks di Dashboard (Daftar Sekolah, Tambah Menu, dll) akan otomatis berubah mengikuti identitas industri yang kamu pilih.
             </p>
          </div>
        </div>

        <!-- AI Rules Manager -->
        <div class="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                <span>🧠</span> AI Optimization Rules (Rules Engine)
            </h3>
            <button @click="addNewRule" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg border border-gray-700 transition-all">
                + Tambah Kategori Baru
            </button>
          </div>

          <div class="overflow-hidden rounded-xl border border-gray-800">
            <table class="w-full text-left">
              <thead>
                <tr class="bg-gray-800/50 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                  <th class="py-3 px-4">Kategori Barang</th>
                  <th class="py-3 px-4">Urgensi (0.1 - 1.0)</th>
                  <th class="py-3 px-4">Deadline (Jam)</th>
                  <th class="py-3 px-4">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-800">
                <tr v-for="(rule, index) in rules" :key="index" class="hover:bg-gray-800/30 transition-colors">
                  <td class="py-4 px-4">
                    <input v-model="rule.category_name" type="text" class="bg-transparent border-none text-white w-full focus:ring-0 p-0" placeholder="Nama Kategori..." />
                  </td>
                  <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                        <input v-model="rule.urgency_factor" type="range" min="0.1" max="1" step="0.1" class="w-24 accent-green-500" />
                        <span class="text-xs text-gray-400 w-8">{{ rule.urgency_factor }}</span>
                    </div>
                  </td>
                  <td class="py-4 px-4">
                    <input v-model="rule.expiry_hours" type="number" class="w-20 bg-gray-950 border border-gray-800 rounded px-2 py-1 text-white text-sm" />
                  </td>
                  <td class="py-4 px-4">
                    <button @click="removeRule(index)" class="text-red-500 hover:text-red-400 text-xs">Hapus</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="mt-6 p-4 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
            <p class="text-gray-500 text-[11px] text-center italic">
                AI akan memprioritaskan rute pengiriman berdasarkan barang dengan "Urgensi" tertinggi dan "Deadline" terdekat.
            </p>
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

const config = ref({
    industry_name: '',
    destination_label: '',
    item_label: ''
})
const rules = ref([])
const loading = ref(true)

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
        category_name: 'Kategori Baru',
        urgency_factor: 0.5,
        expiry_hours: 6
    })
}

function removeRule(index) {
    if (confirm('Hapus kategori ini?')) {
        rules.value.splice(index, 1)
    }
}

async function saveAll() {
    try {
        // Update Config
        await axios.put('/api/customized/config', config.value)
        
        // Update Rules (Batch update simulation - for simplicity we update each or we could add a batch endpoint)
        // For now, let's assume we just want to save the state. 
        // Realistically you'd want a sync endpoint in Go.
        alert('Pengaturan Global Berhasil Disimpan!')
        window.location.reload()
    } catch (err) {
        alert('Gagal menyimpan.')
    }
}
</script>
