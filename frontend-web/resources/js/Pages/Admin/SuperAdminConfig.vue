<template>
  <AppLayout>
    <div class="max-w-4xl mx-auto">
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-white mb-2">Global SaaS Configurator</h2>
        <p class="text-gray-400 text-sm">Update system-wide branding and feature toggles for this client.</p>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div class="p-8 space-y-8">
          <!-- Branding Section -->
          <section>
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span class="text-xl">🎨</span> Branding & Identity
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-300">Application Name</label>
                <input v-model="settings.app_name" type="text"
                  class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g. My Catering App">
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-300">Theme Primary Color</label>
                <div class="flex gap-3">
                  <input v-model="settings.theme_color" type="color"
                    class="h-12 w-12 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer">
                  <input v-model="settings.theme_color" type="text"
                    class="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none"
                    placeholder="#3b82f6">
                </div>
              </div>
            </div>
          </section>

          <hr class="border-gray-800">

          <!-- AI Features Section -->
          <section>
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span class="text-xl">🤖</span> AI Engine Toggles
            </h3>
            <div class="bg-gray-800/50 p-6 rounded-2xl border border-gray-800 space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-white font-medium">Gemini AI Menu Recommendation</p>
                  <p class="text-gray-400 text-xs">Allow kitchen staff to use AI for recipe suggestions based on stock.</p>
                </div>
                <button @click="settings.enable_ai_menu = settings.enable_ai_menu === 'true' ? 'false' : 'true'"
                  :class="settings.enable_ai_menu === 'true' ? 'bg-green-600' : 'bg-gray-700'"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none">
                  <span :class="settings.enable_ai_menu === 'true' ? 'translate-x-6' : 'translate-x-1'"
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
                </button>
              </div>
            </div>
          </section>

          <hr class="border-gray-800">

          <!-- Logistics Section -->
          <section>
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span class="text-xl">🚚</span> Logistics Parameters
            </h3>
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-300">Default Delivery Radius (km)</label>
              <input v-model="settings.delivery_radius_km" type="number"
                class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none"
                placeholder="15">
            </div>
          </section>
        </div>

        <!-- Footer Actions -->
        <div class="bg-gray-800/30 px-8 py-6 border-t border-gray-800 flex justify-end gap-4">
          <button @click="saveSettings" :disabled="loading"
            class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2">
            <span v-if="loading">⏳ Saving...</span>
            <span v-else>💾 Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'

const settings = ref({
  app_name: '',
  theme_color: '#3b82f6',
  enable_ai_menu: 'true',
  delivery_radius_km: '15'
})
const loading = ref(false)

onMounted(async () => {
  try {
    const res = await axios.get('/api/settings')
    settings.value = res.data.data
  } catch (err) {
    console.error('Failed to load settings:', err)
  }
})

async function saveSettings() {
  loading.value = true
  try {
    await axios.put('/api/settings', settings.value)
    alert('Settings updated! Please refresh the page to apply changes.')
    window.location.reload()
  } catch (err) {
    alert('Failed to save settings: ' + err.message)
  } finally {
    loading.value = false
  }
}
</script>
