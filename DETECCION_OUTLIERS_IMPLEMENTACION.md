# Implementación de Detección de Outliers

## Resumen de la Implementación

Se ha implementado completamente la funcionalidad de detección de outliers en el módulo correspondiente, incluyendo:

### 1. Backend (Python)
- **Archivo**: `analysis_core/outlier_detection.py`
- **Clase**: `OutlierDetector`
- **Método principal**: `detect_outliers_complete()`

### 2. Frontend (HTML/JavaScript/CSS)
- **Archivos**: 
  - `frontend/modules/detect_outliers/detect_outliers.html`
  - `frontend/modules/detect_outliers/detect_outliers.js`
  - `frontend/modules/detect_outliers/detect_outliers.css`

### 3. API Endpoint
- **Archivo**: `main.py`
- **Endpoint**: `POST /api/outliers/{filename}/detect`

## Funcionalidades Implementadas

### Métodos Univariados
1. **Método del Rango Intercuartílico (IQR)**
   - Identifica outliers usando Q1, Q3 e IQR
   - Umbral: 1.5 * IQR

2. **Método Z-Score**
   - Mide desviaciones estándar de la media
   - Umbral: 3.0 (configurable)

3. **Método de la Mediana Absoluta de la Desviación (MAD)**
   - Alternativa robusta al Z-Score
   - Usa mediana y MAD en lugar de media y desviación estándar

### Métodos Multivariados
1. **Distancia de Mahalanobis**
   - Mide distancia considerando correlaciones entre variables
   - Umbral: 3.0 (configurable)

2. **Local Outlier Factor (LOF)**
   - Algoritmo basado en densidad
   - Identifica outliers locales

3. **Isolation Forest**
   - Algoritmo de aprendizaje automático no supervisado
   - Aísla anomalías usando árboles de decisión

### Pruebas de Hipótesis
1. **Test de Grubbs**
   - Para muestras pequeñas
   - Detecta un outlier a la vez

2. **Test de Dixon**
   - Para muestras pequeñas (3-30 observaciones)
   - Detecta outliers en extremos

3. **Test de Rosner**
   - Para muestras grandes (≥25 observaciones)
   - Detecta múltiples outliers

## Estrategias de Combinación

### 1. Votación (Recomendada)
- Un outlier se considera final si es detectado por:
  - Al menos N métodos univariados (configurable, default: 2)
  - Al menos M métodos multivariados (configurable, default: 1)
  - O por cualquier prueba de hipótesis

### 2. Unión
- Un outlier se considera final si es detectado por cualquier método

### 3. Intersección
- Un outlier se considera final si es detectado por TODOS los métodos

## Interfaz de Usuario

### Sección de Configuración
- Selector de dataset
- Configuración de estrategia de combinación
- Parámetros de métodos univariados y multivariados
- Selector de identificador del sujeto

### Sección de Resultados
- **Cards de Resumen**:
  - Total de registros
  - Outliers detectados
  - Porcentaje de outliers
  - Estrategia de combinación

- **Métodos Univariados** (izquierda):
  - Expanders para IQR, Z-Score, MAD
  - Badges con IDs de outliers detectados

- **Métodos Multivariados** (derecha):
  - Expanders para Mahalanobis, LOF, Isolation Forest
  - Badges con IDs de outliers detectados

- **Pruebas de Hipótesis**:
  - Expanders para Grubbs, Dixon, Rosner
  - Badges con IDs de outliers detectados

- **Outliers Finales**:
  - Resultado de la estrategia de combinación
  - Badges con IDs de outliers finales

## Flujo de Trabajo

1. **Selección de Dataset**: Usuario selecciona un dataset cargado
2. **Configuración**: Usuario configura parámetros de detección
3. **Ejecución**: Al hacer clic en "Ejecutar Detección de Outliers"
4. **Procesamiento**: Backend ejecuta todos los métodos
5. **Resultados**: Frontend muestra resultados organizados en expanders
6. **Visualización**: Badges muestran IDs de outliers detectados

## Características Técnicas

### Backend
- Manejo de errores robusto
- Validación de datos de entrada
- Procesamiento eficiente de datasets grandes
- Soporte para CSV y Excel

### Frontend
- Interfaz responsiva con Bootstrap
- Accordions interactivos
- Badges de colores claros para outliers
- Scroll automático a resultados
- Indicadores de carga

### CSS
- Estilos personalizados para badges
- Colores claros para mejor legibilidad
- Animaciones suaves
- Diseño responsivo

## Uso

1. Cargar un dataset en la pestaña "Cargar Datos"
2. Ir a la pestaña "Detección de Outliers"
3. Seleccionar el dataset
4. Configurar parámetros de detección
5. Hacer clic en "Ejecutar Detección de Outliers"
6. Revisar resultados en los expanders

## Notas de Implementación

- Los badges de outliers usan colores claros para mejor legibilidad
- Los expanders se abren automáticamente para mostrar resultados
- La interfaz es completamente responsiva
- Se incluyen validaciones en frontend y backend
- Los resultados se muestran de forma organizada y clara
