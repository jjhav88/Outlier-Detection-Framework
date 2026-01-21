# Testing - Suite de Pruebas para SISTAOUT

Este directorio contiene una suite completa de pruebas para el sistema SISTAOUT, diseñada para asegurar la calidad, funcionalidad y estabilidad del software.

## 📋 Estructura de Pruebas

### 1. **Pruebas de Regresión** (`test_regression.py`)
Verifican que los cambios recientes no hayan roto funcionalidades existentes que anteriormente funcionaban correctamente.

**Cubre:**
- Procesamiento de datos
- Detección de outliers (IQR, Z-Score, MAD)
- Tests estadísticos (Mann-Whitney)
- Estadísticas descriptivas
- Clustering
- Regresión logística
- Modelos predictivos
- Estructura de endpoints API

### 2. **Pruebas Funcionales** (`test_functional.py`)
Verifican que cada función realiza correctamente su tarea específica según los requisitos del sistema.

**Cubre:**
- Subida de datasets
- Detección de outliers con diferentes métodos
- Tests estadísticos
- Análisis descriptivo
- Clustering (K-means)
- Regresión logística
- Modelos predictivos (Random Forest)
- Detección de tipos de variables
- Limpieza de datos
- Estrategias de combinación de outliers

### 3. **Pruebas de Caja Blanca** (`test_whitebox.py`)
Verifican el funcionamiento interno del código, incluyendo rutas de ejecución, condiciones, bucles y lógica interna.

**Cubre:**
- Lógica interna de cálculos (IQR, Z-Score, MAD)
- Casos extremos (DataFrames vacíos, valores únicos, valores iguales)
- Manejo de valores NaN
- Cobertura de condiciones y bucles
- Manejo de errores
- Lógica interna de procesamiento
- Lógica interna de tests estadísticos
- Lógica interna de clustering
- Lógica interna de entrenamiento de modelos

### 4. **Pruebas de Caja Negra** (`test_blackbox.py`)
Verifican la funcionalidad del sistema desde la perspectiva del usuario final, sin conocer los detalles internos de implementación.

**Cubre:**
- Health check del API
- Subida de datasets
- Obtención de lista de datasets
- Detección de outliers
- Manejo de entradas inválidas
- Manejo de parámetros faltantes
- Consistencia de formato de respuestas
- Claridad de mensajes de error
- Manejo de timeouts
- Solicitudes concurrentes
- Integridad de datos
- Headers CORS
- Validación de tipos de contenido

## 🚀 Instalación y Configuración

### Requisitos Previos

1. **Python 3.8+** con las siguientes dependencias:
   ```bash
   pip install pytest pytest-cov requests pandas numpy
   ```

2. **Servidor ejecutándose** (para pruebas de caja negra):
   ```bash
   python main.py
   ```

### Estructura de Directorios

```
testing/
├── __init__.py
├── test_regression.py      # Pruebas de regresión
├── test_functional.py      # Pruebas funcionales
├── test_whitebox.py        # Pruebas de caja blanca
├── test_blackbox.py        # Pruebas de caja negra
├── run_all_tests.py        # Script para ejecutar todas las pruebas
└── README.md               # Este archivo
```

## 📖 Uso

### Ejecutar Todas las Pruebas

```bash
# Desde el directorio raíz del proyecto
py testing/run_all_tests.py
```

### Ejecutar Pruebas con el Servidor Corriendo

Si tienes el servidor ejecutándose en `http://localhost:8000`, puedes usar los scripts helper:

**Windows (PowerShell):**
```powershell
.\testing\run_tests_with_server.ps1
```

**Linux/Mac (Bash):**
```bash
bash testing/run_tests_with_server.sh
```

O manualmente:

1. **Asegúrate de que el servidor esté corriendo:**
   ```bash
   python main.py
   ```

2. **En otra terminal, ejecuta las pruebas:**
   ```bash
   # Todas las pruebas (incluyendo caja negra)
   python testing/run_all_tests.py --verbose
   
   # Solo pruebas de caja negra (requieren servidor)
   python testing/run_all_tests.py --type blackbox --verbose
   ```

### Ejecutar un Tipo Específico de Pruebas

