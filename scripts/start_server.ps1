# Script para iniciar el servidor FastAPI
# Verifica y cierra procesos en el puerto 8000 antes de iniciar

param(
    [int]$Port = 8000
)

Write-Host "=== Iniciando servidor ANOUT ===" -ForegroundColor Cyan
Write-Host ""

# Verificar si el puerto está en uso
$portInUse = netstat -ano | Select-String ":$Port" | Select-Object -First 1

if ($portInUse) {
    Write-Host "El puerto $Port está en uso. Cerrando procesos..." -ForegroundColor Yellow
    
    $processes = netstat -ano | Select-String ":$Port" | ForEach-Object {
        $line = $_.Line
        if ($line -match '\s+(\d+)\s*$') {
            $matches[1]
        }
    } | Select-Object -Unique
    
    foreach ($processId in $processes) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Proceso $processId cerrado." -ForegroundColor Green
        }
        catch {
            Write-Host "No se pudo cerrar proceso $processId" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Seconds 2
}

Write-Host "Iniciando servidor en puerto $Port..." -ForegroundColor Cyan
Write-Host "Servidor disponible en: http://localhost:$Port" -ForegroundColor Green
Write-Host "Presiona Ctrl+C para detener el servidor`n" -ForegroundColor Yellow

# Determinar qué Python usar
$pythonPath = $null

# Intentar usar venv si existe y está válido
if (Test-Path "venv\Scripts\python.exe") {
        try {
            $venvPython = Resolve-Path "venv\Scripts\python.exe"
            $null = & $venvPython --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                $pythonPath = $venvPython
                Write-Host "Usando Python del entorno virtual" -ForegroundColor Green
            }
        }
    catch {
        Write-Host "El entorno virtual está corrupto, usando Python global" -ForegroundColor Yellow
    }
}

# Si no hay venv válido, usar Python global
if (-not $pythonPath) {
    # Buscar Python en ubicaciones comunes
    $pythonLocations = @(
        "C:\Users\alexc\AppData\Local\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "python.exe"
    )
    
    foreach ($location in $pythonLocations) {
        if (Test-Path $location) {
            try {
                $null = & $location --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $pythonPath = $location
                    Write-Host "Usando Python global: $pythonPath" -ForegroundColor Green
                    break
                }
            }
            catch {
                continue
            }
        }
    }
    
    if (-not $pythonPath) {
        Write-Host "ERROR: No se pudo encontrar Python instalado" -ForegroundColor Red
        exit 1
    }
}

# Iniciar servidor
& $pythonPath main.py

