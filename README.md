# MBG Smart Logistics 🚀 (AI-Driven Meal Distribution System)

MBG Smart Logistics is a comprehensive, production-ready monorepo designed to optimize the distribution of ready-to-eat meals. The core objective of this system is to **prevent food spoilage** through the innovative use of AI dynamic routing, preventive inventory scanning, and rule-based expiration tracking. 

Built with scalability and modern web standards in mind, the system ensures that sensitive meals (like those containing coconut milk or high moisture) reach schools well within their safe consumption windows.

---

## ✨ Complete Features (Categorized by Role)

The system enforces strict role-based access control (RBAC) to ensure security and efficiency across different operational domains:

*   **🛡️ Admin**: System monitoring and full operational control. Admins have CRUD access to all system data, can oversee the live delivery map, and manage system users.
*   **👨‍🏫 Guru (Teacher)**: Read-only live map tracking for delivery ETA. Teachers can monitor when meals will arrive at their specific schools without risking accidental data modification.
*   **🧑‍🍳 Dapur (Kitchen)**: 
    *   **Smart Inventory**: Receipt scanning via a local, GPU-accelerated **PaddleOCR** microservice to quickly log ingredients.
    *   **AI Chef Assistant**: Menu recommendations powered by the **Gemini API**, suggesting optimal recipes based on available stock, student count, and dietary preferences.
*   **🚚 Kurir (Courier)**: 
    *   **AI Routing**: Receives AI-optimized delivery sequencing powered by a PyTorch A2C (Advantage Actor-Critic) model to ensure the fastest, safest delivery routes.
    *   **Batch Tracking**: Utilizes resource-friendly, "Batch Cache & Sync" GPS tracking. GPS coordinates are cached locally every 10 seconds and flushed to the server every 3 minutes, preserving courier battery life and cellular data.

---

## 🏗️ Architecture & Tech Stack

This project is structured as a modern Monorepo utilizing specialized technologies for each layer:

*   **Frontend Web (Admin/Guru Dashboard)**: Laravel 11, Vue.js 3, Inertia.js, Tailwind CSS. Features dynamic mapping with Leaflet.js.
*   **Mobile App (Courier/Kitchen)**: React Native with Expo. Implements background location tracking and camera integration.
*   **Core Backend (REST API & WebSockets)**: Golang (Gin Gonic) and GORM. Handles the primary business logic, rule-based expiration calculations, and WebSocket broadcasts.
*   **AI Microservice**: Python (FastAPI). Hosts the PaddleOCR engine and PyTorch A2C models.
*   **Database**: MySQL 8.0 (7-table optimized schema).
*   **Routing Engine**: OSRM (Open Source Routing Machine) hosted locally for high-performance route and matrix calculations (East Java/Malang region).

---

## ⚙️ Prerequisites

To run this system locally, ensure you have the following installed:

*   **Docker & Docker Compose**: Essential for orchestrating the database, Go backend, OSRM, and AI microservices.
*   **Go (Golang) 1.21+**: Required if running the backend outside of Docker.
*   **Node.js (v20+) & npm/Yarn**: Required for building the Laravel/Vue frontend and Expo mobile app.
*   **PHP 8.2+ & Composer**: Required for the Laravel frontend ecosystem.
*   **Hardware (Crucial for AI)**: An **NVIDIA GPU (RTX 50-series recommended)** with CUDA support. The Docker setup requires the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) to enable GPU passthrough for PaddleOCR and PyTorch.

---

## 🛠️ Cara Menjalankan (Step-by-Step Guide)

Ikuti langkah-langkah di bawah ini untuk menjalankan keseluruhan sistem di lingkungan *local* (Windows/Laragon):

### 1. Menjalankan Database (Laragon) & AI Services
Sistem ini menggunakan MySQL bawaan Laragon agar lebih ringan di host Windows Anda. Namun, AI Services & OSRM tetap berjalan menggunakan Docker.
1. Buka **Laragon** dan klik **Start All** (Pastikan MySQL berjalan di port 3306).
2. Buat database kosong bernama `mbg_smart_logistics` (opsional, jika belum dibuat).
3. Jalankan container pendukung (AI dan OSRM):
```bash
# Buka terminal di root project
docker-compose up -d --build
```

