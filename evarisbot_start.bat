@echo off
chcp 65001 >nul
title Evarisbot - Launcher
color 0A

echo ============================================
echo    EVARISBOT - Iniciando servicios...
echo ============================================
echo.

cd /d "%~dp0"

:: Matar procesos anteriores si existen
echo [1/4] Limpiando procesos anteriores...
taskkill /FI "WINDOWTITLE eq Evarisbot - Laravel Server" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Evarisbot - Ngrok Tunnel" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Evarisbot - Queue Worker" /F >nul 2>&1
timeout /t 2 /nobreak >nul

:: Iniciar Laravel Server
echo [2/4] Iniciando Laravel Server (puerto 8000)...
start "Evarisbot - Laravel Server" /MIN cmd /k "cd /d "%~dp0" && php artisan serve --host=0.0.0.0 --port=8000"
timeout /t 3 /nobreak >nul

:: Iniciar Ngrok
echo [3/4] Iniciando Ngrok Tunnel...
start "Evarisbot - Ngrok Tunnel" /MIN cmd /k "cd /d "%~dp0" && ngrok http 8000"
timeout /t 3 /nobreak >nul

:: Iniciar Queue Worker
echo [4/4] Iniciando Queue Worker...
start "Evarisbot - Queue Worker" /MIN cmd /k "cd /d "%~dp0" && php artisan queue:work --queue=default --timeout=120"
timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo    ✅ EVARISBOT - Todos los servicios iniciados
echo ============================================
echo.
echo    Laravel:  http://0.0.0.0:8000
echo    Ngrok:    http://127.0.0.1:4040 (dashboard)
echo    Queue:    Procesando trabajos...
echo.
echo    Para detener: ejecutar evarisbot_stop.bat
echo    Panel remoto: ejecutar evarisbot_manager.ps1
echo ============================================
echo.
pause
