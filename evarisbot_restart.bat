@echo off
chcp 65001 >nul
title Evarisbot - Restart
color 0E

echo ============================================
echo    EVARISBOT - Reiniciando servicios...
echo ============================================
echo.

echo [1/2] Deteniendo servicios...
call "%~dp0evarisbot_stop.bat" >nul 2>&1
timeout /t 3 /nobreak >nul

echo [2/2] Iniciando servicios...
call "%~dp0evarisbot_start.bat"
