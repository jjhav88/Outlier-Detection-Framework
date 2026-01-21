// JS logic of the preprocess tab

const preprocessModule = {
    app: null,
    currentDataset: null,
    originalDataset: null,
    processedDataset: null,
    preprocessingSteps: [],

    init(app) {
        this.app = app;
        this.currentDataset = null;
        this.originalDataset = null;
        this.processedDataset = null;
        this.preprocessingSteps = [];
        
        this.setupEventListeners();
        this.loadAvailableDatasets();
        
        // Inicializar el panel de conversión de tipos de datos como inactivo
        this.initializeDataTypesPanel();
        
    },

    setupEventListeners() {
        
        // Los event listeners para los botones de selección se configurarán dinámicamente

        // Missing values strategy change
        const missingValuesStrategy = document.getElementById('missingValuesStrategy');
        const constantValueDiv = document.getElementById('constantValueDiv');
        
        if (missingValuesStrategy) {
            missingValuesStrategy.addEventListener('change', (e) => {
                if (e.target.value === 'fill_constant') {
                    constantValueDiv.style.display = 'block';
                } else {
                    constantValueDiv.style.display = 'none';
                }
            });
        }

        // Preprocessing action buttons
        const handleMissingValuesBtn = document.getElementById('handleMissingValuesBtn');
        const handleDuplicatesBtn = document.getElementById('handleDuplicatesBtn');
        const handleOutliersBtn = document.getElementById('handleOutliersBtn');
        const handleDataTypesBtn = document.getElementById('handleDataTypesBtn');
        
        if (handleMissingValuesBtn) {
            handleMissingValuesBtn.addEventListener('click', () => this.handleMissingValues());
        }
        
        if (handleDuplicatesBtn) {
            handleDuplicatesBtn.addEventListener('click', () => this.handleDuplicates());
        }
        
        if (handleOutliersBtn) {
            handleOutliersBtn.addEventListener('click', () => this.handleOutliers());
        }
        
        if (handleDataTypesBtn) {
            handleDataTypesBtn.addEventListener('click', () => this.handleDataTypes());
        }

        // Apply all changes
        const applyAllChangesBtn = document.getElementById('applyAllChangesBtn');
        
        if (applyAllChangesBtn) {
            applyAllChangesBtn.addEventListener('click', () => this.applyAllChanges());
        }

        // Save processed dataset
        const saveProcessedDatasetBtn = document.getElementById('saveProcessedDatasetBtn');
        
        if (saveProcessedDatasetBtn) {
            saveProcessedDatasetBtn.addEventListener('click', () => this.saveProcessedDataset());
        }

        // Data types conversion switch
        const activateDataTypesSwitch = document.getElementById('activateDataTypesSwitch');
        
        if (activateDataTypesSwitch) {
            activateDataTypesSwitch.addEventListener('change', (e) => {
                this.toggleDataTypesConversion(e.target.checked);
            });
        }

    },

    async updateContent(app) {
        
        // Solo actualizar si la app tiene datasets
        if (app && app.datasets) {
            this.app = app;
            await this.loadAvailableDatasets();
            this.setupEventListeners();
        } else {
        }
    },

    async loadAvailableDatasets() {
        try {
            
            const datasets = Object.values(this.app.datasets);
            
            const container = document.getElementById('preprocessDatasetSelectionContainer');
            
            if (!container) {
                return;
            }
            
            if (datasets.length === 0) {
                container.innerHTML = `
                    <div class="no-datasets-message">
                        <i class="fas fa-database"></i>
                        <h5>No hay datasets disponibles</h5>
                        <p>Primero debes cargar un dataset en la pestaña "Cargar Datos"</p>
                        <a href="#" onclick="window.anoutApp.switchTab('load-data')" class="btn btn-primary">
                            <i class="fas fa-upload me-2"></i>
                            Ir a Cargar Datos
                        </a>
                    </div>
                `;
                return;
            }
            
            // Crear grid de paneles de datasets
            const gridHtml = datasets.map(dataset => this.createDatasetPanel(dataset)).join('');
            container.innerHTML = `
                <div class="row g-3">
                    ${gridHtml}
                </div>
            `;
            
            // Configurar event listeners para los botones de selección
            this.setupDatasetSelectionListeners();
            
        } catch (error) {
        }
    },

    createDatasetPanel(dataset) {
        const fileTypeIcon = this.getFileTypeIcon(dataset.filename);
        const uploadDate = this.app.formatDate(dataset.uploaded_at);
        const isSelected = this.app.selectedDataset === dataset.filename;
        const isProcessed = dataset.is_processed || false;
        
        // Información adicional para datasets procesados
        let processedInfo = '';
        if (isProcessed) {
            const originalRows = dataset.original_rows || dataset.rows;
            const rowsRemoved = dataset.rows_removed || 0;
            const processingSteps = dataset.processing_steps || [];
            
            processedInfo = `
                <div class="mt-2 p-2 bg-light rounded">
                    <div class="d-flex align-items-center mb-1">
                        <i class="fas fa-cogs text-success me-2"></i>
                        <small class="text-success fw-bold">Dataset Procesado</small>
                    </div>
                    <div class="row text-center">
                        <div class="col-6">
                            <small class="text-muted">Original: ${originalRows.toLocaleString()}</small>
                        </div>
                        <div class="col-6">
                            <small class="text-muted">Eliminadas: ${rowsRemoved.toLocaleString()}</small>
                        </div>
                    </div>
                    
                </div>
            `;
        }
        
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card dataset-selection-panel ${isSelected ? 'selected' : ''} ${isProcessed ? 'processed-dataset' : ''}" data-filename="${dataset.filename}">
                    <div class="card-body">
                        <div class="dataset-info">
                            <div class="dataset-name">
                                <span class="file-type-icon ${fileTypeIcon.class} me-2">${fileTypeIcon.icon}</span>
                                ${dataset.filename}
                                ${isProcessed ? '<span class="badge bg-success ms-2"><i class="fas fa-check"></i></span>' : ''}
                            </div>
                            <div class="dataset-stats">
                                <div class="stat-item">
                                    <div class="stat-value">${dataset.rows.toLocaleString()}</div>
                                    <div class="stat-label">Filas</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${dataset.columns}</div>
                                    <div class="stat-label">Columnas</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${this.calculateDataQuality(dataset)}%</div>
                                    <div class="stat-label">Calidad</div>
                                </div>
                            </div>
                            <div class="text-muted small">
                                <i class="fas fa-clock me-1"></i>
                                ${uploadDate}
                            </div>
                            ${processedInfo}
                        </div>
                        <button class="btn btn-outline-primary select-button" data-filename="${dataset.filename}">
                            ${isSelected ? '<i class="fas fa-check me-2"></i>Seleccionado' : '<i class="fas fa-mouse-pointer me-2"></i>Seleccionar'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    setupDatasetSelectionListeners() {
        // Event listeners para los paneles de datasets
        document.querySelectorAll('.dataset-selection-panel').forEach(panel => {
            panel.addEventListener('click', (e) => {
                if (!e.target.classList.contains('select-button')) {
                    const filename = panel.dataset.filename;
                    this.selectDataset(filename);
                }
            });
        });

        // Event listeners para los botones de selección
        document.querySelectorAll('.select-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const filename = button.dataset.filename;
                this.selectDataset(filename);
            });
        });
    },

    async selectDataset(filename) {
        try {
            
            // Actualizar selección global
            this.app.selectedDataset = filename;
            
            // Get dataset details
            const dataset = await this.app.getDatasetDetails(filename);
            
            this.currentDataset = dataset;
            this.originalDataset = JSON.parse(JSON.stringify(dataset)); // Deep copy
            this.processedDataset = JSON.parse(JSON.stringify(dataset)); // Deep copy
            this.preprocessingSteps = [];
            
            // Actualizar UI de selección
            this.updateDatasetSelectionUI();
            
            // Mostrar secciones de análisis
            document.getElementById('currentStateSection').style.display = 'block';
            document.getElementById('preprocessingToolsSection').style.display = 'block';
            
            // Actualizar dashboards
            this.updateCurrentStateDashboard();
            this.updateFinalStateDashboard();
            
            // Actualizar indicador de dataset seleccionado
            this.updateSelectedDatasetIndicator();
            
            // Cargar variables en el selector de conversión de tipos
            this.loadVariablesForConversion();
            
            this.app.showSuccess(`Dataset "${filename}" seleccionado para análisis`);
            
        } catch (error) {
            this.app.showError(`Error al seleccionar el dataset: ${error.message}`);
        }
    },

    updateDatasetSelectionUI() {
        // Actualizar estado visual de los paneles
        document.querySelectorAll('.dataset-selection-panel').forEach(panel => {
            const filename = panel.dataset.filename;
            const isSelected = this.app.selectedDataset === filename;
            
            panel.classList.toggle('selected', isSelected);
            
            const button = panel.querySelector('.select-button');
            if (button) {
                if (isSelected) {
                    button.innerHTML = '<i class="fas fa-check me-2"></i>Seleccionado';
                    button.classList.remove('btn-outline-primary');
                    button.classList.add('btn-primary');
                } else {
                    button.innerHTML = '<i class="fas fa-mouse-pointer me-2"></i>Seleccionar';
                    button.classList.remove('btn-primary');
                    button.classList.add('btn-outline-primary');
                }
            }
        });
    },

    updateSelectedDatasetIndicator() {
        const indicator = document.getElementById('selectedDatasetName');
        if (indicator && this.app.selectedDataset) {
            indicator.textContent = this.app.selectedDataset;
            indicator.style.display = 'inline-block';
        }
    },

    getFileTypeIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        if (extension === 'csv') {
            return { icon: '<i class="fas fa-file-csv"></i>', class: 'file-type-csv' };
        } else {
            return { icon: '<i class="fas fa-file-excel"></i>', class: 'file-type-excel' };
        }
    },

    calculateDataQuality(dataset) {
        const stats = dataset.summary_stats || {};
        const totalCells = dataset.rows * dataset.columns;
        const totalMissing = Object.values(stats).reduce((sum, stat) => sum + (stat.missing_values || 0), 0);
        
        const quality = ((totalCells - totalMissing) / totalCells) * 100;
        return Math.round(quality);
    },

    updateCurrentStateDashboard() {
        if (!this.currentDataset) return;
        
        const container = document.getElementById('currentStateCards');
        // Usar el dataset original para mostrar el estado actual
        const datasetToShow = this.originalDataset || this.currentDataset;
        const stats = datasetToShow.summary_stats || {};
        
        const totalRows = datasetToShow.rows;
        const totalColumns = datasetToShow.columns;
        const totalMissing = Object.values(stats).reduce((sum, stat) => sum + (stat.missing_values || 0), 0);
        const totalDuplicates = 0; // Will be calculated when needed
        
        container.innerHTML = `
            <div class="col-md-3 mb-3">
                <div class="card stat-card">
                    <div class="card-body text-center">
                        <div class="stat-icon">
                            <i class="fas fa-table"></i>
                        </div>
                        <div class="stat-value">${totalRows.toLocaleString()}</div>
                        <div class="stat-label">Filas</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card stat-card">
                    <div class="card-body text-center">
                        <div class="stat-icon">
                            <i class="fas fa-columns"></i>
                        </div>
                        <div class="stat-value">${totalColumns}</div>
                        <div class="stat-label">Columnas</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card stat-card warning">
                    <div class="card-body text-center">
                        <div class="stat-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-value">${totalMissing.toLocaleString()}</div>
                        <div class="stat-label">Valores Faltantes</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card stat-card info">
                    <div class="card-body text-center">
                        <div class="stat-icon">
                            <i class="fas fa-copy"></i>
                        </div>
                        <div class="stat-value">${totalDuplicates}</div>
                        <div class="stat-label">Duplicados</div>
                    </div>
                </div>
            </div>
        `;
    },

    updateFinalStateDashboard() {
        if (!this.processedDataset) return;
        
        const container = document.getElementById('finalStateCards');
        const stats = this.processedDataset.summary_stats || {};
        
        const totalRows = this.processedDataset.rows;
        const totalColumns = this.processedDataset.columns;
        const totalMissing = Object.values(stats).reduce((sum, stat) => sum + (stat.missing_values || 0), 0);
        const originalRows = this.processedDataset.original_rows || totalRows;
        const rowsRemoved = this.processedDataset.rows_removed || 0;
        const dataQuality = this.calculateDataQuality();
        
        container.innerHTML = `
            <div class="col-md-3 mb-3">
                <div class="card stat-card">
                    <div class="card-body text-center">
                        <div class="stat-icon">
                            <i class="fas fa-table"></i>
                        </div>
                        <div class="stat-value">${totalRows.toLocaleString()}</div>
                        <div class="stat-label">Filas Finales</div>
                        <small class="text-muted">Original: ${originalRows.toLocaleString()}</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card stat-card">
                    <div class="card-body text-center">
                        <div class="stat-icon">
                            <i class="fas fa-columns"></i>
                        </div>
                        <div class="stat-value">${totalColumns}</div>
                        <div class="stat-label">Columnas Finales</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card stat-card warning">
                    <div class="card-body text-center">
                        <div class="stat-icon">
                            <i class="fas fa-minus-circle"></i>
                        </div>
                        <div class="stat-value">${rowsRemoved.toLocaleString()}</div>
                        <div class="stat-label">Filas Eliminadas</div>
                        <small class="text-muted">${rowsRemoved > 0 ? `${((rowsRemoved/originalRows)*100).toFixed(1)}%` : '0%'}</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card stat-card info">
                    <div class="card-body text-center">
                        <div class="stat-icon">
                            <i class="fas fa-percentage"></i>
                        </div>
                        <div class="stat-value">${dataQuality}%</div>
                        <div class="stat-label">Calidad de Datos</div>
                    </div>
                </div>
            </div>
        `;
        
        // Sección de pasos de preprocesamiento eliminada por solicitud del usuario
    },

    calculateDataQuality() {
        if (!this.processedDataset) return 0;
        
        const stats = this.processedDataset.summary_stats || {};
        const totalCells = this.processedDataset.rows * this.processedDataset.columns;
        const totalMissing = Object.values(stats).reduce((sum, stat) => sum + (stat.missing_values || 0), 0);
        
        const quality = ((totalCells - totalMissing) / totalCells) * 100;
        return Math.round(quality);
    },

    getStepDescription(step) {
        const stepType = step.type;
        switch (stepType) {
            case 'missing_values':
                return 'Manejo de Valores Faltantes';
            case 'duplicates':
                return 'Manejo de Duplicados';
            case 'outliers':
                return 'Manejo de Outliers';
            case 'data_types':
                return 'Conversión de Tipos de Datos';
            default:
                return 'Paso de Preprocesamiento';
        }
    },

    getStepDetails(step) {
        const stepType = step.type;
        switch (stepType) {
            case 'missing_values':
                const strategy = step.strategy;
                switch (strategy) {
                    case 'drop':
                        return 'Eliminar filas con valores faltantes';
                    case 'fill_mean':
                        return 'Rellenar con media (variables numéricas)';
                    case 'fill_median':
                        return 'Rellenar con mediana (variables numéricas)';
                    case 'fill_mode':
                        return 'Rellenar con moda (variables cualitativas)';
                    case 'fill_constant':
                        return `Rellenar con valor constante: ${step.constant_value || 'N/A'}`;
                    default:
                        return `Estrategia: ${strategy}`;
                }
            case 'duplicates':
                const dupStrategy = step.strategy;
                switch (dupStrategy) {
                    case 'drop':
                        return 'Eliminar todas las filas duplicadas';
                    case 'keep_first':
                        return 'Mantener primera ocurrencia de duplicados';
                    case 'keep_last':
                        return 'Mantener última ocurrencia de duplicados';
                    default:
                        return `Estrategia: ${dupStrategy}`;
                }
            case 'outliers':
                return `Método: ${step.method || 'N/A'}, Estrategia: ${step.strategy || 'N/A'}`;
            case 'data_types':
                return `Variable: ${step.variable || 'N/A'}, Tipo: ${step.target_type || 'N/A'}`;
            default:
                return 'Detalles no disponibles';
        }
    },

    loadVariablesForConversion() {
        if (!this.currentDataset || !this.currentDataset.summary_stats) return;
        
        const variableSelect = document.getElementById('variableToConvert');
        if (!variableSelect) return;
        
        // Limpiar opciones existentes
        variableSelect.innerHTML = '<option value="">Selecciona una variable...</option>';
        
        // Agregar variables del dataset
        Object.keys(this.currentDataset.summary_stats).forEach(variableName => {
            const option = document.createElement('option');
            option.value = variableName;
            option.textContent = variableName;
            variableSelect.appendChild(option);
        });
    },

    // Función para verificar si una estrategia ya fue aplicada
    isStrategyAlreadyApplied(type, strategy, additionalParams = {}) {
        return this.preprocessingSteps.some(step => {
            if (step.type !== type) return false;
            
            if (type === 'missing_values') {
                return step.strategy === strategy && 
                       step.constant_value === additionalParams.constant_value;
            } else if (type === 'duplicates') {
                return step.strategy === strategy;
            } else if (type === 'outliers') {
                return step.method === additionalParams.method && 
                       step.strategy === strategy;
            } else if (type === 'data_types') {
                return step.variable === additionalParams.variable && 
                       step.target_type === additionalParams.target_type;
            }
            
            return false;
        });
    },

    async handleMissingValues() {
        if (!this.currentDataset) {
            this.app.showError('No hay dataset cargado');
            return;
        }

        const strategy = document.getElementById('missingValuesStrategy').value;
        const constantValue = document.getElementById('constantValue').value;

        // Verificar si la estrategia ya fue aplicada
        if (this.isStrategyAlreadyApplied('missing_values', strategy, { constant_value: constantValue })) {
            this.app.showWarning('Esta estrategia de valores faltantes ya fue aplicada anteriormente. No se realizarán cambios adicionales.');
            return;
        }

        try {
            const button = document.getElementById('handleMissingValuesBtn');
            button.classList.add('btn-loading');
            button.disabled = true;

            const result = await this.app.preprocessMissingValues(
                this.currentDataset.filename,
                strategy,
                constantValue
            );

            this.processedDataset = result.dataset;
            
            // Agregar el paso de preprocesamiento
            this.preprocessingSteps.push({
                type: 'missing_values',
                strategy: strategy,
                constant_value: constantValue,
                timestamp: new Date().toISOString()
            });

            this.updateFinalStateDashboard();
            this.app.showSuccess('Valores faltantes procesados correctamente');

        } catch (error) {
            this.app.showError(`Error al procesar valores faltantes: ${error.message}`);
        } finally {
            const button = document.getElementById('handleMissingValuesBtn');
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    },

    async handleDuplicates() {
        if (!this.currentDataset) {
            this.app.showError('No hay dataset cargado');
            return;
        }

        const strategy = document.getElementById('duplicatesStrategy').value;

        // Verificar si la estrategia ya fue aplicada
        if (this.isStrategyAlreadyApplied('duplicates', strategy)) {
            this.app.showWarning('Esta estrategia de duplicados ya fue aplicada anteriormente. No se realizarán cambios adicionales.');
            return;
        }

        try {
            const button = document.getElementById('handleDuplicatesBtn');
            button.classList.add('btn-loading');
            button.disabled = true;

            const result = await this.app.preprocessDuplicates(
                this.currentDataset.filename,
                strategy
            );

            this.processedDataset = result.dataset;
            
            // Agregar el paso de preprocesamiento
            this.preprocessingSteps.push({
                type: 'duplicates',
                strategy: strategy,
                timestamp: new Date().toISOString()
            });

            this.updateFinalStateDashboard();
            this.app.showSuccess('Duplicados procesados correctamente');

        } catch (error) {
            this.app.showError(`Error al procesar duplicados: ${error.message}`);
        } finally {
            const button = document.getElementById('handleDuplicatesBtn');
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    },

    async handleOutliers() {
        if (!this.currentDataset) {
            this.app.showError('No hay dataset cargado');
            return;
        }

        const method = document.getElementById('outliersMethod').value;
        const strategy = document.getElementById('outliersStrategy').value;

        // Verificar si la estrategia ya fue aplicada
        if (this.isStrategyAlreadyApplied('outliers', strategy, { method: method })) {
            this.app.showWarning('Esta estrategia de outliers ya fue aplicada anteriormente. No se realizarán cambios adicionales.');
            return;
        }

        try {
            const button = document.getElementById('handleOutliersBtn');
            button.classList.add('btn-loading');
            button.disabled = true;

            const result = await this.app.preprocessOutliers(
                this.currentDataset.filename,
                method,
                strategy
            );

            this.processedDataset = result.dataset;
            
            // Agregar el paso de preprocesamiento
            this.preprocessingSteps.push({
                type: 'outliers',
                method: method,
                strategy: strategy,
                timestamp: new Date().toISOString()
            });

            this.updateFinalStateDashboard();
            this.app.showSuccess('Outliers procesados correctamente');

        } catch (error) {
            this.app.showError(`Error al procesar outliers: ${error.message}`);
        } finally {
            const button = document.getElementById('handleOutliersBtn');
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    },

    async handleDataTypes() {
        // Verificar si el panel de conversión de tipos de datos está activado
        const activateDataTypesSwitch = document.getElementById('activateDataTypesSwitch');
        if (!activateDataTypesSwitch || !activateDataTypesSwitch.checked) {
            this.app.showError('Debes activar la conversión de tipos de datos primero');
            return;
        }

        if (!this.currentDataset) {
            this.app.showError('No hay dataset cargado');
            return;
        }

        const variableToConvert = document.getElementById('variableToConvert').value;
        const targetDataType = document.getElementById('targetDataType').value;

        if (!variableToConvert) {
            this.app.showError('Por favor selecciona una variable para convertir');
            return;
        }

        // Verificar si la estrategia ya fue aplicada
        if (this.isStrategyAlreadyApplied('data_types', 'convert', { 
            variable: variableToConvert, 
            target_type: targetDataType 
        })) {
            this.app.showWarning('Esta conversión de tipo de datos ya fue aplicada anteriormente. No se realizarán cambios adicionales.');
            return;
        }

        try {
            const button = document.getElementById('handleDataTypesBtn');
            button.classList.add('btn-loading');
            button.disabled = true;

            const result = await this.app.preprocessDataTypes(
                this.currentDataset.filename,
                'convert',
                {
                    variable: variableToConvert,
                    target_type: targetDataType
                }
            );

            this.processedDataset = result.dataset;
            
            // Agregar el paso de preprocesamiento
            this.preprocessingSteps.push({
                type: 'data_types',
                action: 'convert',
                variable: variableToConvert,
                target_type: targetDataType,
                timestamp: new Date().toISOString()
            });

            this.updateFinalStateDashboard();
            this.app.showSuccess(`Variable "${variableToConvert}" convertida a ${targetDataType} correctamente`);

        } catch (error) {
            this.app.showError(`Error al convertir tipo de datos: ${error.message}`);
        } finally {
            const button = document.getElementById('handleDataTypesBtn');
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    },

    async applyAllChanges() {
        if (!this.currentDataset) {
            this.app.showError('No hay dataset cargado');
            return;
        }

        // Usar los pasos acumulados de los botones individuales
        const stepsToApply = [...this.preprocessingSteps];
        
        if (stepsToApply.length === 0) {
            this.app.showWarning('No hay pasos de preprocesamiento para aplicar. Primero debes aplicar alguna estrategia individual.');
            return;
        }

        try {
            const button = document.getElementById('applyAllChangesBtn');
            button.classList.add('btn-loading');
            button.disabled = true;

            const result = await this.app.applyAllPreprocessing(
                this.currentDataset.filename,
                stepsToApply
            );

            this.processedDataset = result.dataset;
            this.updateFinalStateDashboard();
            
            // Show save section
            document.getElementById('finalStateSection').style.display = 'block';
            document.getElementById('saveSection').style.display = 'block';
            
            this.app.showSuccess('Todos los cambios aplicados correctamente');

        } catch (error) {
            this.app.showError(`Error al aplicar cambios: ${error.message}`);
        } finally {
            const button = document.getElementById('applyAllChangesBtn');
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    },



    async saveProcessedDataset() {
        const name = document.getElementById('processedDatasetName').value.trim();
        
        if (!name) {
            this.app.showError('Por favor ingresa un nombre para el dataset procesado');
            return;
        }

        if (!this.processedDataset) {
            this.app.showError('No hay dataset procesado para guardar');
            return;
        }

        try {
            const button = document.getElementById('saveProcessedDatasetBtn');
            button.classList.add('btn-loading');
            button.disabled = true;

            const result = await this.app.saveProcessedDataset(
                this.currentDataset.filename,
                name,
                this.processedDataset
            );

            this.app.showSuccess(`Dataset procesado guardado como "${result.dataset.filename}"`);
            
            // Clear form
            document.getElementById('processedDatasetName').value = '';
            
            // Recargar la lista de datasets disponibles
            await this.loadAvailableDatasets();

        } catch (error) {
            this.app.showError(`Error al guardar dataset: ${error.message}`);
        } finally {
            const button = document.getElementById('saveProcessedDatasetBtn');
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    },

    initializeDataTypesPanel() {
        // Establecer el panel de conversión de tipos de datos como inactivo por defecto
        const dataTypesCard = document.getElementById('dataTypesCard');
        const activateDataTypesSwitch = document.getElementById('activateDataTypesSwitch');
        
        if (dataTypesCard) {
            dataTypesCard.classList.add('inactive');
            dataTypesCard.classList.remove('active');
        }
        
        if (activateDataTypesSwitch) {
            activateDataTypesSwitch.checked = false;
        }
        
    },

    toggleDataTypesConversion(activated) {
        const dataTypesCard = document.getElementById('dataTypesCard');
        const dataTypesCardBody = document.getElementById('dataTypesCardBody');
        
        if (dataTypesCard) {
            if (activated) {
                dataTypesCard.classList.remove('inactive');
                dataTypesCard.classList.add('active');
                if (dataTypesCardBody) {
                    dataTypesCardBody.style.opacity = '1';
                    dataTypesCardBody.style.pointerEvents = 'auto';
                }
            } else {
                dataTypesCard.classList.remove('active');
                dataTypesCard.classList.add('inactive');
                if (dataTypesCardBody) {
                    dataTypesCardBody.style.opacity = '0.5';
                    dataTypesCardBody.style.pointerEvents = 'none';
                }
            }
        }
    }
};

// Make module available globally
window.preprocessModule = preprocessModule;
window['preprocessModule'] = preprocessModule;


// Inicialización controlada por el sistema de carga de módulos
// El módulo se inicializará cuando loadModuleJS() llame a init()
// Esto previene race conditions y asegura que la app esté lista