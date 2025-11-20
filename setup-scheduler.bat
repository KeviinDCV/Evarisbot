@echo off
REM Script para configurar el Laravel Scheduler en Windows Task Scheduler
REM Ejecutar como Administrador

echo ========================================
echo  Configuracion de Laravel Scheduler
echo ========================================
echo.

REM Obtener ruta actual
set "PROJECT_PATH=%~dp0"
set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

REM Buscar PHP
where php >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PHP no encontrado en PATH
    echo Por favor, agrega PHP al PATH o especifica la ruta completa
    pause
    exit /b 1
)

echo [INFO] Proyecto: %PROJECT_PATH%
echo [INFO] PHP encontrado: 
php --version
echo.

echo ========================================
echo  Creando tarea programada...
echo ========================================
echo.

REM Crear tarea en Task Scheduler
schtasks /Create /SC MINUTE /MO 1 /TN "Laravel Scheduler - Evarisbot" /TR "php artisan schedule:run" /ST 00:00 /SD %date% /RL HIGHEST /F /RU %USERNAME%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [EXITO] Tarea programada creada correctamente
    echo.
    echo La tarea "Laravel Scheduler - Evarisbot" se ejecutara cada minuto
    echo.
    echo Para verificar:
    echo   1. Abrir "Programador de tareas" de Windows
    echo   2. Buscar "Laravel Scheduler - Evarisbot"
    echo.
    echo Para probar manualmente:
    echo   php artisan schedule:run
    echo.
) else (
    echo.
    echo [ERROR] No se pudo crear la tarea programada
    echo Intenta ejecutar este script como Administrador
    echo.
)

pause
