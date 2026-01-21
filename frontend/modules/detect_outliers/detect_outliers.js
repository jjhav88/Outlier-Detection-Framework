// JS logic of the detect_outliers tab

// Check if module is already defined to avoid redeclaration
if (typeof window.detectOutliersModule === 'undefined') {
    window.detectOutliersModule = {
    app: null,
    currentDataset: null,
    selectedNumericVariable: null,
    selectedCategoricalVariable: null,

    async init(app) {
        this.app = app;
        this.currentDataset = null;
        this.selectedNumericVariable = null;
        this.selectedCategoricalVariable = null;
        
        this.setupEventListeners();
        await this.loadAvailableDatasets();
        
    },

    async updateContent(app) {
        
        this.app = app;
        
        try {
            await this.loadAvailableDatasets();
            
            this.setupEventListeners();
            
            // Update dataset selection UI if there's a selected dataset
            if (this.app.selectedDataset) {
                this.updateDatasetSelectionUI();
                
                // Show visual exploration section
                const visualSection = document.getElementById('visualExplorationSection');
                if (visualSection) {
                    visualSection.style.display = 'block';
                }
                
                // Load variables for analysis
                this.loadVariablesForAnalysis();
            }
            
            // If there's a selected dataset and variable, refresh the visualizations
            if (this.currentDataset && this.selectedNumericVariable) {
                this.updateVisualizations();
            }
            
        } catch (error) {
            throw error;
        }
    },
    


    setupEventListeners() {
        
        // Event listener para el selector de variable
        const variableSelect = document.getElementById('variableSelect');
        
        if (variableSelect) {
            variableSelect.addEventListener('change', (e) => {
                const selectedVariable = e.target.value;
                if (selectedVariable) {
                    this.handleVariableSelection(selectedVariable);
                }
            });
        }

        // Event listener para el selector de variable de hipótesis
        const hypothesisVariableSelect = document.getElementById('hypothesisVariableSelect');
        if (hypothesisVariableSelect) {
            hypothesisVariableSelect.addEventListener('change', (e) => {
                const selectedVariable = e.target.value;
                if (selectedVariable) {
                    this.handleHypothesisVariableSelection(selectedVariable);
                }
            });
        }

        // Configurar análisis por categoría
        this.setupCategoryAnalysis();
        
        // Configurar análisis de relación
        this.setupRelationshipAnalysis();
        
        // Configurar matriz de correlación
        this.setupCorrelationMatrix();
        
        // Configurar event listeners para la sección de configuración del análisis
        this.setupAnalysisConfigurationListeners();
        
    },

    handleVariableSelection(variableName) {
        
        // Guardar la variable seleccionada para usar en las diferentes pestañas
        this.selectedVariable = variableName;
        
        // Obtener información de la variable
        const dataset = this.app.datasets[this.app.selectedDataset];
        this.selectedVariableType = dataset.variable_types[variableName];
        
        
        // Actualizar la visualización general
        this.updateGeneralVisualization();
        
        // Cargar variables categóricas para análisis por categoría
        this.loadCategoricalVariablesForCategoryAnalysis();
        
        // Cargar variables cuantitativas para análisis de relación
        this.loadQuantitativeVariablesForRelationship();
        
        // Cargar variables cuantitativas para matriz de correlación
        this.loadQuantitativeVariablesForCorrelationMatrix();
        
        // Cargar variables categóricas para selector de hue
        this.loadCategoricalVariablesForHue();
    },

    async executeGrubbsTest() {
        try {
            
            // Mostrar loading
            const resultsContainer = document.getElementById('grubbsResultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Cargando resultados...</div>';
            }
            
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/grubbs-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subject_id: this.currentDataset.subject_id
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.displayGrubbsResults(result);
            } else {
                throw new Error(result.error || 'Error desconocido en el test de Grubbs');
            }
            
        } catch (error) {
            const resultsContainer = document.getElementById('grubbsResultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = `<div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>Error: ${error.message}
                </div>`;
            }
        }
    },

    displayGrubbsResults(result) {
        const resultsContainer = document.getElementById('grubbsResultsContainer');
        if (!resultsContainer) return;

        if (!result.variables || result.variables.length === 0) {
            resultsContainer.innerHTML = '<div class="alert alert-warning">No hay variables numéricas para analizar.</div>';
            // Actualizar contador a 0
            const countElement = document.getElementById('grubbsCount');
            if (countElement) {
                countElement.textContent = '0';
            }
            return;
        }

        // Contar outliers
        let outlierCount = 0;
        result.variables.forEach(variableResult => {
            if (variableResult.success && variableResult.is_outlier) {
                outlierCount++;
            }
        });

        // Actualizar contador en el badge
        const countElement = document.getElementById('grubbsCount');
        if (countElement) {
            countElement.textContent = outlierCount;
            // Cambiar color del badge según si hay outliers o no
            if (outlierCount > 0) {
                countElement.className = 'badge bg-danger ms-2';
            } else {
                countElement.className = 'badge bg-success ms-2';
            }
        }

        let html = '';
        
        result.variables.forEach(variableResult => {
            if (variableResult.success) {
                html += `
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="fas fa-chart-bar me-2"></i>
                            Variable: ${variableResult.variable}
                        </h6>
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead class="table-primary">
                                    <tr>
                                        <th>ID de la Observación</th>
                                        <th>Valor</th>
                                        <th>Tipo</th>
                                        <th>Estadístico G</th>
                                        <th>Valor Crítico</th>
                                        <th>p-valor</th>
                                        <th>Resultado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>${variableResult.observation_id}</td>
                                        <td><strong>${variableResult.value}</strong></td>
                                        <td>
                                            <span class="badge ${variableResult.is_maximum ? 'bg-warning text-dark' : 'bg-info'}">
                                                ${variableResult.outlier_type || (variableResult.is_maximum ? 'Máximo' : 'Mínimo')}
                                            </span>
                                        </td>
                                        <td>${variableResult.grubbs_statistic}</td>
                                        <td>${variableResult.critical_value}</td>
                                        <td>${variableResult.p_value}</td>
                                        <td>
                                            <span class="badge ${variableResult.is_outlier ? 'bg-danger' : 'bg-success'}">
                                                ${variableResult.result}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="fas fa-chart-bar me-2"></i>
                            Variable: ${variableResult.variable}
                        </h6>
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${variableResult.error}
                        </div>
                    </div>
                `;
            }
        });
        
        resultsContainer.innerHTML = html;
        
        // El accordion de Grubbs se mantiene cerrado por defecto
        // const grubbsCollapse = document.getElementById('grubbsResults');
        // if (grubbsCollapse && typeof bootstrap !== 'undefined') {
        //     const bsCollapse = new bootstrap.Collapse(grubbsCollapse, {
        //         show: true
        //     });
        // }
    },

    async executeDixonTest() {
        try {
            
            // Mostrar loading
            const resultsContainer = document.getElementById('dixonResultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Cargando resultados...</div>';
            }
            
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/dixon-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subject_id: this.currentDataset.subject_id
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.displayDixonResults(result);
            } else {
                throw new Error(result.error || 'Error desconocido en el test de Dixon');
            }
            
        } catch (error) {
            const resultsContainer = document.getElementById('dixonResultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = `<div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>Error: ${error.message}
                </div>`;
            }
        }
    },

    displayDixonResults(result) {
        const resultsContainer = document.getElementById('dixonResultsContainer');
        if (!resultsContainer) return;

        if (!result.variables || result.variables.length === 0) {
            resultsContainer.innerHTML = '<div class="alert alert-warning">No hay variables numéricas para analizar.</div>';
            // Actualizar contador a 0
            const countElement = document.getElementById('dixonCount');
            if (countElement) {
                countElement.textContent = '0';
            }
            return;
        }

        // Contar outliers
        let outlierCount = 0;
        result.variables.forEach(variableResult => {
            if (variableResult.success && variableResult.is_outlier) {
                outlierCount++;
            }
        });

        // Actualizar contador en el badge
        const countElement = document.getElementById('dixonCount');
        if (countElement) {
            countElement.textContent = outlierCount;
            // Cambiar color del badge según si hay outliers o no
            if (outlierCount > 0) {
                countElement.className = 'badge bg-danger ms-2';
            } else {
                countElement.className = 'badge bg-success ms-2';
            }
        }

        let html = '';
        
        result.variables.forEach(variableResult => {
            if (variableResult.success) {
                html += `
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="fas fa-chart-bar me-2"></i>
                            Variable: ${variableResult.variable}
                        </h6>
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead class="table-primary">
                                    <tr>
                                        <th>ID de la Observación</th>
                                        <th>Valor</th>
                                        <th>Estadístico Q</th>
                                        <th>Valor Crítico</th>
                                        <th>p-valor</th>
                                        <th>Resultado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>${variableResult.observation_id}</td>
                                        <td>${variableResult.value}</td>
                                        <td>${variableResult.q_statistic}</td>
                                        <td>${variableResult.critical_value}</td>
                                        <td>${variableResult.p_value}</td>
                                        <td>
                                            <span class="badge ${variableResult.is_outlier ? 'bg-danger' : 'bg-success'}">
                                                ${variableResult.result}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="fas fa-chart-bar me-2"></i>
                            Variable: ${variableResult.variable}
                        </h6>
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${variableResult.error}
                        </div>
                    </div>
                `;
            }
        });
        
        resultsContainer.innerHTML = html;
        
        // El accordion de Dixon se mantiene cerrado por defecto
    },

    async executeRosnerTest() {
        try {
            
            // Mostrar loading
            const resultsContainer = document.getElementById('rosnerResultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Cargando resultados...</div>';
            }
            
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/rosner-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subject_id: this.currentDataset.subject_id
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.displayRosnerResults(result);
            } else {
                throw new Error(result.error || 'Error desconocido en el test de Rosner');
            }
            
        } catch (error) {
            const resultsContainer = document.getElementById('rosnerResultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = `<div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>Error: ${error.message}
                </div>`;
            }
        }
    },

    displayRosnerResults(result) {
        const resultsContainer = document.getElementById('rosnerResultsContainer');
        if (!resultsContainer) return;

        if (!result.variables || result.variables.length === 0) {
            resultsContainer.innerHTML = '<div class="alert alert-warning">No hay variables numéricas para analizar.</div>';
            // Actualizar contador a 0
            const countElement = document.getElementById('rosnerCount');
            if (countElement) {
                countElement.textContent = '0';
            }
            return;
        }

        // Contar outliers totales
        let totalOutlierCount = 0;
        result.variables.forEach(variableResult => {
            if (variableResult.success) {
                totalOutlierCount += variableResult.outliers_detected;
            }
        });

        // Actualizar contador en el badge
        const countElement = document.getElementById('rosnerCount');
        if (countElement) {
            countElement.textContent = totalOutlierCount;
            // Cambiar color del badge según si hay outliers o no
            if (totalOutlierCount > 0) {
                countElement.className = 'badge bg-danger ms-2';
            } else {
                countElement.className = 'badge bg-success ms-2';
            }
        }

        let html = '';
        
        result.variables.forEach(variableResult => {
            if (variableResult.success) {
                html += `
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="fas fa-chart-bar me-2"></i>
                            Variable: ${variableResult.variable}
                            <span class="badge bg-info ms-2">Tamaño muestra: ${variableResult.sample_size}</span>
                            <span class="badge bg-secondary ms-2">k probado: ${variableResult.k_tested}</span>
                        </h6>
                `;
                
                if (variableResult.outliers_detected > 0) {
                    html += `
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead class="table-primary">
                                    <tr>
                                        <th>ID de la Observación</th>
                                        <th>Valor</th>
                                        <th>Estadístico R</th>
                                        <th>Valor Crítico</th>
                                        <th>p-valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;
                    
                    variableResult.outlier_details.forEach(outlier => {
                        html += `
                            <tr>
                                <td>${outlier.observation_id}</td>
                                <td>${outlier.value}</td>
                                <td>${outlier.test_statistic}</td>
                                <td>${outlier.critical_value}</td>
                                <td>${outlier.p_value}</td>
                            </tr>
                        `;
                    });
                    
                    html += `
                                </tbody>
                            </table>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="alert alert-success">
                            <i class="fas fa-check-circle me-2"></i>
                            Este método no detectó outliers en los datos para esta variable.
                        </div>
                    `;
                }
                
                html += `</div>`;
            } else {
                html += `
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="fas fa-chart-bar me-2"></i>
                            Variable: ${variableResult.variable}
                        </h6>
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${variableResult.error}
                        </div>
                    </div>
                `;
            }
        });
        
        resultsContainer.innerHTML = html;
        
        // El accordion de Rosner se mantiene cerrado por defecto
    },

    async loadAvailableDatasets() {
        try {
            
            // Verificar que this.app existe
            if (!this.app) {
                const container = document.getElementById('datasetSelectionContainer');
                if (container) {
                    container.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            El módulo no se ha inicializado correctamente. Por favor, recarga la página.
                        </div>
                    `;
                }
                return;
            }
            
            
            // Asegurar que this.app.datasets existe y tiene datos
            if (!this.app.datasets || Object.keys(this.app.datasets).length === 0) {
                // Intentar recargar desde el servidor
                try {
                    if (this.app.loadDatasets && typeof this.app.loadDatasets === 'function') {
                        await this.app.loadDatasets();
                        // Verificar nuevamente después de recargar
                        if (!this.app.datasets || Object.keys(this.app.datasets).length === 0) {
                        } else {
                        }
                    } else {
                    }
                } catch (error) {
                    // NO inicializar como objeto vacío aquí, dejar que el módulo maneje el caso vacío
                }
            }
            
            // Verificar nuevamente después de intentar recargar
            if (!this.app.datasets) {
                const container = document.getElementById('datasetSelectionContainer');
                if (container) {
                    container.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            No se pudieron cargar los datasets. Por favor, verifica que hay datasets disponibles.
                        </div>
                    `;
                }
                return;
            }
            
            const datasets = Object.values(this.app.datasets);
            const container = document.getElementById('datasetSelectionContainer');
            
            if (!container) {
                return;
            }
            
            
            if (datasets.length === 0) {
                container.innerHTML = `
                    <div class="no-datasets-message text-center py-5">
                        <i class="fas fa-database fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No hay datasets disponibles</h5>
                        <p class="text-muted mb-3">Primero debes cargar un dataset en la pestaña "Cargar Datos"</p>
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
            const newContent = `
                <div class="row g-3">
                    ${gridHtml}
                </div>
            `;
            
            // Siempre actualizar el contenido para asegurar que refleje los cambios
            container.innerHTML = newContent;
            
            // Configurar event listeners para los botones de selección
            this.setupDatasetSelectionListeners();
            
            
        } catch (error) {
            // En caso de error, mostrar mensaje de error
            const container = document.getElementById('datasetSelectionContainer');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error al cargar los datasets: ${error.message}
                    </div>
                `;
            }
        }
    },

    createDatasetPanel(dataset) {
        const fileTypeIcon = this.getFileTypeIcon(dataset.filename);
        const isSelected = this.app.selectedDataset === dataset.filename;
        const isProcessed = dataset.is_processed || false;
        
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card dataset-selection-panel ${isSelected ? 'selected' : ''} ${isProcessed ? 'processed-dataset' : ''}" data-filename="${dataset.filename}">
                    <div class="card-body">
                        <div class="dataset-info">
                            <div class="dataset-name">
                                <span class="file-type-icon ${fileTypeIcon.class} me-2">${fileTypeIcon.icon}</span>
                                ${dataset.filename}
                                ${isProcessed ? '<span class="badge bg-success ms-2"><i class="fas fa-check me-1"></i>Procesado</span>' : ''}
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
                            </div>
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
        
        // Remover event listeners existentes para evitar duplicados
        document.querySelectorAll('.dataset-selection-panel').forEach(panel => {
            panel.removeEventListener('click', this.handlePanelClick);
        });
        
        document.querySelectorAll('.select-button').forEach(button => {
            button.removeEventListener('click', this.handleButtonClick);
        });
        
        // Event listeners para los paneles de datasets
        document.querySelectorAll('.dataset-selection-panel').forEach(panel => {
            panel.addEventListener('click', this.handlePanelClick.bind(this));
        });

        // Event listeners para los botones de selección
        document.querySelectorAll('.select-button').forEach(button => {
            button.addEventListener('click', this.handleButtonClick.bind(this));
        });
        
    },
    
    handlePanelClick(e) {
        if (!e.target.classList.contains('select-button')) {
            const filename = e.currentTarget.dataset.filename;
            this.selectDataset(filename);
        }
    },
    
    handleButtonClick(e) {
        e.stopPropagation();
        const filename = e.currentTarget.dataset.filename;
        this.selectDataset(filename);
    },

    async selectDataset(filename) {
        try {
            
            // Limpiar resultados de outliers anteriores si se selecciona un dataset diferente
            if (this.currentDataset && this.currentDataset.filename !== filename) {
                this.clearPreviousOutlierResults();
            }
            
            // Actualizar selección global
            this.app.selectedDataset = filename;
            
            // Get dataset details
            const dataset = await this.app.getDatasetDetails(filename);
            
            this.currentDataset = dataset;
            
            // Actualizar UI de selección
            this.updateDatasetSelectionUI();
            
            // Mostrar sección de exploración visual
            const visualSection = document.getElementById('visualExplorationSection');
            if (visualSection) {
                visualSection.style.display = 'block';
            } else {
            }

            // Mostrar sección de configuración del análisis
            const analysisConfigSection = document.getElementById('analysisConfigurationSection');
            if (analysisConfigSection) {
                analysisConfigSection.style.display = 'block';
            } else {
            }
            
            // Cargar variables en los selectores
            this.loadVariablesForAnalysis();

            // Cargar variables para el selector de ID del sujeto
            this.loadSubjectIdVariables();
            
            // Ejecutar test de Grubbs para todas las variables numéricas
            this.executeGrubbsTest();
            
            // Ejecutar test de Dixon para todas las variables numéricas
            this.executeDixonTest();
            
            // Ejecutar test de Rosner para todas las variables numéricas
            this.executeRosnerTest();
            
            // Cargar variables para matriz de correlación
            this.loadQuantitativeVariablesForCorrelationMatrix();
            
            // Cargar variables categóricas para selector de hue
            setTimeout(() => {
                this.loadCategoricalVariablesForHue();
            }, 500);
            
            this.app.showSuccess(`Dataset "${filename}" seleccionado para análisis de outliers`);
            
        } catch (error) {
            this.app.showError(`Error al seleccionar el dataset: ${error.message}`);
        }
    },

    clearPreviousOutlierResults() {
        try {
            
            // Limpiar localStorage
            const currentDatasetKey = 'current_outlier_dataset';
            const sessionKey = 'outlier_session_id';
            
            // Remover datos del dataset anterior
            if (this.currentDataset) {
                const oldStorageKey = `outlier_results_${this.currentDataset.filename}`;
                localStorage.removeItem(oldStorageKey);
            }
            
            // Limpiar referencias actuales
            localStorage.removeItem(currentDatasetKey);
            localStorage.removeItem(sessionKey);
            
            // Ocultar sección de resultados si existe
            const resultsSection = document.getElementById('outlierResultsSection');
            if (resultsSection) {
                resultsSection.style.display = 'none';
            }
            
            
        } catch (error) {
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

    loadVariablesForAnalysis() {
        
        if (!this.currentDataset) {
            return;
        }
        
        if (!this.currentDataset.summary_stats) {
            return;
        }
        
        const variableSelect = document.getElementById('variableSelect');
        
        if (!variableSelect) {
            return;
        }
        
        
        // Limpiar opciones existentes
        variableSelect.innerHTML = '<option value="">Selecciona una variable...</option>';
        
        let totalCount = 0;
        
        // Agregar variables del dataset
        Object.keys(this.currentDataset.summary_stats).forEach(variableName => {
            const stats = this.currentDataset.summary_stats[variableName];
            
            const option = document.createElement('option');
            option.value = variableName;
            
            // Determinar etiqueta del tipo
            let typeLabel = '';
            if (stats.type === 'cuantitativa_continua' || stats.type === 'cuantitativa_discreta') {
                typeLabel = stats.type === 'cuantitativa_continua' ? 'Numérica Continua' : 'Numérica Discreta';
            } else if (stats.type === 'cualitativa_nominal' || stats.type === 'cualitativa_nominal_binaria') {
                typeLabel = 'Categórica';
            } else {
                typeLabel = stats.type;
            }
            
            option.textContent = `${variableName} (${typeLabel})`;
            variableSelect.appendChild(option);
            totalCount++;
        });
        
    },

    async updateNumericVisualizations() {
        if (!this.selectedNumericVariable) {
            this.showEmptyNumericCharts();
            return;
        }

        try {
            // Mostrar indicador de carga
            this.showLoadingNumericCharts();
            
            // Obtener datos para visualización
            const visualData = await this.getVisualData();
            
            // Generar gráficos numéricos
            this.generateHistogram(visualData);
            this.generateDensityChart(visualData);
            this.generateBoxplot(visualData);
            
            // Actualizar información estadística
            this.updateStatisticalInfo(visualData);
            
        } catch (error) {
            this.app.showError(`Error al actualizar visualizaciones numéricas: ${error.message}`);
            this.showEmptyNumericCharts();
        }
    },

    async updateCategoricalVisualizations() {
        if (!this.selectedCategoricalVariable) {
            this.showEmptyCategoricalCharts();
            return;
        }

        try {
            // Mostrar indicador de carga
            this.showLoadingCategoricalCharts();
            
            // Obtener datos para visualización categórica
            const visualData = await this.getCategoricalVisualData();
            
            // Generar gráficos categóricos
            this.generateBarChart(visualData);
            this.generatePieChart(visualData);
            this.generateFrequencyTable(visualData);
            
            // Actualizar información estadística
            this.updateStatisticalInfo(visualData);
            
        } catch (error) {
            this.app.showError(`Error al actualizar visualizaciones categóricas: ${error.message}`);
            this.showEmptyCategoricalCharts();
        }
    },

    async updateVisualizations() {
        // Método legacy - mantener para compatibilidad
        if (this.selectedNumericVariable) {
            await this.updateNumericVisualizations();
        } else if (this.selectedCategoricalVariable) {
            await this.updateCategoricalVisualizations();
        }
    },

    async getVisualData() {
        try {
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/visual-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    variable: this.selectedVariable,
                    categorical_variable: null
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.detail || 'Error obteniendo datos visuales');
            }

            return result.visual_data;
        } catch (error) {
            throw error;
        }
    },

    generateHistogram(visualData) {
        const container = document.getElementById('histogramChart');
        
        const trace = {
            x: visualData.histogram_data.values,
            type: 'histogram',
            nbinsx: visualData.histogram_data.bins,
            marker: {
                color: '#0d6efd',
                line: {
                    color: 'white',
                    width: 1
                }
            },
            opacity: 0.7
        };

        const layout = {
            title: `Histograma - ${visualData.variable}`,
            xaxis: { title: visualData.variable },
            yaxis: { title: 'Frecuencia' },
            margin: { l: 50, r: 20, t: 50, b: 50 },
            height: 300
        };

        Plotly.newPlot(container, [trace], layout, { responsive: true });
    },

    generateDensityChart(visualData) {
        const container = document.getElementById('densityChart');
        
        // Crear datos para la curva de densidad usando los datos del backend
        const values = visualData.density_data.values;
        const min = visualData.stats.min;
        const max = visualData.stats.max;
        const step = (max - min) / 100;
        const x = [];
        const y = [];
        
        for (let i = min; i <= max; i += step) {
            x.push(i);
            // Calcular densidad usando kernel density estimation simple
            const density = values.filter(val => Math.abs(val - i) < step).length / (step * values.length);
            y.push(density);
        }

        const trace = {
            x: x,
            y: y,
            type: 'scatter',
            mode: 'lines',
            fill: 'tonexty',
            line: { color: '#198754' },
            fillcolor: 'rgba(25, 135, 84, 0.3)'
        };

        const layout = {
            title: `Densidad - ${visualData.variable}`,
            xaxis: { title: visualData.variable },
            yaxis: { title: 'Densidad' },
            margin: { l: 50, r: 20, t: 50, b: 50 },
            height: 300
        };

        Plotly.newPlot(container, [trace], layout, { responsive: true });
    },

    generateBoxplot(visualData) {
        const container = document.getElementById('boxplotChart');
        
        const trace = {
            y: visualData.boxplot_data.values,
            type: 'box',
            name: visualData.variable,
            marker: { color: '#ffc107' },
            boxpoints: 'outliers'
        };

        const layout = {
            title: `Boxplot - ${visualData.variable}`,
            yaxis: { title: visualData.variable },
            margin: { l: 50, r: 20, t: 50, b: 50 },
            height: 300
        };

        Plotly.newPlot(container, [trace], layout, { responsive: true });
    },

    generateScatterChart(visualData) {
        const container = document.getElementById('scatterChart');
        
        // Para el gráfico de dispersión, necesitaríamos dos variables numéricas
        // Por ahora, mostraremos un gráfico de dispersión con el índice
        const values = visualData.histogram_data.values;
        const x = Array.from({length: values.length}, (_, i) => i);
        
        const trace = {
            x: x,
            y: values,
            type: 'scatter',
            mode: 'markers',
            marker: {
                color: '#dc3545',
                size: 6,
                opacity: 0.7
            }
        };

        const layout = {
            title: `Dispersión - ${visualData.variable}`,
            xaxis: { title: 'Índice' },
            yaxis: { title: visualData.variable },
            margin: { l: 50, r: 20, t: 50, b: 50 },
            height: 300
        };

        Plotly.newPlot(container, [trace], layout, { responsive: true });
    },

    updateStatisticalInfo(visualData) {
        const container = document.getElementById('statisticalInfo');
        
        // Verificar si el contenedor existe
        if (!container) {
            return;
        }
        
        // Verificar si es variable numérica o categórica usando la función isNumericVariable
        if (this.isNumericVariable(this.selectedVariableType)) {
            this.updateNumericStatisticalInfo(visualData);
        } else {
            this.updateCategoricalStatisticalInfo(visualData);
        }
    },

    updateNumericStatisticalInfo(visualData) {
        const container = document.getElementById('statisticalInfo');
        
        // Verificar si el contenedor existe
        if (!container) {
            return;
        }
        
        const stats = visualData.stats;
        
        container.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="stat-item">
                        <div class="stat-label">Número de observaciones</div>
                        <div class="stat-value">${stats.count.toLocaleString()}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Media</div>
                        <div class="stat-value">${stats.mean.toFixed(2)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Mediana</div>
                        <div class="stat-value">${stats.median.toFixed(2)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Desviación estándar</div>
                        <div class="stat-value">${stats.std.toFixed(2)}</div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="stat-item">
                        <div class="stat-label">Valor mínimo</div>
                        <div class="stat-value">${stats.min.toFixed(2)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Valor máximo</div>
                        <div class="stat-value">${stats.max.toFixed(2)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Q1 (25%)</div>
                        <div class="stat-value">${stats.q1.toFixed(2)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Q3 (75%)</div>
                        <div class="stat-value">${stats.q3.toFixed(2)}</div>
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        <strong>Información adicional:</strong> 
                        ${visualData.valid_records.toLocaleString()} registros válidos de ${visualData.total_records.toLocaleString()} totales 
                        (${visualData.missing_records.toLocaleString()} valores faltantes)
                    </div>
                </div>
            </div>
        `;
    },

    updateCategoricalStatisticalInfo(categoricalData) {
        const container = document.getElementById('statisticalInfo');
        
        // Verificar si el contenedor existe
        if (!container) {
            return;
        }
        
        const total = categoricalData.frequencies.reduce((sum, freq) => sum + freq, 0);
        
        const tableHTML = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="table-dark">
                        <tr>
                            <th>Categoría</th>
                            <th>Frecuencia Absoluta</th>
                            <th>Frecuencia Relativa (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categoricalData.categories.map((category, index) => {
                            const freq = categoricalData.frequencies[index];
                            const relFreq = ((freq / total) * 100).toFixed(2);
                            return `
                                <tr>
                                    <td><strong>${category}</strong></td>
                                    <td>${freq.toLocaleString()}</td>
                                    <td>${relFreq}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot class="table-info">
                        <tr>
                            <td><strong>TOTAL</strong></td>
                            <td><strong>${total.toLocaleString()}</strong></td>
                            <td><strong>100.00%</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;
    },

    showLoadingCharts() {
        const charts = ['histogramChart', 'densityChart', 'boxplotChart', 'scatterChart'];
        
        charts.forEach(chartId => {
            const container = document.getElementById(chartId);
            if (container) {
                container.innerHTML = `
                    <div class="loading-message">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Cargando gráfico...</p>
                    </div>
                `;
            }
        });
    },

    showEmptyCharts() {
        const charts = [
            { id: 'histogramChart', icon: 'fas fa-chart-bar', text: 'Selecciona una variable numérica para visualizar el histograma' },
            { id: 'densityChart', icon: 'fas fa-chart-area', text: 'Selecciona una variable numérica para visualizar la densidad' },
            { id: 'boxplotChart', icon: 'fas fa-box', text: 'Selecciona una variable numérica para visualizar el boxplot' },
            { id: 'scatterChart', icon: 'fas fa-chart-scatter', text: 'Selecciona variables para visualizar la dispersión' }
        ];
        
        charts.forEach(chart => {
            const container = document.getElementById(chart.id);
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="${chart.icon} fa-3x mb-3"></i>
                        <p>${chart.text}</p>
                    </div>
                `;
            }
        });
        
        // Limpiar información estadística
        const statisticalInfo = document.getElementById('statisticalInfo');
        if (statisticalInfo) {
            statisticalInfo.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-info-circle fa-2x mb-2"></i>
                    <p>Selecciona una variable para ver la información estadística</p>
                </div>
            `;
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

    // Métodos para la visualización general
    updateGeneralVisualization() {
        if (!this.selectedVariable) {
            this.showInitialMessage();
            return;
        }

        // Ocultar mensaje inicial
        document.getElementById('initialMessage').style.display = 'none';

        // Determinar tipo de variable y mostrar visualizaciones correspondientes
        if (this.isNumericVariable(this.selectedVariableType)) {
            this.showNumericVisualizations();
            this.loadNumericCharts();
        } else {
            this.showCategoricalVisualizations();
            this.loadCategoricalCharts();
        }
    },

    showInitialMessage() {
        document.getElementById('initialMessage').style.display = 'block';
        document.getElementById('numericVisualizations').style.display = 'none';
        document.getElementById('categoricalVisualizations').style.display = 'none';
    },

    showNumericVisualizations() {
        document.getElementById('numericVisualizations').style.display = 'block';
        document.getElementById('categoricalVisualizations').style.display = 'none';
    },

    showCategoricalVisualizations() {
        document.getElementById('numericVisualizations').style.display = 'none';
        document.getElementById('categoricalVisualizations').style.display = 'block';
    },

    async loadNumericCharts() {
        try {
            // Mostrar loading
            this.showLoadingNumericCharts();
            
            // Obtener datos
            const visualData = await this.getVisualData();
            
            // Generar gráficos con delay para asegurar limpieza
            setTimeout(() => {
                this.generateGeneralHistogram(visualData);
                this.generateGeneralDensityChart(visualData);
                this.generateGeneralBoxplot(visualData);
            }, 50);
            
            // Actualizar información estadística
            this.updateStatisticalInfo(visualData);
            
        } catch (error) {
            this.showErrorNumericCharts();
        }
    },

    async loadCategoricalCharts() {
        try {
            // Mostrar loading
            this.showLoadingCategoricalCharts();
            
            // Obtener datos categóricos
            const categoricalData = await this.getCategoricalVisualData();
            
            // Generar gráficos
            this.generateGeneralBarChart(categoricalData);
            this.generateGeneralPieChart(categoricalData);
            this.generateGeneralFrequencyTable(categoricalData);
            
            // Actualizar información estadística
            this.updateStatisticalInfo(categoricalData);
            
        } catch (error) {
            this.showErrorCategoricalCharts();
        }
    },

    // Métodos para obtener datos
    async getCategoricalVisualData() {
        try {
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/categorical-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    variable: this.selectedVariable
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.categorical_data;
        } catch (error) {
            throw error;
        }
    },

    // Métodos para generar gráficos numéricos
    generateGeneralHistogram(visualData) {
        const container = document.getElementById('generalHistogramChart');
        if (!container) return;

        // Limpiar completamente el contenedor
        container.innerHTML = '';

        const trace = {
            x: visualData.histogram_data.values,
            type: 'histogram',
            nbinsx: visualData.histogram_data.bins,
            marker: {
                color: 'rgba(55, 128, 191, 0.7)',
                line: {
                    color: 'rgba(55, 128, 191, 1.0)',
                    width: 1
                }
            }
        };

        const layout = {
            title: `Histograma de ${this.selectedVariable}`,
            xaxis: { title: this.selectedVariable },
            yaxis: { title: 'Frecuencia' },
            showlegend: false,
            height: 300
        };

        Plotly.newPlot(container, [trace], layout, {responsive: true});
    },

    generateGeneralDensityChart(visualData) {
        const container = document.getElementById('generalDensityChart');
        if (!container) return;

        // Limpiar completamente el contenedor
        container.innerHTML = '';

        // Crear datos para la curva de densidad usando kernel density estimation
        const values = visualData.density_data.values;
        const min = visualData.stats.min;
        const max = visualData.stats.max;
        const step = (max - min) / 100;
        const x = [];
        const y = [];
        
        for (let i = min; i <= max; i += step) {
            x.push(i);
            // Calcular densidad usando kernel density estimation simple
            const density = values.filter(val => Math.abs(val - i) < step).length / (step * values.length);
            y.push(density);
        }

        const trace = {
            x: x,
            y: y,
            type: 'scatter',
            mode: 'lines',
            fill: 'tonexty',
            line: { 
                color: '#198754',
                width: 2
            },
            fillcolor: 'rgba(25, 135, 84, 0.3)'
        };

        const layout = {
            title: `Densidad de ${this.selectedVariable}`,
            xaxis: { title: this.selectedVariable },
            yaxis: { title: 'Densidad de Probabilidad' },
            showlegend: false,
            height: 300
        };

        Plotly.newPlot(container, [trace], layout, {responsive: true});
    },

    generateGeneralBoxplot(visualData) {
        const container = document.getElementById('generalBoxplotChart');
        if (!container) return;

        // Limpiar completamente el contenedor
        container.innerHTML = '';

        const trace = {
            y: visualData.boxplot_data.values,
            type: 'box',
            name: this.selectedVariable,
            marker: {
                color: 'rgba(255, 193, 7, 0.7)'
            }
        };

        const layout = {
            title: `Boxplot de ${this.selectedVariable}`,
            yaxis: { title: this.selectedVariable },
            showlegend: false,
            height: 300
        };

        Plotly.newPlot(container, [trace], layout, {responsive: true});
    },

    // Métodos para generar gráficos categóricos
    generateGeneralBarChart(categoricalData) {
        const container = document.getElementById('generalBarChart');
        if (!container) return;

        // Limpiar completamente el contenedor
        container.innerHTML = '';

        const trace = {
            x: categoricalData.categories,
            y: categoricalData.frequencies,
            type: 'bar',
            marker: {
                color: 'rgba(55, 128, 191, 0.7)',
                line: {
                    color: 'rgba(55, 128, 191, 1.0)',
                    width: 1
                }
            }
        };

        const layout = {
            title: `${this.selectedVariable} Distribution`,
            xaxis: { title: 'Categories' },
            yaxis: { title: 'Frequency' },
            showlegend: false,
            height: 300
        };

        Plotly.newPlot(container, [trace], layout, {responsive: true});
    },

    generateGeneralPieChart(categoricalData) {
        const container = document.getElementById('generalPieChart');
        if (!container) return;

        // Limpiar completamente el contenedor
        container.innerHTML = '';

        const trace = {
            values: categoricalData.frequencies,
            labels: categoricalData.categories,
            type: 'pie',
            marker: {
                colors: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
            }
        };

        const layout = {
            title: `${this.selectedVariable} Distribution`,
            showlegend: true,
            height: 400,
            width: 500
        };

        Plotly.newPlot(container, [trace], layout, {responsive: true});
    },

    generateGeneralFrequencyTable(categoricalData) {
        const container = document.getElementById('generalFrequencyTable');
        if (!container) return;

        const total = categoricalData.frequencies.reduce((sum, freq) => sum + freq, 0);
        
        const tableHTML = `
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>Categoría</th>
                        <th>Frecuencia Absoluta</th>
                        <th>Frecuencia Relativa (%)</th>
                    </tr>
                </thead>
                <tbody>
                    ${categoricalData.categories.map((category, index) => {
                        const freq = categoricalData.frequencies[index];
                        const relFreq = ((freq / total) * 100).toFixed(2);
                        return `
                            <tr>
                                <td><strong>${category}</strong></td>
                                <td>${freq.toLocaleString()}</td>
                                <td>${relFreq}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot class="table-info">
                    <tr>
                        <td><strong>TOTAL</strong></td>
                        <td><strong>${total.toLocaleString()}</strong></td>
                        <td><strong>100.00%</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;

        container.innerHTML = tableHTML;
    },

    // Métodos para mostrar loading y errores
    showLoadingNumericCharts() {
        const charts = ['generalHistogramChart', 'generalDensityChart', 'generalBoxplotChart'];
        
        charts.forEach(chartId => {
            const container = document.getElementById(chartId);
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
                        <p class="text-muted">Cargando gráfico...</p>
                    </div>
                `;
            }
        });
    },

    showLoadingCategoricalCharts() {
        const charts = ['generalBarChart', 'generalPieChart'];
        
        charts.forEach(chartId => {
            const container = document.getElementById(chartId);
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
                        <p class="text-muted">Cargando gráfico...</p>
                    </div>
                `;
            }
        });

        // Mostrar loading en tabla de frecuencias
        const frequencyTable = document.getElementById('generalFrequencyTable');
        if (frequencyTable) {
            frequencyTable.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
                    <p class="text-muted">Cargando tabla de frecuencias...</p>
                </div>
            `;
        }
    },

    showErrorNumericCharts() {
        const charts = ['generalHistogramChart', 'generalDensityChart', 'generalBoxplotChart'];
        
        charts.forEach(chartId => {
            const container = document.getElementById(chartId);
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-danger py-5">
                        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                        <p>Error al cargar el gráfico</p>
                    </div>
                `;
            }
        });
    },

    showErrorCategoricalCharts() {
        const charts = ['generalBarChart', 'generalPieChart'];
        
        charts.forEach(chartId => {
            const container = document.getElementById(chartId);
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-danger py-5">
                        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                        <p>Error al cargar el gráfico</p>
                    </div>
                `;
            }
        });

        // Mostrar error en tabla de frecuencias
        const frequencyTable = document.getElementById('generalFrequencyTable');
        if (frequencyTable) {
            frequencyTable.innerHTML = `
                <div class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                    <p>Error al cargar la tabla de frecuencias</p>
                </div>
            `;
        }
    },

    isNumericVariable(type) {
        return type === 'numeric' || type === 'integer' || type === 'float' || 
               type === 'cuantitativa_continua' || type === 'cuantitativa_discreta';
    },

    // Funciones para Distribución por Categoría
    setupCategoryAnalysis() {
        // Event listener para el selector de variable categórica
        const categoricalSelect = document.getElementById('categoricalVariableSelect');
        if (categoricalSelect) {
            categoricalSelect.addEventListener('change', (e) => {
                const selectedCategoricalVar = e.target.value;
                if (selectedCategoricalVar) {
                    this.handleCategoricalVariableSelection(selectedCategoricalVar);
                }
            });
        }
    },

    handleCategoricalVariableSelection(categoricalVariable) {
        
        // Determinar qué tipo de análisis mostrar basado en la variable inicial
        if (this.isNumericVariable(this.selectedVariableType)) {
            this.showQuantitativeByCategory(categoricalVariable);
        } else {
            this.showCategoricalByCategory(categoricalVariable);
        }
    },

    async showQuantitativeByCategory(categoricalVariable) {
        try {
            // Ocultar contenido inicial y mostrar análisis cuantitativo por categoría
            document.getElementById('categoryAnalysisContent').style.display = 'none';
            document.getElementById('quantitativeByCategory').style.display = 'block';
            document.getElementById('categoricalByCategory').style.display = 'none';

            // Obtener datos para análisis cuantitativo por categoría
            const data = await this.getQuantitativeByCategoryData(categoricalVariable);
            
            // Generar gráficos
            this.generateCategoryHistograms(data);
            this.generateCategoryDensityCharts(data);
            this.generateCategoryBoxplots(data);

        } catch (error) {
            this.app.showError(`Error en análisis por categoría: ${error.message}`);
        }
    },

    async showCategoricalByCategory(categoricalVariable) {
        try {
            // Ocultar contenido inicial y mostrar análisis categórico por categoría
            document.getElementById('categoryAnalysisContent').style.display = 'none';
            document.getElementById('quantitativeByCategory').style.display = 'none';
            document.getElementById('categoricalByCategory').style.display = 'block';

            // Obtener datos para análisis categórico por categoría
            const data = await this.getCategoricalByCategoryData(categoricalVariable);
            
            // Generar gráficos y tabla
            this.generateCategoryStackedBarChart(data, categoricalVariable);
            this.generateCategoryCrossTable(data);

        } catch (error) {
            this.app.showError(`Error en análisis por categoría: ${error.message}`);
        }
    },

    async getQuantitativeByCategoryData(categoricalVariable) {
        try {
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/quantitative-by-category`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    numeric_variable: this.selectedVariable,
                    categorical_variable: categoricalVariable
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            throw error;
        }
    },

    async getCategoricalByCategoryData(categoricalVariable) {
        try {
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/categorical-by-category`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    categorical_variable1: this.selectedVariable,
                    categorical_variable2: categoricalVariable
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            throw error;
        }
    },

    generateCategoryHistograms(data) {
        const container = document.getElementById('categoryHistograms');
        if (!container) return;

        container.innerHTML = '';

        const traces = data.categories.map((category, index) => ({
            x: data.histogram_data[category].values,
            type: 'histogram',
            name: category,
            opacity: 0.7,
            marker: {
                color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'][index % 6]
            }
        }));

        const layout = {
            title: `${this.selectedVariable} Histograms by ${data.categorical_variable}`,
            barmode: 'overlay',
            xaxis: { title: this.selectedVariable },
            yaxis: { title: 'Frequency' },
            height: 400
        };

        Plotly.newPlot(container, traces, layout, {responsive: true});
    },

    generateCategoryDensityCharts(data) {
        const container = document.getElementById('categoryDensityCharts');
        if (!container) return;

        container.innerHTML = '';

        const traces = data.categories.map((category, index) => ({
            x: data.density_data[category].x,
            y: data.density_data[category].y,
            type: 'scatter',
            mode: 'lines',
            name: category,
            line: {
                color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'][index % 6],
                width: 2
            }
        }));

        const layout = {
            title: `${this.selectedVariable} Density by ${data.categorical_variable}`,
            xaxis: { title: this.selectedVariable },
            yaxis: { title: 'Density' },
            height: 400
        };

        Plotly.newPlot(container, traces, layout, {responsive: true});
    },

    generateCategoryBoxplots(data) {
        const container = document.getElementById('categoryBoxplots');
        if (!container) return;

        container.innerHTML = '';

        const traces = data.categories.map((category, index) => ({
            y: data.boxplot_data[category].values,
            type: 'box',
            name: category,
            marker: {
                color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'][index % 6]
            }
        }));

        const layout = {
            title: `${this.selectedVariable} Boxplots by ${data.categorical_variable}`,
            yaxis: { title: this.selectedVariable },
            height: 400
        };

        Plotly.newPlot(container, traces, layout, {responsive: true});
    },

    generateCategoryStackedBarChart(data, selectedCategoricalVariable) {
        const container = document.getElementById('categoryStackedBarChart');
        if (!container) return;

        container.innerHTML = '';


        // Obtener las categorías de ambas variables
        const categories1 = data.categories; // Categorías de la variable 1 (eje X)
        const categories2 = data.cross_table[categories1[0]].categories; // Categorías de la variable 2 (columnas)


        const traces = categories2.map((category2, index) => ({
            x: categories1,
            y: categories1.map(cat1 => data.cross_table[cat1].frequencies[index] || 0),
            type: 'bar',
            name: category2,
            marker: {
                color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'][index % 6]
            }
        }));

        const layout = {
            title: `${this.selectedVariable} Distribution by ${selectedCategoricalVariable}`,
            barmode: 'stack',
            xaxis: { title: this.selectedVariable },
            yaxis: { title: 'Frequency' },
            height: 400,
            showlegend: true,
            legend: {
                x: 1.05,
                y: 1
            }
        };

        Plotly.newPlot(container, traces, layout, {responsive: true});
    },

    generateCategoryCrossTable(data) {
        const container = document.getElementById('categoryCrossTable');
        if (!container) return;


        // Obtener las categorías de ambas variables
        const categories1 = data.categories; // Categorías de la variable 1 (filas)
        const categories2 = data.cross_table[categories1[0]].categories; // Categorías de la variable 2 (columnas)


        const tableHTML = `
            <table class="table table-striped table-hover table-sm">
                <thead class="table-dark">
                    <tr>
                        <th>${this.selectedVariable} / ${data.categorical_variable2}</th>
                        ${categories2.map(cat => `<th>${cat}</th>`).join('')}
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${categories1.map(category => {
                        const row = categories2.map((cat2, index) => data.cross_table[category].frequencies[index] || 0);
                        const total = row.reduce((sum, val) => sum + val, 0);
                        return `
                            <tr>
                                <td><strong>${category}</strong></td>
                                ${row.map(val => `<td>${val.toLocaleString()}</td>`).join('')}
                                <td><strong>${total.toLocaleString()}</strong></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot class="table-info">
                    <tr>
                        <td><strong>Total</strong></td>
                        ${categories2.map((cat2, index) => {
                            const total = categories1.reduce((sum, cat1) => {
                                const freq = data.cross_table[cat1].frequencies[index] || 0;
                                return sum + freq;
                            }, 0);
                            return `<td><strong>${total.toLocaleString()}</strong></td>`;
                        }).join('')}
                        <td><strong>${data.total.toLocaleString()}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;

        container.innerHTML = tableHTML;
    },

    loadCategoricalVariablesForCategoryAnalysis() {
        const categoricalSelect = document.getElementById('categoricalVariableSelect');
        if (!categoricalSelect || !this.currentDataset) return;

        // Limpiar opciones existentes
        categoricalSelect.innerHTML = '<option value="">Selecciona una variable categórica...</option>';

        // Obtener variables categóricas del dataset
        let categoricalVariables = [];
        
        if (this.currentDataset.summary_stats) {
            // Usar summary_stats si está disponible
            categoricalVariables = Object.entries(this.currentDataset.summary_stats)
                .filter(([varName, stats]) => !this.isNumericVariable(stats.type))
                .map(([varName, stats]) => varName);
        } else if (this.currentDataset.variable_types) {
            // Usar variable_types como fallback
            categoricalVariables = Object.entries(this.currentDataset.variable_types)
                .filter(([varName, varType]) => !this.isNumericVariable(varType))
                .map(([varName, varType]) => varName);
        }

        // Agregar opciones al selector
        categoricalVariables.forEach(varName => {
            const option = document.createElement('option');
            option.value = varName;
            option.textContent = varName;
            categoricalSelect.appendChild(option);
        });
    },

    // Funciones para Relación entre Variables
    setupRelationshipAnalysis() {
        // Event listeners para los selectores de variables cuantitativas
        const var1Select = document.getElementById('quantitativeVariable1Select');
        const var2Select = document.getElementById('quantitativeVariable2Select');
        
        if (var1Select) {
            var1Select.addEventListener('change', () => this.handleRelationshipVariableSelection());
        }
        
        if (var2Select) {
            var2Select.addEventListener('change', () => this.handleRelationshipVariableSelection());
        }
    },

    handleRelationshipVariableSelection() {
        const var1 = document.getElementById('quantitativeVariable1Select').value;
        const var2 = document.getElementById('quantitativeVariable2Select').value;
        
        if (var1 && var2 && var1 !== var2) {
            this.showRelationshipAnalysis(var1, var2);
        } else {
            // Ocultar análisis si no hay dos variables diferentes seleccionadas
            document.getElementById('relationshipInitialContent').style.display = 'block';
            document.getElementById('relationshipAnalysis').style.display = 'none';
        }
    },

    async showRelationshipAnalysis(variable1, variable2) {
        try {
            // Ocultar contenido inicial y mostrar análisis
            document.getElementById('relationshipInitialContent').style.display = 'none';
            document.getElementById('relationshipAnalysis').style.display = 'block';

            // Obtener datos para análisis de correlación
            const data = await this.getRelationshipData(variable1, variable2);
            
            // Generar gráfico y tabla
            this.generateScatterPlot(data);
            this.generateCorrelationTable(data);
            this.generateCorrelationLegend();

        } catch (error) {
            this.app.showError(`Error en análisis de relación: ${error.message}`);
        }
    },

    async getRelationshipData(variable1, variable2) {
        try {
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/relationship`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    variable1: variable1,
                    variable2: variable2
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            throw error;
        }
    },

    generateScatterPlot(data) {
        const container = document.getElementById('scatterPlot');
        if (!container) return;

        container.innerHTML = '';

        // Datos de dispersión
        const scatterTrace = {
            x: data.scatter_data.x,
            y: data.scatter_data.y,
            type: 'scatter',
            mode: 'markers',
            marker: {
                color: '#36A2EB',
                size: 6,
                opacity: 0.7
            },
            name: 'Datos',
            showlegend: true
        };

        // Línea de correlación (regresión lineal)
        const xValues = data.scatter_data.x;
        const yValues = data.scatter_data.y;
        
        // Calcular regresión lineal
        const n = xValues.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Generar puntos para la línea de regresión
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const lineX = [minX, maxX];
        const lineY = lineX.map(x => slope * x + intercept);

        const lineTrace = {
            x: lineX,
            y: lineY,
            type: 'scatter',
            mode: 'lines',
            line: {
                color: '#FF6384',
                width: 2,
                dash: 'solid'
            },
            name: 'Línea de Correlación',
            showlegend: true
        };

        const layout = {
            title: `Diagrama de Dispersión: ${data.variable1} vs ${data.variable2}`,
            xaxis: { title: data.variable1 },
            yaxis: { title: data.variable2 },
            height: 400,
            showlegend: true,
            legend: {
                x: 1.05,
                y: 1
            }
        };

        Plotly.newPlot(container, [scatterTrace, lineTrace], layout, {responsive: true});
    },

    generateCorrelationTable(data) {
        const container = document.getElementById('correlationTable');
        if (!container) return;

        const pearsonStrength = this.getCorrelationStrength(data.pearson);
        const spearmanStrength = this.getCorrelationStrength(data.spearman);

        const tableHTML = `
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>Coeficiente</th>
                        <th>Valor</th>
                        <th>Fuerza de Asociación</th>
                        <th>Grado de Asociación</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Pearson</strong></td>
                        <td>${data.pearson.toFixed(4)}</td>
                        <td><span class="badge bg-${pearsonStrength.color}">${pearsonStrength.label}</span></td>
                        <td>${pearsonStrength.description}</td>
                    </tr>
                    <tr>
                        <td><strong>Spearman</strong></td>
                        <td>${data.spearman.toFixed(4)}</td>
                        <td><span class="badge bg-${spearmanStrength.color}">${spearmanStrength.label}</span></td>
                        <td>${spearmanStrength.description}</td>
                    </tr>
                </tbody>
            </table>
            <div class="alert alert-info mt-3">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Interpretación:</strong> 
                ${this.getCorrelationInterpretation(data.pearson, data.spearman)}
            </div>
        `;

        container.innerHTML = tableHTML;
    },

    generateCorrelationLegend() {
        const container = document.getElementById('correlationLegend');
        if (!container) return;

        const legendHTML = `
            <div class="correlation-range bg-danger text-white">
                <div class="correlation-strength">Muy Fuerte (0.8 - 1.0)</div>
                <div class="correlation-description">Correlación muy alta</div>
            </div>
            <div class="correlation-range bg-warning text-dark">
                <div class="correlation-strength">Fuerte (0.6 - 0.8)</div>
                <div class="correlation-description">Correlación alta</div>
            </div>
            <div class="correlation-range bg-info text-white">
                <div class="correlation-strength">Moderada (0.4 - 0.6)</div>
                <div class="correlation-description">Correlación media</div>
            </div>
            <div class="correlation-range bg-secondary text-white">
                <div class="correlation-strength">Débil (0.2 - 0.4)</div>
                <div class="correlation-description">Correlación baja</div>
            </div>
            <div class="correlation-range bg-primary text-white">
                <div class="correlation-strength">Muy Débil (0.0 - 0.2)</div>
                <div class="correlation-description">Correlación muy baja</div>
            </div>
            <div class="correlation-range bg-success text-white">
                <div class="correlation-strength">Sin Correlación (0.0)</div>
                <div class="correlation-description">No hay relación lineal</div>
            </div>
        `;

        container.innerHTML = legendHTML;
    },

    getCorrelationStrength(correlation) {
        const absCorr = Math.abs(correlation);
        
        if (absCorr >= 0.8) {
            return { label: 'Muy Fuerte', color: 'danger', description: 'Correlación muy alta' };
        } else if (absCorr >= 0.6) {
            return { label: 'Fuerte', color: 'warning', description: 'Correlación alta' };
        } else if (absCorr >= 0.4) {
            return { label: 'Moderada', color: 'info', description: 'Correlación media' };
        } else if (absCorr >= 0.2) {
            return { label: 'Débil', color: 'secondary', description: 'Correlación baja' };
        } else if (absCorr > 0) {
            return { label: 'Muy Débil', color: 'primary', description: 'Correlación muy baja' };
        } else {
            return { label: 'Sin Correlación', color: 'success', description: 'No hay relación lineal' };
        }
    },

    getCorrelationInterpretation(pearson, spearman) {
        const pearsonStrength = this.getCorrelationStrength(pearson);
        const spearmanStrength = this.getCorrelationStrength(spearman);
        
        let interpretation = `El coeficiente de Pearson (${pearson.toFixed(4)}) indica una correlación ${pearsonStrength.label.toLowerCase()}. `;
        interpretation += `El coeficiente de Spearman (${spearman.toFixed(4)}) indica una correlación ${spearmanStrength.label.toLowerCase()}. `;
        
        if (Math.abs(pearson - spearman) > 0.1) {
            interpretation += 'La diferencia entre ambos coeficientes sugiere que la relación puede no ser lineal.';
        } else {
            interpretation += 'Ambos coeficientes son similares, indicando una relación lineal.';
        }
        
        return interpretation;
    },

    loadQuantitativeVariablesForRelationship() {
        const var1Select = document.getElementById('quantitativeVariable1Select');
        const var2Select = document.getElementById('quantitativeVariable2Select');
        
        if (!var1Select || !var2Select || !this.currentDataset) return;

        // Limpiar opciones existentes
        var1Select.innerHTML = '<option value="">Selecciona una variable cuantitativa...</option>';
        var2Select.innerHTML = '<option value="">Selecciona una variable cuantitativa...</option>';

        // Obtener variables cuantitativas del dataset
        let quantitativeVariables = [];
        
        if (this.currentDataset.summary_stats) {
            // Usar summary_stats si está disponible
            quantitativeVariables = Object.entries(this.currentDataset.summary_stats)
                .filter(([varName, stats]) => this.isNumericVariable(stats.type))
                .map(([varName, stats]) => varName);
        } else if (this.currentDataset.variable_types) {
            // Usar variable_types como fallback
            quantitativeVariables = Object.entries(this.currentDataset.variable_types)
                .filter(([varName, varType]) => this.isNumericVariable(varType))
                .map(([varName, varType]) => varName);
        }

        // Agregar opciones a ambos selectores
        quantitativeVariables.forEach(varName => {
            const option1 = document.createElement('option');
            option1.value = varName;
            option1.textContent = varName;
            var1Select.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = varName;
            option2.textContent = varName;
            var2Select.appendChild(option2);
        });
    },

    // Funciones para Matriz de Correlación
    setupCorrelationMatrix() {
        // Event listeners para los botones de la matriz de correlación
        const generateBtn = document.getElementById('generatePairPlot');
        const selectAllBtn = document.getElementById('selectAllQuantitative');
        const clearBtn = document.getElementById('clearSelection');
        const resetBtn = document.getElementById('resetPairPlotConfig');
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.handleGeneratePairPlot());
        }
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAllQuantitativeVariables());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearQuantitativeSelection());
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetPairPlotConfiguration());
        }
        

        
        // Cargar variables cuando se hace clic en la pestaña de correlación múltiple
        document.addEventListener('click', (e) => {
            if (e.target && e.target.getAttribute('href') === '#correlation-matrix') {
                setTimeout(() => {
                    if (this.currentDataset) {
                        this.loadCategoricalVariablesForHue();
                    }
                }, 200);
            }
        });
        
        // Cargar variables cuando se hace clic en la pestaña de correlación múltiple
        document.addEventListener('click', (e) => {
            if (e.target && e.target.getAttribute('href') === '#correlation-matrix') {
                setTimeout(() => {
                    if (this.currentDataset) {
                        this.loadQuantitativeVariablesForCorrelationMatrix();
                        this.loadCategoricalVariablesForHue();
                    }
                }, 100);
            }
        });
        
        // Observer para detectar cuando se muestra el contenido de la pestaña
        const correlationContent = document.getElementById('correlation-matrix');
        if (correlationContent) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const isVisible = correlationContent.classList.contains('active') || 
                                        correlationContent.classList.contains('show');
                        if (isVisible && this.currentDataset) {
                            setTimeout(() => {
                                this.loadQuantitativeVariablesForCorrelationMatrix();
                                this.loadCategoricalVariablesForHue();
                            }, 200);
                        }
                    }
                });
            });
            
            observer.observe(correlationContent, {
                attributes: true,
                attributeFilter: ['class']
            });
        } else {
        }
    },

    handleGeneratePairPlot() {
        
        const checkboxes = document.querySelectorAll('#correlationVariablesCheckboxes input[type="checkbox"]:checked');
        
        const selectedVariables = Array.from(checkboxes).map(checkbox => checkbox.value);
        
        if (selectedVariables.length < 2) {
            this.app.showError('Selecciona al menos 2 variables para generar el pair plot');
            return;
        }
        
        this.showPairPlotAnalysis(selectedVariables);
    },





    resetPairPlotConfiguration() {
        // Restablecer todos los controles a sus valores por defecto
        document.getElementById('hueVariableSelect').value = '';
        document.getElementById('paletteSelect').value = 'husl';
        document.getElementById('kindSelect').value = 'scatter';
        document.getElementById('diagKindSelect').value = 'auto';
        document.getElementById('heightInput').value = '2.5';
        document.getElementById('aspectInput').value = '1';
        document.getElementById('titleInput').value = 'Pair Plot - Matriz de Dispersión';
        document.getElementById('cornerCheck').checked = false;
        document.getElementById('dropnaCheck').checked = true;
        document.getElementById('markersSelect').value = '';
        
        this.app.showSuccess('Configuración restablecida a valores por defecto');
    },

    selectAllQuantitativeVariables() {
        const checkboxes = document.querySelectorAll('#correlationVariablesCheckboxes input[type="checkbox"]');
        const checkboxItems = document.querySelectorAll('#correlationVariablesCheckboxes .variable-checkbox-item');
        
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = true;
            checkboxItems[index].classList.add('selected');
        });
    },

    clearQuantitativeSelection() {
        const checkboxes = document.querySelectorAll('#correlationVariablesCheckboxes input[type="checkbox"]');
        const checkboxItems = document.querySelectorAll('#correlationVariablesCheckboxes .variable-checkbox-item');
        
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = false;
            checkboxItems[index].classList.remove('selected');
        });
    },

    async showPairPlotAnalysis(variables) {
        try {
            // Ocultar contenido inicial y mostrar análisis
            document.getElementById('correlationInitialContent').style.display = 'none';
            document.getElementById('correlationMatrixAnalysis').style.display = 'block';

            // Obtener parámetros de configuración
            const config = this.getPairPlotConfiguration();
            
            // Obtener datos para análisis de pair plot
            const data = await this.getPairPlotData(variables, config);
            
            // Generar pair plot y matriz
            this.generatePairPlot(data);
            this.generateCorrelationMatrixTable(data);

        } catch (error) {
            this.app.showError(`Error en análisis de pair plot: ${error.message}`);
        }
    },

    getPairPlotConfiguration() {
        
        const config = {
            hue: document.getElementById('hueVariableSelect').value || null,
            palette: document.getElementById('paletteSelect').value,
            kind: document.getElementById('kindSelect').value,
            diag_kind: document.getElementById('diagKindSelect').value || null,
            height: parseFloat(document.getElementById('heightInput').value),
            aspect: parseFloat(document.getElementById('aspectInput').value),
            title: document.getElementById('titleInput').value,
            corner: document.getElementById('cornerCheck').checked,
            dropna: document.getElementById('dropnaCheck').checked,
            markers: document.getElementById('markersSelect').value || null
        };


        // Limpiar valores nulos o vacíos
        Object.keys(config).forEach(key => {
            if (config[key] === '' || config[key] === null) {
                delete config[key];
            }
        });

        
        return config;
    },

    async getPairPlotData(variables, config) {
        try {
            
            // Crear una copia del config sin la propiedad variables
            const configWithoutVariables = { ...config };
            delete configWithoutVariables.variables;
            
            const requestBody = {
                variables: variables,
                ...configWithoutVariables
            };


            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/pairplot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });


            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            return result.data;
        } catch (error) {
            throw error;
        }
    },

    async getCorrelationMatrixData(variables) {
        try {
            const response = await fetch(`/api/outliers/${this.currentDataset.filename}/correlation-matrix`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    variables: variables
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            throw error;
        }
    },

    generatePairPlot(data) {
        const container = document.getElementById('pairPlot');
        if (!container) return;

        container.innerHTML = '';

        // Mostrar la imagen del pairplot generada por seaborn
        if (data.pairplot_image) {
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${data.pairplot_image}`;
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.maxWidth = '800px';
            img.alt = 'Pair Plot - Matriz de Dispersión';
            img.className = 'img-fluid';
            
            container.appendChild(img);
        } else {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                    <p>No se pudo generar el pair plot</p>
                </div>
            `;
        }
    },

    generateCorrelationMatrixTable(data) {
        const container = document.getElementById('correlationMatrixTable');
        if (!container) return;

        const variables = data.variables;
        const correlationMatrix = data.correlation_matrix;
        const significanceMatrix = data.significance_matrix;

        let tableHTML = `
            <table class="table table-striped table-hover table-sm">
                <thead class="table-dark">
                    <tr>
                        <th>Variable</th>
                        ${variables.map(variable => `<th>${variable}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        for (let i = 0; i < variables.length; i++) {
            tableHTML += `<tr>`;
            tableHTML += `<td><strong>${variables[i]}</strong></td>`;
            
            for (let j = 0; j < variables.length; j++) {
                if (i === j) {
                    tableHTML += `<td class="diagonal">1.000</td>`;
                } else {
                    const corrValue = correlationMatrix[i][j];
                    const significance = significanceMatrix[i][j];
                    const significanceStars = this.getSignificanceStars(significance);
                    
                    tableHTML += `
                        <td>
                            <div class="correlation-value">${corrValue.toFixed(3)}</div>
                            <div class="correlation-significance">${significanceStars}</div>
                        </td>
                    `;
                }
            }
            tableHTML += `</tr>`;
        }

        tableHTML += `
                </tbody>
            </table>
            <div class="alert alert-info mt-3">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Leyenda de significancia:</strong> 
                *** p < 0.001, ** p < 0.01, * p < 0.05
            </div>
        `;

        container.innerHTML = tableHTML;
    },

    getSignificanceStars(pValue) {
        if (pValue < 0.001) return '***';
        if (pValue < 0.01) return '**';
        if (pValue < 0.05) return '*';
        return '';
    },

    loadQuantitativeVariablesForCorrelationMatrix() {
        
        const container = document.getElementById('correlationVariablesCheckboxes');
        
        if (!container) {
            return;
        }
        
        if (!this.currentDataset) {
            return;
        }


        // Limpiar contenedor existente
        container.innerHTML = '';

        // Obtener variables cuantitativas del dataset
        let quantitativeVariables = [];
        
        
        if (this.currentDataset.summary_stats && Object.keys(this.currentDataset.summary_stats).length > 0) {
            // Usar summary_stats si está disponible
            quantitativeVariables = Object.entries(this.currentDataset.summary_stats)
                .filter(([varName, stats]) => {
                    return this.isNumericVariable(stats.type);
                })
                .map(([varName, stats]) => ({ name: varName, type: stats.type }));
        } else if (this.currentDataset.variable_types && Object.keys(this.currentDataset.variable_types).length > 0) {
            // Usar variable_types como fallback
            quantitativeVariables = Object.entries(this.currentDataset.variable_types)
                .filter(([varName, varType]) => {
                    return this.isNumericVariable(varType);
                })
                .map(([varName, varType]) => ({ name: varName, type: varType }));
        } else {
        }


        if (quantitativeVariables.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-3">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No se encontraron variables cuantitativas en este dataset
                    <br><small>Verifica que el dataset contenga variables numéricas</small>
                </div>
            `;
            return;
        }

        // Crear checkboxes para cada variable
        quantitativeVariables.forEach((variable, index) => {
            const colDiv = document.createElement('div');
            colDiv.className = 'col-md-6 col-lg-4 mb-2';
            
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'variable-checkbox-item';
            checkboxDiv.innerHTML = `
                <input type="checkbox" id="var_${index}" value="${variable.name}" class="form-check-input">
                <label for="var_${index}" class="form-check-label">
                    <div class="variable-name">${variable.name}</div>
                    <div class="variable-type">${this.getVariableTypeLabel(variable.type)}</div>
                </label>
            `;
            
            // Event listener para cambiar estilo al seleccionar
            const checkbox = checkboxDiv.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    checkboxDiv.classList.add('selected');
                } else {
                    checkboxDiv.classList.remove('selected');
                }
            });
            
            colDiv.appendChild(checkboxDiv);
            container.appendChild(colDiv);
        });

        
        // Cargar también las variables categóricas para el selector de hue
        this.loadCategoricalVariablesForHue();
    },

    getVariableTypeLabel(type) {
        switch(type) {
            case 'cuantitativa_continua':
                return 'Numérica Continua';
            case 'cuantitativa_discreta':
                return 'Numérica Discreta';
            case 'numeric':
            case 'integer':
            case 'float':
                return 'Numérica';
            default:
                return type;
        }
    },

    loadCategoricalVariablesForHue() {
        
        const hueSelect = document.getElementById('hueVariableSelect');
        
        if (!hueSelect) {
            // Guardar las variables para cargarlas cuando el selector esté disponible
            this.pendingHueVariables = this.getCategoricalVariables();
            return;
        }
        
        if (!this.currentDataset) {
            return;
        }


        // Limpiar opciones existentes
        hueSelect.innerHTML = '<option value="">Sin variable hue</option>';

        // Obtener variables categóricas del dataset
        let categoricalVariables = this.getCategoricalVariables();


        // Agregar opciones al selector
        categoricalVariables.forEach(varName => {
            const option = document.createElement('option');
            option.value = varName;
            option.textContent = varName;
            hueSelect.appendChild(option);
        });

        
        // Verificar que las opciones se agregaron visualmente
        
        // Mostrar las primeras 3 opciones para verificar
        for (let i = 0; i < Math.min(3, hueSelect.options.length); i++) {
        }
        
        // Verificar si el selector está visible
        
    },
    

    
    getCategoricalVariables() {
        if (!this.currentDataset) {
            return [];
        }
        
        let categoricalVariables = [];
        
        if (this.currentDataset.summary_stats) {
            // Usar summary_stats si está disponible
            categoricalVariables = Object.entries(this.currentDataset.summary_stats)
                .filter(([varName, stats]) => {
                    const isNumeric = this.isNumericVariable(stats.type);
                    return !isNumeric;
                })
                .map(([varName, stats]) => varName);
        } else if (this.currentDataset.variable_types) {
            // Usar variable_types como fallback
            categoricalVariables = Object.entries(this.currentDataset.variable_types)
                .filter(([varName, varType]) => {
                    const isNumeric = this.isNumericVariable(varType);
                    return !isNumeric;
                })
                .map(([varName, varType]) => varName);
        }
        
        return categoricalVariables;
    },

    // ===== FUNCIONES PARA LA SECCIÓN DE CONFIGURACIÓN DEL ANÁLISIS =====

    loadSubjectIdVariables() {
        
        const subjectIdSelect = document.getElementById('subjectIdSelect');
        
        if (!subjectIdSelect) {
            return;
        }

        if (!this.currentDataset) {
            return;
        }


        // Limpiar opciones existentes
        subjectIdSelect.innerHTML = '<option value="">Selecciona la variable ID...</option>';

            // Obtener todas las variables del dataset
        let allVariables = [];
        
        if (this.currentDataset.summary_stats) {
            allVariables = Object.keys(this.currentDataset.summary_stats);
        } else if (this.currentDataset.variable_types) {
            allVariables = Object.keys(this.currentDataset.variable_types);
        }


            // Agregar opciones al selector
        allVariables.forEach(varName => {
                const option = document.createElement('option');
                option.value = varName;
                option.textContent = varName;
                subjectIdSelect.appendChild(option);
            });

    },

    setupAnalysisConfigurationListeners() {

        // Event listener para estrategia de combinación
        const combineStrategy = document.getElementById('combineStrategy');
        if (combineStrategy) {
            // Ejecutar con la estrategia actual (por defecto 'adaptive')
            this.handleStrategyChange(combineStrategy.value);
            
            combineStrategy.addEventListener('change', (e) => {
                this.handleStrategyChange(e.target.value);
            });
        }

        // Event listener para mínimo métodos univariados
        const minUnivariate = document.getElementById('minUnivariate');
        if (minUnivariate) {
            minUnivariate.addEventListener('change', (e) => {
                this.handleMinUnivariateChange(e.target.value);
            });
        }

        // Event listener para mínimo métodos multivariados
        const minMultivariate = document.getElementById('minMultivariate');
        if (minMultivariate) {
            minMultivariate.addEventListener('change', (e) => {
                this.handleMinMultivariateChange(e.target.value);
            });
        }

        // Event listener para el botón de detección de outliers
        const detectOutliersBtn = document.getElementById('detectOutliersBtn');
        if (detectOutliersBtn) {
            detectOutliersBtn.addEventListener('click', () => {
                this.handleDetectOutliersClick();
            });
        }

    },

    handleStrategyChange(strategy) {
        this.updateStrategyDescription(strategy);
        
        // Mostrar/ocultar campos de parámetros según la estrategia
        const votingParamsContainer = document.getElementById('votingStrategyParams');
        const minUnivariateInput = document.getElementById('minUnivariate');
        const minMultivariateInput = document.getElementById('minMultivariate');
        
        if (votingParamsContainer) {
            // Solo mostrar estos campos para la estrategia "voting"
            if (strategy === 'voting') {
                votingParamsContainer.style.display = 'block';
                if (minUnivariateInput) {
                    minUnivariateInput.disabled = false;
                    minUnivariateInput.classList.remove('bg-light');
                }
                if (minMultivariateInput) {
                    minMultivariateInput.disabled = false;
                    minMultivariateInput.classList.remove('bg-light');
                }
            } else {
                votingParamsContainer.style.display = 'none';
                if (minUnivariateInput) {
                    minUnivariateInput.disabled = true;
                    minUnivariateInput.classList.add('bg-light');
                }
                if (minMultivariateInput) {
                    minMultivariateInput.disabled = true;
                    minMultivariateInput.classList.add('bg-light');
                }
            }
        }
    },

    handleMinUnivariateChange(value) {
        const minUniDisplay = document.getElementById('minUniDisplay');
        if (minUniDisplay) {
            minUniDisplay.textContent = value;
        }
    },

    handleMinMultivariateChange(value) {
        const minMultiDisplay = document.getElementById('minMultiDisplay');
        if (minMultiDisplay) {
            minMultiDisplay.textContent = value;
        }
    },

    async handleDetectOutliersClick() {
        const config = this.getAnalysisConfiguration();
        
        // Validar configuración
        if (!this.currentDataset) {
            this.app.showError('No hay dataset seleccionado');
            return;
        }
        
        if (!config.subjectId) {
            this.app.showError('Debe seleccionar un identificador del sujeto');
            return;
        }
        
        const button = document.getElementById('detectOutliersBtn');
        const originalText = '<i class="fas fa-play me-2"></i>Ejecutar Detección de Outliers';
        
        // Función para restaurar botón
        const restoreButton = () => {
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        };
        
        try {
            // Mostrar loading
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Ejecutando Detección...';
            button.disabled = true;
            
            // Ejecutar detección de outliers
            const results = await this.executeOutlierDetection(config);
            
            // Mostrar resultados
            if (results) {
                await this.displayOutlierResults(results);
                this.app.showSuccess('Detección de outliers completada exitosamente');
                
                // Abrir automáticamente el primer expander para mostrar los badges
                setTimeout(() => {
                    const firstExpander = document.querySelector('#iqrResults');
                    if (firstExpander) {
                        const bsCollapse = new bootstrap.Collapse(firstExpander, {
                            show: true
                        });
                    }
                }, 1000);
            } else {
                throw new Error('No se recibieron resultados válidos del servidor');
            }
            
        } catch (error) {
            this.app.showError(`Error en la detección de outliers: ${error.message}`);
        }
        
        // Restaurar botón siempre, con un pequeño delay para mejor UX
        setTimeout(restoreButton, 500);
    },

    getAnalysisConfiguration() {
        const combineStrategy = document.getElementById('combineStrategy')?.value || 'adaptive';
        const subjectId = document.getElementById('subjectIdSelect')?.value || '';
        const minUnivariate = parseInt(document.getElementById('minUnivariate')?.value || '2');
        const minMultivariate = parseInt(document.getElementById('minMultivariate')?.value || '1');

        return {
            combineStrategy,
            subjectId,
            minUnivariate,
            minMultivariate
        };
    },

    updateStrategyDescription(strategy) {
        const strategyDescription = document.getElementById('strategyDescription');
        if (!strategyDescription) return;

        const descriptions = {
            adaptive: `<div><strong>Adaptativa (Recomendada para Investigación Clínica):</strong> Se adapta automáticamente según la normalidad de los datos. Si los datos son normales, prioriza métodos paramétricos (Z-Score, Mahalanobis). Si no son normales, prioriza métodos no paramétricos (IQR, MAD, LOF, Isolation Forest). Siempre incluye outliers detectados por pruebas de hipótesis (alta confianza estadística).</div>
                       <div class="mt-1"><strong>Votación:</strong> Un outlier se considera final si es detectado por al menos <span id="minUniDisplay">2</span> métodos univariados Y al menos <span id="minMultiDisplay">1</span> método multivariado. Además, se incluyen todos los outliers detectados por las pruebas de hipótesis (Grubbs, Dixon, Rosner).</div>
                       <div class="mt-1"><strong>Unión:</strong> Un outlier se considera final si es detectado por cualquier método univariado, multivariado o prueba de hipótesis.</div>
                       <div class="mt-1"><strong>Intersección:</strong> Un outlier se considera final si es detectado por TODOS los métodos univariados Y TODOS los métodos multivariados Y TODAS las pruebas de hipótesis.</div>`,
            voting: `<div><strong>Votación:</strong> Un outlier se considera final si es detectado por al menos <span id="minUniDisplay">2</span> métodos univariados Y al menos <span id="minMultiDisplay">1</span> método multivariado. Además, se incluyen todos los outliers detectados por las pruebas de hipótesis (Grubbs, Dixon, Rosner).</div>
                     <div class="mt-1"><strong>Adaptativa:</strong> Se adapta automáticamente según la normalidad de los datos. Si los datos son normales, prioriza métodos paramétricos. Si no son normales, prioriza métodos no paramétricos. Siempre incluye outliers detectados por pruebas de hipótesis.</div>
                     <div class="mt-1"><strong>Unión:</strong> Un outlier se considera final si es detectado por cualquier método univariado, multivariado o prueba de hipótesis.</div>
                     <div class="mt-1"><strong>Intersección:</strong> Un outlier se considera final si es detectado por TODOS los métodos univariados Y TODOS los métodos multivariados Y TODAS las pruebas de hipótesis.</div>`,
            union: `<div><strong>Unión:</strong> Un outlier se considera final si es detectado por cualquier método univariado, multivariado o prueba de hipótesis.</div>
                    <div class="mt-1"><strong>Adaptativa:</strong> Se adapta automáticamente según la normalidad de los datos. Si los datos son normales, prioriza métodos paramétricos. Si no son normales, prioriza métodos no paramétricos. Siempre incluye outliers detectados por pruebas de hipótesis.</div>
                    <div class="mt-1"><strong>Votación:</strong> Un outlier se considera final si es detectado por al menos <span id="minUniDisplay">2</span> métodos univariados Y al menos <span id="minMultiDisplay">1</span> método multivariado. Además, se incluyen todos los outliers detectados por las pruebas de hipótesis (Grubbs, Dixon, Rosner).</div>
                    <div class="mt-1"><strong>Intersección:</strong> Un outlier se considera final si es detectado por TODOS los métodos univariados Y TODOS los métodos multivariados Y TODAS las pruebas de hipótesis.</div>`,
            intersection: `<div><strong>Intersección:</strong> Un outlier se considera final si es detectado por TODOS los métodos univariados Y TODOS los métodos multivariados Y TODAS las pruebas de hipótesis.</div>
                          <div class="mt-1"><strong>Adaptativa:</strong> Se adapta automáticamente según la normalidad de los datos. Si los datos son normales, prioriza métodos paramétricos. Si no son normales, prioriza métodos no paramétricos. Siempre incluye outliers detectados por pruebas de hipótesis.</div>
                          <div class="mt-1"><strong>Votación:</strong> Un outlier se considera final si es detectado por al menos <span id="minUniDisplay">2</span> métodos univariados Y al menos <span id="minMultiDisplay">1</span> método multivariado. Además, se incluyen todos los outliers detectados por las pruebas de hipótesis (Grubbs, Dixon, Rosner).</div>
                          <div class="mt-1"><strong>Unión:</strong> Un outlier se considera final si es detectado por cualquier método univariado, multivariado o prueba de hipótesis.</div>`
        };

        strategyDescription.innerHTML = descriptions[strategy] || descriptions.adaptive;
    },

    // ===== FUNCIONES PARA DETECCIÓN DE OUTLIERS =====

    validateDetectionConfig(config) {
        /**
         * Valida la configuración de detección antes de enviar al servidor.
         * Retorna objeto con {valid: boolean, errors: string[]}
         */
        const errors = [];
        
        // Validar que hay un dataset seleccionado
        if (!this.currentDataset || !this.currentDataset.filename) {
            errors.push('No hay un dataset seleccionado');
        }
        
        // Validar estrategia de combinación
        const validStrategies = ['voting', 'adaptive', 'union', 'intersection'];
        if (!config.combineStrategy || !validStrategies.includes(config.combineStrategy)) {
            errors.push('Estrategia de combinación inválida');
        }
        
        // Validar minUnivariate
        const minUni = parseInt(config.minUnivariate);
        if (isNaN(minUni) || minUni < 1 || minUni > 10) {
            errors.push('El mínimo de métodos univariados debe ser un número entre 1 y 10');
        }
        
        // Validar minMultivariate
        const minMulti = parseInt(config.minMultivariate);
        if (isNaN(minMulti) || minMulti < 1 || minMulti > 10) {
            errors.push('El mínimo de métodos multivariados debe ser un número entre 1 y 10');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    async executeOutlierDetection(config) {
        // Validar configuración antes de enviar al servidor
        const validation = this.validateDetectionConfig(config);
        if (!validation.valid) {
            const errorMessage = validation.errors.join('. ');
            this.app.showError(`Error de validación: ${errorMessage}`);
            throw new Error(errorMessage);
        }
        
        const filename = this.currentDataset.filename;
        const url = `/api/outliers/${encodeURIComponent(filename)}/detect`;
        
        
        const requestBody = {
            combineStrategy: config.combineStrategy,
            subjectId: config.subjectId,
            minUnivariate: config.minUnivariate,
            minMultivariate: config.minMultivariate
        };
        
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });


        if (!response.ok) {
            const errorText = await response.text();
            let error;
            try {
                error = JSON.parse(errorText);
            } catch (e) {
                error = { detail: errorText };
            }
            throw new Error(error.detail || 'Error en la detección de outliers');
        }

        const result = await response.json();
        return result.results; // Devolver solo la parte de results
    },

    async displayOutlierResults(results) {
        if (results.methods?.hypothesis_tests) {
            if (results.methods.hypothesis_tests.grubbs) {
            }
            if (results.methods.hypothesis_tests.rosner) {
            }
        }
        
        // Mostrar la sección de resultados
        const resultsSection = document.getElementById('outlierResultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
            
            // Scroll suave hacia los resultados
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Inicializar accordions de Bootstrap
        this.initializeAccordions();

        // Actualizar cards de resumen
        this.updateSummaryCards(results);

        // Actualizar evaluación de normalidad y estrategia aplicada
        this.updateNormalityAssessment(results);

        // Actualizar métodos univariados
        this.updateUnivariateResults(results.methods.univariate);

        // Actualizar métodos multivariados
        this.updateMultivariateResults(results.methods.multivariate);

        // Actualizar pruebas de hipótesis
        this.updateHypothesisTests(results.methods.hypothesis_tests);

        // Actualizar panel final de outliers
        this.updateFinalOutliers(results.final_outliers, results);

        // Guardar resultados en localStorage para uso en análisis y visualización
        if (this.currentDataset) {
            try {
                const storageKey = `outlier_results_${this.currentDataset.filename}`;
                const currentDatasetKey = 'current_outlier_dataset';
                const sessionKey = 'outlier_session_id';
                
                
                // Obtener la sesión del servidor
                const serverSessionResponse = await fetch('/api/server-session');
                let serverSessionId = null;
                if (serverSessionResponse.ok) {
                    const serverSession = await serverSessionResponse.json();
                    serverSessionId = serverSession.session_id;
                } else {
                }
                
                // Guardar los resultados específicos del dataset
                localStorage.setItem(storageKey, JSON.stringify(results));
                
                // Guardar información del dataset actual
                const currentDatasetInfo = {
                    filename: this.currentDataset.filename,
                    rows: this.currentDataset.rows,
                    columns: this.currentDataset.columns,
                    uploaded_at: this.currentDataset.uploaded_at,
                    timestamp: Date.now(),
                    sessionId: serverSessionId || Date.now().toString(),
                    totalRecords: results.total_records,
                    outliersDetected: results.outliers_detected
                };
                localStorage.setItem(currentDatasetKey, JSON.stringify(currentDatasetInfo));
                
                // Guardar el ID de sesión del servidor
                if (serverSessionId) {
                    localStorage.setItem(sessionKey, serverSessionId);
                }
                
                
                // Verificar que se guardó correctamente
                const stored = localStorage.getItem(storageKey);
            } catch (error) {
            }
        } else {
        }
    },

    initializeAccordions() {
        
        // Verificar si Bootstrap está disponible
        if (typeof bootstrap !== 'undefined') {
            // Inicializar todos los accordions
            const accordionElements = document.querySelectorAll('.accordion');
            accordionElements.forEach(accordion => {
                const bsAccordion = new bootstrap.Collapse(accordion, {
                    toggle: false
                });
            });
            
            // También inicializar los botones de accordion individuales
            const accordionButtons = document.querySelectorAll('.accordion-button');
            accordionButtons.forEach(button => {
                // Asegurar que los botones tengan los atributos correctos
                if (!button.hasAttribute('aria-expanded')) {
                    button.setAttribute('aria-expanded', 'false');
                }
            });
        } else {
        }
    },

    updateSummaryCards(results) {
        // Total de registros
        const totalRecords = document.getElementById('totalRecords');
        if (totalRecords) {
            totalRecords.textContent = results.total_records.toLocaleString();
        }

        // Outliers detectados
        const outliersDetected = document.getElementById('outliersDetected');
        if (outliersDetected) {
            outliersDetected.textContent = results.outliers_detected.toLocaleString();
        }

        // Porcentaje de outliers
        const outlierPercentage = document.getElementById('outlierPercentage');
        if (outlierPercentage) {
            outlierPercentage.textContent = `${results.outlier_percentage}%`;
        }

        // Estrategia de combinación
        const combinationStrategy = document.getElementById('combinationStrategy');
        if (combinationStrategy) {
            const strategyNames = {
                'voting': 'Votación',
                'adaptive': 'Adaptativa',
                'union': 'Unión',
                'intersection': 'Intersección'
            };
            const strategyApplied = results.strategy_applied || results.combination_strategy;
            combinationStrategy.textContent = strategyNames[strategyApplied] || strategyApplied;
        }
    },

    updateNormalityAssessment(results) {
        const section = document.getElementById('normalityAssessmentSection');
        const content = document.getElementById('normalityAssessmentContent');
        
        if (!section || !content) return;
        
        // Mostrar sección solo si hay información de normalidad (estrategia adaptativa)
        if (results.normality_assessment && results.strategy_applied === 'adaptive') {
            section.style.display = 'block';
            
            const normality = results.normality_assessment;
            const isNormal = normality.data_is_generally_normal;
            const normalRatio = normality.normal_ratio;
            const variablesEvaluated = normality.variables_evaluated || 0;
            const strategyDescription = results.strategy_description || '';
            
            // Determinar color y icono según normalidad
            const assessmentColor = isNormal ? 'success' : 'warning';
            const assessmentIcon = isNormal ? 'fa-check-circle' : 'fa-exclamation-triangle';
            const assessmentText = isNormal ? 'Datos Normales' : 'Datos No Normales';
            
            // Criterios aplicados según normalidad
            let criteriaApplied = '';
            if (isNormal) {
                criteriaApplied = `
                    <ul class="mb-0">
                        <li><strong>Nivel 1:</strong> Cualquier prueba de hipótesis (ALTA CONFIANZA)</li>
                        <li><strong>Nivel 2:</strong> Al menos 1 método paramétrico univariado Y 1 multivariado paramétrico</li>
                        <li><strong>Nivel 3:</strong> Al menos 2 métodos no paramétricos univariados (consenso robusto)</li>
                        <li><strong>Nivel 4:</strong> Al menos 1 método multivariado no paramétrico</li>
                    </ul>
                `;
            } else {
                criteriaApplied = `
                    <ul class="mb-0">
                        <li><strong>Nivel 1:</strong> Cualquier prueba de hipótesis (si validada)</li>
                        <li><strong>Nivel 2:</strong> Al menos 2 métodos no paramétricos univariados (consenso robusto)</li>
                        <li><strong>Nivel 3:</strong> Al menos 1 método multivariado no paramétrico</li>
                        <li><strong>Nivel 4:</strong> Métodos paramétricos solo si validados individualmente</li>
                    </ul>
                `;
            }
            
            content.innerHTML = `
                <div class="row">
                    <div class="col-md-12 mb-3">
                        <div class="alert alert-${assessmentColor}">
                            <h6 class="alert-heading">
                                <i class="fas ${assessmentIcon} me-2"></i>
                                Resultado de Evaluación de Normalidad: <strong>${assessmentText}</strong>
                            </h6>
                            <hr>
                            <div class="row">
                                <div class="col-md-6">
                                    <p class="mb-2">
                                        <strong>Variables Evaluadas:</strong> ${variablesEvaluated} variables
                                    </p>
                                    <p class="mb-2">
                                        <strong>Porcentaje de Variables Normales:</strong> 
                                        <span class="badge bg-${assessmentColor}">${normalRatio !== null && normalRatio !== undefined ? normalRatio.toFixed(1) : 'N/A'}%</span>
                                    </p>
                                    <p class="mb-0">
                                        <strong>Decisión:</strong> 
                                        ${isNormal 
                                            ? 'Los datos son <strong>generalmente normales</strong> (≥60% de variables normales). Se priorizan métodos <strong>paramétricos</strong>.' 
                                            : 'Los datos <strong>NO son generalmente normales</strong> (<60% de variables normales). Se priorizan métodos <strong>no paramétricos</strong>.'}
                                    </p>
                                </div>
                                <div class="col-md-6">
                                    <p class="mb-2">
                                        <strong>Estrategia Aplicada:</strong> 
                                        <span class="badge bg-info">Adaptativa</span>
                                    </p>
                                    <p class="mb-0 small text-muted">
                                        ${strategyDescription}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-12">
                        <div class="card border-secondary">
                            <div class="card-header bg-light">
                                <h6 class="mb-0">
                                    <i class="fas fa-list-check me-2"></i>
                                    Criterios de Inclusión Aplicados
                                </h6>
                            </div>
                            <div class="card-body">
                                ${criteriaApplied}
                                <div class="mt-3">
                                    <small class="text-muted">
                                        <i class="fas fa-info-circle me-1"></i>
                                        <strong>Nota:</strong> Los outliers detectados por pruebas de hipótesis siempre se incluyen debido a su alta confianza estadística.
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Ocultar sección si no es estrategia adaptativa
            section.style.display = 'none';
        }
    },

    updateUnivariateResults(univariateResults) {
        // IQR Method
        this.updateMethodResults('iqr', univariateResults.iqr || { outliers: [], count: 0 });
        
        // Z-Score Method
        this.updateMethodResults('zscore', univariateResults.zscore || { outliers: [], count: 0 });
        
        // MAD Method
        this.updateMethodResults('mad', univariateResults.mad || { outliers: [], count: 0 });
    },

    updateMultivariateResults(multivariateResults) {
        
        // Mahalanobis Method
        this.updateMethodResults('mahalanobis', multivariateResults.mahalanobis || { outliers: [], count: 0 });
        
        // LOF Method
        this.updateMethodResults('lof', multivariateResults.lof || { outliers: [], count: 0 });
        
        // Isolation Forest Method
        this.updateMethodResults('isolationForest', multivariateResults.isolation_forest || { outliers: [], count: 0 });
    },

    updateHypothesisTests(hypothesisResults) {
        // Solo actualizar Grubbs por ahora, ya que Dixon y Rosner no están implementados en el HTML
        
        // Grubbs Test - solo si existe en los resultados
        if (hypothesisResults && hypothesisResults.grubbs) {
        } else {
        }
        
        // Nota: Dixon y Rosner se implementarán cuando se añadan al HTML
        // this.updateMethodResults('dixon', hypothesisResults.dixon || { outliers: [], count: 0 });
        // this.updateMethodResults('rosner', hypothesisResults.rosner || { outliers: [], count: 0 });
    },

    updateMethodResults(methodName, methodData) {
        
        // Función para actualizar los elementos cuando estén disponibles
        const updateElements = () => {
            // Actualizar contador en el badge
            const countElement = document.getElementById(`${methodName}Count`);
            if (countElement) {
                const count = methodData.count || (methodData.outliers ? methodData.outliers.length : 0);
                countElement.textContent = count;
            } else {
            }

            // Actualizar tabla de outliers
            const outliersContainer = document.getElementById(`${methodName}Outliers`);
            if (outliersContainer) {
                
                if (methodData.outliers && methodData.outliers.length > 0) {
                    const outlierHtml = this.generateOutlierTable(methodData.outliers, methodName);
                    outliersContainer.innerHTML = outlierHtml;
                } else {
                    outliersContainer.innerHTML = '<p class="text-muted mb-0">Este método no detectó outliers en los datos.</p>';
                }
            } else {
            }
        };
        
        // Intentar actualizar inmediatamente
        updateElements();
        
        // Si los elementos no están disponibles, intentar de nuevo después de un breve delay
        if (!document.getElementById(`${methodName}Count`) || !document.getElementById(`${methodName}Outliers`)) {
            setTimeout(updateElements, 100);
        }
        
        // Asegurar que Bootstrap esté disponible y inicializar el accordion si es necesario
        if (typeof bootstrap !== 'undefined') {
            // Forzar la actualización del accordion
            const accordionElement = document.querySelector(`#${methodName}Results`);
            if (accordionElement) {
                // Asegurar que el accordion esté correctamente configurado
                const bsCollapse = new bootstrap.Collapse(accordionElement, {
                    toggle: false
                });
            }
        }
    },

    updateFinalOutliers(finalOutliers, results = {}) {
        
        // Actualizar contenedor de outliers finales
        const finalOutliersContainer = document.getElementById('finalOutliers');
        if (finalOutliersContainer) {
            let content = '';
            
            // Mostrar advertencia si hay demasiados outliers
            if (results.high_outlier_warning && results.outlier_warning_message) {
                content += `
                    <div class="alert alert-danger border-danger mb-3">
                        <h6 class="alert-heading">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ADVERTENCIA CRÍTICA: Porcentaje de Outliers Muy Alto
                        </h6>
                        <p class="mb-2">${results.outlier_warning_message}</p>
                        <hr>
                        <h6 class="mb-2"><strong>Posibles causas:</strong></h6>
                        <ul class="mb-2">
                            <li>La estrategia de combinación puede ser demasiado permisiva</li>
                            <li>Los métodos individuales pueden estar detectando demasiados valores extremos</li>
                            <li>Los datos pueden tener características extremas que requieren revisión</li>
                            <li>Los umbrales de los métodos pueden necesitar ajuste</li>
                        </ul>
                        <h6 class="mb-2"><strong>Recomendaciones:</strong></h6>
                        <ul class="mb-0">
                            <li>Revisa los resultados individuales de cada método para identificar qué está causando tantos outliers</li>
                            <li>Considera usar una estrategia más conservadora (por ejemplo, "Intersección" en lugar de "Adaptativa")</li>
                            <li>Verifica si los datos tienen problemas de calidad o valores faltantes mal manejados</li>
                            <li>Considera ajustar los umbrales de los métodos individuales si es posible</li>
                        </ul>
                    </div>
                `;
            }
            
            if (finalOutliers && finalOutliers.length > 0) {
                const outlierHtml = this.generateOutlierTable(finalOutliers, 'final');
                content += outlierHtml;
            } else {
                content += '<p class="text-muted mb-0">No se detectaron outliers finales con la estrategia de combinación seleccionada.</p>';
            }
            
            finalOutliersContainer.innerHTML = content;
            
            // Generar visualizaciones para el artículo después de actualizar outliers finales
            if (finalOutliers && finalOutliers.length > 0) {
                setTimeout(async () => {
                    this.generateBinaryMatrixHeatmap(results);
                    await this.generateSankeyDiagram(results);
                }, 500);
            }
        } else {
        }
    },

    generateOutlierTable(outliers, methodName) {
        
        if (!outliers || outliers.length === 0) {
            return '<p class="text-muted mb-0">Este método no detectó outliers en los datos.</p>';
        }

        const totalOutliers = outliers.length;
        const hasMoreOutliers = totalOutliers > 50;

        // Generar badges organizados en filas - RENDERIZAR TODOS los outliers
        let badgeHtml = '<div class="outlier-badges-container">';
        
        // Crear filas de badges (4 por fila) - usar TODOS los outliers, no solo los primeros 50
        for (let i = 0; i < outliers.length; i += 4) {
            badgeHtml += '<div class="outlier-badge-row mb-2 d-flex flex-wrap gap-2">';
            
            for (let j = i; j < Math.min(i + 4, outliers.length); j++) {
                const outlier = outliers[j];
                let outlierText = '';
                
                if (typeof outlier === 'object' && outlier.id) {
                    outlierText = outlier.id;
                } else {
                    outlierText = outlier.toString();
                }
                
                // Usar colores claros
                const badgeColors = [
                    'bg-light-pink', 'bg-light-blue', 'bg-light-yellow', 
                    'bg-light-green', 'bg-light-purple', 'bg-light-orange'
                ];
                const colorClass = badgeColors[j % badgeColors.length];
                
                badgeHtml += `
                    <span class="badge ${colorClass} text-dark outlier-badge-item"
                          title="${outlierText}"
                          style="font-size: 0.8rem; padding: 0.4rem 0.8rem; margin: 0.1rem; font-weight: 500; min-width: 60px; text-align: center; border-radius: 0.375rem; transition: all 0.2s ease;">
                        ${outlierText}
                    </span>
                `;
            }
            
            badgeHtml += '</div>';
        }
        
        badgeHtml += '</div>';
        
        // Agregar mensaje si hay más outliers (FUERA del contenedor scrollable)
        if (hasMoreOutliers) {
            badgeHtml += `
                <div class="text-center mt-3">
                    <div class="alert alert-info mb-0">
                        <i class="fas fa-info-circle me-2"></i>
                        Mostrando ${totalOutliers} outliers detectados.
                        <br>
                        <small class="text-muted">Usa el scroll para ver todos los resultados.</small>
                    </div>
                </div>
            `;
        }
        
        return badgeHtml;
    },

    generateOutlierTags(outliers, badgeClass = 'secondary') {
        if (!outliers || outliers.length === 0) {
            return '<p class="text-muted mb-0">No se detectaron outliers.</p>';
        }

        return outliers.map(outlier => {
            // Si outlier es un objeto con información adicional
            if (typeof outlier === 'object' && outlier.id) {
                return `<span class="badge bg-${badgeClass} me-1 mb-1">${outlier.id}</span>`;
            }
            // Si outlier es solo el ID
            return `<span class="badge bg-${badgeClass} me-1 mb-1">${outlier}</span>`;
        }).join('');
    },

    generateArticleText() {
        // Obtener resultados guardados
        const currentDatasetKey = 'current_outlier_dataset';
        const datasetInfo = JSON.parse(localStorage.getItem(currentDatasetKey) || '{}');
        
        // Intentar obtener resultados del último análisis
        let results = null;
        if (datasetInfo.filename) {
            const storageKey = `outlier_results_${datasetInfo.filename}`;
            const storedResults = localStorage.getItem(storageKey);
            if (storedResults) {
                results = JSON.parse(storedResults);
            }
        }
        
        // Si no hay resultados, mostrar advertencia
        if (!results) {
            this.app.showWarning('No se encontraron resultados de detección de outliers. Ejecuta primero la detección para generar el texto del artículo.');
            return;
        }
        
        // Generar texto completo
        const articleText = this.createArticleText(results, datasetInfo);
        
        // Mostrar en modal
        const modal = new bootstrap.Modal(document.getElementById('articleTextModal'));
        const textarea = document.getElementById('articleTextContent');
        if (textarea) {
            textarea.value = articleText;
        }
        modal.show();
    },

    createArticleText(results, datasetInfo) {
        const strategy = results.strategy_applied || results.combination_strategy || 'adaptive';
        const normality = results.normality_assessment || {};
        const isNormal = normality.data_is_generally_normal || false;
        const normalRatio = normality.normal_ratio || null;
        const totalRecords = results.total_records || 0;
        const outliersDetected = results.outliers_detected || 0;
        const outlierPercentage = results.outlier_percentage || 0;
        
        // Información de métodos
        const univariate = results.methods?.univariate || {};
        const multivariate = results.methods?.multivariate || {};
        const hypothesis = results.methods?.hypothesis_tests || {};
        
        let text = `Detección de Outliers\n\n`;
        text += `Para la identificación de valores atípicos (outliers) en los datos, se implementó una estrategia comprensiva que combina múltiples métodos estadísticos univariados, multivariados y pruebas de hipótesis estadísticas.\n\n`;
        
        text += `Validación de Normalidad\n\n`;
        text += `Previo a la aplicación de métodos paramétricos, se evaluó la normalidad de la distribución de los datos mediante pruebas estadísticas apropiadas según el tamaño de muestra. Para muestras pequeñas (n ≤ 50), se utilizó la prueba de Shapiro-Wilk, mientras que para muestras más grandes (n > 50) se empleó la prueba de Anderson-Darling, ambas con un nivel de significancia de α = 0.05. `;
        
        if (strategy === 'adaptive' && normalRatio !== null) {
            text += `La evaluación de normalidad se realizó en ${normality.variables_evaluated || 'múltiples'} variables representativas del dataset. `;
            text += `El ${normalRatio.toFixed(1)}% de las variables evaluadas cumplieron con el supuesto de normalidad. `;
            if (isNormal) {
                text += `Dado que al menos el 60% de las variables evaluadas presentaron distribución normal, los datos fueron considerados generalmente normales, por lo que se priorizaron métodos paramétricos en la estrategia de combinación.\n\n`;
            } else {
                text += `Dado que menos del 60% de las variables evaluadas presentaron distribución normal, los datos fueron considerados no normales, por lo que se priorizaron métodos no paramétricos en la estrategia de combinación.\n\n`;
            }
        } else {
            text += `La evaluación de normalidad se realizó para cada variable antes de aplicar métodos que requieren este supuesto.\n\n`;
        }
        
        text += `Métodos Univariados\n\n`;
        text += `Se aplicaron tres métodos univariados para la detección de outliers en cada variable numérica:\n\n`;
        text += `1. Método del Rango Intercuartílico (IQR): Este método no paramétrico identifica outliers como aquellos valores que se encuentran fuera del rango definido por Q1 - 1.5×IQR y Q3 + 1.5×IQR, donde Q1 y Q3 son el primer y tercer cuartil, respectivamente, e IQR es el rango intercuartílico. Este método es robusto y no requiere el supuesto de normalidad.\n\n`;
        text += `2. Método Z-Score: Se identificaron como outliers aquellos valores con un z-score absoluto mayor a 3 desviaciones estándar de la media. Este método requiere que los datos sigan una distribución normal. `;
        if (univariate.zscore?.count) {
            text += `Se detectaron ${univariate.zscore.count} outliers mediante este método.\n\n`;
        } else {
            text += `\n\n`;
        }
        text += `3. Método de la Mediana Absoluta de la Desviación (MAD): Este método robusto utiliza la mediana y la desviación absoluta mediana en lugar de la media y la desviación estándar, siendo más resistente a la presencia de outliers. Se utilizó un umbral de 3 desviaciones modificadas. Este método no requiere el supuesto de normalidad.\n\n`;
        
        text += `Métodos Multivariados\n\n`;
        text += `Para considerar las relaciones entre múltiples variables simultáneamente, se aplicaron tres métodos multivariados:\n\n`;
        text += `1. Distancia de Mahalanobis: Este método calcula la distancia de cada observación al centro de la distribución multivariada, considerando las correlaciones entre variables mediante la matriz de covarianza. Requiere el supuesto de normalidad multivariada. Se utilizó un umbral de 3 unidades de distancia de Mahalanobis.\n\n`;
        text += `2. Local Outlier Factor (LOF): Este método no paramétrico identifica outliers locales comparando la densidad local de cada punto con la densidad de sus vecinos. Es particularmente útil para detectar outliers en regiones de baja densidad. No requiere el supuesto de normalidad.\n\n`;
        text += `3. Isolation Forest: Este método basado en árboles de decisión identifica outliers como observaciones que son fáciles de aislar del resto de los datos. Es eficiente computacionalmente y no requiere el supuesto de normalidad.\n\n`;
        
        text += `Pruebas de Hipótesis Estadísticas\n\n`;
        text += `Para validar estadísticamente la presencia de outliers, se aplicaron tres pruebas de hipótesis:\n\n`;
        text += `1. Prueba de Grubbs: Esta prueba paramétrica detecta un outlier a la vez en datos que siguen una distribución normal. El estadístico de prueba se basa en la distribución t de Student, con corrección de Bonferroni para comparaciones múltiples. `;
        if (hypothesis.grubbs?.count) {
            text += `Se identificaron ${hypothesis.grubbs.count} outliers mediante esta prueba.\n\n`;
        } else {
            text += `\n\n`;
        }
        text += `2. Prueba de Dixon (Q-Test): Esta prueba está diseñada específicamente para muestras pequeñas (n = 3-30) y detecta outliers en los extremos de la distribución. Utiliza valores críticos tabulados según el tamaño de muestra y el nivel de significancia. `;
        if (hypothesis.dixon?.count) {
            text += `Se identificaron ${hypothesis.dixon.count} outliers mediante esta prueba.\n\n`;
        } else {
            text += `\n\n`;
        }
        text += `3. Prueba de Rosner (Generalized ESD Test): Esta prueba permite detectar múltiples outliers de forma iterativa en muestras grandes (n ≥ 25). Incluye ajuste por comparaciones múltiples mediante el método de Bonferroni para controlar la tasa de error tipo I. `;
        if (hypothesis.rosner?.count) {
            text += `Se identificaron ${hypothesis.rosner.count} outliers mediante esta prueba.\n\n`;
        } else {
            text += `\n\n`;
        }
        
        text += `Estrategia de Combinación\n\n`;
        if (strategy === 'adaptive') {
            text += `Se implementó una estrategia adaptativa que ajusta automáticamente los criterios de inclusión según las características de los datos. `;
            if (isNormal) {
                text += `Dado que los datos fueron considerados generalmente normales, se priorizaron métodos paramétricos. Un outlier se consideró final si cumplía al menos uno de los siguientes criterios: (1) fue detectado por cualquier prueba de hipótesis estadística (alta confianza estadística); (2) fue detectado por al menos un método paramétrico univariado (Z-Score) y un método multivariado paramétrico (Mahalanobis); (3) fue detectado por al menos dos métodos no paramétricos univariados (consenso robusto); o (4) fue detectado por al menos un método multivariado no paramétrico (LOF o Isolation Forest).\n\n`;
            } else {
                text += `Dado que los datos fueron considerados no normales, se priorizaron métodos no paramétricos. Un outlier se consideró final si cumplía al menos uno de los siguientes criterios: (1) fue detectado por cualquier prueba de hipótesis estadística (si los datos fueron validados individualmente); (2) fue detectado por al menos dos métodos no paramétricos univariados (consenso robusto); (3) fue detectado por al menos un método multivariado no paramétrico (LOF o Isolation Forest); o (4) fue detectado por métodos paramétricos solo si fueron validados individualmente para la variable específica.\n\n`;
            }
        } else if (strategy === 'voting') {
            const minUni = results.min_univariate || 2;
            const minMulti = results.min_multivariate || 1;
            text += `Se implementó una estrategia de votación donde un outlier se consideró final si fue detectado por al menos ${minUni} métodos univariados y al menos ${minMulti} método${minMulti > 1 ? 's' : ''} multivariado${minMulti > 1 ? 's' : ''}, o si fue detectado por cualquier prueba de hipótesis estadística.\n\n`;
        } else if (strategy === 'union') {
            text += `Se implementó una estrategia de unión donde un outlier se consideró final si fue detectado por cualquier método (univariado, multivariado o prueba de hipótesis).\n\n`;
        } else if (strategy === 'intersection') {
            text += `Se implementó una estrategia de intersección donde un outlier se consideró final solo si fue detectado por todos los métodos de cada categoría (al menos un método univariado, un método multivariado y una prueba de hipótesis).\n\n`;
        }
        
        text += `Resultados\n\n`;
        text += `Del total de ${totalRecords.toLocaleString()} observaciones analizadas, se identificaron ${outliersDetected.toLocaleString()} outliers (${outlierPercentage.toFixed(2)}%) mediante la estrategia de combinación seleccionada. `;
        text += `Los outliers identificados fueron conservados para análisis posterior, ya que el objetivo del estudio fue analizar las características y condicionantes asociados a valores extremos en lugar de eliminarlos del análisis.\n\n`;
        
        text += `Referencias Bibliográficas\n\n`;
        text += `Aggarwal, C. C. (2017). Outlier analysis. Springer International Publishing. https://doi.org/10.1007/978-3-319-47578-3\n\n`;
        text += `Hodge, V., & Austin, J. (2004). A survey of outlier detection methodologies. Artificial Intelligence Review, 22(2), 85-126. https://doi.org/10.1023/B:AIRE.0000045502.10941.a9\n\n`;
        text += `Zaki, M. J., Meira Jr, W., & Meira, W. (2014). Data mining and analysis: fundamental concepts and algorithms. Cambridge University Press.\n\n`;
        text += `Chandola, V., Banerjee, A., & Kumar, V. (2009). Anomaly detection: A survey. ACM Computing Surveys, 41(3), 1-58. https://doi.org/10.1145/1541880.1541882\n\n`;
        text += `Pimentel, M. A., Clifton, D. A., Clifton, L., & Tarassenko, L. (2014). A review of novelty detection. Signal Processing, 99, 215-249. https://doi.org/10.1016/j.sigpro.2013.12.026\n\n`;
        text += `Rousseeuw, P. J., & Hubert, M. (2018). Anomaly detection by robust statistics. Wiley Interdisciplinary Reviews: Computational Statistics, 10(2), e1426. https://doi.org/10.1002/wics.1426\n\n`;
        text += `Zimek, A., Schubert, E., & Kriegel, H. P. (2012). A survey on unsupervised outlier detection in high-dimensional numerical data. Statistical Analysis and Data Mining, 5(5), 363-387. https://doi.org/10.1002/sam.11161\n\n`;
        text += `Goldstein, M., & Uchida, S. (2016). A comparative evaluation of unsupervised anomaly detection algorithms for multivariate data. PLOS ONE, 11(4), e0152173. https://doi.org/10.1371/journal.pone.0152173\n\n`;
        
        return text;
    },

    copyArticleText() {
        const textarea = document.getElementById('articleTextContent');
        if (textarea) {
            textarea.select();
            textarea.setSelectionRange(0, 99999); // Para dispositivos móviles
            try {
                document.execCommand('copy');
                this.app.showSuccess('Texto copiado al portapapeles exitosamente.');
            } catch (err) {
                // Fallback: usar Clipboard API si está disponible
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(textarea.value).then(() => {
                        this.app.showSuccess('Texto copiado al portapapeles exitosamente.');
                    }).catch(() => {
                        this.app.showError('No se pudo copiar el texto. Por favor, cópialo manualmente.');
                    });
                } else {
                    this.app.showError('No se pudo copiar el texto. Por favor, cópialo manualmente.');
                }
            }
        }
    },

    generateBinaryMatrixHeatmap(results) {
        const container = document.getElementById('binaryMatrixHeatmap');
        if (!container) {
            return;
        }

        try {
            // Obtener TODOS los métodos disponibles (incluso si no tienen outliers)
            // Esto asegura que la matriz muestre todos los métodos que se ejecutaron
            const methods = [];
            const methodLabels = {};
            
            // Métodos univariados - incluir todos si existen en los resultados
            if (results.methods?.univariate) {
                if (results.methods.univariate.iqr) {
                    methods.push('iqr');
                    methodLabels['iqr'] = 'IQR';
                }
                if (results.methods.univariate.zscore) {
                    methods.push('zscore');
                    methodLabels['zscore'] = 'Z-Score';
                }
                if (results.methods.univariate.mad) {
                    methods.push('mad');
                    methodLabels['mad'] = 'MAD';
                }
            }
            
            // Métodos multivariados - incluir todos si existen en los resultados
            if (results.methods?.multivariate) {
                if (results.methods.multivariate.mahalanobis) {
                    methods.push('mahalanobis');
                    methodLabels['mahalanobis'] = 'Mahalanobis';
                }
                if (results.methods.multivariate.lof) {
                    methods.push('lof');
                    methodLabels['lof'] = 'LOF';
                }
                if (results.methods.multivariate.isolation_forest) {
                    methods.push('isolation_forest');
                    methodLabels['isolation_forest'] = 'Isolation Forest';
                }
            }
            
            // Pruebas de hipótesis - incluir todas si existen en los resultados
            if (results.methods?.hypothesis_tests) {
                if (results.methods.hypothesis_tests.grubbs) {
                    methods.push('grubbs');
                    methodLabels['grubbs'] = 'Grubbs';
                }
                if (results.methods.hypothesis_tests.dixon) {
                    methods.push('dixon');
                    methodLabels['dixon'] = 'Dixon';
                }
                if (results.methods.hypothesis_tests.rosner) {
                    methods.push('rosner');
                    methodLabels['rosner'] = 'Rosner';
                }
            }

            if (methods.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay métodos disponibles para mostrar.</p>';
                return;
            }

            // Obtener todos los IDs únicos de muestras detectadas por cualquier método
            const allSampleIds = new Set();
            
            methods.forEach(method => {
                let outliers = [];
                if (method === 'iqr' || method === 'zscore' || method === 'mad') {
                    outliers = results.methods.univariate[method]?.outliers || [];
                } else if (method === 'mahalanobis' || method === 'lof' || method === 'isolation_forest') {
                    outliers = results.methods.multivariate[method]?.outliers || [];
                } else if (method === 'grubbs' || method === 'dixon' || method === 'rosner') {
                    outliers = results.methods.hypothesis_tests[method]?.outliers || [];
                }
                
                outliers.forEach(outlier => {
                    const id = typeof outlier === 'object' && outlier.id ? outlier.id : outlier.toString();
                    allSampleIds.add(id);
                });
            });

            const sampleIds = Array.from(allSampleIds).sort();
            
            // Si no hay muestras detectadas, mostrar mensaje pero aún así mostrar la matriz vacía
            // para que se vean todos los métodos
            if (sampleIds.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay muestras detectadas por ningún método. Todos los métodos mostraron 0 outliers.</p>';
                // Aún así crear una matriz vacía para mostrar los métodos
                sampleIds.push('No outliers detected');
            }

            // Construir matriz binaria: filas = muestras, columnas = métodos
            const matrix = sampleIds.map(sampleId => {
                return methods.map(method => {
                    let outliers = [];
                    if (method === 'iqr' || method === 'zscore' || method === 'mad') {
                        outliers = results.methods.univariate[method]?.outliers || [];
                    } else if (method === 'mahalanobis' || method === 'lof' || method === 'isolation_forest') {
                        outliers = results.methods.multivariate[method]?.outliers || [];
                    } else if (method === 'grubbs' || method === 'dixon' || method === 'rosner') {
                        outliers = results.methods.hypothesis_tests[method]?.outliers || [];
                    }
                    
                    const detected = outliers.some(outlier => {
                        const id = typeof outlier === 'object' && outlier.id ? outlier.id : outlier.toString();
                        return id === sampleId;
                    });
                    
                    return detected ? 1 : 0;
                });
            });

            // Crear heatmap con Plotly
            // IMPORTANTE: La matriz z debe tener filas = muestras, columnas = métodos
            // Plotly espera: z[i][j] donde i es la fila (muestra) y j es la columna (método)
            const z = matrix;
            const x = methods.map(m => methodLabels[m] || m);
            const y = sampleIds;


            const trace = {
                z: z,
                x: x,
                y: y,
                type: 'heatmap',
                colorscale: [
                    [0, 'white'],
                    [1, '#dc3545']
                ],
                showscale: true,
                colorbar: {
                    title: {
                        text: 'Detected',
                        side: 'right'
                    },
                    titleside: 'right',
                    tickmode: 'array',
                    tickvals: [0, 1],
                    ticktext: ['No', 'Yes'],
                    len: 0.5,
                    y: 0.5,
                    yanchor: 'middle'
                },
                hovertemplate: '<b>Sample:</b> %{y}<br><b>Method:</b> %{x}<br><b>Detected:</b> %{z}<extra></extra>'
            };

            const layout = {
                title: {
                    text: 'Binary Detection Matrix',
                    font: { size: 16 }
                },
                xaxis: {
                    title: {
                        text: 'Detection Methods',
                        font: { size: 12 }
                    },
                    side: 'bottom',
                    tickangle: -45
                },
                yaxis: {
                    title: {
                        text: 'Samples',
                        font: { size: 12 }
                    },
                    autorange: 'reversed',
                    type: 'category'
                },
                height: Math.max(400, Math.min(sampleIds.length * 25 + 200, 800)),
                width: Math.max(600, methods.length * 80 + 200),
                margin: { l: 120, r: 100, t: 100, b: 120 },
                autosize: true
            };

            const config = {
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['lasso2d', 'select2d']
            };

            Plotly.newPlot(container, [trace], layout, config);
        } catch (error) {
            container.innerHTML = `<p class="text-danger">Error generando matriz binaria: ${error.message}</p>`;
        }
    },

    async generateSankeyDiagram(results) {
        
        const container = document.getElementById('sankeyDiagram');
        if (!container) {
            return;
        }

        try {
            // Obtener totales del dataset
            const totalRecords = results.total_records || 0;
            const totalFinalOutliers = results.outliers_detected || 0;
            const totalNormals = totalRecords - totalFinalOutliers;

            // DEFINIR MÉTODOS VÁLIDOS - SOLO estos pueden aparecer como métodos
            const validMethodsMap = {
                'iqr': 'IQR',
                'zscore': 'Z-Score',
                'mad': 'MAD',
                'mahalanobis': 'Mahalanobis',
                'lof': 'LOF',
                'isolation_forest': 'Isolation Forest',
                'grubbs': 'Grubbs',
                'dixon': 'Dixon',
                'rosner': 'Rosner'
            };
            const validMethodsSet = new Set(Object.keys(validMethodsMap));

            // Obtener todos los métodos y sus outliers (INCLUYENDO REPETICIONES)
            const methodNodes = [];
            const methodLabels = {};
            const methodOutliers = {}; // Array con TODAS las observaciones detectadas (con repeticiones)
            
            // Métodos univariados
            if (results.methods?.univariate) {
                ['iqr', 'zscore', 'mad'].forEach(method => {
                    if (!validMethodsSet.has(method)) return;
                    const outliers = results.methods.univariate[method]?.outliers || [];
                    if (outliers.length > 0) {
                        methodNodes.push(method);
                        methodLabels[method] = validMethodsMap[method];
                        methodOutliers[method] = outliers.map(o => {
                            const id = typeof o === 'object' && o.id ? o.id : o.toString();
                            return id;
                        });
                    }
                });
            }
            
            // Métodos multivariados
            if (results.methods?.multivariate) {
                ['mahalanobis', 'lof', 'isolation_forest'].forEach(method => {
                    if (!validMethodsSet.has(method)) return;
                    const outliers = results.methods.multivariate[method]?.outliers || [];
                    if (outliers.length > 0) {
                        methodNodes.push(method);
                        methodLabels[method] = validMethodsMap[method];
                        methodOutliers[method] = outliers.map(o => {
                            const id = typeof o === 'object' && o.id ? o.id : o.toString();
                            return id;
                        });
                    }
                });
            }
            
            // Pruebas de hipótesis
            if (results.methods?.hypothesis_tests) {
                ['grubbs', 'dixon', 'rosner'].forEach(method => {
                    if (!validMethodsSet.has(method)) return;
                    const methodData = results.methods.hypothesis_tests[method];
                    if (methodData) {
                        const outliers = methodData.outliers || [];
                        if (outliers.length > 0 || methodData.count > 0) {
                            methodNodes.push(method);
                            methodLabels[method] = validMethodsMap[method];
                            methodOutliers[method] = outliers.map(o => {
                                if (typeof o === 'object' && o !== null) {
                                    return o.id ? o.id.toString() : JSON.stringify(o);
                                }
                                return o.toString();
                            });
                        }
                    }
                });
            }
            
            // FILTRO FINAL: Eliminar cualquier método inválido o ID que parezca método
            const filteredMethodNodes = methodNodes.filter(m => {
                const isValid = validMethodsSet.has(m);
                const looksLikeId = /^[A-Z]-\w+-\d+$/i.test(m);
                // También verificar si el nombre coincide con algún patrón de ID común
                const isUpperCaseId = /^[A-Z]/.test(m) && m.includes('-');
                
                if (!isValid || looksLikeId || isUpperCaseId) {
                    return false;
                }
                return true;
            });
            
            methodNodes.length = 0;
            methodNodes.push(...filteredMethodNodes);
            
            // Limpiar methodOutliers y methodLabels de métodos eliminados
            Object.keys(methodOutliers).forEach(key => {
                if (!methodNodes.includes(key)) {
                    delete methodOutliers[key];
                    delete methodLabels[key];
                }
            });
            
            // FILTRO ADICIONAL: Eliminar cualquier ID que haya quedado en methodOutliers
            Object.keys(methodOutliers).forEach(method => {
                methodOutliers[method] = methodOutliers[method].filter(id => {
                    const looksLikeMethod = validMethodsSet.has(id.toLowerCase());
                    if (looksLikeMethod) {
                        return false;
                    }
                    return true;
                });
            });
            
            if (methodNodes.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay métodos disponibles para mostrar.</p>';
                return;
            }

            // Obtener TODAS las observaciones detectadas por métodos (INCLUYENDO REPETICIONES)
            const allDetectedSampleIds = [];
            methodNodes.forEach(method => {
                methodOutliers[method].forEach(id => {
                    allDetectedSampleIds.push(id);
                });
            });
            
            // Crear Set de IDs únicos detectados
            const uniqueDetectedIds = new Set(allDetectedSampleIds);

            // Obtener outliers finales (INCLUYENDO REPETICIONES)
            const finalOutliersList = [];
            if (results.final_outliers && results.final_outliers.length > 0) {
                results.final_outliers.forEach(outlier => {
                    const id = typeof outlier === 'object' && outlier.id ? outlier.id : outlier.toString();
                    finalOutliersList.push(id);
                });
            }
            
            // Crear Set y mapa de conteo para outliers finales
            const finalOutliersSet = new Set(finalOutliersList);
            const finalOutliersCount = {};
            finalOutliersList.forEach(id => {
                finalOutliersCount[id] = (finalOutliersCount[id] || 0) + 1;
            });

            // Obtener TODAS las observaciones del dataset completo
            let allDatasetSampleIds = [];
            const subjectIdColumn = results.subject_id_column;
            
            if (this.currentDataset && subjectIdColumn) {
                try {
                    const filename = this.currentDataset.filename;
                    const response = await fetch(`/api/datasets/${encodeURIComponent(filename)}/paginated?page=1&page_size=${totalRecords}`);
                    if (response.ok) {
                        const paginatedData = await response.json();
                        if (paginatedData.data && Array.isArray(paginatedData.data)) {
                            allDatasetSampleIds = paginatedData.data.map(row => {
                                const id = row[subjectIdColumn];
                                return id ? id.toString() : null;
                            }).filter(id => id !== null);
                        }
                    }
                } catch (error) {
                }
            }

            // Construir nodos y enlaces para Sankey
            let nodeLabels = [];
            const nodeIndexMap = {};
            let nodeIndex = 0;

            // Nodos de métodos (izquierda) con conteos
            // IMPORTANTE: Solo agregar métodos válidos que estén en validMethodsMap
            methodNodes.forEach(method => {
                // Verificar que el método es válido antes de agregarlo
                if (!validMethodsSet.has(method) || !validMethodsMap[method]) {
                    return;
                }
                const count = methodOutliers[method] ? methodOutliers[method].length : 0;
                const label = validMethodsMap[method];
                nodeLabels.push(`${label}\n(${count})`);
                nodeIndexMap[method] = nodeIndex++;
            });
            

            // Nodos de observaciones (centro)
            // IMPORTANTE: Mostrar TODOS los IDs únicos del dataset
            let allSampleIdsToShow = [];
            
            if (allDatasetSampleIds.length > 0) {
                // Usar TODAS las observaciones del dataset, filtrar IDs problemáticos
                const filteredDatasetIds = allDatasetSampleIds.filter(id => {
                    const looksLikeMethod = validMethodsSet.has(id.toLowerCase());
                    if (looksLikeMethod) {
                        return false;
                    }
                    return true;
                });
                
                // Obtener IDs ÚNICOS (sin repeticiones)
                allSampleIdsToShow = Array.from(new Set(filteredDatasetIds)).sort();
            } else {
                // Si no se pudieron obtener todas las observaciones, usar solo las detectadas por métodos
                allSampleIdsToShow = Array.from(new Set(allDetectedSampleIds)).sort();
            }
            
            // Agregar cada ID único como nodo (sin número entre paréntesis porque son IDs únicos)
            allSampleIdsToShow.forEach(sampleId => {
                nodeLabels.push(sampleId);
                nodeIndexMap[sampleId] = nodeIndex++;
            });
            

            // Nodos finales (derecha)
            // Obtener IDs únicos de outliers finales y normales finales
            const uniqueFinalOutlierIds = Array.from(new Set(finalOutliersList));
            const uniqueNormalIds = allSampleIdsToShow.filter(id => !uniqueFinalOutlierIds.includes(id));
            
            // Crear etiquetas con los IDs listados
            const outlierIdsLabel = uniqueFinalOutlierIds.length > 0 
                ? `High Consensus Outlier\n(${totalFinalOutliers})\n${uniqueFinalOutlierIds.slice(0, 15).join(', ')}${uniqueFinalOutlierIds.length > 15 ? '...' : ''}`
                : `High Consensus Outlier\n(${totalFinalOutliers})`;
            
            const normalIdsLabel = uniqueNormalIds.length > 0
                ? `No Outlier\n(${totalNormals})\n${uniqueNormalIds.slice(0, 15).join(', ')}${uniqueNormalIds.length > 15 ? '...' : ''}`
                : `No Outlier\n(${totalNormals})`;
            
            nodeLabels.push(outlierIdsLabel);
            const finalOutlierNodeIndex = nodeIndex++;
            nodeIndexMap['final_outlier'] = finalOutlierNodeIndex;

            nodeLabels.push(normalIdsLabel);
            const noOutlierNodeIndex = nodeIndex++;
            nodeIndexMap['no_outlier'] = noOutlierNodeIndex;

            // Construir enlaces
            const links = {
                source: [],
                target: [],
                value: []
            };

            // Enlaces: métodos → observaciones individuales
            // IMPORTANTE: Cada método conecta a TODOS los IDs del dataset
            // - Rojo: IDs detectados como outliers por ese método
            // - Verde: IDs NO detectados como outliers por ese método (normales)
            methodNodes.forEach(method => {
                const methodIndex = nodeIndexMap[method];
                if (methodIndex === undefined) return;
                
                // Obtener IDs únicos detectados como outliers por este método
                const uniqueOutliersForMethod = new Set(methodOutliers[method] || []);
                
                // Conectar a TODOS los IDs del nodo central
                allSampleIdsToShow.forEach(sampleId => {
                    const sampleIndex = nodeIndexMap[sampleId];
                    if (sampleIndex !== undefined) {
                        links.source.push(methodIndex);
                        links.target.push(sampleIndex);
                        links.value.push(1);
                        // El color se determinará después según si es outlier o no
                    }
                });
            });

            // Enlaces: observaciones → clasificación final
            // IMPORTANTE: Conectar cada observación individual del dataset a su clasificación final
            // - Rojo: Observaciones que son outliers finales
            // - Verde: Observaciones que son normales finales
            // Las conexiones deben sumar exactamente totalFinalOutliers + totalNormals = totalRecords
            
            if (allDatasetSampleIds.length > 0) {
                // Tenemos todas las observaciones del dataset
                // Conectar CADA observación individual según su clasificación final
                const outlierConnectionsMade = {};
                
                allDatasetSampleIds.forEach(sampleId => {
                    // Filtrar IDs que parecen métodos (ya filtrados en filteredDatasetIds, pero verificamos por seguridad)
                    if (validMethodsSet.has(sampleId.toLowerCase())) {
                        return;
                    }
                    
                    const sampleIndex = nodeIndexMap[sampleId];
                    const maxOutlierConnections = finalOutliersCount[sampleId] || 0;
                    const currentOutlierConnections = outlierConnectionsMade[sampleId] || 0;
                    
                    if (sampleIndex !== undefined) {
                        if (currentOutlierConnections < maxOutlierConnections) {
                            // Esta observación es outlier final → conexión roja
                            links.source.push(sampleIndex);
                            links.target.push(finalOutlierNodeIndex);
                            links.value.push(1);
                            outlierConnectionsMade[sampleId] = currentOutlierConnections + 1;
                        } else {
                            // Esta observación es normal final → conexión verde
                            links.source.push(sampleIndex);
                            links.target.push(noOutlierNodeIndex);
                            links.value.push(1);
                        }
                    }
                });
                
                
                // Verificar conexiones
                const actualOutlierConnections = links.source.filter((src, idx) => links.target[idx] === finalOutlierNodeIndex).length;
                const actualNormalConnections = links.source.filter((src, idx) => links.target[idx] === noOutlierNodeIndex).length;
            } else {
                // Solo tenemos las observaciones detectadas por métodos
                // Conectar cada observación detectada según su clasificación final
                allDetectedSampleIds.forEach(sampleId => {
                    // Filtrar IDs que parecen métodos
                    if (validMethodsSet.has(sampleId.toLowerCase())) {
                        return;
                    }
                    
                    const sampleIndex = nodeIndexMap[sampleId];
                    const isFinalOutlier = finalOutliersSet.has(sampleId);
                    
                    if (sampleIndex !== undefined) {
                        if (isFinalOutlier) {
                            links.source.push(sampleIndex);
                            links.target.push(finalOutlierNodeIndex);
                            links.value.push(1);
                        } else {
                            links.source.push(sampleIndex);
                            links.target.push(noOutlierNodeIndex);
                            links.value.push(1);
                        }
                    }
                });
            }

            // Verificación final: eliminar cualquier ID que haya pasado el filtro pero que parezca un método
            // Esto es una medida de seguridad adicional para garantizar que solo IDs válidos aparezcan en los nodos
            // IMPORTANTE: Solo verificar en los nodos de observaciones (después de los métodos, antes de los nodos finales)
            const invalidNodeIndices = [];
            nodeLabels.forEach((label, idx) => {
                // Solo verificar nodos de observaciones (no métodos ni nodos finales)
                if (idx >= methodNodes.length && idx < methodNodes.length + allSampleIdsToShow.length) {
                    const labelStr = label.toString().split('\n')[0]; // Obtener solo el ID sin el conteo
                    if (validMethodsSet.has(labelStr.toLowerCase())) {
                        invalidNodeIndices.push(idx);
                    }
                }
            });
            
            // Si hay nodos inválidos, reconstruir todo sin ellos
            if (invalidNodeIndices.length > 0) {
                // Reconstruir nodeLabels y nodeIndexMap sin los nodos inválidos
                const validNodeLabels = [];
                const newNodeIndexMap = {};
                let newIndex = 0;
                
                nodeLabels.forEach((label, oldIdx) => {
                    if (!invalidNodeIndices.includes(oldIdx)) {
                        validNodeLabels.push(label);
                        const labelStr = label.toString().split('\n')[0];
                        if (labelStr in nodeIndexMap) {
                            newNodeIndexMap[labelStr] = newIndex;
                        }
                        newIndex++;
                    }
                });
                
                // Reconstruir enlaces sin referencias a nodos inválidos
                const newLinks = {
                    source: [],
                    target: [],
                    value: []
                };
                
                // Ajustar índices de métodos (no cambian)
                methodNodes.forEach(method => {
                    const methodIndex = nodeIndexMap[method];
                    if (methodIndex !== undefined && !invalidNodeIndices.includes(methodIndex)) {
                        const uniqueOutliersForMethod = Array.from(new Set(methodOutliers[method]));
                        uniqueOutliersForMethod.forEach(sampleId => {
                            if (sampleId in newNodeIndexMap) {
                                newLinks.source.push(methodIndex);
                                newLinks.target.push(newNodeIndexMap[sampleId]);
                                newLinks.value.push(1);
                            }
                        });
                    }
                });
                
                // Reconstruir enlaces de observaciones a clasificación final
                if (allDatasetSampleIds.length > 0) {
                    const outlierConnectionsMade = {};
                    allDatasetSampleIds.forEach(sampleId => {
                        if (validMethodsSet.has(sampleId.toLowerCase()) || !(sampleId in newNodeIndexMap)) {
                            return;
                        }
                        
                        const sampleIndex = newNodeIndexMap[sampleId];
                        const maxOutlierConnections = finalOutliersCount[sampleId] || 0;
                        const currentOutlierConnections = outlierConnectionsMade[sampleId] || 0;
                        
                        if (sampleIndex !== undefined) {
                            const finalOutlierIdx = validNodeLabels.length - 2;
                            const noOutlierIdx = validNodeLabels.length - 1;
                            
                            if (currentOutlierConnections < maxOutlierConnections) {
                                newLinks.source.push(sampleIndex);
                                newLinks.target.push(finalOutlierIdx);
                                newLinks.value.push(1);
                                outlierConnectionsMade[sampleId] = currentOutlierConnections + 1;
                            } else {
                                newLinks.source.push(sampleIndex);
                                newLinks.target.push(noOutlierIdx);
                                newLinks.value.push(1);
                            }
                        }
                    });
                } else {
                    allDetectedSampleIds.forEach(sampleId => {
                        if (validMethodsSet.has(sampleId.toLowerCase()) || !(sampleId in newNodeIndexMap)) {
                            return;
                        }
                        
                        const sampleIndex = newNodeIndexMap[sampleId];
                        const isFinalOutlier = finalOutliersSet.has(sampleId);
                        
                        if (sampleIndex !== undefined) {
                            const finalOutlierIdx = validNodeLabels.length - 2;
                            const noOutlierIdx = validNodeLabels.length - 1;
                            
                            if (isFinalOutlier) {
                                newLinks.source.push(sampleIndex);
                                newLinks.target.push(finalOutlierIdx);
                                newLinks.value.push(1);
                            } else {
                                newLinks.source.push(sampleIndex);
                                newLinks.target.push(noOutlierIdx);
                                newLinks.value.push(1);
                            }
                        }
                    });
                }
                
                // Reemplazar con los datos limpios
                nodeLabels = validNodeLabels;
                links.source = newLinks.source;
                links.target = newLinks.target;
                links.value = newLinks.value;
            }

            // Crear diagrama de Sankey con Plotly
            const data = {
                type: 'sankey',
                node: {
                    pad: 15,
                    thickness: 20,
                    line: {
                        color: 'black',
                        width: 0.5
                    },
                    label: nodeLabels,
                    color: (() => {
                        const colors = [];
                        // Colores para métodos
                        for (let i = 0; i < methodNodes.length; i++) {
                            colors.push('#3498db');
                        }
                        // Colores para observaciones
                        for (let i = 0; i < allSampleIdsToShow.length; i++) {
                            colors.push('#95a5a6');
                        }
                        // Colores para nodos finales
                        colors.push('#e74c3c'); // Rojo para High Consensus Outlier
                        colors.push('#2ecc71'); // Verde para No Outlier
                        return colors.slice(0, nodeLabels.length); // Asegurar que coincida con nodeLabels
                    })()
                },
                link: {
                    source: links.source,
                    target: links.target,
                    value: links.value,
                    color: links.source.map((src, idx) => {
                        const target = links.target[idx];
                        const source = links.source[idx];
                        
                        // Determinar si el source es un método o una observación
                        const isMethodNode = source < methodNodes.length;
                        const isObservationNode = source >= methodNodes.length && source < methodNodes.length + allSampleIdsToShow.length;
                        
                        if (target === finalOutlierNodeIndex || target === finalOutlierNodeIndex - 1) {
                            // Conexión hacia outlier final → ROJO
                            return 'rgba(231, 76, 60, 0.5)';
                        } else if (target === noOutlierNodeIndex || target === noOutlierNodeIndex - 1) {
                            // Conexión hacia normal final → VERDE
                            return 'rgba(46, 204, 113, 0.5)';
                        } else if (isMethodNode && isObservationNode) {
                            // Conexión de método → observación
                            // Determinar si este ID fue detectado como outlier por este método
                            const methodIdx = source;
                            const observationIdx = target - methodNodes.length; // Ajustar índice
                            const methodName = methodNodes[methodIdx];
                            const observationId = allSampleIdsToShow[observationIdx];
                            
                            if (methodName && observationId && methodOutliers[methodName]) {
                                // Verificar si este ID está en la lista de outliers de este método
                                const wasDetectedAsOutlier = methodOutliers[methodName].includes(observationId);
                                if (wasDetectedAsOutlier) {
                                    // Fue detectado como outlier por este método → ROJO
                                    return 'rgba(231, 76, 60, 0.4)';
                                } else {
                                    // NO fue detectado como outlier por este método → VERDE
                                    return 'rgba(46, 204, 113, 0.4)';
                                }
                            }
                            // Fallback: azul claro si no se puede determinar
                            return 'rgba(52, 152, 219, 0.3)';
                        } else {
                            // Conexión desconocida (fallback)
                            return 'rgba(52, 152, 219, 0.3)';
                        }
                    })
                }
            };

            const layout = {
                title: {
                    text: 'Consensus Flow Diagram (Sankey)',
                    font: { size: 14 }
                },
                font: {
                    size: 11
                },
                height: Math.max(500, (methodNodes.length + allSampleIdsToShow.length) * 30 + 300)
            };

            Plotly.newPlot(container, [data], layout, {responsive: true});
        } catch (error) {
            container.innerHTML = `<p class="text-danger">Error generando diagrama de Sankey: ${error.message}</p>`;
        }
    }
};