```bash
# Solo pruebas de regresión
py testing/run_all_tests.py --type regression

# Solo pruebas funcionales
py testing/run_all_tests.py --type functional

# Solo pruebas de caja blanca
py testing/run_all_tests.py --type whitebox

# Solo pruebas de caja negra
py testing/run_all_tests.py --type blackbox
```

### Ejecutar con Salida Detallada

```bash
py testing/run_all_tests.py --verbose
```

### Ejecutar con Reporte de Cobertura

```bash
py testing/run_all_tests.py --coverage
```

## 📄 Sistema de Reportes

El sistema genera reportes automáticamente en múltiples formatos para facilitar el análisis de resultados.

### Generación Automática de Reportes

Por defecto, al ejecutar las pruebas se generan reportes en la carpeta `testing/reports/`:

```bash
# Generar reportes (por defecto)
py testing/run_all_tests.py --type blackbox

# Ejecutar sin generar reportes
py testing/run_all_tests.py --type blackbox --no-reports
```

### Tipos de Reportes Generados

1. **Reportes HTML** (`report_<tipo>_<timestamp>.html`)
   - Reportes visuales interactivos con detalles de cada prueba
   - Incluyen información sobre pruebas pasadas, fallidas y omitidas
   - Contienen trazas de error completas para pruebas fallidas
   - Se pueden abrir directamente en el navegador

2. **Reportes JSON** (`report_<tipo>_<timestamp>.json`)
   - Formato estructurado para procesamiento automatizado
   - Incluyen estadísticas detalladas por prueba
   - Útiles para integración con CI/CD

3. **Reporte Consolidado** (`report_consolidado_<timestamp>.txt` y `.json`)
   - Resumen general de todas las pruebas ejecutadas
   - Estadísticas agregadas por tipo de prueba
   - Tasa de éxito general

### Visualizar Reportes

#### Ver el Reporte Más Reciente

```bash
# Mostrar el reporte más reciente en consola
py testing/view_reports.py --latest

# O simplemente
py testing/view_reports.py
```

#### Listar Todos los Reportes Disponibles

```bash
py testing/view_reports.py --list
```

#### Ver un Reporte Específico

```bash
py testing/view_reports.py --file testing/reports/report_consolidado_20250102_123456.json
```

### Estructura de Reportes

```
testing/
└── reports/
    ├── report_regression_20250102_123456.html
    ├── report_regression_20250102_123456.json
    ├── report_functional_20250102_123456.html
    ├── report_functional_20250102_123456.json
    ├── report_whitebox_20250102_123456.html
    ├── report_whitebox_20250102_123456.json
    ├── report_blackbox_20250102_123456.html
    ├── report_blackbox_20250102_123456.json
    ├── report_consolidado_20250102_123456.txt
    ├── report_consolidado_20250102_123456.json
    └── coverage/  (si se usa --coverage)
        └── index.html
```

### Interpretación de Reportes

#### Reporte Consolidado

El reporte consolidado muestra:

- **Resumen General:**
  - Total de pruebas ejecutadas
  - Pruebas pasadas, fallidas y omitidas
  - Tasa de éxito general
  - Estado general (PASO/FALLO)

- **Detalle por Tipo de Prueba:**
  - Estado individual de cada tipo
  - Estadísticas específicas por tipo
  - Tasa de éxito por tipo

#### Reportes HTML

Los reportes HTML incluyen:

- Lista completa de todas las pruebas ejecutadas
- Estado de cada prueba (PASSED/FAILED/SKIPPED)
- Tiempo de ejecución de cada prueba
- Trazas de error completas para pruebas fallidas
- Estadísticas resumidas al inicio

#### Reportes JSON

Los reportes JSON contienen:

```json
{
  "timestamp": "20250102_123456",
  "date": "2025-01-02T12:34:56",
  "results": {
    "regression": {
      "passed": 11,
      "failed": 0,
      "skipped": 0,
      "total": 11,
      "success": true,
      "test_type": "regression",
      "description": "Pruebas de Regresión"
    }
  },
  "summary": {
    "total_passed": 52,
    "total_failed": 0,
    "total_skipped": 0,
    "total_tests": 52,
    "overall_success": true,
    "success_rate": 100.0
  }
}
```

