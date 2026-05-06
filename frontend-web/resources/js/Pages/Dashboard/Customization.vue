<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-white">Kustomisasi Global</h2>
          <p class="text-gray-400 text-sm">Kelola identitas platform dan aturan cerdas AI secara dinamis.</p>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="flex gap-4 border-b border-gray-800">
        <button v-for="tab in ['Design', 'Aturan AI', 'Identitas']" :key="tab"
          @click="activeTab = tab"
          :class="[
            'px-6 py-3 text-sm font-medium transition-all border-b-2',
            activeTab === tab ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'
          ]">
          {{ tab }}
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>

      <div v-else class="space-y-6">
        <!-- TAB: DESIGN -->
        <div v-if="activeTab === 'Design'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
            <div class="flex items-center gap-2 mb-4">
              <span class="text-xl">🎨</span>
              <h3 class="text-lg font-semibold text-white">Tema Visual</h3>
            </div>
            <div v-for="style in styles" :key="style.id" class="space-y-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700">
              <div class="flex items-center justify-between">
                <h4 class="text-white font-medium">{{ style.theme_name }}</h4>
                <span v-if="style.is_active" class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">AKTIF</span>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-xs text-gray-400">Warna Utama</label>
                  <div class="flex items-center gap-2">
                    <input type="color" v-model="style.primary_color" class="w-10 h-10 rounded bg-transparent border-none cursor-pointer" />
                    <input type="text" v-model="style.primary_color" class="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="text-xs text-gray-400">Warna Sekunder</label>
                  <div class="flex items-center gap-2">
                    <input type="color" v-model="style.secondary_color" class="w-10 h-10 rounded bg-transparent border-none cursor-pointer" />
                    <input type="text" v-model="style.secondary_color" class="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>
                </div>
              </div>
              <button @click="updateStyle(style)" :disabled="saving" class="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-all disabled:opacity-50">
                Simpan Perubahan
              </button>
            </div>
          </div>
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
             <div class="aspect-video rounded-xl border border-gray-800 bg-gray-950 p-4 space-y-3">
                <div class="flex gap-2">
                   <div class="w-12 h-3 rounded" :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }"></div>
                   <div class="w-8 h-3 rounded opacity-30" :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }"></div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                   <div v-for="i in 3" :key="i" class="h-16 rounded-lg bg-gray-900 border border-gray-800 p-2 space-y-2">
                      <div class="w-full h-1 rounded opacity-20" :style="{ backgroundColor: activeStyle?.secondary_color || '#3b82f6' }"></div>
                      <div class="w-2/3 h-2 rounded" :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }"></div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <!-- TAB: ATURAN AI -->
        <div v-if="activeTab === 'Aturan AI'" class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-white">Rule Optimization Engine</h3>
            <p class="text-xs text-gray-500 italic">* Aturan ini menentukan cara AI menghitung prioritas rute.</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="text-gray-400 text-xs uppercase border-b border-gray-800">
                  <th class="py-3 px-4">Kategori</th>
                  <th class="py-3 px-4">Faktor Urgensi (0-1)</th>
                  <th class="py-3 px-4">Batas Waktu (Jam)</th>
                  <th class="py-3 px-4">Aksi</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                <tr v-for="rule in rules" :key="rule.id" class="border-b border-gray-800/50">
                  <td class="py-4 px-4 font-medium text-white">{{ rule.category_name }}</td>
                  <td class="py-4 px-4">
                    <input type="number" step="0.1" v-model="rule.urgency_factor" class="w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white" />
                  </td>
                  <td class="py-4 px-4">
                    <input type="number" v-model="rule.expiry_hours" class="w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white" />
                  </td>
                  <td class="py-4 px-4">
                    <button @click="updateRule(rule)" class="text-blue-400 hover:text-blue-300">Simpan</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- TAB: IDENTITAS -->
        <div v-if="activeTab === 'Identitas'" class="max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div class="space-y-6">
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-400">Nama Platform</label>
              <input type="text" v-model="config.industry_name" class="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-400">Label Tujuan (Drop Point)</label>
                <input type="text" v-model="config.destination_label" class="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white" />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-400">Label Barang (Item)</label>
                <input type="text" v-model="config.item_label" class="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white" />
              </div>
            </div>
            <button @click="updateConfig" class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all">
              Update Konfigurasi Global
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'

const activeTab = ref('Design')
const styles = ref([])
const rules = ref([])
const config = ref({})
const loading = ref(true)
const saving = ref(false)

const activeStyle = computed(() => styles.value.find(s => s.is_active))

onMounted(async () => {
  await Promise.all([fetchStyles(), fetchRules(), fetchConfig()])
  loading.value = false
})

async function fetchStyles() {
  const res = await axios.get('/api/customized/styles')
  styles.value = res.data.data
}

async function fetchRules() {
  const res = await axios.get('/api/customized/rules')
  rules.value = res.data.data
}

async function fetchConfig() {
  const res = await axios.get('/api/customized/config')
  config.value = res.data.data
}

async function updateStyle(style) {
  await axios.put(`/api/customized/styles/${style.id}`, style)
  alert('Tema diperbarui!')
}

async function updateRule(rule) {
  await axios.put(`/api/customized/rules/${rule.id}`, rule)
  alert('Aturan AI diperbarui!')
}

async function updateConfig() {
  await axios.put('/api/customized/config', config.value)
  alert('Identitas platform diperbarui!')
}
</script>
