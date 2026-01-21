# Pruebas de Rendimiento y Monitoreo

Este módulo contiene herramientas para evaluar y monitorear el rendimiento de la aplicación SISTAOUT.

## 📋 Componentes

### 1. Pruebas de Carga (`load_test.py`)

Script de pruebas de carga usando **Locust** que simula múltiples usuarios concurrentes accediendo a la API.

#### Instalación

```bash
pip install locust
```

O usar el `requirements.txt` del proyecto que ya incluye Locust.

#### Uso Básico

1. **Asegúrate de que el servidor esté corriendo:**
   ```bash
   py scripts/start_server.ps1
   ```

2. **Ejecutar Locust:**
   ```bash
   locust -f testing/performance/load_test.py --host=http://localhost:8000
   ```

3. **Abrir la interfaz web de Locust:**
   - Abre tu navegador en `http://localhost:8089`
   - Configura el número de usuarios y tasa de spawn
   - Inicia las pruebas

#### Uso Avanzado (Línea de Comandos)

```bash
# 10 usuarios, spawn rate de 2 usuarios/segundo, duración de 60 segundos
locust -f testing/performance/load_test.py \
  --host=http://localhost:8000 \
  --users 10 \
  --spawn-rate 2 \
  --run-time 60s \
  --headless \
  --html=reports/load_test_report.html
```

#### Escenarios de Prueba

El script simula usuarios que:
- ✅ Hacen health checks frecuentes
- ✅ Obtienen listas de datasets (tarea frecuente)
- ✅ Acceden a datasets paginados
- ✅ Ejecutan detección de outliers (tarea pesada)
- ✅ Realizan análisis primarios (tarea pesada)

#### Interpretación de Resultados

- **Respuesta promedio**: Debe ser < 2 segundos para la mayoría de endpoints
- **P95/P99**: Percentiles que indican el tiempo de respuesta para el 95%/99% de las peticiones
- **Requests por segundo**: Capacidad de la aplicación
- **Tasa de error**: Debe ser < 1%

---

### 2. Monitor de Rendimiento (`performance_monitor.py`)

Sistema de monitoreo integrado que mide:
- ⏱️ Tiempos de respuesta de endpoints
- 💾 Uso de memoria
- 🔥 Uso de CPU
- 📊 Estadísticas por endpoint
- 🐌 Identificación de requests lentos

#### Endpoints de Métricas

Una vez que el servidor está corriendo con el middleware activado:

**Obtener métricas actuales:**
```bash
GET /api/performance/metrics
```

Respuesta:
```json
{
  "system_metrics": {
    "cpu_percent": 15.2,
    "memory_mb": 245.8,
    "memory_percent": 12.5,
    "uptime_seconds": 3600,
    "num_threads": 8,
    "open_files": 12
  },
  "performance_summary": {
    "total_requests": 150,
    "avg_response_time": 0.45,
    "min_response_time": 0.01,
    "max_response_time": 3.2,
    "requests_per_second": 0.042,
    "error_rate": 0.02,
    "endpoint_stats": {
      "GET /api/datasets": {
        "count": 50,
        "avg_time": 0.12,
        "min_time": 0.08,
        "max_time": 0.25,
        "errors": 0,
        "success": 50
      }
    }
  },
  "slow_requests": [
    {
      "timestamp": "2025-01-02T12:34:56",
      "endpoint": "/api/outliers/BD_CARY.xlsx/detect",
      "method": "POST",
      "duration": 3.2,
      "status_code": 200
    }
  ]
}
```

**Exportar reporte completo:**
```bash
GET /api/performance/export
```

Esto genera un archivo `performance_report.json` con el reporte completo.

---

## 🎯 Objetivos de Rendimiento

### Tiempos de Respuesta Objetivo

| Endpoint | Tiempo Objetivo | Tiempo Máximo Aceptable |
|----------|----------------|-------------------------|
| `GET /api/test` | < 0.1s | < 0.5s |
| `GET /api/datasets` | < 0.2s | < 1s |
| `GET /api/datasets/{filename}/paginated` | < 0.3s | < 1.5s |
| `POST /api/outliers/{filename}/detect` | < 5s | < 30s |
| `POST /api/analyze-viz/{filename}/primary-analysis` | < 3s | < 15s |
| `POST /api/analyze-viz/{filename}/advanced-analysis` | < 10s | < 60s |

### Capacidad Objetivo

- **Usuarios concurrentes**: Al menos 10 usuarios simultáneos sin degradación
- **Requests por segundo**: Al menos 5 req/s sostenidos
- **Uso de memoria**: < 500 MB bajo carga normal
- **Uso de CPU**: < 50% bajo carga normal

---

## 📊 Ejecutar Análisis Completo

### Script de Análisis Automático

```bash
# Ejecutar pruebas de carga y generar reporte
python testing/performance/run_performance_tests.py
```

Este script:
1. Verifica que el servidor esté corriendo
2. Ejecuta pruebas de carga con diferentes niveles
3. Genera reportes HTML y JSON
4. Compara resultados con objetivos

---

## 🔧 Configuración

### Variables de Entorno

```bash
# Habilitar/deshabilitar monitoreo de rendimiento
PERFORMANCE_MONITORING=true

# Umbral para considerar requests lentos (segundos)
SLOW_REQUEST_THRESHOLD=1.0

# Historial máximo de requests a mantener
PERFORMANCE_HISTORY_SIZE=1000
```

---

## 📈 Mejores Prácticas

1. **Ejecutar pruebas de carga regularmente**: Antes de cada release importante
2. **Monitorear métricas en producción**: Usar los endpoints de métricas para monitoreo continuo
3. **Identificar endpoints lentos**: Revisar regularmente los "slow requests"
4. **Optimizar basándose en datos**: Usar las métricas para identificar cuellos de botella
5. **Establecer alertas**: Configurar alertas cuando los tiempos de respuesta excedan umbrales

---

## 🐛 Troubleshooting

### Locust no se conecta al servidor

- Verifica que el servidor esté corriendo en el puerto correcto
- Verifica que la URL en `--host` sea correcta
- Verifica que no haya firewall bloqueando la conexión

### Métricas no disponibles

- Verifica que `psutil` esté instalado: `pip install psutil`
- Verifica que el middleware esté habilitado en `main.py`
- Revisa los logs del servidor para errores

### Rendimiento degradado durante pruebas

- Reduce el número de usuarios concurrentes
- Aumenta el tiempo de espera entre requests
- Verifica recursos del servidor (CPU, memoria, disco)

---

## 📚 Recursos Adicionales

- [Documentación de Locust](https://docs.locust.io/)
- [FastAPI Performance](https://fastapi.tiangolo.com/advanced/performance/)
- [Python Profiling](https://docs.python.org/3/library/profile.html)

