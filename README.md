# ANOUT - Análisis de Outliers

Una aplicación web moderna para el análisis de outliers utilizando FastAPI y tecnologías web modernas.

## 🚀 Características

### Módulo de Carga de Datos (Implementado)
- ✅ Carga de archivos CSV y Excel
- ✅ Identificación automática de tipos de variables
- ✅ Clasificación metodológica de variables:
  - Cualitativa Nominal
  - Cualitativa Nominal Binaria
  - Cuantitativa Continua
  - Cuantitativa Discreta
- ✅ Vista previa de datasets
- ✅ Estadísticas descriptivas detalladas
- ✅ Edición de tipos de variables
- ✅ Persistencia de datos entre sesiones
- ✅ Interfaz drag & drop moderna

### Módulos en Desarrollo
- 🔄 Preprocesamiento de datos
- 🔄 Detección de outliers (IQR, Z-Score, Isolation Forest)
- 🔄 Análisis y visualización interactiva
- 🔄 Exportación de resultados

## 🏗️ Arquitectura

```
ANOUT/
├── main.py                 # API principal de FastAPI
├── requirements.txt        # Dependencias de Python
├── analysis_core/         # Módulo de lógica del backend
│   ├── __init__.py
│   ├── data_processing.py # Lógica de la Fase 1
│   ├── outlier_detection.py # Lógica de la Fase 2
│   └── analysis_and_viz.py # Lógica de la Fase 3 y 4
├── frontend/              # Módulo de interfaz de usuario
│   ├── index.html         # Template principal
│   ├── main.css           # Estilos globales
│   ├── main.js            # Lógica principal
│   └── modules/           # Módulos frontend
│       ├── load_data/     # Carga de datos
│       ├── preprocess/    # Preprocesamiento
│       ├── detect_outliers/ # Detección de outliers
│       ├── analyze_viz/   # Análisis y visualización
│       └── results/       # Resultados
├── uploads/               # Archivos subidos
└── data/                  # Datos persistentes
```

## 🛠️ Tecnologías Utilizadas

### Backend
- **FastAPI**: Framework web moderno y rápido
- **Pandas**: Manipulación y análisis de datos
- **NumPy**: Computación numérica
- **Scikit-learn**: Algoritmos de machine learning
- **Plotly**: Visualizaciones interactivas

### Frontend
- **HTML5**: Estructura semántica
- **CSS3**: Estilos modernos y responsivos
- **JavaScript ES6+**: Lógica interactiva
- **Bootstrap 5**: Framework CSS
- **Font Awesome**: Iconografía
- **Plotly.js**: Gráficos interactivos

## 📦 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd ANOUT
   ```

2. **Crear entorno virtual**
   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```

3. **Instalar dependencias**
   ```bash
   pip install -r requirements.txt
   ```

4. **Ejecutar la aplicación**
   
   **Opción A: Usando el script de inicio (recomendado)**
   ```powershell
   .\scripts\start_server.ps1
   ```
   Este script verifica y cierra procesos en el puerto 8000 automáticamente.
   
   **Opción B: Ejecutar directamente**
   ```bash
   python main.py
   ```
   
   **Si el puerto 8000 está en uso:**
   ```powershell
   # Cerrar procesos en el puerto 8000
   .\scripts\kill_port.ps1 -Port 8000
   
   # O manualmente:
   netstat -ano | findstr :8000
   taskkill /PID <PID> /F
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:8000
   ```

## 🎯 Uso

### Cargar Datasets
1. Navega a la pestaña "Cargar Datos"
2. Arrastra y suelta archivos CSV o Excel, o haz clic para seleccionar
3. El sistema identificará automáticamente los tipos de variables
4. Revisa y edita los tipos de variables según sea necesario

### Funcionalidades Disponibles
- **Vista previa**: Ver las primeras filas del dataset
- **Detalles**: Estadísticas descriptivas completas
- **Editar variables**: Modificar tipos de variables identificados
- **Eliminar**: Remover datasets de la aplicación

## 🔧 Configuración

### Variables de Entorno
```bash
# Puerto del servidor (por defecto: 8000)
PORT=8000

# Host del servidor (por defecto: 0.0.0.0)
HOST=0.0.0.0
```

### Estructura de Datos
Los datasets se almacenan en:
- **Archivos físicos**: `uploads/`
- **Metadatos**: `data/datasets.json`

## 📊 Tipos de Variables

### Cualitativas
- **Nominal**: Variables categóricas sin orden (ej: colores, ciudades)
- **Nominal Binaria**: Variables con solo dos valores (ej: sí/no, 0/1)

### Cuantitativas
- **Continua**: Variables que pueden tomar cualquier valor en un rango (ej: altura, peso)
- **Discreta**: Variables que solo pueden tomar valores específicos (ej: número de hijos, edad)

## 🔮 Roadmap

### Fase 1: Procesamiento de Datos ✅
- [x] Carga de archivos
- [x] Identificación de tipos de variables
- [x] Estadísticas descriptivas
- [x] Persistencia de datos

### Fase 2: Detección de Outliers 🔄
- [ ] Método IQR
- [ ] Método Z-Score
- [ ] Isolation Forest
- [ ] Visualización de outliers

### Fase 3: Análisis y Visualización 🔄
- [ ] Gráficos de cajas y bigotes
- [ ] Gráficos de violín
- [ ] Histogramas
- [ ] Matrices de correlación

### Fase 4: Resultados y Exportación 🔄
- [ ] Reportes PDF
- [ ] Exportación a Excel
- [ ] API para integración

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte técnico o preguntas, por favor abre un issue en el repositorio.

---

**ANOUT** - Análisis de Outliers con Tecnologías Modernas 