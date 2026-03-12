@echo off
chcp 65001 >nul
title Evarisbot - Panel de Control Remoto
color 0B

echo ============================================
echo    EVARISBOT - Panel de Control Remoto
echo ============================================
echo.
echo  Verificando permisos de administrador...

:: Verificar si ya somos admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  Se requieren permisos de administrador.
    echo  Solicitando elevacion...
    echo.
    
    :: Re-ejecutar como admin
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%~dp0\" && \"%~f0\"' -Verb RunAs"
    exit /b
)

echo  ✅ Permisos de administrador confirmados.
echo.

cd /d "%~dp0"

:: Registrar URL en el firewall (por si acaso)
netsh http delete urlacl url=http://+:9999/ >nul 2>&1
netsh http add urlacl url=http://+:9999/ user=Everyone >nul 2>&1

:: Abrir puerto en firewall
netsh advfirewall firewall delete rule name="Evarisbot Manager" >nul 2>&1
netsh advfirewall firewall add rule name="Evarisbot Manager" dir=in action=allow protocol=TCP localport=9999 >nul 2>&1

echo  ✅ Firewall configurado (puerto 9999).
echo.

:: Ejecutar el script PowerShell
powershell -ExecutionPolicy Bypass -NoExit -File "%~dp0evarisbot_manager.ps1"

pause