// Función de prueba para verificar badges
window.testBadges = function() {
    
    // Datos de prueba
    const testOutliers = ['ID_123', 'ID_456', 'ID_789', 'ID_101', 'ID_202', 'ID_303', 'ID_404', 'ID_505'];
    
    // Generar badges de prueba
    const badgeHtml = window.detectOutliersModule.generateOutlierTable(testOutliers, 'test');
    
    // Mostrar en el primer expander disponible
    const iqrOutliers = document.getElementById('iqrOutliers');
    if (iqrOutliers) {
        iqrOutliers.innerHTML = badgeHtml;
        
        // Abrir el expander
        const iqrResults = document.getElementById('iqrResults');
        if (iqrResults && typeof bootstrap !== 'undefined') {
            const bsCollapse = new bootstrap.Collapse(iqrResults, {
                show: true
            });
        }
    } else {
    }
};

// Función de prueba para verificar accordions
window.testAccordions = function() {
    
    // Verificar si Bootstrap está disponible
    if (typeof bootstrap === 'undefined') {
        alert('Bootstrap no está disponible. Los accordions no funcionarán correctamente.');
        return;
    }
    
    // Probar abrir el primer accordion
    const iqrResults = document.getElementById('iqrResults');
    if (iqrResults) {
        const bsCollapse = new bootstrap.Collapse(iqrResults, {
            show: true
        });
        
        // Después de 2 segundos, cerrarlo
        setTimeout(() => {
            const bsCollapseClose = new bootstrap.Collapse(iqrResults, {
                hide: true
            });
        }, 2000);
    }
    
    // Verificar que todos los accordions estén configurados correctamente
    const accordionButtons = document.querySelectorAll('.accordion-button');
    
    accordionButtons.forEach((button, index) => {
        const target = button.getAttribute('data-bs-target');
        const expanded = button.getAttribute('aria-expanded');
        const controls = button.getAttribute('aria-controls');
        void target;
        void expanded;
        void controls;
    });
};
    
    // Make module available globally
    window['detectOutliersModule'] = window.detectOutliersModule;
    
    
    // Inicialización controlada por el sistema de carga de módulos
    // El módulo se inicializará cuando loadModuleJS() llame a init()
    // Esto previene race conditions y asegura que la app esté lista
} 