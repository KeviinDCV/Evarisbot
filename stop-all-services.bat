@echo off
REM Script para detener todos los servicios

echo ========================================
echo  Deteniendo Todos los Servicios
echo ========================================
echo.

REM 1. Detener Node.js (Reverb)
echo [1/3] Deteniendo Reverb...
taskkill /IM node.exe /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo    ✅ Reverb detenido
) else (
    echo    ℹ️  Reverb no estaba corriendo
)

REM 2. Detener PHP
echo.
echo [2/3] Deteniendo PHP...
taskkill /FI "WINDOWTITLE eq *artisan*" /F 2>nul
taskkill /FI "WINDOWTITLE eq *PHP*" /F 2>nul
echo    ✅ PHP detenido

REM 3. Detener Ngrok
echo.
echo [3/3] Deteniendo Ngrok...
taskkill /IM ngrok.exe /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo    ✅ Ngrok detenido
) else (
    echo    ℹ️  Ngrok no estaba corriendo
)

echo.
echo ========================================
echo  ✅ Todos los Servicios Detenidos
echo ========================================
echo.
pause
