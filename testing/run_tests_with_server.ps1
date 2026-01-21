# Script PowerShell para ejecutar pruebas con el servidor corriendo
# Uso: .\testing\run_tests_with_server.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SISTAOUT - Ejecución de Pruebas" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si el servidor está corriendo
Write-Host "[CHECK] Verificando si el servidor esta corriendo..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "http://localhost:8000/api/test" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "[OK] Servidor detectado en http://localhost:8000" -ForegroundColor Green
    Write-Host ""
    
    # Ejecutar todas las pruebas
    Write-Host "[TEST] Ejecutando todas las pruebas..." -ForegroundColor Yellow
    py testing/run_all_tests.py --verbose
    
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "[OK] Pruebas completadas" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] Servidor no detectado en http://localhost:8000" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, inicia el servidor primero:" -ForegroundColor Yellow
    Write-Host "  python main.py" -ForegroundColor White
    Write-Host ""
    Write-Host "Luego ejecuta este script nuevamente." -ForegroundColor Yellow
    exit 1
}

