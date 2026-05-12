@echo off
echo ==================================================
echo   Memulai Layanan MBG Smart Logistics...
echo ==================================================

echo [1/6] Menjalankan OSRM via Docker (Routing Engine)...
start "MBG OSRM (Docker)" cmd /k "cd /d %~dp0 && docker-compose up osrm"

echo [2/6] Menjalankan AI Microservice (FastAPI)...
start "MBG AI Services" cmd /k "cd /d %~dp0ai-services && title MBG AI Services && echo Memeriksa dependensi... && python -m pip install -r requirements.txt && python -m uvicorn app:app --host 0.0.0.0 --port 9000 --reload"

echo [3/6] Menjalankan Golang Backend (Core API)...
start "MBG Golang Backend" cmd /k "cd /d %~dp0backend-golang && title MBG Golang Backend && go run ./cmd/server/main.go"

echo [4/6] Menjalankan PHP Laravel Server...
start "MBG Laravel Server" cmd /k "cd /d %~dp0frontend-web && title MBG Laravel Server && php artisan serve --port=8000"

echo [5/6] Menjalankan Vite Server (Web Dashboard)...
start "MBG Vite Frontend" cmd /k "cd /d %~dp0frontend-web && title MBG Vite Frontend && npm run dev"

echo [6/6] Menjalankan Expo Server (Mobile App)...
start "MBG Expo Mobile App" cmd /k "cd /d %~dp0mobile-app && title MBG Expo Mobile App && npm start"

echo.
echo ==================================================
echo   Semua layanan berhasil dibuka di window baru!
echo   PENTING: Pastikan Laragon (MySQL) Anda sudah menyala!
echo ==================================================
pause
