<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
    <div class="max-w-md w-full p-8 bg-gray-900 rounded-2xl shadow-xl border border-gray-800">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">MBG Smart Logistics</h1>
        <p class="text-gray-400">Silakan login untuk melanjutkan</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Email</label>
          <input 
            v-model="form.email" 
            type="email" 
            required
            class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder-gray-500"
            placeholder="admin@mbg.com"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Password</label>
          <input 
            v-model="form.password" 
            type="password" 
            required
            class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder-gray-500"
            placeholder="••••••••"
          />
        </div>

        <div v-if="errorMsg" class="p-4 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">
          {{ errorMsg }}
        </div>

        <button 
          type="submit" 
          :disabled="isLoading"
          class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors duration-200 flex justify-center items-center"
          :class="{'opacity-75 cursor-not-allowed': isLoading}"
        >
          <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isLoading ? 'Memproses...' : 'Masuk (Login)' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'

const form = ref({
  email: '',
  password: ''
})

const isLoading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  isLoading.value = true
  errorMsg.value = ''

  try {
    const res = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    
    const data = await res.json()
    
    if (res.ok) {
      // Store JWT token and user info
      localStorage.setItem('mbg_token', data.data.token)
      localStorage.setItem('mbg_user', JSON.stringify(data.data.user))
      
      // Use Inertia to navigate to dashboard
      router.visit('/dashboard')
    } else {
      errorMsg.value = data.message || 'Login gagal. Periksa kembali email dan password Anda.'
    }
  } catch (err) {
    errorMsg.value = 'Tidak dapat terhubung ke server backend API.'
  } finally {
    isLoading.value = false
  }
}
</script>