### Ejecutar Pruebas Individuales con pytest

```bash
# Ejecutar un archivo específico
pytest testing/test_regression.py -v

# Ejecutar una clase específica
pytest testing/test_regression.py::TestRegression -v

# Ejecutar un test específico
pytest testing/test_regression.py::TestRegression::test_data_processing_regression -v
```

## 📊 Interpretación de Resultados

### Códigos de Salida

- **0**: Todas las pruebas pasaron exitosamente
- **1**: Una o más pruebas fallaron

### Tipos de Aserciones

Las pruebas utilizan diferentes tipos de aserciones según el contexto:

- **Aserciones de existencia**: Verifican que los objetos existen
- **Aserciones de tipo**: Verifican que los tipos de datos son correctos
- **Aserciones de valor**: Verifican que los valores son los esperados
- **Aserciones de estructura**: Verifican que las estructuras de datos son correctas

## 🔧 Mantenimiento

### Agregar Nuevas Pruebas

1. **Identificar el área a probar**: Determinar si es regresión, funcional, caja blanca o caja negra
2. **Crear el test**: Agregar un nuevo método `test_*` en la clase correspondiente
3. **Usar fixtures**: Aprovechar los fixtures existentes para datos de prueba
4. **Documentar**: Agregar docstrings explicando qué prueba el test

### Ejemplo de Nuevo Test

```python
def test_nueva_funcionalidad(self, analysis_viz, sample_data):
    """Verificar que la nueva funcionalidad funciona correctamente"""
    # Preparar datos
    # Ejecutar función
    results = analysis_viz.nueva_funcionalidad(sample_data)
    
    # Verificar resultados
    assert results is not None
    assert 'expected_key' in results
```

## ⚠️ Notas Importantes

### Pruebas de Caja Negra

Las pruebas de caja negra (`test_blackbox.py`) requieren que el servidor esté ejecutándose. Si el servidor no está disponible, estas pruebas se saltarán automáticamente.

Para ejecutar pruebas de caja negra:

1. Iniciar el servidor en una terminal:
   ```bash
   python main.py
   ```

2. En otra terminal, ejecutar las pruebas:
   ```bash
   python testing/run_all_tests.py --type blackbox
   ```

### Datos de Prueba

Las pruebas utilizan datos sintéticos generados con `numpy.random` con una semilla fija (42) para garantizar reproducibilidad.

### Fixtures

Los fixtures de pytest proporcionan:
- `sample_data`: DataFrame con datos de muestra
- `temp_dir`: Directorio temporal para archivos de prueba
- `data_processor`: Instancia de DataProcessor
- `outlier_detector`: Instancia de OutlierDetector
- `analysis_viz`: Instancia de AnalysisAndVisualization

## 📈 Métricas de Calidad

### Cobertura de Código

Para generar un reporte de cobertura:

```bash
python testing/run_all_tests.py --coverage
```

El reporte HTML se generará en `htmlcov/index.html`.

### Objetivos de Cobertura

- **Mínimo recomendado**: 70% de cobertura
- **Ideal**: 80%+ de cobertura
- **Crítico**: 90%+ para módulos críticos

## 🐛 Solución de Problemas

### Error: "ModuleNotFoundError"

Asegúrate de estar ejecutando las pruebas desde el directorio raíz del proyecto y que todas las dependencias estén instaladas.

### Error: "ConnectionError" en pruebas de caja negra

Asegúrate de que el servidor esté ejecutándose antes de ejecutar las pruebas de caja negra.

### Error: "FileNotFoundError"

Verifica que los archivos de prueba existan y que las rutas sean correctas.

## 📚 Referencias

- [Documentación de pytest](https://docs.pytest.org/)
- [Documentación de pytest-cov](https://pytest-cov.readthedocs.io/)
- [Best Practices for Testing](https://docs.python.org/3/library/unittest.html)

## 👥 Contribución

Al agregar nuevas funcionalidades al sistema, asegúrate de:

1. Agregar pruebas correspondientes
2. Ejecutar todas las pruebas antes de hacer commit
3. Verificar que la cobertura de código no disminuya
4. Documentar cualquier cambio en los requisitos de prueba

---

**Última actualización**: Diciembre 2024

