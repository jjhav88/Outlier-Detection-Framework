// Dashboard Dinámico estilo Power BI

// Definir el módulo de manera más simple
window.resultsModule = {
    app: null,
    currentDataset: null,
    outlierResults: null,
    widgets: new Map(),
    selectedWidget: null,
    widgetCounter: 0,
    isDragging: false,
    dragElement: null,
    dashboards: new Map(), // Almacenar múltiples dashboards
    currentDashboardId: null, // ID del dashboard actual
    dashboardCounter: 0, // Contador para IDs de dashboards

    init(app) {
        this.app = app;
        
        // Verificar que los elementos del DOM existen
        const canvas = document.getElementById('canvasGrid');
        const toolItems = document.querySelectorAll('.tool-item');
        
        this.setupEventListeners();
        this.loadDashboardData();
        this.initializeDragAndDrop();
        this.loadDashboardsFromStorage();
        this.initializeCurrentDashboard();
        
        // Agregar función de prueba global
        window.testResultsModule = () => {
            
            // Crear un widget de prueba
            this.createWidget('card', 100, 100);
        };
        
        // Función para probar el panel de propiedades
        window.testPropertiesPanel = () => {
            
            // Verificar elementos del DOM
            const panel = document.getElementById('propertiesPanel');
            const content = document.getElementById('propertiesContent');
            
            
            if (panel && content) {
                // Mostrar panel
                panel.style.display = 'flex';
                
                // Agregar contenido de prueba
                content.innerHTML = `
                    <div class="config-section">
                        <h6>Prueba de Configuración</h6>
                        <div class="form-group mb-3">
                            <label>Título de Prueba</label>
                            <input type="text" class="form-control" value="Mi Widget">
                        </div>
                        <div class="form-group mb-3">
                            <label>Variable</label>
                            <select class="form-control">
                                <option>Seleccionar variable...</option>
                                <option>HPRT</option>
                                <option>INS1</option>
                            </select>
                        </div>
                        <button class="btn btn-primary btn-sm">Aplicar</button>
                    </div>
                `;
                
            } else {
            }
        };
        
        // Función para recargar datos del dashboard
        window.reloadDashboardData = async () => {
            await this.loadDashboardData();
            
            if (this.currentDataset) {
                this.showNotification('Datos recargados exitosamente', 'success');
                
                // Actualizar widgets existentes
                this.widgets.forEach((widgetData, widgetId) => {
                    this.generateWidgetContent(widgetId);
                });
            } else {
                this.showNotification('No se pudieron recargar los datos', 'error');
            }
        };
        
        // Función para forzar la carga del dataset actual
        window.forceLoadCurrentDataset = async () => {
            
            try {
                // Obtener el dataset actual de la sesión
                const sessionResponse = await fetch('/api/server-session');
                const sessionData = await sessionResponse.json();
                
                if (sessionData.current_dataset) {
                    
                    // Cargar el dataset completo
                    const datasetResponse = await fetch(`/api/datasets/${sessionData.current_dataset}/load`);
                    if (datasetResponse.ok) {
                        this.currentDataset = await datasetResponse.json();
                        
                        this.showNotification(`Dataset cargado: ${this.currentDataset.filename}`, 'success');
                        
                        // Actualizar widgets existentes
                        this.widgets.forEach((widgetData, widgetId) => {
                            this.generateWidgetContent(widgetId);
                        });
                        
                        return true;
                    } else {
                        this.showNotification('Error cargando dataset', 'error');
                        return false;
                    }
                } else {
                    this.showNotification('No hay dataset actual en sesión', 'warning');
                    return false;
                }
            } catch (error) {
                this.showNotification('Error forzando carga de dataset', 'error');
                return false;
            }
        };
        
    },

    setupEventListeners() {
        
        // Botones de la barra de herramientas
        const saveBtn = document.getElementById('saveLayoutBtn');
        const loadBtn = document.getElementById('loadLayoutBtn');
        const clearBtn = document.getElementById('clearLayoutBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const closeBtn = document.getElementById('closePropertiesBtn');
        
        
        saveBtn?.addEventListener('click', () => this.saveLayout());
        loadBtn?.addEventListener('click', () => this.loadLayout());
        clearBtn?.addEventListener('click', () => this.clearLayout());
        fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
        closeBtn?.addEventListener('click', () => this.hidePropertiesPanel());
        
        // Nuevos eventos para múltiples dashboards
        const newDashboardBtn = document.getElementById('newDashboardBtn');
        const dashboardSelector = document.getElementById('dashboardSelector');
        const renameDashboardBtn = document.getElementById('renameDashboardBtn');
        const deleteDashboardBtn = document.getElementById('deleteDashboardBtn');
        
        newDashboardBtn?.addEventListener('click', () => this.createNewDashboard());
        dashboardSelector?.addEventListener('change', (e) => this.switchDashboard(e.target.value));
        renameDashboardBtn?.addEventListener('click', () => this.renameCurrentDashboard());
        deleteDashboardBtn?.addEventListener('click', () => this.deleteCurrentDashboard());

        // Eventos del canvas
        const canvas = document.getElementById('canvasGrid');
        canvas?.addEventListener('click', (e) => {
            if (e.target.id === 'canvasGrid') {
                this.deselectWidget();
            }
        });

        // Eventos de configuración de widgets
        const applyBtn = document.getElementById('applyWidgetConfig');
        applyBtn?.addEventListener('click', () => this.applyWidgetConfiguration());
        
        // Evento para guardar dashboard como imagen
        const saveLayoutBtn = document.getElementById('saveLayoutBtn');
        saveLayoutBtn?.addEventListener('click', () => this.exportDashboard());
        
        // Evento para reorganizar el grid con plantillas
        const reorganizeBtn = document.getElementById('reorganizeGridBtn');
        reorganizeBtn?.addEventListener('click', () => this.showTemplateSelector());
        
        // Evento para limpiar dashboard
        const clearLayoutBtn = document.getElementById('clearLayoutBtn');
        clearLayoutBtn?.addEventListener('click', () => this.clearLayout());
        
    },

    async loadDashboardData() {
        try {
            
            // Intentar obtener el dataset desde múltiples fuentes
            let datasetInfo = this.app.selectedDataset || this.app.datasets?.current;
            
            // Si el dataset es solo un string (nombre del archivo), necesitamos cargarlo completo
            if (typeof datasetInfo === 'string') {
                try {
                    const datasetResponse = await fetch(`/api/datasets/${datasetInfo}/load`);
                    if (datasetResponse.ok) {
                        this.currentDataset = await datasetResponse.json();
                    } else {
                    }
                } catch (error) {
                }
            } else if (datasetInfo && typeof datasetInfo === 'object') {
                // Si ya es un objeto, verificar si tiene variable_types
                this.currentDataset = datasetInfo;
                
                // Si no tiene variable_types, intentar cargarlo completo
                if (!this.currentDataset.variable_types) {
                    try {
                        const fullResponse = await fetch(`/api/datasets/${this.currentDataset.filename}/load`);
                        if (fullResponse.ok) {
                            this.currentDataset = await fullResponse.json();
                        }
                    } catch (error) {
                    }
                }
            } else {
                // Si no hay dataset en app, intentar obtener el dataset actual del servidor
                
                try {
                    // Obtener el dataset actual de la sesión
                    const sessionResponse = await fetch('/api/server-session');
                    const sessionData = await sessionResponse.json();
                    
                    if (sessionData.current_dataset) {
                        
                        // Cargar el dataset completo
                        const datasetResponse = await fetch(`/api/datasets/${sessionData.current_dataset}/load`);
                        if (datasetResponse.ok) {
                            this.currentDataset = await datasetResponse.json();
                        }
                    } else {
                        // Si no hay dataset en sesión, intentar obtener cualquier dataset disponible
                        const response = await fetch('/api/datasets');
                        const datasets = await response.json();
                        
                        if (datasets && datasets.length > 0) {
                            // Buscar un dataset que tenga variable_types (procesado)
                            const processedDataset = datasets.find(ds => ds.variable_types);
                            this.currentDataset = processedDataset || datasets[0];
                            
                            // Si el dataset no tiene variable_types, intentar cargarlo completo
                            if (!this.currentDataset.variable_types) {
                                const fullResponse = await fetch(`/api/datasets/${this.currentDataset.filename}/load`);
                                if (fullResponse.ok) {
                                    const fullDataset = await fullResponse.json();
                                    this.currentDataset = fullDataset;
                                }
                            }
                        }
                    }
                } catch (serverError) {
                }
            }

            if (this.currentDataset && this.currentDataset.filename) {
                
                // Obtener resultados de outliers desde el servidor
                await this.loadOutlierResultsFromServer();
            } else {
                this.showNotification('No hay dataset cargado. Ve a "Cargar datos" primero.', 'warning');
            }

        } catch (error) {
        }
    },

    async loadOutlierResultsFromServer() {
        try {
            
            if (this.currentDataset && this.currentDataset.filename) {
                // Usar el endpoint correcto de resultados
                const response = await fetch(`/api/results/${this.currentDataset.filename}/analysis-results`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.results) {
                        // Extraer los resultados de outliers de la respuesta
                        this.outlierResults = {
                            outliers_detected: data.results.outlier_metrics.outliers_detected,
                            total_records: data.results.outlier_metrics.total_records,
                            normal_data: data.results.outlier_metrics.normal_data,
                            outlier_percentage: data.results.outlier_metrics.outlier_percentage
                        };
                    } else {
                    }
                } else {
                }
            } else {
            }
        } catch (error) {
        }
    },

    initializeDragAndDrop() {
        const canvas = document.getElementById('canvasGrid');
        const toolItems = document.querySelectorAll('.tool-item');


        // Configurar elementos arrastrables
        toolItems.forEach((item, index) => {
            item.addEventListener('dragstart', (e) => this.handleDragStart(e));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });

        // Configurar área de drop
        if (canvas) {
            canvas.addEventListener('dragover', (e) => this.handleDragOver(e));
            canvas.addEventListener('drop', (e) => this.handleDrop(e));
            canvas.addEventListener('dragenter', (e) => this.handleDragEnter(e));
            canvas.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        } else {
        }
    },

    handleDragStart(e) {
        this.isDragging = true;
        this.dragElement = e.target;
        e.target.classList.add('dragging');
        
        // Guardar tanto el tipo como la métrica
        const dragData = {
            type: e.target.dataset.widgetType,
            metric: e.target.dataset.metric || null
        };
        e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        e.dataTransfer.effectAllowed = 'copy';
    },

    handleDragEnd(e) {
        this.isDragging = false;
        this.dragElement = null;
        e.target.classList.remove('dragging');
    },

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    },

    handleDragEnter(e) {
        e.preventDefault();
        const canvas = document.getElementById('canvasGrid');
        canvas.classList.add('drag-over');
    },

    handleDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            const canvas = document.getElementById('canvasGrid');
            canvas.classList.remove('drag-over');
        }
    },

    handleDrop(e) {
        e.preventDefault();
        
        const canvas = document.getElementById('canvasGrid');
        canvas.classList.remove('drag-over');

        const dragDataStr = e.dataTransfer.getData('text/plain');
        let dragData;
        
        try {
            dragData = JSON.parse(dragDataStr);
        } catch (error) {
            // Fallback para datos legacy
            dragData = { type: dragDataStr, metric: null };
        }
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.createWidget(dragData.type, x, y, dragData.metric);
    },

    createWidget(type, x, y, metric = null) {
        
        const widgetId = `widget-${++this.widgetCounter}`;
        const template = document.getElementById('widget-template');
        
        if (!template) {
            return;
        }
        
        const widget = template.content.cloneNode(true).querySelector('.dashboard-widget');
        
        if (!widget) {
            return;
        }
        
        widget.dataset.widgetId = widgetId;
        widget.dataset.widgetType = type;
        
        // Agregar métrica si existe
        if (metric) {
            widget.dataset.metric = metric;
        }
        
        // Calcular posición en grid de forma más intuitiva
        // Usar un grid de columnas fijas para mejor control
        const gridGap = 20;
        const columnWidth = 350; // Ancho base de columna
        const rowHeight = 300; // Alto base de fila
        
        // Determinar columna y fila basado en la posición del drop
        const column = Math.max(0, Math.floor(x / (columnWidth + gridGap)));
        const row = Math.max(0, Math.floor(y / (rowHeight + gridGap)));
        
        // Aplicar posición en grid dinámico con span por defecto de 1 columna y 1 fila
        widget.style.gridColumn = `${column + 1} / span 1`;
        widget.style.gridRow = `${row + 1} / span 1`;
        widget.style.position = 'relative';
        widget.style.left = 'auto';
        widget.style.top = 'auto';
        widget.style.width = '100%';
        widget.style.height = '100%';
        widget.style.minWidth = '300px';
        widget.style.minHeight = '250px';
        
        // Aplicar tamaño mediano por defecto
        widget.classList.add('widget-size-medium');

        // Configurar título y contenido según el tipo
        const title = widget.querySelector('.widget-title');
        title.textContent = ''; // No asignar título por defecto

        // Configurar eventos del widget
        this.setupWidgetEvents(widget);

        // Agregar al canvas
        const canvas = document.getElementById('canvasGrid');
        canvas.appendChild(widget);

        // Obtener configuración por defecto
        const defaultConfig = this.getDefaultConfig(type);
        
        // Si es un widget de métrica específica, configurar la métrica
        const metricAttribute = widget.dataset.metric;
        if (metricAttribute) {
            defaultConfig.metric = metricAttribute;
        }

        // Guardar referencia
        this.widgets.set(widgetId, {
            element: widget,
            type: type,
            config: defaultConfig,
            position: { 
                x: column * (widgetWidth + gridGap), 
                y: row * (widgetHeight + gridGap) 
            }
        });

        // Mostrar configuración inicial
        this.showWidgetConfiguration(widgetId);
        
        // Redimensionar el grid dinámicamente
        this.adjustGridSize();
        
        // Ajustar el scroll para mostrar el nuevo widget
        this.adjustScrollToWidget(widgetId);
        
        // Forzar la actualización del patrón de cuadrícula
        this.forceGridPatternUpdate();
        
        // Configurar observer para detectar cambios en el grid
        this.setupGridObserver();

    },

    getWidgetTitle(type) {
        const titles = {
            // Widgets básicos
            'card': 'Card de Métricas',
            'table': 'Tabla de Datos',
            
            // Widgets descriptivos
            'histogram': 'Histograma',
            'density': 'Gráfico de Densidad',
            'boxplot': 'Boxplot',
            'violin': 'Gráfico de Violín',
            'scatter': 'Gráfico de Dispersión',
            'pie': 'Gráfico de Pastel',
            'descriptive-table': 'Tabla Descriptiva',
            
            // Widgets de PCA
            'pca-elbow': 'Gráfico del Codo PCA',
            'pca-viz': 'Visualización PCA',
            'pca-biplot': 'Biplot PCA',
            
            // Widgets de Regresión Logística
            'logistic-metrics': 'Métricas Regresión Logística',
            'confusion-matrix': 'Matriz de Confusión',
            'roc-curve': 'Curva ROC',
            
            // Widgets de Clustering
            'clustering-elbow': 'Método del Codo',
            'silhouette-plot': 'Coeficiente de Silueta',
            'calinski-harabasz': 'Calinski-Harabasz',
            'davies-bouldin': 'Davies-Bouldin',
            'clustering-metrics': 'Métricas de Clustering',
            'kmeans-visualization': 'K-means PCA',
            
            // Widgets de Clustering Jerárquico
            'hierarchical-visualization': 'Visualización PCA Jerárquico',
            'dendrogram-tree': 'Dendrograma Árbol',
            'dendrogram-circular': 'Dendrograma Circular',
            
            // Widgets de Validación
            'hopkins-statistic': 'Hopkins Statistic',
            'clustering-tendency': 'Tendencia de Clustering',
            'sample-size': 'Tamaño de Muestra',
            'pca-comparison': 'Comparación PCA',
            'vat-matrix': 'Matriz VAT',
            
            // Widgets legacy
            'bar': 'Gráfico de Barras',
            'filter': 'Filtro',
            'date-filter': 'Filtro de Fecha'
        };
        return titles[type] || 'Widget';
    },

    getDefaultConfig(type) {
        const configs = {
            // Widgets básicos
            'card': {
                title: '',
                variable: '',
                metric: '', // Para widgets de métricas específicas
                aggregation: 'count',
                color: '#3b82f6'
            },
            'table': {
                title: '',
                variables: [],
                rows: 10
            },
            
            // Widgets descriptivos
            'histogram': {
                title: '',
                variable: '',
                bins: 20,
                color: '#3b82f6'
            },
            'density': {
                title: '',
                variable: '',
                color: '#3b82f6'
            },
            'boxplot': {
                title: '',
                variable: '',
                color: '#f59e0b'
            },
            'violin': {
                title: '',
                variable: '',
                color: '#8b5cf6'
            },
            'scatter': {
                title: '',
                xVariable: '',
                yVariable: '',
                color: '#10b981'
            },
            'pie': {
                title: '',
                variable: '',
                colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
            },
            'descriptive-table': {
                title: '',
                variable: ''
            },
            
            // Widgets de PCA
            'pca-elbow': {
                title: '',
                variables: []
            },
            'pca-viz': {
                title: '',
                variables: []
            },
            'pca-biplot': {
                title: '',
                variables: []
            },
            
            // Widgets de Regresión Logística
            'logistic-metrics': {
                title: '',
                variables: []
            },
            'confusion-matrix': {
                title: '',
                variables: []
            },
            'roc-curve': {
                title: '',
                variables: []
            },
            
            // Widgets de Clustering
            'clustering-elbow': {
                title: '',
                variables: []
            },
            'silhouette-plot': {
                title: '',
                variables: []
            },
            'calinski-harabasz': {
                title: '',
                variables: []
            },
            'davies-bouldin': {
                title: '',
                variables: []
            },
            'clustering-metrics': {
                title: '',
                variables: []
            },
            'kmeans-visualization': {
                title: '',
                variables: []
            },
            
            // Widgets de Clustering Jerárquico
            'hierarchical-visualization': {
                title: '',
                variables: []
            },
            'dendrogram-tree': {
                title: '',
                variables: []
            },
            'dendrogram-circular': {
                title: '',
                variables: []
            },
            
            // Widgets de Validación
            'hopkins-statistic': {
                title: '',
                variables: []
            },
            'clustering-tendency': {
                title: '',
                variables: []
            },
            'sample-size': {
                title: '',
                variables: []
            },
            'pca-comparison': {
                title: '',
                variables: []
            },
            'vat-matrix': {
                title: '',
                variables: []
            },
            
            // Widgets legacy
            'bar': {
                title: '',
                variable: '',
                color: '#8b5cf6'
            },
            'filter': {
                title: '',
                variable: '',
                type: 'dropdown'
            },
            'date-filter': {
                title: '',
                variable: '',
                range: 'all'
            }
        };
        return configs[type] || {};
    },

    setupWidgetEvents(widget) {
        // Selección de widget
        widget.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectWidget(widget.dataset.widgetId);
        });

        // Botón de configuración
        const configBtn = widget.querySelector('.btn-widget-config');
        
        configBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const widgetId = widget.dataset.widgetId;
            this.showWidgetConfiguration(widgetId);
        });

        // Botón de eliminar
        const removeBtn = widget.querySelector('.btn-widget-remove');
        removeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeWidget(widget.dataset.widgetId);
        });

        // Drag del widget
        this.makeWidgetDraggable(widget);
        this.makeWidgetResizable(widget);
    },

    makeWidgetDraggable(widget) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        widget.addEventListener('mousedown', (e) => {
            if (e.target.closest('.widget-controls, .widget-resize-handle')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(widget.style.left) || 0;
            startTop = parseInt(widget.style.top) || 0;
            
            widget.style.zIndex = '1000';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            widget.style.left = `${startLeft + deltaX}px`;
            widget.style.top = `${startTop + deltaY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                widget.style.zIndex = '10';
                
                // Actualizar posición en el registro
                const widgetId = widget.dataset.widgetId;
                if (this.widgets.has(widgetId)) {
                    this.widgets.get(widgetId).position = {
                        x: parseInt(widget.style.left) || 0,
                        y: parseInt(widget.style.top) || 0
                    };
                }
            }
        });
    },

    makeWidgetResizable(widget) {
        const handle = widget.querySelector('.widget-resize-handle');
        if (!handle) return;
        
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = widget.offsetWidth;
            startHeight = widget.offsetHeight;
            
            widget.style.zIndex = '1000';
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Calcular nuevo tamaño con límites mínimos
            let newWidth = Math.max(250, startWidth + deltaX);
            let newHeight = Math.max(150, startHeight + deltaY);
            
            // Aplicar límites máximos según el tipo de widget
            if (widget.dataset.widgetType === 'card') {
                newWidth = Math.min(newWidth, 400);
                newHeight = Math.min(newHeight, 250);
            } else if (widget.dataset.widgetType === 'pca-biplot') {
                newWidth = Math.max(newWidth, 500);
                newHeight = Math.max(newHeight, 400);
            }
            
            widget.style.width = `${newWidth}px`;
            widget.style.height = `${newHeight}px`;
            
            // Redimensionar gráficos en tiempo real
            this.resizeWidgetCharts(widget);
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                widget.style.zIndex = '10';
                
                // Ajustar el grid después del redimensionamiento
                setTimeout(() => {
                    this.adjustGridSize();
                }, 100);
            }
        });
    },

    selectWidget(widgetId) {
        // Deseleccionar widget anterior
        if (this.selectedWidget) {
            this.selectedWidget.classList.remove('selected');
        }

        // Seleccionar nuevo widget
        const widget = this.widgets.get(widgetId)?.element;
        if (widget) {
            this.selectedWidget = widget;
            widget.classList.add('selected');
            this.showWidgetConfiguration(widgetId);
        }
    },

    deselectWidget() {
        if (this.selectedWidget) {
            this.selectedWidget.classList.remove('selected');
            this.selectedWidget = null;
            this.hidePropertiesPanel();
        }
    },

    showWidgetConfiguration(widgetId) {
        // showWidgetConfiguration called
        
        const widgetData = this.widgets.get(widgetId);
        // Widget data found
        
        if (!widgetData) {
            return;
        }

        const content = document.getElementById('propertiesContent');
        const panel = document.getElementById('propertiesPanel');
        
        // Properties content element
        // Properties panel element
        
        if (!content) {
            return;
        }
        
        if (!panel) {
            return;
        }

        const configUI = this.generateConfigurationUI(widgetData);
        // Generated config UI
        
        content.innerHTML = configUI;
        panel.style.display = 'flex';
        
        // Properties panel visible
    },

    generateConfigurationUI(widgetData) {
        const { type, config } = widgetData;
        
        let html = `
            <div class="config-section">
                <h6>Configuración de ${this.getWidgetTitle(type)}</h6>
                <div class="form-group mb-3">
                    <label>Título (opcional)</label>
                    <input type="text" class="form-control" id="widgetTitle" value="${config.title || ''}" placeholder="Dejar vacío para no mostrar título">
                </div>
        `;

        // Configuraciones específicas por tipo
        switch (type) {
            // Widgets básicos
            case 'card':
                html += this.generateCardConfig(config);
                break;
            case 'table':
                html += this.generateTableConfig(config);
                break;
            
            // Widgets descriptivos
            case 'histogram':
            case 'boxplot':
                html += this.generateChartConfig(config, type);
                break;
            case 'density':
                html += this.generateDensityConfig(config);
                break;
            case 'violin':
                html += this.generateViolinConfig(config);
                break;
            case 'scatter':
                html += this.generateScatterConfig(config);
                break;
            case 'bar':
            case 'pie':
                html += this.generateCategoricalConfig(config, type);
                break;
            case 'descriptive-table':
                html += this.generateDescriptiveTableConfig(config);
                break;
            
            // Widgets de PCA
            case 'pca-elbow':
                html += this.generatePCAElbowConfig(config);
                break;
            case 'pca-viz':
                html += this.generatePCAVisualizationConfig(config);
                break;
            case 'pca-biplot':
                html += this.generatePCABiplotConfig(config);
                break;
            
            // Widgets de Regresión Logística
            case 'logistic-metrics':
                html += this.generateLogisticMetricsConfig(config);
                break;
            case 'confusion-matrix':
                html += this.generateConfusionMatrixConfig(config);
                break;
            case 'roc-curve':
                html += this.generateROCCurveConfig(config);
                break;
            case 'coefficients':
                html += this.generateCoefficientsConfig(config);
                break;
            
            // Widgets de Clustering
            case 'clustering-elbow':
                html += this.generateClusteringElbowConfig(config);
                break;
            case 'silhouette-plot':
                html += this.generateSilhouettePlotConfig(config);
                break;
            case 'calinski-harabasz':
                html += this.generateCalinskiHarabaszConfig(config);
                break;
            case 'davies-bouldin':
                html += this.generateDaviesBouldinConfig(config);
                break;
            case 'clustering-metrics':
                html += this.generateClusteringMetricsConfig(config);
                break;
            case 'kmeans-visualization':
                html += this.generateKMeansVisualizationConfig(config);
                break;
            
            // Widgets de Clustering Jerárquico
            case 'hierarchical-visualization':
                html += this.generateHierarchicalVisualizationConfig(config);
                break;
            case 'dendrogram-tree':
                html += this.generateDendrogramTreeConfig(config);
                break;
            case 'dendrogram-circular':
                html += this.generateDendrogramCircularConfig(config);
                break;
            
            // Widgets de Validación
            case 'hopkins-statistic':
                html += this.generateHopkinsStatisticConfig(config);
                break;
            case 'clustering-tendency':
                html += this.generateClusteringTendencyConfig(config);
                break;
            case 'sample-size':
                html += this.generateSampleSizeConfig(config);
                break;
            case 'pca-comparison':
                html += this.generatePCAComparisonConfig(config);
                break;
            case 'vat-matrix':
                html += this.generateVATMatrixConfig(config);
                break;
            
            // Widgets legacy
            case 'filter':
            case 'date-filter':
                html += this.generateFilterConfig(config, type);
                break;
        }

        html += `
                <div class="form-group mb-3">
                    <label>Tamaño</label>
                    <select class="form-control" id="widgetSize">
                        <option value="small">Pequeño</option>
                        <option value="medium">Mediano</option>
                        <option value="large">Grande</option>
                    </select>
                </div>
                <button class="btn btn-primary btn-sm" onclick="resultsModule.applyWidgetConfiguration()">
                    Aplicar Configuración
                </button>
            </div>
        `;

        return html;
    },

    generateCardConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Tipo de Métrica</label>
                <select class="form-control" id="cardVariable">
                    <option value="">Seleccionar métrica...</option>
                    <option value="total_registros">📊 Total de Registros</option>
                    <option value="outliers_detectados">⚠️ Outliers Detectados</option>
                    <option value="datos_normales">✅ Datos Normales</option>
                    <option value="porcentaje_outliers">📈 Porcentaje de Outliers</option>
                    <optgroup label="Variables del Dataset">
                        ${this.getVariableOptions()}
                    </optgroup>
                </select>
            </div>
            <div class="form-group mb-3">
                <label>Agregación (para variables)</label>
                <select class="form-control" id="cardAggregation">
                    <option value="count">Conteo</option>
                    <option value="sum">Suma</option>
                    <option value="mean">Promedio</option>
                    <option value="min">Mínimo</option>
                    <option value="max">Máximo</option>
                </select>
            </div>
        `;
    },

    generateChartConfig(config, type) {
        return `
            <div class="form-group mb-3">
                <label>Variable</label>
                <select class="form-control" id="chartVariable">
                    <option value="">Seleccionar variable...</option>
                    ${this.getVariableOptions()}
                </select>
            </div>
            ${type === 'histogram' ? `
            <div class="form-group mb-3">
                <label>Número de bins</label>
                <input type="number" class="form-control" id="chartBins" value="${config.bins || 20}" min="5" max="50">
            </div>
            ` : ''}
        `;
    },

    generateScatterConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variable X</label>
                <select class="form-control" id="scatterX">
                    <option value="">Seleccionar variable X...</option>
                    ${this.getVariableOptions()}
                </select>
            </div>
            <div class="form-group mb-3">
                <label>Variable Y</label>
                <select class="form-control" id="scatterY">
                    <option value="">Seleccionar variable Y...</option>
                    ${this.getVariableOptions()}
                </select>
            </div>
        `;
    },

    generateCategoricalConfig(config, type) {
        return `
            <div class="form-group mb-3">
                <label>Variable</label>
                <select class="form-control" id="categoricalVariable">
                    <option value="">Seleccionar variable...</option>
                    ${this.getVariableOptions()}
                </select>
            </div>
        `;
    },

    generateTableConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables a mostrar</label>
                <select class="form-control" id="tableVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Mantén presionado Ctrl (Cmd en Mac) para seleccionar múltiples variables
                </small>
            </div>
            <div class="form-group mb-3">
                <label>Número de filas a mostrar</label>
                <input type="number" class="form-control" id="tableRows" value="${config.rows || 10}" min="5" max="100">
                <small class="form-text text-muted">
                    Máximo 100 filas para mejor rendimiento
                </small>
            </div>
        `;
    },

    generateFilterConfig(config, type) {
        return `
            <div class="form-group mb-3">
                <label>Variable</label>
                <select class="form-control" id="filterVariable">
                    <option value="">Seleccionar variable...</option>
                    ${this.getVariableOptions()}
                </select>
            </div>
            ${type === 'filter' ? `
            <div class="form-group mb-3">
                <label>Tipo de filtro</label>
                <select class="form-control" id="filterType">
                    <option value="dropdown">Dropdown</option>
                    <option value="slider">Slider</option>
                    <option value="checkbox">Checkbox</option>
                </select>
            </div>
            ` : ''}
        `;
    },

    // Funciones de configuración para los nuevos widgets
    generateDensityConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variable</label>
                <select class="form-control" id="densityVariable">
                    <option value="">Seleccionar variable...</option>
                    ${this.getVariableOptions()}
                </select>
            </div>
        `;
    },

    generateViolinConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variable</label>
                <select class="form-control" id="violinVariable">
                    <option value="">Seleccionar variable...</option>
                    ${this.getVariableOptions()}
                </select>
            </div>
        `;
    },

    generateDescriptiveTableConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variable</label>
                <select class="form-control" id="descriptiveVariable">
                    <option value="">Seleccionar variable...</option>
                    ${this.getVariableOptions()}
                </select>
            </div>
        `;
    },

    // Funciones de configuración para widgets de análisis avanzado (placeholder)
    generatePCAElbowConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para PCA</label>
                <select class="form-control" id="pcaElbowVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el análisis PCA
                </small>
            </div>
        `;
    },

    generatePCAVisualizationConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para PCA</label>
                <select class="form-control" id="pcaVisualizationVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la visualización PCA
                </small>
            </div>
        `;
    },

    generatePCABiplotConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para PCA</label>
                <select class="form-control" id="pcaBiplotVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el biplot PCA
                </small>
            </div>
        `;
    },

    generateLogisticMetricsConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables Predictoras</label>
                <select class="form-control" id="logisticMetricsVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona las variables predictoras para la regresión logística
                </small>
            </div>
        `;
    },

    generateROCCurveConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables Predictoras</label>
                <select class="form-control" id="rocCurveVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona las variables predictoras para la curva ROC
                </small>
            </div>
        `;
    },

    generateConfusionMatrixConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables Predictoras</label>
                <select class="form-control" id="confusionMatrixVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona las variables predictoras para la matriz de confusión
                </small>
            </div>
        `;
    },

    generateCoefficientsConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables Predictoras</label>
                <select class="form-control" id="coefficientsVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona las variables predictoras para el análisis de coeficientes
                </small>
            </div>
        `;
    },

    generateClusteringElbowConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="clusteringElbowVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el clustering
                </small>
            </div>
        `;
    },

    generateSilhouettePlotConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="silhouettePlotVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el análisis de silueta
                </small>
            </div>
        `;
    },

    generateCalinskiHarabaszConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="calinskiHarabaszVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el índice Calinski-Harabasz
                </small>
            </div>
        `;
    },

    generateDaviesBouldinConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="daviesBouldinVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el índice Davies-Bouldin
                </small>
            </div>
        `;
    },

    generateClusteringMetricsConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="clusteringMetricsVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para las métricas de clustering
                </small>
            </div>
        `;
    },

    generateKMeansVisualizationConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="kmeansVisualizationVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la visualización K-means
                </small>
            </div>
        `;
    },

    generateHierarchicalVisualizationConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering Jerárquico</label>
                <select class="form-control" id="hierarchicalVisualizationVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la visualización jerárquica
                </small>
            </div>
        `;
    },

    generateDendrogramTreeConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Dendrograma</label>
                <select class="form-control" id="dendrogramTreeVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el dendrograma árbol
                </small>
            </div>
        `;
    },

    generateDendrogramCircularConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Dendrograma</label>
                <select class="form-control" id="dendrogramCircularVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el dendrograma circular
                </small>
            </div>
        `;
    },

    generateHopkinsStatisticConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Validación</label>
                <select class="form-control" id="hopkinsStatisticVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para Hopkins Statistic
                </small>
            </div>
        `;
    },

    generateClusteringTendencyConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Validación</label>
                <select class="form-control" id="clusteringTendencyVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para tendencia de clustering
                </small>
            </div>
        `;
    },

    generateSampleSizeConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Validación</label>
                <select class="form-control" id="sampleSizeVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el tamaño de muestra
                </small>
            </div>
        `;
    },

    generatePCAComparisonConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Comparación PCA</label>
                <select class="form-control" id="pcaComparisonVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la comparación PCA
                </small>
            </div>
        `;
    },

    generateVATMatrixConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Matriz VAT</label>
                <select class="form-control" id="vatMatrixVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la matriz VAT
                </small>
            </div>
        `;
    },

    generateConfusionMatrixConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables Predictoras</label>
                <select class="form-control" id="confusionVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona las variables predictoras para la matriz de confusión
                </small>
            </div>
        `;
    },

    generateROCCurveConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables Predictoras</label>
                <select class="form-control" id="rocVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona las variables predictoras para la curva ROC
                </small>
            </div>
        `;
    },

    generateClusteringElbowConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="clusteringVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el análisis de clustering
                </small>
            </div>
        `;
    },

    generateSilhouettePlotConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="silhouetteVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el análisis de silueta
                </small>
            </div>
        `;
    },

    generateCalinskiHarabaszConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="calinskiVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el índice Calinski-Harabasz
                </small>
            </div>
        `;
    },

    generateDaviesBouldinConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="daviesVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el índice Davies-Bouldin
                </small>
            </div>
        `;
    },

    generateClusteringMetricsConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering</label>
                <select class="form-control" id="clusteringMetricsVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para las métricas de clustering
                </small>
            </div>
        `;
    },

    generateKMeansVisualizationConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para K-means</label>
                <select class="form-control" id="kmeansVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la visualización K-means
                </small>
            </div>
        `;
    },

    generateHierarchicalVisualizationConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Clustering Jerárquico</label>
                <select class="form-control" id="hierarchicalVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el clustering jerárquico
                </small>
            </div>
        `;
    },

    generateDendrogramTreeConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Dendrograma</label>
                <select class="form-control" id="dendrogramVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el dendrograma
                </small>
            </div>
        `;
    },

    generateDendrogramCircularConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Dendrograma Circular</label>
                <select class="form-control" id="dendrogramCircularVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el dendrograma circular
                </small>
            </div>
        `;
    },

    generateHopkinsStatisticConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Validación</label>
                <select class="form-control" id="hopkinsVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el estadístico de Hopkins
                </small>
            </div>
        `;
    },

    generateClusteringTendencyConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Validación</label>
                <select class="form-control" id="tendencyVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la tendencia de clustering
                </small>
            </div>
        `;
    },

    generateSampleSizeConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Validación</label>
                <select class="form-control" id="sampleSizeVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para el análisis de tamaño de muestra
                </small>
            </div>
        `;
    },

    generatePCAComparisonConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Comparación PCA</label>
                <select class="form-control" id="pcaComparisonVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la comparación PCA
                </small>
            </div>
        `;
    },

    generateVATMatrixConfig(config) {
        return `
            <div class="form-group mb-3">
                <label>Variables para Matriz VAT</label>
                <select class="form-control" id="vatVariables" multiple size="6">
                    ${this.getVariableOptions()}
                </select>
                <small class="form-text text-muted">
                    Selecciona múltiples variables numéricas para la matriz VAT
                </small>
            </div>
        `;
    },

    getVariableOptions() {
        if (!this.currentDataset?.variable_types) return '';
        
        return Object.entries(this.currentDataset.variable_types)
            .map(([name, type]) => `<option value="${name}">${name} (${type})</option>`)
            .join('');
    },

    applyWidgetConfiguration() {
        if (!this.selectedWidget) {
            return;
        }
        
        const widgetId = this.selectedWidget.dataset.widgetId;
        const widgetData = this.widgets.get(widgetId);
        
        if (!widgetData) {
            return;
        }

        // Recopilar configuración del formulario
        const config = this.collectConfiguration(widgetData.type);
        
        // Capturar variables directamente del formulario visible para widgets de regresión logística
        if (['logistic-metrics', 'confusion-matrix', 'roc-curve', 'coefficients'].includes(widgetData.type)) {
            const visibleForm = document.querySelector('.properties-content');
            if (visibleForm) {
                const variablesSelect = visibleForm.querySelector('select[id$="Variables"]');
                if (variablesSelect) {
                    config.variables = Array.from(variablesSelect.selectedOptions).map(option => option.value);
                }
            }
        }
        
        // Actualizar configuración
        widgetData.config = { ...widgetData.config, ...config };
        
        // Actualizar título del widget
        const titleElement = widgetData.element.querySelector('.widget-title');
        if (config.title && config.title.trim()) {
            titleElement.textContent = config.title;
        } else {
            titleElement.textContent = '';
        }
        
        // Aplicar tamaño
        this.applyWidgetSize(widgetData.element, config.size);
        
        // Generar contenido del widget
        this.generateWidgetContent(widgetId);
        
        // Configuración aplicada exitosamente
        
        // Mostrar notificación
        this.showNotification('Configuración aplicada exitosamente', 'success');
    },

    collectConfiguration(type) {
        const config = {
            title: document.getElementById('widgetTitle')?.value || '',
            size: document.getElementById('widgetSize')?.value || 'medium'
        };

        switch (type) {
            case 'card':
                config.variable = document.getElementById('cardVariable')?.value || '';
                config.aggregation = document.getElementById('cardAggregation')?.value || 'count';
                break;
            case 'histogram':
            case 'boxplot':
                config.variable = document.getElementById('chartVariable')?.value || '';
                if (type === 'histogram') {
                    config.bins = parseInt(document.getElementById('chartBins')?.value) || 20;
                }
                break;
            case 'scatter':
                config.xVariable = document.getElementById('scatterX')?.value || '';
                config.yVariable = document.getElementById('scatterY')?.value || '';
                break;
            case 'bar':
            case 'pie':
                config.variable = document.getElementById('categoricalVariable')?.value || '';
                break;
            case 'density':
            case 'violin':
                config.variable = document.getElementById('densityVariable')?.value || 
                                 document.getElementById('violinVariable')?.value || '';
                break;
            case 'descriptive-table':
                config.variable = document.getElementById('descriptiveVariable')?.value || '';
                break;
            case 'table':
                config.variables = Array.from(document.getElementById('tableVariables')?.selectedOptions || [])
                    .map(option => option.value);
                config.rows = parseInt(document.getElementById('tableRows')?.value) || 10;
                break;
            case 'filter':
            case 'date-filter':
                config.variable = document.getElementById('filterVariable')?.value || '';
                if (type === 'filter') {
                    config.type = document.getElementById('filterType')?.value || 'dropdown';
                }
                break;
            
            // Widgets de análisis avanzado
            case 'pca-elbow':
            case 'pca-viz':
            case 'pca-biplot':
                config.variables = Array.from(document.getElementById('pcaElbowVariables')?.selectedOptions || 
                                           document.getElementById('pcaVisualizationVariables')?.selectedOptions || 
                                           document.getElementById('pcaBiplotVariables')?.selectedOptions || [])
                    .map(option => option.value);
                break;
            case 'logistic-metrics':
            case 'confusion-matrix':
            case 'roc-curve':
            case 'coefficients':
                config.variables = Array.from(document.getElementById('logisticMetricsVariables')?.selectedOptions || 
                                           document.getElementById('confusionVariables')?.selectedOptions || 
                                           document.getElementById('rocVariables')?.selectedOptions || 
                                           document.getElementById('coefficientsVariables')?.selectedOptions || [])
                    .map(option => option.value);
                break;
            case 'clustering-elbow':
            case 'silhouette-plot':
            case 'calinski-harabasz':
            case 'davies-bouldin':
            case 'clustering-metrics':
            case 'kmeans-visualization':
                config.variables = Array.from(document.getElementById('clusteringElbowVariables')?.selectedOptions || 
                                           document.getElementById('silhouettePlotVariables')?.selectedOptions || 
                                           document.getElementById('calinskiHarabaszVariables')?.selectedOptions || 
                                           document.getElementById('daviesBouldinVariables')?.selectedOptions || 
                                           document.getElementById('clusteringMetricsVariables')?.selectedOptions || 
                                           document.getElementById('kmeansVisualizationVariables')?.selectedOptions || [])
                    .map(option => option.value);
                break;
            case 'hierarchical-visualization':
            case 'dendrogram-tree':
            case 'dendrogram-circular':
                config.variables = Array.from(document.getElementById('hierarchicalVisualizationVariables')?.selectedOptions || 
                                           document.getElementById('dendrogramTreeVariables')?.selectedOptions || 
                                           document.getElementById('dendrogramCircularVariables')?.selectedOptions || [])
                    .map(option => option.value);
                break;
            case 'hopkins-statistic':
            case 'clustering-tendency':
            case 'sample-size':
            case 'pca-comparison':
            case 'vat-matrix':
                config.variables = Array.from(document.getElementById('hopkinsStatisticVariables')?.selectedOptions || 
                                           document.getElementById('clusteringTendencyVariables')?.selectedOptions || 
                                           document.getElementById('sampleSizeVariables')?.selectedOptions || 
                                           document.getElementById('pcaComparisonVariables')?.selectedOptions || 
                                           document.getElementById('vatMatrixVariables')?.selectedOptions || [])
                    .map(option => option.value);
                break;
        }

        return config;
    },

    applyWidgetSize(widget, size) {
        widget.className = widget.className.replace(/widget-size-\w+/g, '');
        widget.classList.add(`widget-size-${size}`);
        
        // Ajustar el tamaño del widget según la configuración usando grid spans
        const sizeMap = {
            'small': { colSpan: 1, rowSpan: 1, minWidth: '300px', minHeight: '250px' },
            'medium': { colSpan: 2, rowSpan: 1, minWidth: '600px', minHeight: '350px' },
            'large': { colSpan: 2, rowSpan: 2, minWidth: '600px', minHeight: '500px' },
            'wide': { colSpan: 3, rowSpan: 1, minWidth: '900px', minHeight: '350px' },
            'tall': { colSpan: 1, rowSpan: 2, minWidth: '300px', minHeight: '500px' }
        };
        
        const dimensions = sizeMap[size] || sizeMap['medium'];
        
        // Aplicar spans de grid en lugar de width/height fijos
        const currentCol = widget.style.gridColumn;
        const currentRow = widget.style.gridRow;
        
        // Extraer inicio de columna y fila si existen
        let colStart = 1, rowStart = 1;
        if (currentCol && currentCol.includes('/')) {
            colStart = parseInt(currentCol.split('/')[0]) || 1;
        }
        if (currentRow && currentRow.includes('/')) {
            rowStart = parseInt(currentRow.split('/')[0]) || 1;
        }
        
        widget.style.gridColumn = `${colStart} / span ${dimensions.colSpan}`;
        widget.style.gridRow = `${rowStart} / span ${dimensions.rowSpan}`;
        widget.style.minWidth = dimensions.minWidth;
        widget.style.minHeight = dimensions.minHeight;
        widget.style.width = '100%';
        widget.style.height = '100%';
        
        // Guardar tamaño en configuración del widget
        const widgetId = widget.dataset.widgetId;
        if (widgetId && this.widgets.has(widgetId)) {
            this.widgets.get(widgetId).config.size = size;
        }
        
        // Redimensionar gráficos después de que el widget cambie de tamaño
        setTimeout(() => {
            this.resizeWidgetCharts(widget);
        }, 150);
    },

    async generateWidgetContent(widgetId) {
        const widgetData = this.widgets.get(widgetId);
        if (!widgetData) return;

        const contentElement = widgetData.element.querySelector('.widget-content');
        contentElement.innerHTML = '<div class="widget-loading"></div>';

        try {
            let content = '';
            
            switch (widgetData.type) {
                // Widgets básicos
                case 'card':
                    content = await this.generateCardContent(widgetData.config);
                    break;
                case 'table':
                    content = await this.generateTableContent(widgetData.config);
                    break;
                
                // Widgets descriptivos
                case 'histogram':
                    content = await this.generateHistogramContent(widgetData.config);
                    break;
                case 'density':
                    content = await this.generateDensityContent(widgetData.config);
                    break;
                case 'boxplot':
                    content = await this.generateBoxplotContent(widgetData.config);
                    break;
                case 'violin':
                    content = await this.generateViolinContent(widgetData.config);
                    break;
                case 'scatter':
                    content = await this.generateScatterContent(widgetData.config);
                    break;
                case 'pie':
                    content = await this.generatePieContent(widgetData.config);
                    break;
                case 'descriptive-table':
                    content = await this.generateDescriptiveTableContent(widgetData.config);
                    break;
                
                // Widgets de PCA
                case 'pca-elbow':
                    content = await this.generatePCAElbowContent(widgetData.config);
                    break;
                case 'pca-viz':
                    content = await this.generatePCAVisualizationContent(widgetData.config);
                    break;
                case 'pca-biplot':
                    content = await this.generatePCABiplotContent(widgetData.config);
                    break;
                
                // Widgets de Regresión Logística
                case 'logistic-metrics':
                    content = await this.generateLogisticMetricsContent(widgetData.config);
                    break;
                case 'confusion-matrix':
                    content = await this.generateConfusionMatrixContent(widgetData.config);
                    break;
                case 'roc-curve':
                    content = await this.generateROCCurveContent(widgetData.config);
                    break;
                case 'coefficients':
                    content = await this.generateCoefficientsContent(widgetData.config);
                    break;
                
                // Widgets de Clustering
                case 'clustering-elbow':
                    content = await this.generateClusteringElbowContent(widgetData.config);
                    break;
                case 'silhouette-plot':
                    content = await this.generateSilhouettePlotContent(widgetData.config);
                    break;
                case 'calinski-harabasz':
                    content = await this.generateCalinskiHarabaszContent(widgetData.config);
                    break;
                case 'davies-bouldin':
                    content = await this.generateDaviesBouldinContent(widgetData.config);
                    break;
                case 'clustering-metrics':
                    content = await this.generateClusteringMetricsContent(widgetData.config);
                    break;
                case 'kmeans-visualization':
                    content = await this.generateKMeansVisualizationContent(widgetData.config);
                    break;
                
                // Widgets de Clustering Jerárquico
                case 'hierarchical-visualization':
                    content = await this.generateHierarchicalVisualizationContent(widgetData.config);
                    break;
                case 'dendrogram-tree':
                    content = await this.generateDendrogramTreeContent(widgetData.config);
                    break;
                case 'dendrogram-circular':
                    content = await this.generateDendrogramCircularContent(widgetData.config);
                    break;
                
                // Widgets de Validación
                case 'hopkins-statistic':
                    content = await this.generateHopkinsStatisticContent(widgetData.config);
                    break;
                case 'clustering-tendency':
                    content = await this.generateClusteringTendencyContent(widgetData.config);
                    break;
                case 'sample-size':
                    content = await this.generateSampleSizeContent(widgetData.config);
                    break;
                case 'pca-comparison':
                    content = await this.generatePCAComparisonContent(widgetData.config);
                    break;
                case 'vat-matrix':
                    content = await this.generateVATMatrixContent(widgetData.config);
                    break;
                
                // Widgets legacy
                case 'bar':
                    content = await this.generateBarContent(widgetData.config);
                    break;
                case 'filter':
                case 'date-filter':
                    content = this.generateFilterContent(widgetData.config, widgetData.type);
                    break;
                
                default:
                    content = '<div class="text-muted">Tipo de widget no soportado</div>';
            }

            contentElement.innerHTML = content;
            
            // Si es un widget de gráfico, inicializar Plotly después de un breve delay
            if (['histogram', 'boxplot', 'scatter', 'pie', 'density', 'violin', 'pca-elbow', 'pca-viz', 'pca-biplot', 'roc-curve'].includes(widgetData.type)) {
                setTimeout(() => {
                    this.initializePlotlyChart(contentElement);
                    
                    // Forzar redimensionamiento después de inicializar Plotly
                    setTimeout(() => {
                        this.resizeWidgetCharts(widgetData.element);
                    }, 300);
                }, 200);
            }
        } catch (error) {
            contentElement.innerHTML = '<div class="text-danger">Error al generar contenido</div>';
        }
    },

    initializePlotlyChart(contentElement) {
        // Buscar elementos con datos de Plotly almacenados
        const plotlyElements = contentElement.querySelectorAll('[data-plotly-data]');
        
        plotlyElements.forEach(element => {
            try {
                const chartData = JSON.parse(element.dataset.plotlyData);
                const layout = JSON.parse(element.dataset.plotlyLayout);
                
                
                // Verificar que Plotly esté disponible
                if (typeof Plotly !== 'undefined') {
                                    // Obtener el widget contenedor para calcular márgenes dinámicos
                const widget = element.closest('.dashboard-widget');
                
                // Calcular márgenes dinámicos basados en el tipo de widget y tamaño
                let finalMargins = layout.margin;
                if (widget && widget.dataset.widgetType === 'pca-biplot') {
                    // Para el biplot, usar márgenes proporcionales al tamaño del widget
                    const widgetWidth = widget.offsetWidth || 350;
                    const widgetHeight = widget.offsetHeight || 250;
                    const marginRatio = Math.min(widgetWidth / 350, widgetHeight / 250);
                    
                    finalMargins = { 
                        l: Math.max(60, Math.round(80 * marginRatio)), 
                        r: Math.max(120, Math.round(150 * marginRatio)), 
                        t: Math.max(80, Math.round(100 * marginRatio)), 
                        b: Math.max(50, Math.round(60 * marginRatio)) 
                    };
                } else if (widget && widget.dataset.widgetType === 'scatter') {
                    // Para gráficos de dispersión, márgenes más generosos para el título
                    const widgetWidth = widget.offsetWidth || 400;
                    const widgetHeight = widget.offsetHeight || 300;
                    const marginRatio = Math.min(widgetWidth / 400, widgetHeight / 300);
                    
                    finalMargins = { 
                        l: Math.max(60, Math.round(80 * marginRatio)), 
                        r: Math.max(80, Math.round(100 * marginRatio)), 
                        t: Math.max(100, Math.round(120 * marginRatio)), // Más espacio arriba para el título
                        b: Math.max(60, Math.round(80 * marginRatio)) 
                    };
                } else if (widget && ['histogram', 'density', 'boxplot', 'violin', 'pie'].includes(widget.dataset.widgetType)) {
                    // Para otros gráficos, márgenes proporcionales
                    const widgetWidth = widget.offsetWidth || 400;
                    const widgetHeight = widget.offsetHeight || 300;
                    const marginRatio = Math.min(widgetWidth / 400, widgetHeight / 300);
                    
                    finalMargins = { 
                        l: Math.max(50, Math.round(70 * marginRatio)), 
                        r: Math.max(70, Math.round(90 * marginRatio)), 
                        t: Math.max(80, Math.round(100 * marginRatio)), 
                        b: Math.max(50, Math.round(70 * marginRatio)) 
                    };
                } else if (!layout.margin) {
                    // Solo aplicar márgenes por defecto si no hay ninguno configurado
                    finalMargins = this.calculateDynamicMargins(widget, { l: 40, r: 15, t: 40, b: 40 });
                }
                
                // Configurar layout para habilitar zoom con scroll del mouse
                const enhancedLayout = {
                    ...layout,
                    // Mantener márgenes existentes o usar dinámicos si es necesario
                    margin: finalMargins,
                    // Habilitar zoom con scroll del mouse
                    dragmode: 'zoom',
                    // Habilitar zoom con scroll
                    scrollZoom: true,
                    // Configurar ejes para zoom
                    xaxis: {
                        ...layout.xaxis,
                        autorange: true,
                        // Habilitar zoom en el eje X
                        fixedrange: false
                    },
                    yaxis: {
                        ...layout.yaxis,
                        autorange: true,
                        // Habilitar zoom en el eje Y
                        fixedrange: false
                    },
                    // Configuraciones adicionales para zoom
                    hovermode: 'closest',
                    selectdirection: 'any'
                };
                    
                    Plotly.newPlot(element, chartData, enhancedLayout, {
                        responsive: true,
                        useResizeHandler: true,
                        displayModeBar: true,
                        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d'],
                        modeBarButtonsToAdd: [{
                            name: 'Zoom con Scroll',
                            icon: Plotly.Icons.zoom,
                            click: function() {
                                // Toggle zoom con scroll
                                const currentMode = element.layout.scrollZoom;
                                Plotly.relayout(element, { scrollZoom: !currentMode });
                            }
                        }],
                        // Configuraciones adicionales para zoom
                        scrollZoom: true,
                        editable: false,
                        staticPlot: false,
                        // Configuración específica para biplot
                        autosize: true,
                        fitToContainer: true
                    }).then(() => {
                        
                        // Habilitar zoom con scroll por defecto de manera más explícita
                        Plotly.relayout(element, { 
                            scrollZoom: true,
                            dragmode: 'zoom'
                        });
                        
                        // Configurar eventos de zoom adicionales
                        element.on('plotly_relayout', function(eventData) {
                            if (eventData && eventData.scrollZoom !== undefined) {
                            }
                        });
                        
                        // Mostrar notificación informativa sobre el zoom
                        this.showNotification('💡 Usa la rueda del mouse para hacer zoom in/out en el gráfico', 'info');
                        
                        // Configurar redimensionamiento automático para biplot
                        if (widget && widget.dataset.widgetType === 'pca-biplot') {
                            this.setupBiplotResizeHandler(element, widget);
                        }
                        
                    }).catch(error => {
                    });
                } else {
                }
            } catch (error) {
            }
        });
    },

    async generateCardContent(config) {
        // Si es un widget de métrica específica de outliers, usar la función especializada
        if (config.metric) {
            return this.generateOutlierMetricCard(config);
        }
        
        if (!config.variable) {
            return `
                <div class="card-content-placeholder">
                    <div class="card-icon">
                        <i class="fas fa-chart-bar"></i>
                    </div>
                    <div class="card-info">
                        <h4>${config.title || ''}</h4>
                        <p class="card-subtitle">Selecciona una variable</p>
                        <div class="card-value">N/A</div>
                    </div>
                </div>
            `;
        }
        
        // Obtener datos de la variable
        const variableData = await this.getVariableData(config.variable);
        if (!variableData) {
            return `
                <div class="card-content-placeholder">
                    <div class="card-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="card-info">
                        <h4>${config.title || ''}</h4>
                        <p class="card-subtitle">Variable: ${config.variable}</p>
                        <div class="card-value">Variable no encontrada</div>
                    </div>
                </div>
            `;
        }

        // Determinar el tipo de variable y generar contenido apropiado
        const variableType = this.getVariableType(config.variable);
        let cardIcon, cardValue, cardSubtitle, cardColor, cardBgColor;

        // Obtener métricas del dataset
        const totalRecords = this.currentDataset?.rows || 0;
        const outlierCount = this.outlierResults?.outliers_detected || 0;
        const normalCount = totalRecords - outlierCount;
        const outlierPercentage = totalRecords > 0 ? ((outlierCount / totalRecords) * 100).toFixed(1) : 0;

        if (config.variable === 'total_registros' || config.variable === 'total_records') {
            // Card para total de registros
            cardIcon = 'fas fa-database';
            cardValue = totalRecords;
            cardSubtitle = 'Total de Registros';
            cardColor = '#007bff';
            cardBgColor = '#e3f2fd';
        } else if (config.variable === 'outliers_detectados' || config.variable === 'outliers_detected') {
            // Card para outliers detectados
            cardIcon = 'fas fa-exclamation-triangle';
            cardValue = outlierCount;
            cardSubtitle = 'Outliers Detectados';
            cardColor = '#ffc107';
            cardBgColor = '#fff3cd';
        } else if (config.variable === 'datos_normales' || config.variable === 'normal_data') {
            // Card para datos normales
            cardIcon = 'fas fa-check-circle';
            cardValue = normalCount;
            cardSubtitle = 'Datos Normales';
            cardColor = '#28a745';
            cardBgColor = '#d4edda';
        } else if (config.variable === 'porcentaje_outliers' || config.variable === 'outlier_percentage') {
            // Card para porcentaje de outliers
            cardIcon = 'fas fa-percentage';
            cardValue = `${outlierPercentage}%`;
            cardSubtitle = 'Porcentaje de Outliers';
            cardColor = '#dc3545';
            cardBgColor = '#f8d7da';
        } else if (variableType === 'cualitativa' || variableType.includes('cualitativa')) {
            // Variable categórica
            cardIcon = 'fas fa-list';
            cardValue = variableData.uniqueCount;
            cardSubtitle = `Valores únicos en ${config.variable}`;
            cardColor = '#007bff';
            cardBgColor = '#e3f2fd';
        } else if (variableType === 'cuantitativa' || variableType.includes('cuantitativa')) {
            // Variable numérica
            if (config.variable === 'es_outlier') {
                // Caso especial para la columna de outliers
                cardIcon = 'fas fa-exclamation-triangle';
                cardValue = outlierCount;
                cardSubtitle = `Outliers detectados (${outlierPercentage}%)`;
                cardColor = '#ffc107';
                cardBgColor = '#fff3cd';
            } else {
                // Variable numérica normal
                cardIcon = 'fas fa-chart-line';
                cardValue = variableData.totalCount;
                cardSubtitle = `Observaciones en ${config.variable}`;
                cardColor = '#17a2b8';
                cardBgColor = '#d1ecf1';
            }
        } else {
            // Tipo desconocido
            cardIcon = 'fas fa-question-circle';
            cardValue = variableData.totalCount || 'N/A';
            cardSubtitle = `Datos en ${config.variable}`;
            cardColor = '#6c757d';
            cardBgColor = '#f8f9fa';
        }

        return `
            <div class="card-content" style="border-left: 4px solid ${cardColor}; background: ${cardBgColor}">
                <div class="card-icon" style="color: ${cardColor}">
                    <i class="${cardIcon}"></i>
                </div>
                <div class="card-info">
                    <h4>${config.title || ''}</h4>
                    <p class="card-subtitle">${cardSubtitle}</p>
                    <div class="card-value" style="color: ${cardColor}">${cardValue}</div>
                </div>
            </div>
        `;
    },

    async generateHistogramContent(config) {
        if (!config.variable) return '<div class="text-muted">Selecciona una variable</div>';
        
        try {
            // Obtener datos de la variable desde el dataset actual
            const variableData = await this.getVariableDataForChart(config.variable);
            if (!variableData || !variableData.values) {
                throw new Error('No se pudieron obtener los datos para el histograma');
            }

            // Crear el gráfico con Plotly
            const chartData = [{
                x: variableData.values,
                type: 'histogram',
                nbinsx: config.bins || 20,
                marker: {
                    color: '#3b82f6',
                    line: {
                        color: '#1e40af',
                        width: 1
                    }
                },
                opacity: 0.7
            }];

            const layout = {
                title: `Histograma de ${config.variable}`,
                xaxis: { title: config.variable },
                yaxis: { title: 'Frecuencia' },
                margin: { l: 40, r: 15, t: 40, b: 40 },
                showlegend: false,
                autosize: false
            };

            const chartDiv = document.createElement('div');
            chartDiv.id = `histogram-${Date.now()}`;
            chartDiv.style.height = '100%';
            chartDiv.style.width = '100%';

            // Renderizar el gráfico con tamaño específico del widget
            const widget = this.getCurrentWidget();
            const widgetWidth = widget ? widget.offsetWidth - 30 : 350; // Restar padding
            const widgetHeight = widget ? widget.offsetHeight - 80 : 250; // Restar header y padding
            
            // Calcular márgenes dinámicos basados en el tamaño del widget
            const dynamicMargins = this.calculateDynamicMargins(widget, { l: 40, r: 15, t: 40, b: 40 });
            layout.margin = dynamicMargins;
            
            // Actualizar el layout con las dimensiones exactas del widget
            layout.width = widgetWidth;
            layout.height = widgetHeight;
            
            Plotly.newPlot(chartDiv, chartData, layout, {
                responsive: true, 
                useResizeHandler: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d'],
                modeBarButtonsToAdd: [{
                    name: 'Zoom con Scroll',
                    icon: Plotly.Icons.zoom,
                    click: function() {
                        const currentMode = chartDiv.layout.scrollZoom;
                        Plotly.relayout(chartDiv, { scrollZoom: !currentMode });
                    }
                }]
            }).then(() => {
                // Habilitar zoom con scroll por defecto
                Plotly.relayout(chartDiv, { scrollZoom: true });
            });

            return chartDiv.outerHTML;

        } catch (error) {
            return `
                <div class="text-danger p-3">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error al generar histograma: ${error.message}
                </div>
            `;
        }
    },

    async generateBoxplotContent(config) {
        if (!config.variable) return '<div class="text-muted">Selecciona una variable</div>';
        
        try {
            // Obtener datos de la variable desde el dataset actual
            const variableData = await this.getVariableDataForChart(config.variable);
            if (!variableData || !variableData.values) {
                throw new Error('No se pudieron obtener los datos para el boxplot');
            }
            
            // Crear el gráfico con Plotly
            const chartData = [{
                y: variableData.values,
                type: 'box',
                name: config.variable,
                marker: {
                    color: '#f59e0b',
                    outliercolor: '#ef4444',
                    line: {
                        color: '#d97706',
                        width: 1
                    }
                },
                boxpoints: 'outliers'
            }];

            const layout = {
                title: `Boxplot de ${config.variable}`,
                yaxis: { title: config.variable },
                margin: { l: 40, r: 15, t: 40, b: 40 },
                showlegend: false,
                autosize: false
            };

            const chartDiv = document.createElement('div');
            chartDiv.id = `boxplot-${Date.now()}`;
            chartDiv.style.height = '100%';
            chartDiv.style.width = '100%';

            // Renderizar el gráfico con tamaño específico del widget
            const widget = this.getCurrentWidget();
            const widgetWidth = widget ? widget.offsetWidth - 30 : 350; // Restar padding
            const widgetHeight = widget ? widget.offsetHeight - 80 : 250; // Restar header y padding
            
            // Calcular márgenes dinámicos basados en el tamaño del widget
            const dynamicMargins = this.calculateDynamicMargins(widget, { l: 40, r: 15, t: 40, b: 40 });
            layout.margin = dynamicMargins;
            
            // Actualizar el layout con las dimensiones exactas del widget
            layout.width = widgetWidth;
            layout.height = widgetHeight;
            
            Plotly.newPlot(chartDiv, chartData, layout, {
                responsive: true, 
                useResizeHandler: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d'],
                modeBarButtonsToAdd: [{
                    name: 'Zoom con Scroll',
                    icon: Plotly.Icons.zoom,
                    click: function() {
                        const currentMode = chartDiv.layout.scrollZoom;
                        Plotly.relayout(chartDiv, { scrollZoom: !currentMode });
                    }
                }]
            }).then(() => {
                // Habilitar zoom con scroll por defecto
                Plotly.relayout(chartDiv, { scrollZoom: true });
            });

            return chartDiv.outerHTML;

        } catch (error) {
            return `
                <div class="text-danger p-3">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error al generar boxplot: ${error.message}
                </div>
            `;
        }
    },

    async getVariableData(variableName) {
        if (!this.currentDataset || !variableName) return null;
        
        try {
            // Obtener datos básicos del dataset
            const totalCount = this.currentDataset.rows || 0;
            const uniqueCount = this.getUniqueCount(variableName);
            const outlierCount = this.getOutlierCount(variableName);
            const variableType = this.getVariableType(variableName);
            
            return {
                totalCount,
                uniqueCount,
                outlierCount,
                variableType
            };
        } catch (error) {
            return null;
        }
    },

    getUniqueCount(variableName) {
        // Simular conteo de valores únicos
        // En una implementación real, esto vendría del dataset
        if (variableName === 'es_outlier') return 2; // Outlier/No Outlier
        if (variableName === 'subject_id' || variableName.includes('id')) return this.currentDataset?.rows || 0;
        return Math.floor(Math.random() * 20) + 5; // Simulación para variables categóricas
    },

    getOutlierCount(variableName) {
        // Obtener conteo de outliers desde los resultados almacenados
        if (this.outlierResults && this.outlierResults.outliers_detected) {
            return this.outlierResults.outliers_detected;
        }
        return 0;
    },

    getVariableType(variableName) {
        if (!this.currentDataset || !this.currentDataset.variable_types) return 'desconocido';
        return this.currentDataset.variable_types[variableName] || 'desconocido';
    },

    async getVariableDataForChart(variableName, filterColumn = null, filterValue = null) {
        if (!this.currentDataset || !variableName) return null;
        
        try {
            // Obtener datos de la variable desde el servidor
            const requestBody = {
                variable: variableName
            };
            
            // Agregar filtros si se especifican
            if (filterColumn && filterValue !== null) {
                requestBody.filter_column = filterColumn;
                requestBody.filter_value = filterValue;
            }
            
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/variable-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.variable_data) {
                    return data.variable_data;
                }
            }

            // Si no se pueden obtener datos del servidor, usar datos simulados
            return this.getSimulatedVariableData(variableName, filterColumn, filterValue);
            
        } catch (error) {
            return this.getSimulatedVariableData(variableName, filterColumn, filterValue);
        }
    },

    getSimulatedVariableData(variableName, filterColumn = null, filterValue = null) {
        // Generar datos simulados para demostración
        const variableType = this.getVariableType(variableName);
        const totalRecords = this.currentDataset?.rows || 100;
        
        // Si hay filtro por es_outlier, simular la distribución
        let filteredRecords = totalRecords;
        if (filterColumn === 'es_outlier') {
            // Simular que aproximadamente 30% son outliers
            if (filterValue === 1) {
                filteredRecords = Math.floor(totalRecords * 0.3);
            } else if (filterValue === 0) {
                filteredRecords = Math.floor(totalRecords * 0.7);
            }
        }
        
        if (variableType === 'cuantitativa' || variableType.includes('cuantitativa')) {
            // Variable numérica - generar valores aleatorios
            const values = [];
            for (let i = 0; i < filteredRecords; i++) {
                // Si es outlier, generar valores más extremos
                if (filterColumn === 'es_outlier' && filterValue === 1) {
                    values.push(Math.random() * 200 + 100); // Valores más altos para outliers
                } else {
                    values.push(Math.random() * 100 + 50); // Valores normales
                }
            }
            return { values, type: 'numeric' };
        } else if (variableType === 'cualitativa' || variableType.includes('cualitativa')) {
            // Variable categórica - generar categorías
            const categories = ['A', 'B', 'C', 'D', 'E'];
            const values = [];
            for (let i = 0; i < filteredRecords; i++) {
                values.push(categories[Math.floor(Math.random() * categories.length)]);
            }
            return { values, type: 'categorical', categories };
        } else {
            // Tipo desconocido
            const values = [];
            for (let i = 0; i < filteredRecords; i++) {
                if (filterColumn === 'es_outlier' && filterValue === 1) {
                    values.push(Math.random() * 200 + 100);
                } else {
                    values.push(Math.random() * 100 + 50);
                }
            }
            return { values, type: 'numeric' };
        }
    },

    async getTableData(variables, maxRows = 10) {
        if (!this.currentDataset || !variables || variables.length === 0) {
            return null;
        }
        
        try {
            // Obtener datos de las variables desde el servidor
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/table-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    variables: variables,
                    max_rows: maxRows
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.table_data) {
                    return data.table_data;
                }
            }

            // Si no se pueden obtener datos del servidor, usar datos simulados
            return this.getSimulatedTableData(variables, maxRows);
            
        } catch (error) {
            return this.getSimulatedTableData(variables, maxRows);
        }
    },

    getSimulatedTableData(variables, maxRows = 10) {
        // Generar datos simulados para la tabla
        const totalRecords = this.currentDataset?.rows || 100;
        const actualRows = Math.min(maxRows, totalRecords);
        
        // Generar encabezados
        const headers = variables;
        
        // Generar filas de datos
        const rows = [];
        for (let i = 0; i < actualRows; i++) {
            const row = [];
            variables.forEach(variable => {
                const variableType = this.getVariableType(variable);
                
                if (variableType === 'cuantitativa' || variableType.includes('cuantitativa')) {
                    // Variable numérica - generar valor aleatorio
                    const value = (Math.random() * 100 + 50).toFixed(2);
                    row.push(value);
                } else if (variableType === 'cualitativa' || variableType.includes('cualitativa')) {
                    // Variable categórica - generar categoría
                    const categories = ['A', 'B', 'C', 'D', 'E'];
                    const category = categories[Math.floor(Math.random() * categories.length)];
                    row.push(category);
                } else {
                    // Tipo desconocido - usar índice
                    row.push(i + 1);
                }
            });
            rows.push(row);
        }
        
        return {
            headers: headers,
            rows: rows,
            totalRows: totalRecords,
            displayedRows: actualRows
        };
    },

    async generateScatterContent(config) {
        if (!config.xVariable || !config.yVariable) {
            return '<div class="text-muted">Selecciona variables X e Y</div>';
        }
        
        try {
            // Obtener datos de ambas variables desde el dataset actual
            const xData = await this.getVariableDataForChart(config.xVariable);
            const yData = await this.getVariableDataForChart(config.yVariable);
            
            if (!xData || !yData || !xData.values || !yData.values) {
                throw new Error('No se pudieron obtener los datos para el gráfico de dispersión');
            }

            // Asegurar que ambas variables tengan la misma longitud
            const minLength = Math.min(xData.values.length, yData.values.length);
            const xValues = xData.values.slice(0, minLength);
            const yValues = yData.values.slice(0, minLength);
            
            // Crear el gráfico con Plotly
            const chartData = [{
                x: xValues,
                y: yValues,
                mode: 'markers',
                type: 'scatter',
                marker: {
                    color: '#10b981',
                    size: 8,
                    opacity: 0.7
                },
                name: `${config.xVariable} vs ${config.yVariable}`
            }];

            const layout = {
                title: `Dispersión: ${config.xVariable} vs ${config.yVariable}`,
                xaxis: { title: config.xVariable },
                yaxis: { title: config.yVariable },
                margin: { l: 60, r: 60, t: 80, b: 60 }, // Márgenes compactos pero suficientes
                showlegend: false,
                autosize: false
            };

            const chartDiv = document.createElement('div');
            chartDiv.id = `scatter-${Date.now()}`;
            chartDiv.style.height = '100%';
            chartDiv.style.width = '100%';
            chartDiv.dataset.autoResize = 'true'; // Marcar para redimensionamiento automático

            // Renderizar el gráfico con tamaño específico del widget
            const widget = this.getCurrentWidget();
            const widgetWidth = widget ? widget.offsetWidth - 10 : 350; // Usar casi todo el espacio
            const widgetHeight = widget ? widget.offsetHeight - 10 : 250; // Usar casi todo el espacio
            
            // Usar márgenes fijos compactos para maximizar el área del gráfico
            layout.margin = { l: 60, r: 60, t: 80, b: 60 };
            
            // Actualizar el layout con las dimensiones exactas del widget
            layout.width = widgetWidth;
            layout.height = widgetHeight;
            
            Plotly.newPlot(chartDiv, chartData, layout, {
                responsive: true, 
                useResizeHandler: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d'],
                modeBarButtonsToAdd: [{
                    name: 'Zoom con Scroll',
                    icon: Plotly.Icons.zoom,
                    click: function() {
                        const currentMode = chartDiv.layout.scrollZoom;
                        Plotly.relayout(chartDiv, { scrollZoom: !currentMode });
                    }
                }]
            }).then(() => {
                // Habilitar zoom con scroll por defecto
                Plotly.relayout(chartDiv, { scrollZoom: true });
            });

            return chartDiv.outerHTML;

        } catch (error) {
            return `
                <div class="text-danger p-3">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error al generar gráfico de dispersión: ${error.message}
                </div>
            `;
        }
    },

    async generateBarContent(config) {
        if (!config.variable) return '<div class="text-muted">Selecciona una variable</div>';
        
        try {
            // Obtener datos de la variable desde el dataset actual
            const variableData = await this.getVariableDataForChart(config.variable);
            if (!variableData || !variableData.values) {
                throw new Error('No se pudieron obtener los datos para el gráfico de barras');
            }

            // Contar frecuencias para variables categóricas
            const valueCounts = {};
            variableData.values.forEach(value => {
                valueCounts[value] = (valueCounts[value] || 0) + 1;
            });

            const categories = Object.keys(valueCounts);
            const counts = Object.values(valueCounts);
            
            // Crear el gráfico con Plotly
            const chartData = [{
                x: categories,
                y: counts,
                type: 'bar',
                marker: {
                    color: '#8b5cf6',
                    line: {
                        color: '#7c3aed',
                        width: 1
                    }
                }
            }];

            const layout = {
                title: `Gráfico de Barras - ${config.variable}`,
                xaxis: { title: config.variable },
                yaxis: { title: 'Frecuencia' },
                margin: { l: 40, r: 15, t: 40, b: 40 },
                showlegend: false,
                autosize: false
            };

            const chartDiv = document.createElement('div');
            chartDiv.id = `bar-${Date.now()}`;
            chartDiv.style.height = '100%';
            chartDiv.style.width = '100%';

            // Renderizar el gráfico con tamaño específico del widget
            const widget = this.getCurrentWidget();
            const widgetWidth = widget ? widget.offsetWidth - 30 : 350; // Restar padding
            const widgetHeight = widget ? widget.offsetHeight - 80 : 250; // Restar header y padding
            
            // Calcular márgenes dinámicos basados en el tamaño del widget
            const dynamicMargins = this.calculateDynamicMargins(widget, { l: 40, r: 15, t: 40, b: 40 });
            layout.margin = dynamicMargins;
            
            // Actualizar el layout con las dimensiones exactas del widget
            layout.width = widgetWidth;
            layout.height = widgetHeight;
            
            Plotly.newPlot(chartDiv, chartData, layout, {
                responsive: true, 
                useResizeHandler: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d'],
                modeBarButtonsToAdd: [{
                    name: 'Zoom con Scroll',
                    icon: Plotly.Icons.zoom,
                    click: function() {
                        const currentMode = chartDiv.layout.scrollZoom;
                        Plotly.relayout(chartDiv, { scrollZoom: !currentMode });
                    }
                }]
            }).then(() => {
                // Habilitar zoom con scroll por defecto
                Plotly.relayout(chartDiv, { scrollZoom: true });
            });

            return chartDiv.outerHTML;

        } catch (error) {
            return `
                <div class="text-danger p-3">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error al generar gráfico de barras: ${error.message}
                </div>
            `;
        }
    },

    async generatePieContent(config) {
        if (!config.variable) return '<div class="text-muted">Selecciona una variable</div>';
        
        try {
            // Obtener datos de la variable desde el dataset actual
            const variableData = await this.getVariableDataForChart(config.variable);
            if (!variableData || !variableData.values) {
                throw new Error('No se pudieron obtener los datos para el gráfico de pastel');
            }

            // Contar frecuencias para variables categóricas
            const valueCounts = {};
            variableData.values.forEach(value => {
                valueCounts[value] = (valueCounts[value] || 0) + 1;
            });

            const labels = Object.keys(valueCounts);
            const values = Object.values(valueCounts);
            
            // Crear el gráfico con Plotly
            const chartData = [{
                labels: labels,
                values: values,
                type: 'pie',
                marker: {
                    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']
                },
                textinfo: 'label+percent',
                textposition: 'outside'
            }];

            const layout = {
                title: `Gráfico de Pastel - ${config.variable}`,
                margin: { l: 15, r: 15, t: 40, b: 15 },
                showlegend: true,
                autosize: false
            };

            const chartDiv = document.createElement('div');
            chartDiv.id = `pie-${Date.now()}`;
            chartDiv.style.height = '100%';
            chartDiv.style.width = '100%';

            // Renderizar el gráfico con tamaño específico del widget
            const widget = this.getCurrentWidget();
            const widgetWidth = widget ? widget.offsetWidth - 30 : 350; // Restar padding
            const widgetHeight = widget ? widget.offsetHeight - 80 : 250; // Restar header y padding
            
            // Calcular márgenes dinámicos basados en el tamaño del widget
            const dynamicMargins = this.calculateDynamicMargins(widget, { l: 15, r: 15, t: 40, b: 15 });
            layout.margin = dynamicMargins;
            
            // Actualizar el layout con las dimensiones exactas del widget
            layout.width = widgetWidth;
            layout.height = widgetHeight;
            
            Plotly.newPlot(chartDiv, chartData, layout, {
                responsive: true, 
                useResizeHandler: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d'],
                modeBarButtonsToAdd: [{
                    name: 'Zoom con Scroll',
                    icon: Plotly.Icons.zoom,
                    click: function() {
                        const currentMode = chartDiv.layout.scrollZoom;
                        Plotly.relayout(chartDiv, { scrollZoom: !currentMode });
                    }
                }]
            }).then(() => {
                // Habilitar zoom con scroll por defecto
                Plotly.relayout(chartDiv, { scrollZoom: true });
            });

            return chartDiv.outerHTML;

        } catch (error) {
            return `
                <div class="text-danger p-3">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error al generar gráfico de pastel: ${error.message}
                </div>
            `;
        }
    },

    async generateTableContent(config) {
        if (!config.variables || config.variables.length === 0) {
            return `
                <div class="text-center p-4">
                    <i class="fas fa-table text-muted" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <div class="text-muted">
                        <strong>Selecciona variables</strong><br>
                        <small>Usa el panel de propiedades para seleccionar las variables que quieres mostrar en la tabla</small>
                    </div>
                </div>
            `;
        }
        
        try {
            // Obtener datos de las variables seleccionadas
            const tableData = await this.getTableData(config.variables, config.rows || 10);
            
            if (!tableData || !tableData.headers || !tableData.rows) {
                throw new Error('No se pudieron obtener los datos para la tabla');
            }
            
            // Crear la tabla HTML
            let tableHTML = `
                <div class="table-container" style="height: 100%; overflow: auto;">
                    <table class="table table-sm table-striped table-hover" style="font-size: 0.8rem;">
                        <thead class="table-light sticky-top">
                            <tr>
            `;
            
            // Agregar encabezados
            tableData.headers.forEach(header => {
                tableHTML += `<th scope="col" class="text-center">${header}</th>`;
            });
            
            tableHTML += '</tr></thead><tbody>';
            
            // Agregar filas de datos
            tableData.rows.forEach(row => {
                tableHTML += '<tr>';
                row.forEach(cell => {
                    tableHTML += `<td class="text-center">${cell}</td>`;
                });
                tableHTML += '</tr>';
            });
            
            tableHTML += '</tbody></table>';
            
            // Agregar información de la tabla
            tableHTML += `
                <div class="table-info mt-2 p-2 bg-light rounded">
                    <small class="text-muted">
                        <i class="fas fa-info-circle"></i>
                        Mostrando ${tableData.rows.length} filas de ${tableData.totalRows} total
                    </small>
                </div>
            `;
            
            tableHTML += '</div>';
            
            return tableHTML;
            
        } catch (error) {
            return `
                <div class="text-danger p-3">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error al generar tabla: ${error.message}
                </div>
            `;
        }
    },

    generateFilterContent(config, type) {
        if (!config.variable) return '<div class="text-muted">Selecciona una variable</div>';
        
        return `
            <div class="filter-control">
                <label>${config.variable}</label>
                <select class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
        `;
    },

    removeWidget(widgetId) {
        const widgetData = this.widgets.get(widgetId);
        if (widgetData) {
            // Limpiar observers de redimensionamiento si existen
            const plotlyElements = widgetData.element.querySelectorAll('.plotly-graph-div');
            plotlyElements.forEach(element => {
                if (element.dataset.resizeObserver) {
                    try {
                        element.dataset.resizeObserver.disconnect();
                    } catch (e) {
                    }
                }
            });
            
            widgetData.element.remove();
            this.widgets.delete(widgetId);
            
            if (this.selectedWidget === widgetData.element) {
                this.deselectWidget();
            }
            
        }
    },

    hidePropertiesPanel() {
        document.getElementById('propertiesPanel').style.display = 'none';
    },

    saveLayout() {
        const layout = {
            widgets: Array.from(this.widgets.entries()).map(([id, data]) => ({
                id,
                type: data.type,
                config: data.config,
                position: data.position
            })),
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('dashboardLayout', JSON.stringify(layout));
        
        // Mostrar notificación
        this.showNotification('Layout guardado exitosamente', 'success');
    },

    loadLayout() {
        const saved = localStorage.getItem('dashboardLayout');
        if (!saved) {
            this.showNotification('No hay layout guardado', 'warning');
            return;
        }

        try {
            const layout = JSON.parse(saved);
            this.clearLayout();
            
            layout.widgets.forEach(widgetData => {
                this.createWidgetFromLayout(widgetData);
            });
            
            this.showNotification('Layout cargado exitosamente', 'success');
        } catch (error) {
            this.showNotification('Error al cargar el layout', 'error');
        }
    },

    createWidgetFromLayout(widgetData) {
        // Crear widget en posición 0,0 primero
        this.createWidget(widgetData.type, 0, 0, widgetData.metric);
        
        // Encontrar el widget recién creado (el último)
        const widgetId = Array.from(this.widgets.keys()).pop();
        if (!widgetId) return;
        
        const widget = this.widgets.get(widgetId).element;
        
        // Aplicar posición guardada si existe
        if (widgetData.position) {
            if (widgetData.position.gridColumn) {
                widget.style.gridColumn = widgetData.position.gridColumn;
            }
            if (widgetData.position.gridRow) {
                widget.style.gridRow = widgetData.position.gridRow;
            }
            if (widgetData.position.size) {
                this.applyWidgetSize(widget, widgetData.position.size);
            }
        }
        
        // Actualizar configuración
        if (widgetData.config) {
            this.widgets.get(widgetId).config = { ...this.widgets.get(widgetId).config, ...widgetData.config };
            this.generateWidgetContent(widgetId);
        }
    },

    clearLayout() {
        this.widgets.forEach((data, id) => {
            // Limpiar observers de redimensionamiento antes de eliminar
            if (this.widgetResizeObserver) {
                    try {
                    this.widgetResizeObserver.unobserve(data.element);
                    } catch (e) {
                }
            }
            if (this.contentResizeObserver) {
                const content = data.element.querySelector('.widget-content');
                if (content) {
                    try {
                        this.contentResizeObserver.unobserve(content);
                    } catch (e) {
                    }
                }
            }
            
            // Limpiar timeouts pendientes
            clearTimeout(data.element.dataset.resizeTimeout);
            clearTimeout(data.element.dataset.contentResizeTimeout);
            
            data.element.remove();
        });
        this.widgets.clear();
        this.selectedWidget = null;
        this.widgetCounter = 0;
        
        this.showNotification('Layout limpiado', 'info');
    },

    toggleFullscreen() {
        const workspace = document.querySelector('.dashboard-workspace');
        if (!document.fullscreenElement) {
            workspace.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    },

    showNotification(message, type = 'info') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    },

    // ===== NUEVAS FUNCIONES PARA WIDGETS DE OUTLIERS =====
    
    // Función para generar cards de métricas de outliers
    async generateOutlierMetricCard(config) {
        // Obtener métricas reales del servidor
        let totalRecords = 0;
        let outlierCount = 0;
        let normalCount = 0;
        let outlierPercentage = 0;
        
        try {
            if (this.currentDataset && this.currentDataset.filename) {
                const response = await fetch(`/api/results/${this.currentDataset.filename}/outlier-metrics`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        totalRecords = data.metrics.total_records;
                        outlierCount = data.metrics.outliers_detected;
                        normalCount = data.metrics.normal_data;
                        outlierPercentage = data.metrics.outlier_percentage;
                    }
                }
            }
        } catch (error) {
            // Usar datos de fallback
            totalRecords = this.currentDataset?.rows || 0;
            outlierCount = this.outlierResults?.outliers_detected || 0;
            normalCount = totalRecords - outlierCount;
            outlierPercentage = totalRecords > 0 ? ((outlierCount / totalRecords) * 100).toFixed(1) : 0;
        }

        let cardIcon, cardValue, cardSubtitle, cardColor, cardBgColor;

        switch (config.metric) {
            case 'total-records':
                cardIcon = 'fas fa-database';
                cardValue = totalRecords;
                cardSubtitle = 'Total de Registros';
                cardColor = '#007bff';
                cardBgColor = '#e3f2fd';
                break;
            case 'outliers-detected':
                cardIcon = 'fas fa-exclamation-triangle';
                cardValue = outlierCount;
                cardSubtitle = 'Outliers Identificados';
                cardColor = '#ffc107';
                cardBgColor = '#fff3cd';
                break;
            case 'normal-data':
                cardIcon = 'fas fa-check-circle';
                cardValue = normalCount;
                cardSubtitle = 'Datos Normales';
                cardColor = '#28a745';
                cardBgColor = '#d4edda';
                break;
            case 'outlier-percentage':
                cardIcon = 'fas fa-percentage';
                cardValue = `${outlierPercentage}%`;
                cardSubtitle = 'Porcentaje de Outliers';
                cardColor = '#dc3545';
                cardBgColor = '#f8d7da';
                break;
            default:
                cardIcon = 'fas fa-chart-bar';
                cardValue = 'N/A';
                cardSubtitle = 'Métrica no válida';
                cardColor = '#6c757d';
                cardBgColor = '#f8f9fa';
        }

        // Solo mostrar título personalizado si está configurado, sino mostrar solo el subtítulo sin repetir
        const hasCustomTitle = config.title && config.title.trim() !== '';
        const displayTitle = hasCustomTitle ? config.title : cardSubtitle;

        return `
            <div class="card-content" style="background: ${cardBgColor}; border-left: 4px solid ${cardColor};">
                <div class="card-icon" style="background: ${cardColor}; color: white;">
                    <i class="${cardIcon}"></i>
                </div>
                <div class="card-info">
                    <h4 style="font-size: 1.2rem; margin-bottom: 0.5rem;">${displayTitle}</h4>
                    ${hasCustomTitle ? `<p class="card-subtitle" style="font-size: 0.85rem; margin-bottom: 0.5rem;">${cardSubtitle}</p>` : ''}
                    <div class="card-value" style="color: ${cardColor}; font-size: 1.8rem; font-weight: bold;">${cardValue}</div>
                </div>
            </div>
        `;
    },

    // Función para generar gráfico de densidad
    async generateDensityContent(config) {
        if (!config.variable) {
            return '<div class="text-muted">Selecciona una variable</div>';
        }

        try {
            // Obtener datos separados por outliers y no outliers
            const outlierData = await this.getVariableDataForChart(config.variable, 'es_outlier', 1);
            const normalData = await this.getVariableDataForChart(config.variable, 'es_outlier', 0);

            if ((!outlierData || !outlierData.values) && (!normalData || !normalData.values)) {
                return '<div class="text-danger">No se pudieron obtener los datos</div>';
            }

            const chartDiv = document.createElement('div');
            chartDiv.id = `density-${Date.now()}`;
            chartDiv.style.height = '100%';
            chartDiv.style.width = '100%';

            // Obtener el widget actual para calcular márgenes dinámicos
            const widget = this.getCurrentWidget();
            // Usar márgenes base apropiados para gráficos con leyenda
            const dynamicMargins = this.calculateDynamicMargins(widget, { l: 50, r: 80, t: 50, b: 50 });
            
            // Calcular dimensiones del widget  
            const widgetWidth = 350; // Tamaño por defecto
            const widgetHeight = 250;

            const chartData = [];

            // Agregar datos de outliers si existen
            if (outlierData && outlierData.values && outlierData.values.length > 0) {
                chartData.push({
                    x: outlierData.values,
                    type: 'histogram',
                    histnorm: 'probability density',
                    name: 'Outliers',
                    marker: { color: '#ff6b6b' },
                    opacity: 0.7
                });
            }

            // Agregar datos normales si existen
            if (normalData && normalData.values && normalData.values.length > 0) {
                chartData.push({
                    x: normalData.values,
                    type: 'histogram',
                    histnorm: 'probability density',
                    name: 'No Outliers',
                    marker: { color: '#4ecdc4' },
                    opacity: 0.7
                });
            }

            const layout = {
                title: `Densidad de ${config.variable}`,
                xaxis: { title: config.variable },
                yaxis: { title: 'Densidad' },
                margin: dynamicMargins,
                height: widgetHeight,
                width: widgetWidth,
                showlegend: true,
                autosize: false
            };

            // Almacenar datos de Plotly para renderizar después
            chartDiv.dataset.plotlyData = JSON.stringify(chartData);
            chartDiv.dataset.plotlyLayout = JSON.stringify(layout);

            return chartDiv.outerHTML;
        } catch (error) {
            return '<div class="text-danger">Error al generar gráfico</div>';
        }
    },

    // Función para generar gráfico de violín
    async generateViolinContent(config) {
        if (!config.variable) {
            return '<div class="text-muted">Selecciona una variable</div>';
        }

        try {
            // Obtener datos separados por outliers y no outliers
            const outlierData = await this.getVariableDataForChart(config.variable, 'es_outlier', 1);
            const normalData = await this.getVariableDataForChart(config.variable, 'es_outlier', 0);

            if ((!outlierData || !outlierData.values) && (!normalData || !normalData.values)) {
                return '<div class="text-danger">No se pudieron obtener los datos</div>';
            }

            const chartDiv = document.createElement('div');
            chartDiv.id = `violin-${Date.now()}`;
            chartDiv.style.height = '100%';
            chartDiv.style.width = '100%';

            // Obtener el widget actual para calcular márgenes dinámicos
            const widget = this.getCurrentWidget();
            // Usar márgenes base apropiados para gráficos con leyenda
            const dynamicMargins = this.calculateDynamicMargins(widget, { l: 50, r: 80, t: 50, b: 50 });
            
            // Calcular dimensiones del widget
            const widgetWidth = 350; // Tamaño por defecto
            const widgetHeight = 250;

            const chartData = [];

            // Agregar datos de outliers si existen
            if (outlierData && outlierData.values && outlierData.values.length > 0) {
                chartData.push({
                    y: outlierData.values,
                    type: 'violin',
                    name: 'Outliers',
                    box: { visible: true },
                    meanline: { visible: true },
                    marker: { color: '#ff6b6b' },
                    opacity: 0.7
                });
            }

            // Agregar datos normales si existen
            if (normalData && normalData.values && normalData.values.length > 0) {
                chartData.push({
                    y: normalData.values,
                    type: 'violin',
                    name: 'No Outliers',
                    box: { visible: true },
                    meanline: { visible: true },
                    marker: { color: '#4ecdc4' },
                    opacity: 0.7
                });
            }

            const layout = {
                title: `Gráfico de Violín - ${config.variable}`,
                yaxis: { title: config.variable },
                margin: dynamicMargins,
                height: widgetHeight,
                width: widgetWidth,
                showlegend: true,
                autosize: false
            };

            // Almacenar datos de Plotly para renderizar después
            chartDiv.dataset.plotlyData = JSON.stringify(chartData);
            chartDiv.dataset.plotlyLayout = JSON.stringify(layout);

            return chartDiv.outerHTML;
        } catch (error) {
            return '<div class="text-danger">Error al generar gráfico</div>';
        }
    },

    // Funciones para widgets de análisis avanzado
    async generatePCAElbowContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }

        try {
            // Obtener datos del servidor
            const response = await fetch(`/api/results/${this.currentDataset.filename}/pca-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variables: config.variables })
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.pca_results && data.pca_results.scree_plot_data) {
                const chartDiv = document.createElement('div');
                chartDiv.id = `pca-elbow-${Date.now()}`;
                chartDiv.style.height = '100%';
                chartDiv.style.width = '100%';

                const chartData = [{
                    x: data.pca_results.scree_plot_data.components,
                    y: data.pca_results.scree_plot_data.variance_explained,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: 'Varianza Explicada',
                    line: { color: '#007bff', width: 3 },
                    marker: { color: '#007bff', size: 8 }
                }];

                // Obtener el widget actual para calcular márgenes dinámicos
                const widget = this.getCurrentWidget();
                const dynamicMargins = this.calculateDynamicMargins(widget, { l: 50, r: 20, t: 50, b: 50 });
                
                const layout = {
                    title: 'Método del Codo - PCA',
                    xaxis: { title: 'Número de Componentes' },
                    yaxis: { title: 'Varianza Explicada Acumulada' },
                    margin: dynamicMargins,
                    height: 300,
                    width: 400,
                    showlegend: false
                };

                chartDiv.dataset.plotlyData = JSON.stringify(chartData);
                chartDiv.dataset.plotlyLayout = JSON.stringify(layout);

                return chartDiv.outerHTML;
            } else {
                return '<div class="text-warning">No hay datos de PCA disponibles</div>';
            }
        } catch (error) {
            return '<div class="text-danger">Error al generar gráfico PCA</div>';
        }
    },

    async generatePCAVisualizationContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }

        try {
            // Obtener datos del servidor
            const response = await fetch(`/api/results/${this.currentDataset.filename}/pca-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variables: config.variables })
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.pca_results && data.pca_results.plot_data) {
                const chartDiv = document.createElement('div');
                chartDiv.id = `pca-viz-${Date.now()}`;
                chartDiv.style.height = '100%';
                chartDiv.style.width = '100%';

                // Crear scatter plot de PC1 vs PC2
                const chartData = [{
                    x: data.pca_results.plot_data.pc1,
                    y: data.pca_results.plot_data.pc2,
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Observaciones',
                    marker: { 
                        color: '#007bff',
                        size: 8,
                        opacity: 0.7
                    }
                }];

                // Obtener el widget actual para calcular márgenes dinámicos
                const widget = this.getCurrentWidget();
                const dynamicMargins = this.calculateDynamicMargins(widget, { l: 50, r: 20, t: 50, b: 50 });
                
                const layout = {
                    title: 'Visualización PCA - PC1 vs PC2',
                    xaxis: { title: 'Primer Componente Principal (PC1)' },
                    yaxis: { title: 'Segundo Componente Principal (PC2)' },
                    margin: dynamicMargins,
                    height: 300,
                    width: 400,
                    showlegend: false
                };

                chartDiv.dataset.plotlyData = JSON.stringify(chartData);
                chartDiv.dataset.plotlyLayout = JSON.stringify(layout);

                return chartDiv.outerHTML;
            } else {
                return '<div class="text-warning">No hay datos de visualización PCA disponibles</div>';
            }
        } catch (error) {
            return '<div class="text-danger">Error al generar gráfico PCA</div>';
        }
    },

    async generatePCABiplotContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }

        try {
            // Obtener datos del servidor
            const response = await fetch(`/api/results/${this.currentDataset.filename}/pca-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variables: config.variables })
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.pca_results && data.pca_results.biplot_data) {
                const chartDiv = document.createElement('div');
                chartDiv.id = `pca-biplot-${Date.now()}`;
                chartDiv.style.height = '100%';
                chartDiv.style.width = '100%';
                chartDiv.style.position = 'relative';

                const biplotData = data.pca_results.biplot_data;
                
                // Crear datos para el biplot
                const traces = [];
                
                // Traza 1: Puntos de datos (PC1 vs PC2)
                const outlierIndices = biplotData.outlier_status.map((isOutlier, index) => isOutlier ? index : -1).filter(i => i !== -1);
                const normalIndices = biplotData.outlier_status.map((isOutlier, index) => !isOutlier ? index : -1).filter(i => i !== -1);
                
                // Puntos outliers
                if (outlierIndices.length > 0) {
                    traces.push({
                        x: outlierIndices.map(i => biplotData.pc1[i]),
                        y: outlierIndices.map(i => biplotData.pc2[i]),
                        mode: 'markers',
                        type: 'scatter',
                        name: 'Outliers',
                        marker: {
                            color: 'red',
                            size: 8,
                            symbol: 'x'
                        },
                        text: outlierIndices.map(i => `Índice: ${biplotData.original_indices[i]}`),
                        hovertemplate: '<b>Outlier</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<br>%{text}<extra></extra>'
                    });
                }
                
                // Puntos normales
                if (normalIndices.length > 0) {
                    traces.push({
                        x: normalIndices.map(i => biplotData.pc1[i]),
                        y: normalIndices.map(i => biplotData.pc2[i]),
                        mode: 'markers',
                        type: 'scatter',
                        name: 'Datos Normales',
                        marker: {
                            color: 'blue',
                            size: 6,
                            opacity: 0.7
                        },
                        text: normalIndices.map(i => `Índice: ${biplotData.original_indices[i]}`),
                        hovertemplate: '<b>Dato Normal</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<br>%{text}<extra></extra>'
                    });
                }
                
                // Traza 2: Flechas de variables (loadings)
                // Preparar flechas con líneas y puntas para variables
                const annotations = [];
                if (biplotData.loadings_pc1 && biplotData.loadings_pc2 && biplotData.variable_names) {
                    const pc1_loadings = biplotData.loadings_pc1;
                    const pc2_loadings = biplotData.loadings_pc2;
                    
                    // Escalar los loadings para que sean visibles en el gráfico
                    const max_loading = Math.max(...pc1_loadings.map(Math.abs), ...pc2_loadings.map(Math.abs));
                    const scale_factor = 0.8 / max_loading;
                    
                    // Primero agregar las líneas como trazas de scatter
                    biplotData.variable_names.forEach((label, i) => {
                        const x_end = pc1_loadings[i] * scale_factor;
                        const y_end = pc2_loadings[i] * scale_factor;
                        
                        // Traza de línea desde el origen hasta el punto final
                        traces.push({
                            x: [0, x_end],
                            y: [0, y_end],
                            mode: 'lines',
                            type: 'scatter',
                            name: `${label} (flecha)`,
                            line: {
                                color: 'green',
                                width: 2
                            },
                            showlegend: false,
                            hovertemplate: `<b>${label}</b><br>PC1: ${x_end.toFixed(3)}<br>PC2: ${y_end.toFixed(3)}<extra></extra>`
                        });
                    });
                    
                    // Agregar traza de texto para los nombres de las variables
                    traces.push({
                        x: biplotData.variable_names.map((label, i) => pc1_loadings[i] * scale_factor),
                        y: biplotData.variable_names.map((label, i) => pc2_loadings[i] * scale_factor),
                        mode: 'text',
                        type: 'scatter',
                        name: 'Variables',
                        text: biplotData.variable_names,
                        textposition: 'top center',
                        textfont: {
                            size: 11,
                            color: 'darkgreen',
                            family: 'Arial, sans-serif'
                        },
                        showlegend: false,
                        hovertemplate: '<b>%{text}</b><br>PC1 Loading: %{x:.3f}<br>PC2 Loading: %{y:.3f}<extra></extra>'
                    });
                    
                    // Luego agregar las anotaciones con flechas (solo las puntas)
                    biplotData.variable_names.forEach((label, i) => {
                        const x_end = pc1_loadings[i] * scale_factor;
                        const y_end = pc2_loadings[i] * scale_factor;
                        
                        // Crear anotación con flecha desde el origen (solo la punta)
                        annotations.push({
                            x: x_end,
                            y: y_end,
                            xref: 'x',
                            yref: 'y',
                            axref: 'x',
                            ayref: 'y',
                            text: '', // Sin texto aquí, ya está en la traza de texto
                            showarrow: true,
                            arrowhead: 2,
                            arrowsize: 1.5,
                            arrowwidth: 2,
                            arrowcolor: 'green',
                            ax: 0,
                            ay: 0
                        });
                    });
                }

                // Obtener el widget actual para calcular márgenes dinámicos
                const widget = this.getCurrentWidget();
                
                // Configuración de layout mejorada para el biplot
                const layout = {
                    title: {
                        text: 'Biplot: Componentes Principales con Variables Originales',
                        font: {
                            size: 14,
                            color: '#374151'
                        },
                        x: 0.5,
                        y: 0.98,
                        xanchor: 'center',
                        yanchor: 'top'
                    },
                    xaxis: { 
                        title: {
                            text: 'Primer Componente Principal (PC1)',
                            font: { size: 12 }
                        },
                        zeroline: true,
                        zerolinecolor: 'lightgray',
                        showgrid: true,
                        gridcolor: '#f0f0f0'
                    },
                    yaxis: { 
                        title: {
                            text: 'Segundo Componente Principal (PC2)',
                            font: { size: 12 }
                        },
                        zeroline: true,
                        zerolinecolor: 'lightgray',
                        showgrid: true,
                        gridcolor: '#f0f0f0'
                    },
                    legend: {
                        x: 1.02,
                        y: 0.98,
                        xanchor: 'left',
                        yanchor: 'top',
                        bgcolor: 'rgba(255,255,255,0.95)',
                        bordercolor: '#e5e7eb',
                        borderwidth: 1,
                        font: { size: 11 }
                    },
                    hovermode: 'closest',
                    margin: { l: 50, r: 120, t: 80, b: 50 }, // Márgenes reducidos para gráfico más grande
                    showlegend: true,
                    plot_bgcolor: 'white',
                    paper_bgcolor: 'white',
                    annotations: annotations
                };

                // Configurar el gráfico para que se ajuste dinámicamente
                chartDiv.dataset.plotlyData = JSON.stringify(traces);
                chartDiv.dataset.plotlyLayout = JSON.stringify(layout);
                chartDiv.dataset.autoResize = 'true'; // Marcar para redimensionamiento automático

                return chartDiv.outerHTML;
            } else {
                return '<div class="text-warning">No hay datos de biplot PCA disponibles</div>';
            }
        } catch (error) {
            return '<div class="text-danger">Error al generar biplot PCA</div>';
        }
    },

    async generateLogisticMetricsContent(config) {
        if (!config.variables || config.variables.length < 1) {
            return '<div class="text-muted">Selecciona al menos 1 variable predictora</div>';
        }

        try {
            
            // Obtener el dataset actual
            const datasetInfo = this.app.selectedDataset || this.app.datasets?.current;
            if (!datasetInfo) {
                return '<div class="text-danger">Error: No hay dataset seleccionado</div>';
            }

            const filename = typeof datasetInfo === 'string' ? datasetInfo : datasetInfo.filename;
            
            // Preparar datos para la regresión logística
            const requestData = {
                predictors: config.variables,
                test_size: 0.2
            };


            // Llamar al endpoint de regresión logística
            const response = await fetch(`/api/results/${filename}/logistic-results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.logistic_results) {
                throw new Error('No se obtuvieron resultados válidos');
            }

            const results = data.logistic_results;
            
            // Calcular precision desde la matriz de confusión
            const precision = results.confusion_matrix.true_positives / (results.confusion_matrix.true_positives + results.confusion_matrix.false_positives);
            
            // Generar HTML solo para el widget de métricas
            let html = `
                <div class="logistic-metrics-container">
                    <!-- Título principal completamente separado arriba -->
                    <div class="title-section mb-4">
                        <h5 class="text-primary text-center">Métricas de Regresión Logística</h5>
                    </div>
                    
                    <!-- Información del Modelo -->
                    <div class="row mb-3">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header bg-secondary text-white">
                                    <h6 class="mb-0">Información del Modelo</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-6">
                                            <strong>Tamaño de Muestra:</strong> ${results.sample_size}
                                        </div>
                                        <div class="col-6">
                                            <strong>Entrenamiento:</strong> ${results.training_size} (${((results.training_size / results.sample_size) * 100).toFixed(1)}%)
                                        </div>
                                    </div>
                                    <div class="row mt-2">
                                        <div class="col-6">
                                            <strong>Prueba:</strong> ${results.test_size} (${((results.test_size / results.sample_size) * 100).toFixed(1)}%)
                                        </div>
                                        <div class="col-6">
                                            <strong>AUC Score:</strong> <span class="text-${results.model_performance.auc_interpretation === 'Excelente' ? 'success' : results.model_performance.auc_interpretation === 'Buena' ? 'info' : results.model_performance.auc_interpretation === 'Aceptable' ? 'warning' : 'danger'}">${(results.model_performance.auc_value * 100).toFixed(2)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Rendimiento del Modelo -->
                    <div class="row">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header bg-primary text-white">
                                    <h6 class="mb-0">Rendimiento del Modelo</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-4">
                                            <div class="metric-item text-center">
                                                <div class="metric-value text-primary">${(precision * 100).toFixed(2)}%</div>
                                                <div class="metric-label">PRECISIÓN</div>
                                            </div>
                                        </div>
                                        <div class="col-4">
                                            <div class="metric-item text-center">
                                                <div class="metric-value text-success">${(results.confusion_matrix.sensitivity * 100).toFixed(2)}%</div>
                                                <div class="metric-label">SENSIBILIDAD</div>
                                            </div>
                                        </div>
                                        <div class="col-4">
                                            <div class="metric-item text-center">
                                                <div class="metric-value text-info">${(results.confusion_matrix.specificity * 100).toFixed(2)}%</div>
                                                <div class="metric-label">ESPECIFICIDAD</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            return html;

        } catch (error) {
            return `
                <div class="text-danger">
                    <h6>❌ Error al generar métricas logísticas</h6>
                    <p class="mb-0">${error.message}</p>
                </div>
            `;
        }
    },

    async generateConfusionMatrixContent(config) {
        if (!config.variables || config.variables.length < 1) {
            return '<div class="text-muted">Selecciona al menos 1 variable predictora</div>';
        }

        try {
            
            // Obtener el dataset actual
            const datasetInfo = this.app.selectedDataset || this.app.datasets?.current;
            if (!datasetInfo) {
                return '<div class="text-danger">Error: No hay dataset seleccionado</div>';
            }

            const filename = typeof datasetInfo === 'string' ? datasetInfo : datasetInfo.filename;
            
            // Preparar datos para la regresión logística
            const requestData = {
                predictors: config.variables,
                test_size: 0.2
            };

            // Llamar al endpoint de regresión logística
            const response = await fetch(`/api/results/${filename}/logistic-results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.logistic_results) {
                throw new Error('No se obtuvieron resultados válidos');
            }

            const results = data.logistic_results;
            
            // Generar HTML para la matriz de confusión
            let html = `
                <div class="confusion-matrix-container">
                    <div class="row">
                        <div class="col-12">
                            <h6 class="text-primary mb-3">Matriz de Confusión</h6>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header bg-info text-white">
                                    <h6 class="mb-0">Resultados de Clasificación</h6>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-bordered table-sm">
                                            <thead class="table-info">
                                                <tr>
                                                    <th>Predicción</th>
                                                    <th>No Outlier</th>
                                                    <th>Outlier</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td><strong>No Outlier</strong></td>
                                                    <td class="text-success">${results.confusion_matrix.true_negatives}</td>
                                                    <td class="text-danger">${results.confusion_matrix.false_positives}</td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Outlier</strong></td>
                                                    <td class="text-danger">${results.confusion_matrix.false_negatives}</td>
                                                    <td class="text-success">${results.confusion_matrix.true_positives}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div class="mt-3">
                                        <h6 class="text-dark">Interpretación Detallada:</h6>
                                        <div class="row">
                                            <div class="col-12">
                                                <ul class="list-group list-group-flush">
                                                    <li class="list-group-item">
                                                        <strong>Verdaderos Negativos:</strong> ${results.confusion_matrix.true_negatives} 
                                                        <span class="text-success">Correctamente clasificados como No Outlier</span>
                                                    </li>
                                                    <li class="list-group-item">
                                                        <strong>Falsos Positivos:</strong> ${results.confusion_matrix.false_positives} 
                                                        <span class="text-danger">Incorrectamente clasificados como Outlier</span>
                                                    </li>
                                                    <li class="list-group-item">
                                                        <strong>Falsos Negativos:</strong> ${results.confusion_matrix.false_negatives} 
                                                        <span class="text-danger">Incorrectamente clasificados como No Outlier</span>
                                                    </li>
                                                    <li class="list-group-item">
                                                        <strong>Verdaderos Positivos:</strong> ${results.confusion_matrix.true_positives} 
                                                        <span class="text-success">Correctamente clasificados como Outlier</span>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            return html;

        } catch (error) {
            return `
                <div class="text-danger">
                    <h6>❌ Error al generar matriz de confusión</h6>
                    <p class="mb-0">${error.message}</p>
                </div>
            `;
        }
    },

    async generateROCCurveContent(config) {
        if (!config.variables || config.variables.length < 1) {
            return '<div class="text-muted">Selecciona al menos 1 variable predictora</div>';
        }

        try {
            
            // Obtener el dataset actual
            const datasetInfo = this.app.selectedDataset || this.app.datasets?.current;
            if (!datasetInfo) {
                return '<div class="text-danger">Error: No hay dataset seleccionado</div>';
            }

            const filename = typeof datasetInfo === 'string' ? datasetInfo : datasetInfo.filename;
            
            // Preparar datos para la regresión logística
            const requestData = {
                predictors: config.variables,
                test_size: 0.2
            };

            // Llamar al endpoint de regresión logística
            const response = await fetch(`/api/results/${filename}/logistic-results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.logistic_results) {
                throw new Error('No se obtuvieron resultados válidos');
            }

            const results = data.logistic_results;
            
            // Generar ID único para el gráfico
            const chartId = `roc-chart-${Math.random().toString(36).substr(2, 9)}`;
            
            // Generar HTML para la curva ROC
            let html = `
                <div class="roc-curve-container">
                    <div class="row">
                        <div class="col-12">
                            <div class="card shadow-sm">
                                <div class="card-header bg-gradient-success text-white">
                                    <h6 class="mb-0">
                                        <i class="fas fa-chart-line me-2"></i>
                                        Análisis de Rendimiento del Modelo
                                    </h6>
                                </div>
                                <div class="card-body p-2">
                                    <div id="${chartId}" style="width: 100%; height: 300px; margin: 5px 0;"></div>
                                    
                                    <div class="mt-2">
                                        <div class="row g-2">
                                            <div class="col-6">
                                                <div class="text-center p-2 bg-light rounded border">
                                                    <h6 class="text-success mb-1">
                                                        <i class="fas fa-percentage me-1"></i>
                                                        AUC Score
                                                    </h6>
                                                    <div class="h4 text-success fw-bold">${(results.model_performance.auc_value * 100).toFixed(2)}%</div>
                                                    <small class="text-muted d-block">
                                                        ${results.model_performance.auc_value >= 0.9 ? '⭐ Excelente' : 
                                                          results.model_performance.auc_value >= 0.8 ? '👍 Buena' : 
                                                          results.model_performance.auc_value >= 0.7 ? '✅ Aceptable' : 
                                                          '⚠️ Pobre'} capacidad
                                                    </small>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="text-center p-2 bg-light rounded border">
                                                    <h6 class="text-warning mb-1">
                                                        <i class="fas fa-chart-bar me-1"></i>
                                                        Variables
                                                    </h6>
                                                    <div class="h5 text-warning">${config.variables.length}</div>
                                                    <small class="text-muted">Variables predictoras utilizadas</small>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="row mt-2">
                                            <div class="col-12">
                                                <div class="p-2 bg-light rounded border">
                                                    <h6 class="text-info mb-1">
                                                        <i class="fas fa-info-circle me-1"></i>
                                                        Interpretación
                                                    </h6>
                                                    <p class="mb-0 text-muted small">
                                                        ${results.model_performance.auc_value >= 0.9 ? 'Excelente capacidad de discriminación entre outliers y datos normales' : 
                                                          results.model_performance.auc_value >= 0.8 ? 'Buena capacidad de discriminación entre outliers y datos normales' : 
                                                          results.model_performance.auc_value >= 0.7 ? 'Aceptable capacidad de discriminación entre outliers y datos normales' : 
                                                          'Pobre capacidad de discriminación entre outliers y datos normales'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Generar el gráfico de la curva ROC después de que se renderice el HTML
            setTimeout(() => {
                this.generateROCChart(results.roc_data, chartId);
            }, 100);

            return html;

        } catch (error) {
            return `
                <div class="text-danger">
                    <h6>❌ Error al generar curva ROC</h6>
                    <p class="mb-0">${error.message}</p>
                </div>
            `;
        }
    },

    async generateCoefficientsContent(config) {
        if (!config.variables || config.variables.length < 1) {
            return '<div class="text-muted">Selecciona al menos 1 variable predictora</div>';
        }

        try {
            
            // Obtener el dataset actual
            const datasetInfo = this.app.selectedDataset || this.app.datasets?.current;
            if (!datasetInfo) {
                return '<div class="text-danger">Error: No hay dataset seleccionado</div>';
            }

            const filename = typeof datasetInfo === 'string' ? datasetInfo : datasetInfo.filename;
            
            // Preparar datos para la regresión logística
            const requestData = {
                predictors: config.variables,
                test_size: 0.2
            };

            // Llamar al endpoint de regresión logística
            const response = await fetch(`/api/results/${filename}/logistic-results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.logistic_results) {
                throw new Error('No se obtuvieron resultados válidos');
            }

            const results = data.logistic_results;
            
            // Generar HTML para la tabla de coeficientes
            let html = `
                <div class="coefficients-container">
                    <div class="row">
                        <div class="col-12">
                            <h6 class="text-primary mb-3">Coeficientes del Modelo</h6>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header bg-warning text-dark">
                                    <h6 class="mb-0">Análisis de Variables Predictoras</h6>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-sm table-bordered table-hover">
                                            <thead class="table-warning">
                                                <tr>
                                                    <th>Variable Predictora</th>
                                                    <th>Coeficiente (β)</th>
                                                    <th>P-Valor</th>
                                                    <th>Odds Ratio</th>
                                                    <th>Interpretación</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${results.coefficients_table && results.coefficients_table.length > 0 ? 
                                                    results.coefficients_table.map(coef => `
                                                        <tr>
                                                            <td><strong>${coef.variable}</strong></td>
                                                            <td class="text-${coef.coefficient > 0 ? 'danger' : 'success'}">${coef.coefficient.toFixed(4)}</td>
                                                            <td>
                                                                ${coef.p_value ? 
                                                                    `<span class="badge bg-${coef.p_value < 0.001 ? 'danger' : coef.p_value < 0.01 ? 'warning' : coef.p_value < 0.05 ? 'info' : 'secondary'}">${coef.p_value.toFixed(4)}</span>` : 
                                                                    '<span class="badge bg-secondary">N/A</span>'
                                                                }
                                                            </td>
                                                            <td class="text-info">${coef.odds_ratio.toFixed(4)}</td>
                                                            <td class="text-muted small">${coef.interpretation}</td>
                                                        </tr>
                                                    `).join('') : 
                                                    '<tr><td colspan="5" class="text-center text-muted">No hay coeficientes disponibles</td></tr>'
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div class="mt-3">
                                        <div class="alert alert-info">
                                            <h6 class="alert-heading">Interpretación de Coeficientes:</h6>
                                            <ul class="mb-0">
                                                <li><strong>Coeficiente Positivo:</strong> Aumenta la probabilidad de ser outlier</li>
                                                <li><strong>Coeficiente Negativo:</strong> Disminuye la probabilidad de ser outlier</li>
                                                <li><strong>Odds Ratio > 1:</strong> Mayor probabilidad de outlier</li>
                                                <li><strong>Odds Ratio < 1:</strong> Menor probabilidad de outlier</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            return html;

        } catch (error) {
            return `
                <div class="text-danger">
                    <h6>❌ Error al generar coeficientes</h6>
                    <p class="mb-0">${error.message}</p>
                </div>
            `;
        }
    },

    generateROCChart(rocData, chartId) {
        try {
            if (!rocData || !rocData.fpr || !rocData.tpr) {
                return;
            }

            const trace = {
                x: rocData.fpr,
                y: rocData.tpr,
                type: 'scatter',
                mode: 'lines',
                name: 'Curva ROC',
                line: {
                    color: '#27ae60',
                    width: 4,
                    shape: 'spline'
                },
                fill: 'tonexty',
                fillcolor: 'rgba(39, 174, 96, 0.15)',
                hoverinfo: 'x+y+name',
                hovertemplate: '<b>%{fullData.name}</b><br>' +
                              'FPR: %{x:.3f}<br>' +
                              'TPR: %{y:.3f}<extra></extra>'
            };

            const diagonalTrace = {
                x: [0, 1],
                y: [0, 1],
                type: 'scatter',
                mode: 'lines',
                name: 'Línea de Referencia (Random)',
                line: {
                    color: '#95a5a6',
                    width: 2,
                    dash: 'dot'
                },
                showlegend: true,
                hoverinfo: 'name',
                hovertemplate: '<b>%{fullData.name}</b><extra></extra>'
            };

            const layout = {
                title: {
                    text: 'Curva ROC - Análisis de Outliers',
                    font: { 
                        size: 18,
                        color: '#2c3e50',
                        family: 'Arial, sans-serif'
                    },
                    x: 0.5,
                    xanchor: 'center'
                },
                xaxis: {
                    title: {
                        text: 'Tasa de Falsos Positivos (1 - Especificidad)',
                        font: { size: 14, color: '#34495e' }
                    },
                    range: [0, 1],
                    gridcolor: '#ecf0f1',
                    zerolinecolor: '#bdc3c7',
                    tickfont: { size: 12, color: '#7f8c8d' },
                    showline: true,
                    linecolor: '#bdc3c7',
                    linewidth: 1
                },
                yaxis: {
                    title: {
                        text: 'Tasa de Verdaderos Positivos (Sensibilidad)',
                        font: { size: 14, color: '#34495e' }
                    },
                    range: [0, 1],
                    gridcolor: '#ecf0f1',
                    zerolinecolor: '#bdc3c7',
                    tickfont: { size: 12, color: '#7f8c8d' },
                    showline: true,
                    linecolor: '#bdc3c7',
                    linewidth: 1
                },
                plot_bgcolor: '#fafafa',
                paper_bgcolor: 'white',
                margin: { t: 40, b: 60, l: 60, r: 40 },
                legend: {
                    x: 0.98,
                    y: 0.98,
                    xanchor: 'right',
                    yanchor: 'top',
                    bgcolor: 'rgba(255,255,255,0.9)',
                    bordercolor: '#bdc3c7',
                    borderwidth: 1,
                    font: { size: 11, color: '#2c3e50' }
                },
                hovermode: 'closest',
                hoverlabel: {
                    bgcolor: 'white',
                    bordercolor: '#bdc3c7',
                    font: { size: 12, color: '#2c3e50' }
                }
            };

            const config = {
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
                displaylogo: false
            };

            // Verificar que Plotly esté disponible
            if (typeof Plotly !== 'undefined') {
                Plotly.newPlot(chartId, [trace, diagonalTrace], layout, config);
                
                // Habilitar zoom con scroll
                const chartElement = document.getElementById(chartId);
                if (chartElement) {
                    chartElement.on('plotly_relayout', function(eventData) {
                        // Manejar cambios en el layout si es necesario
                    });
                }
            } else {
            }
        } catch (error) {
        }
    },

    async generateClusteringElbowContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Método del Codo - En desarrollo</div>';
    },

    async generateSilhouettePlotContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Coeficiente de Silueta - En desarrollo</div>';
    },

    async generateCalinskiHarabaszContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Calinski-Harabasz - En desarrollo</div>';
    },

    async generateDaviesBouldinContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Davies-Bouldin - En desarrollo</div>';
    },

    async generateClusteringMetricsContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Métricas de Clustering - En desarrollo</div>';
    },

    async generateKmeansVisualizationContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de K-means PCA - En desarrollo</div>';
    },

    async generateHierarchicalVisualizationContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Visualización Jerárquica - En desarrollo</div>';
    },

    async generateDendrogramTreeContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Dendrograma Árbol - En desarrollo</div>';
    },

    async generateDendrogramCircularContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Dendrograma Circular - En desarrollo</div>';
    },

    async generateHopkinsStatisticContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Hopkins Statistic - En desarrollo</div>';
    },

    async generateClusteringTendencyContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Tendencia de Clustering - En desarrollo</div>';
    },

    async generateSampleSizeContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Tamaño de Muestra - En desarrollo</div>';
    },

    async generatePCAComparisonContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Comparación PCA - En desarrollo</div>';
    },

    async generateVATMatrixContent(config) {
        if (!config.variables || config.variables.length < 2) {
            return '<div class="text-muted">Selecciona al menos 2 variables</div>';
        }
        return '<div class="text-info">Widget de Matriz VAT - En desarrollo</div>';
    },

    // Función para generar tabla descriptiva
    async generateDescriptiveTableContent(config) {
        if (!config.variable) {
            return '<div class="text-muted">Selecciona una variable</div>';
        }

        try {
            const variableData = await this.getVariableDataForChart(config.variable);
            if (!variableData || !variableData.values) {
                return '<div class="text-danger">No se pudieron obtener los datos</div>';
            }

            const values = variableData.values;
            const stats = this.calculateDescriptiveStats(values);

            return `
                <div class="table-container" style="height: 100%; overflow: auto;">
                    <table class="table table-sm table-striped">
                        <thead class="table-light sticky-top">
                            <tr>
                                <th>Estadística</th>
                                <th>Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>N</td><td>${stats.n}</td></tr>
                            <tr><td>Media</td><td>${stats.mean.toFixed(2)}</td></tr>
                            <tr><td>Mediana</td><td>${stats.median.toFixed(2)}</td></tr>
                            <tr><td>Desv. Estándar</td><td>${stats.std.toFixed(2)}</td></tr>
                            <tr><td>Mínimo</td><td>${stats.min.toFixed(2)}</td></tr>
                            <tr><td>Máximo</td><td>${stats.max.toFixed(2)}</td></tr>
                            <tr><td>Q1</td><td>${stats.q1.toFixed(2)}</td></tr>
                            <tr><td>Q3</td><td>${stats.q3.toFixed(2)}</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            return '<div class="text-danger">Error al generar tabla</div>';
        }
    },

    // Función auxiliar para calcular estadísticas descriptivas
    calculateDescriptiveStats(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const n = values.length;
        const mean = values.reduce((sum, val) => sum + val, 0) / n;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
        const std = Math.sqrt(variance);
        
        const median = n % 2 === 0 
            ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
            : sorted[Math.floor(n/2)];
        
        const q1 = sorted[Math.floor(n * 0.25)];
        const q3 = sorted[Math.floor(n * 0.75)];
        
        return {
            n,
            mean,
            median,
            std,
            min: Math.min(...values),
            max: Math.max(...values),
            q1,
            q3
        };
    },

    // Función para calcular márgenes dinámicos basados en el tamaño del widget
    calculateDynamicMargins(widget, baseMargins = { l: 40, r: 15, t: 40, b: 40 }) {
        if (!widget) return baseMargins;
        
        // Obtener el tamaño actual del widget
        const widgetWidth = widget.offsetWidth;
        const widgetHeight = widget.offsetHeight;
        
        // Calcular márgenes proporcionales al tamaño del widget
        const widthRatio = widgetWidth / 350; // 350 es el tamaño base 'medium'
        const heightRatio = widgetHeight / 250; // 250 es el tamaño base 'medium'
        
        // Ajustar márgenes proporcionalmente con un factor mínimo de 1.2
        const dynamicMargins = {
            l: Math.max(30, Math.round(baseMargins.l * Math.max(1.2, widthRatio))),
            r: Math.max(20, Math.round(baseMargins.r * Math.max(1.2, widthRatio))),
            t: Math.max(40, Math.round(baseMargins.t * Math.max(1.2, heightRatio))),
            b: Math.max(40, Math.round(baseMargins.b * Math.max(1.2, heightRatio)))
        };
        
        // Asegurar que los márgenes no sean demasiado grandes pero permitan suficiente espacio
        const maxMargin = Math.min(widgetWidth, widgetHeight) * 0.2; // Aumentado de 0.15 a 0.2
        Object.keys(dynamicMargins).forEach(key => {
            dynamicMargins[key] = Math.min(dynamicMargins[key], maxMargin);
        });
        
        return dynamicMargins;
    },

    // Función para configurar el redimensionamiento automático del biplot
    setupBiplotResizeHandler(plotlyElement, widget) {
        // Crear un observer para detectar cambios en el tamaño del widget
        const resizeObserver = new ResizeObserver(entries => {
            entries.forEach(entry => {
                if (entry.target === widget && window.Plotly) {
                    // Redimensionar el gráfico Plotly
                    Plotly.relayout(plotlyElement, {
                        width: entry.contentRect.width - 20, // Reducir padding
                        height: entry.contentRect.height - 60, // Reducir padding
                        margin: this.calculateBiplotMargins(entry.contentRect.width, entry.contentRect.height)
                    });
                }
            });
        });
        
        // Observar cambios en el tamaño del widget
        resizeObserver.observe(widget);
        
        // Guardar el observer para poder desconectarlo más tarde
        plotlyElement.dataset.resizeObserver = resizeObserver;
    },

    // Función para calcular márgenes específicos del biplot basados en el tamaño
    calculateBiplotMargins(width, height) {
        const marginRatio = Math.min(width / 350, height / 250);
        
        return { 
            l: Math.max(40, Math.round(50 * marginRatio)), 
            r: Math.max(80, Math.round(120 * marginRatio)), 
            t: Math.max(60, Math.round(80 * marginRatio)), 
            b: Math.max(40, Math.round(50 * marginRatio)) 
        };
    },

    // Función para calcular márgenes específicos de gráficos de dispersión
    calculateScatterMargins(width, height) {
        const marginRatio = Math.min(width / 400, height / 300);
        
        return { 
            l: Math.max(60, Math.round(80 * marginRatio)), 
            r: Math.max(80, Math.round(100 * marginRatio)), 
            t: Math.max(100, Math.round(120 * marginRatio)), // Más espacio arriba para el título
            b: Math.max(60, Math.round(80 * marginRatio)) 
        };
    },

    // Función para calcular márgenes estándar para otros tipos de gráficos
    calculateStandardMargins(width, height) {
        const marginRatio = Math.min(width / 400, height / 300);
        
        return { 
            l: Math.max(50, Math.round(70 * marginRatio)), 
            r: Math.max(70, Math.round(90 * marginRatio)), 
            t: Math.max(80, Math.round(100 * marginRatio)), 
            b: Math.max(50, Math.round(70 * marginRatio)) 
        };
    },

    // Función para obtener el widget actual o encontrar uno por ID
    getCurrentWidget(widgetId = null) {
        if (widgetId) {
            return document.querySelector(`[data-widget-id="${widgetId}"]`);
        }
        return this.selectedWidget || document.querySelector('.widget.selected');
    },

    // Función para configurar redimensionamiento global de todos los gráficos
    setupGlobalResizeHandler() {
        // Configurar redimensionamiento cuando cambie el tamaño de la ventana
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.redimensionarTodosLosGraficos();
                this.adjustGridSize();
            }, 100);
        });
    },

    // Función para redimensionar todos los gráficos activos
    redimensionarTodosLosGraficos() {
        // Redimensionando gráficos
        
        const plotlyElements = document.querySelectorAll('.plotly-graph-div');
        let redimensionados = 0;
        
        plotlyElements.forEach(element => {
            try {
                const widget = element.closest('.dashboard-widget');
                if (widget && window.Plotly) {
                    const widgetType = widget.dataset.widgetType;
                    const widgetWidth = widget.offsetWidth;
                    const widgetHeight = widget.offsetHeight;
                    
                    
                    // Aplicar redimensionamiento específico según el tipo
                    if (widgetType === 'pca-biplot') {
                        const margins = this.calculateBiplotMargins(widgetWidth, widgetHeight);
                        Plotly.relayout(element, {
                            width: widgetWidth - 10,
                            height: widgetHeight - 10,
                            margin: margins
                        });
                    } else if (widgetType === 'scatter') {
                        Plotly.relayout(element, {
                            width: widgetWidth - 10,
                            height: widgetHeight - 10,
                            margin: { l: 60, r: 60, t: 80, b: 60 }
                        });
                    } else if (['histogram', 'density', 'boxplot', 'violin', 'pie'].includes(widgetType)) {
                        const margins = this.calculateStandardMargins(widgetWidth, widgetHeight);
                        Plotly.relayout(element, {
                            width: widgetWidth - 10,
                            height: widgetHeight - 10,
                            margin: margins
                        });
                    } else {
                        // Para otros tipos de gráficos
                        Plotly.relayout(element, {
                            width: widgetWidth - 10,
                            height: widgetHeight - 10,
                            margin: { l: 50, r: 50, t: 80, b: 50 }
                        });
                    }
                    
                    // Forzar el resize de Plotly inmediatamente
                    Plotly.Plots.resize(element);
                    redimensionados++;
                    
                }
            } catch (error) {
            }
        });
        
        // Gráficos redimensionados
        
        // Mostrar notificación
        if (redimensionados > 0) {
            this.showNotification(`${redimensionados} gráficos redimensionados`, 'success');
        }
    },

    // Función para ajustar el tamaño del grid dinámicamente
    adjustGridSize() {
        const canvas = document.getElementById('canvasGrid');
        if (!canvas) return;

        const widgets = Array.from(this.widgets.values());
        if (widgets.length === 0) return;

        // Calcular el número máximo de columnas y filas necesarias
        let maxColumn = 0;
        let maxRow = 0;

        widgets.forEach(widgetData => {
            const widget = widgetData.element;
            const column = parseInt(widget.style.gridColumn?.split(' / ')[0]?.split('span ')[0]) || 0;
            const row = parseInt(widget.style.gridRow?.split(' / ')[0]?.split('span ')[0]) || 0;
            
            maxColumn = Math.max(maxColumn, column);
            maxRow = Math.max(maxRow, row);
        });

        // Ajustar el grid para acomodar todos los widgets
        const totalColumns = Math.max(4, maxColumn + 1);
        const totalRows = Math.max(3, maxRow + 1);

        // Aplicar el nuevo tamaño del grid con tamaños más flexibles
        canvas.style.gridTemplateColumns = `repeat(${totalColumns}, minmax(250px, 1fr))`;
        canvas.style.gridTemplateRows = `repeat(${totalRows}, minmax(150px, auto))`;

        // Calcular la altura mínima necesaria para el scroll - MÁS AGRESIVO
        const minHeight = Math.max(800, (totalRows * 250) + 200); // 250px por fila + 200px padding
        canvas.style.minHeight = `${minHeight}px`;
        
        // También ajustar la altura del contenedor principal
        const dashboardCanvas = document.querySelector('.dashboard-canvas');
        if (dashboardCanvas) {
            dashboardCanvas.style.minHeight = `${minHeight + 100}px`;
        }

        // Grid ajustado
        
        // Forzar el redimensionamiento del patrón de cuadrícula
        this.updateGridPattern(canvas, minHeight);
    },

    // Función para actualizar dinámicamente el patrón de cuadrícula
    updateGridPattern(canvas, height) {
        if (!canvas) return;
        
        // Crear o actualizar el elemento de patrón de cuadrícula
        let gridPattern = canvas.querySelector('.dynamic-grid-pattern');
        if (!gridPattern) {
            gridPattern = document.createElement('div');
            gridPattern.className = 'dynamic-grid-pattern';
            gridPattern.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: 
                    linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px);
                background-size: 20px 20px;
                background-repeat: repeat;
                background-position: 0 0;
                pointer-events: none;
                z-index: -1;
                height: ${height}px;
            `;
            canvas.appendChild(gridPattern);
        } else {
            gridPattern.style.height = `${height}px`;
        }
        
        // Patrón de cuadrícula actualizado
    },

    // Función para forzar la actualización del patrón de cuadrícula
    forceGridPatternUpdate() {
        const canvas = document.getElementById('canvasGrid');
        if (!canvas) return;
        
        // Calcular la altura total necesaria
        const widgets = Array.from(this.widgets.values());
        const totalRows = Math.max(3, widgets.length > 0 ? 
            Math.max(...widgets.map(w => parseInt(w.element.style.gridRow?.split(' / ')[0]?.split('span ')[0]) || 0)) + 1 : 3);
        
        const totalHeight = Math.max(800, (totalRows * 250) + 200);
        
        // Actualizar el patrón de cuadrícula
        this.updateGridPattern(canvas, totalHeight);
        
        // También actualizar el CSS del canvas
        canvas.style.minHeight = `${totalHeight}px`;
        
    },

    // Función para exportar el dashboard como imagen
    async exportDashboard() {
        try {
            
            const dashboardCanvas = document.querySelector('.dashboard-canvas');
            if (!dashboardCanvas) {
                this.showNotification('No se encontró el área del dashboard', 'error');
                return;
            }

            // Mostrar selector de formato
            const format = await this.showFormatSelector();
            if (!format) return;

            // Ajustar el scroll para capturar todo el contenido
            dashboardCanvas.scrollTo(0, 0);
            
            // Esperar a que se renderice todo
            await new Promise(resolve => setTimeout(resolve, 500));

            if (format === 'png') {
                await this.exportToPNG(dashboardCanvas);
            } else if (format === 'pdf') {
                await this.exportToPDF(dashboardCanvas);
            }

        } catch (error) {
            this.showNotification('Error al exportar el dashboard', 'error');
        }
    },

    // Función para mostrar selector de formato
    showFormatSelector() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'format-selector-modal';
            modal.innerHTML = `
                <div class="format-selector-content">
                    <h5>Seleccionar Formato de Exportación</h5>
                    <div class="format-options">
                        <button class="btn btn-primary" data-format="png">
                            <i class="fas fa-image"></i> PNG (Imagen)
                        </button>
                        <button class="btn btn-success" data-format="pdf">
                            <i class="fas fa-file-pdf"></i> PDF (Documento)
                        </button>
                    </div>
                    <button class="btn btn-secondary" id="cancelExport">Cancelar</button>
                </div>
            `;

            document.body.appendChild(modal);

            // Event listeners
            modal.querySelector('[data-format="png"]').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('png');
            });

            modal.querySelector('[data-format="pdf"]').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('pdf');
            });

            modal.querySelector('#cancelExport').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
        });
    },

    // Función para exportar a PNG
    async exportToPNG(canvas) {
        try {
            // Usar html2canvas para capturar el dashboard
            if (typeof html2canvas === 'undefined') {
                // Cargar html2canvas dinámicamente
                await this.loadHtml2Canvas();
            }

            const result = await html2canvas(canvas, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#f8f9fa'
            });

            // Crear enlace de descarga
            const link = document.createElement('a');
            link.download = `dashboard-${new Date().toISOString().slice(0, 10)}.png`;
            link.href = result.toDataURL();
            link.click();

            this.showNotification('Dashboard exportado como PNG exitosamente', 'success');

        } catch (error) {
            this.showNotification('Error al exportar a PNG', 'error');
        }
    },

    // Función para exportar a PDF
    async exportToPDF(canvas) {
        try {
            // Usar jsPDF para crear PDF
            if (typeof jsPDF === 'undefined') {
                await this.loadJsPDF();
            }

            const canvasData = await html2canvas(canvas, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#f8f9fa'
            });

            const imgData = canvasData.toDataURL('image/png');
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            
            const imgWidth = 297; // A4 landscape width
            const imgHeight = (canvasData.height * imgWidth) / canvasData.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);

            this.showNotification('Dashboard exportado como PDF exitosamente', 'success');

        } catch (error) {
            this.showNotification('Error al exportar a PDF', 'error');
        }
    },

    // Función para cargar html2canvas
    async loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // Función para cargar jsPDF
    async loadJsPDF() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // Función para mostrar selector de plantillas
    showTemplateSelector() {
        
        const modal = document.createElement('div');
        modal.className = 'template-selector-modal';
        modal.innerHTML = `
            <div class="template-selector-content" style="
                background: white !important;
                border-radius: 12px !important;
                padding: 30px !important;
                max-width: 800px !important;
                width: 90% !important;
                max-height: 80vh !important;
                overflow-y: auto !important;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3) !important;
                text-align: center !important;
            ">
                <h5 style="
                    margin-bottom: 25px !important;
                    color: #1f2937 !important;
                    font-size: 1.5rem !important;
                ">Seleccionar Plantilla de Layout</h5>
                <div class="template-grid" style="
                    display: grid !important;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
                    gap: 20px !important;
                    margin-bottom: 25px !important;
                ">
                    <div class="template-option" data-template="grid-2x2" style="
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        padding: 20px !important;
                        border: 2px solid #e5e7eb !important;
                        border-radius: 8px !important;
                        cursor: pointer !important;
                        transition: all 0.3s ease !important;
                        background: #f9fafb !important;
                    ">
                        <div class="template-preview grid-2x2-preview" style="
                            width: 120px !important;
                            height: 80px !important;
                            background: linear-gradient(45deg, #3b82f6 25%, transparent 25%), 
                                        linear-gradient(-45deg, #3b82f6 25%, transparent 25%), 
                                        linear-gradient(45deg, transparent 75%, #3b82f6 75%), 
                                        linear-gradient(-45deg, transparent 75%, #3b82f6 75%) !important;
                            background-size: 60px 60px !important;
                            background-position: 0 0, 0 30px, 30px -30px, -30px 0px !important;
                            border-radius: 4px !important;
                            margin-bottom: 10px !important;
                            position: relative !important;
                            overflow: hidden !important;
                        "></div>
                        <span style="
                            font-weight: 500 !important;
                            color: #374151 !important;
                            text-align: center !important;
                        ">Grid 2x2</span>
                    </div>
                    <div class="template-option" data-template="grid-3x3" style="
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        padding: 20px !important;
                        border: 2px solid #e5e7eb !important;
                        border-radius: 8px !important;
                        cursor: pointer !important;
                        transition: all 0.3s ease !important;
                        background: #f9fafb !important;
                    ">
                        <div class="template-preview grid-3x3-preview" style="
                            width: 120px !important;
                            height: 80px !important;
                            background-image: linear-gradient(#3b82f6 1px, transparent 1px),
                                            linear-gradient(90deg, #3b82f6 1px, transparent 1px) !important;
                            background-size: 40px 40px !important;
                            border-radius: 4px !important;
                            margin-bottom: 10px !important;
                            position: relative !important;
                            overflow: hidden !important;
                        "></div>
                        <span style="
                            font-weight: 500 !important;
                            color: #374151 !important;
                            text-align: center !important;
                        ">Grid 3x3</span>
                    </div>
                    <div class="template-option" data-template="dashboard-4" style="
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        padding: 20px !important;
                        border: 2px solid #e5e7eb !important;
                        border-radius: 8px !important;
                        cursor: pointer !important;
                        transition: all 0.3s ease !important;
                        background: #f9fafb !important;
                    ">
                        <div class="template-preview dashboard-4-preview" style="
                            width: 120px !important;
                            height: 80px !important;
                            background: linear-gradient(90deg, #3b82f6 25%, #10b981 25%, #10b981 50%, #f59e0b 50%, #f59e0b 75%, #ef4444 75%),
                                        linear-gradient(#8b5cf6 1px, transparent 1px) !important;
                            background-size: 100% 50%, 30px 30px !important;
                            border-radius: 4px !important;
                            margin-bottom: 10px !important;
                            position: relative !important;
                            overflow: hidden !important;
                        "></div>
                        <span style="
                            font-weight: 500 !important;
                            color: #374151 !important;
                            text-align: center !important;
                        ">Dashboard 4</span>
                    </div>
                    <div class="template-option" data-template="dashboard-6" style="
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        padding: 20px !important;
                        border: 2px solid #e5e7eb !important;
                        border-radius: 8px !important;
                        cursor: pointer !important;
                        transition: all 0.3s ease !important;
                        background: #f9fafb !important;
                    ">
                        <div class="template-preview dashboard-6-preview" style="
                            width: 120px !important;
                            height: 80px !important;
                            background: #e5e7eb !important;
                            border-radius: 4px !important;
                            margin-bottom: 10px !important;
                            position: relative !important;
                            overflow: hidden !important;
                        "></div>
                        <span style="
                            font-weight: 500 !important;
                            color: #374151 !important;
                            text-align: center !important;
                        ">Dashboard 6</span>
                    </div>
                    <div class="template-option" data-template="dashboard-8" style="
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        padding: 20px !important;
                        border: 2px solid #e5e7eb !important;
                        border-radius: 8px !important;
                        cursor: pointer !important;
                        cursor: pointer !important;
                        transition: all 0.3s ease !important;
                        background: #f9fafb !important;
                    ">
                        <div class="template-preview dashboard-8-preview" style="
                            width: 120px !important;
                            height: 80px !important;
                            background: #e5e7eb !important;
                            border-radius: 4px !important;
                            margin-bottom: 10px !important;
                            position: relative !important;
                            overflow: hidden !important;
                        "></div>
                        <span style="
                            font-weight: 500 !important;
                            color: #374151 !important;
                            text-align: center !important;
                        ">Dashboard 8</span>
                    </div>
                    <div class="template-option" data-template="dashboard-12" style="
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        padding: 20px !important;
                        border: 2px solid #e5e7eb !important;
                        border-radius: 8px !important;
                        cursor: pointer !important;
                        transition: all 0.3s ease !important;
                        background: #f9fafb !important;
                    ">
                        <div class="template-preview dashboard-12-preview" style="
                            width: 120px !important;
                            height: 80px !important;
                            background: #e5e7eb !important;
                            border-radius: 4px !important;
                            margin-bottom: 10px !important;
                            position: relative !important;
                            overflow: hidden !important;
                        "></div>
                        <span style="
                            font-weight: 500 !important;
                            color: #374151 !important;
                            text-align: center !important;
                        ">Dashboard 12</span>
                    </div>
                </div>
                <button class="btn btn-secondary" id="cancelTemplate" style="
                    padding: 10px 20px !important;
                    border-radius: 6px !important;
                    border: 1px solid #6b7280 !important;
                    background: #6b7280 !important;
                    color: white !important;
                    cursor: pointer !important;
                ">Cancelar</button>
            </div>
        `;

        // Añadir estilos inline para asegurar que se vea
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.5) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 10000 !important;
        `;

        document.body.appendChild(modal);

        // Event listeners para plantillas
        modal.querySelectorAll('.template-option').forEach(option => {
            option.addEventListener('click', () => {
                const template = option.dataset.template;
                this.applyTemplate(template);
                document.body.removeChild(modal);
            });
        });

        modal.querySelector('#cancelTemplate').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

    },

    // Función para aplicar plantilla seleccionada
    applyTemplate(templateName) {
        
        const widgets = Array.from(this.widgets.values());
        if (widgets.length === 0) return;

        // Definir layouts de plantillas
        const templates = {
            'grid-2x2': {
                columns: 2,
                rows: 2,
                positions: [
                    { row: 1, col: 1, size: 'medium' },
                    { row: 1, col: 2, size: 'medium' },
                    { row: 2, col: 1, size: 'medium' },
                    { row: 2, col: 2, size: 'medium' }
                ]
            },
            'grid-3x3': {
                columns: 3,
                rows: 3,
                positions: [
                    { row: 1, col: 1, size: 'small' },
                    { row: 1, col: 2, size: 'small' },
                    { row: 1, col: 3, size: 'small' },
                    { row: 2, col: 1, size: 'small' },
                    { row: 2, col: 2, size: 'small' },
                    { row: 2, col: 3, size: 'small' },
                    { row: 3, col: 1, size: 'small' },
                    { row: 3, col: 2, size: 'small' },
                    { row: 3, col: 3, size: 'small' }
                ]
            },
            'dashboard-4': {
                columns: 4,
                rows: 2,
                positions: [
                    { row: 1, col: 1, size: 'card' },
                    { row: 1, col: 2, size: 'card' },
                    { row: 1, col: 3, size: 'card' },
                    { row: 1, col: 4, size: 'card' },
                    { row: 2, col: 1, colSpan: 2, size: 'wide' },
                    { row: 2, col: 3, colSpan: 2, size: 'wide' }
                ]
            },
            'dashboard-6': {
                columns: 6,
                rows: 2,
                positions: [
                    { row: 1, col: 1, colSpan: 2, size: 'medium' },
                    { row: 1, col: 3, colSpan: 2, size: 'medium' },
                    { row: 1, col: 4, colSpan: 2, size: 'medium' },
                    { row: 2, col: 1, colSpan: 3, size: 'wide' },
                    { row: 2, col: 4, colSpan: 3, size: 'wide' }
                ]
            },
            'dashboard-8': {
                columns: 4,
                rows: 4,
                positions: [
                    { row: 1, col: 1, colSpan: 2, size: 'wide' },
                    { row: 1, col: 3, colSpan: 2, size: 'wide' },
                    { row: 2, col: 1, size: 'medium' },
                    { row: 2, col: 2, size: 'medium' },
                    { row: 2, col: 3, size: 'medium' },
                    { row: 2, col: 4, size: 'medium' },
                    { row: 3, col: 1, colSpan: 4, size: 'wide' },
                    { row: 4, col: 1, colSpan: 2, size: 'medium' },
                    { row: 4, col: 3, colSpan: 2, size: 'medium' }
                ]
            },
            'dashboard-12': {
                columns: 6,
                rows: 4,
                positions: [
                    { row: 1, col: 1, colSpan: 3, size: 'wide' },
                    { row: 1, col: 4, colSpan: 3, size: 'wide' },
                    { row: 2, col: 1, colSpan: 2, size: 'medium' },
                    { row: 2, col: 3, colSpan: 2, size: 'medium' },
                    { row: 2, col: 5, colSpan: 2, size: 'medium' },
                    { row: 3, col: 1, size: 'small' },
                    { row: 3, col: 2, size: 'small' },
                    { row: 3, col: 3, size: 'small' },
                    { row: 3, col: 4, size: 'small' },
                    { row: 3, col: 5, size: 'small' },
                    { row: 3, col: 6, size: 'small' },
                    { row: 4, col: 1, colSpan: 6, size: 'wide' }
                ]
            }
        };

        const template = templates[templateName];
        if (!template) return;

        // Aplicar layout de la plantilla
        widgets.forEach((widgetData, index) => {
            const widget = widgetData.element;
            const position = template.positions[index];
            
            if (position) {
                // Aplicar posición
                widget.style.gridRow = `${position.row} / span 1`;
                widget.style.gridColumn = position.colSpan ? 
                    `${position.col} / span ${position.colSpan}` : 
                    `${position.col} / span 1`;
                
                // Aplicar tamaño
                widget.className = widget.className.replace(/widget-size-\w+/g, '') + ` widget-size-${position.size}`;
            }
        });

        // Ajustar el grid
        this.adjustGridSize();
        this.forceGridPatternUpdate();
        
        this.showNotification(`Plantilla "${templateName}" aplicada exitosamente`, 'success');
    },

    // Función para limpiar el dashboard
    clearLayout() {
        const widgets = Array.from(this.widgets.values());
        if (widgets.length === 0) return;

        // Confirmar antes de limpiar
        if (!confirm('¿Estás seguro de que quieres eliminar todos los widgets del dashboard?')) {
            return;
        }

        // Eliminar todos los widgets
        widgets.forEach(widgetData => {
            this.removeWidget(widgetData.id);
        });

        // Limpiar el grid
        const canvas = document.getElementById('canvasGrid');
        if (canvas) {
            canvas.innerHTML = '';
            canvas.style.minHeight = '800px';
        }

        this.showNotification('Dashboard limpiado exitosamente', 'success');
    },

    // Función para configurar observer del grid
    setupGridObserver() {
        const canvas = document.getElementById('canvasGrid');
        if (!canvas || this.gridObserver) return;

        // Crear observer para detectar cambios en el grid
        this.gridObserver = new MutationObserver((mutations) => {
            let shouldAdjust = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Se añadió o eliminó un widget
                    shouldAdjust = true;
                } else if (mutation.type === 'attributes' && 
                          (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    // Cambió el estilo o clase de un widget
                    shouldAdjust = true;
                }
            });

            if (shouldAdjust) {
                // Ajustar el grid después de un breve delay
                setTimeout(() => {
                    this.adjustGridSize();
                }, 100);
            }
        });

        // Configurar observer
        this.gridObserver.observe(canvas, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    },

    // Función para ajustar el scroll para mostrar un widget específico
    adjustScrollToWidget(widgetId) {
        const widget = this.widgets.get(widgetId)?.element;
        if (!widget) return;

        const canvas = document.querySelector('.dashboard-canvas');
        if (!canvas) return;

        // Calcular la posición del widget
        const widgetRect = widget.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        // Si el widget está fuera de la vista, hacer scroll hacia él
        if (widgetRect.bottom > canvasRect.bottom || widgetRect.top < canvasRect.top) {
            setTimeout(() => {
                widget.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest',
                    inline: 'nearest'
                });
            }, 100);
        }
    },

    // Función para ajustar el scroll para mostrar todos los widgets
    adjustScrollToShowAllWidgets() {
        const canvas = document.querySelector('.dashboard-canvas');
        if (!canvas) return;

        // Hacer scroll hacia arriba para mostrar todo el contenido
        setTimeout(() => {
            canvas.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }, 200);
    },

    // Función para redimensionar gráficos de un widget específico - MEJORADA Y CORREGIDA
    resizeWidgetCharts(widget) {
        if (!widget || !window.Plotly) return;
        
        const plotlyElements = widget.querySelectorAll('.plotly-graph-div');
        if (plotlyElements.length === 0) return;
        
        // Obtener dimensiones reales del contenido del widget
        const contentElement = widget.querySelector('.widget-content');
        if (!contentElement) return;
        
                    const widgetType = widget.dataset.widgetType;
        const contentRect = contentElement.getBoundingClientRect();
        
        // Calcular dimensiones del gráfico restando padding
        const padding = 20; // Padding total (10px cada lado)
        const chartWidth = Math.max(200, Math.floor(contentRect.width - padding));
        const chartHeight = Math.max(150, Math.floor(contentRect.height - padding));
        
        
        plotlyElements.forEach(element => {
            try {
                // Calcular márgenes apropiados según el tipo de widget
                let margins;
                
                // Usar funciones existentes si están disponibles
                if (widgetType === 'pca-biplot' && typeof this.calculateBiplotMargins === 'function') {
                    margins = this.calculateBiplotMargins(chartWidth, chartHeight);
                } else if (typeof this.calculateStandardMargins === 'function') {
                    margins = this.calculateStandardMargins(chartWidth, chartHeight);
                    } else {
                    // Fallback: usar función nueva
                    margins = this.calculateMarginsForWidget(widgetType, chartWidth, chartHeight);
                }
                
                // Aplicar nuevo tamaño y márgenes usando relayout
                    Plotly.relayout(element, {
                        width: chartWidth,
                        height: chartHeight,
                    margin: margins,
                    autosize: false
                }).then(() => {
                    // Forzar resize después de relayout para asegurar que se aplique
                    setTimeout(() => {
                        Plotly.Plots.resize(element);
                    }, 50);
                }).catch(error => {
                    // Fallback: intentar solo resize
                    Plotly.Plots.resize(element);
                });
                
                } catch (error) {
                }
        });
    },
    
    // Función auxiliar para calcular márgenes según tipo de widget
    calculateMarginsForWidget(widgetType, width, height) {
        // Márgenes base proporcionales al tamaño
        const scale = Math.min(width / 400, height / 300, 1);
        
        switch(widgetType) {
            case 'pca-biplot':
                return {
                    l: Math.max(50, Math.round(60 * scale)),
                    r: Math.max(100, Math.round(120 * scale)),
                    t: Math.max(60, Math.round(80 * scale)),
                    b: Math.max(50, Math.round(60 * scale))
                };
            case 'scatter':
                return {
                    l: Math.max(60, Math.round(70 * scale)),
                    r: Math.max(60, Math.round(80 * scale)),
                    t: Math.max(80, Math.round(100 * scale)),
                    b: Math.max(60, Math.round(70 * scale))
                };
            case 'histogram':
            case 'boxplot':
                return {
                    l: Math.max(60, Math.round(70 * scale)),
                    r: Math.max(70, Math.round(90 * scale)),
                    t: Math.max(70, Math.round(90 * scale)),
                    b: Math.max(60, Math.round(70 * scale))
                };
            case 'pie':
            case 'density':
            case 'violin':
                return {
                    l: Math.max(50, Math.round(60 * scale)),
                    r: Math.max(80, Math.round(100 * scale)),
                    t: Math.max(60, Math.round(80 * scale)),
                    b: Math.max(50, Math.round(60 * scale))
                };
            default:
                return {
                    l: Math.max(50, Math.round(60 * scale)),
                    r: Math.max(50, Math.round(70 * scale)),
                    t: Math.max(70, Math.round(90 * scale)),
                    b: Math.max(50, Math.round(60 * scale))
                };
        }
    },
    
    // ===== FUNCIONES PARA MÚLTIPLES DASHBOARDS =====
    
    createNewDashboard() {
        const name = prompt('Ingresa el nombre del nuevo dashboard:');
        if (!name || name.trim() === '') {
            return;
        }
        
        const dashboardId = `dashboard-${++this.dashboardCounter}`;
        const dashboard = {
            id: dashboardId,
            name: name.trim(),
            widgets: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.dashboards.set(dashboardId, dashboard);
        this.currentDashboardId = dashboardId;
        
        // Limpiar widgets actuales
        this.clearLayout();
        
        // Actualizar selector
        this.updateDashboardSelector();
        this.saveDashboardsToStorage();
        
        this.showNotification(`Dashboard "${name}" creado exitosamente`, 'success');
    },
    
    switchDashboard(dashboardId) {
        if (!dashboardId || dashboardId === '') {
            return;
        }
        
        // Guardar dashboard actual antes de cambiar
        if (this.currentDashboardId) {
            this.saveCurrentDashboardState();
        }
        
        // Cargar nuevo dashboard
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            this.showNotification('Dashboard no encontrado', 'error');
            return;
        }
        
        this.currentDashboardId = dashboardId;
        
        // Limpiar widgets actuales
        this.clearLayout();
        
        // Cargar widgets del dashboard
        dashboard.widgets.forEach(widgetData => {
            this.createWidgetFromLayout(widgetData);
        });
        
        this.showNotification(`Dashboard "${dashboard.name}" cargado`, 'success');
    },
    
    renameCurrentDashboard() {
        if (!this.currentDashboardId) {
            this.showNotification('No hay dashboard seleccionado', 'warning');
            return;
        }
        
        const dashboard = this.dashboards.get(this.currentDashboardId);
        if (!dashboard) {
            return;
        }
        
        const newName = prompt('Ingresa el nuevo nombre del dashboard:', dashboard.name);
        if (!newName || newName.trim() === '') {
            return;
        }
        
        dashboard.name = newName.trim();
        dashboard.updatedAt = new Date().toISOString();
        
        this.updateDashboardSelector();
        this.saveDashboardsToStorage();
        
        this.showNotification(`Dashboard renombrado a "${newName}"`, 'success');
    },
    
    deleteCurrentDashboard() {
        if (!this.currentDashboardId) {
            this.showNotification('No hay dashboard seleccionado', 'warning');
            return;
        }
        
        const dashboard = this.dashboards.get(this.currentDashboardId);
        if (!dashboard) {
            return;
        }
        
        if (!confirm(`¿Estás seguro de eliminar el dashboard "${dashboard.name}"?`)) {
            return;
        }
        
        this.dashboards.delete(this.currentDashboardId);
        this.currentDashboardId = null;
        
        // Limpiar widgets
        this.clearLayout();
        
        // Seleccionar primer dashboard disponible o crear uno nuevo
        if (this.dashboards.size > 0) {
            const firstDashboard = Array.from(this.dashboards.values())[0];
            this.switchDashboard(firstDashboard.id);
                    } else {
            this.updateDashboardSelector();
        }
        
        this.saveDashboardsToStorage();
        this.showNotification(`Dashboard "${dashboard.name}" eliminado`, 'info');
    },
    
    updateDashboardSelector() {
        const selector = document.getElementById('dashboardSelector');
        if (!selector) return;
        
        selector.innerHTML = '<option value="">Seleccionar Dashboard...</option>';
        
        this.dashboards.forEach((dashboard, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = dashboard.name;
            if (id === this.currentDashboardId) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
    },
    
    saveCurrentDashboardState() {
        if (!this.currentDashboardId) return;
        
        const dashboard = this.dashboards.get(this.currentDashboardId);
        if (!dashboard) return;
        
        // Guardar estado actual de widgets
        dashboard.widgets = Array.from(this.widgets.entries()).map(([id, data]) => ({
            id,
            type: data.type,
            config: data.config,
            position: {
                gridColumn: data.element.style.gridColumn,
                gridRow: data.element.style.gridRow,
                size: data.config.size || 'medium'
            }
        }));
        
        dashboard.updatedAt = new Date().toISOString();
        this.saveDashboardsToStorage();
    },
    
    saveLayout() {
        // Si hay un dashboard actual, guardar su estado
        if (this.currentDashboardId) {
            this.saveCurrentDashboardState();
            const dashboard = this.dashboards.get(this.currentDashboardId);
            this.showNotification(`Dashboard "${dashboard.name}" guardado exitosamente`, 'success');
        } else {
            // Si no hay dashboard, crear uno nuevo automáticamente
            const name = prompt('Ingresa un nombre para este dashboard:', `Dashboard ${new Date().toLocaleDateString()}`);
            if (name && name.trim() !== '') {
                const dashboardId = `dashboard-${++this.dashboardCounter}`;
                const dashboard = {
                    id: dashboardId,
                    name: name.trim(),
                    widgets: Array.from(this.widgets.entries()).map(([id, data]) => ({
                        id,
                        type: data.type,
                        config: data.config,
                        position: {
                            gridColumn: data.element.style.gridColumn,
                            gridRow: data.element.style.gridRow,
                            size: data.config.size || 'medium'
                        }
                    })),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                this.dashboards.set(dashboardId, dashboard);
                this.currentDashboardId = dashboardId;
                this.updateDashboardSelector();
                this.saveDashboardsToStorage();
                this.showNotification(`Dashboard "${name}" guardado exitosamente`, 'success');
            }
        }
    },
    
    loadLayout() {
        // Mostrar selector de dashboards si hay múltiples
        if (this.dashboards.size === 0) {
            this.showNotification('No hay dashboards guardados', 'warning');
            return;
        }
        
        if (this.dashboards.size === 1) {
            // Si solo hay uno, cargarlo directamente
            const dashboard = Array.from(this.dashboards.values())[0];
            this.switchDashboard(dashboard.id);
        } else {
            // Si hay múltiples, mostrar selector
            const dashboardId = prompt('Selecciona el dashboard a cargar:\n' + 
                Array.from(this.dashboards.values()).map((d, i) => `${i + 1}. ${d.name}`).join('\n') +
                '\n\nIngresa el número:');
            
            if (dashboardId) {
                const index = parseInt(dashboardId) - 1;
                const dashboards = Array.from(this.dashboards.values());
                if (index >= 0 && index < dashboards.length) {
                    this.switchDashboard(dashboards[index].id);
                }
            }
        }
    },
    
    loadDashboardsFromStorage() {
        try {
            const saved = localStorage.getItem('dashboards');
            if (saved) {
                const dashboardsData = JSON.parse(saved);
                dashboardsData.forEach(dashboard => {
                    this.dashboards.set(dashboard.id, dashboard);
                });
                this.dashboardCounter = Math.max(...Array.from(this.dashboards.values()).map(d => {
                    const match = d.id.match(/\d+$/);
                    return match ? parseInt(match[0]) : 0;
                }), 0);
                this.updateDashboardSelector();
            }
        } catch (error) {
        }
    },
    
    saveDashboardsToStorage() {
        try {
            const dashboardsArray = Array.from(this.dashboards.values());
            localStorage.setItem('dashboards', JSON.stringify(dashboardsArray));
        } catch (error) {
        }
    },
    
    initializeCurrentDashboard() {
        // Si no hay dashboard actual, crear uno por defecto
        if (this.dashboards.size === 0) {
            const dashboardId = `dashboard-${++this.dashboardCounter}`;
            const dashboard = {
                id: dashboardId,
                name: 'Dashboard Principal',
                widgets: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.dashboards.set(dashboardId, dashboard);
            this.currentDashboardId = dashboardId;
            this.saveDashboardsToStorage();
        } else if (!this.currentDashboardId) {
            // Si hay dashboards pero no hay uno seleccionado, seleccionar el primero
            const firstDashboard = Array.from(this.dashboards.values())[0];
            this.currentDashboardId = firstDashboard.id;
        }
        
        this.updateDashboardSelector();
    },
};


        // Configurar redimensionamiento global cuando se carga el módulo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.resultsModule.setupGlobalResizeHandler();
                window.resultsModule.setupGridObserver();
                // Forzar redimensionamiento inicial de todos los gráficos
                setTimeout(() => {
                    window.resultsModule.redimensionarTodosLosGraficos();
                }, 1000);
            });
        } else {
            window.resultsModule.setupGlobalResizeHandler();
            window.resultsModule.setupGridObserver();
            // Forzar redimensionamiento inicial de todos los gráficos
            setTimeout(() => {
                window.resultsModule.redimensionarTodosLosGraficos();
            }, 1000);
        }

        // Añadir listener para detectar cambios de tamaño de widgets
        document.addEventListener('DOMContentLoaded', () => {
            // Observer para detectar cambios en el tamaño de widgets
            const resizeObserver = new ResizeObserver((entries) => {
                entries.forEach(entry => {
                    const widget = entry.target.closest('.dashboard-widget');
                    if (widget) {
                        // Redimensionar gráficos del widget
                        window.resultsModule.resizeWidgetCharts(widget);
                    }
                });
            });

            // Observar todos los widgets existentes
            document.querySelectorAll('.dashboard-widget').forEach(widget => {
                resizeObserver.observe(widget);
            });

            // Observar widgets que se añadan en el futuro
            const widgetObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && 
                            node.classList.contains('dashboard-widget')) {
                            resizeObserver.observe(node);
                            // Forzar actualización del patrón de cuadrícula
                            setTimeout(() => {
                                window.resultsModule.forceGridPatternUpdate();
                            }, 100);
                        }
                    });
                });
            });

            widgetObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
