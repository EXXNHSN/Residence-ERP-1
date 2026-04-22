@echo off
chcp 65001 >nul

echo.
echo ================================================================
echo   NAXCIVAN RESIDENCE ERP - İşə salınır
echo ================================================================
echo.
echo İki yeni pəncərə açılacaq:
echo   1. API Server (port 8080)
echo   2. Web Frontend (port 5173)
echo.
echo Brauzerinizdə açın: http://localhost:5173
echo.
echo Şəbəkədəki digər kompüterlər üçün:
ipconfig | findstr /R /C:"IPv4" | findstr /V "127.0.0.1"
echo Yuxarıdakı IP-lərdən birini istifadə edin: http://IP:5173
echo.
echo (Bu pəncərəni bağlamayın — sistem işləyəndə açıq qalmalıdır)
echo.

:: ── API serveri yeni pəncərədə işə sal ──────────────────────────
start "Naxçıvan ERP - API Server" cmd /k "set PORT=8080 && pnpm --filter @workspace/api-server run dev"

:: API-nin qalxmasını gözlə
timeout /t 4 /nobreak >nul

:: ── Frontend-i yeni pəncərədə işə sal ───────────────────────────
start "Naxçıvan ERP - Web" cmd /k "set PORT=5173 && set BASE_PATH=/ && pnpm --filter @workspace/naxchivan-erp run dev"

echo.
echo ================================================================
echo   ✓ Hər iki server işə salındı
echo ================================================================
echo.
echo Dayandırmaq üçün hər iki pəncərədə Ctrl+C basın.
echo.
pause
