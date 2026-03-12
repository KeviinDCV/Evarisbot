@echo off
chcp 65001 >nul
title Evarisbot - Shutdown
color 0C

echo ============================================
echo    EVARISBOT - Deteniendo servicios...
echo ============================================
echo.

:: Detener por titulo de ventana
echo [1/3] Deteniendo Laravel Server...
taskkill /FI "WINDOWTITLE eq Evarisbot - Laravel Server" /F >nul 2>&1
taskkill /IM "php.exe" /FI "WINDOWTITLE eq Evarisbot*" /F >nul 2>&1

echo [2/3] Deteniendo Ngrok Tunnel...
taskkill /FI "WINDOWTITLE eq Evarisbot - Ngrok Tunnel" /F >nul 2>&1
taskkill /IM "ngrok.exe" /F >nul 2>&1

echo [3/3] Deteniendo Queue Worker...
taskkill /FI "WINDOWTITLE eq Evarisbot - Queue Worker" /F >nul 2>&1

:: Limpiar cualquier proceso php artisan serve residual en puerto 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo    Limpiando proceso residual en puerto 8000 (PID: %%a)...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo ============================================
echo    ✅ EVARISBOT - Todos los servicios detenidos
echo ============================================
echo.
timeout /t 3 /nobreak >nul