### 2. Menjalankan Backend API (Golang) & Seeder
Backend Golang akan secara otomatis melakukan *auto-migration* tabel saat pertama kali dijalankan.
1. Konfigurasi `.env`: Pastikan file `backend-golang/.env` menggunakan `DB_HOST=127.0.0.1`, `DB_USER=root`, dan `DB_PASSWORD=` (kosong).
2. Jalankan Golang Backend API:
```bash
cd backend-golang
go run ./cmd/server/main.go
```
3. *(Opsional)* Jika ini pertama kali dijalankan dan tabel masih kosong, jalankan Seeder untuk mengisi data dummy (Buka terminal baru):
```bash
cd backend-golang
go run ./cmd/seeder/main.go
```

### 3. Menjalankan Web Dashboard (Laravel + Vue 3)
Frontend Web menggunakan Laravel 11 dan Inertia.js (Vue 3). Pastikan file `frontend-web/.env` sudah diset ke `DB_CONNECTION=mysql` dan `DB_DATABASE=mbg_smart_logistics`.
Buka 2 terminal baru di dalam folder `frontend-web`:

**Terminal 1 (PHP Server):**
```bash
cd frontend-web
php artisan serve
```
**Terminal 2 (Vite Server):**
```bash
cd frontend-web
npm run dev
```
Buka browser di: `http://localhost:8000` (Gunakan email: `admin@mbg.com`, password: `password`).

### 4. Menjalankan Mobile App (React Native Expo)
Aplikasi Kurir dan Dapur menggunakan Expo. Pastikan HP dan Laptop terhubung di **satu jaringan WiFi yang sama**.
```bash
cd mobile-app
npm run start
```
Scan QR Code menggunakan aplikasi **Expo Go** di HP Android/iOS Anda.
(Gunakan email kurir: `kurir@mbg.com` atau dapur: `dapur@mbg.com`, password: `password`).

---

### 🔌 Port Reference (Arsitektur Jaringan)

| Service | Technology | Port Internal/Local | Akses |
| :--- | :--- | :--- | :--- |
| **Database** | Laragon MySQL | `3306` | `127.0.0.1:3306` |
| **Core API** | Golang (Gin) | `8080` | `http://127.0.0.1:8080` |
| **AI Services** | Python (FastAPI)| `9000` | `http://localhost:9000` (Docker) |
| **Routing** | OSRM Backend | `5000` | `http://localhost:5000` (Docker) |
| **Web Dashboard**| Laravel/Vue 3 | `8000` & `5173`| `http://localhost:8000` |
| **Mobile App** | Expo / Metro | `8081` | *Via Expo Go App* |

---

### 4. Troubleshooting (Masalah Umum)

#### 📱 Mobile App: Gagal Terhubung ke Server
Jika muncul pesan "Error Koneksi" saat login di HP:
1. **Cek IP Laptop:** Buka terminal, ketik `ipconfig`. Cari `IPv4 Address` di bagian Wi-Fi.
2. **Update Config:** Buka `mobile-app/constants/config.js` dan pastikan `BACKEND_URL` menggunakan IP tersebut (contoh: `http://192.168.18.38:8080`).
3. **Satu Jaringan:** Pastikan HP dan Laptop terhubung ke **WiFi yang sama**.
4. **Firewall:** Matikan sementara Firewall Windows atau izinkan port 8080.

#### ❌ Mobile App: Crash "String cannot be cast to Boolean"
Jika muncul layar merah dengan error tersebut:
1. Ini biasanya karena versi `react-native-screens` tidak cocok.
2. Jalankan perintah berikut di folder `mobile-app`:
   ```bash
   npx expo install react-native-screens react-native-safe-area-context
   ```
3. Restart Expo server dengan `npm run start`.

#### 🌐 Web Dashboard: View [app] not found
1. Pastikan file `resources/views/app.blade.php` sudah ada.
2. Pastikan Anda sudah menjalankan `npm run dev` di folder `frontend-web`.

---
*Developed for advanced logistics optimization and AI integration coursework.*
