@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ================================================================
echo   NAXCIVAN RESIDENCE ERP - Windows Quraşdırma
echo ================================================================
echo.

:: ── 1. Node.js varlığını yoxla ──────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
  echo [XƏTA] Node.js tapılmadı.
  echo Zəhmət olmasa https://nodejs.org saytından yükləyin və yenidən çalışdırın.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo [✓] Node.js: %%v

:: ── 2. pnpm varlığını yoxla ─────────────────────────────────────
where pnpm >nul 2>nul
if errorlevel 1 (
  echo [!] pnpm tapılmadı, quraşdırılır...
  call npm install -g pnpm
  if errorlevel 1 (
    echo [XƏTA] pnpm quraşdırıla bilmədi.
    pause
    exit /b 1
  )
)
for /f "delims=" %%v in ('pnpm --version') do echo [✓] pnpm: %%v

:: ── 3. .env fayllarını hazırla ──────────────────────────────────
echo.
if not exist "artifacts\api-server\.env" (
  copy "artifacts\api-server\.env.example" "artifacts\api-server\.env" >nul
  echo [✓] artifacts\api-server\.env yaradıldı
  echo     ❗ İçindəki DATABASE_URL və JWT_SECRET-i öz şifrənizlə dəyişdirin!
) else (
  echo [✓] artifacts\api-server\.env artıq mövcuddur
)

if not exist "artifacts\naxchivan-erp\.env" (
  copy "artifacts\naxchivan-erp\.env.example" "artifacts\naxchivan-erp\.env" >nul
  echo [✓] artifacts\naxchivan-erp\.env yaradıldı
) else (
  echo [✓] artifacts\naxchivan-erp\.env artıq mövcuddur
)

:: ── 4. Asılılıqları yüklə ───────────────────────────────────────
echo.
echo [→] Asılılıqlar yüklənir (bir neçə dəqiqə çəkə bilər)...
call pnpm install
if errorlevel 1 (
  echo [XƏTA] pnpm install uğursuz oldu.
  pause
  exit /b 1
)
echo [✓] Asılılıqlar yükləndi

:: ── 5. Verilənlər bazasını qur ──────────────────────────────────
echo.
echo [→] Verilənlər bazası strukturu yaradılır...
echo     (PostgreSQL işlədiyinə və .env-də DATABASE_URL düzgün olduğuna əmin olun)
echo.
choice /c YN /n /m "Bazaya cədvəlləri push etməyə hazırsınızmı? (Y/N): "
if errorlevel 2 (
  echo [!] Atlandı. Sonra əl ilə icra edin: cd lib\db ^&^& pnpm run push-force
  goto :done
)
pushd lib\db
call pnpm run push-force
if errorlevel 1 (
  echo [XƏTA] Baza qurula bilmədi. .env-i və PostgreSQL-i yoxlayın.
  popd
  pause
  exit /b 1
)
popd
echo [✓] Verilənlər bazası hazırdır

:done
echo.
echo ================================================================
echo   ✓ Quraşdırma tamamlandı!
echo ================================================================
echo.
echo İndi proqramı işə salmaq üçün: windows-start.bat
echo.
echo Daxil olma məlumatları:
echo   Admin: admin / admin123
echo   Satış: satis / satis123
echo.
pause
