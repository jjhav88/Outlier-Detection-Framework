# Script PowerShell para ejecutar pruebas de carga
# Uso: .\testing\performance\run_load_test.ps1

param(
    [int]$Users = 10,
    [int]$SpawnRate = 2,
    [string]$RunTime = "60s",
    [string]$Host = "http://localhost:8000",
    [switch]$Headless = $false
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "PRUEBAS DE CARGA - SISTAOUT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Locust esté instalado
try {
    $locustVersion = locust --version 2>&1
    Write-Host "[OK] Locust instalado: $locustVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Locust no está instalado. Instalando..." -ForegroundColor Red
    py -m pip install locust --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] No se pudo instalar Locust" -ForegroundColor Red
        exit 1
    }
}

# Verificar que el servidor esté corriendo
Write-Host "[INFO] Verificando que el servidor esté corriendo en $Host..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$Host/api/test" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "[OK] Servidor está corriendo" -ForegroundColor Green
    }
} catch {
    Write-Host "[ERROR] El servidor no está corriendo en $Host" -ForegroundColor Red
    Write-Host "[INFO] Por favor, inicia el servidor primero:" -ForegroundColor Yellow
    Write-Host "      py scripts/start_server.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Configuración de la prueba:" -ForegroundColor Cyan
Write-Host "  Usuarios: $Users" -ForegroundColor White
Write-Host "  Tasa de spawn: $SpawnRate usuarios/segundo" -ForegroundColor White
Write-Host "  Duración: $RunTime" -ForegroundColor White
Write-Host "  Host: $Host" -ForegroundColor White
Write-Host "  Modo: $(if ($Headless) { 'Headless (sin UI)' } else { 'Con interfaz web' })" -ForegroundColor White
Write-Host ""

# Crear directorio de reportes si no existe
$reportsDir = "testing\reports\performance"
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$htmlReport = "$reportsDir\load_test_$timestamp.html"
$csvReport = "$reportsDir\load_test_$timestamp.csv"

if ($Headless) {
    Write-Host "[INFO] Ejecutando pruebas en modo headless..." -ForegroundColor Yellow
    Write-Host ""
    
    locust -f testing/performance/load_test.py `
        --host=$Host `
        --users $Users `
        --spawn-rate $SpawnRate `
        --run-time $RunTime `
        --headless `
        --html=$htmlReport `
        --csv=$csvReport
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Pruebas completadas exitosamente" -ForegroundColor Green
        Write-Host "[INFO] Reporte HTML: $htmlReport" -ForegroundColor Cyan
        Write-Host "[INFO] Reporte CSV: $csvReport" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "[ERROR] Las pruebas fallaron" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[INFO] Iniciando Locust con interfaz web..." -ForegroundColor Yellow
    Write-Host "[INFO] Abre http://localhost:8089 en tu navegador" -ForegroundColor Cyan
    Write-Host ""
    
    locust -f testing/performance/load_test.py --host=$Host
}

