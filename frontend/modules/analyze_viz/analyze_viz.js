// JS logic of the analyze_viz tab - Updated: 2025-08-22 12:05

// Check if module already exists to avoid redeclaration
if (typeof window.analyzeVizModule === 'undefined') {
    window.analyzeVizModule = {
    app: null,
    selectedDataset: null,
    outlierResults: null,

    async init(app) {
        try {
            this.app = app;
            
            // Limpiar datos antiguos de localStorage si es necesario
            await this.cleanupOldLocalStorageData();
            
            this.showInitialMessage();
            
            this.bindEvents();
            
        } catch (error) {
        }
    },

    async cleanupOldLocalStorageData() {
        try {
            
            // Verificar la sesión del servidor
            const serverSessionResponse = await fetch('/api/server-session');
            if (!serverSessionResponse.ok) {
                this.clearAllOutlierData();
                return;
            }
            
            const serverSession = await serverSessionResponse.json();
            
            // Verificar si hay datos de sesión en localStorage
            const sessionKey = 'outlier_session_id';
            const currentSessionId = localStorage.getItem(sessionKey);
            
            if (!currentSessionId) {
                this.clearAllOutlierData();
                return;
            }
            
            // Verificar si la sesión del localStorage coincide con la del servidor
            if (currentSessionId !== serverSession.session_id) {
                this.clearAllOutlierData();
                return;
            }
            
            // Verificar si el servidor tiene resultados de outliers
            if (!serverSession.has_outlier_results) {
                this.clearAllOutlierData();
                return;
            }
            
            // Verificar si el dataset actual existe
            const currentDatasetKey = 'current_outlier_dataset';
            const currentDatasetInfo = localStorage.getItem(currentDatasetKey);
            
            if (!currentDatasetInfo) {
                this.clearAllOutlierData();
                return;
            }
            
            
        } catch (error) {
            // En caso de error, limpiar datos por seguridad
            this.clearAllOutlierData();
        }
    },

    clearAllOutlierData() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('outlier_results_') || key === 'current_outlier_dataset' || key === 'outlier_session_id')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
    },

    bindEvents() {
        
        // Botón para ejecutar análisis primario
        const primaryAnalysisBtn = document.getElementById('runPrimaryAnalysis');
        if (primaryAnalysisBtn) {
            primaryAnalysisBtn.addEventListener('click', () => {
                this.runPrimaryAnalysis();
            });
        }

        // Botón para ejecutar análisis avanzado
        const advancedAnalysisBtn = document.getElementById('runAdvancedAnalysis');
        if (advancedAnalysisBtn) {
            advancedAnalysisBtn.addEventListener('click', () => {
                this.runAdvancedAnalysis();
            });
        }

        // Botón para ejecutar análisis de correlaciones comparativo
        const comparativeCorrelationsBtn = document.getElementById('runComparativeCorrelations');
        if (comparativeCorrelationsBtn) {
            comparativeCorrelationsBtn.addEventListener('click', () => {
                this.runComparativeCorrelations();
            });
        }

        // Botones del Marco Analítico Completo
        const demographicProfileBtn = document.getElementById('runDemographicProfile');
        if (demographicProfileBtn) {
            demographicProfileBtn.addEventListener('click', () => {
                this.runDemographicProfile();
            });
        }

        const cooccurrenceBtn = document.getElementById('runCooccurrenceAnalysis');
        if (cooccurrenceBtn) {
            cooccurrenceBtn.addEventListener('click', () => {
                this.runCooccurrenceAnalysis();
            });
        }

        const supervisedPCABtn = document.getElementById('runSupervisedPCA');
        if (supervisedPCABtn) {
            supervisedPCABtn.addEventListener('click', () => {
                this.runSupervisedPCA();
            });
        }

        const outlierClusteringBtn = document.getElementById('runOutlierClustering');
        if (outlierClusteringBtn) {
            outlierClusteringBtn.addEventListener('click', () => {
                this.runOutlierClustering();
            });
        }

        const networkAnalysisBtn = document.getElementById('runNetworkAnalysis');
        if (networkAnalysisBtn) {
            networkAnalysisBtn.addEventListener('click', () => {
                this.runNetworkAnalysis();
            });
        }

        const survivalAnalysisBtn = document.getElementById('runSurvivalAnalysis');
        if (survivalAnalysisBtn) {
            survivalAnalysisBtn.addEventListener('click', () => {
                this.runSurvivalAnalysis();
            });
        }

        const predictiveModelBtn = document.getElementById('runPredictiveModel');
        if (predictiveModelBtn) {
            predictiveModelBtn.addEventListener('click', () => {
                this.runPredictiveModel();
            });
        }

        // Cargar variables cuando se muestra el tab de Marco Analítico Completo
        const comprehensiveTab = document.getElementById('comprehensive-tab');
        if (comprehensiveTab) {
            comprehensiveTab.addEventListener('shown.bs.tab', () => {
                this.loadComprehensiveTabVariables();
                // Reiniciar scroll al principio de la pestaña
                const comprehensivePane = document.getElementById('comprehensive');
                if (comprehensivePane) {
                    comprehensivePane.scrollTop = 0;
                    // También reiniciar scroll de la ventana si es necesario
                    window.scrollTo({ top: comprehensivePane.offsetTop - 100, behavior: 'smooth' });
                }
            });
        }
        
        // Cargar variables cuando se expande el accordion de modelos predictivos
        const predictiveModelsAccordion = document.getElementById('predictiveModels');
        if (predictiveModelsAccordion) {
            // Usar múltiples eventos para asegurar que se cargue
            predictiveModelsAccordion.addEventListener('shown.bs.collapse', () => {
                setTimeout(() => this.loadPredictorVariables(), 100);
            });
            // También escuchar cuando se muestra el accordion
            const predictiveModelsButton = document.querySelector('[data-bs-target="#predictiveModels"]');
            if (predictiveModelsButton) {
                predictiveModelsButton.addEventListener('click', () => {
                    setTimeout(() => this.loadPredictorVariables(), 200);
                });
            }
        }
        
        // Reiniciar scroll para todas las pestañas cuando se cambian
        const allTabs = document.querySelectorAll('[data-bs-toggle="tab"]');
        allTabs.forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const targetId = e.target.getAttribute('data-bs-target');
                if (targetId) {
                    const targetPane = document.querySelector(targetId);
                    if (targetPane) {
                        targetPane.scrollTop = 0;
                        // Scroll suave hacia el inicio de la pestaña
                        setTimeout(() => {
                            const tabContent = document.getElementById('analysisTabContent');
                            if (tabContent) {
                                const tabContentTop = tabContent.getBoundingClientRect().top + window.pageYOffset;
                                window.scrollTo({ top: tabContentTop - 20, behavior: 'smooth' });
                            }
                        }, 100);
                    }
                }
            });
        });

        // Botón para ver detalles del dataset
        const viewDetailsBtn = document.getElementById('viewDatasetDetails');
        if (viewDetailsBtn) {
            viewDetailsBtn.addEventListener('click', () => {
                this.viewDatasetDetails();
            });
        }

        // Botón para verificar resultados de outliers (usar delegación de eventos)
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'checkOutlierResults') {
                this.loadDatasetFromStorage();
            }
        });
        
    },

    showInitialMessage() {
        const container = document.getElementById('datasetInfoContainer');
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="alert alert-info">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h6 class="alert-heading">
                            <i class="fas fa-info-circle me-2"></i>
                            Análisis y Visualización de Outliers
                        </h6>
                        <p class="mb-2">
                            Para usar esta pestaña, primero debes ejecutar la <strong>detección de outliers</strong> 
                            en la pestaña correspondiente. Una vez que tengas los resultados de outliers, 
                            podrás realizar análisis estadísticos comparativos entre los outliers detectados y el resto de la población.
                        </p>
                        <p class="mb-0">
                            <strong>Pasos a seguir:</strong>
                        </p>
                        <ol class="mb-0 mt-2">
                            <li>Ve a la pestaña <strong>"Detección de Outliers"</strong></li>
                            <li>Selecciona un dataset y ejecuta la detección de outliers</li>
                            <li>Regresa a esta pestaña y haz clic en <strong>"Verificar Resultados"</strong></li>
                        </ol>
                    </div>
                    <div class="col-md-4 text-center">
                        <button id="checkOutlierResults" class="btn btn-primary">
                            <i class="fas fa-search me-2"></i>
                            Verificar Resultados
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    async loadDatasetFromStorage() {
        try {
            
            // Primero verificar la sesión del servidor
            const serverSessionResponse = await fetch('/api/server-session');
            if (!serverSessionResponse.ok) {
                this.showNoOutlierResults();
                return;
            }
            
            const serverSession = await serverSessionResponse.json();
            
            // Verificar si hay un dataset actual configurado
            const currentDatasetKey = 'current_outlier_dataset';
            const sessionKey = 'outlier_session_id';
            
            const currentDatasetInfo = localStorage.getItem(currentDatasetKey);
            const currentSessionId = localStorage.getItem(sessionKey);
            
            
            if (!currentDatasetInfo || !currentSessionId) {
                this.showNoOutlierResults();
                return;
            }
            
            // Verificar si la sesión del localStorage coincide con la del servidor
            if (currentSessionId !== serverSession.session_id) {
                this.clearAllOutlierData();
                this.showNoOutlierResults();
                return;
            }
            
            // Verificar si el servidor tiene resultados de outliers
            if (!serverSession.has_outlier_results) {
                this.clearAllOutlierData();
                this.showNoOutlierResults();
                return;
            }
            
            const datasetInfo = JSON.parse(currentDatasetInfo);
            
            // Verificar que el dataset existe en localStorage
            const storageKey = `outlier_results_${datasetInfo.filename}`;
            const storedResults = localStorage.getItem(storageKey);
            
            
            if (!storedResults) {
                this.showNoOutlierResults();
                return;
            }
            
            // Cargar resultados de outliers
            this.outlierResults = JSON.parse(storedResults);
            void this.outlierResults;
            
            // Cargar la información completa del dataset desde el servidor
            await this.loadDatasetInfo(datasetInfo.filename);

            // Mostrar sección de análisis
            document.getElementById('analysisSection').style.display = 'block';
            
            // Cargar variables predictoras si el tab de Marco Analítico Completo está activo
            const comprehensiveTab = document.getElementById('comprehensive-tab');
            if (comprehensiveTab && comprehensiveTab.classList.contains('active')) {
                this.loadPredictorVariables();
            }

        } catch (error) {
            this.showError('Error al cargar el dataset desde el almacenamiento');
        }
    },

    async loadDatasetInfo(filename) {
        try {
            const response = await fetch('/api/datasets');
            const datasetsResponse = await response.json();
            
            // La respuesta es un objeto, no un array, necesitamos extraer los datasets
            const datasets = datasetsResponse.datasets || datasetsResponse;
            
            // Si es un objeto, convertirlo a array
            let datasetsArray;
            if (Array.isArray(datasets)) {
                datasetsArray = datasets;
            } else if (typeof datasets === 'object') {
                datasetsArray = Object.values(datasets);
            } else {
                throw new Error('Formato de respuesta inesperado');
            }
            
            
            const dataset = datasetsArray.find(d => d.filename === filename);
            
            if (!dataset) {
                this.showError(`No se encontró información del dataset: ${filename}`);
                return;
            }

            this.selectedDataset = dataset;
            this.currentDatasetInfo = dataset; // Set currentDatasetInfo for validation section
            this.displayDatasetInfo(dataset);

            // Mostrar sección de análisis
            document.getElementById('analysisSection').style.display = 'block';
            
            // Cargar variables predictoras si el tab de Marco Analítico Completo está activo
            const comprehensiveTab = document.getElementById('comprehensive-tab');
            if (comprehensiveTab && comprehensiveTab.classList.contains('active')) {
                this.loadPredictorVariables();
            }
            
            // Configurar validación de clustering (independiente)
            this.setupClusteringValidation();

        } catch (error) {
            this.showError('Error al cargar la información del dataset');
        }
    },

    displayDatasetInfo(dataset) {
        const container = document.getElementById('datasetInfoContainer');
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h6 class="card-title mb-2">
                                <i class="fas fa-file-excel me-2 text-success"></i>
                                Dataset Seleccionado: ${dataset.filename}
                            </h6>
                            <p class="card-text mb-2">
                                <small class="text-muted">
                                    <i class="fas fa-table me-1"></i>
                                    ${dataset.rows} filas, ${dataset.columns} columnas
                                </small>
                            </p>
                            <p class="card-text mb-0">
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>
                                    Subido: ${new Date(dataset.uploaded_at).toLocaleDateString()}
                                </small>
                            </p>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="btn-group" role="group">
                                <button id="viewDatasetDetails" class="btn btn-outline-primary btn-sm">
                                    <i class="fas fa-eye me-1"></i>
                                    Ver Detalles
                                </button>
                                <button id="checkOutlierResults" class="btn btn-outline-secondary btn-sm">
                                    <i class="fas fa-refresh me-1"></i>
                                    Actualizar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Actualizar directamente el panel de análisis estadístico con las nuevas cards
        const totalRecordsCard = document.getElementById('totalRecordsCard');
        const totalOutliersCard = document.getElementById('totalOutliersCard');
        const totalNormalCard = document.getElementById('totalNormalCard');
        const outlierPercentageCard = document.getElementById('outlierPercentageCard');
        
        if (totalRecordsCard) {
            totalRecordsCard.textContent = dataset.rows || 0;
        } else {
        }
        
        if (this.outlierResults && totalOutliersCard && totalNormalCard && outlierPercentageCard) {
            // Usar outliers_detected del módulo de detección (fuente de verdad)
            const totalOutliers = this.outlierResults.outliers_detected || 0;
            // Usar total_records del outlier_results si está disponible, sino usar dataset.rows
            const totalRecords = this.outlierResults.total_records || dataset.rows || 0;
            const totalNormal = totalRecords - totalOutliers;
            const outlierPercentage = totalRecords > 0 ? ((totalOutliers / totalRecords) * 100).toFixed(1) : 0;
            
            totalOutliersCard.textContent = totalOutliers;
            totalNormalCard.textContent = totalNormal;
            outlierPercentageCard.textContent = `${outlierPercentage}%`;
        }

        // Re-bind el evento del botón
        document.getElementById('viewDatasetDetails')?.addEventListener('click', () => {
            this.viewDatasetDetails();
        });
        
        // Re-bind el evento del botón actualizar
        document.getElementById('checkOutlierResults')?.addEventListener('click', () => {
            this.loadDatasetFromStorage();
        });
    },

    updateDatasetInfo(dataset) {
        // Función simple que solo llama a displayDatasetInfo
        this.displayDatasetInfo(dataset);
    },

    showNoOutlierResults() {
        const container = document.getElementById('datasetInfoContainer');
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="alert alert-warning">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h6 class="alert-heading">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            No hay resultados de outliers disponibles
                        </h6>
                        <p class="mb-2">
                            No se encontraron resultados de detección de outliers en el almacenamiento local. 
                            Para usar esta pestaña, primero debes ejecutar la detección de outliers en la pestaña correspondiente.
                        </p>
                        <p class="mb-0">
                            <strong>Pasos a seguir:</strong>
                        </p>
                        <ol class="mb-0 mt-2">
                            <li>Ve a la pestaña <strong>"Detección de Outliers"</strong></li>
                            <li>Selecciona un dataset y ejecuta la detección de outliers</li>
                            <li>Regresa a esta pestaña y haz clic en <strong>"Verificar Resultados"</strong></li>
                        </ol>
                    </div>
                    <div class="col-md-4 text-center">
                        <button id="checkOutlierResults" class="btn btn-warning">
                            <i class="fas fa-search me-2"></i>
                            Verificar Resultados
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    async viewDatasetDetails() {
        if (!this.selectedDataset) {
            this.showError('No hay dataset seleccionado');
            return;
        }

        try {
            const response = await fetch(`/api/datasets/${this.selectedDataset.filename}/details`);
            const details = await response.json();

            if (!details.success) {
                throw new Error(details.error || 'Error al cargar detalles');
            }

            // Crear modal con detalles del dataset
            this.showDatasetDetailsModal(details.data);

        } catch (error) {
            this.showError('Error al cargar los detalles del dataset');
        }
    },

    showDatasetDetailsModal(datasetData) {
        // Crear modal dinámicamente
        const modalId = 'datasetDetailsModal';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            document.body.appendChild(modal);
        }

        // Crear tabla de variables
        let variablesTable = '';
        if (datasetData.variables && datasetData.variables.length > 0) {
            variablesTable = `
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Variable</th>
                                <th>Tipo</th>
                                <th>Valores Únicos</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${datasetData.variables.map(var_info => `
                                <tr>
                                    <td><strong>${var_info.name}</strong></td>
                                    <td><span class="badge bg-secondary">${var_info.type}</span></td>
                                    <td>${var_info.unique_values}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-info-circle me-2"></i>
                            Detalles del Dataset: ${this.selectedDataset.filename}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong>Total de registros:</strong> ${datasetData.total_rows}
                            </div>
                            <div class="col-md-6">
                                <strong>Total de variables:</strong> ${datasetData.total_columns}
                            </div>
                        </div>
                        <h6>Variables del Dataset</h6>
                        ${variablesTable}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        `;

        // Mostrar modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    },



    async runPrimaryAnalysis() {
        
        if (!this.selectedDataset) {
            this.showError('Por favor, selecciona un dataset primero');
            return;
        }

        if (!this.outlierResults) {
            this.showError('No hay resultados de outliers disponibles. Ejecuta primero la detección de outliers.');
            return;
        }

        try {
            const button = document.getElementById('runPrimaryAnalysis');
            
            if (!button) {
                this.showError('Error interno: No se encontró el botón de análisis');
                return;
            }
            
            const originalText = button.innerHTML;
            
            // Mostrar loading
            button.innerHTML = '<span class="loading-spinner me-2"></span>Ejecutando análisis...';
            button.disabled = true;

            const requestBody = {
                outlier_results: this.outlierResults
            };

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/primary-analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const results = await response.json();

            // Verificar si hay error en los resultados
            if (results.error) {
                throw new Error(results.error || 'Error en el análisis');
            }

            // Mostrar resultados
            this.displayPrimaryAnalysisResults(results);

            // Restaurar botón
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error en el análisis primario: ${error.message}`);
            
            // Restaurar botón
            const button = document.getElementById('runPrimaryAnalysis');
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar Análisis Primario';
                button.disabled = false;
            }
        }
    },

    async runAdvancedAnalysis() {
        if (!this.selectedDataset) {
            this.showError('Por favor, selecciona un dataset primero');
            return;
        }

        try {
            const button = document.getElementById('runAdvancedAnalysis');
            const originalText = button.innerHTML;
            
            // Mostrar loading
            button.innerHTML = '<span class="loading-spinner me-2"></span>Ejecutando análisis...';
            button.disabled = true;

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/advanced-analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    outlier_results: this.outlierResults || {}
                })
            });

            const results = await response.json();

            // Verificar si hay error en los resultados
            if (results.error) {
                throw new Error(results.error || 'Error en el análisis');
            }

            // Mostrar resultados
            this.displayAdvancedAnalysisResults(results);

            // Restaurar botón
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error en el análisis avanzado: ${error.message}`);
            
            // Restaurar botón
            const button = document.getElementById('runAdvancedAnalysis');
            button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar Análisis Avanzado';
            button.disabled = false;
        }
    },

    displayPrimaryAnalysisResults(results) {
        
        const container = document.getElementById('primaryAnalysisResults');
        if (!container) {
            return;
        }
        container.style.display = 'block';

        // Mostrar análisis descriptivo
        this.displayDescriptiveAnalysis(results.descriptive_analysis);

        // Mostrar prueba de Mann-Whitney
        this.displayMannWhitneyTest(results.mann_whitney_test);

        // Mostrar prueba de Chi-Cuadrado
        this.displayChiSquareTest(results.chi_square_test);
    },



    displayDescriptiveAnalysis(descriptiveAnalysis) {
        
        // Guardar los datos para uso posterior
        this.descriptiveAnalysisData = descriptiveAnalysis;
        
        // Obtener todas las variables disponibles (excluyendo ID y es_outlier)
        const allVariables = [];
        
        if (descriptiveAnalysis && descriptiveAnalysis.numerical_variables) {
            Object.keys(descriptiveAnalysis.numerical_variables).forEach(variable => {
                if (variable !== 'es_outlier') {
                    allVariables.push({
                        name: variable,
                        type: 'numerical'
                    });
                }
            });
        } else {
        }
        
        if (descriptiveAnalysis && descriptiveAnalysis.categorical_variables) {
            Object.keys(descriptiveAnalysis.categorical_variables).forEach(variable => {
                if (variable !== 'es_outlier') {
                    allVariables.push({
                        name: variable,
                        type: 'categorical'
                    });
                }
            });
        } else {
        }
        
        
        // Llenar el selector
        const selector = document.getElementById('descriptiveVariableSelector');
        
        if (!selector) {
            return;
        }
        
        selector.innerHTML = '<option value="">-- Selecciona una variable --</option>';
        
        if (allVariables.length === 0) {
            // Si no hay variables, mostrar mensaje informativo
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No hay variables disponibles para análisis";
            option.disabled = true;
            selector.appendChild(option);
            
            // Mostrar mensaje informativo
            this.showDescriptiveAnalysisPlaceholder();
            return;
        }
        
        allVariables.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable.name;
            option.textContent = `${variable.name} (${variable.type === 'numerical' ? 'Numérica' : 'Categórica'})`;
            selector.appendChild(option);
        });
        
        
        // Configurar el evento del selector
        selector.onchange = (e) => {
            const selectedVariable = e.target.value;
            if (selectedVariable) {
                this.showDescriptiveAnalysisForVariable(selectedVariable);
            } else {
                this.showDescriptiveAnalysisPlaceholder();
            }
        };
        
        // Mostrar placeholder inicial
        this.showDescriptiveAnalysisPlaceholder();
    },

    showDescriptiveAnalysisForVariable(variableName) {
        const container = document.getElementById('descriptiveResultsContainer');
        const data = this.descriptiveAnalysisData;
        
        let table;
        let visualization;
        
        if (data.numerical_variables && data.numerical_variables[variableName]) {
            table = this.createNumericalDescriptiveTable(variableName, data.numerical_variables[variableName]);
            visualization = this.createNumericalVisualization(variableName, data.numerical_variables[variableName]);
        } else if (data.categorical_variables && data.categorical_variables[variableName]) {
            table = this.createCategoricalDescriptiveTable(variableName, data.categorical_variables[variableName]);
            visualization = this.createCategoricalVisualization(variableName, data.categorical_variables[variableName]);
        } else {
            container.innerHTML = '<div class="alert alert-warning">No se encontraron datos para esta variable.</div>';
            return;
        }
        
        container.innerHTML = '';
        container.appendChild(table);
        
        // Agregar visualización
        if (visualization) {
            container.appendChild(visualization);
        }
    },

    showDescriptiveAnalysisPlaceholder() {
        const container = document.getElementById('descriptiveResultsContainer');
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Selecciona una variable del menú desplegable para ver su análisis descriptivo comparativo.
            </div>
        `;
    },

    createNumericalDescriptiveTable(variable, data) {
        const container = document.createElement('div');
        container.className = 'results-container mb-3';
        
        container.innerHTML = `
            <h6 class="mb-2">${variable}</h6>
            <div class="table-responsive">
                <table class="table table-sm results-table">
                    <thead>
                        <tr>
                            <th>Estadística</th>
                            <th>Outliers (n=${data.outliers.count})</th>
                            <th>Datos Normales (n=${data.normal.count})</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Media</strong></td>
                            <td>${data.outliers.mean.toFixed(4)}</td>
                            <td>${data.normal.mean.toFixed(4)}</td>
                        </tr>
                        <tr>
                            <td><strong>Mediana</strong></td>
                            <td>${data.outliers.median.toFixed(4)}</td>
                            <td>${data.normal.median.toFixed(4)}</td>
                        </tr>
                        <tr>
                            <td><strong>Desv. Estándar</strong></td>
                            <td>${data.outliers.std.toFixed(4)}</td>
                            <td>${data.normal.std.toFixed(4)}</td>
                        </tr>
                        <tr>
                            <td><strong>Mínimo</strong></td>
                            <td>${data.outliers.min.toFixed(4)}</td>
                            <td>${data.normal.min.toFixed(4)}</td>
                        </tr>
                        <tr>
                            <td><strong>Máximo</strong></td>
                            <td>${data.outliers.max.toFixed(4)}</td>
                            <td>${data.normal.max.toFixed(4)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        return container;
    },

    createCategoricalDescriptiveTable(variable, data) {
        const container = document.createElement('div');
        container.className = 'results-container mb-3';
        
        // Obtener todas las categorías únicas
        const allCategories = new Set([
            ...Object.keys(data.outliers.frequencies || {}),
            ...Object.keys(data.normal.frequencies || {})
        ]);

        let tableRows = '';
        allCategories.forEach(category => {
            const outliersFreq = data.outliers.frequencies[category] || 0;
            const outliersProp = data.outliers.proportions[category] || 0;
            const normalFreq = data.normal.frequencies[category] || 0;
            const normalProp = data.normal.proportions[category] || 0;

            tableRows += `
                <tr>
                    <td><strong>${category}</strong></td>
                    <td>${outliersFreq} (${(outliersProp * 100).toFixed(1)}%)</td>
                    <td>${normalFreq} (${(normalProp * 100).toFixed(1)}%)</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <h6 class="mb-2">${variable}</h6>
            <div class="table-responsive">
                <table class="table table-sm results-table">
                    <thead>
                        <tr>
                            <th>Categoría</th>
                            <th>Outliers (n=${data.outliers.count})</th>
                            <th>Datos Normales (n=${data.normal.count})</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;

        return container;
    },

    createNumericalVisualization(variable, data) {
        const container = document.createElement('div');
        container.className = 'visualization-container mt-4';
        
        container.innerHTML = `
            <h6 class="mb-3">
                <i class="fas fa-chart-area me-2"></i>
                Visualizaciones para ${variable}
            </h6>
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">Gráfico de Densidad</h6>
                        </div>
                        <div class="card-body">
                            <div id="density_plot_${variable.replace(/[^a-zA-Z0-9]/g, '_')}"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">Gráfico de Violín con Puntos</h6>
                        </div>
                        <div class="card-body">
                            <div id="violin_plot_${variable.replace(/[^a-zA-Z0-9]/g, '_')}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Renderizar gráficos después de un pequeño delay
        setTimeout(() => {
            this.renderNumericalPlots(variable, data);
        }, 100);

        return container;
    },

    createCategoricalVisualization(variable, data) {
        const container = document.createElement('div');
        container.className = 'visualization-container mt-4';
        
        container.innerHTML = `
            <h6 class="mb-3">
                <i class="fas fa-chart-area me-2"></i>
                Visualizaciones para ${variable}
            </h6>
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">Gráfico de Barras</h6>
                        </div>
                        <div class="card-body">
                            <div id="bar_plot_${variable.replace(/[^a-zA-Z0-9]/g, '_')}"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">Diagrama de Pastel</h6>
                        </div>
                        <div class="card-body">
                            <div id="pie_plot_${variable.replace(/[^a-zA-Z0-9]/g, '_')}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Renderizar gráficos después de un pequeño delay
        setTimeout(() => {
            this.renderCategoricalPlots(variable, data);
        }, 100);

        return container;
    },

    renderNumericalPlots(variable, data) {
        const safeVarName = variable.replace(/[^a-zA-Z0-9]/g, '_');
        const displayVariable = this.formatVariableLabel(variable);
        
        // Gráfico de densidad
        const densityData = [
            {
                x: data.outliers.values || [],
                type: 'histogram',
                name: 'Outliers',
                opacity: 0.7,
                nbinsx: 20,
                marker: { color: 'red' }
            },
            {
                x: data.normal.values || [],
                type: 'histogram',
                name: 'Normal Data',
                opacity: 0.7,
                nbinsx: 20,
                marker: { color: 'blue' }
            }
        ];

        const densityLayout = {
            title: `Distribution of ${displayVariable}`,
            xaxis: { title: displayVariable },
            yaxis: { title: 'Frequency' },
            barmode: 'overlay',
            legend: { x: 1, y: 1 },
            height: 400
        };

        Plotly.newPlot(`density_plot_${safeVarName}`, densityData, densityLayout, {responsive: true});

        // Gráfico de violín con puntos
        const violinData = [
            {
                y: data.outliers.values || [],
                type: 'violin',
                name: 'Outliers',
                box: { visible: true },
                points: 'all',
                pointpos: -0.5,
                marker: { color: 'red', size: 3 },
                line: { color: 'red' }
            },
            {
                y: data.normal.values || [],
                type: 'violin',
                name: 'Normal Data',
                box: { visible: true },
                points: 'all',
                pointpos: 0.5,
                marker: { color: 'blue', size: 3 },
                line: { color: 'blue' }
            }
        ];

        const violinLayout = {
            title: `Distribution of ${displayVariable} - Violin with Points`,
            yaxis: { title: displayVariable },
            legend: { x: 1, y: 1 },
            height: 400
        };

        Plotly.newPlot(`violin_plot_${safeVarName}`, violinData, violinLayout, {responsive: true});
    },

    renderCategoricalPlots(variable, data) {
        const safeVarName = variable.replace(/[^a-zA-Z0-9]/g, '_');
        const displayVariable = this.formatVariableLabel(variable);
        
        // Obtener todas las categorías
        const allCategories = new Set([
            ...Object.keys(data.outliers.frequencies || {}),
            ...Object.keys(data.normal.frequencies || {})
        ]);

        // Gráfico de barras
        const barData = [
            {
                x: Array.from(allCategories),
                y: Array.from(allCategories).map(cat => data.outliers.frequencies[cat] || 0),
                type: 'bar',
                name: 'Outliers',
                marker: { color: 'red' }
            },
            {
                x: Array.from(allCategories),
                y: Array.from(allCategories).map(cat => data.normal.frequencies[cat] || 0),
                type: 'bar',
                name: 'Normal Data',
                marker: { color: 'blue' }
            }
        ];

        const barLayout = {
            title: `Frequencies of ${displayVariable}`,
            xaxis: { title: 'Categories' },
            yaxis: { title: 'Frequency' },
            barmode: 'group',
            legend: { x: 1, y: 1 },
            height: 400
        };

        Plotly.newPlot(`bar_plot_${safeVarName}`, barData, barLayout, {responsive: true});

        // Diagrama de pastel (solo para outliers)
        const pieData = [{
            labels: Array.from(allCategories),
            values: Array.from(allCategories).map(cat => data.outliers.frequencies[cat] || 0),
            type: 'pie',
            name: 'Outliers',
            marker: {
                colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd']
            }
        }];

        const pieLayout = {
            title: `${displayVariable} Distribution - Outliers`,
            legend: { x: 1, y: 1 },
            height: 400
        };

        Plotly.newPlot(`pie_plot_${safeVarName}`, pieData, pieLayout, {responsive: true});
    },

    displayMannWhitneyTest(mannWhitneyResults) {
        
        // Guardar los datos para uso posterior
        this.mannWhitneyData = mannWhitneyResults;
        
        // Obtener variables numéricas disponibles (excluyendo ID y es_outlier)
        const numericalVariables = [];
        
        if (mannWhitneyResults) {
            Object.keys(mannWhitneyResults).forEach(variable => {
                // Excluir 'es_outlier' y 'missing_values_info' que son metadatos, no variables
                if (variable !== 'es_outlier' && variable !== 'missing_values_info') {
                    numericalVariables.push(variable);
                }
            });
        } else {
        }
        
        
        // Llenar el selector
        const selector = document.getElementById('mannWhitneyVariableSelector');
        
        if (!selector) {
            return;
        }
        
        selector.innerHTML = '<option value="">-- Selecciona una variable numérica --</option>';
        
        if (numericalVariables.length === 0) {
            // Si no hay variables, mostrar mensaje informativo
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No hay variables numéricas disponibles";
            option.disabled = true;
            selector.appendChild(option);
            
            // Mostrar mensaje informativo
            this.showMannWhitneyTestPlaceholder();
            return;
        }
        
        numericalVariables.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable;
            option.textContent = variable;
            selector.appendChild(option);
        });
        
        
        // Llenar selector múltiple para boxplots
        const multiSelector = document.getElementById('mannWhitneyMultiVariableSelector');
        if (multiSelector) {
            multiSelector.innerHTML = '';
            numericalVariables.forEach(variable => {
                const option = document.createElement('option');
                option.value = variable;
                option.textContent = variable;
                multiSelector.appendChild(option);
            });
        }
        
        // Llenar selector de variables para gráficos de violín
        const violinSelector = document.getElementById('violinPlotVariableSelector');
        if (violinSelector) {
            violinSelector.innerHTML = '<option value="">-- Selecciona una variable numérica --</option>';
            numericalVariables.forEach(variable => {
                const option = document.createElement('option');
                option.value = variable;
                option.textContent = variable;
                violinSelector.appendChild(option);
            });
        }
        
        // Agregar listener al botón de generar gráfico de violín
        const generateViolinBtn = document.getElementById('generateViolinPlotBtn');
        if (generateViolinBtn) {
            generateViolinBtn.addEventListener('click', () => {
                const selectedVariable = violinSelector ? violinSelector.value : '';
                if (selectedVariable) {
                    this.generateViolinPlotForPublication(selectedVariable);
                } else {
                    alert('Por favor selecciona una variable para generar el gráfico de violín.');
                }
            });
        }
        
        // Configurar el evento del selector
        const self = this; // Guardar referencia al contexto
        selector.onchange = function(e) {
            const selectedVariable = e.target.value;
            if (selectedVariable) {
                self.showMannWhitneyTestForVariable(selectedVariable);
                // Generar boxplot individual
                self.generateMannWhitneySingleBoxplot(selectedVariable);
            } else {
                self.showMannWhitneyTestPlaceholder();
                self.hideMannWhitneySingleBoxplot();
            }
        };
        
        // Agregar listener al botón de generar boxplot comparativo
        const generateBoxplotBtn = document.getElementById('generateMannWhitneyBoxplotBtn');
        if (generateBoxplotBtn) {
            generateBoxplotBtn.addEventListener('click', function() {
                const selectedVariables = Array.from(multiSelector.selectedOptions).map(opt => opt.value);
                if (selectedVariables.length > 0) {
                    self.generateMannWhitneyMultiBoxplot(selectedVariables);
                } else {
                    alert('Por favor selecciona al menos una variable para comparar.');
                }
            });
        }
        
        // Mostrar placeholder inicial
        this.showMannWhitneyTestPlaceholder();
    },

    showMannWhitneyTestForVariable(variableName) {
        
        const container = document.getElementById('mannWhitneyResultsContainer');
        if (!container) {
            return;
        }
        
        if (!this.mannWhitneyData) {
            container.innerHTML = '<div class="alert alert-danger">Error: No hay datos de Mann-Whitney disponibles.</div>';
            return;
        }
        
        const data = this.mannWhitneyData[variableName];
        
        if (!data) {
            container.innerHTML = `<div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                No se encontraron datos para la variable "${variableName}".
                <br><small>Variables disponibles: ${Object.keys(this.mannWhitneyData).filter(v => v !== 'missing_values_info').join(', ')}</small>
            </div>`;
            return;
        }
        
        const card = this.createMannWhitneyResultCard(variableName, data);
        container.innerHTML = '';
        container.appendChild(card);
    },

    showMannWhitneyTestPlaceholder() {
        const container = document.getElementById('mannWhitneyResultsContainer');
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Selecciona una variable numérica del menú desplegable para ver los resultados de la prueba U de Mann-Whitney.
            </div>
        `;
    },

    createMannWhitneyResultCard(variable, data) {
        const container = document.createElement('div');
        container.className = 'results-container mb-3';

        if (data.error) {
            container.innerHTML = `
                <h6 class="mb-2">${variable}</h6>
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error: ${data.error}
                </div>
            `;
            return container;
        }
        
        // Manejar caso de datos insuficientes
        if (data.status === 'insufficient_data' || data.message) {
            container.innerHTML = `
                <h6 class="mb-2">${variable}</h6>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Información:</strong> ${data.message}
                    ${data.outliers_count !== undefined ? `<br><small>Outliers: ${data.outliers_count}, Datos normales: ${data.normal_count}</small>` : ''}
                </div>
            `;
            return container;
        }

        const significanceClass = data.significant ? 'significant' : 'not-significant';
        const significanceIcon = data.significant ? 'fas fa-check-circle' : 'fas fa-times-circle';

        // Determinar la interpretación del tamaño del efecto
        const r = Math.abs(data.rosenthal_r || 0);
        let effectSizeInterpretation = '';
        let effectSizeClass = '';
        
        if (r < 0.1) {
            effectSizeInterpretation = 'Efecto pequeño';
            effectSizeClass = 'text-muted';
        } else if (r < 0.3) {
            effectSizeInterpretation = 'Efecto pequeño a mediano';
            effectSizeClass = 'text-info';
        } else if (r < 0.5) {
            effectSizeInterpretation = 'Efecto mediano';
            effectSizeClass = 'text-warning';
        } else {
            effectSizeInterpretation = 'Efecto grande';
            effectSizeClass = 'text-danger';
        }

        container.innerHTML = `
            <h6 class="mb-2">${variable}</h6>
            <div class="row">
                <div class="col-md-6">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${(data.statistic_u || 0).toFixed(4)}</div>
                            <div class="stat-label">Estadístico U (Mann-Whitney)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${(data.z_score || 0).toFixed(4)}</div>
                            <div class="stat-label">Z-score</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${(data.rosenthal_r || 0).toFixed(4)}</div>
                            <div class="stat-label">Magnitud del efecto (r)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value ${significanceClass}">${data.p_value_formatted}</div>
                            <div class="stat-label">P-valor</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="alert ${data.significant ? 'alert-success' : 'alert-secondary'}">
                        <i class="${significanceIcon} me-2"></i>
                        <strong>Interpretación:</strong> ${data.interpretation}
                    </div>
                    <div class="small text-muted mb-2">
                        <strong>Outliers:</strong> ${data.outliers_count} | 
                        <strong>Datos normales:</strong> ${data.normal_count}
                    </div>
                    <div class="small text-info">
                        <i class="fas fa-info-circle me-1"></i>
                        ${data.test_description || "Prueba de Wilcoxon rank sum test con corrección de continuidad"}
                    </div>
                </div>
            </div>
            
            <!-- Panel de evaluación del tamaño del efecto -->
            <div class="row mt-3">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">
                                
                                Evaluación del Tamaño del Efecto (r de Rosenthal)
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="alert ${effectSizeClass}">
                                        <i class="fas fa-info-circle me-2"></i>
                                        <strong>Interpretación del tamaño del efecto:</strong> ${effectSizeInterpretation}
                                    </div>
                                    <div class="small text-muted mb-3">
                                        <strong>Nota:</strong> El estadístico r de Rosenthal (también conocido como r de Cohen) 
                                        mide la magnitud del efecto entre los grupos de outliers y datos normales.
                                    </div>
                                    <div class="small text-muted mb-2">
                                        <strong>Fórmula r de Rosenthal:</strong> r = Z / √N
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card border-secondary">
                                        <div class="card-header bg-secondary text-white">
                                            <h6 class="mb-0">Rangos de Evaluación</h6>
                                        </div>
                                        <div class="card-body p-2">
                                            <div class="small">
                                                <div class="d-flex justify-content-between mb-1">
                                                    <span>r < 0.1:</span>
                                                    <span class="text-muted">Efecto pequeño</span>
                                                </div>
                                                <div class="d-flex justify-content-between mb-1">
                                                    <span>0.1 ≤ r < 0.3:</span>
                                                    <span class="text-info">Efecto pequeño a mediano</span>
                                                </div>
                                                <div class="d-flex justify-content-between mb-1">
                                                    <span>0.3 ≤ r < 0.5:</span>
                                                    <span class="text-warning">Efecto mediano</span>
                                                </div>
                                                <div class="d-flex justify-content-between">
                                                    <span>r ≥ 0.5:</span>
                                                    <span class="text-danger">Efecto grande</span>
                                                </div>
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

        return container;
    },

    generateMannWhitneySingleBoxplot(variableName) {
        const container = document.getElementById('mannWhitneySingleBoxplot');
        const containerDiv = document.getElementById('mannWhitneySingleBoxplotContainer');
        
        if (!container || !containerDiv) {
            return;
        }
        
        if (!this.mannWhitneyData || !this.mannWhitneyData[variableName]) {
            this.hideMannWhitneySingleBoxplot();
            return;
        }
        
        const data = this.mannWhitneyData[variableName];
        
        // Obtener p-value
        let pValue = data.p_value;
        if (pValue === undefined || pValue === null) {
            // Intentar parsear desde p_value_formatted
            const pValueStr = data.p_value_formatted || '0';
            pValue = parseFloat(pValueStr.replace(/[<>=]/g, '')) || 0;
        }
        
        // Crear un boxplot con el punto de datos visible
        const displayVariableName = this.formatVariableLabel(variableName);
        const trace = {
            y: [pValue],
            type: 'box',
            name: displayVariableName,
            marker: {
                color: pValue < 0.05 ? '#e74c3c' : '#3498db',
                size: 12,
                line: {
                    color: pValue < 0.05 ? '#c0392b' : '#2980b9',
                    width: 2
                }
            },
            boxpoints: 'all',
            pointpos: 0,
            jitter: 0.5,
            boxmean: false,
            fillcolor: pValue < 0.05 ? 'rgba(231, 76, 60, 0.3)' : 'rgba(52, 152, 219, 0.3)',
            line: {
                color: pValue < 0.05 ? '#e74c3c' : '#3498db',
                width: 2
            }
        };
        
        const maxY = Math.max(0.1, pValue * 1.3);
        
        const layout = {
            title: {
                text: `Significance p-value: ${displayVariableName}`,
                font: { size: 16, color: '#2c3e50' }
            },
            yaxis: {
                title: {
                    text: 'P-value',
                    font: { size: 14 }
                },
                range: [-0.02, maxY],
                tickformat: '.4f',
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                showgrid: true
            },
            xaxis: {
                title: {
                    text: displayVariableName,
                    font: { size: 14 }
                },
                showticklabels: true,
                tickmode: 'array',
                tickvals: [displayVariableName],
                ticktext: [displayVariableName]
            },
            shapes: [{
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                yref: 'y',
                y0: 0.05,
                y1: 0.05,
                line: {
                    color: '#f39c12',
                    width: 3,
                    dash: 'dash'
                }
            }],
            annotations: [{
                x: 0.98,
                y: 0.05,
                xref: 'paper',
                yref: 'y',
                text: 'α = 0.05',
                showarrow: false,
                bgcolor: 'rgba(243, 156, 18, 0.3)',
                bordercolor: '#f39c12',
                borderwidth: 2,
                font: { size: 12, color: '#2c3e50' },
                xanchor: 'right'
            }],
            height: 450,
            margin: { l: 70, r: 30, t: 70, b: 60 },
            plot_bgcolor: 'rgba(255, 255, 255, 0.8)',
            paper_bgcolor: 'white'
        };
        
        Plotly.newPlot(container, [trace], layout, {responsive: true});
        containerDiv.style.display = 'block';
    },

    hideMannWhitneySingleBoxplot() {
        const containerDiv = document.getElementById('mannWhitneySingleBoxplotContainer');
        if (containerDiv) {
            containerDiv.style.display = 'none';
        }
    },

    generateMannWhitneyMultiBoxplot(selectedVariables) {
        const container = document.getElementById('mannWhitneyMultiBoxplot');
        const containerDiv = document.getElementById('mannWhitneyMultiBoxplotContainer');
        
        if (!container || !containerDiv) {
            return;
        }
        
        if (!this.mannWhitneyData || selectedVariables.length === 0) {
            containerDiv.style.display = 'none';
            return;
        }
        
        // Recopilar p-values de todas las variables seleccionadas
        const pValues = [];
        const variableNames = [];
        const fillColors = [];
        const pointColors = [];
        
        selectedVariables.forEach(variableName => {
            const data = this.mannWhitneyData[variableName];
            let pValue = null;
            
            if (data && data.p_value !== undefined && data.p_value !== null) {
                pValue = data.p_value;
                if (typeof pValue === 'string') {
                    pValue = parseFloat(pValue.replace(/[<>=]/g, '')) || 0;
                }
            } else if (data && data.p_value_formatted) {
                // Intentar parsear desde p_value_formatted
                const pValueStr = data.p_value_formatted;
                pValue = parseFloat(pValueStr.replace(/[<>=]/g, '')) || 0;
            }
            
            if (pValue !== null) {
                pValues.push(pValue);
                variableNames.push(this.formatVariableLabel(variableName));
                
                // Colores diferentes para significativos y no significativos
                if (pValue < 0.05) {
                    fillColors.push('rgba(231, 76, 60, 0.3)'); // Rojo claro
                    pointColors.push('#e74c3c'); // Rojo
                } else {
                    fillColors.push('rgba(52, 152, 219, 0.3)'); // Azul claro
                    pointColors.push('#3498db'); // Azul
                }
            }
        });
        
        if (pValues.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">No hay datos de p-values disponibles para las variables seleccionadas.</div>';
            containerDiv.style.display = 'block';
            return;
        }
        
        // Crear un gráfico de puntos con formato mejorado
        // Como solo tenemos un valor por variable, usamos scatter con mejor formato visual
        const plotTraces = [{
            y: pValues,
            x: variableNames,
            type: 'scatter',
            mode: 'markers+lines',
            name: 'P-values',
            marker: {
                color: pointColors,
                size: 14,
                line: {
                    color: pointColors.map(c => c === '#e74c3c' ? '#c0392b' : '#2980b9'),
                    width: 2.5
                },
                symbol: 'circle',
                opacity: 0.9
            },
            line: {
                color: 'rgba(128, 128, 128, 0.3)',
                width: 1,
                dash: 'dot'
            },
            showlegend: false
        }];
        
        const maxPValue = Math.max(...pValues, 0.1);
        
        const layout = {
            title: {
                text: 'Comparative Significance p-values',
                font: { size: 16, color: '#2c3e50' }
            },
            yaxis: {
                title: {
                    text: 'P-value',
                    font: { size: 14, color: '#2c3e50' }
                },
                range: [-0.02, maxPValue * 1.3],
                tickformat: '.4f',
                gridcolor: 'rgba(128, 128, 128, 0.3)',
                showgrid: true,
                zeroline: false,
                tickfont: { size: 11 }
            },
            xaxis: {
                title: {
                    text: 'Variables',
                    font: { size: 14, color: '#2c3e50' }
                },
                tickmode: 'array',
                tickvals: variableNames,
                ticktext: variableNames,
                tickangle: -45,
                tickfont: { size: 11 },
                showgrid: false
            },
            shapes: [{
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                yref: 'y',
                y0: 0.05,
                y1: 0.05,
                line: {
                    color: '#f39c12',
                    width: 3,
                    dash: 'dash'
                }
            }],
            annotations: [{
                x: 0.98,
                y: 0.05,
                xref: 'paper',
                yref: 'y',
                text: 'α = 0.05 (Significance threshold)',
                showarrow: false,
                bgcolor: 'rgba(243, 156, 18, 0.3)',
                bordercolor: '#f39c12',
                borderwidth: 2,
                font: { size: 12, color: '#2c3e50' },
                xanchor: 'right'
            }],
            height: 550,
            margin: { l: 70, r: 30, t: 70, b: 120 },
            plot_bgcolor: 'rgba(255, 255, 255, 0.8)',
            paper_bgcolor: 'white',
            showlegend: false
        };
        
        Plotly.newPlot(container, plotTraces, layout, {responsive: true});
        containerDiv.style.display = 'block';
    },

    formatVariableLabel(variableName) {
        if (!variableName) return variableName;
        return variableName.replace(/TGFB/g, 'TGFβ');
    },

    async generateViolinPlotForPublication(variableName) {
        const container = document.getElementById('violinPlotChart');
        const containerDiv = document.getElementById('violinPlotContainer');
        
        if (!container || !containerDiv) {
            return;
        }
        
        // Obtener datos de la variable desde descriptiveAnalysisData
        let outliersValues = [];
        let normalValues = [];
        let outliersCount = 0;
        let normalCount = 0;
        
        // Primero intentar obtener los conteos correctos de outliers finales
        if (this.outlierResults) {
            outliersCount = this.outlierResults.outliers_detected || 0;
            const totalRecords = this.outlierResults.total_records || 0;
            normalCount = totalRecords - outliersCount;
        }
        
        if (this.descriptiveAnalysisData && this.descriptiveAnalysisData.numerical_variables && 
            this.descriptiveAnalysisData.numerical_variables[variableName]) {
            const variableData = this.descriptiveAnalysisData.numerical_variables[variableName];
            outliersValues = variableData.outliers.values || [];
            normalValues = variableData.normal.values || [];
            // Usar los conteos del análisis descriptivo si están disponibles (son más precisos por variable)
            if (variableData.outliers.count !== undefined) {
                outliersCount = variableData.outliers.count;
            }
            if (variableData.normal.count !== undefined) {
                normalCount = variableData.normal.count;
            }
        } else {
            // Si no están en descriptiveAnalysisData, obtenerlos del backend
            try {
                if (!this.currentDataset || !this.currentDataset.filename) {
                    container.innerHTML = '<div class="alert alert-warning">No hay dataset seleccionado.</div>';
                    containerDiv.style.display = 'block';
                    return;
                }
                
                const filename = this.currentDataset.filename;
                const response = await fetch(`/api/datasets/${encodeURIComponent(filename)}/paginated?page=1&page_size=10000`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.data && Array.isArray(data.data)) {
                        // Separar por grupo de outliers FINALES (usar es_outlier)
                        data.data.forEach(row => {
                            const value = parseFloat(row[variableName]);
                            if (!isNaN(value)) {
                                if (row.es_outlier === true || row.es_outlier === 1 || row.es_outlier === 'Outlier') {
                                    outliersValues.push(value);
                                } else {
                                    normalValues.push(value);
                                }
                            }
                        });
                    }
                }
                
                // Si no tenemos conteos de outlierResults, usar los conteos de los valores obtenidos
                if (!this.outlierResults || outliersCount === 0) {
                    outliersCount = outliersValues.length;
                    normalCount = normalValues.length;
                }
            } catch (error) {
                container.innerHTML = '<div class="alert alert-danger">Error al obtener los datos del servidor.</div>';
                containerDiv.style.display = 'block';
                return;
            }
        }
        
        if (outliersValues.length === 0 && normalValues.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">No hay datos disponibles para esta variable.</div>';
            containerDiv.style.display = 'block';
            return;
        }
        
        
        // Crear gráfico de violín con boxplot interno y puntos individuales
        const traces = [];
        
        if (outliersValues.length > 0) {
            traces.push({
                x: Array(outliersValues.length).fill('Outliers'),
                y: outliersValues,
                type: 'violin',
                name: `Outliers (n=${outliersCount})`,
                box: {
                    visible: true,
                    width: 0.3,
                    fillcolor: 'rgba(231, 76, 60, 0.5)',
                    line: { color: '#c0392b', width: 2 }
                },
                meanline: {
                    visible: true,
                    color: '#c0392b',
                    width: 2
                },
                points: 'all',
                pointpos: -0.5,
                jitter: 0.5,
                marker: {
                    color: '#e74c3c',
                    size: 5,
                    opacity: 0.7,
                    line: { color: '#c0392b', width: 1 }
                },
                fillcolor: 'rgba(231, 76, 60, 0.3)',
                line: {
                    color: '#e74c3c',
                    width: 2
                },
                side: 'negative',
                width: 0.6
            });
        }
        
        if (normalValues.length > 0) {
            traces.push({
                x: Array(normalValues.length).fill('Normal'),
                y: normalValues,
                type: 'violin',
                name: `Normal (n=${normalCount})`,
                box: {
                    visible: true,
                    width: 0.3,
                    fillcolor: 'rgba(52, 152, 219, 0.5)',
                    line: { color: '#2980b9', width: 2 }
                },
                meanline: {
                    visible: true,
                    color: '#2980b9',
                    width: 2
                },
                points: 'all',
                pointpos: 0.5,
                jitter: 0.5,
                marker: {
                    color: '#3498db',
                    size: 5,
                    opacity: 0.7,
                    line: { color: '#2980b9', width: 1 }
                },
                fillcolor: 'rgba(52, 152, 219, 0.3)',
                line: {
                    color: '#3498db',
                    width: 2
                },
                side: 'positive',
                width: 0.6
            });
        }
        
        // Obtener información de significancia si está disponible
        let pValueText = '';
        let significanceText = '';
        if (this.mannWhitneyData && this.mannWhitneyData[variableName]) {
            const mwData = this.mannWhitneyData[variableName];
            if (mwData.p_value_formatted) {
                pValueText = `p = ${mwData.p_value_formatted}`;
                significanceText = mwData.significant ? ' (Significant)' : ' (Not significant)';
            }
        }
        
        const displayVariableName = this.formatVariableLabel(variableName);
        const layout = {
            title: {
                text: `${displayVariableName}${pValueText ? `<br><span style="font-size: 14px; color: #7f8c8d;">${pValueText}${significanceText}</span>` : ''}`,
                font: { size: 18, color: '#2c3e50' }
            },
            yaxis: {
                title: {
                    text: displayVariableName,
                    font: { size: 14, color: '#2c3e50' }
                },
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                showgrid: true
            },
            xaxis: {
                title: {
                    text: 'Groups',
                    font: { size: 14, color: '#2c3e50' }
                },
                type: 'category',
                categoryorder: 'array',
                categoryarray: ['Outliers', 'Normal'],
                showgrid: false,
                tickfont: { size: 12, color: '#2c3e50' },
                showticklabels: true,
                zeroline: false
            },
            legend: {
                x: 1.02,
                y: 1,
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                bordercolor: '#95a5a6',
                borderwidth: 1
            },
            height: 500,
            margin: { l: 70, r: 100, t: 80, b: 60 },
            plot_bgcolor: 'rgba(255, 255, 255, 0.9)',
            paper_bgcolor: 'white'
        };
        
        Plotly.newPlot(container, traces, layout, {responsive: true});
        containerDiv.style.display = 'block';
    },

    displayChiSquareTest(chiSquareResults) {
        
        // Guardar los datos para uso posterior
        this.chiSquareData = chiSquareResults;
        
        // Obtener variables categóricas disponibles (excluyendo ID y es_outlier)
        const categoricalVariables = [];
        
        if (chiSquareResults) {
            Object.keys(chiSquareResults).forEach(variable => {
                if (variable !== 'es_outlier') {
                    categoricalVariables.push(variable);
                }
            });
        } else {
        }
        
        
        // Llenar el selector
        const selector = document.getElementById('chiSquareVariableSelector');
        
        if (!selector) {
            return;
        }
        
        selector.innerHTML = '<option value="">-- Selecciona una variable categórica --</option>';
        
        if (categoricalVariables.length === 0) {
            // Si no hay variables, mostrar mensaje informativo
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No hay variables categóricas disponibles";
            option.disabled = true;
            selector.appendChild(option);
            
            // Mostrar mensaje informativo
            this.showChiSquareTestPlaceholder();
            return;
        }
        
        categoricalVariables.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable;
            option.textContent = variable;
            selector.appendChild(option);
        });
        
        
        // Configurar el evento del selector
        selector.onchange = (e) => {
            const selectedVariable = e.target.value;
            if (selectedVariable) {
                this.showChiSquareTestForVariable(selectedVariable);
            } else {
                this.showChiSquareTestPlaceholder();
            }
        };
        
        // Mostrar placeholder inicial
        this.showChiSquareTestPlaceholder();
    },

    showChiSquareTestForVariable(variableName) {
        const container = document.getElementById('chiSquareResultsContainer');
        const data = this.chiSquareData[variableName];
        
        if (!data) {
            container.innerHTML = '<div class="alert alert-warning">No se encontraron datos para esta variable.</div>';
            return;
        }
        
        const card = this.createChiSquareResultCard(variableName, data);
        container.innerHTML = '';
        container.appendChild(card);
    },

    showChiSquareTestPlaceholder() {
        const container = document.getElementById('chiSquareResultsContainer');
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Selecciona una variable categórica del menú desplegable para ver los resultados de la prueba de Chi-Cuadrado.
            </div>
        `;
    },

    createChiSquareResultCard(variable, data) {
        const container = document.createElement('div');
        container.className = 'results-container mb-3';

        if (data.error) {
            container.innerHTML = `
                <h6 class="mb-2">${variable}</h6>
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error: ${data.error}
                </div>
            `;
            return container;
        }
        
        // Manejar caso de datos insuficientes
        if (data.status === 'insufficient_data' || data.message) {
            container.innerHTML = `
                <h6 class="mb-2">${variable}</h6>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Información:</strong> ${data.message}
                    ${data.outliers_count !== undefined ? `<br><small>Outliers: ${data.outliers_count}, Datos normales: ${data.normal_count}</small>` : ''}
                </div>
            `;
            return container;
        }

        const significanceClass = data.significant ? 'significant' : 'not-significant';
        const significanceIcon = data.significant ? 'fas fa-check-circle' : 'fas fa-times-circle';

        // Crear tabla de contingencia
        const contingencyTable = this.createContingencyTable(data.contingency_table);

        // Determinar qué estadístico mostrar basado en el tipo de prueba
        let statisticDisplay = '';
        if (data.test_type === "Test Exacto de Fisher") {
            statisticDisplay = `
                <div class="stat-card">
                    <div class="stat-value">${data.chi2_statistic ? data.chi2_statistic.toFixed(4) : 'N/A'}</div>
                    <div class="stat-label">Estadístico χ²</div>
                </div>
            `;
        } else {
            statisticDisplay = `
                <div class="stat-card">
                    <div class="stat-value">${data.chi2_statistic ? data.chi2_statistic.toFixed(4) : 'N/A'}</div>
                    <div class="stat-label">Estadístico χ²</div>
                </div>
            `;
        }

        // Determinar si mostrar grados de libertad
        let degreesOfFreedomDisplay = '';
        if (data.degrees_of_freedom !== null && data.degrees_of_freedom !== undefined) {
            degreesOfFreedomDisplay = `
                <div class="stat-card">
                    <div class="stat-value">${data.degrees_of_freedom}</div>
                    <div class="stat-label">Grados de libertad</div>
                </div>
            `;
        }

        container.innerHTML = `
            <h6 class="mb-2">${variable}</h6>
            <div class="row">
                <div class="col-md-6">
                    <div class="stats-grid">
                        ${statisticDisplay}
                        <div class="stat-card">
                            <div class="stat-value ${significanceClass}">${data.p_value_formatted}</div>
                            <div class="stat-label">P-valor</div>
                        </div>
                        ${degreesOfFreedomDisplay}
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="alert ${data.significant ? 'alert-success' : 'alert-secondary'}">
                        <i class="${significanceIcon} me-2"></i>
                        <strong>Interpretación:</strong> ${data.interpretation}
                    </div>
                    <div class="small text-muted">
                        <strong>Outliers:</strong> ${data.outliers_count} | 
                        <strong>Datos normales:</strong> ${data.normal_count}
                    </div>
                </div>
            </div>
            <!-- Información del tipo de prueba -->
            <div class="row mt-2">
                <div class="col-12">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        <strong>Tipo de prueba:</strong> ${data.test_type || 'Chi-Cuadrado estándar'}
                        ${data.test_description ? `<br><small class="text-muted">${data.test_description}</small>` : ''}
                    </div>
                </div>
            </div>
            ${data.effect_size_value !== null ? `
            <!-- Panel de evaluación del tamaño del efecto -->
            <div class="row mt-3">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">
                                <i class="fas fa-chart-line me-2 text-dark"></i>
                                Evaluación del Tamaño del Efecto (${data.effect_size_name})
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="alert ${data.effect_size_interpretation.includes('grande') ? 'alert-danger' : 
                                                     data.effect_size_interpretation.includes('mediano') ? 'alert-warning' : 
                                                     data.effect_size_interpretation.includes('pequeño a mediano') ? 'alert-info' : 'alert-secondary'}">
                                        <i class="fas fa-info-circle me-2 text-dark"></i>
                                        <strong class="text-dark">Interpretación del tamaño del efecto:</strong> ${data.effect_size_interpretation}
                                    </div>
                                    <div class="small text-muted mb-3">
                                        <strong>Nota:</strong> El tamaño del efecto indica la magnitud de la asociación entre la variable categórica y el estado de outlier.
                                    </div>
                                    <div class="text-center">
                                        <div class="h4 mb-0 text-dark">${data.effect_size_value.toFixed(4)}</div>
                                        <small class="text-muted">${data.effect_size_name}</small>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card border-secondary">
                                        <div class="card-header bg-secondary text-white">
                                            <h6 class="mb-0">Rangos de Evaluación</h6>
                                        </div>
                                        <div class="card-body p-2">
                                            <div class="small">
                                                <div class="d-flex justify-content-between mb-1">
                                                    <span>φ/V < 0.1:</span>
                                                    <span class="text-muted">Efecto pequeño</span>
                                                </div>
                                                <div class="d-flex justify-content-between mb-1">
                                                    <span>0.1 ≤ φ/V < 0.3:</span>
                                                    <span class="text-info">Efecto pequeño a mediano</span>
                                                </div>
                                                <div class="d-flex justify-content-between mb-1">
                                                    <span>0.3 ≤ φ/V < 0.5:</span>
                                                    <span class="text-warning">Efecto mediano</span>
                                                </div>
                                                <div class="d-flex justify-content-between">
                                                    <span>φ/V ≥ 0.5:</span>
                                                    <span class="text-danger">Efecto grande</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
            <div class="mt-3">
                <h6>Tabla de Contingencia</h6>
                ${contingencyTable}
            </div>
        `;

        return container;
    },

    createContingencyTable(contingencyData) {
        // Verificar si es la nueva estructura o la antigua
        if (contingencyData.columns && contingencyData.rows && contingencyData.data) {
            // Nueva estructura
            const columns = contingencyData.columns;
            const rows = contingencyData.rows;
            const data = contingencyData.data;

            let tableHTML = '<div class="contingency-table"><table class="table table-sm table-bordered">';
            
            // Header
            tableHTML += '<thead><tr><th>Categoría</th>';
            columns.forEach(col => {
                tableHTML += `<th>${col}</th>`;
            });
            tableHTML += '</tr></thead>';

            // Body
            tableHTML += '<tbody>';
            rows.forEach((row, rowIndex) => {
                tableHTML += `<tr><td><strong>${row}</strong></td>`;
                columns.forEach((col, colIndex) => {
                    tableHTML += `<td>${data[rowIndex][colIndex] || 0}</td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table></div>';

            return tableHTML;
        } else {
            // Estructura antigua (mantener compatibilidad)
            const rows = Object.keys(contingencyData);
            const cols = Object.keys(contingencyData[rows[0]] || {});

            let tableHTML = '<div class="contingency-table"><table class="table table-sm table-bordered">';
            
            // Header
            tableHTML += '<thead><tr><th>Categoría</th>';
            cols.forEach(col => {
                tableHTML += `<th>${col ? 'Outlier' : 'Normal'}</th>`;
            });
            tableHTML += '</tr></thead>';

            // Body
            tableHTML += '<tbody>';
            rows.forEach(row => {
                tableHTML += `<tr><td><strong>${row}</strong></td>`;
                cols.forEach(col => {
                    tableHTML += `<td>${contingencyData[row][col] || 0}</td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table></div>';

            return tableHTML;
        }
    },

    displayVisualizations(visualizations) {
        const container = document.getElementById('visualizationsContainer');
        
        if (!visualizations || Object.keys(visualizations).length === 0) {
            container.innerHTML = '<p class="text-muted">No hay visualizaciones disponibles.</p>';
            return;
        }

        container.innerHTML = '';
        
        Object.entries(visualizations).forEach(([key, plotData]) => {
            const vizContainer = this.createVisualizationContainer(key, plotData);
            container.appendChild(vizContainer);
        });
    },

    createVisualizationContainer(key, plotData) {
        const container = document.createElement('div');
        container.className = 'visualization-container';
        
        // Extraer nombre de variable del key
        const variableName = key.replace(/^(boxplot_|violin_|bar_)/, '');
        const plotType = key.startsWith('boxplot_') ? 'Boxplot' : 
                        key.startsWith('violin_') ? 'Gráfico de Violín' : 
                        key.startsWith('bar_') ? 'Gráfico de Barras' : 'Gráfico';

        container.innerHTML = `
            <div class="visualization-title">${plotType} - ${variableName}</div>
            <div id="plot_${key}"></div>
        `;

        // Renderizar gráfico
        setTimeout(() => {
            try {
                const plotElement = document.getElementById(`plot_${key}`);
                if (plotElement) {
                    const plot = JSON.parse(plotData);
                    Plotly.newPlot(plotElement, plot.data, plot.layout, {responsive: true});
                }
            } catch (error) {
                container.innerHTML += '<div class="alert alert-warning">Error al renderizar el gráfico</div>';
            }
        }, 100);

        return container;
    },

    displayAdvancedAnalysisResults(results) {
        
        const container = document.getElementById('advancedAnalysisResults');
        if (!container) {
            return;
        }
        
        // Mostrar el contenedor
        container.style.display = 'block';
        
        // Guardar los resultados para uso posterior
        this.advancedResults = results;
        
        // Poblar selectores con variables disponibles
        this.populateAdvancedAnalysisSelectors(results);
        
        // Mostrar mensajes iniciales en lugar de resultados
        this.displayInitialRobustRegressionMessage();
        this.displayInitialPCAMessage();
        this.displayInitialLogisticRegressionMessage();
        this.displayInitialClusteringMessage();
        
        // Agregar event listeners para los selectores
        this.addAdvancedAnalysisEventListeners();
    },

    populateAdvancedAnalysisSelectors(results) {
        // Poblar selectores de regresión robusta
        const robustTarget = document.getElementById('robustRegressionTarget');
        const robustPredictors = document.getElementById('robustRegressionPredictors');
        
        if (results.robust_regression && results.robust_regression.available_variables) {
            const variables = results.robust_regression.available_variables;
            
            // Poblar selector de variable objetivo
            if (robustTarget) {
                robustTarget.innerHTML = '<option value="">-- Selecciona variable objetivo --</option>';
                    variables.forEach(var_name => {
                        const option = document.createElement('option');
                        option.value = var_name;
                        option.textContent = var_name;
                    robustTarget.appendChild(option);
                });
            }
            
            // Poblar selector múltiple de predictoras
            if (robustPredictors) {
                robustPredictors.innerHTML = '<option value="">-- Selecciona variables predictoras --</option>';
                variables.forEach(var_name => {
                    const option = document.createElement('option');
                    option.value = var_name;
                    option.textContent = var_name;
                    robustPredictors.appendChild(option);
                });
            }
        }
        
        // Poblar selector de PCA
        const pcaVariables = document.getElementById('pcaVariables');
        if (results.pca_analysis && results.pca_analysis.available_variables) {
            const variables = results.pca_analysis.available_variables;
            pcaVariables.innerHTML = '<option value="">-- Selecciona variables --</option>';
            variables.forEach(var_name => {
                const option = document.createElement('option');
                option.value = var_name;
                option.textContent = var_name;
                pcaVariables.appendChild(option);
            });
        }
        
        // Poblar selector de regresión logística
        const logisticPredictors = document.getElementById('logisticRegressionPredictors');
        if (results.logistic_regression && results.logistic_regression.available_variables) {
            const variables = results.logistic_regression.available_variables;
            logisticPredictors.innerHTML = '<option value="">-- Selecciona variables --</option>';
            variables.forEach(var_name => {
                const option = document.createElement('option');
                option.value = var_name;
                option.textContent = var_name;
                logisticPredictors.appendChild(option);
            });
        }
        
        // Poblar selector de clustering
        const clusteringVariables = document.getElementById('clusteringVariablesSelector');
        if (results.clustering_analysis && results.clustering_analysis.available_variables) {
            const variables = results.clustering_analysis.available_variables;
            clusteringVariables.innerHTML = '<option value="">-- Selecciona variables --</option>';
            variables.forEach(var_name => {
                const option = document.createElement('option');
                option.value = var_name;
                option.textContent = var_name;
                clusteringVariables.appendChild(option);
            });
        }
    },

    displayInitialRobustRegressionMessage() {
        const container = document.getElementById('robustRegressionResultsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Instrucciones:</strong> 
                <ul class="mb-0 mt-2">
                    <li>Selecciona una <strong>variable objetivo (Y)</strong>: cualquier gen/variable numérica de interés (ej: TNFALFA, IL6)</li>
                    <li>Selecciona <strong>al menos 2 variables predictoras (X)</strong>: otros genes que puedan explicar la variable objetivo</li>
                    <li>El análisis validará que los outliers detectados tienen relaciones atípicas con estas variables</li>
                    <li><strong>Nota:</strong> La variable <code>es_outlier</code> es categórica y no puede usarse como Y en regresión robusta</li>
                </ul>
            </div>
        `;
    },

    displayInitialPCAMessage() {
        const container = document.getElementById('pcaResultsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Instrucciones:</strong> Selecciona las variables numéricas que deseas incluir en el análisis de componentes principales.
            </div>
        `;
    },

    displayInitialLogisticRegressionMessage() {
        const container = document.getElementById('logisticRegressionResultsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Instrucciones:</strong> Selecciona las variables predictoras para el modelo de regresión logística que predice el estado de outlier.
            </div>
        `;
    },

    displayInitialClusteringMessage() {
        const container = document.getElementById('clusteringResultsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Instrucciones:</strong> Selecciona las variables numéricas que deseas incluir en el análisis de clustering para determinar el número óptimo de clústeres.
            </div>
        `;
    },

    addAdvancedAnalysisEventListeners() {
        // Event listeners para regresión robusta
        const robustTarget = document.getElementById('robustRegressionTarget');
        const robustPredictors = document.getElementById('robustRegressionPredictors');
        
        if (robustTarget && robustPredictors) {
            robustTarget.addEventListener('change', () => {
                    this.checkRobustRegressionSelections();
                });
            robustPredictors.addEventListener('change', () => {
                this.checkRobustRegressionSelections();
            });
        }
        
        // Event listener para PCA
        const pcaVariables = document.getElementById('pcaVariables');
        if (pcaVariables) {
            pcaVariables.addEventListener('change', () => {
                this.checkPCASelections();
            });
        }
        
        // Event listener para regresión logística
        const logisticPredictors = document.getElementById('logisticRegressionPredictors');
        if (logisticPredictors) {
            logisticPredictors.addEventListener('change', () => {
                this.checkLogisticRegressionSelections();
            });
        }
        
        // Event listener para clustering
        const calculateOptimalK = document.getElementById('calculateOptimalK');
        if (calculateOptimalK) {
            calculateOptimalK.addEventListener('click', () => {
                this.executeClusteringAnalysis();
            });
        }
    },

    checkRobustRegressionSelections() {
        const target = document.getElementById('robustRegressionTarget').value;
        const robustPredictors = document.getElementById('robustRegressionPredictors');
        const selectedPredictors = Array.from(robustPredictors.selectedOptions).map(opt => opt.value).filter(v => v);
        
        // Validar que la variable objetivo no esté en las predictoras
        const predictorsFiltered = selectedPredictors.filter(p => p !== target);
        
        if (target && predictorsFiltered.length >= 2) {
            // Ejecutar análisis de regresión robusta
            this.executeRobustRegression(target, predictorsFiltered);
        } else if (target || predictorsFiltered.length > 0) {
            // Mostrar mensaje de selección incompleta
            const container = document.getElementById('robustRegressionResultsContainer');
            if (container) {
                let message = '';
                if (!target) {
                    message = 'Debes seleccionar una variable objetivo (Y).';
                } else if (predictorsFiltered.length < 2) {
                    message = `Debes seleccionar al menos 2 variables predictoras diferentes a la variable objetivo. Actualmente seleccionadas: ${predictorsFiltered.length}`;
                } else if (selectedPredictors.includes(target)) {
                    message = 'La variable objetivo no puede estar en las variables predictoras.';
                }
                
                container.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Selección incompleta:</strong> ${message}
                    </div>
                `;
            }
        }
    },

    checkPCASelections() {
        const pcaVariables = document.getElementById('pcaVariables');
        const selectedOptions = Array.from(pcaVariables.selectedOptions).map(option => option.value);
        
        if (selectedOptions.length >= 2) {
            // Ejecutar análisis PCA
            this.executePCA(selectedOptions);
        } else if (selectedOptions.length > 0) {
            // Mostrar mensaje de selección insuficiente
            const container = document.getElementById('pcaResultsContainer');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Selección insuficiente:</strong> Debes seleccionar al menos 2 variables numéricas para el análisis PCA.
                    </div>
                `;
            }
        }
    },

    checkLogisticRegressionSelections() {
        const logisticPredictors = document.getElementById('logisticRegressionPredictors');
        const selectedOptions = Array.from(logisticPredictors.selectedOptions).map(option => option.value);
        
        if (selectedOptions.length >= 2) {
            // Ejecutar análisis de regresión logística
            this.executeLogisticRegression(selectedOptions);
        } else if (selectedOptions.length > 0) {
            // Mostrar mensaje de selección insuficiente
            const container = document.getElementById('logisticRegressionResultsContainer');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Selección insuficiente:</strong> Debes seleccionar al menos 2 variables predictoras para el modelo de regresión logística.
                    </div>
                `;
            }
        }
    },

    async executeRobustRegression(target, predictors) {
        try {
            const container = document.getElementById('robustRegressionResultsContainer');
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-spinner fa-spin me-2"></i>
                    Ejecutando análisis de regresión robusta...
                    <br><small>Analizando cómo ${predictors.length} variable(s) predictora(s) explican ${target}, validando outliers detectados...</small>
                </div>
            `;
            
            // Llamada al backend para ejecutar el análisis específico
            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/robust-regression`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    outlier_results: this.outlierResults,
                    target_var: target,
                    predictor_vars: predictors
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            
            if (results.error) {
                throw new Error(results.error);
            }
            
            this.displayRobustRegressionResults(results);
        } catch (error) {
            const container = document.getElementById('robustRegressionResultsContainer');
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> No se pudo ejecutar el análisis de regresión robusta: ${error.message}
                </div>
            `;
        }
    },

    async executePCA(variables) {
        try {
            const container = document.getElementById('pcaResultsContainer');
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-spinner fa-spin me-2"></i>
                    Ejecutando análisis de componentes principales...
                </div>
            `;
            
            // Llamada al backend para ejecutar el análisis específico
            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/pca-analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    outlier_results: this.outlierResults,
                    variables: variables
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            
            if (results.error) {
                throw new Error(results.error);
            }
            
            this.displayPCAResults(results);
        } catch (error) {
            const container = document.getElementById('pcaResultsContainer');
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> No se pudo ejecutar el análisis de componentes principales: ${error.message}
                </div>
            `;
        }
    },

    async executeLogisticRegression(predictors) {
        try {
            const container = document.getElementById('logisticRegressionResultsContainer');
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-spinner fa-spin me-2"></i>
                    Ejecutando análisis de regresión logística...
                </div>
            `;
            
            // Llamada al backend para ejecutar el análisis específico
            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/logistic-regression`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    outlier_results: this.outlierResults,
                    predictors: predictors,
                    test_size: 0.2
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            
            if (results.error) {
                throw new Error(results.error);
            }
            
            this.displayLogisticRegressionResults(results);
        } catch (error) {
            const container = document.getElementById('logisticRegressionResultsContainer');
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> No se pudo ejecutar el análisis de regresión logística: ${error.message}
                </div>
            `;
        }
    },

    async executeClusteringAnalysis() {
        try {
            const clusteringVariables = document.getElementById('clusteringVariablesSelector');
            const selectedOptions = Array.from(clusteringVariables.selectedOptions).map(option => option.value);
            
            if (selectedOptions.length < 2) {
                const container = document.getElementById('clusteringResultsContainer');
                container.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Selección insuficiente:</strong> Debes seleccionar al menos 2 variables numéricas para el análisis de clustering.
                    </div>
                `;
                return;
            }
            
            const container = document.getElementById('clusteringResultsContainer');
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-spinner fa-spin me-2"></i>
                    Calculando número óptimo de clústeres...
                </div>
            `;
            
            // Llamada al backend para ejecutar el análisis específico
            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/calculate-optimal-k`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    outlier_results: this.outlierResults,
                    variables: selectedOptions
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            
            if (results.error) {
                throw new Error(results.error);
            }
            
            this.displayClusteringResults(results);
        } catch (error) {
            const container = document.getElementById('clusteringResultsContainer');
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> No se pudo ejecutar el análisis de clustering: ${error.message}
                </div>
            `;
        }
    },

    generateDynamicRobustRegressionInterpretation(results) {
        /**
         * Genera interpretación dinámica basada en los resultados reales de la regresión robusta
         */
        const comp = results.comparison;
        const targetVar = results.target_variable;
        const predictors = results.predictor_variables;
        const robustCoefs = results.robust_regression.coefficients;
        const linearCoefs = results.linear_regression.coefficients;
        const robustnessWeights = results.robust_regression.robustness_weights;
        
        // Determinar si hay influencia significativa de outliers
        const hasSignificantInfluence = comp.significant_outlier_influence;
        
        // Comparar RSE
        const rseComp = comp.residual_standard_error;
        const rseImprovement = rseComp.improvement_percent;
        const robustBetterRSE = rseComp.robust_better;
        
        // Comparar R² si está disponible
        const r2Comp = comp.r_squared_comparison;
        const robustBetterR2 = r2Comp ? r2Comp.robust_better : null;
        const r2Diff = r2Comp ? r2Comp.difference : null;
        
        // Encontrar variables con diferencias significativas en coeficientes
        const significantCoefDiffs = [];
        for (let i = 0; i < comp.coefficient_differences.length; i++) {
            const diffPercent = comp.coefficient_differences_percent[i];
            const diffAbs = comp.coefficient_differences[i];
            if (diffPercent > 10 || diffAbs > 0.1) {
                significantCoefDiffs.push({
                    variable: predictors[i],
                    diffPercent: diffPercent,
                    diffAbs: diffAbs,
                    linearCoef: linearCoefs[i + 1].estimate, // +1 porque el índice 0 es el intercepto
                    robustCoef: robustCoefs[i + 1].estimate,
                    linearPValue: linearCoefs[i + 1].p_value,
                    robustPValue: robustCoefs[i + 1].p_value
                });
            }
        }
        
        // Encontrar variables significativas en el modelo robusto
        const significantRobustVars = robustCoefs
            .filter(coef => coef.variable !== 'Intercept' && coef.p_value < 0.05)
            .map(coef => ({
                variable: coef.variable,
                coefficient: coef.estimate,
                pValue: coef.p_value,
                significance: coef.significance
            }));
        
        // Información sobre outliers detectados por el modelo robusto
        const outlierCount = robustnessWeights ? robustnessWeights.outlier_observations : 0;
        const outlierPercent = results.sample_size > 0 ? (outlierCount / results.sample_size * 100).toFixed(1) : 0;
        
        // Generar interpretación de eficiencia del modelo
        let efficiencySection = '';
        if (hasSignificantInfluence) {
            efficiencySection = `
                <div class="col-md-6">
                    <h6 class="text-info mb-3">
                        <i class="fas fa-chart-line me-2"></i>
                        Eficiencia del Modelo Robusto
                    </h6>
                    <p class="mb-3">
                        <strong class="text-warning">Los outliers tienen influencia significativa en el modelo estándar.</strong> 
                        El modelo de regresión robusta (IRLS) demuestra mayor eficiencia al minimizar esta influencia:
                    </p>
                    <ul class="list-unstyled">
                        ${robustBetterRSE ? `
                        <li><i class="fas fa-check-circle text-success me-2"></i>
                            <strong>Error residual estándar mejorado:</strong> El modelo robusto reduce el error en 
                            ${Math.abs(rseImprovement).toFixed(1)}% comparado con el modelo estándar 
                            (${rseComp.linear.toFixed(4)} vs ${rseComp.robust.toFixed(4)})
                        </li>
                        ` : `
                        <li><i class="fas fa-info-circle text-info me-2"></i>
                            El error residual estándar es similar entre ambos modelos 
                            (${rseComp.linear.toFixed(4)} vs ${rseComp.robust.toFixed(4)})
                        </li>
                        `}
                        ${r2Comp && robustBetterR2 ? `
                        <li><i class="fas fa-check-circle text-success me-2"></i>
                            <strong>Mejor ajuste:</strong> El modelo robusto explica ${(r2Comp.difference * 100).toFixed(1)}% más 
                            de la varianza (R²: ${r2Comp.linear_r_squared.toFixed(4)} vs ${r2Comp.robust_r_squared.toFixed(4)})
                        </li>
                        ` : r2Comp && !robustBetterR2 ? `
                        <li><i class="fas fa-info-circle text-info me-2"></i>
                            El ajuste del modelo (R²) es similar entre ambos modelos 
                            (${r2Comp.linear_r_squared.toFixed(4)} vs ${r2Comp.robust_r_squared.toFixed(4)})
                        </li>
                        ` : ''}
                        ${significantCoefDiffs.length > 0 ? `
                        <li><i class="fas fa-exclamation-triangle text-warning me-2"></i>
                            <strong>Coeficientes con cambios sustanciales:</strong> ${significantCoefDiffs.length} variable(s) muestran 
                            diferencias importantes en magnitud (>10% o >0.1 en valor absoluto) entre los coeficientes de ambos modelos.
                            <small class="text-muted d-block mt-1">
                                <em>Nota: Esto se refiere a cambios cuantitativos en los coeficientes, no a significancia estadística (p-valor).</em>
                            </small>
                        </li>
                        ` : ''}
                    </ul>
                </div>
            `;
        } else {
            efficiencySection = `
                <div class="col-md-6">
                    <h6 class="text-info mb-3">
                        <i class="fas fa-chart-line me-2"></i>
                        Eficiencia del Modelo Robusto
                    </h6>
                    <p class="mb-3">
                        <strong class="text-success">Los outliers no tienen influencia significativa en el modelo estándar.</strong> 
                        Ambos modelos proporcionan estimaciones similares, lo que indica:
                    </p>
                    <ul class="list-unstyled">
                        <li><i class="fas fa-check-circle text-success me-2"></i>
                            Los datos son relativamente homogéneos y los outliers no distorsionan las relaciones principales
                        </li>
                        <li><i class="fas fa-check-circle text-success me-2"></i>
                            El modelo estándar es apropiado, pero el robusto ofrece mayor generalización
                        </li>
                        <li><i class="fas fa-info-circle text-info me-2"></i>
                            Las diferencias en coeficientes son menores al 10% para todas las variables
                        </li>
                    </ul>
                </div>
            `;
        }
        
        // Generar interpretación clínica
        let clinicalSection = '';
        if (hasSignificantInfluence && significantCoefDiffs.length > 0) {
            clinicalSection = `
                <div class="col-md-6">
                    <h6 class="text-info mb-3">
                        <i class="fas fa-microscope me-2"></i>
                        Significado Clínico de los Outliers
                    </h6>
                    <p class="mb-3">
                        <strong>Los outliers identificados tienen impacto clínico significativo:</strong>
                    </p>
                    <ul class="list-unstyled">
                        <li><i class="fas fa-exclamation-triangle text-warning me-2"></i>
                            <strong>Variables con cambios sustanciales en coeficientes:</strong> Las siguientes variables muestran 
                            diferencias importantes en magnitud entre modelos debido a la presencia de outliers:
                            <ul class="mt-2">
                                ${significantCoefDiffs.slice(0, 3).map(diff => {
                                    const linearSig = diff.linearPValue < 0.05;
                                    const robustSig = diff.robustPValue < 0.05;
                                    const sigStatus = linearSig && robustSig ? 'Ambos modelos: significativo (p < 0.05)' :
                                                     linearSig ? 'Solo modelo estándar: significativo (p < 0.05)' :
                                                     robustSig ? 'Solo modelo robusto: significativo (p < 0.05)' :
                                                     'Ningún modelo: no significativo (p ≥ 0.05)';
                                    const sigBadge = linearSig || robustSig ? 
                                        '<span class="badge bg-success ms-2">Significativo</span>' : 
                                        '<span class="badge bg-secondary ms-2">No significativo</span>';
                                    return `
                                    <li class="small mb-2">
                                        <strong>${diff.variable}:</strong> 
                                        Coeficiente cambia de ${diff.linearCoef.toFixed(4)} (modelo estándar) 
                                        a ${diff.robustCoef.toFixed(4)} (modelo robusto) 
                                        (diferencia: ${diff.diffPercent.toFixed(1)}%)
                                        ${sigBadge}
                                        <br>
                                        <small class="text-muted ms-3">
                                            <em>${sigStatus}</em>
                                        </small>
                                    </li>
                                `;
                                }).join('')}
                            </ul>
                            <small class="text-muted d-block mt-2">
                                <em><strong>Nota:</strong> "Cambios sustanciales" se refiere a diferencias cuantitativas en los coeficientes 
                                (>10% o >0.1), independientemente de su significancia estadística (p-valor).</em>
                            </small>
                        </li>
                        ${outlierCount > 0 ? `
                        <li><i class="fas fa-users text-danger me-2"></i>
                            <strong>Pacientes con valores extremos:</strong> ${outlierCount} de ${results.sample_size} 
                            pacientes (${outlierPercent}%) muestran patrones atípicos que requieren atención especializada
                        </li>
                        ` : ''}
                        <li><i class="fas fa-flask text-primary me-2"></i>
                            <strong>Implicación clínica:</strong> Los valores extremos en ${targetVar} pueden representar 
                            fenotipos raros o condiciones médicas extremas que requieren evaluación individualizada
                        </li>
                    </ul>
                </div>
            `;
        } else {
            clinicalSection = `
                <div class="col-md-6">
                    <h6 class="text-info mb-3">
                        <i class="fas fa-microscope me-2"></i>
                        Significado Clínico de los Outliers
                    </h6>
                    <p class="mb-3">
                        Aunque los outliers no distorsionan significativamente las relaciones estadísticas principales, 
                        pueden tener significado clínico:
                    </p>
                    <ul class="list-unstyled">
                        <li><i class="fas fa-info-circle text-info me-2"></i>
                            Los valores extremos pueden representar variabilidad natural o casos límite dentro del rango esperado
                        </li>
                        ${outlierCount > 0 ? `
                        <li><i class="fas fa-users text-warning me-2"></i>
                            ${outlierCount} de ${results.sample_size} pacientes (${outlierPercent}%) muestran valores atípicos 
                            que merecen revisión clínica individualizada
                        </li>
                        ` : ''}
                        <li><i class="fas fa-stethoscope text-primary me-2"></i>
                            Se recomienda evaluación caso por caso para determinar si representan condiciones médicas específicas
                        </li>
                    </ul>
                </div>
            `;
        }
        
        // Generar sección de variables significativas
        let significantVarsSection = '';
        if (significantRobustVars.length > 0) {
            significantVarsSection = `
                <div class="alert alert-success border-success mt-3">
                    <h6 class="alert-heading">
                        <i class="fas fa-star me-2"></i>
                        Variables Predictoras Significativas en el Modelo Robusto
                    </h6>
                    <p class="mb-2">
                        Las siguientes variables muestran asociaciones estadísticamente significativas (p < 0.05) 
                        con ${targetVar}:
                    </p>
                    <ul class="mb-0">
                        ${significantRobustVars.map(v => `
                            <li>
                                <strong>${v.variable}:</strong> 
                                Coeficiente = ${v.coefficient.toFixed(4)} 
                                (${v.coefficient > 0 ? 'aumenta' : 'disminuye'} ${targetVar}), 
                                p = ${v.pValue < 0.000001 ? v.pValue.toExponential(2) : v.pValue.toFixed(4)} 
                                <span class="badge bg-${v.pValue < 0.001 ? 'danger' : v.pValue < 0.01 ? 'warning' : 'info'}">${v.significance}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Generar recomendación final
        let recommendationSection = '';
        if (hasSignificantInfluence) {
            recommendationSection = `
                <div class="alert alert-warning border-warning mt-3">
                    <h6 class="alert-heading">
                        <i class="fas fa-lightbulb me-2"></i>
                        Recomendación para la Investigación
                    </h6>
                    <p class="mb-2">
                        <strong>Se recomienda usar el modelo robusto</strong> debido a la influencia significativa de outliers. 
                        Este modelo proporciona estimaciones más confiables y generalizables para:
                    </p>
                    <ul class="mb-0">
                        <li>Identificar relaciones genuinas entre ${predictors.join(', ')} y ${targetVar}</li>
                        <li>Predecir valores de ${targetVar} en presencia de valores extremos</li>
                        <li>Comprender qué variables son más importantes para explicar variaciones en ${targetVar}</li>
                    </ul>
                </div>
            `;
        } else {
            recommendationSection = `
                <div class="alert alert-info border-info mt-3">
                    <h6 class="alert-heading">
                        <i class="fas fa-lightbulb me-2"></i>
                        Recomendación para la Investigación
                    </h6>
                    <p class="mb-2">
                        <strong>Ambos modelos son apropiados</strong>, pero el modelo robusto ofrece mayor generalización 
                        y protección contra valores extremos futuros. Los resultados sugieren que:
                    </p>
                    <ul class="mb-0">
                        <li>Las relaciones entre ${predictors.join(', ')} y ${targetVar} son estables y consistentes</li>
                        <li>Los outliers presentes no distorsionan significativamente las relaciones principales</li>
                        <li>El modelo robusto puede ser preferible para generalización a nuevas poblaciones</li>
                    </ul>
                </div>
            `;
        }
        
        return `
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card border-info">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0">
                                <i class="fas fa-lightbulb me-2"></i>
                                Interpretación de Resultados
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                ${efficiencySection}
                                ${clinicalSection}
                            </div>
                            ${significantVarsSection}
                            ${recommendationSection}
                            <div class="alert alert-light border mt-3">
                                <h6 class="text-muted mb-2">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Nota Metodológica
                                </h6>
                                <p class="mb-0 small">
                                    <strong>Análisis vs Eliminación:</strong> A diferencia de simplemente eliminar outliers, 
                                    este análisis permite comprender su naturaleza y significado. Los valores extremos pueden 
                                    representar casos clínicamente relevantes que requieren atención especial, patrones de 
                                    respuesta únicos, o indicadores de condiciones médicas específicas que podrían ser valiosos 
                                    para el diagnóstico y tratamiento.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    displayRobustRegressionResults(results) {
        const container = document.getElementById('robustRegressionResultsContainer');
        if (!container) return;
        
        // Manejar casos de datos insuficientes o errores
        if (results.error) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> ${results.error}
                </div>
            `;
            return;
        }
        
        // Manejar caso de datos insuficientes
        if (results.status === 'insufficient_data' || results.message) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Información:</strong> ${results.message}
                    ${results.available_data_points ? `<br><small>Datos disponibles: ${results.available_data_points} observaciones</small>` : ''}
                    ${results.minimum_required ? `<br><small>Mínimo requerido: ${results.minimum_required} observaciones</small>` : ''}
                </div>
            `;
            return;
        }
        
        // Crear tabla de coeficientes para regresión lineal estándar
        let lrCoefficientsTable = '';
        results.linear_regression.coefficients.forEach(coef => {
            lrCoefficientsTable += `
                <tr>
                    <td>${coef.variable}</td>
                    <td>${coef.estimate.toFixed(4)}</td>
                    <td>${coef.std_error.toFixed(4)}</td>
                    <td>${coef.t_value.toFixed(4)}</td>
                    <td>${coef.p_value < 0.000001 ? coef.p_value.toExponential(2) : coef.p_value.toFixed(6)}</td>
                    <td>${coef.significance}</td>
                </tr>
            `;
        });
        
        // Crear tabla de coeficientes para regresión robusta
        let robustCoefficientsTable = '';
        results.robust_regression.coefficients.forEach(coef => {
            robustCoefficientsTable += `
                <tr>
                    <td>${coef.variable}</td>
                    <td>${coef.estimate.toFixed(4)}</td>
                    <td>${coef.std_error.toFixed(4)}</td>
                    <td>${coef.t_value.toFixed(4)}</td>
                    <td>${coef.p_value < 0.000001 ? coef.p_value.toExponential(2) : coef.p_value.toFixed(6)}</td>
                    <td>${coef.significance}</td>
                </tr>
            `;
        });
        
        // Crear tabla de residuales para regresión lineal estándar
        let lrResidualsTable = '';
        const lrResiduals = results.linear_regression.residuals;
        lrResidualsTable = `
            <tr><td>Min</td><td>${lrResiduals.min.toFixed(4)}</td></tr>
            <tr><td>1Q</td><td>${lrResiduals.q1.toFixed(4)}</td></tr>
            <tr><td>Median</td><td>${lrResiduals.median.toFixed(4)}</td></tr>
            <tr><td>3Q</td><td>${lrResiduals.q3.toFixed(4)}</td></tr>
            <tr><td>Max</td><td>${lrResiduals.max.toFixed(4)}</td></tr>
        `;
        
        // Crear tabla de estadísticas del modelo para regresión lineal estándar
        let lrModelStatsTable = '';
        const lrStats = results.linear_regression;
        lrModelStatsTable = `
            <tr><td>Residual standard error</td><td>${lrStats.residual_standard_error.toFixed(4)}</td></tr>
            <tr><td>Multiple R-squared</td><td>${lrStats.r_squared.toFixed(4)}</td></tr>
            <tr><td>Adjusted R-squared</td><td>${lrStats.adjusted_r_squared.toFixed(4)}</td></tr>
            <tr><td>F-statistic</td><td>${lrStats.f_statistic.toFixed(4)}</td></tr>
            <tr><td>F p-value</td><td>${lrStats.f_p_value < 0.000001 ? lrStats.f_p_value.toExponential(2) : lrStats.f_p_value.toFixed(6)}</td></tr>
            <tr><td>Degrees of freedom</td><td>${lrStats.degrees_of_freedom}</td></tr>
        `;
        
        // Crear tabla de residuales para regresión robusta
        let robustResidualsTable = '';
        const robustResiduals = results.robust_regression.residuals;
        robustResidualsTable = `
            <tr><td>Min</td><td>${robustResiduals.min.toFixed(4)}</td></tr>
            <tr><td>1Q</td><td>${robustResiduals.q1.toFixed(4)}</td></tr>
            <tr><td>Median</td><td>${robustResiduals.median.toFixed(4)}</td></tr>
            <tr><td>3Q</td><td>${robustResiduals.q3.toFixed(4)}</td></tr>
            <tr><td>Max</td><td>${robustResiduals.max.toFixed(4)}</td></tr>
        `;
        
        // Crear tabla de estadísticas del modelo robusto
        let robustModelStatsTable = '';
        const robustStats = results.robust_regression;
        robustModelStatsTable = `
            <tr><td>Robust residual standard error</td><td>${robustStats.robust_residual_standard_error.toFixed(4)}</td></tr>
            <tr><td>Multiple R-squared</td><td>${robustStats.r_squared ? robustStats.r_squared.toFixed(4) : 'N/A'}</td></tr>
            <tr><td>Adjusted R-squared</td><td>${robustStats.adjusted_r_squared ? robustStats.adjusted_r_squared.toFixed(4) : 'N/A'}</td></tr>
        `;
        
        // Crear tabla de información de convergencia
        let convergenceTable = '';
        const convergence = results.robust_regression.convergence;
        convergenceTable = `
            <tr><td>Converged</td><td>${convergence.converged ? 'Sí' : 'No'}</td></tr>
            <tr><td>Iterations</td><td>${convergence.iterations || 'N/A'}</td></tr>
            <tr><td>Method</td><td>${convergence.method}</td></tr>
        `;
        
        // Crear tabla de pesos de robustez si está disponible
        let robustnessWeightsTable = '';
        if (results.robust_regression.robustness_weights) {
            const weights = results.robust_regression.robustness_weights;
            robustnessWeightsTable = `
                <tr><td>Mínimo</td><td>${weights.min.toFixed(4)}</td></tr>
                <tr><td>1er Cuartil</td><td>${weights.q1.toFixed(4)}</td></tr>
                <tr><td>Mediana</td><td>${weights.median.toFixed(4)}</td></tr>
                <tr><td>Media</td><td>${weights.mean.toFixed(4)}</td></tr>
                <tr><td>3er Cuartil</td><td>${weights.q3.toFixed(4)}</td></tr>
                <tr><td>Máximo</td><td>${weights.max.toFixed(4)}</td></tr>
                <tr><td>Observaciones outlier</td><td>${weights.outlier_observations}</td></tr>
            `;
        }
        
        // Crear tabla de parámetros algorítmicos
        let algorithmicParamsTable = '';
        if (results.robust_regression.algorithmic_parameters) {
            const params = results.robust_regression.algorithmic_parameters;
            algorithmicParamsTable = `
                <tr><td>tuning.chi</td><td>${params.tuning_chi.toExponential(3)}</td></tr>
                <tr><td>bb</td><td>${params.bb}</td></tr>
                <tr><td>tuning.psi</td><td>${params.tuning_psi.toExponential(3)}</td></tr>
                <tr><td>refine.tol</td><td>${params.refine_tol.toExponential(3)}</td></tr>
                <tr><td>rel.tol</td><td>${params.rel_tol.toExponential(3)}</td></tr>
                <tr><td>scale.tol</td><td>${params.scale_tol.toExponential(3)}</td></tr>
                <tr><td>solve.tol</td><td>${params.solve_tol.toExponential(3)}</td></tr>
                <tr><td>eps.outlier</td><td>${params.eps_outlier.toExponential(3)}</td></tr>
                <tr><td>eps.x</td><td>${params.eps_x.toExponential(3)}</td></tr>
                <tr><td>warn.limit.reject</td><td>${params.warn_limit_reject}</td></tr>
                <tr><td>warn.limit.meanrw</td><td>${params.warn_limit_meanrw}</td></tr>
            `;
        }
        
        // Generar interpretación dinámica
        const dynamicInterpretation = this.generateDynamicRobustRegressionInterpretation(results);
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header bg-success text-white">
                    <h6 class="mb-0">
                        <i class="fas fa-chart-line me-2"></i>
                        Resultados de Regresión Robusta
                    </h6>
                </div>
                <div class="card-body">
                    <!-- Información del Modelo -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-success mb-3">Información del Modelo</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-bordered">
                                    <thead class="table-success">
                                        <tr>
                                            <th>Parámetro</th>
                                            <th>Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>Variable objetivo</td><td>${results.target_variable}</td></tr>
                                        <tr><td>Variables predictoras</td><td>${results.predictor_variables.join(', ')}</td></tr>
                                        <tr><td>Tamaño de muestra</td><td>${results.sample_size}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Regresión Lineal Estándar -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-success mb-3">Regresión Lineal Estándar</h6>
                            
                            <!-- Residuales -->
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Residuales:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-success">
                                            <tr>
                                                <th>Estadístico</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${lrResidualsTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- Coeficientes -->
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Coeficientes:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-success">
                                            <tr>
                                                <th>Variable</th>
                                                <th>Estimate</th>
                                                <th>Std. Error</th>
                                                <th>t value</th>
                                                <th>Pr(>|t|)</th>
                                                <th>Signif.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${lrCoefficientsTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- Estadísticas del modelo -->
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Estadísticas del Modelo:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-success">
                                            <tr>
                                                <th>Estadístico</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${lrModelStatsTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Regresión Robusta -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-primary mb-3">Regresión Robusta (IRLS)</h6>
                            
                            <!-- Residuales -->
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Residuales:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-primary">
                                            <tr>
                                                <th>Estadístico</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${robustResidualsTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- Coeficientes -->
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Coeficientes:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-primary">
                                            <tr>
                                                <th>Variable</th>
                                                <th>Estimate</th>
                                                <th>Std. Error</th>
                                                <th>t value</th>
                                                <th>Pr(>|t|)</th>
                                                <th>Signif.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${robustCoefficientsTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- Estadísticas del modelo robusto -->
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Estadísticas del Modelo Robusto:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-primary">
                                            <tr>
                                                <th>Estadístico</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${robustModelStatsTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- Información de convergencia -->
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Información de Convergencia:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-primary">
                                            <tr>
                                                <th>Parámetro</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${convergenceTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- Pesos de robustez -->
                            ${results.robust_regression.robustness_weights ? `
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Robustness weights:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-info">
                                            <tr>
                                                <th>Estadístico</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${robustnessWeightsTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- Parámetros algorítmicos -->
                            ${results.robust_regression.algorithmic_parameters ? `
                            <div class="mb-3">
                                <h6 class="text-muted mb-2">Algorithmic parameters:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-bordered">
                                        <thead class="table-info">
                                            <tr>
                                                <th>Parámetro</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${algorithmicParamsTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Comparación -->
                    <div class="row mb-3">
                        <div class="col-12">
                            <h6 class="text-info mb-2">Comparación de Coeficientes</h6>
                            <div class="alert ${results.comparison.significant_outlier_influence ? 'alert-warning' : 'alert-success'}">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Interpretación:</strong> ${results.comparison.interpretation}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Selector de variable predictora para gráfico -->
                    <div class="row mb-3">
                        <div class="col-md-4">
                            <label for="plotPredictorSelector" class="form-label">
                                <i class="fas fa-chart-line me-2"></i>
                                Variable Predictora para Gráfico:
                            </label>
                            <select class="form-select" id="plotPredictorSelector">
                                ${results.predictor_variables.map((varName, index) => 
                                    `<option value="${index}">${varName}</option>`
                                ).join('')}
                            </select>
                            <div class="form-text">
                                <small class="text-muted">Selecciona qué variable predictora mostrar en el eje X del gráfico</small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Gráfico -->
                    <div class="row">
                        <div class="col-12">
                            <div id="robustRegressionPlot"></div>
                        </div>
                    </div>
                    
                    <!-- Panel de Interpretación Dinámica -->
                    ${dynamicInterpretation}
                </div>
            </div>
        `;
        
        // Crear gráfico de comparación
        this.createRobustRegressionPlot(results.plot_data, results.predictor_variables);
        
        // Agregar event listener para el selector de variable predictora
        const selector = document.getElementById('plotPredictorSelector');
        if (selector) {
            selector.addEventListener('change', () => {
                this.createRobustRegressionPlot(results.plot_data, results.predictor_variables);
            });
        }
    },

    displayPCAResults(results) {
        const container = document.getElementById('pcaResultsContainer');
        if (!container) return;
        
        if (results.error) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> ${results.error}
                </div>
            `;
            return;
        }
        
        // Banner de recomendación
        const recommendation = results.recommendation;
        const recommendationBanner = `
            <div class="alert alert-success border-success">
                <div class="d-flex align-items-center">
                    <i class="fas fa-lightbulb fa-2x text-success me-3"></i>
                    <div>
                        <h6 class="alert-heading mb-1">
                            <strong>Recomendación Automática de Componentes</strong>
                        </h6>
                        <p class="mb-0">${recommendation.reasoning}</p>
                    </div>
                </div>
            </div>
        `;
        
        // Tabla detallada de componentes
        let componentDetailsTable = '';
        results.component_details.forEach(comp => {
            const kaiserIcon = comp.kaiser_criterion ? 
                '<i class="fas fa-check-circle text-success" title="Cumple criterio de Kaiser"></i>' : 
                '<i class="fas fa-times-circle text-danger" title="No cumple criterio de Kaiser"></i>';
            const recommendedIcon = comp.recommended ? 
                '<i class="fas fa-star text-warning" title="Componente recomendado"></i>' : '';
            
            componentDetailsTable += `
                <tr class="${comp.recommended ? 'table-success' : ''}">
                    <td>${comp.component} ${recommendedIcon}</td>
                    <td>${comp.eigenvalue.toFixed(4)}</td>
                    <td>${comp.variance_explained.toFixed(2)}%</td>
                    <td>${comp.cumulative_variance.toFixed(2)}%</td>
                    <td class="text-center">${kaiserIcon}</td>
                </tr>
            `;
        });
        
        // Tabla de loadings
        let loadingsTable = '';
        const sortedLoadings = results.loadings_table.sort((a, b) => b.abs_loading - a.abs_loading);
        const topLoadings = sortedLoadings.slice(0, 15); // Mostrar los 15 loadings más importantes
        
        topLoadings.forEach(loading => {
            const loadingClass = Math.abs(loading.loading) > 0.5 ? 'table-warning' : '';
            loadingsTable += `
                <tr class="${loadingClass}">
                    <td>${loading.component}</td>
                    <td>${loading.variable}</td>
                    <td>${loading.loading.toFixed(4)}</td>
                    <td>${loading.abs_loading.toFixed(4)}</td>
                </tr>
            `;
        });
        
        container.innerHTML = `
            ${recommendationBanner}
            
            <div class="card mb-4">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0">
                        <i class="fas fa-cube me-2"></i>
                        Información General del PCA
                    </h6>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6 class="text-primary">Configuración del Análisis</h6>
                            <p><strong>Variables utilizadas:</strong> ${results.variables_used.join(', ')}</p>
                            <p><strong>Tamaño de muestra:</strong> ${results.sample_size}</p>
                            <p><strong>Componentes recomendados:</strong> ${results.n_components}</p>
                        </div>
                        <div class="col-md-6">
                            <h6 class="text-primary">Criterios de Selección</h6>
                            <p><strong>Criterio de Kaiser (λ > 1):</strong> ${recommendation.kaiser_components} componentes</p>
                            <p><strong>Varianza 80%:</strong> ${recommendation.variance_80_components} componentes</p>
                            <p><strong>Varianza 90%:</strong> ${recommendation.variance_90_components} componentes</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card mb-4">
                <div class="card-header bg-info text-white">
                    <h6 class="mb-0">
                        <i class="fas fa-table me-2"></i>
                        Tabla Detallada de Componentes Principales
                    </h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead class="table-dark">
                                <tr>
                                    <th>Componente</th>
                                    <th>Eigenvalue (λ)</th>
                                    <th>Varianza Explicada (%)</th>
                                    <th>Varianza Acumulada (%)</th>
                                    <th>Criterio de Kaiser</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${componentDetailsTable}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-2">
                        <small class="text-muted">
                            <i class="fas fa-info-circle me-1"></i>
                            Los componentes destacados en verde son los recomendados para el análisis.
                        </small>
                    </div>
                </div>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-warning text-dark">
                            <h6 class="mb-0">
                                <i class="fas fa-chart-line me-2"></i>
                                Gráfico del Codo (Scree Plot)
                            </h6>
                        </div>
                        <div class="card-body">
                            <div id="screePlot"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0">
                                <i class="fas fa-chart-scatter me-2"></i>
                                Visualización PCA (PC1 vs PC2)
                            </h6>
                        </div>
                        <div class="card-body">
                            <div id="pcaPlot"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card mb-4">
                <div class="card-header bg-secondary text-white">
                    <h6 class="mb-0">
                        <i class="fas fa-list me-2"></i>
                        Loadings de Variables (Top 15)
                    </h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead class="table-dark">
                                <tr>
                                    <th>Componente</th>
                                    <th>Variable</th>
                                    <th>Loading</th>
                                    <th>|Loading|</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${loadingsTable}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-2">
                        <small class="text-muted">
                            <i class="fas fa-info-circle me-1"></i>
                            Los loadings destacados en amarillo tienen un valor absoluto > 0.5, indicando una contribución importante al componente.
                        </small>
                    </div>
                </div>
            </div>
            
            <div class="card mb-4">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0">
                        <i class="fas fa-chart-scatter me-2"></i>
                        Biplot: PC1 vs PC2 con Variables Originales
                    </h6>
                </div>
                <div class="card-body">
                    <div id="biplot"></div>
                    <div class="mt-2">
                        <small class="text-muted">
                            <i class="fas fa-info-circle me-1"></i>
                            El biplot muestra los puntos de datos (azul: normales, rojo: outliers) y las flechas de las variables originales proyectadas en el espacio de los componentes principales.
                        </small>
                    </div>
                </div>
            </div>
        `;
        
        // Crear gráficos
        this.createScreePlot(results.scree_plot_data);
        this.createPCAPlot(results.plot_data, results.loadings, results.loadings_labels, results.pca_info);
        this.createBiplot(results);
    },

    displayLogisticRegressionResults(results) {
        const container = document.getElementById('logisticRegressionResultsContainer');
        if (!container) return;
        
        // Verificar si hay datos insuficientes
        if (results.status === 'insufficient_data' || results.message) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Información:</strong> ${results.message}
                    <br><br>
                    <strong>Detalles:</strong>
                    <ul class="mb-0">
                        <li>Datos disponibles: ${results.available_data_points} observaciones</li>
                        <li>Mínimo requerido: ${results.minimum_required} observaciones</li>
                    </ul>
                </div>
            `;
            return;
        }
        
        if (results.error) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> ${results.error}
                </div>
            `;
            return;
        }
        
        // Crear tabla de coeficientes
        let coefficientsTable = '';
        let hasExtremeCoefficients = false;
        results.coefficients_table.forEach(coef => {
            let pValueFormatted = 'N/A';
            if (coef.p_value !== null && coef.p_value !== undefined) {
                pValueFormatted = coef.p_value < 0.0001 ? coef.p_value.toExponential(3) : coef.p_value.toFixed(4);
            }
            
            // Detectar coeficientes extremos
            const isExtreme = coef.is_extreme || Math.abs(coef.coefficient) > 20 || 
                             (coef.odds_ratio > 1e10 || (coef.odds_ratio < 1e-10 && coef.odds_ratio > 0));
            if (isExtreme) hasExtremeCoefficients = true;
            
            let oddsRatioFormatted = '';
            if (isExtreme) {
                if (coef.coefficient > 0) {
                    oddsRatioFormatted = '<span class="badge bg-danger">Extremo (>1e10)</span>';
                } else {
                    oddsRatioFormatted = '<span class="badge bg-warning">Extremo (<1e-10)</span>';
                }
            } else {
                oddsRatioFormatted = coef.odds_ratio.toFixed(4);
            }
            
            coefficientsTable += `
                <tr class="${isExtreme ? 'table-warning' : ''}">
                    <td><strong>${coef.variable}</strong></td>
                    <td>
                        ${coef.coefficient.toFixed(4)} ${coef.significance}
                        ${isExtreme ? '<br><small class="text-danger">⚠ Coeficiente extremo</small>' : ''}
                    </td>
                    <td>${pValueFormatted}</td>
                    <td>${oddsRatioFormatted}</td>
                    <td>
                        <small>${coef.interpretation}</small>
                        ${isExtreme ? '<br><small class="text-muted"><em>Indica separación perfecta o problemas numéricos</em></small>' : ''}
                    </td>
                </tr>
            `;
        });
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header bg-warning text-dark">
                    <h6 class="mb-0">
                        <i class="fas fa-chart-area me-2"></i>
                        Resultados de Regresión Logística para el Perfil de Outliers
                    </h6>
                </div>
                <div class="card-body">
                    <!-- Propósito del Análisis -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="alert alert-info border-info">
                                <h6 class="alert-heading">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Propósito del Análisis: Caracterización de Outliers
                                </h6>
                                <p class="mb-2">
                                    <strong>Este análisis NO predice outliers nuevos.</strong> Su objetivo es <strong>caracterizar el perfil de outliers</strong> 
                                    identificando qué variables son más importantes para distinguirlos de los datos normales.
                                </p>
                                <p class="mb-0 small">
                                    <strong>Interpretación:</strong> Los coeficientes indican qué variables contribuyen más al perfil "outlier". 
                                    Variables con coeficientes positivos y odds ratios altos son características distintivas de los outliers identificados.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Selección Automática de Características -->
                    ${results.feature_selection ? `
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="alert alert-success border-success">
                                <h6 class="alert-heading">
                                    <i class="fas fa-check-circle me-2"></i>
                                    Selección Automática de Características Aplicada
                                </h6>
                                <p class="mb-2">
                                    Se seleccionaron automáticamente las <strong>${results.feature_selection.selected_count} variables más importantes</strong> 
                                    de ${results.feature_selection.original_count} variables disponibles para evitar sobreajuste.
                                </p>
                                <p class="mb-1"><strong>Variables seleccionadas:</strong> ${results.feature_selection.selected_variables.join(', ')}</p>
                                ${results.feature_selection.excluded_variables && results.feature_selection.excluded_variables.length > 0 ? `
                                <p class="mb-0 small text-muted">
                                    <strong>Variables excluidas:</strong> ${results.feature_selection.excluded_variables.join(', ')}
                                </p>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Importancia de Variables -->
                    ${results.feature_importance && results.feature_importance.length > 0 ? `
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card border-primary">
                                <div class="card-header bg-primary text-white">
                                    <h6 class="mb-0">
                                        <i class="fas fa-star me-2"></i>
                                        Importancia de Variables (Análisis Previo)
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <p class="text-muted small mb-3">
                                        Las siguientes variables fueron evaluadas por su capacidad para distinguir outliers de normales 
                                        usando F-test (ANOVA) y Mutual Information. Las variables están ordenadas por importancia combinada.
                                    </p>
                                    <div class="table-responsive">
                                        <table class="table table-sm table-bordered table-hover">
                                            <thead class="table-primary">
                                                <tr>
                                                    <th>Rank</th>
                                                    <th>Variable</th>
                                                    <th>F-Score</th>
                                                    <th>F p-valor</th>
                                                    <th>Mutual Info</th>
                                                    <th>Importancia</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${results.feature_importance.slice(0, 15).map(f => `
                                                    <tr>
                                                        <td><span class="badge bg-${f.importance_rank <= 5 ? 'success' : f.importance_rank <= 10 ? 'info' : 'secondary'}">${f.importance_rank}</span></td>
                                                        <td><strong>${f.variable}</strong></td>
                                                        <td>${f.f_score.toFixed(4)}</td>
                                                        <td>${f.f_pvalue < 0.0001 ? f.f_pvalue.toExponential(2) : f.f_pvalue.toFixed(4)}</td>
                                                        <td>${f.mutual_info.toFixed(4)}</td>
                                                        <td>
                                                            <div class="progress" style="height: 20px;">
                                                                <div class="progress-bar bg-${f.importance_rank <= 5 ? 'success' : f.importance_rank <= 10 ? 'info' : 'secondary'}" 
                                                                     role="progressbar" 
                                                                     style="width: ${(f.combined_importance * 100).toFixed(1)}%">
                                                                    ${(f.combined_importance * 100).toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Advertencias y Recomendaciones -->
                    ${results.warnings && results.warnings.length > 0 ? `
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="alert ${results.perfect_separation_suspected ? 'alert-danger' : 'alert-warning'} border-${results.perfect_separation_suspected ? 'danger' : 'warning'}">
                                <h6 class="alert-heading">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    ${results.perfect_separation_suspected ? 'ADVERTENCIA CRÍTICA' : 'Advertencias Importantes'}
                                </h6>
                                <ul class="mb-0">
                                    ${results.warnings.map(warning => `<li>${warning}</li>`).join('')}
                                </ul>
                                ${results.perfect_separation_suspected ? `
                                <hr>
                                <h6 class="mt-3 mb-2"><strong>Interpretación de Métricas Perfectas:</strong></h6>
                                <ul class="mb-0">
                                    <li>Un AUC = 1.0 y sensibilidad = 100% indica <strong>separación perfecta</strong>, lo cual es esperado cuando se usan las mismas variables que definieron los outliers.</li>
                                    <li>Esto <strong>NO significa que el modelo sea "perfecto"</strong>, sino que está "memorizando" la definición de outlier.</li>
                                    <li>El valor de este análisis está en los <strong>coeficientes e interpretación</strong>, no en las métricas de predicción.</li>
                                    <li>Enfócate en identificar qué variables tienen los <strong>coeficientes más grandes</strong> y <strong>odds ratios más altos</strong> para caracterizar el perfil de outliers.</li>
                                </ul>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Información del Modelo -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-dark fw-bold mb-3">Información del Modelo</h6>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Tamaño de muestra</div>
                                    <div class="h4 mb-0 text-primary fw-bold">${results.sample_size}</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Entrenamiento</div>
                                    <div class="h4 mb-0 text-success fw-bold">${results.training_size}</div>
                                    <div class="text-muted small">(${((results.training_size/results.sample_size)*100).toFixed(1)}%)</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Prueba</div>
                                    <div class="h4 mb-0 text-info fw-bold">${results.test_size}</div>
                                    <div class="text-muted small">(${((results.test_size/results.sample_size)*100).toFixed(1)}%)</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">AUC Score</div>
                                    <div class="h4 mb-0 text-${results.model_performance.auc_interpretation === 'Excelente' ? 'success' : results.model_performance.auc_interpretation === 'Buena' ? 'info' : results.model_performance.auc_interpretation === 'Aceptable' ? 'warning' : 'danger'} fw-bold">${results.auc_score.toFixed(4)}</div>
                                    <div class="text-muted small">(${results.model_performance.auc_interpretation})</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Rendimiento del Modelo -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-dark fw-bold mb-3">Rendimiento del Modelo</h6>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Precisión</div>
                                    <div class="h4 mb-0 text-info fw-bold">${(results.confusion_matrix.accuracy * 100).toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Sensibilidad</div>
                                    <div class="h4 mb-0 text-success fw-bold">${(results.confusion_matrix.sensitivity * 100).toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Especificidad</div>
                                    <div class="h4 mb-0 text-primary fw-bold">${(results.confusion_matrix.specificity * 100).toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tabla de Confusión -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-dark fw-bold">Tabla de Confusión</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-bordered">
                                    <thead class="table-warning">
                                        <tr>
                                            <th colspan="2" class="text-center">Predicción</th>
                                        </tr>
                                        <tr>
                                            <th class="text-center">No Outlier</th>
                                            <th class="text-center">Outlier</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td class="text-center">
                                                <strong>Verdaderos Negativos:</strong> ${results.confusion_matrix.true_negatives}<br>
                                                <small class="text-muted">Correctamente clasificados como No Outlier</small>
                                            </td>
                                            <td class="text-center">
                                                <strong>Falsos Positivos:</strong> ${results.confusion_matrix.false_positives}<br>
                                                <small class="text-muted">Incorrectamente clasificados como Outlier</small>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="text-center">
                                                <strong>Falsos Negativos:</strong> ${results.confusion_matrix.false_negatives}<br>
                                                <small class="text-muted">Incorrectamente clasificados como No Outlier</small>
                                            </td>
                                            <td class="text-center">
                                                <strong>Verdaderos Positivos:</strong> ${results.confusion_matrix.true_positives}<br>
                                                <small class="text-muted">Correctamente clasificados como Outlier</small>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Coeficientes del Modelo -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-dark fw-bold">Coeficientes del Modelo</h6>
                            <p class="text-muted small">Los coeficientes muestran la influencia de cada variable en la probabilidad de ser un outlier. Un coeficiente positivo indica que la variable aumenta la probabilidad de ser outlier.</p>
                            <div class="table-responsive">
                                <table class="table table-sm table-striped">
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
                                        ${coefficientsTable}
                                    </tbody>
                                </table>
                            </div>
                            <p class="text-muted small mt-2">
                                <strong>Significancia:</strong> *** p < 0.001, ** p < 0.01, * p < 0.05, . p < 0.1
                            </p>
                        </div>
                    </div>
                    
                    <!-- Gráfico ROC -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-dark fw-bold">Curva ROC</h6>
                            <div id="rocPlot"></div>
                        </div>
                    </div>
                    
                    <!-- Guía de Interpretación Dinámica -->
                    ${this.generateDynamicLogisticInterpretation(results, hasExtremeCoefficients)}
                </div>
            </div>
        `;
        
        // Crear gráfico ROC
        this.createROCPlot(results.roc_data, results.auc_score);
    },

    generateDynamicLogisticInterpretation(results, hasExtremeCoefficients) {
        /**
         * Genera guía de interpretación dinámica basada en los resultados reales
         */
        const coefs = results.coefficients_table || [];
        const significantVars = coefs.filter(c => c.p_value !== null && c.p_value < 0.05);
        const positiveCoefs = coefs.filter(c => c.coefficient > 0);
        const negativeCoefs = coefs.filter(c => c.coefficient < 0);
        const highORVars = coefs.filter(c => c.odds_ratio > 2 && !c.is_extreme);
        
        // Encontrar variable con mayor coeficiente (no extremo)
        const nonExtremeCoefs = coefs.filter(c => !c.is_extreme && Math.abs(c.coefficient) < 20);
        const topVariable = nonExtremeCoefs.length > 0 ? 
            nonExtremeCoefs.reduce((max, c) => Math.abs(c.coefficient) > Math.abs(max.coefficient) ? c : max) : null;
        
        // Evaluar confiabilidad
        const isReliable = results.confusion_matrix.specificity > 0.5 && 
                          results.class_distribution && 
                          results.class_distribution.class_0_count >= 5 && 
                          results.class_distribution.class_1_count >= 5 &&
                          !hasExtremeCoefficients;
        
        // Generar interpretación específica
        let specificInterpretation = '';
        if (topVariable) {
            const direction = topVariable.coefficient > 0 ? 'aumenta' : 'disminuye';
            const orValue = topVariable.odds_ratio;
            const orText = orValue > 1 ? 
                `${orValue.toFixed(2)} veces` : 
                orValue > 0 ? `${(1/orValue).toFixed(2)} veces` : 'valor extremo';
            specificInterpretation = `
                <div class="alert alert-info border-info mt-3">
                    <h6 class="text-info mb-2"><strong>Interpretación Específica de tus Resultados:</strong></h6>
                    <p class="mb-2">
                        <strong>${topVariable.variable}</strong> es la variable más importante para caracterizar outliers 
                        (coeficiente = ${topVariable.coefficient.toFixed(4)}).
                    </p>
                    <p class="mb-0 small">
                        Por cada unidad de aumento en <strong>${topVariable.variable}</strong>, la probabilidad de ser outlier 
                        ${direction} ${orText}. ${topVariable.p_value !== null && topVariable.p_value < 0.05 ? 
                            'Esta asociación es estadísticamente significativa (p < 0.05).' : 
                            'Sin embargo, esta asociación no es estadísticamente significativa (p ≥ 0.05).'}
                    </p>
                </div>
            `;
        }
        
        // Advertencias sobre confiabilidad
        let reliabilityWarning = '';
        if (!isReliable) {
            const issues = [];
            if (results.confusion_matrix.specificity <= 0.5) {
                issues.push('Especificidad muy baja (≤50%)');
            }
            if (results.class_distribution && (results.class_distribution.class_0_count < 5 || results.class_distribution.class_1_count < 5)) {
                issues.push('Clase minoritaria con muy pocas observaciones (<5)');
            }
            if (hasExtremeCoefficients) {
                issues.push('Coeficientes extremos detectados (separación perfecta)');
            }
            
            reliabilityWarning = `
                <div class="alert alert-danger border-danger mt-3">
                    <h6 class="text-danger mb-2"><strong>⚠️ Advertencia sobre Confiabilidad:</strong></h6>
                    <p class="mb-2">Los resultados de este análisis <strong>NO son completamente confiables</strong> para reportar debido a:</p>
                    <ul class="mb-2">
                        ${issues.map(issue => `<li>${issue}</li>`).join('')}
                    </ul>
                    <p class="mb-0 small">
                        <strong>Recomendación:</strong> Estos resultados deben interpretarse con extrema cautela. 
                        Considera aumentar el tamaño de muestra o usar técnicas de remuestreo (bootstrap) para validar los coeficientes.
                    </p>
                </div>
            `;
        }
        
        // Información sobre curva ROC
        const rocInterpretation = results.auc_score >= 0.99 ? 
            'Un AUC = 1.0 es esperado cuando se usan las mismas variables que definieron los outliers. No indica un "modelo perfecto", sino separación perfecta.' :
            results.auc_score >= 0.8 ?
            'Un AUC alto indica que las variables seleccionadas distinguen bien entre outliers y normales en este dataset específico.' :
            'Un AUC bajo sugiere que las variables seleccionadas no distinguen claramente entre outliers y normales.';
        
        return `
            <div class="row">
                <div class="col-12">
                    <div class="card border-success">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0">
                                <i class="fas fa-book me-2"></i>
                                Guía de Interpretación para Caracterización de Outliers
                            </h6>
                        </div>
                        <div class="card-body">
                            <h6 class="text-success mb-3">¿Qué información extraer de este análisis?</h6>
                            
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <h6 class="text-primary"><i class="fas fa-check-circle me-2"></i>Información Útil de tus Resultados:</h6>
                                    <ul>
                                        <li><strong>Variables analizadas:</strong> ${coefs.length} variable(s)</li>
                                        <li><strong>Variables significativas:</strong> ${significantVars.length} con p < 0.05</li>
                                        <li><strong>Variables que aumentan probabilidad:</strong> ${positiveCoefs.length}</li>
                                        <li><strong>Variables que disminuyen probabilidad:</strong> ${negativeCoefs.length}</li>
                                        <li><strong>Variables con Odds Ratio > 2:</strong> ${highORVars.length}</li>
                                    </ul>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <h6 class="text-warning"><i class="fas fa-exclamation-triangle me-2"></i>Limitaciones y Consideraciones:</h6>
                                    <ul>
                                        <li><strong>NO predice outliers nuevos:</strong> Usa las mismas variables que los definieron</li>
                                        <li><strong>AUC = ${results.auc_score.toFixed(4)}:</strong> ${rocInterpretation}</li>
                                        <li><strong>Enfócate en coeficientes:</strong> No en métricas de predicción</li>
                                        <li><strong>Interpretación exploratoria:</strong> Identifica patrones, no causa-efecto</li>
                                        ${hasExtremeCoefficients ? '<li><strong>Coeficientes extremos:</strong> Indican separación perfecta o problemas numéricos</li>' : ''}
                                    </ul>
                                </div>
                            </div>
                            
                            ${specificInterpretation}
                            
                            ${reliabilityWarning}
                            
                            <div class="alert alert-light border mt-3">
                                <h6 class="text-muted mb-2"><strong>¿Para qué sirve la Curva ROC en este contexto?</strong></h6>
                                <p class="mb-0 small">
                                    La curva ROC muestra cómo el modelo distingue entre outliers y normales usando las variables seleccionadas. 
                                    En este análisis de <strong>caracterización</strong>, la curva ROC ayuda a visualizar qué tan bien las variables 
                                    separan los grupos, pero <strong>no debe usarse para evaluar capacidad predictiva</strong> ya que se usan las 
                                    mismas variables que definieron los outliers. El valor está en identificar qué variables contribuyen más a esta separación.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    createRobustRegressionPlot(plotData, predictorVariables = null) {
        const container = document.getElementById('robustRegressionPlot');
        if (!container) return;
        
        // Determinar qué variable predictora usar
        let xData, xAxisTitle;
        if (predictorVariables && predictorVariables.length > 0) {
            const selector = document.getElementById('plotPredictorSelector');
            const selectedIndex = selector ? parseInt(selector.value) : 0;
            const selectedPredictor = predictorVariables[selectedIndex];
            
            // Usar datos de todas las predictoras si están disponibles
            if (plotData.predictors && plotData.predictors[selectedPredictor]) {
                xData = plotData.predictors[selectedPredictor];
        } else {
                // Fallback a compatibilidad con código anterior
                xData = selectedIndex === 0 ? plotData.x : (selectedIndex === 1 ? plotData.y : plotData.x);
            }
            xAxisTitle = selectedPredictor || `Predictor Variable ${selectedIndex + 1}`;
        } else {
            xData = plotData.x || [];
            xAxisTitle = 'Predictor Variable 1';
        }
        
        const trace1 = {
            x: xData,
            y: plotData.target,
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: plotData.outlier_status.map(status => status ? 'red' : 'blue'),
                size: 8,
                opacity: 0.7
            },
            name: 'Original Data',
            text: plotData.outlier_status.map(status => status ? 'Outlier' : 'Normal'),
            hovertemplate: '<b>%{text}</b><br>X: %{x}<br>Y: %{y}<extra></extra>'
        };
        
        const trace2 = {
            x: xData,
            y: plotData.lr_predictions,
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: 'green',
                size: 6,
                symbol: 'diamond'
            },
            name: 'Linear Prediction',
            hovertemplate: 'Linear Prediction: %{y}<extra></extra>'
        };
        
        const trace3 = {
            x: xData,
            y: plotData.robust_predictions,
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: 'orange',
                size: 6,
                symbol: 'square'
            },
            name: 'Robust Prediction',
            hovertemplate: 'Robust Prediction: %{y}<extra></extra>'
        };
        
        const layout = {
            title: 'Linear vs Robust Regression Comparison',
            xaxis: { title: xAxisTitle },
            yaxis: { title: 'Target Variable' },
            showlegend: true,
            height: 400
        };
        
        Plotly.newPlot(container, [trace1, trace2, trace3], layout, {
            responsive: true,
            displayModeBar: 'hover',
            scrollZoom: true
        });
    },

    createScreePlot(screeData) {
        const container = document.getElementById('screePlot');
        if (!container) return;
        
        // Traza para eigenvalues
        const eigenvalueTrace = {
            x: screeData.components,
            y: screeData.eigenvalues,
            mode: 'lines+markers',
            type: 'scatter',
            name: 'Eigenvalues',
            line: { color: 'blue', width: 2 },
            marker: { size: 8, color: 'blue' },
            hovertemplate: '<b>%{x}</b><br>Eigenvalue: %{y:.4f}<extra></extra>'
        };
        
        // Línea de referencia para criterio de Kaiser (λ = 1)
        const kaiserLine = {
            x: screeData.components,
            y: Array(screeData.components.length).fill(1),
            mode: 'lines',
            type: 'scatter',
            name: 'Kaiser Criterion (λ = 1)',
            line: { color: 'red', width: 2, dash: 'dash' },
            hovertemplate: '<b>%{x}</b><br>λ = 1<extra></extra>'
        };
        
        const layout = {
            title: 'Elbow Plot (Scree Plot)',
            xaxis: { 
                title: 'Principal Components',
                tickangle: -45
            },
            yaxis: { 
                title: 'Eigenvalue (λ)',
                zeroline: true
            },
            showlegend: true,
            height: 400,
            legend: {
                x: 0.7,
                y: 0.95
            }
        };
        
        Plotly.newPlot(container, [eigenvalueTrace, kaiserLine], layout, {
            responsive: true,
            displayModeBar: 'hover',
            scrollZoom: true
        });
    },

    createPCAPlot(plotData, loadings, loadingsLabels, pcaInfo = null) {
        const container = document.getElementById('pcaPlot');
        if (!container) return;
        
        const trace = {
            x: plotData.pc1,
            y: plotData.pc2,
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: plotData.outlier_status.map(status => status ? 'red' : 'blue'),
                size: 8,
                opacity: 0.7
            },
            name: 'Observations',
            text: plotData.outlier_status.map(status => status ? 'Outlier' : 'Normal'),
            hovertemplate: '<b>%{text}</b><br>PC1: %{x}<br>PC2: %{y}<extra></extra>'
        };
        
        // Obtener porcentajes de varianza explicada
        const pc1_variance = pcaInfo?.explained_variance_pc1 || pcaInfo?.explained_variance_ratio?.[0] || 0;
        const pc2_variance = pcaInfo?.explained_variance_pc2 || pcaInfo?.explained_variance_ratio?.[1] || 0;
        
        const layout = {
            title: 'Principal Component Analysis (PC1 vs PC2)',
            xaxis: { title: pc1_variance > 0 ? `PC1 (${(pc1_variance * 100).toFixed(1)}% variance explained)` : 'PC1' },
            yaxis: { title: pc2_variance > 0 ? `PC2 (${(pc2_variance * 100).toFixed(1)}% variance explained)` : 'PC2' },
            showlegend: true,
            height: 400
        };
        
        Plotly.newPlot(container, [trace], layout, {
            responsive: true,
            displayModeBar: 'hover',
            scrollZoom: true
        });
    },

    createROCPlot(rocData, aucScore) {
        const container = document.getElementById('rocPlot');
        if (!container) return;
        
        const trace = {
            x: rocData.fpr,
            y: rocData.tpr,
            mode: 'lines',
            type: 'scatter',
            line: {
                color: '#ffc107',
                width: 3
            },
            name: `Logistic Regression Model (AUC = ${aucScore.toFixed(4)})`,
            fill: 'tonexty',
            fillcolor: 'rgba(255, 193, 7, 0.1)'
        };
        
        const diagonal = {
            x: [0, 1],
            y: [0, 1],
            mode: 'lines',
            type: 'scatter',
            line: {
                color: 'red',
                width: 2,
                dash: 'dash'
            },
            name: 'Random Classifier (AUC = 0.5)',
            showlegend: true
        };
        
        // Determinar interpretación del AUC
        let aucInterpretation = '';
        let aucColor = '';
        if (aucScore >= 0.9) {
            aucInterpretation = 'Excellent';
            aucColor = '#28a745';
        } else if (aucScore >= 0.8) {
            aucInterpretation = 'Good';
            aucColor = '#17a2b8';
        } else if (aucScore >= 0.7) {
            aucInterpretation = 'Acceptable';
            aucColor = '#ffc107';
        } else {
            aucInterpretation = 'Poor';
            aucColor = '#dc3545';
        }
        
        const layout = {
            title: {
                text: `ROC Curve - Outlier Profile<br><span style="color: ${aucColor};">AUC = ${aucScore.toFixed(4)} (${aucInterpretation})</span>`,
                font: { size: 16 }
            },
            xaxis: { 
                title: 'False Positive Rate (1 - Specificity)',
                range: [0, 1],
                gridcolor: 'lightgray'
            },
            yaxis: { 
                title: 'True Positive Rate (Sensitivity)',
                range: [0, 1],
                gridcolor: 'lightgray'
            },
            showlegend: true,
            height: 450,
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            annotations: [
                {
                    x: 0.5,
                    y: 0.5,
                    xref: 'x',
                    yref: 'y',
                    text: `AUC = ${aucScore.toFixed(4)}<br>${aucInterpretation}`,
                    showarrow: false,
                    font: {
                        size: 14,
                        color: aucColor
                    },
                    bgcolor: 'rgba(255,255,255,0.8)',
                    bordercolor: aucColor,
                    borderwidth: 1
                }
            ]
        };
        
        Plotly.newPlot(container, [trace, diagonal], layout, {
            responsive: true,
            displayModeBar: 'hover',
            scrollZoom: true
        });
    },

    showError(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insertar al inicio del contenedor principal
        const mainContainer = document.querySelector('.container-fluid');
        mainContainer.insertBefore(alertDiv, mainContainer.firstChild);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    },

    showWarning(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning alert-dismissible fade show';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insertar al inicio del contenedor principal
        const mainContainer = document.querySelector('.container-fluid');
        mainContainer.insertBefore(alertDiv, mainContainer.firstChild);
        
        // Auto-remover después de 10 segundos
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 10000);
    },

    createBiplot(results) {
        const plotData = results.plot_data;
        const loadings = results.loadings;
        const loadingsLabels = results.loadings_labels;
        const displayLoadingsLabels = loadingsLabels ? loadingsLabels.map(label => this.formatVariableLabel(label)) : [];
        
        const container = document.getElementById('biplot');
        if (!container) return;
        
        // Preparar datos para el biplot
        const traces = [];
        
        // Traza 1: Puntos de datos (PC1 vs PC2)
        const outlierIndices = plotData.outlier_status.map((isOutlier, index) => isOutlier ? index : -1).filter(i => i !== -1);
        const normalIndices = plotData.outlier_status.map((isOutlier, index) => !isOutlier ? index : -1).filter(i => i !== -1);
        
        // Puntos outliers
        if (outlierIndices.length > 0) {
            traces.push({
                x: outlierIndices.map(i => plotData.pc1[i]),
                y: outlierIndices.map(i => plotData.pc2[i]),
                mode: 'markers',
                type: 'scatter',
                name: 'Outliers',
                marker: {
                    color: 'red',
                    size: 8,
                    symbol: 'x'
                },
                text: outlierIndices.map(i => `Índice: ${plotData.original_indices[i]}`),
                hovertemplate: '<b>Outlier</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<br>%{text}<extra></extra>'
            });
        }
        
        // Puntos normales
        if (normalIndices.length > 0) {
            traces.push({
                x: normalIndices.map(i => plotData.pc1[i]),
                y: normalIndices.map(i => plotData.pc2[i]),
                mode: 'markers',
                type: 'scatter',
                name: 'Normal Data',
                marker: {
                    color: 'blue',
                    size: 6,
                    opacity: 0.7
                },
                text: normalIndices.map(i => `Índice: ${plotData.original_indices[i]}`),
                hovertemplate: '<b>Dato Normal</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<br>%{text}<extra></extra>'
            });
        }
        
        // Traza 2: Flechas de variables (loadings) con líneas y puntas de flecha
        const annotations = [];
        if (loadings && loadings.length > 0 && loadingsLabels) {
            const pc1_loadings = loadings[0]; // Loadings para PC1
            const pc2_loadings = loadings[1]; // Loadings para PC2
            
            // Escalar los loadings para que sean visibles en el gráfico
            const max_loading = Math.max(...pc1_loadings.map(Math.abs), ...pc2_loadings.map(Math.abs));
            const scale_factor = 0.8 / max_loading;
            
            // Primero agregar las líneas como trazas de scatter
            displayLoadingsLabels.forEach((label, i) => {
                const x_end = pc1_loadings[i] * scale_factor;
                const y_end = pc2_loadings[i] * scale_factor;
                
                // Traza de línea desde el origen hasta el punto final
                traces.push({
                    x: [0, x_end],
                    y: [0, y_end],
                    mode: 'lines',
                    type: 'scatter',
                    name: `${label} (arrow)`,
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
                x: displayLoadingsLabels.map((label, i) => pc1_loadings[i] * scale_factor),
                y: displayLoadingsLabels.map((label, i) => pc2_loadings[i] * scale_factor),
                mode: 'text',
                type: 'scatter',
                name: 'Variables',
                text: displayLoadingsLabels,
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
            displayLoadingsLabels.forEach((label, i) => {
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
        
        // Configuración del layout
        const pc1_variance = results.pca_info?.explained_variance_pc1 || results.explained_variance_ratio?.[0] || 0;
        const pc2_variance = results.pca_info?.explained_variance_pc2 || results.explained_variance_ratio?.[1] || 0;
        
        const layout = {
            title: {
                text: 'Biplot: Principal Components with Original Variables',
                font: { size: 16 }
            },
            xaxis: {
                title: `PC1 (${(pc1_variance * 100).toFixed(1)}% variance explained)`,
                zeroline: true,
                zerolinecolor: 'lightgray'
            },
            yaxis: {
                title: `PC2 (${(pc2_variance * 100).toFixed(1)}% variance explained)`,
                zeroline: true,
                zerolinecolor: 'lightgray'
            },
            legend: {
                x: 0.02,
                y: 0.98,
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: 'gray',
                borderwidth: 1
            },
            hovermode: 'closest',
            width: null,
            height: 500,
            annotations: annotations
        };
        
        // Crear el gráfico
        Plotly.newPlot(container, traces, layout, {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true
        });
    },

    displayClusteringResults(results) {
        const container = document.getElementById('clusteringResultsContainer');
        if (!container) {
            return;
        }
        
        if (results.error) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> ${results.error}
                </div>
            `;
            return;
        }
        
        // Verificar si hay datos insuficientes y mostrar advertencia
        let warningHtml = '';
        if (results.status === 'warning_insufficient_data' || results.message) {
            warningHtml = `
                <div class="alert alert-info mb-4">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Información:</strong> ${results.message}
                    <br><br>
                    <strong>Detalles:</strong>
                    <ul class="mb-0">
                        <li>Datos disponibles: ${results.available_data_points} observaciones</li>
                        <li>Mínimo requerido: ${results.minimum_required} observaciones</li>
                    </ul>
                    <br>
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Advertencia:</strong> Con pocas observaciones, los resultados del clustering pueden no ser confiables. Se recomienda interpretar los resultados con precaución.
                    </div>
                </div>
            `;
        }
        
        // Banner de recomendación
        const recommendations = results.recommendations;
        const decisionInfo = recommendations.decision_info || {};
        const voteDistribution = recommendations.vote_distribution || {};
        const voteText = Object.entries(voteDistribution)
            .map(([k, votes]) => `${k} clústeres (${votes} votos)`)
            .join(', ');
        
        // Información sobre la decisión
        const decisionReasoning = decisionInfo.reasoning || "Basado en análisis de múltiples métodos";
        const primaryMethod = decisionInfo.primary_method || "Silhouette Score";
        const silhouetteScoreAtK = decisionInfo.silhouette_score_at_k || null;
        const allMethodsSuggestions = decisionInfo.all_methods_suggestions || {};
        
        container.innerHTML = `
            ${warningHtml}
            <div class="card">
                <div class="card-header bg-info text-white">
                    <h6 class="mb-0">
                        <i class="fas fa-chart-line me-2"></i>
                        Resultados del Análisis de Clustering
                    </h6>
                </div>
                <div class="card-body">
                    <!-- Banner de recomendación -->
                    <div class="alert alert-success border-start border-success border-4 mb-4">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h6 class="alert-heading mb-2">
                                    <i class="fas fa-lightbulb me-2"></i>
                                    Recomendación Final
                                </h6>
                                <p class="mb-2">
                                    <strong>Número óptimo de clústeres: ${recommendations.final_recommendation}</strong>
                                </p>
                                <p class="mb-1 small">
                                    <strong>Método principal:</strong> ${primaryMethod}
                                    ${silhouetteScoreAtK !== null ? ` (Score: ${silhouetteScoreAtK.toFixed(3)})` : ''}
                                </p>
                                <p class="mb-0 small text-muted">
                                    <i class="fas fa-info-circle me-1"></i>
                                    ${decisionReasoning}
                                </p>
                            </div>
                            <div class="col-md-4 text-center">
                                <div class="display-4 text-success">${recommendations.final_recommendation}</div>
                                <small class="text-muted">clústeres</small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Información sobre la estrategia de decisión -->
                    <div class="alert alert-info mb-4">
                        <h6 class="alert-heading">
                            <i class="fas fa-brain me-2"></i>
                            Estrategia de Decisión
                        </h6>
                        <p class="mb-2">
                            El análisis utiliza una estrategia que <strong>prioriza el Coeficiente de Silueta (Silhouette Score)</strong> 
                            como método principal, ya que según la literatura es el más robusto para determinar el número óptimo de clústeres.
                        </p>
                        <div class="row mb-2">
                            <div class="col-md-6">
                                <strong>Sugerencias por método:</strong>
                                <ul class="mb-0 small">
                                    <li>Método del Codo: <strong>${allMethodsSuggestions.elbow || recommendations.elbow_method}</strong> clústeres</li>
                                    <li>Silhouette Score: <strong>${allMethodsSuggestions.silhouette || recommendations.silhouette_method}</strong> clústeres <span class="badge bg-success">Priorizado</span></li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <ul class="mb-0 small">
                                    <li>Calinski-Harabasz: <strong>${allMethodsSuggestions.calinski_harabasz || recommendations.calinski_harabasz_method}</strong> clústeres</li>
                                    <li>Davies-Bouldin: <strong>${allMethodsSuggestions.davies_bouldin || recommendations.davies_bouldin_method}</strong> clústeres</li>
                                </ul>
                            </div>
                        </div>
                        <p class="mb-0 small text-muted">
                            <i class="fas fa-lightbulb me-1"></i>
                            Los demás métodos se consideran como validación y contexto, pero la decisión final prioriza Silhouette Score por su robustez.
                        </p>
                    </div>
                    
                    <!-- Información del análisis -->
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Variables utilizadas</div>
                                    <div class="h5 mb-0 text-primary fw-bold">${results.variables_used.length}</div>
                                    <div class="text-muted small">${results.variables_used.join(', ')}</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Tamaño de muestra</div>
                                    <div class="h5 mb-0 text-success fw-bold">${results.sample_size}</div>
                                    <div class="text-muted small">observaciones válidas</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Gráficos de los 4 métodos en grid 2x2 -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-dark fw-bold mb-3">Análisis de Métodos para Determinar K Óptimo</h6>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <div class="card h-100">
                                        <div class="card-header bg-primary text-white">
                                            <h6 class="mb-0">Método del Codo (Elbow Method)</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="elbowPlotContainer"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <div class="card h-100">
                                        <div class="card-header bg-info text-white">
                                            <h6 class="mb-0">Coeficiente de Silueta (Silhouette Score)</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="silhouettePlotContainer"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <div class="card h-100">
                                        <div class="card-header bg-warning text-dark">
                                            <h6 class="mb-0">Índice de Calinski-Harabasz</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="calinskiPlotContainer"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <div class="card h-100">
                                        <div class="card-header bg-secondary text-white">
                                            <h6 class="mb-0">Índice de Davies-Bouldin</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="daviesPlotContainer"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tabla de resultados detallados -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6 class="text-dark fw-bold mb-3">Resultados Detallados por Método</h6>
                            <div class="table-responsive">
                                <table class="table table-striped table-hover">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>K</th>
                                            <th>WSS (Elbow)</th>
                                            <th>Silhouette</th>
                                            <th>Calinski-Harabasz</th>
                                            <th>Davies-Bouldin</th>
                                            <th>Recomendación</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${results.results_table.map(row => `
                                            <tr class="${row.is_recommended ? 'table-success' : ''}">
                                                <td><strong>${row.k}</strong></td>
                                                <td>${row.wss.toFixed(2)}</td>
                                                <td>${row.silhouette.toFixed(4)}</td>
                                                <td>${row.calinski_harabasz.toFixed(2)}</td>
                                                <td>${row.davies_bouldin ? row.davies_bouldin.toFixed(4) : 'N/A'}</td>
                                                <td>
                                                    ${row.is_elbow_optimal ? '<span class="badge bg-primary me-1">Elbow</span>' : ''}
                                                    ${row.is_silhouette_optimal ? '<span class="badge bg-info me-1">Silhouette</span>' : ''}
                                                    ${row.is_calinski_optimal ? '<span class="badge bg-warning me-1">Calinski</span>' : ''}
                                                    ${row.is_davies_optimal ? '<span class="badge bg-secondary me-1">Davies</span>' : ''}
                                                    ${row.is_recommended ? '<span class="badge bg-success">Recomendado</span>' : ''}
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Resumen de métodos -->
                    <div class="row">
                        <div class="col-12">
                            <h6 class="text-dark fw-bold mb-3">Resumen por Método</h6>
                            <div class="row">
                                <div class="col-md-3 mb-3">
                                    <div class="card h-100 border-0 shadow-sm">
                                        <div class="card-body text-center p-3">
                                            <div class="text-muted small mb-1">Método del Codo</div>
                                            <div class="h4 mb-0 text-primary fw-bold">${recommendations.elbow_method}</div>
                                            <div class="text-muted small">clústeres</div>
                                        </div>
                                        <div class="card-footer bg-transparent border-0 p-2">
                                            <button type="button" class="btn btn-outline-primary btn-sm w-100" onclick="analyzeVizModule.showClusteringInfo('elbow')">
                                                <i class="fas fa-info-circle me-1"></i>
                                                Información
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <div class="card h-100 border-0 shadow-sm">
                                        <div class="card-body text-center p-3">
                                            <div class="text-muted small mb-1">Coeficiente de Silueta</div>
                                            <div class="h4 mb-0 text-info fw-bold">${recommendations.silhouette_method}</div>
                                            <div class="text-muted small">clústeres</div>
                                        </div>
                                        <div class="card-footer bg-transparent border-0 p-2">
                                            <button type="button" class="btn btn-outline-info btn-sm w-100" onclick="analyzeVizModule.showClusteringInfo('silhouette')">
                                                <i class="fas fa-info-circle me-1"></i>
                                                Información
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <div class="card h-100 border-0 shadow-sm">
                                        <div class="card-body text-center p-3">
                                            <div class="text-muted small mb-1">Calinski-Harabasz</div>
                                            <div class="h4 mb-0 text-warning fw-bold">${recommendations.calinski_harabasz_method}</div>
                                            <div class="text-muted small">clústeres</div>
                                        </div>
                                        <div class="card-footer bg-transparent border-0 p-2">
                                            <button type="button" class="btn btn-outline-warning btn-sm w-100" onclick="analyzeVizModule.showClusteringInfo('calinski')">
                                                <i class="fas fa-info-circle me-1"></i>
                                                Información
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <div class="card h-100 border-0 shadow-sm">
                                        <div class="card-body text-center p-3">
                                            <div class="text-muted small mb-1">Davies-Bouldin</div>
                                            <div class="h4 mb-0 text-secondary fw-bold">${recommendations.davies_bouldin_method}</div>
                                            <div class="text-muted small">clústeres</div>
                                        </div>
                                        <div class="card-footer bg-transparent border-0 p-2">
                                            <button type="button" class="btn btn-outline-secondary btn-sm w-100" onclick="analyzeVizModule.showClusteringInfo('davies')">
                                                <i class="fas fa-info-circle me-1"></i>
                                                Información
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Crear todos los gráficos de los métodos
        this.createElbowPlot(results.elbow_plot_data);
        this.createSilhouettePlot(results.results_table);
        this.createCalinskiPlot(results.results_table);
        this.createDaviesPlot(results.results_table);
        
        // Mostrar sección de K-means y configurar datos
        this.showKmeansSection(results);
        this.setupHierarchicalClustering(results);
    },

    createElbowPlot(plotData) {
        const container = document.getElementById('elbowPlotContainer');
        if (!container) return;
        
        const trace = {
            x: plotData.k_values,
            y: plotData.wss_values,
            mode: 'lines+markers',
            type: 'scatter',
            name: 'WSS (Within Sum of Squares)',
            line: {
                color: '#2c3e50',
                width: 3,
                shape: 'spline'
            },
            marker: {
                color: '#3498db',
                size: 10,
                line: {
                    color: '#2c3e50',
                    width: 1.5
                }
            },
            hovertemplate: '<b>K = %{x}</b><br>WSS = %{y:.2f}<br><extra></extra>',
            showlegend: true
        };
        
        // Línea vertical para el k óptimo
        const optimalK = plotData.optimal_k;
        const maxWSS = Math.max(...plotData.wss_values);
        const minWSS = Math.min(...plotData.wss_values);
        
        const verticalLine = {
            x: [optimalK, optimalK],
            y: [minWSS, maxWSS],
            mode: 'lines',
            type: 'scatter',
            name: `K Óptimo = ${optimalK}`,
            line: {
                color: '#e74c3c',
                width: 3,
                dash: 'dash'
            },
            showlegend: true,
            hovertemplate: `<b>Optimal K = ${optimalK}</b><extra></extra>`
        };
        
        const layout = {
            title: {
                text: 'Elbow Method: Optimal Number of Clusters Determination',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: 'Number of Clusters (K)',
                    font: { size: 14, color: '#34495e' }
                },
                tickmode: 'linear',
                tick0: Math.min(...plotData.k_values),
                dtick: 1,
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false
            },
            yaxis: {
                title: {
                    text: 'Within Sum of Squares (WSS)',
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false
            },
            legend: {
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            hovermode: 'closest',
            width: null,
            height: 400,
            margin: { l: 70, r: 100, t: 80, b: 60 },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white',
            annotations: [
                {
                    x: optimalK,
                    y: maxWSS * 0.85,
                    text: `<b>K Óptimo = ${optimalK}</b>`,
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1.2,
                    arrowwidth: 2.5,
                    arrowcolor: '#e74c3c',
                    font: {
                        size: 14,
                        color: '#e74c3c',
                        family: 'Arial, sans-serif'
                    },
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    bordercolor: '#e74c3c',
                    borderwidth: 1,
                    borderpad: 4
                }
            ]
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'elbow_method',
                height: 600,
                width: 900,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, [trace, verticalLine], layout, config);
    },

    createSilhouettePlot(resultsTable) {
        const container = document.getElementById('silhouettePlotContainer');
        if (!container) return;
        
        const kValues = resultsTable.map(row => row.k);
        const silhouetteValues = resultsTable.map(row => row.silhouette);
        const optimalK = resultsTable.find(row => row.is_silhouette_optimal)?.k;
        
        const trace = {
            x: kValues,
            y: silhouetteValues,
            mode: 'lines+markers',
            type: 'scatter',
            name: 'Silhouette Score',
            line: {
                color: '#16a085',
                width: 3,
                shape: 'spline'
            },
            marker: {
                color: '#1abc9c',
                size: 10,
                line: {
                    color: '#16a085',
                    width: 1.5
                }
            },
            hovertemplate: '<b>K = %{x}</b><br>Silhouette = %{y:.4f}<br><extra></extra>',
            showlegend: true
        };
        
        // Línea vertical para el k óptimo
        const maxSilhouette = Math.max(...silhouetteValues);
        const minSilhouette = Math.min(...silhouetteValues);
        
        const verticalLine = {
            x: [optimalK, optimalK],
            y: [minSilhouette, maxSilhouette],
            mode: 'lines',
            type: 'scatter',
            name: `K Óptimo = ${optimalK}`,
            line: {
                color: '#e74c3c',
                width: 3,
                dash: 'dash'
            },
            showlegend: true,
            hovertemplate: `<b>Optimal K = ${optimalK}</b><extra></extra>`
        };
        
        const layout = {
            title: {
                text: 'Silhouette Score: Optimal Number of Clusters Determination',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: 'Number of Clusters (K)',
                    font: { size: 14, color: '#34495e' }
                },
                tickmode: 'linear',
                tick0: Math.min(...kValues),
                dtick: 1,
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false
            },
            yaxis: {
                title: {
                    text: 'Silhouette Score',
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false,
                range: [Math.max(0, minSilhouette - 0.05), Math.min(1, maxSilhouette + 0.05)]
            },
            legend: {
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            hovermode: 'closest',
            width: null,
            height: 400,
            margin: { l: 70, r: 100, t: 80, b: 60 },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white',
            annotations: [
                {
                    x: optimalK,
                    y: maxSilhouette * 0.85,
                    text: `<b>K Óptimo = ${optimalK}</b>`,
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1.2,
                    arrowwidth: 2.5,
                    arrowcolor: '#e74c3c',
                    font: {
                        size: 14,
                        color: '#e74c3c',
                        family: 'Arial, sans-serif'
                    },
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    bordercolor: '#e74c3c',
                    borderwidth: 1,
                    borderpad: 4
                }
            ]
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'silhouette_method',
                height: 600,
                width: 900,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, [trace, verticalLine], layout, config);
    },

    createCalinskiPlot(resultsTable) {
        const container = document.getElementById('calinskiPlotContainer');
        if (!container) return;
        
        const kValues = resultsTable.map(row => row.k);
        const calinskiValues = resultsTable.map(row => row.calinski_harabasz);
        const optimalK = resultsTable.find(row => row.is_calinski_optimal)?.k;
        
        const trace = {
            x: kValues,
            y: calinskiValues,
            mode: 'lines+markers',
            type: 'scatter',
            name: 'Calinski-Harabasz Index',
            line: {
                color: '#f39c12',
                width: 3,
                shape: 'spline'
            },
            marker: {
                color: '#e67e22',
                size: 10,
                line: {
                    color: '#d35400',
                    width: 1.5
                }
            },
            hovertemplate: '<b>K = %{x}</b><br>Calinski-Harabasz = %{y:.2f}<br><extra></extra>',
            showlegend: true
        };
        
        // Línea vertical para el k óptimo
        const maxCalinski = Math.max(...calinskiValues);
        const minCalinski = Math.min(...calinskiValues);
        
        const verticalLine = {
            x: [optimalK, optimalK],
            y: [minCalinski, maxCalinski],
            mode: 'lines',
            type: 'scatter',
            name: `K Óptimo = ${optimalK}`,
            line: {
                color: '#e74c3c',
                width: 3,
                dash: 'dash'
            },
            showlegend: true,
            hovertemplate: `<b>Optimal K = ${optimalK}</b><extra></extra>`
        };
        
        const layout = {
            title: {
                text: 'Calinski-Harabasz Index: Optimal Number of Clusters Determination',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: 'Number of Clusters (K)',
                    font: { size: 14, color: '#34495e' }
                },
                tickmode: 'linear',
                tick0: Math.min(...kValues),
                dtick: 1,
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false
            },
            yaxis: {
                title: {
                    text: 'Calinski-Harabasz Index',
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false
            },
            legend: {
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            hovermode: 'closest',
            width: null,
            height: 400,
            margin: { l: 70, r: 100, t: 80, b: 60 },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white',
            annotations: [
                {
                    x: optimalK,
                    y: maxCalinski * 0.85,
                    text: `<b>K Óptimo = ${optimalK}</b>`,
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1.2,
                    arrowwidth: 2.5,
                    arrowcolor: '#e74c3c',
                    font: {
                        size: 14,
                        color: '#e74c3c',
                        family: 'Arial, sans-serif'
                    },
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    bordercolor: '#e74c3c',
                    borderwidth: 1,
                    borderpad: 4
                }
            ]
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'calinski_method',
                height: 600,
                width: 900,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, [trace, verticalLine], layout, config);
    },

    createDaviesPlot(resultsTable) {
        const container = document.getElementById('daviesPlotContainer');
        if (!container) return;
        
        const kValues = resultsTable.map(row => row.k);
        const daviesValues = resultsTable.map(row => row.davies_bouldin).filter(val => val !== null);
        const optimalK = resultsTable.find(row => row.is_davies_optimal)?.k;
        
        // Filtrar kValues para que coincidan con daviesValues válidos
        const validKValues = kValues.filter((_, index) => resultsTable[index].davies_bouldin !== null);
        
        const trace = {
            x: validKValues,
            y: daviesValues,
            mode: 'lines+markers',
            type: 'scatter',
            name: 'Davies-Bouldin Index',
            line: {
                color: '#7f8c8d',
                width: 3,
                shape: 'spline'
            },
            marker: {
                color: '#95a5a6',
                size: 10,
                line: {
                    color: '#34495e',
                    width: 1.5
                }
            },
            hovertemplate: '<b>K = %{x}</b><br>Davies-Bouldin = %{y:.4f}<br><extra></extra>',
            showlegend: true
        };
        
        // Línea vertical para el k óptimo
        const maxDavies = Math.max(...daviesValues);
        const minDavies = Math.min(...daviesValues);
        
        const verticalLine = {
            x: [optimalK, optimalK],
            y: [minDavies, maxDavies],
            mode: 'lines',
            type: 'scatter',
            name: `K Óptimo = ${optimalK}`,
            line: {
                color: '#e74c3c',
                width: 3,
                dash: 'dash'
            },
            showlegend: true,
            hovertemplate: `<b>Optimal K = ${optimalK}</b><extra></extra>`
        };
        
        const layout = {
            title: {
                text: 'Davies-Bouldin Index: Optimal Number of Clusters Determination',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: 'Number of Clusters (K)',
                    font: { size: 14, color: '#34495e' }
                },
                tickmode: 'linear',
                tick0: Math.min(...validKValues),
                dtick: 1,
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false
            },
            yaxis: {
                title: {
                    text: 'Davies-Bouldin Index',
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false
            },
            legend: {
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            hovermode: 'closest',
            width: null,
            height: 400,
            margin: { l: 70, r: 100, t: 80, b: 60 },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white',
            annotations: [
                {
                    x: optimalK,
                    y: maxDavies * 0.85,
                    text: `<b>K Óptimo = ${optimalK}</b>`,
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1.2,
                    arrowwidth: 2.5,
                    arrowcolor: '#e74c3c',
                    font: {
                        size: 14,
                        color: '#e74c3c',
                        family: 'Arial, sans-serif'
                    },
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    bordercolor: '#e74c3c',
                    borderwidth: 1,
                    borderpad: 4
                }
            ]
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'davies_method',
                height: 600,
                width: 900,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, [trace, verticalLine], layout, config);
    },

    showClusteringInfo(method) {
        const modal = document.getElementById('clusteringInfoModal');
        const modalBody = document.getElementById('clusteringInfoModalBody');
        const modalTitle = document.getElementById('clusteringInfoModalLabel');
        
        let title, content;
        
        switch(method) {
            case 'elbow':
                title = 'Método del Codo (Elbow Method)';
                content = `
                    <div class="row">
                        <div class="col-12">
                            <h6 class="text-primary mb-3">
                                <i class="fas fa-chart-line me-2"></i>
                                Principio del Método
                            </h6>
                            <p class="text-justify">
                                El Método del Codo es una técnica visual para determinar el número óptimo de clústeres en algoritmos de clustering como K-means. 
                                Se basa en el principio de que al aumentar el número de clústeres, la suma de cuadrados intra-clúster (WSS - Within Sum of Squares) 
                                disminuye, pero esta reducción se vuelve menos significativa después de cierto punto.
                            </p>
                            
                            <h6 class="text-primary mb-3">
                                <i class="fas fa-calculator me-2"></i>
                                Cálculo
                            </h6>
                            <p class="text-justify">
                                Para cada valor de K (número de clústeres), se calcula la suma de las distancias cuadradas entre cada punto y el centroide de su clúster asignado. 
                                La fórmula es: <strong>WSS = Σ(xi - μk)²</strong>, donde xi es cada punto y μk es el centroide del clúster k.
                            </p>
                            
                            <h6 class="text-primary mb-3">
                                <i class="fas fa-search me-2"></i>
                                Interpretación
                            </h6>
                            <p class="text-justify">
                                El "codo" se identifica como el punto donde la curva de WSS cambia de una pendiente pronunciada a una más suave. 
                                Este punto representa el número óptimo de clústeres, ya que agregar más clústeres no mejora significativamente 
                                la cohesión interna de los grupos.
                            </p>
                            
                            <div class="alert alert-info">
                                <i class="fas fa-lightbulb me-2"></i>
                                <strong>Ventaja:</strong> Es intuitivo y fácil de interpretar visualmente.
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'silhouette':
                title = 'Coeficiente de Silueta (Silhouette Score)';
                content = `
                    <div class="row">
                        <div class="col-12">
                            <h6 class="text-info mb-3">
                                <i class="fas fa-chart-line me-2"></i>
                                Principio del Método
                            </h6>
                            <p class="text-justify">
                                El Coeficiente de Silueta mide qué tan bien un objeto se ajusta a su clúster asignado en comparación con otros clústeres. 
                                Combina dos conceptos importantes: la cohesión (qué tan cerca está un punto de otros puntos en su mismo clúster) 
                                y la separación (qué tan lejos está de puntos en otros clústeres).
                            </p>
                            
                            <h6 class="text-info mb-3">
                                <i class="fas fa-calculator me-2"></i>
                                Cálculo
                            </h6>
                            <p class="text-justify">
                                Para cada punto i, se calcula:
                                <ul>
                                    <li><strong>a(i):</strong> Distancia promedio a todos los puntos en el mismo clúster</li>
                                    <li><strong>b(i):</strong> Distancia promedio mínima a puntos en otros clústeres</li>
                                </ul>
                                El coeficiente de silueta para el punto i es: <strong>s(i) = (b(i) - a(i)) / max(a(i), b(i))</strong>
                            </p>
                            
                            <h6 class="text-info mb-3">
                                <i class="fas fa-search me-2"></i>
                                Interpretación
                            </h6>
                            <p class="text-justify">
                                El coeficiente varía entre -1 y 1:
                                <ul>
                                    <li><strong>Valores cercanos a 1:</strong> El punto está bien asignado a su clúster</li>
                                    <li><strong>Valores cercanos a 0:</strong> El punto está cerca del límite entre clústeres</li>
                                    <li><strong>Valores cercanos a -1:</strong> El punto podría estar asignado incorrectamente</li>
                                </ul>
                            </p>
                            
                            <div class="alert alert-info">
                                <i class="fas fa-lightbulb me-2"></i>
                                <strong>Ventaja:</strong> Proporciona una medida cuantitativa robusta de la calidad del clustering.
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'calinski':
                title = 'Índice de Calinski-Harabasz';
                content = `
                    <div class="row">
                        <div class="col-12">
                            <h6 class="text-warning mb-3">
                                <i class="fas fa-chart-line me-2"></i>
                                Principio del Método
                            </h6>
                            <p class="text-justify">
                                El Índice de Calinski-Harabasz (también conocido como Criterio de Varianza) evalúa la calidad del clustering 
                                comparando la varianza entre clústeres con la varianza dentro de los clústeres. 
                                Un valor alto indica clústeres bien definidos y separados.
                            </p>
                            
                            <h6 class="text-warning mb-3">
                                <i class="fas fa-calculator me-2"></i>
                                Cálculo
                            </h6>
                            <p class="text-justify">
                                El índice se calcula como: <strong>CH = [tr(Bk) / (k-1)] / [tr(Wk) / (n-k)]</strong>
                                <ul>
                                    <li><strong>Bk:</strong> Matriz de dispersión entre clústeres</li>
                                    <li><strong>Wk:</strong> Matriz de dispersión dentro de clústeres</li>
                                    <li><strong>k:</strong> Número de clústeres</li>
                                    <li><strong>n:</strong> Número total de observaciones</li>
                                    <li><strong>tr():</strong> Traza de la matriz</li>
                                </ul>
                            </p>
                            
                            <h6 class="text-warning mb-3">
                                <i class="fas fa-search me-2"></i>
                                Interpretación
                            </h6>
                            <p class="text-justify">
                                <ul>
                                    <li><strong>Valores altos:</strong> Indican clústeres bien separados y compactos</li>
                                    <li><strong>Valores bajos:</strong> Sugieren clústeres mal definidos o superpuestos</li>
                                    <li><strong>Máximo:</strong> El valor máximo del índice indica el número óptimo de clústeres</li>
                                </ul>
                            </p>
                            
                            <div class="alert alert-warning">
                                <i class="fas fa-lightbulb me-2"></i>
                                <strong>Ventaja:</strong> Es computacionalmente eficiente y proporciona una medida clara de la separación entre clústeres.
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'davies':
                title = 'Índice de Davies-Bouldin';
                content = `
                    <div class="row">
                        <div class="col-12">
                            <h6 class="text-secondary mb-3">
                                <i class="fas fa-chart-line me-2"></i>
                                Principio del Método
                            </h6>
                            <p class="text-justify">
                                El Índice de Davies-Bouldin mide la similitud promedio entre clústeres. 
                                Se basa en la relación entre la dispersión dentro de cada clúster y la separación entre clústeres. 
                                Un valor bajo indica clústeres bien separados y compactos.
                            </p>
                            
                            <h6 class="text-secondary mb-3">
                                <i class="fas fa-calculator me-2"></i>
                                Cálculo
                            </h6>
                            <p class="text-justify">
                                Para cada clúster i, se calcula la similitud con todos los otros clústeres j:
                                <strong>Rij = (σi + σj) / dij</strong>
                                <ul>
                                    <li><strong>σi, σj:</strong> Dispersión promedio dentro de los clústeres i y j</li>
                                    <li><strong>dij:</strong> Distancia entre los centroides de los clústeres i y j</li>
                                </ul>
                                El índice es el promedio de los valores máximos de Rij para cada clúster.
                            </p>
                            
                            <h6 class="text-secondary mb-3">
                                <i class="fas fa-search me-2"></i>
                                Interpretación
                            </h6>
                            <p class="text-justify">
                                <ul>
                                    <li><strong>Valores bajos:</strong> Indican clústeres bien separados y compactos</li>
                                    <li><strong>Valores altos:</strong> Sugieren clústeres mal definidos o superpuestos</li>
                                    <li><strong>Mínimo:</strong> El valor mínimo del índice indica el número óptimo de clústeres</li>
                                </ul>
                            </p>
                            
                            <div class="alert alert-secondary">
                                <i class="fas fa-lightbulb me-2"></i>
                                <strong>Ventaja:</strong> Es robusto y no requiere suposiciones sobre la forma de los clústeres.
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        modalTitle.innerHTML = `<i class="fas fa-info-circle me-2"></i>${title}`;
        modalBody.innerHTML = content;
        
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    },

    showKmeansSection(results) {
        // Mostrar la sección de K-means
        const kmeansSection = document.getElementById('kmeansSection');
        if (kmeansSection) {
            kmeansSection.style.display = 'block';
        }
        
        // Actualizar información en la sección
        const optimalKDisplay = document.getElementById('optimalKDisplay');
        const selectedVariablesDisplay = document.getElementById('selectedVariablesDisplay');
        
        if (optimalKDisplay) {
            optimalKDisplay.textContent = results.recommendations.final_recommendation;
        }
        
        if (selectedVariablesDisplay) {
            selectedVariablesDisplay.textContent = results.variables_used.join(', ');
        }
        
        // Configurar event listener para el botón "Aplicar K-means"
        const applyKmeansBtn = document.getElementById('applyKmeans');
        if (applyKmeansBtn) {
            // Remover event listeners previos
            applyKmeansBtn.replaceWith(applyKmeansBtn.cloneNode(true));
            const newApplyKmeansBtn = document.getElementById('applyKmeans');
            
            newApplyKmeansBtn.addEventListener('click', () => {
                this.executeKmeans(results);
            });
        }
    },

    async executeKmeans(clusteringResults) {
        try {
            const container = document.getElementById('kmeansResultsContainer');
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-spinner fa-spin me-2"></i>
                    Aplicando algoritmo K-means y generando visualización...
                </div>
            `;
            
            // Llamada al backend para aplicar K-means
            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/apply-kmeans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    outlier_results: this.outlierResults,
                    variables: clusteringResults.variables_used,
                    optimal_k: clusteringResults.recommendations.final_recommendation
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            
            if (results.error) {
                throw new Error(results.error);
            }
            
            this.displayKmeansResults(results);
        } catch (error) {
            const container = document.getElementById('kmeansResultsContainer');
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> No se pudo aplicar K-means: ${error.message}
                </div>
            `;
        }
    },

    displayKmeansResults(results) {
        const container = document.getElementById('kmeansResultsContainer');
        if (!container) return;
        
        if (results.error) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> ${results.error}
                </div>
            `;
            return;
        }
        
        // Crear tabla de estadísticas de clústeres
        let clusterStatsTable = '';
        results.cluster_stats.forEach(cluster => {
            clusterStatsTable += `
                <tr>
                    <td class="text-center">
                        <span class="badge bg-primary">Clúster ${cluster.cluster_id}</span>
                    </td>
                    <td class="text-center">${cluster.size}</td>
                    <td class="text-center">${cluster.percentage.toFixed(1)}%</td>
                    <td class="text-center">${cluster.centroid_pca[0].toFixed(3)}, ${cluster.centroid_pca[1].toFixed(3)}</td>
                </tr>
            `;
        });
        
        // Crear tabla de métricas de clustering
        const metrics = results.clustering_metrics;
        const modelInfo = results.kmeans_model_info;
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header bg-success text-white">
                    <h6 class="mb-0">
                        <i class="fas fa-chart-scatter me-2"></i>
                        Resultados de K-means con Visualización PCA
                    </h6>
                </div>
                <div class="card-body">
                    <!-- Banner de información -->
                    <div class="alert alert-success border-start border-success border-4 mb-4">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h6 class="alert-heading mb-2">
                                    <i class="fas fa-check-circle me-2"></i>
                                    K-means Aplicado Exitosamente
                                </h6>
                                <p class="mb-2">
                                    <strong>Número de clústeres:</strong> ${results.optimal_k} | 
                                    <strong>Variables utilizadas:</strong> ${results.variables_used.length} | 
                                    <strong>Muestra:</strong> ${results.sample_size} observaciones
                                </p>
                                <p class="mb-0 small">
                                    <strong>Varianza explicada por PCA:</strong> ${(results.pca_info.total_variance_explained * 100).toFixed(1)}% (solo para visualización)
                                </p>
                            </div>
                            <div class="col-md-4 text-center">
                                <div class="display-4 text-success">${results.optimal_k}</div>
                                <small class="text-muted">clústeres</small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Información sobre el método K-means -->
                    <div class="alert alert-info mb-4">
                        <h6 class="alert-heading">
                            <i class="fas fa-info-circle me-2"></i>
                            Sobre el Método K-means
                        </h6>
                        <p class="mb-2">
                            <strong>K-means es un método de clustering particional:</strong>
                        </p>
                        <ul class="mb-2">
                            <li>Divide los datos en <strong>K grupos</strong> optimizando la distancia a los centroides</li>
                            <li>Algoritmo <strong>iterativo</strong> que minimiza la suma de cuadrados intra-cluster (WSS)</li>
                            <li>Se aplica en el <strong>espacio completo de variables originales</strong> (no en PCA)</li>
                            <li>Produce clusters <strong>esféricos/convexos</strong> alrededor de centroides</li>
                            <li>PCA se usa <strong>solo para visualización 2D</strong> después del clustering</li>
                        </ul>
                        <p class="mb-0 small text-muted">
                            <i class="fas fa-lightbulb me-1"></i>
                            <strong>Nota:</strong> El clustering jerárquico usa un enfoque diferente (aglomerativo) y puede producir resultados distintos.
                        </p>
                    </div>
                    
                    <!-- Métricas de calidad del clustering -->
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Silhouette Score</div>
                                    <div class="h5 mb-0 text-primary fw-bold">${metrics.silhouette_score.toFixed(3)}</div>
                                    <div class="text-muted small">${this.getSilhouetteInterpretation(metrics.silhouette_score)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Calinski-Harabasz</div>
                                    <div class="h5 mb-0 text-info fw-bold">${metrics.calinski_harabasz_score.toFixed(1)}</div>
                                    <div class="text-muted small">Mayor es mejor</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Davies-Bouldin</div>
                                    <div class="h5 mb-0 text-warning fw-bold">${metrics.davies_bouldin_score.toFixed(3)}</div>
                                    <div class="text-muted small">Menor es mejor</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center p-3">
                                    <div class="text-muted small mb-1">Inercia</div>
                                    <div class="h5 mb-0 text-secondary fw-bold">${modelInfo.inertia.toFixed(1)}</div>
                                    <div class="text-muted small">Menor es mejor</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Gráfico de PCA con K-means -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header bg-primary text-white">
                                    <h6 class="mb-0">
                                        <i class="fas fa-chart-scatter me-2"></i>
                                        Visualización PCA con K-means
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="kmeansPCAPlotContainer"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tabla de estadísticas de clústeres -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header bg-info text-white">
                                    <h6 class="mb-0">
                                        <i class="fas fa-table me-2"></i>
                                        Estadísticas de Clústeres
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-striped table-hover">
                                            <thead class="table-dark">
                                                <tr>
                                                    <th class="text-center">Clúster</th>
                                                    <th class="text-center">Tamaño</th>
                                                    <th class="text-center">Porcentaje</th>
                                                    <th class="text-center">Centroide (PC1, PC2)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${clusterStatsTable}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Información del PCA -->
                    <div class="row">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header bg-warning text-dark">
                                    <h6 class="mb-0">
                                        <i class="fas fa-info-circle me-2"></i>
                                        Información del Análisis de Componentes Principales
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-4">
                                            <div class="alert alert-light">
                                                <h6 class="alert-heading">PC1</h6>
                                                <p class="mb-0">
                                                    <strong>Varianza explicada:</strong> ${(results.pca_info.explained_variance_pc1 * 100).toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="alert alert-light">
                                                <h6 class="alert-heading">PC2</h6>
                                                <p class="mb-0">
                                                    <strong>Varianza explicada:</strong> ${(results.pca_info.explained_variance_pc2 * 100).toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="alert alert-light">
                                                <h6 class="alert-heading">Total</h6>
                                                <p class="mb-0">
                                                    <strong>Varianza explicada:</strong> ${(results.pca_info.total_variance_explained * 100).toFixed(1)}%
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
        
        // Crear el gráfico de PCA con K-means
        this.createKmeansPCAPlot(results);
    },

    createKmeansPCAPlot(results) {
        const container = document.getElementById('kmeansPCAPlotContainer');
        if (!container) return;
        
        // Preparar datos para el gráfico
        const traces = [];
        const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
        
        // Agrupar puntos por clúster
        const clusterGroups = {};
        results.pca_data.forEach(point => {
            const cluster = point.cluster;
            if (!clusterGroups[cluster]) {
                clusterGroups[cluster] = [];
            }
            clusterGroups[cluster].push(point);
        });
        
        // Crear trazas para cada clúster
        Object.keys(clusterGroups).forEach((clusterId, index) => {
            const clusterData = clusterGroups[clusterId];
            const color = colors[index % colors.length];
            
            const trace = {
                x: clusterData.map(point => point.pc1),
                y: clusterData.map(point => point.pc2),
                mode: 'markers',
                type: 'scatter',
                name: `Clúster ${clusterId}`,
                marker: {
                    color: color,
                    size: 8,
                    opacity: 0.7
                },
                hovertemplate: '<b>Cluster %{fullData.name}</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>'
            };
            
            traces.push(trace);
            
            // Agregar centroide del clúster
            const clusterStats = results.cluster_stats.find(stat => stat.cluster_id == clusterId);
            if (clusterStats) {
                const centroidTrace = {
                    x: [clusterStats.centroid_pca[0]],
                    y: [clusterStats.centroid_pca[1]],
                    mode: 'markers',
                    type: 'scatter',
                    name: `Centroide ${clusterId}`,
                    marker: {
                        color: color,
                        size: 15,
                        symbol: 'diamond',
                        line: {
                            color: 'white',
                            width: 2
                        }
                    },
                    showlegend: false,
                    hovertemplate: '<b>Cluster %{fullData.name} Centroid</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>'
                };
                
                traces.push(centroidTrace);
            }
        });
        
        // Agregar elipses sombreadas y transparentes si hay suficientes datos
        Object.keys(clusterGroups).forEach((clusterId, index) => {
            const clusterStats = results.cluster_stats.find(stat => stat.cluster_id == clusterId);
            if (clusterStats && clusterStats.size > 2) {
                const color = colors[index % colors.length];
                
                // Crear puntos para la elipse
                const t = Array.from({length: 100}, (_, i) => (2 * Math.PI * i) / 99);
                const a = clusterStats.ellipse_radii[0];
                const b = clusterStats.ellipse_radii[1];
                const angle = clusterStats.ellipse_angle;
                const x0 = clusterStats.centroid_pca[0];
                const y0 = clusterStats.centroid_pca[1];
                
                const x = t.map(t_val => x0 + a * Math.cos(t_val) * Math.cos(angle) - b * Math.sin(t_val) * Math.sin(angle));
                const y = t.map(t_val => y0 + a * Math.cos(t_val) * Math.sin(angle) + b * Math.sin(t_val) * Math.cos(angle));
                
                // Elipse sombreada (área)
                const filledEllipseTrace = {
                    x: x,
                    y: y,
                    mode: 'lines',
                    type: 'scatter',
                    name: `Elipse ${clusterId}`,
                    line: {
                        color: color,
                        width: 0
                    },
                    fill: 'toself',
                    fillcolor: color,
                    opacity: 0.2,
                    showlegend: false,
                    hoverinfo: 'skip'
                };
                
                traces.push(filledEllipseTrace);
                
                // Borde de la elipse
                const borderEllipseTrace = {
                    x: x,
                    y: y,
                    mode: 'lines',
                    type: 'scatter',
                    name: `Borde ${clusterId}`,
                    line: {
                        color: color,
                        width: 2
                    },
                    showlegend: false,
                    hoverinfo: 'skip'
                };
                
                traces.push(borderEllipseTrace);
            }
        });
        
        const layout = {
            title: {
                text: `Visualización PCA con K-means Clustering (K=${results.optimal_k})`,
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: `PC1 (${(results.pca_info.explained_variance_pc1 * 100).toFixed(1)}% variance explained)`,
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: true,
                zerolinecolor: 'rgba(128, 128, 128, 0.5)'
            },
            yaxis: {
                title: {
                    text: `PC2 (${(results.pca_info.explained_variance_pc2 * 100).toFixed(1)}% variance explained)`,
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: true,
                zerolinecolor: 'rgba(128, 128, 128, 0.5)'
            },
            legend: {
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top',
                orientation: 'v',
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            hovermode: 'closest',
            width: null,
            height: 600,
            margin: {
                l: 80,
                r: 120,
                t: 90,
                b: 70
            },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white'
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'kmeans_pca_clustering',
                height: 800,
                width: 1200,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, traces, layout, config);
    },

    getSilhouetteInterpretation(score) {
        if (score >= 0.7) return 'Excelente';
        if (score >= 0.5) return 'Buena';
        if (score >= 0.25) return 'Regular';
        return 'Pobre';
    },

    setupHierarchicalClustering(clusteringResults) {
        
        // Verificar que el dataset esté cargado antes de continuar
        if (!this.selectedDataset) {
            return;
        }
        
        // Verificar que tenemos acceso a los nombres de las columnas
        if (!this.selectedDataset.column_names && !this.selectedDataset.variable_types) {
            return;
        }
        
        
        // Actualizar información en la sección de clustering jerárquico
        const hierarchicalOptimalKDisplay = document.getElementById('hierarchicalOptimalKDisplay');
        const hierarchicalSelectedVariablesDisplay = document.getElementById('hierarchicalSelectedVariablesDisplay');
        
        if (hierarchicalOptimalKDisplay) {
            hierarchicalOptimalKDisplay.textContent = clusteringResults.recommendations.final_recommendation;
        }
        
        if (hierarchicalSelectedVariablesDisplay) {
            hierarchicalSelectedVariablesDisplay.textContent = clusteringResults.variables_used.join(', ');
        }
        
        // Configurar selector de columna de ID
        this.populateIdColumnSelector();
        
        // Configurar event listener para el botón "Generar Dendrogramas"
        const applyHierarchicalBtn = document.getElementById('applyHierarchical');
        if (applyHierarchicalBtn) {
            // Remover event listeners previos
            applyHierarchicalBtn.replaceWith(applyHierarchicalBtn.cloneNode(true));
            const newApplyHierarchicalBtn = document.getElementById('applyHierarchical');
            
            newApplyHierarchicalBtn.addEventListener('click', () => {
                this.executeHierarchicalClustering(clusteringResults);
            });
        }
        
        // Configurar event listener para el botón de información de métodos de enlace
        const linkageInfoBtn = document.getElementById('linkageInfoBtn');
        if (linkageInfoBtn) {
            // Remover event listeners previos
            linkageInfoBtn.replaceWith(linkageInfoBtn.cloneNode(true));
            const newLinkageInfoBtn = document.getElementById('linkageInfoBtn');
            
            newLinkageInfoBtn.addEventListener('click', () => {
                this.showLinkageInfoModal();
            });
        }
        
        // Mostrar la sección de clustering jerárquico
        this.showHierarchicalSection();
    },

    showHierarchicalSection() {
        // Mostrar la sección de clustering jerárquico
        const hierarchicalSection = document.getElementById('hierarchicalSection');
        
        if (hierarchicalSection) {
            hierarchicalSection.style.display = 'block';
        } else {
            const allElements = document.querySelectorAll('[id*="hierarchical"]');
        }
    },

    populateIdColumnSelector() {
        const idColumnSelect = document.getElementById('hierarchicalIdColumn');
        if (!idColumnSelect || !this.selectedDataset) return;
        
        // Obtener column_names del dataset o usar una alternativa
        let columnNames = [];
        if (this.selectedDataset.column_names && Array.isArray(this.selectedDataset.column_names)) {
            columnNames = this.selectedDataset.column_names;
        } else if (this.selectedDataset.variable_types) {
            // Usar las claves de variable_types como alternativa
            columnNames = Object.keys(this.selectedDataset.variable_types);
        } else {
            return;
        }
        
        // Limpiar opciones existentes
        idColumnSelect.innerHTML = '<option value="">Sin columna de ID</option>';
        
        // Agregar todas las columnas del dataset
        columnNames.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            idColumnSelect.appendChild(option);
        });
    },

    async executeHierarchicalClustering(clusteringResults) {
        try {
            const container = document.getElementById('hierarchicalResultsContainer');
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-spinner fa-spin me-2"></i>
                    Generando clustering jerárquico y dendrogramas...
                </div>
            `;
            
            // Obtener columna de ID seleccionada
            const idColumnSelect = document.getElementById('hierarchicalIdColumn');
            const selectedIdColumn = idColumnSelect ? idColumnSelect.value : null;
            
            // Obtener método de enlace seleccionado
            const selectedLinkageMethod = document.querySelector('input[name="linkageMethod"]:checked');
            const linkageMethod = selectedLinkageMethod ? selectedLinkageMethod.value : 'single';
            
            // Llamada al backend para aplicar clustering jerárquico
            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/apply-hierarchical`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    outlier_results: this.outlierResults,
                    variables: clusteringResults.variables_used,
                    optimal_k: clusteringResults.recommendations.final_recommendation,
                    id_column: selectedIdColumn,
                    linkage_method: linkageMethod
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            
            if (results.error) {
                throw new Error(results.error);
            }
            
            this.displayHierarchicalResults(results);
        } catch (error) {
            const container = document.getElementById('hierarchicalResultsContainer');
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> No se pudo generar clustering jerárquico: ${error.message}
                </div>
            `;
        }
    },

    displayHierarchicalResults(results) {
        const container = document.getElementById('hierarchicalResultsContainer');
        if (!container) return;
        
        // Verificar si hay advertencia de datos insuficientes
        let warningHtml = '';
        if (results.status === 'warning_insufficient_data' || results.message) {
            warningHtml = `
                <div class="alert alert-info mb-4">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Información:</strong> ${results.message}
                    <br><br>
                    <strong>Detalles:</strong>
                    <ul class="mb-0">
                        <li>Datos disponibles: ${results.available_data_points} observaciones</li>
                        <li>Mínimo requerido: ${results.minimum_required} observaciones</li>
                    </ul>
                    <br>
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Advertencia:</strong> Con pocas observaciones, los resultados del clustering jerárquico pueden no ser confiables. Se recomienda interpretar los resultados con precaución.
                    </div>
                </div>
            `;
        }
        
        if (results.error) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Error:</strong> ${results.error}
                </div>
            `;
            return;
        }
        
        // Crear tabla de estadísticas de clústeres
        let clusterStatsTable = '';
        results.cluster_stats.forEach(cluster => {
            clusterStatsTable += `
                <tr>
                    <td class="text-center">
                        <span class="badge bg-primary">Clúster ${cluster.cluster_id}</span>
                    </td>
                    <td class="text-center">${cluster.size}</td>
                    <td class="text-center">${cluster.percentage.toFixed(1)}%</td>
                    <td class="text-center">${cluster.centroid_pca[0].toFixed(3)}, ${cluster.centroid_pca[1].toFixed(3)}</td>
                </tr>
            `;
        });
        
        // Crear tabla de métricas de clustering
        const metrics = results.clustering_metrics;
        
        container.innerHTML = `
            ${warningHtml}
            <div class="card">
                <div class="card-header bg-success text-white">
                    <h6 class="mb-0">
                        <i class="fas fa-sitemap me-2"></i>
                        Resultados de Clustering Jerárquico con Visualización PCA
                    </h6>
                </div>
                <div class="card-body">
                    <!-- Banner de información -->
                    <div class="alert alert-success border-start border-success border-4 mb-4">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h6 class="alert-heading mb-2">
                                    <i class="fas fa-check-circle me-2"></i>
                                    Clustering Jerárquico Aplicado Exitosamente
                                </h6>
                                <p class="mb-2">
                                    Se han generado <strong>${results.optimal_k} clústeres</strong> usando el método de enlace <strong>${results.hierarchical_info?.method || 'Ward'}</strong>.
                                    El análisis incluye visualización PCA y dendrogramas para interpretar la estructura jerárquica.
                                </p>
                                ${results.hierarchical_info?.kmeans_optimal_k_received ? `
                                <p class="mb-2 small text-info">
                                    <i class="fas fa-info-circle me-1"></i>
                                    <strong>Nota:</strong> El número de clústeres (k=${results.optimal_k}) se tomó del cálculo óptimo de K-means 
                                    (k=${results.hierarchical_info.kmeans_optimal_k_received}) para asegurar consistencia entre métodos.
                                </p>
                                ` : ''}
                                ${results.hierarchical_info?.evaluation_scores ? `
                                <p class="mb-2 small">
                                    <strong>Métricas del k utilizado:</strong><br>
                                    • Silhouette Score: ${results.hierarchical_info.evaluation_scores.silhouette.toFixed(4)}<br>
                                    • Calinski-Harabasz: ${results.hierarchical_info.evaluation_scores.calinski_harabasz.toFixed(2)}<br>
                                    • Davies-Bouldin: ${results.hierarchical_info.evaluation_scores.davies_bouldin.toFixed(4)}
                                </p>
                                ` : ''}
                                <p class="mb-0 small">
                                    <strong>Varianza explicada por PCA:</strong> ${(results.pca_info.total_variance_explained * 100).toFixed(1)}% (solo para visualización)
                                </p>
                            </div>
                            <div class="col-md-4 text-end">
                                <div class="row">
                                    <div class="col-6">
                                        <div class="text-center">
                                            <div class="h4 mb-0 text-success">${results.sample_size}</div>
                                            <small class="text-muted">Observaciones</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="text-center">
                                            <div class="h4 mb-0 text-primary">${results.variables_used.length}</div>
                                            <small class="text-muted">Variables</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Información sobre el método Clustering Jerárquico -->
                    <div class="alert alert-info mb-4">
                        <h6 class="alert-heading">
                            <i class="fas fa-info-circle me-2"></i>
                            Sobre el Método de Clustering Jerárquico
                        </h6>
                        <p class="mb-2">
                            <strong>El clustering jerárquico es un método aglomerativo:</strong>
                        </p>
                        <ul class="mb-2">
                            <li>Construye un <strong>árbol jerárquico (dendrograma)</strong> uniendo progresivamente los puntos más cercanos</li>
                            <li>Algoritmo <strong>determinista</strong> que crea una estructura de árbol completa</li>
                            <li>Se aplica en el <strong>espacio completo de variables originales</strong> (no en PCA)</li>
                            <li>Puede producir clusters de <strong>cualquier forma</strong> (no solo esféricos)</li>
                            <li>El método de enlace seleccionado (<strong>${results.hierarchical_info?.method || 'Ward'}</strong>) determina cómo se calculan las distancias entre clusters</li>
                            <li>PCA se usa <strong>solo para visualización 2D</strong> después del clustering</li>
                        </ul>
                        <p class="mb-0 small text-muted">
                            <i class="fas fa-lightbulb me-1"></i>
                            <strong>Diferencia clave:</strong> A diferencia de K-means (particional), el clustering jerárquico construye una estructura de árbol que permite ver relaciones a diferentes niveles de agrupación. Los resultados pueden diferir de K-means porque usa un enfoque completamente diferente.
                        </p>
                    </div>
                    
                    <!-- Métricas de Calidad del Clustering -->
                    <div class="row mb-4">
                        <div class="col-md-4">
                            <div class="card text-center border-primary">
                                <div class="card-body">
                                    <div class="text-primary mb-2">
                                        <i class="fas fa-chart-line fa-2x"></i>
                                    </div>
                                    <h5 class="card-title text-primary">${metrics.silhouette_score.toFixed(3)}</h5>
                                    <p class="card-text small">Coeficiente de Silueta</p>
                                    <small class="text-muted">${this.getSilhouetteInterpretation(metrics.silhouette_score)}</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card text-center border-success">
                                <div class="card-body">
                                    <div class="text-success mb-2">
                                        <i class="fas fa-chart-bar fa-2x"></i>
                                    </div>
                                    <h5 class="card-title text-success">${metrics.calinski_harabasz_score.toFixed(1)}</h5>
                                    <p class="card-text small">Índice Calinski-Harabasz</p>
                                    <small class="text-muted">Mayor es mejor</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card text-center border-warning">
                                <div class="card-body">
                                    <div class="text-warning mb-2">
                                        <i class="fas fa-chart-pie fa-2x"></i>
                                    </div>
                                    <h5 class="card-title text-warning">${metrics.davies_bouldin_score.toFixed(3)}</h5>
                                    <p class="card-text small">Índice Davies-Bouldin</p>
                                    <small class="text-muted">Menor es mejor</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tabla de Estadísticas de Clústeres -->
                    <div class="card mb-4">
                        <div class="card-header">
                            <h6 class="mb-0">
                                <i class="fas fa-table me-2"></i>
                                Estadísticas de Clústeres
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-striped table-hover">
                                    <thead class="table-dark">
                                        <tr>
                                            <th class="text-center">Clúster</th>
                                            <th class="text-center">Tamaño</th>
                                            <th class="text-center">Porcentaje</th>
                                            <th class="text-center">Centroide PCA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${clusterStatsTable}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Gráficos -->
                    <div class="row">
                        <div class="col-12 mb-4">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-chart-scatter me-2"></i>
                                        Clustering Jerárquico + Proyección PCA
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="hierarchicalPCAPlotContainer"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Gráfico adicional con Convex Hull -->
                    <div class="row">
                        <div class="col-12 mb-4">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-project-diagram me-2"></i>
                                        Clustering Jerárquico con Proyección PCA (Convex Hull)
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="hierarchicalPCAConvexHullContainer"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Heatmap con Dendrogramas -->
                    <div class="row">
                        <div class="col-12 mb-4">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-th me-2"></i>
                                        Clustered Heatmap with Dendrograms
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div class="alert alert-info mb-3">
                                        <h6 class="alert-heading">
                                            <i class="fas fa-info-circle me-2"></i>
                                            Heatmap Interpretation
                                        </h6>
                                        <p class="mb-0 small">
                                            This heatmap shows variable values (rows) for each observation (columns). 
                                            The dendrograms indicate similarity between observations (top) and between variables (left). 
                                            Colors represent standardized values: low values in purple/dark blue and high values in green/yellow.
                                        </p>
                                    </div>
                                    <div id="hierarchicalHeatmapContainer"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dendrograma de Árbol - Pantalla Completa -->
                    <div class="row">
                        <div class="col-12 mb-4">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-tree me-2"></i>
                                        Dendrograma de Árbol
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="treeDendrogramContainer"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dendrograma Circular - Pantalla Completa -->
                    <div class="row">
                        <div class="col-12 mb-4">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-circle me-2"></i>
                                        Dendrograma Circular
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="circularDendrogramContainer"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dendrograma Filogenético - Pantalla Completa -->
                    <div class="row">
                        <div class="col-12 mb-4">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-dna me-2"></i>
                                        Dendrograma Filogenético
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div class="alert alert-info mb-3">
                                        <h6 class="alert-heading">
                                            <i class="fas fa-info-circle me-2"></i>
                                            Interpretación del Dendrograma Filogenético
                                        </h6>
                                        <p class="mb-0 small">
                                            Este tipo de dendrograma muestra las relaciones jerárquicas en formato de árbol filogenético. 
                                            Las observaciones están distribuidas en un círculo y las ramas se conectan desde el centro hacia afuera, 
                                            mostrando la estructura de clustering de manera similar a un árbol evolutivo.
                                        </p>
                                    </div>
                                    <div id="phylogenicDendrogramContainer"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Crear los gráficos
        this.createHierarchicalPCAPlot(results);
        this.createHierarchicalPCAConvexHullPlot(results);
        this.createHierarchicalHeatmap(results);
        this.createTreeDendrogram(results);
        this.createCircularDendrogram(results);
        this.createPhylogenicDendrogram(results);
    },

    createHierarchicalPCAPlot(results) {
        const container = document.getElementById('hierarchicalPCAPlotContainer');
        if (!container) return;
        
        // Preparar datos para el gráfico
        const traces = [];
        // Paleta de 4 colores para clusters
        const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'];
        
        // Obtener método de enlace seleccionado
        const selectedLinkageMethod = document.querySelector('input[name="linkageMethod"]:checked');
        const linkageMethod = selectedLinkageMethod ? selectedLinkageMethod.value : 'single';
        
        // Mapear método de enlace a nombre en español
        const linkageMethodNames = {
            'single': 'Enlace Sencillo',
            'complete': 'Enlace Completo',
            'average': 'Enlace Promedio',
            'centroid': 'Enlace de Centroide',
            'ward': 'Método de Ward'
        };
        
        const linkageMethodName = linkageMethodNames[linkageMethod] || linkageMethod;
        
        // Agrupar puntos por clúster
        const clusterGroups = {};
        results.pca_data.forEach(point => {
            const cluster = point.cluster;
            if (!clusterGroups[cluster]) {
                clusterGroups[cluster] = [];
            }
            clusterGroups[cluster].push(point);
        });
        
        // Crear trazas para cada clúster
        Object.keys(clusterGroups).forEach((clusterId, index) => {
            const clusterData = clusterGroups[clusterId];
            const color = colors[index % colors.length];
            
            const trace = {
                x: clusterData.map(point => point.pc1),
                y: clusterData.map(point => point.pc2),
                mode: 'markers+text',
                type: 'scatter',
                name: `Clúster ${clusterId}`,
                marker: {
                    color: color,
                    size: 8,
                    opacity: 0.7
                },
                text: clusterData.map(point => point.id || point.original_index),
                textposition: 'top center',
                textfont: {
                    size: 8,
                    color: '#333'
                },
                hovertemplate: '<b>Cluster %{fullData.name}</b><br>ID: %{text}<br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>'
            };
            
            traces.push(trace);
            
            // Agregar centroide del clúster
            const clusterStats = results.cluster_stats.find(stat => stat.cluster_id == clusterId);
            if (clusterStats) {
                const centroidTrace = {
                    x: [clusterStats.centroid_pca[0]],
                    y: [clusterStats.centroid_pca[1]],
                    mode: 'markers',
                    type: 'scatter',
                    name: `Centroide ${clusterId}`,
                    marker: {
                        color: color,
                        size: 15,
                        symbol: 'diamond',
                        line: {
                            color: 'white',
                            width: 2
                        }
                    },
                    showlegend: false,
                    hovertemplate: '<b>Cluster %{fullData.name} Centroid</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>'
                };
                
                traces.push(centroidTrace);
            }
        });
        
        // Agregar elipses sombreadas y transparentes si hay suficientes datos
        Object.keys(clusterGroups).forEach((clusterId, index) => {
            const clusterStats = results.cluster_stats.find(stat => stat.cluster_id == clusterId);
            if (clusterStats && clusterStats.size > 2) {
                const color = colors[index % colors.length];
                
                // Crear puntos para la elipse
                const t = Array.from({length: 100}, (_, i) => (2 * Math.PI * i) / 99);
                const a = clusterStats.ellipse_radii[0];
                const b = clusterStats.ellipse_radii[1];
                const angle = clusterStats.ellipse_angle;
                const x0 = clusterStats.centroid_pca[0];
                const y0 = clusterStats.centroid_pca[1];
                
                const x = t.map(t_val => x0 + a * Math.cos(t_val) * Math.cos(angle) - b * Math.sin(t_val) * Math.sin(angle));
                const y = t.map(t_val => y0 + a * Math.cos(t_val) * Math.sin(angle) + b * Math.sin(t_val) * Math.cos(angle));
                
                // Elipse sombreada (área)
                const filledEllipseTrace = {
                    x: x,
                    y: y,
                    mode: 'lines',
                    type: 'scatter',
                    name: `Elipse ${clusterId}`,
                    line: {
                        color: color,
                        width: 0
                    },
                    fill: 'toself',
                    fillcolor: color,
                    opacity: 0.2,
                    showlegend: false,
                    hoverinfo: 'skip'
                };
                
                traces.push(filledEllipseTrace);
                
                // Borde de la elipse
                const borderEllipseTrace = {
                    x: x,
                    y: y,
                    mode: 'lines',
                    type: 'scatter',
                    name: `Borde ${clusterId}`,
                    line: {
                        color: color,
                        width: 2
                    },
                    showlegend: false,
                    hoverinfo: 'skip'
                };
                
                traces.push(borderEllipseTrace);
            }
        });
        
        const layout = {
            title: {
                text: `Clustering Jerárquico - ${linkageMethodName} (K=${results.optimal_k})`,
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: `PC1 (${(results.pca_info.explained_variance_pc1 * 100).toFixed(1)}% variance explained)`,
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: true,
                zerolinecolor: 'rgba(128, 128, 128, 0.5)'
            },
            yaxis: {
                title: {
                    text: `PC2 (${(results.pca_info.explained_variance_pc2 * 100).toFixed(1)}% variance explained)`,
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: true,
                zerolinecolor: 'rgba(128, 128, 128, 0.5)'
            },
            legend: {
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top',
                orientation: 'v',
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            hovermode: 'closest',
            width: null,
            height: 600,
            margin: {
                l: 80,
                r: 120,
                t: 90,
                b: 70
            },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white'
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'hierarchical_clustering',
                height: 800,
                width: 1200,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, traces, layout, config);
    },

    // Función auxiliar para calcular el convex hull de un conjunto de puntos
    calculateConvexHull(points) {
        if (points.length < 3) {
            // Si hay menos de 3 puntos, devolver los puntos como están
            return points.map(p => ({x: p.pc1, y: p.pc2}));
        }
        
        // Algoritmo de Graham Scan para calcular convex hull
        let pts = points.map(p => ({x: p.pc1, y: p.pc2}));
        
        // Encontrar el punto más bajo (y más a la izquierda si hay empate)
        let bottom = pts[0];
        let bottomIdx = 0;
        for (let i = 1; i < pts.length; i++) {
            if (pts[i].y < bottom.y || (pts[i].y === bottom.y && pts[i].x < bottom.x)) {
                bottom = pts[i];
                bottomIdx = i;
            }
        }
        
        // Mover el punto más bajo al inicio
        [pts[0], pts[bottomIdx]] = [pts[bottomIdx], pts[0]];
        
        // Ordenar puntos por ángulo polar respecto al punto más bajo
        const pivot = pts[0];
        const sortedRest = pts.slice(1).sort((a, b) => {
            const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
            const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
            if (angleA !== angleB) return angleA - angleB;
            // Si tienen el mismo ángulo, ordenar por distancia
            const distA = Math.pow(a.x - pivot.x, 2) + Math.pow(a.y - pivot.y, 2);
            const distB = Math.pow(b.x - pivot.x, 2) + Math.pow(b.y - pivot.y, 2);
            return distA - distB;
        });
        // Reconstruir el array ordenado
        pts = [pts[0], ...sortedRest];
        
        // Algoritmo de Graham Scan
        const hull = [pts[0], pts[1]];
        
        for (let i = 2; i < pts.length; i++) {
            while (hull.length > 1) {
                const p1 = hull[hull.length - 2];
                const p2 = hull[hull.length - 1];
                const p3 = pts[i];
                
                // Calcular producto cruzado para determinar si es un giro a la izquierda
                const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
                if (cross <= 0) {
                    hull.pop();
                } else {
                    break;
                }
            }
            hull.push(pts[i]);
        }
        
        // Cerrar el polígono
        hull.push(hull[0]);
        
        return hull;
    },

    createHierarchicalPCAConvexHullPlot(results) {
        const container = document.getElementById('hierarchicalPCAConvexHullContainer');
        if (!container) return;
        
        // Obtener método de enlace seleccionado
        const selectedLinkageMethod = document.querySelector('input[name="linkageMethod"]:checked');
        const linkageMethod = selectedLinkageMethod ? selectedLinkageMethod.value : (results.hierarchical_info?.linkage_method_used || 'ward');
        
        // Usar el nombre de display del backend si está disponible
        const linkageMethodName = results.hierarchical_info?.linkage_method_display || 
            ({
                'single': 'Single Linkage',
                'complete': 'Complete Linkage',
                'average': 'Average Linkage',
                'centroid': 'Centroid Linkage',
                'ward': 'Ward Method'
            }[linkageMethod] || linkageMethod);
        
        // Preparar datos para el gráfico
        const traces = [];
        
        // Colores y marcadores para cada cluster (similar a la imagen)
        const clusterConfigs = [
            { color: '#FF6B6B', marker: 'circle', name: 'cluster 1' },      // Rojo, círculo
            { color: '#2ecc71', marker: 'triangle-up', name: 'cluster 2' }, // Verde, triángulo
            { color: '#1abc9c', marker: 'square', name: 'cluster 3' },      // Cyan, cuadrado
            { color: '#9b59b6', marker: 'cross', name: 'cluster 4' },      // Púrpura, cruz
            { color: '#f39c12', marker: 'diamond', name: 'cluster 5' },     // Naranja, diamante
            { color: '#3498db', marker: 'star', name: 'cluster 6' },       // Azul, estrella
            { color: '#e74c3c', marker: 'x', name: 'cluster 7' },          // Rojo oscuro, X
            { color: '#16a085', marker: 'pentagon', name: 'cluster 8' }     // Verde azulado, pentágono
        ];
        
        // Agrupar puntos por clúster
        const clusterGroups = {};
        results.pca_data.forEach(point => {
            const cluster = point.cluster;
            if (!clusterGroups[cluster]) {
                clusterGroups[cluster] = [];
            }
            clusterGroups[cluster].push(point);
        });
        
        // Crear trazas para cada clúster
        Object.keys(clusterGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach((clusterId, index) => {
            const clusterData = clusterGroups[clusterId];
            const config = clusterConfigs[index % clusterConfigs.length];
            
            // Calcular convex hull para este cluster
            const convexHull = this.calculateConvexHull(clusterData);
            
            // Traza del polígono convexo (relleno)
            if (convexHull.length >= 3) {
                const hullTrace = {
                    x: convexHull.map(p => p.x),
                    y: convexHull.map(p => p.y),
                    mode: 'lines',
                    type: 'scatter',
                    fill: 'toself',
                    fillcolor: config.color,
                    line: {
                        color: config.color,
                        width: 0
                    },
                    opacity: 0.3,
                    showlegend: false,
                    hoverinfo: 'skip',
                    name: `Hull ${clusterId}`
                };
                traces.push(hullTrace);
            }
            
            // Traza de los puntos del cluster
            const pointTrace = {
                x: clusterData.map(point => point.pc1),
                y: clusterData.map(point => point.pc2),
                mode: 'markers',
                type: 'scatter',
                name: config.name,
                marker: {
                    color: config.color,
                    size: 10,
                    symbol: config.marker,
                    line: {
                        color: 'white',
                        width: 1.5
                    },
                    opacity: 0.9
                },
                text: clusterData.map(point => point.id || `ID ${point.original_index}`),
                hovertemplate: `<b>${config.name}</b><br>ID: %{text}<br>Dim1: %{x:.3f}<br>Dim2: %{y:.3f}<extra></extra>`
            };
            traces.push(pointTrace);
            
            // Traza del borde del convex hull (línea)
            if (convexHull.length >= 3) {
                const hullBorderTrace = {
                    x: convexHull.map(p => p.x),
                    y: convexHull.map(p => p.y),
                    mode: 'lines',
                    type: 'scatter',
                    line: {
                        color: config.color,
                        width: 2
                    },
                    showlegend: false,
                    hoverinfo: 'skip',
                    name: `Border ${clusterId}`
                };
                traces.push(hullBorderTrace);
            }
        });
        
        const layout = {
            title: {
                text: 'Hierarchical Clustering + PCA Projection',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: `Dim1 (${(results.pca_info.explained_variance_pc1 * 100).toFixed(1)}% variance explained)`,
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: true,
                zerolinecolor: 'rgba(128, 128, 128, 0.5)'
            },
            yaxis: {
                title: {
                    text: `Dim2 (${(results.pca_info.explained_variance_pc2 * 100).toFixed(1)}% variance explained)`,
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: true,
                zerolinecolor: 'rgba(128, 128, 128, 0.5)'
            },
            legend: {
                x: 0.5,
                y: -0.15,
                xanchor: 'center',
                yanchor: 'top',
                orientation: 'h',
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            annotations: [
                {
                    text: `Euclidean distance, ${linkageMethodName}, K=${results.optimal_k}`,
                    xref: 'paper',
                    yref: 'paper',
                    x: 0.5,
                    y: 1.02,
                    xanchor: 'center',
                    yanchor: 'bottom',
                    showarrow: false,
                    font: {
                        size: 12,
                        color: '#7f8c8d',
                        style: 'italic'
                    }
                }
            ],
            hovermode: 'closest',
            width: null,
            height: 600,
            margin: {
                l: 80,
                r: 50,
                t: 100,
                b: 100
            },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white'
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'hierarchical_pca_convex_hull',
                height: 800,
                width: 1200,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, traces, layout, config);
    },

    createHierarchicalHeatmap(results) {
        const container = document.getElementById('hierarchicalHeatmapContainer');
        if (!container) return;
        
        if (!results.heatmap_data) {
            container.innerHTML = '<div class="alert alert-warning">Heatmap data not available</div>';
            return;
        }
        
        const heatmapData = results.heatmap_data;
        const observationDendro = heatmapData.observation_dendrogram;
        const variableDendro = heatmapData.variable_dendrogram;
        
        // Obtener método de enlace
        const selectedLinkageMethod = document.querySelector('input[name="linkageMethod"]:checked');
        const linkageMethod = selectedLinkageMethod ? selectedLinkageMethod.value : (results.hierarchical_info?.linkage_method_used || 'ward');
        const linkageMethodName = results.hierarchical_info?.linkage_method_display || 
            ({
                'single': 'Single Linkage',
                'complete': 'Complete Linkage',
                'average': 'Average Linkage',
                'centroid': 'Centroid Linkage',
                'ward': 'Ward Method'
            }[linkageMethod] || linkageMethod);
        
        const nObservations = heatmapData.observation_labels.length;
        const nVariables = heatmapData.variable_labels.length;
        const displayVariableLabels = heatmapData.variable_labels.map(label => this.formatVariableLabel(label));
        
        // Dimensiones de los subplots
        const dendroHeight = 0.15;  // 15% para cada dendrograma
        const dendroWidth = 0.15;   // 15% para el dendrograma de variables
        const heatmapHeight = 0.7;  // 70% para el heatmap
        // El heatmap debe ocupar desde dendroWidth hasta casi el final (dejando espacio mínimo para el colorbar)
        const heatmapRightEdge = 0.92;  // 92% del ancho total (dejando 8% para el colorbar)
        const heatmapWidth = heatmapRightEdge - dendroWidth;  // Ancho del heatmap
        
        const traces = [];
        
        // Crear mapeo de posición de hoja en dendrograma a índice en heatmap
        // Las hojas del dendrograma están en el orden que queremos mostrar
        const observationLeafToIndex = {};
        observationDendro.leaves.forEach((leafIdx, pos) => {
            observationLeafToIndex[leafIdx] = pos;
        });
        
        const variableLeafToIndex = {};
        variableDendro.leaves.forEach((leafIdx, pos) => {
            variableLeafToIndex[leafIdx] = pos;
        });
        
        // 1. Dendrograma de observaciones (columnas) - arriba del heatmap
        // scipy.dendrogram usa coordenadas donde cada hoja está en posiciones 5, 10, 15, etc.
        // Necesitamos mapear estas posiciones a los índices del heatmap usando el orden de las hojas
        observationDendro.icoord.forEach((icoord, i) => {
            const dcoord = observationDendro.dcoord[i];
            
            // Mapear coordenadas x usando el orden de las hojas
            // Las coordenadas de scipy están en unidades donde cada hoja está separada por 10 unidades
            // (5, 15, 25, etc. para las hojas)
            const scaledX = icoord.map(x => {
                // Convertir coordenada de scipy a posición de hoja (0-indexed)
                // Las hojas están en posiciones: 5, 15, 25, ... (5 + i*10)
                const normalized = (x - 5) / 10;
                // Interpolar linealmente entre las posiciones de las hojas
                const pos = Math.max(0, Math.min(nObservations - 1, normalized));
                return pos;
            });
            
            // Escalar alturas al rango del eje Y (sin margen adicional)
            const scaledY = dcoord.map(y => {
                return Math.max(0, Math.min(observationDendro.max_height, y));
            });
            
            traces.push({
                x: scaledX,
                y: scaledY,
                mode: 'lines',
                type: 'scatter',
                line: { color: '#2c3e50', width: 1.5 },
                showlegend: false,
                hoverinfo: 'skip',
                xaxis: 'x',
                yaxis: 'y'
            });
        });
        
        // 2. Dendrograma de variables (filas) - izquierda del heatmap
        // Rotar 90 grados: x del dendrograma -> y del heatmap, y del dendrograma -> x negativo
        variableDendro.icoord.forEach((icoord, i) => {
            const dcoord = variableDendro.dcoord[i];
            
            // Mapear coordenadas y usando el orden de las hojas
            const scaledY = icoord.map(x => {
                // Convertir coordenada de scipy a posición de hoja (0-indexed)
                const normalized = (x - 5) / 10;
                // Interpolar linealmente entre las posiciones de las hojas
                const pos = Math.max(0, Math.min(nVariables - 1, normalized));
                return pos;
            });
            
            // Escalar coordenadas x: negativas hacia la izquierda (sin margen adicional)
            const scaledX = dcoord.map(y => {
                const scaled = -(y / variableDendro.max_height) * variableDendro.max_height;
                return Math.max(-variableDendro.max_height, Math.min(0, scaled));
            });
            
            traces.push({
                x: scaledX,
                y: scaledY,
                mode: 'lines',
                type: 'scatter',
                line: { color: '#2c3e50', width: 1.5 },
                showlegend: false,
                hoverinfo: 'skip',
                xaxis: 'x2',
                yaxis: 'y2'
            });
        });
        
        // 3. Heatmap principal
        // En Plotly heatmap: z es la matriz [filas x columnas]
        // z[i][j] = valor de la variable i en la observación j
        // x son las columnas (observaciones), y son las filas (variables)
        // La matriz debe tener forma [nVariables x nObservations]
        traces.push({
            z: heatmapData.matrix,  // Matriz: filas = variables, columnas = observaciones
            x: Array.from({length: nObservations}, (_, i) => i),  // Índices de observaciones (columnas)
            y: Array.from({length: nVariables}, (_, i) => i),    // Índices de variables (filas)
            type: 'heatmap',
            colorscale: [
                [0, '#440154'],      // Púrpura oscuro (valores bajos)
                [0.25, '#31688e'],   // Azul
                [0.5, '#35b779'],    // Verde
                [0.75, '#fde725'],   // Amarillo (valores altos)
                [1, '#fde725']
            ],
            colorbar: {
                title: {
                    text: 'Standardized<br>Value',
                    side: 'right'
                },
                x: heatmapRightEdge + 0.02,  // Justo después del heatmap
                y: 0.5,
                len: heatmapHeight,  // Misma altura que el heatmap
                thickness: 15,
                xanchor: 'left',
                yanchor: 'middle'
            },
            xaxis: 'x3',
            yaxis: 'y3',
            hovertemplate: '<b>Variable: %{y}</b><br>Observation: %{x}<br>Value: %{z:.3f}<extra></extra>',
            showscale: true
        });
        
        const layout = {
            title: {
                text: 'Clustered Heatmap',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            // Dendrograma de observaciones (arriba)
            xaxis: {
                domain: [dendroWidth, heatmapRightEdge],
                range: [-0.5, nObservations - 0.5],
                showticklabels: false,
                showgrid: false,
                zeroline: false,
                fixedrange: true,
                constrain: 'domain'  // Limitar las líneas al dominio
            },
            yaxis: {
                domain: [1 - dendroHeight, 1],
                range: [0, observationDendro.max_height],
                showticklabels: false,
                showgrid: false,
                zeroline: false,
                title: '',
                fixedrange: true,
                constrain: 'domain'
            },
            // Dendrograma de variables (izquierda)
            xaxis2: {
                domain: [0, dendroWidth],
                range: [-variableDendro.max_height, 0],
                showticklabels: false,
                showgrid: false,
                zeroline: false,
                fixedrange: true,
                constrain: 'domain'
            },
            yaxis2: {
                domain: [0, heatmapHeight],
                range: [-0.5, nVariables - 0.5],
                showticklabels: false,
                showgrid: false,
                zeroline: false,
                fixedrange: true,
                constrain: 'domain'
            },
            // Heatmap principal - debe ocupar todo el espacio entre el dendrograma y el colorbar
            xaxis3: {
                domain: [dendroWidth, heatmapRightEdge],
                range: [-0.5, nObservations - 0.5],
                tickmode: 'array',
                tickvals: Array.from({length: nObservations}, (_, i) => i),
                ticktext: heatmapData.observation_labels,
                tickangle: -90,
                tickfont: { size: 9 },
                side: 'bottom',
                showgrid: false
            },
            yaxis3: {
                domain: [0, heatmapHeight],
                range: [-0.5, nVariables - 0.5],
                tickmode: 'array',
                tickvals: Array.from({length: nVariables}, (_, i) => i),
                ticktext: displayVariableLabels,
                tickfont: { size: 10 },
                side: 'right',
                showgrid: false
            },
            annotations: [
                {
                    text: `Euclidean distance, ${linkageMethodName}`,
                    xref: 'paper',
                    yref: 'paper',
                    x: 0.5,
                    y: 1.02,
                    xanchor: 'center',
                    yanchor: 'bottom',
                    showarrow: false,
                    font: {
                        size: 11,
                        color: '#7f8c8d',
                        style: 'italic'
                    }
                }
            ],
            width: null,
            height: Math.max(600, nVariables * 25 + 200),  // Altura dinámica según número de variables
            margin: {
                l: 150,
                r: 120,  // Espacio para el colorbar
                t: 100,
                b: Math.max(100, nObservations * 3),  // Márgen inferior dinámico según número de observaciones
                pad: 0  // Sin padding adicional
            },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            autosize: true
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'hierarchical_heatmap',
                height: Math.max(800, nVariables * 30 + 300),
                width: Math.max(1200, nObservations * 20 + 300),
                scale: 2
            }
        };
        
        Plotly.newPlot(container, traces, layout, config);
    },

    createTreeDendrogram(results) {
        const container = document.getElementById('treeDendrogramContainer');
        if (!container) return;
        
        const dendrogramData = results.dendrogram_data;
        const optimalK = results.optimal_k;
        
        // Obtener método de enlace seleccionado
        const selectedLinkageMethod = document.querySelector('input[name="linkageMethod"]:checked');
        const linkageMethod = selectedLinkageMethod ? selectedLinkageMethod.value : (results.hierarchical_info?.linkage_method_used || 'ward');
        
        // Usar el nombre de display del backend si está disponible, sino mapear
        const linkageMethodName = results.hierarchical_info?.linkage_method_display || 
            ({
                'single': 'Enlace Sencillo',
                'complete': 'Enlace Completo',
                'average': 'Enlace Promedio',
                'centroid': 'Enlace de Centroide',
                'ward': 'Método de Ward'
            }[linkageMethod] || linkageMethod);
        
        // Obtener labels para el eje X
        const labels = dendrogramData.ivl || [];
        const nLeaves = labels.length;
        
        // Calcular altura máxima y mínima
        const maxHeight = dendrogramData.max_height || Math.max(...dendrogramData.dcoord.flat());
        const minHeight = dendrogramData.min_height || Math.min(...dendrogramData.dcoord.flat());
        
        // Usar la altura de corte calculada en el backend si está disponible
        // Si no, calcular una aproximación (70% de la altura máxima)
        const cutHeight = dendrogramData.cut_height || (maxHeight * 0.7);
        
        // Colores para los clusters (similar a la imagen: rojo/coral y teal/cyan)
        const clusterColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
        
        // Crear trazas para el dendrograma
        const traces = [];
        
        // Mapear cada posición de hoja a su cluster usando el mapeo del backend
        const leafPositionToCluster = dendrogramData.leaf_position_to_cluster || {};
        
        // Si no hay mapeo del backend, crearlo desde pca_data
        if (Object.keys(leafPositionToCluster).length === 0 && results.pca_data) {
            results.pca_data.forEach(point => {
                const leafPos = dendrogramData.leaves.indexOf(point.original_index);
                if (leafPos !== -1) {
                    leafPositionToCluster[leafPos] = point.cluster;
                }
            });
        }
        
        // Función para determinar el color de una rama basándose en sus hojas
        const getBranchColor = (icoord, dcoord) => {
            const maxDcoord = Math.max(...dcoord);
            const minDcoord = Math.min(...dcoord);
            
            // Si está por debajo de la altura de corte, colorear según cluster
            if (maxDcoord <= cutHeight) {
                // Obtener las posiciones de las hojas en esta rama (las posiciones x)
                const xPositions = [icoord[0], icoord[1], icoord[2], icoord[3]];
                const minX = Math.min(...xPositions);
                const maxX = Math.max(...xPositions);
                
                // Encontrar los clusters de las hojas en este rango
                const clustersInBranch = new Set();
                for (let pos = Math.floor(minX); pos <= Math.ceil(maxX); pos++) {
                    const leafPos = pos - 1; // Ajustar porque las posiciones empiezan en 1
                    if (leafPos >= 0 && leafPos < nLeaves && leafPositionToCluster[leafPos] !== undefined) {
                        clustersInBranch.add(leafPositionToCluster[leafPos]);
                    }
                }
                
                // Si todas las hojas pertenecen al mismo cluster, usar ese color
                if (clustersInBranch.size === 1) {
                    const clusterId = Array.from(clustersInBranch)[0];
                    return clusterColors[clusterId % clusterColors.length];
                }
                
                // Si hay múltiples clusters, usar el cluster más común o el primero
                if (clustersInBranch.size > 0) {
                    const clusterId = Array.from(clustersInBranch)[0];
                    return clusterColors[clusterId % clusterColors.length];
                }
                
                // Fallback: usar color basado en posición promedio
                const avgPosition = (minX + maxX) / 2;
                const clusterIdx = Math.floor(avgPosition / (nLeaves / optimalK)) % optimalK;
                return clusterColors[clusterIdx % clusterColors.length];
            }
            
            // Por encima de la altura de corte, usar color gris oscuro
            return '#2c3e50';
        };
        
        dendrogramData.icoord.forEach((icoord, i) => {
            const dcoord = dendrogramData.dcoord[i];
            const color = getBranchColor(icoord, dcoord);
            
            const trace = {
                x: icoord,
                y: dcoord,
                mode: 'lines',
                type: 'scatter',
                line: {
                    color: color,
                    width: 2.5
                },
                showlegend: false,
                hoverinfo: 'skip'
            };
            
            traces.push(trace);
        });
        
        // Calcular el rango de coordenadas X del dendrograma
        // scipy.dendrogram usa coordenadas donde las hojas están en 5, 15, 25, ... (5 + i*10)
        const allIcoord = dendrogramData.icoord.flat();
        const minX = Math.min(...allIcoord);
        const maxX = Math.max(...allIcoord);
        
        // Agregar línea de corte horizontal punteada negra que se extienda a todo el ancho
        const cutLineTrace = {
            x: [minX, maxX],
            y: [cutHeight, cutHeight],
            mode: 'lines',
            type: 'scatter',
            line: {
                color: '#000000',
                width: 2,
                dash: 'dash'
            },
            name: `Corte para K=${optimalK}`,
            showlegend: false,
            hoverinfo: 'skip'
        };
        traces.push(cutLineTrace);
        
        // Preparar ticks del eje X usando las posiciones reales de las hojas
        // Las hojas están en posiciones: 5, 15, 25, ... (5 + i*10)
        const tickVals = Array.from({length: nLeaves}, (_, i) => 5 + i * 10);
        const tickTexts = labels.length === nLeaves ? labels : tickVals.map((val, i) => `ID ${i + 1}`);
        
        const layout = {
            title: {
                text: 'Hierarchical clustering',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: '',
                tickmode: 'array',
                tickvals: tickVals,
                ticktext: tickTexts,
                tickangle: -90,
                showgrid: false,
                zeroline: false,
                tickfont: { size: 10 },
                side: 'bottom',
                range: [minX - 2, maxX + 2]  // Asegurar que todo el dendrograma sea visible
            },
            yaxis: {
                title: {
                    text: 'Height',
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: false,
                range: [Math.max(0, minHeight * 0.95), maxHeight * 1.05]
            },
            annotations: [
                {
                    text: `Euclidean distance, ${linkageMethodName}, K=${optimalK}`,
                    xref: 'paper',
                    yref: 'paper',
                    x: 0.5,
                    y: 1.02,
                    xanchor: 'center',
                    yanchor: 'bottom',
                    showarrow: false,
                    font: {
                        size: 12,
                        color: '#7f8c8d',
                        style: 'italic'
                    }
                }
            ],
            hovermode: 'closest',
            width: null,
            height: Math.max(800, nLeaves * 15),  // Altura dinámica según número de hojas
            margin: {
                l: 80,
                r: 50,
                t: 100,
                b: Math.max(200, nLeaves * 8)  // Más espacio para labels rotados
            },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white'
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'dendrogram',
                height: 800,
                width: 1200,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, traces, layout, config);
    },

    createCircularDendrogram(results) {
        const container = document.getElementById('circularDendrogramContainer');
        if (!container) return;
        
        const dendrogramData = results.dendrogram_data;
        
        // Crear trazas para el dendrograma circular
        const traces = [];
        
        // Calcular el número total de hojas
        const n_leaves = dendrogramData.leaves.length;
        const max_distance = Math.max(...dendrogramData.dcoord.flat());
        
        // Crear coordenadas circulares para las hojas
        const leaf_angles = [];
        for (let i = 0; i < n_leaves; i++) {
            leaf_angles.push((i / n_leaves) * 2 * Math.PI);
        }
        
        // Crear mapeo de índices de hojas a ángulos
        const leaf_to_angle = {};
        dendrogramData.leaves.forEach((leaf_idx, i) => {
            leaf_to_angle[leaf_idx] = leaf_angles[i];
        });
        
        // Procesar cada línea del dendrograma
        dendrogramData.icoord.forEach((icoord, i) => {
            const dcoord = dendrogramData.dcoord[i];
            const color = dendrogramData.color_list && dendrogramData.color_list[i] ? dendrogramData.color_list[i] : '#1f77b4';
            
            // Convertir coordenadas lineales a coordenadas circulares
            const x_coords = [];
            const y_coords = [];
            
            icoord.forEach((x, j) => {
                const y = dcoord[j];
                
                // Encontrar el ángulo correspondiente a esta posición x
                const normalized_x = x / Math.max(...dendrogramData.icoord.flat());
                const angle = normalized_x * 2 * Math.PI;
                
                // Convertir a coordenadas cartesianas
                const radius = 1 - (y / max_distance);
                const cart_x = radius * Math.cos(angle);
                const cart_y = radius * Math.sin(angle);
                
                x_coords.push(cart_x);
                y_coords.push(cart_y);
            });
            
            const trace = {
                x: x_coords,
                y: y_coords,
                mode: 'lines',
                type: 'scatter',
                line: {
                    color: color,
                    width: 2
                },
                showlegend: false,
                hoverinfo: 'skip'
            };
            
            traces.push(trace);
        });
        
        // Añadir puntos para las hojas
        const leaf_x = [];
        const leaf_y = [];
        const leaf_text = [];
        
        dendrogramData.leaves.forEach((leaf_idx, i) => {
            const angle = leaf_angles[i];
            const x = Math.cos(angle);
            const y = Math.sin(angle);
            
            leaf_x.push(x);
            leaf_y.push(y);
            leaf_text.push(`Hoja ${leaf_idx + 1}`);
        });
        
        // Traza para las hojas
        const leaf_trace = {
            x: leaf_x,
            y: leaf_y,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 6,
                color: '#333',
                symbol: 'circle'
            },
            text: leaf_text,
            hoverinfo: 'text',
            showlegend: false
        };
        
        traces.push(leaf_trace);
        
        // Añadir etiquetas de ID en la circunferencia
        if (results.pca_data && results.pca_data.length > 0) {
            const id_labels_x = [];
            const id_labels_y = [];
            const id_labels_text = [];
            
            // Crear mapeo de índices originales a datos PCA
            const index_to_pca = {};
            results.pca_data.forEach((point, idx) => {
                index_to_pca[point.original_index] = point;
            });
            
            dendrogramData.leaves.forEach((leaf_idx, i) => {
                const angle = leaf_angles[i];
                // Posición en la circunferencia exterior
                const radius = 1.1;
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                
                id_labels_x.push(x);
                id_labels_y.push(y);
                
                // Obtener el ID del punto correspondiente
                const pca_point = index_to_pca[leaf_idx];
                let label_text = `ID ${leaf_idx}`;
                if (pca_point && pca_point.id) {
                    label_text = pca_point.id;
                }
                
                id_labels_text.push(label_text);
            });
            
            // Traza para las etiquetas de ID
            const id_labels_trace = {
                x: id_labels_x,
                y: id_labels_y,
                mode: 'text',
                type: 'scatter',
                text: id_labels_text,
                textposition: 'middle center',
                textfont: {
                    size: 10,
                    color: '#333'
                },
                showlegend: false,
                hoverinfo: 'text'
            };
            
            traces.push(id_labels_trace);
        }
        
        const layout = {
            title: {
                text: 'Dendrograma Circular',
                font: { size: 14 }
            },
            xaxis: {
                title: '',
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-1.3, 1.3]
            },
            yaxis: {
                title: '',
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-1.3, 1.3],
                scaleanchor: 'x',
                scaleratio: 1
            },
            showlegend: false,
            width: null,
            height: 800,  // Pantalla completa
            margin: {
                l: 80,
                r: 80,
                t: 80,
                b: 80
            },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white'
        };
        
        Plotly.newPlot(container, traces, layout, {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true
        });
    },

    createPhylogenicDendrogram(results) {
        const container = document.getElementById('phylogenicDendrogramContainer');
        if (!container) return;
        
        const dendrogramData = results.dendrogram_data;
        const optimalK = results.optimal_k;
        
        // Obtener método de enlace seleccionado
        const selectedLinkageMethod = document.querySelector('input[name="linkageMethod"]:checked');
        const linkageMethod = selectedLinkageMethod ? selectedLinkageMethod.value : (results.hierarchical_info?.linkage_method_used || 'ward');
        const linkageMethodName = results.hierarchical_info?.linkage_method_display || 
            ({
                'single': 'Enlace Sencillo',
                'complete': 'Enlace Completo',
                'average': 'Enlace Promedio',
                'centroid': 'Enlace de Centroide',
                'ward': 'Método de Ward'
            }[linkageMethod] || linkageMethod);
        
        // Obtener labels para las hojas
        const labels = dendrogramData.ivl || [];
        const nLeaves = labels.length;
        const maxDistance = Math.max(...dendrogramData.dcoord.flat());
        const cutHeight = dendrogramData.cut_height || (maxDistance * 0.7);
        
        // Colores para los clusters (similar a fviz_dend)
        const clusterColors = ['#2E9FDF', '#00AFBB', '#E7B800', '#FC4E07', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
        
        // Crear mapeo de posición de hoja a cluster
        const leafPositionToCluster = dendrogramData.leaf_position_to_cluster || {};
        if (Object.keys(leafPositionToCluster).length === 0 && results.pca_data) {
            results.pca_data.forEach(point => {
                const leafPos = dendrogramData.leaves.indexOf(point.original_index);
                if (leafPos !== -1) {
                    leafPositionToCluster[leafPos] = point.cluster;
                }
            });
        }
        
        // Calcular ángulos para las hojas distribuidas uniformemente en el círculo
        const leafAngles = [];
        for (let i = 0; i < nLeaves; i++) {
            leafAngles.push((i / nLeaves) * 2 * Math.PI - Math.PI / 2); // Empezar desde arriba
        }
        
        // Crear mapeo de coordenadas X del dendrograma a índices de hojas
        // Las coordenadas de scipy están en el rango donde las hojas están en 5, 15, 25, ...
        const coordToLeafIndex = (x) => {
            const leafPos = (x - 5) / 10;
            return Math.max(0, Math.min(nLeaves - 1, Math.round(leafPos)));
        };
        
        // Calcular radio base para las hojas (en el perímetro del círculo)
        const leafRadius = 1.0;
        const centerRadius = 0.0; // Empezar desde el centro
        
        // Función para calcular el radio basado en la altura del dendrograma
        // Altura mayor = más cerca del centro, altura menor = más cerca del perímetro
        const getRadius = (height) => {
            if (height === 0) return leafRadius; // Hojas en el perímetro
            const normalizedHeight = height / maxDistance;
            return centerRadius + (leafRadius - centerRadius) * (1 - normalizedHeight);
        };
        
        // Función para calcular el ángulo promedio de múltiples hojas
        const getAverageAngle = (icoord) => {
            const angles = [];
            icoord.forEach(x => {
                const leafIdx = coordToLeafIndex(x);
                angles.push(leafAngles[leafIdx]);
            });
            
            // Calcular ángulo promedio considerando la circularidad
            let sinSum = 0;
            let cosSum = 0;
            angles.forEach(angle => {
                sinSum += Math.sin(angle);
                cosSum += Math.cos(angle);
            });
            return Math.atan2(sinSum / angles.length, cosSum / angles.length);
        };
        
        // Función para determinar el color de una rama
        const getBranchColor = (icoord, dcoord) => {
            const maxDcoord = Math.max(...dcoord);
            
            if (maxDcoord <= cutHeight) {
                // Encontrar las posiciones de las hojas en esta rama
                const leafIndices = new Set();
                icoord.forEach(x => {
                    const leafIdx = coordToLeafIndex(x);
                    leafIndices.add(leafIdx);
                });
                
                // Encontrar los clusters de las hojas
                const clustersInBranch = new Set();
                leafIndices.forEach(leafIdx => {
                    if (leafPositionToCluster[leafIdx] !== undefined) {
                        clustersInBranch.add(leafPositionToCluster[leafIdx]);
                    }
                });
                
                if (clustersInBranch.size === 1) {
                    const clusterId = Array.from(clustersInBranch)[0];
                    return clusterColors[clusterId % clusterColors.length];
                }
                
                if (clustersInBranch.size > 0) {
                    const clusterId = Array.from(clustersInBranch)[0];
                    return clusterColors[clusterId % clusterColors.length];
                }
            }
            
            return '#2E9FDF'; // Azul por defecto para ramas por encima del corte
        };
        
        // Construir mapeo de nodos internos a sus posiciones
        // Un nodo interno se identifica por su coordenada X en el dendrograma
        const nodePositions = new Map(); // Map<coordX, {angle, radius}>
        
        // Inicializar posiciones de las hojas
        dendrogramData.leaves.forEach((leafIdx, i) => {
            const coordX = 5 + i * 10; // Posición de la hoja en el dendrograma
            nodePositions.set(coordX, {
                angle: leafAngles[i],
                radius: leafRadius
            });
        });
        
        // Ordenar las fusiones por altura (de menor a mayor) para construir desde las hojas hacia el centro
        const merges = dendrogramData.icoord.map((icoord, i) => ({
            icoord: icoord,
            dcoord: dendrogramData.dcoord[i],
            height: Math.max(...dendrogramData.dcoord[i]),
            index: i
        })).sort((a, b) => a.height - b.height);
        
        const traces = [];
        
        // Dibujar las ramas del dendrograma en formato árbol filogenético
        merges.forEach((merge, mergeIdx) => {
            const {icoord, dcoord} = merge;
            const color = getBranchColor(icoord, dcoord);
            
            // Los dos primeros puntos son los hijos
            const child1X = icoord[0];
            const child2X = icoord[1];
            
            // Obtener posiciones de los hijos (pueden ser hojas o nodos internos ya calculados)
            let child1Pos = nodePositions.get(child1X);
            let child2Pos = nodePositions.get(child2X);
            
            // Si no están en el mapa, son nodos internos que aún no se han calculado
            // Esto no debería pasar si ordenamos correctamente, pero por seguridad:
            if (!child1Pos) {
                // Buscar el nodo más cercano o usar el ángulo promedio
                const leafIdx = coordToLeafIndex(child1X);
                child1Pos = {
                    angle: leafAngles[leafIdx],
                    radius: getRadius(dcoord[0])
                };
                nodePositions.set(child1X, child1Pos);
            }
            
            if (!child2Pos) {
                const leafIdx = coordToLeafIndex(child2X);
                child2Pos = {
                    angle: leafAngles[leafIdx],
                    radius: getRadius(dcoord[1])
                };
                nodePositions.set(child2X, child2Pos);
            }
            
            // Calcular posición del nodo padre (promedio de ángulos de los hijos, radio según altura)
            const parentAngle = getAverageAngle([icoord[0], icoord[1]]);
            const parentRadius = getRadius(dcoord[2]);
            
            // Guardar posición del nodo padre para futuras fusiones
            const parentX = icoord[2]; // Usar la coordenada X del padre
            nodePositions.set(parentX, {
                angle: parentAngle,
                radius: parentRadius
            });
            
            // Convertir a coordenadas cartesianas
            const child1CartX = child1Pos.radius * Math.cos(child1Pos.angle);
            const child1CartY = child1Pos.radius * Math.sin(child1Pos.angle);
            
            const child2CartX = child2Pos.radius * Math.cos(child2Pos.angle);
            const child2CartY = child2Pos.radius * Math.sin(child2Pos.angle);
            
            const parentCartX = parentRadius * Math.cos(parentAngle);
            const parentCartY = parentRadius * Math.sin(parentAngle);
            
            // Dibujar línea desde hijo 1 al padre
            traces.push({
                x: [child1CartX, parentCartX],
                y: [child1CartY, parentCartY],
                mode: 'lines',
                type: 'scatter',
                line: {
                    color: color,
                    width: 2.5
                },
                showlegend: false,
                hoverinfo: 'skip'
            });
            
            // Dibujar línea desde hijo 2 al padre
            traces.push({
                x: [child2CartX, parentCartX],
                y: [child2CartY, parentCartY],
                mode: 'lines',
                type: 'scatter',
                line: {
                    color: color,
                    width: 2.5
                },
                showlegend: false,
                hoverinfo: 'skip'
            });
        });
        
        // Dibujar las hojas (puntos en el perímetro)
        const leafX = [];
        const leafY = [];
        const leafText = [];
        const leafColors = [];
        
        dendrogramData.leaves.forEach((leafIdx, i) => {
            const angle = leafAngles[i];
            const x = leafRadius * Math.cos(angle);
            const y = leafRadius * Math.sin(angle);
            
            leafX.push(x);
            leafY.push(y);
            
            // Obtener el label
            let labelText = labels[i] || `ID ${leafIdx}`;
            if (results.pca_data) {
                const pcaPoint = results.pca_data.find(p => p.original_index === leafIdx);
                if (pcaPoint && pcaPoint.id) {
                    labelText = pcaPoint.id;
                }
            }
            leafText.push(labelText);
            
            // Color según cluster
            const clusterId = leafPositionToCluster[i];
            const color = clusterId !== undefined ? clusterColors[clusterId % clusterColors.length] : '#2c3e50';
            leafColors.push(color);
        });
        
        // Traza para las hojas
        traces.push({
            x: leafX,
            y: leafY,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 8,
                color: leafColors,
                line: { color: 'white', width: 1 }
            },
            text: leafText,
            textposition: 'middle center',
            textfont: { size: 9 },
            showlegend: false,
            hoverinfo: 'text'
        });
        
        // Añadir etiquetas de texto alrededor del círculo
        const labelX = [];
        const labelY = [];
        const labelText = [];
        
        dendrogramData.leaves.forEach((leafIdx, i) => {
            const angle = leafAngles[i];
            const radius = 1.15; // Ligeramente fuera del círculo de hojas
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            
            labelX.push(x);
            labelY.push(y);
            
            let label = labels[i] || `ID ${leafIdx}`;
            if (results.pca_data) {
                const pcaPoint = results.pca_data.find(p => p.original_index === leafIdx);
                if (pcaPoint && pcaPoint.id) {
                    label = pcaPoint.id;
                }
            }
            labelText.push(label);
        });
        
        traces.push({
            x: labelX,
            y: labelY,
            mode: 'text',
            type: 'scatter',
            text: labelText,
            textposition: 'middle center',
            textfont: {
                size: 9,
                color: '#333'
            },
            showlegend: false,
            hoverinfo: 'skip'
        });
        
        const layout = {
            title: {
                text: 'Phylogenetic Dendrogram',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            annotations: [
                {
                    text: `Euclidean distance, ${linkageMethodName}, K=${optimalK}`,
                    xref: 'paper',
                    yref: 'paper',
                    x: 0.5,
                    y: 1.02,
                    xanchor: 'center',
                    yanchor: 'bottom',
                    showarrow: false,
                    font: {
                        size: 12,
                        color: '#7f8c8d',
                        style: 'italic'
                    }
                }
            ],
            xaxis: {
                title: '',
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-1.4, 1.4],
                scaleanchor: 'y',
                scaleratio: 1
            },
            yaxis: {
                title: '',
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-1.4, 1.4]
            },
            showlegend: false,
            width: null,
            height: 800,
            margin: {
                l: 80,
                r: 80,
                t: 100,
                b: 80
            },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white'
        };
        
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'phylogenic_dendrogram',
                height: 800,
                width: 800,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, traces, layout, config);
    },

    showLinkageInfoModal() {
        const modal = new bootstrap.Modal(document.getElementById('linkageInfoModal'));
        modal.show();
    },

    // Funciones para Validación de Clustering
    setupClusteringValidation() {
        
        // Asegurar que el expander esté cerrado
        this.ensureValidationExpanderClosed();
        
        // Mostrar la sección de validación
        this.showClusteringValidationSection();
        
        // Poblar el selector de variables
        this.populateValidationVariablesSelector();
        
        // Configurar event listeners
        this.setupClusteringValidationEventListeners();
        
    },

    ensureValidationExpanderClosed() {
        const validationSection = document.getElementById('clusteringValidationResults');
        const validationButton = document.getElementById('clusteringValidationHeader');
        
        if (validationSection && validationButton) {
            // Asegurar que el expander esté cerrado
            validationSection.classList.remove('show');
            validationButton.querySelector('.accordion-button').classList.add('collapsed');
            validationButton.querySelector('.accordion-button').setAttribute('aria-expanded', 'false');
        }
    },

    showClusteringValidationSection() {
        const validationSection = document.getElementById('clusteringValidationResults');
        if (validationSection) {
        } else {
        }
    },

    populateValidationVariablesSelector() {
        const selector = document.getElementById('validationVariables');
        if (!selector) {
            return;
        }


        // Limpiar opciones existentes
        selector.innerHTML = '<option value="">-- Selecciona variables numéricas --</option>';

        // Obtener variables numéricas del dataset actual
        if (this.currentDatasetInfo && this.currentDatasetInfo.variable_types) {
            const numericalVars = [];
            for (const [varName, varType] of Object.entries(this.currentDatasetInfo.variable_types)) {
                if (varType && varType.startsWith('cuantitativa')) {
                    numericalVars.push(varName);
                }
            }
            
            
            // Agregar variables numéricas al selector
            numericalVars.forEach(variable => {
                const option = document.createElement('option');
                option.value = variable;
                option.textContent = variable;
                selector.appendChild(option);
            });
            
        } else {
        }
    },

    setupClusteringValidationEventListeners() {
        const runButton = document.getElementById('runClusteringValidation');
        if (runButton) {
            runButton.addEventListener('click', () => {
                this.executeClusteringValidation();
            });
        } else {
        }
    },

    async executeClusteringValidation() {
        try {
            const variablesSelector = document.getElementById('validationVariables');
            const selectedVariables = Array.from(variablesSelector.selectedOptions).map(option => option.value);

            // Validaciones
            if (selectedVariables.length === 0) {
                this.showValidationError('Por favor selecciona al menos 2 variables numéricas.');
                return;
            }

            if (selectedVariables.length < 2) {
                this.showValidationError('Se requieren al menos 2 variables numéricas para la validación de clustering.');
                return;
            }

            // Verificar que hay un dataset cargado
            if (!this.currentDatasetInfo || !this.outlierResults) {
                this.showValidationError('No hay un dataset con outliers cargado. Por favor ejecuta primero la detección de outliers.');
                return;
            }

            // Mostrar loading
            const container = document.getElementById('clusteringValidationResultsContainer');
            container.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2">Analizando tendencia de clustering...</p>
                </div>
            `;

            // Realizar petición al backend
            const response = await fetch(`/api/analyze-viz/${this.currentDatasetInfo.filename}/validate-clustering`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    variables: selectedVariables,
                    outlier_results: this.outlierResults || {}
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error en la validación de clustering');
            }

            const results = await response.json();
            this.displayClusteringValidationResults(results);

        } catch (error) {
            this.showValidationError(`Error: ${error.message}`);
        }
    },

    displayClusteringValidationResults(results) {
        const container = document.getElementById('clusteringValidationResultsContainer');
        if (!container) return;

        if (results.error) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error: ${results.error}
                </div>
            `;
            return;
        }

        // Verificar si hay advertencia de datos insuficientes
        let warningHtml = '';
        if (results.status === 'warning_insufficient_data' || results.message) {
            warningHtml = `
                <div class="alert alert-info mb-4">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Información:</strong> ${results.message}
                    <br><br>
                    <strong>Detalles:</strong>
                    <ul class="mb-0">
                        <li>Datos disponibles: ${results.available_data_points} observaciones</li>
                        <li>Mínimo requerido: ${results.minimum_required} observaciones</li>
                    </ul>
                    <br>
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Advertencia:</strong> Con pocas observaciones, los resultados de la validación de clustering pueden no ser confiables. Se recomienda interpretar los resultados con precaución.
                    </div>
                </div>
            `;
        }

        // Crear contenido de resultados
        container.innerHTML = `
            ${warningHtml}
            <div class="row">
                <div class="col-12">
                    <div class="card border-success mb-3">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0">
                                <i class="fas fa-chart-line me-2"></i>
                                Resultados de la Validación de Clustering
                            </h6>
                        </div>
                        <div class="card-body">
                            <!-- Estadísticas del Hopkins Statistic -->
                            <div class="row mb-3">
                                <div class="col-md-4">
                                    <div class="card border-primary">
                                        <div class="card-body text-center">
                                            <h4 class="text-primary">${results.hopkins_statistic.toFixed(4)}</h4>
                                            <p class="mb-0">
                                                <strong>Hopkins Statistic</strong>
                                                <button type="button" class="btn btn-sm btn-outline-primary ms-2" 
                                                        data-bs-toggle="modal" data-bs-target="#hopkinsInfoModal">
                                                    <i class="fas fa-info-circle"></i>
                                                </button>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card border-success">
                                        <div class="card-body text-center">
                                            <h4 class="text-success">${results.clustering_tendency}</h4>
                                            <p class="mb-0"><strong>Tendencia de Clustering</strong></p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card border-info">
                                        <div class="card-body text-center">
                                            <h4 class="text-info">${results.sample_size}</h4>
                                            <p class="mb-0"><strong>Tamaño de Muestra</strong></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Información del Clustering Automático -->
                            <div class="row mb-3">
                                <div class="col-12">
                                    <div class="card border-warning">
                                        <div class="card-header bg-warning text-dark">
                                            <h6 class="mb-0">
                                                <i class="fas fa-robot me-2"></i>
                                                Clustering Automático para Visualización
                                            </h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="row">
                                                <div class="col-md-3">
                                                    <div class="text-center">
                                                        <h5 class="text-warning">${results.clustering_info.optimal_k}</h5>
                                                        <p class="mb-0"><strong>Clusters Óptimos</strong></p>
                                                    </div>
                                                </div>
                                                <div class="col-md-3">
                                                    <div class="text-center">
                                                        <h5 class="text-warning">${results.clustering_info.clusters_generated}</h5>
                                                        <p class="mb-0"><strong>Clusters Generados</strong></p>
                                                    </div>
                                                </div>
                                                <div class="col-md-6">
                                                    <p class="mb-0"><strong>Distribución de Clusters:</strong></p>
                                                    <div class="d-flex flex-wrap gap-2">
                                                        ${Object.entries(results.clustering_info.cluster_distribution).map(([cluster, count]) => 
                                                            `<span class="badge bg-warning text-dark">${cluster}: ${count}</span>`
                                                        ).join('')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="mt-2">
                                                <small class="text-muted">
                                                    <i class="fas fa-info-circle me-1"></i>
                                                    Se aplicó clustering automático (K-means) para colorear los puntos del dataset real y visualizar la estructura de grupos.
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Interpretación -->
                            <div class="alert alert-info">
                                <h6 class="alert-heading">
                                    <i class="fas fa-lightbulb me-2"></i>
                                    Interpretación
                                </h6>
                                <p class="mb-0">${results.interpretation}</p>
                            </div>

                            <!-- Gráfico de comparación PCA -->
                            <div class="row mb-4">
                                <div class="col-12">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6 class="mb-0">
                                                <i class="fas fa-chart-scatter me-2"></i>
                                                Comparación Visual PCA: Dataset Real vs. Simulado
                                            </h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="clusteringValidationPlotContainer"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Gráfico VAT (Visual Assessment of Cluster Tendency) -->
                            <div class="row">
                                <div class="col-12">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6 class="mb-0">
                                                <i class="fas fa-th me-2"></i>
                                                Visual Assessment of Cluster Tendency (VAT): Matrices de Distancia Reordenadas
                                            </h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="alert alert-info mb-3">
                                                <h6 class="alert-heading">
                                                    <i class="fas fa-info-circle me-2"></i>
                                                    Interpretación del VAT
                                                </h6>
                                                <p class="mb-0">
                                                    <strong>Dataset Real:</strong> Si hay patrones de clustering, se observarán bloques oscuros (distancias pequeñas) en la diagonal, indicando grupos naturales.<br>
                                                    <strong>Dataset Simulado:</strong> Sin estructura de clustering, la matriz mostrará un patrón más uniforme sin bloques definidos.
                                                </p>
                                            </div>
                                            <div id="vatPlotContainer"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Crear el gráfico de comparación PCA
        this.createClusteringValidationPlot(results);
        
        // Crear el gráfico VAT si los datos están disponibles
        if (results.vat_data) {
            this.createVATPlot(results.vat_data);
        }
        
        // Agregar modal de información del Hopkins Statistic
        this.addHopkinsInfoModal();
    },

    showValidationError(message) {
        const container = document.getElementById('clusteringValidationResultsContainer');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Validación:</strong> ${message}
                </div>
            `;
        }
    },

    addHopkinsInfoModal() {
        // Verificar si el modal ya existe
        if (document.getElementById('hopkinsInfoModal')) {
            return;
        }
        
        // Crear el modal
        const modalHTML = `
            <div class="modal fade" id="hopkinsInfoModal" tabindex="-1" aria-labelledby="hopkinsInfoModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title" id="hopkinsInfoModalLabel">
                                <i class="fas fa-chart-line me-2"></i>
                                Estadístico Hopkins
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-12">
                                    <div class="alert alert-info">
                                        <h6 class="alert-heading">
                                            <i class="fas fa-lightbulb me-2"></i>
                                            ¿Qué es el Estadístico Hopkins?
                                        </h6>
                                        <p class="mb-0">
                                            El estadístico Hopkins permite evaluar la tendencia de clustering de un conjunto de datos 
                                            mediante el cálculo de la probabilidad de que dichos datos procedan de una distribución uniforme.
                                        </p>
                                    </div>
                                    
                                    <h6 class="text-primary">
                                        <i class="fas fa-calculator me-2"></i>
                                        Cálculo del Estadístico
                                    </h6>
                                    <p>
                                        El estadístico Hopkins (H) se calcula como:
                                    </p>
                                    <div class="text-center mb-3">
                                        <code class="bg-light p-2 rounded">H = Σy<sub>i</sub> / (Σx<sub>i</sub> + Σy<sub>i</sub>)</code>
                                    </div>
                                    <p>
                                        Donde:
                                    </p>
                                    <ul>
                                        <li><strong>x<sub>i</sub>:</strong> Distancia al vecino más cercano en los datos originales</li>
                                        <li><strong>y<sub>i</sub>:</strong> Distancia al vecino más cercano en datos simulados uniformemente</li>
                                    </ul>
                                    
                                    <h6 class="text-success">
                                        <i class="fas fa-chart-bar me-2"></i>
                                        Interpretación de los Valores
                                    </h6>
                                    <div class="row">
                                        <div class="col-md-4">
                                            <div class="card border-success">
                                                <div class="card-body text-center">
                                                    <h5 class="text-success">H ≈ 0</h5>
                                                    <p class="mb-0"><strong>Fuerte Tendencia</strong></p>
                                                    <small class="text-muted">Evidencia clara de agrupaciones</small>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="card border-warning">
                                                <div class="card-body text-center">
                                                    <h5 class="text-warning">H ≈ 0.5</h5>
                                                    <p class="mb-0"><strong>Distribución Uniforme</strong></p>
                                                    <small class="text-muted">No hay tendencia de clustering</small>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="card border-info">
                                                <div class="card-body text-center">
                                                    <h5 class="text-info">0.3 < H < 0.5</h5>
                                                    <p class="mb-0"><strong>Tendencia Moderada</strong></p>
                                                    <small class="text-muted">Clustering puede ser útil</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="alert alert-warning mt-3">
                                        <h6 class="alert-heading">
                                            <i class="fas fa-exclamation-triangle me-2"></i>
                                            Importante
                                        </h6>
                                        <p class="mb-0">
                                            Cuanto más se aproxime H a 0, más evidencias se tienen a favor de que existen agrupaciones reales en los datos. 
                                            Valores cercanos a 0.5 indican distribución uniforme y que no tiene sentido aplicar clustering.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-2"></i>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar el modal al body del documento
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    createClusteringValidationPlot(results) {
        const container = document.getElementById('clusteringValidationPlotContainer');
        if (!container) return;

        // Crear subplots lado a lado (1 fila, 2 columnas)
        const traces = [];
        
        // Gráfico 1: Dataset Real con clusters
        // Agrupar puntos por cluster
        const clusterGroups = {};
        results.real_data.forEach(point => {
            const clusterName = point.cluster_name;
            if (!clusterGroups[clusterName]) {
                clusterGroups[clusterName] = [];
            }
            clusterGroups[clusterName].push(point);
        });
        
        // Crear un trace por cada cluster - usar colores profesionales consistentes
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'];
        let colorIndex = 0;
        
        Object.keys(clusterGroups).forEach(clusterName => {
            const clusterPoints = clusterGroups[clusterName];
            const realTrace = {
                x: clusterPoints.map(point => point.pc1),
                y: clusterPoints.map(point => point.pc2),
                mode: 'markers',
                type: 'scatter',
                name: clusterName,
                marker: {
                    color: colors[colorIndex % colors.length],
                    size: 6,
                    opacity: 0.8
                },
                hovertemplate: `<b>${clusterName}</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>`,
                xaxis: 'x',
                yaxis: 'y'
            };
            traces.push(realTrace);
            colorIndex++;
        });

        // Gráfico 2: Dataset Simulado
        const simulatedTrace = {
            x: results.simulated_data.map(point => point.pc1),
            y: results.simulated_data.map(point => point.pc2),
            mode: 'markers',
            type: 'scatter',
            name: 'Simulated Dataset',
            marker: {
                color: '#95a5a6',
                size: 7,
                opacity: 0.7,
                line: {
                    color: '#7f8c8d',
                    width: 0.5
                }
            },
            hovertemplate: '<b>Simulated Dataset</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>',
            xaxis: 'x2',
            yaxis: 'y2'
        };
        traces.push(simulatedTrace);

        const layout = {
            title: {
                text: 'Clustering Tendency Validation - PCA Comparison',
                font: { size: 18, color: '#2c3e50' },
                x: 0.5,
                y: 0.98
            },
            
            // Configuración para el primer subplot (Dataset Real)
            xaxis: {
                title: {
                    text: `PC1 (${(results.real_stats.explained_variance_pc1 * 100).toFixed(1)}% variance)`,
                    font: { size: 12, color: '#2c3e50' }
                },
                domain: [0, 0.45],
                zeroline: true,
                zerolinecolor: '#bdc3c7',
                zerolinewidth: 1,
                gridcolor: '#ecf0f1',
                showgrid: true,
                showline: true,
                linecolor: '#bdc3c7',
                linewidth: 1
            },
            yaxis: {
                title: {
                    text: `PC2 (${(results.real_stats.explained_variance_pc2 * 100).toFixed(1)}% variance)`,
                    font: { size: 12, color: '#2c3e50' }
                },
                domain: [0.1, 0.9],
                zeroline: true,
                zerolinecolor: '#bdc3c7',
                zerolinewidth: 1,
                gridcolor: '#ecf0f1',
                showgrid: true,
                showline: true,
                linecolor: '#bdc3c7',
                linewidth: 1
            },
            
            // Configuración para el segundo subplot (Dataset Simulado)
            xaxis2: {
                title: {
                    text: `PC1 (${(results.simulated_stats.explained_variance_pc1 * 100).toFixed(1)}% variance)`,
                    font: { size: 12, color: '#2c3e50' }
                },
                domain: [0.55, 1],
                zeroline: true,
                zerolinecolor: '#bdc3c7',
                zerolinewidth: 1,
                gridcolor: '#ecf0f1',
                showgrid: true,
                showline: true,
                linecolor: '#bdc3c7',
                linewidth: 1
            },
            yaxis2: {
                title: {
                    text: `PC2 (${(results.simulated_stats.explained_variance_pc2 * 100).toFixed(1)}% variance)`,
                    font: { size: 12, color: '#2c3e50' }
                },
                domain: [0.1, 0.9],
                zeroline: true,
                zerolinecolor: '#bdc3c7',
                zerolinewidth: 1,
                gridcolor: '#ecf0f1',
                showgrid: true,
                showline: true,
                linecolor: '#bdc3c7',
                linewidth: 1
            },
            
            // Anotaciones para los títulos de cada subplot
            annotations: [
                {
                    text: `PCA - Real Dataset (${results.clustering_info.optimal_k} clusters)`,
                    x: 0.225,
                    y: 0.95,
                    xref: 'paper',
                    yref: 'paper',
                    showarrow: false,
                    font: { size: 14, color: '#2c3e50' },
                    bgcolor: 'rgba(255,255,255,0.8)',
                    bordercolor: '#bdc3c7',
                    borderwidth: 1,
                    borderpad: 4
                },
                {
                    text: 'PCA - Simulated Dataset',
                    x: 0.775,
                    y: 0.95,
                    xref: 'paper',
                    yref: 'paper',
                    showarrow: false,
                    font: { size: 14, color: '#2c3e50' },
                    bgcolor: 'rgba(255,255,255,0.8)',
                    bordercolor: '#bdc3c7',
                    borderwidth: 1,
                    borderpad: 4
                }
            ],
            
            // Leyenda común en la parte inferior
            legend: {
                x: 0.5,
                y: -0.05,
                xanchor: 'center',
                yanchor: 'top',
                orientation: 'h',
                bgcolor: 'rgba(255,255,255,0.9)',
                bordercolor: '#bdc3c7',
                borderwidth: 1
            },
            
            hovermode: 'closest',
            width: null,
            height: 600,
            margin: {
                l: 70,
                r: 70,
                t: 100,
                b: 80
            },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white',
            showlegend: true
        };

        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true,
            toImageButtonOptions: {
                format: 'png',
                filename: 'clustering_validation_pca',
                height: 800,
                width: 1400,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, traces, layout, config);
    },

    createVATPlot(vatData) {
        const container = document.getElementById('vatPlotContainer');
        if (!container) return;

        // Crear subplots lado a lado (1 fila, 2 columnas)
        const traces = [];
        
        // Gráfico 1: VAT para Dataset Real
        const realVATTrace = {
            z: vatData.real.matrix,
            type: 'heatmap',
            colorscale: 'Viridis',
            name: 'Real Dataset',
            showscale: true,
            colorbar: {
                title: 'Distance',
                x: 0.45,
                y: 0.5,
                len: 0.8
            },
            xaxis: 'x',
            yaxis: 'y'
        };
        traces.push(realVATTrace);

        // Gráfico 2: VAT para Dataset Simulado
        const simulatedVATTrace = {
            z: vatData.simulated.matrix,
            type: 'heatmap',
            colorscale: 'Viridis',
            name: 'Simulated Dataset',
            showscale: true,
            colorbar: {
                title: 'Distance',
                x: 1.05,
                y: 0.5,
                len: 0.8
            },
            xaxis: 'x2',
            yaxis: 'y2'
        };
        traces.push(simulatedVATTrace);

        const layout = {
            title: {
                text: 'Visual Assessment of Cluster Tendency (VAT) - Reordered Distance Matrices',
                font: { size: 18, color: '#2c3e50' },
                x: 0.5,
                y: 0.98
            },
            
            // Configuración para el primer subplot (Dataset Real)
            xaxis: {
                title: {
                    text: 'Observations (Reordered)',
                    font: { size: 12, color: '#2c3e50' }
                },
                domain: [0, 0.45],
                zeroline: false,
                showgrid: false,
                showline: false,
                showticklabels: false
            },
            yaxis: {
                title: {
                    text: 'Observations (Reordered)',
                    font: { size: 12, color: '#2c3e50' }
                },
                domain: [0.1, 0.9],
                zeroline: false,
                showgrid: false,
                showline: false,
                showticklabels: false,
                scaleanchor: 'x',
                scaleratio: 1
            },
            
            // Configuración para el segundo subplot (Dataset Simulado)
            xaxis2: {
                title: {
                    text: 'Observations (Reordered)',
                    font: { size: 12, color: '#2c3e50' }
                },
                domain: [0.55, 1],
                zeroline: false,
                showgrid: false,
                showline: false,
                showticklabels: false
            },
            yaxis2: {
                title: {
                    text: 'Observations (Reordered)',
                    font: { size: 12, color: '#2c3e50' }
                },
                domain: [0.1, 0.9],
                zeroline: false,
                showgrid: false,
                showline: false,
                showticklabels: false,
                scaleanchor: 'x2',
                scaleratio: 1
            },
            
            // Anotaciones para los títulos de cada subplot
            annotations: [
                {
                    text: 'Real Dataset',
                    x: 0.225,
                    y: 0.95,
                    xref: 'paper',
                    yref: 'paper',
                    showarrow: false,
                    font: { size: 14, color: '#2c3e50' },
                    bgcolor: 'rgba(255,255,255,0.8)',
                    bordercolor: '#bdc3c7',
                    borderwidth: 1,
                    borderpad: 4
                },
                {
                    text: 'Simulated Dataset',
                    x: 0.775,
                    y: 0.95,
                    xref: 'paper',
                    yref: 'paper',
                    showarrow: false,
                    font: { size: 14, color: '#2c3e50' },
                    bgcolor: 'rgba(255,255,255,0.8)',
                    bordercolor: '#bdc3c7',
                    borderwidth: 1,
                    borderpad: 4
                }
            ],
            
            hovermode: 'closest',
            width: null,
            height: 500,
            margin: {
                l: 60,
                r: 60,
                t: 100,
                b: 80
            },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            showlegend: false
        };

        Plotly.newPlot(container, traces, layout, {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            scrollZoom: true
        });
    },

    async runComparativeCorrelations() {
        if (!this.selectedDataset) {
            this.showError('Por favor, selecciona un dataset primero');
            return;
        }

        if (!this.outlierResults || !this.outlierResults.final_outliers || this.outlierResults.final_outliers.length === 0) {
            this.showError('Por favor, ejecuta primero la detección de outliers');
            return;
        }

        try {
            const button = document.getElementById('runComparativeCorrelations');
            const originalText = button.innerHTML;
            
            // Mostrar loading
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ejecutando análisis...';
            button.disabled = true;

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/comparative-correlations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    outlier_results: this.outlierResults || {}
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();

            // Verificar si hay error en los resultados
            if (results.error) {
                throw new Error(results.error || 'Error en el análisis');
            }

            // Mostrar resultados
            this.displayComparativeCorrelationsResults(results);

            // Restaurar botón
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error en el análisis de correlaciones comparativo: ${error.message}`);
            
            const button = document.getElementById('runComparativeCorrelations');
            if (button) {
                button.innerHTML = '<i class="fas fa-project-diagram me-2"></i>Ejecutar Análisis de Correlaciones Comparativo';
                button.disabled = false;
            }
        }
    },

    displayComparativeCorrelationsResults(results) {
        const container = document.getElementById('comparativeCorrelationsResultsContainer');
        if (!container) {
            return;
        }

        container.innerHTML = '';

        // Panel de resumen
        const summaryCard = document.createElement('div');
        summaryCard.className = 'card mb-4';
        summaryCard.innerHTML = `
            <div class="card-header bg-info">
                <h5 class="mb-0 text-dark">
                    <i class="fas fa-chart-line me-2"></i>
                    Resumen del Análisis de Correlaciones Comparativo
                </h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-3">
                        <div class="card text-center border-info">
                            <div class="card-body">
                                <h5 class="text-info">${results.outliers_count || 0}</h5>
                                <p class="small mb-0">Outliers Analizados</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center border-success">
                            <div class="card-body">
                                <h5 class="text-success">${results.normal_count || 0}</h5>
                                <p class="small mb-0">Datos Normales Analizados</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center border-warning">
                            <div class="card-body">
                                <h5 class="text-warning">${results.summary?.total_pairs_analyzed || 0}</h5>
                                <p class="small mb-0">Pares de Variables Analizados</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center border-danger">
                            <div class="card-body">
                                <h5 class="text-danger">${results.summary?.significant_differences_count || 0}</h5>
                                <p class="small mb-0">Diferencias Significativas</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(summaryCard);

        // Heatmaps de correlaciones
        if (results.correlation_matrices) {
            const heatmapsCard = document.createElement('div');
            heatmapsCard.className = 'card mb-4';
            heatmapsCard.innerHTML = `
                <div class="card-header bg-success">
                    <h5 class="mb-0 text-dark">
                        <i class="fas fa-th me-2"></i>
                        Matrices de Correlación
                    </h5>
                </div>
                <div class="card-body">
                    <ul class="nav nav-tabs" id="correlationTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="outliers-pearson-tab" data-bs-toggle="tab" data-bs-target="#outliers-pearson" type="button" role="tab">
                                Correlación Pearson - Outliers
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="normal-pearson-tab" data-bs-toggle="tab" data-bs-target="#normal-pearson" type="button" role="tab">
                                Correlación Pearson - Normales
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="difference-tab" data-bs-toggle="tab" data-bs-target="#difference" type="button" role="tab">
                                Diferencias (Outliers - Normales)
                            </button>
                        </li>
                    </ul>
                    <div class="tab-content mt-3" id="correlationTabContent">
                        <div class="tab-pane fade show active" id="outliers-pearson" role="tabpanel">
                            <div id="outliersPearsonHeatmap"></div>
                        </div>
                        <div class="tab-pane fade" id="normal-pearson" role="tabpanel">
                            <div id="normalPearsonHeatmap"></div>
                        </div>
                        <div class="tab-pane fade" id="difference" role="tabpanel">
                            <div id="differenceHeatmap"></div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(heatmapsCard);

            // Crear heatmaps después de agregar al DOM
            setTimeout(() => {
                this.createCorrelationHeatmap('outliersPearsonHeatmap', results.correlation_matrices.outliers_pearson, 'Correlación Pearson - Outliers');
                this.createCorrelationHeatmap('normalPearsonHeatmap', results.correlation_matrices.normal_pearson, 'Correlación Pearson - Normales');
                this.createCorrelationHeatmap('differenceHeatmap', results.difference_matrix, 'Diferencias en Correlación (Outliers - Normales)', true);
            }, 100);
        }

        // Tabla de diferencias significativas
        if (results.significant_differences && results.significant_differences.length > 0) {
            const differencesCard = document.createElement('div');
            differencesCard.className = 'card mb-4';
            differencesCard.innerHTML = `
                <div class="card-header bg-warning text-dark">
                    <h5 class="mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Diferencias Significativas en Correlaciones (${results.significant_differences.length})
                    </h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Variable 1</th>
                                    <th>Variable 2</th>
                                    <th>Correlación Outliers (Pearson)</th>
                                    <th>Correlación Normales (Pearson)</th>
                                    <th>Diferencia</th>
                                    <th>P-Valor Diferencia</th>
                                    <th>Interpretación</th>
                                </tr>
                            </thead>
                            <tbody id="significantDifferencesTableBody">
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            container.appendChild(differencesCard);

            const tbody = document.getElementById('significantDifferencesTableBody');
            results.significant_differences.forEach(diff => {
                const row = document.createElement('tr');
                const pValueText = diff.p_value_diff !== null && diff.p_value_diff !== undefined 
                    ? (diff.p_value_diff < 0.001 ? '<0.001' : diff.p_value_diff.toFixed(4))
                    : 'N/A';
                const pValueClass = diff.p_value_diff !== null && diff.p_value_diff < 0.05 ? 'text-danger fw-bold' : '';
                
                row.innerHTML = `
                    <td><strong>${diff.variable1}</strong></td>
                    <td><strong>${diff.variable2}</strong></td>
                    <td>${diff.outliers_pearson_r.toFixed(3)}</td>
                    <td>${diff.normal_pearson_r.toFixed(3)}</td>
                    <td><span class="badge bg-warning">${diff.difference.toFixed(3)}</span></td>
                    <td class="${pValueClass}">${pValueText}</td>
                    <td><small>${diff.interpretation || 'N/A'}</small></td>
                `;
                tbody.appendChild(row);
            });
        } else {
            const noDifferencesCard = document.createElement('div');
            noDifferencesCard.className = 'card mb-4 border-info';
            noDifferencesCard.innerHTML = `
                <div class="card-body text-center">
                    <i class="fas fa-info-circle fa-3x text-info mb-3"></i>
                    <h5>No se encontraron diferencias significativas</h5>
                    <p class="text-muted">Los patrones de correlación entre outliers y datos normales son similares.</p>
                </div>
            `;
            container.appendChild(noDifferencesCard);
        }

        // Interpretación clínica
        if (results.interpretation) {
            const interpretationCard = document.createElement('div');
            interpretationCard.className = 'card mb-4';
            
            // Construir contenido del acordeón dinámicamente
            let accordionContent = `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#overallInterpretation">
                            <i class="fas fa-file-medical me-2"></i>
                            Interpretación General
                        </button>
                    </h2>
                    <div id="overallInterpretation" class="accordion-collapse collapse show" data-bs-parent="#interpretationAccordion">
                        <div class="accordion-body">
                            <p class="text-justify">${results.interpretation.overall_interpretation}</p>
                        </div>
                    </div>
                </div>
            `;
            
            // Mecanismos fisiopatológicos (si existen)
            if (results.interpretation.pathophysiological_mechanisms && results.interpretation.pathophysiological_mechanisms.length > 0) {
                accordionContent += `
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#pathophysiologicalMechanisms">
                                <i class="fas fa-dna me-2"></i>
                                Mecanismos Fisiopatológicos
                            </button>
                        </h2>
                        <div id="pathophysiologicalMechanisms" class="accordion-collapse collapse" data-bs-parent="#interpretationAccordion">
                            <div class="accordion-body">
                                <ul class="list-unstyled">
                                    ${results.interpretation.pathophysiological_mechanisms.map(mech => `<li class="mb-2"><i class="fas fa-arrow-right text-primary me-2"></i>${mech}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Implicaciones clínicas
            accordionContent += `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#clinicalImplications">
                            <i class="fas fa-user-md me-2"></i>
                            Implicaciones Clínicas
                        </button>
                    </h2>
                    <div id="clinicalImplications" class="accordion-collapse collapse" data-bs-parent="#interpretationAccordion">
                        <div class="accordion-body">
                            <ul class="list-unstyled">
                                ${results.interpretation.clinical_implications.map(imp => `<li class="mb-2"><i class="fas fa-check-circle text-success me-2"></i>${imp}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            
            // Análisis detallado por par de variables (si existe)
            if (results.interpretation.detailed_analysis && results.interpretation.detailed_analysis.length > 0) {
                accordionContent += `
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#detailedAnalysis">
                                <i class="fas fa-microscope me-2"></i>
                                Análisis Detallado por Par de Variables
                            </button>
                        </h2>
                        <div id="detailedAnalysis" class="accordion-collapse collapse" data-bs-parent="#interpretationAccordion">
                            <div class="accordion-body">
                                <div class="table-responsive">
                                    <table class="table table-sm table-hover">
                                        <thead>
                                            <tr>
                                                <th>Variables</th>
                                                <th>Correlación Outliers</th>
                                                <th>Correlación Normales</th>
                                                <th>Diferencia</th>
                                                <th>P-Valor</th>
                                                <th>Mecanismo Fisiopatológico</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${results.interpretation.detailed_analysis.map(detail => {
                                                const pValueText = detail.p_value !== null && detail.p_value !== undefined 
                                                    ? (detail.p_value < 0.001 ? '<0.001' : detail.p_value.toFixed(4))
                                                    : 'N/A';
                                                const pValueClass = detail.p_value !== null && detail.p_value < 0.05 ? 'text-danger fw-bold' : '';
                                                return `
                                                    <tr>
                                                        <td><strong>${detail.variables}</strong></td>
                                                        <td>${detail.outliers_correlation.toFixed(3)}</td>
                                                        <td>${detail.normal_correlation.toFixed(3)}</td>
                                                        <td><span class="badge bg-warning text-dark">${detail.difference.toFixed(3)}</span></td>
                                                        <td class="${pValueClass}">${pValueText}</td>
                                                        <td><small class="text-muted">${detail.mechanism_explanation}</small></td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Recomendaciones
            accordionContent += `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#recommendations">
                            <i class="fas fa-lightbulb me-2"></i>
                            Recomendaciones
                        </button>
                    </h2>
                    <div id="recommendations" class="accordion-collapse collapse" data-bs-parent="#interpretationAccordion">
                        <div class="accordion-body">
                            <ul class="list-unstyled">
                                ${results.interpretation.recommendations.map((rec, idx) => `<li class="mb-2"><span class="badge bg-info me-2">${idx + 1}</span>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            
            interpretationCard.innerHTML = `
                <div class="card-header bg-primary">
                    <h5 class="mb-0 text-dark">
                        <i class="fas fa-stethoscope me-2"></i>
                        Interpretación Clínica y Recomendaciones
                    </h5>
                </div>
                <div class="card-body">
                    <div class="accordion" id="interpretationAccordion">
                        ${accordionContent}
                    </div>
                </div>
            `;
            container.appendChild(interpretationCard);
        }
    },

    createCorrelationHeatmap(containerId, matrixData, title, isDifference = false) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        const matrix = matrixData.matrix;
        const labels = matrixData.labels;
        const displayLabels = labels.map(label => this.formatVariableLabel(label));

        // Preparar datos para Plotly
        const colorscale = isDifference 
            ? [[0, '#0066cc'], [0.5, '#ffffff'], [1, '#cc0000']]  // Azul-blanco-rojo para diferencias
            : [[0, '#0066cc'], [0.5, '#ffffff'], [1, '#cc0000']];  // Azul-blanco-rojo para correlaciones

        const trace = {
            z: matrix,
            x: displayLabels,
            y: displayLabels,
            type: 'heatmap',
            colorscale: colorscale,
            zmid: isDifference ? 0 : 0,
            zmin: isDifference ? -1 : -1,
            zmax: isDifference ? 1 : 1,
            colorbar: {
                title: isDifference ? 'Difference' : 'Correlation',
                titleside: 'right'
            },
            hovertemplate: '<b>%{x}</b> vs <b>%{y}</b><br>%{z:.3f}<extra></extra>'
        };

        const layout = {
            title: {
                text: title,
                font: { size: 16 }
            },
            xaxis: {
                title: 'Variables',
                tickangle: -45
            },
            yaxis: {
                title: 'Variables'
            },
            width: Math.max(600, labels.length * 50),
            height: Math.max(600, labels.length * 50),
            margin: { l: 150, r: 50, t: 80, b: 150 }
        };

        Plotly.newPlot(container, [trace], layout, {
            responsive: true,
            displayModeBar: true
        });
    },

    // ============================================================================
    // MARCO ANALÍTICO COMPLETO PARA OUTLIERS
    // ============================================================================

    async runDemographicProfile() {
        if (!this.selectedDataset || !this.outlierResults) {
            this.showError('Por favor, ejecuta primero la detección de outliers');
            return;
        }

        try {
            const button = document.getElementById('runDemographicProfile');
            const selectorContainer = document.getElementById('demographicCategoricalSelector');
            const checkboxesContainer = document.getElementById('demographicCategoricalCheckboxes');
            
            // Si el selector no está visible, cargar variables disponibles primero
            if (!selectorContainer || selectorContainer.style.display === 'none') {
                const originalText = button.innerHTML;
                button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando variables...';
                button.disabled = true;

                const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/demographic-profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ outlier_results: this.outlierResults })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
                }

                const availableVars = await response.json();
                
                
                if (availableVars.available_categorical_variables && availableVars.available_categorical_variables.length > 0) {
                    // Mostrar selector de variables
                    this.showDemographicCategoricalSelector(availableVars.available_categorical_variables, availableVars.suggested_categorical_variables || []);
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                } else {
                    // No hay variables categóricas, ejecutar análisis solo con numéricas
                    this.executeDemographicProfile([]);
                    return;
                }
            }
            
            // Si el selector está visible, obtener variables seleccionadas y ejecutar
            const selectedVars = this.getSelectedCategoricalVariables();
            this.executeDemographicProfile(selectedVars);

        } catch (error) {
            this.showError(`Error: ${error.message}`);
            const button = document.getElementById('runDemographicProfile');
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar Análisis de Perfil Demográfico/Clínico';
                button.disabled = false;
            }
        }
    },

    showDemographicCategoricalSelector(availableVars, suggestedVars) {
        const selectorContainer = document.getElementById('demographicCategoricalSelector');
        const checkboxesContainer = document.getElementById('demographicCategoricalCheckboxes');
        
        
        if (!selectorContainer) {
            return;
        }
        
        if (!checkboxesContainer) {
            return;
        }
        
        selectorContainer.style.display = 'block';
        
        let html = '';
        availableVars.forEach(varName => {
            const isSuggested = suggestedVars.includes(varName);
            const isChecked = isSuggested ? 'checked' : '';
            const badge = isSuggested ? '<span class="badge bg-info ms-2">Sugerida</span>' : '';
            html += `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${varName}" id="catVar_${varName}" ${isChecked}>
                    <label class="form-check-label" for="catVar_${varName}">
                        ${varName} ${badge}
                    </label>
                </div>
            `;
        });
        
        checkboxesContainer.innerHTML = html;
    },

    getSelectedCategoricalVariables() {
        const checkboxes = document.querySelectorAll('#demographicCategoricalCheckboxes input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    },

    async executeDemographicProfile(categoricalVariables) {
        try {
            const button = document.getElementById('runDemographicProfile');
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ejecutando...';
            button.disabled = true;

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/demographic-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    outlier_results: this.outlierResults,
                    categorical_variables: categoricalVariables
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            if (results.error) throw new Error(results.error);

            this.displayDemographicProfileResults(results);
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error: ${error.message}`);
            const button = document.getElementById('runDemographicProfile');
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar Análisis de Perfil Demográfico/Clínico';
                button.disabled = false;
            }
        }
    },

    displayDemographicProfileResults(results) {
        const container = document.getElementById('demographicProfileResults');
        if (!container) return;
        
        // Ocultar selector después de ejecutar
        const selectorContainer = document.getElementById('demographicCategoricalSelector');
        if (selectorContainer) {
            selectorContainer.style.display = 'none';
        }
        
        // Si el resultado contiene variables disponibles (primera llamada), ya se manejó en runDemographicProfile
        if (results.available_categorical_variables) {
            return;
        }

        let html = '<div class="card"><div class="card-body">';
        
        // Resumen
        if (results.summary) {
            html += `<h6>Resumen</h6><p>Variables categóricas analizadas: ${results.summary.total_categorical_variables || 0}, Variables continuas analizadas: ${results.summary.total_continuous_variables || 0}</p>`;
        }
        
        // Variables categóricas
        if (results.categorical_analyses && results.categorical_analyses.length > 0) {
            html += '<h6 class="mt-3">Análisis de Variables Categóricas</h6><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Variable</th><th>Chi²</th><th>P-Valor</th><th>Fisher P</th><th>Interpretación</th></tr></thead><tbody>';
            results.categorical_analyses.forEach(analysis => {
                html += `<tr><td>${analysis.variable}</td><td>${analysis.chi2_statistic?.toFixed(3) || 'N/A'}</td><td>${analysis.chi2_p_value?.toFixed(4) || 'N/A'}</td><td>${analysis.fisher_exact_p_value?.toFixed(4) || 'N/A'}</td><td><small>${analysis.interpretation}</small></td></tr>`;
            });
            html += '</tbody></table></div>';
        } else if (results.summary && results.summary.total_categorical_variables === 0) {
            html += '<p class="text-muted mt-3"><i class="fas fa-info-circle me-2"></i>No se analizaron variables categóricas. Solo se analizaron variables numéricas.</p>';
        }
        
        // Variables continuas
        if (results.continuous_analyses && results.continuous_analyses.length > 0) {
            html += '<h6 class="mt-3">Análisis de Variables Continuas</h6><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Variable</th><th>Media Outliers</th><th>Media Normales</th><th>Mann-Whitney P</th><th>Interpretación</th></tr></thead><tbody>';
            results.continuous_analyses.forEach(analysis => {
                html += `<tr><td>${analysis.variable}</td><td>${analysis.outliers_statistics.mean?.toFixed(2) || 'N/A'}</td><td>${analysis.normal_statistics.mean?.toFixed(2) || 'N/A'}</td><td>${analysis.mann_whitney_p_value?.toFixed(4) || 'N/A'}</td><td><small>${analysis.interpretation}</small></td></tr>`;
            });
            html += '</tbody></table></div>';
        }
        
        html += '</div></div>';
        container.innerHTML = html;
    },

    async runCooccurrenceAnalysis() {
        if (!this.selectedDataset || !this.outlierResults) {
            this.showError('Por favor, ejecuta primero la detección de outliers');
            return;
        }

        try {
            const button = document.getElementById('runCooccurrenceAnalysis');
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ejecutando...';
            button.disabled = true;

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/cooccurrence-patterns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outlier_results: this.outlierResults })
            });

            if (!response.ok) {
                const errorData = await response.json();
                // Si el error viene con información adicional (outliers_detected, minimum_required)
                if (errorData.detail && typeof errorData.detail === 'object' && errorData.detail.error) {
                    const errorInfo = errorData.detail;
                    const container = document.getElementById('cooccurrenceResults');
                    if (container) {
                        container.innerHTML = `
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                <strong>Datos insuficientes:</strong> ${errorInfo.error}
                                ${errorInfo.outliers_detected !== undefined ? `<br><small>Outliers detectados: ${errorInfo.outliers_detected} | Mínimo requerido: ${errorInfo.minimum_required}</small>` : ''}
                            </div>
                        `;
                    }
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            if (results.error) {
                // Mostrar información detallada si está disponible
                const container = document.getElementById('cooccurrenceResults');
                if (container && (results.outliers_detected !== undefined || results.minimum_required !== undefined)) {
                    container.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Datos insuficientes:</strong> ${results.error}
                            ${results.outliers_detected !== undefined ? `<br><small>Outliers detectados: ${results.outliers_detected} | Mínimo requerido: ${results.minimum_required}</small>` : ''}
                        </div>
                    `;
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                throw new Error(results.error);
            }

            this.displayCooccurrenceResults(results);
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error: ${error.message}`);
            const button = document.getElementById('runCooccurrenceAnalysis');
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar Análisis de Co-Ocurrencia';
                button.disabled = false;
            }
        }
    },

    displayCooccurrenceResults(results) {
        const container = document.getElementById('cooccurrenceResults');
        if (!container) return;

        let html = '<div class="card"><div class="card-body">';
        
        // Interpretación destacada en un panel
        html += '<div class="alert alert-info border-info mb-4">';
        html += '<h6 class="alert-heading"><i class="fas fa-lightbulb me-2"></i>Interpretación de Resultados</h6>';
        html += `<div class="mt-2">${results.interpretation}</div>`;
        html += '</div>';
        
        // Resumen estadístico
        html += '<div class="row mb-3">';
        html += `<div class="col-md-3"><div class="card border-primary"><div class="card-body text-center"><h5 class="text-primary">${results.outliers_count || 0}</h5><small class="text-muted">Outliers Analizados</small></div></div></div>`;
        html += `<div class="col-md-3"><div class="card border-success"><div class="card-body text-center"><h5 class="text-success">${results.total_variables || 0}</h5><small class="text-muted">Variables Analizadas</small></div></div></div>`;
        html += `<div class="col-md-3"><div class="card border-warning"><div class="card-body text-center"><h5 class="text-warning">${results.significant_pairs.length || 0}</h5><small class="text-muted">Pares Significativos</small></div></div></div>`;
        html += `<div class="col-md-3"><div class="card border-info"><div class="card-body text-center"><h5 class="text-info">${results.total_possible_pairs || 0}</h5><small class="text-muted">Total Pares Posibles</small></div></div></div>`;
        html += '</div>';
        
        html += `<div id="cooccurrenceHeatmap" class="mb-4"></div>`;
        
        if (results.significant_pairs && results.significant_pairs.length > 0) {
            html += '<h6 class="mt-3"><i class="fas fa-table me-2"></i>Pares con Correlaciones Significativas (p<0.05)</h6>';
            html += '<div class="table-responsive"><table class="table table-sm table-hover"><thead class="table-light"><tr><th>Variable 1</th><th>Variable 2</th><th>Correlación (r)</th><th>P-Valor</th><th>Magnitud</th></tr></thead><tbody>';
            
            // Ordenar por valor absoluto de correlación
            const sortedPairs = [...results.significant_pairs].sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
            
            sortedPairs.forEach(pair => {
                const absCorr = Math.abs(pair.correlation);
                let magnitude = '';
                let rowClass = '';
                if (absCorr > 0.7) {
                    magnitude = '<span class="badge bg-danger">Muy Fuerte</span>';
                    rowClass = 'table-danger';
                } else if (absCorr > 0.5) {
                    magnitude = '<span class="badge bg-warning">Fuerte</span>';
                    rowClass = 'table-warning';
                } else if (absCorr > 0.3) {
                    magnitude = '<span class="badge bg-info">Moderada</span>';
                    rowClass = 'table-info';
                } else {
                    magnitude = '<span class="badge bg-secondary">Débil</span>';
                }
                
                const corrColor = pair.correlation > 0 ? 'text-success' : 'text-danger';
                html += `<tr class="${rowClass}"><td><strong>${pair.variable1}</strong></td><td><strong>${pair.variable2}</strong></td><td class="${corrColor}"><strong>${pair.correlation.toFixed(3)}</strong></td><td>${pair.p_value.toFixed(4)}</td><td>${magnitude}</td></tr>`;
            });
            html += '</tbody></table></div>';
        } else {
            html += '<div class="alert alert-warning mt-3"><i class="fas fa-exclamation-triangle me-2"></i>No se encontraron pares de variables con correlaciones significativas (p<0.05).</div>';
        }
        
        html += '</div></div>';
        container.innerHTML = html;

        // Crear heatmap
        setTimeout(() => {
            this.createCorrelationHeatmap('cooccurrenceHeatmap', results.correlation_matrix, 'Matriz de Correlación Spearman - Outliers');
        }, 100);
    },

    async runOutlierClustering() {
        if (!this.selectedDataset || !this.outlierResults) {
            this.showError('Por favor, ejecuta primero la detección de outliers');
            return;
        }

        try {
            const method = document.getElementById('clusteringMethod')?.value || 'kmeans';
            
            const button = document.getElementById('runOutlierClustering');
            const container = document.getElementById('outlierClusteringResults');
            
            if (!container) {
                this.showError('Error: No se pudo encontrar el contenedor de resultados');
                return;
            }
            
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ejecutando...';
            button.disabled = true;
            
            // Limpiar resultados anteriores
            container.innerHTML = '<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-2"></i>Ejecutando análisis de clustering...</div>';

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/outlier-clustering`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    outlier_results: this.outlierResults,
                    method: method
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `HTTP error! status: ${response.status}` }));
                // Si el error viene con información adicional (outliers_detected, minimum_required)
                if (errorData.detail && typeof errorData.detail === 'object' && errorData.detail.error) {
                    const errorInfo = errorData.detail;
                    container.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Datos insuficientes:</strong> ${errorInfo.error}
                            ${errorInfo.outliers_detected !== undefined ? `<br><small>Outliers detectados: ${errorInfo.outliers_detected} | Mínimo requerido: ${errorInfo.minimum_required}</small>` : ''}
                        </div>
                    `;
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            
            if (results.error) {
                // Mostrar información detallada si está disponible
                const container = document.getElementById('outlierClusteringResults');
                if (container && (results.outliers_detected !== undefined || results.minimum_required !== undefined)) {
                    container.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Datos insuficientes:</strong> ${results.error}
                            ${results.outliers_detected !== undefined ? `<br><small>Outliers detectados: ${results.outliers_detected} | Mínimo requerido: ${results.minimum_required}</small>` : ''}
                        </div>
                    `;
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                throw new Error(results.error);
            }

            if (!results.kmeans_results && !results.dbscan_results) {
                container.innerHTML = '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i>No se generaron resultados de clustering. Verifica que haya suficientes outliers y variables numéricas.</div>';
            } else {
            this.displayOutlierClusteringResults(results);
            }
            
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            const container = document.getElementById('outlierClusteringResults');
            if (container) {
                container.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i><strong>Error:</strong> ${error.message}</div>`;
            }
            this.showError(`Error: ${error.message}`);
            const button = document.getElementById('runOutlierClustering');
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar Clustering de Outliers';
                button.disabled = false;
            }
        }
    },

    displayOutlierClusteringResults(results) {
        const container = document.getElementById('outlierClusteringResults');
        if (!container) {
            return;
        }

        let html = '';
        
        // Información general
        html += '<div class="card mb-3">';
        html += '<div class="card-header bg-info text-white"><h6 class="mb-0"><i class="fas fa-info-circle me-2"></i>Información del Análisis</h6></div>';
        html += '<div class="card-body">';
        // Usar outliers_count que ahora contiene el conteo correcto de outliers únicos
        html += `<p><strong>Outliers finales analizados:</strong> ${results.outliers_count || 0}</p>`;
        if (results.outliers_count_rows && results.outliers_count_rows !== results.outliers_count) {
            html += `<p class="text-muted small"><i class="fas fa-info-circle me-1"></i>Nota: Se utilizaron ${results.outliers_count_rows} filas para el clustering (algunos outliers pueden tener múltiples filas en el dataset).</p>`;
        }
        html += `<p><strong>Variables utilizadas:</strong> ${(results.variables_used || []).join(', ')}</p>`;
        html += '</div></div>';
        
        // Resultados de K-means
        if (results.kmeans_results) {
            html += '<div class="card mb-3">';
            html += '<div class="card-header bg-success text-white"><h6 class="mb-0"><i class="fas fa-project-diagram me-2"></i>K-means</h6></div>';
            html += '<div class="card-body">';
            html += `<p class="mb-3">${results.kmeans_results.interpretation}</p>`;
            
            if (results.kmeans_results.silhouette_score !== null && results.kmeans_results.silhouette_score !== undefined) {
                html += `<p><strong>Score de Silueta:</strong> ${results.kmeans_results.silhouette_score.toFixed(3)}</p>`;
            }
            
            html += `<p><strong>Número de Clusters:</strong> ${results.kmeans_results.n_clusters}</p>`;
            
            // Gráfico de clustering con elipses
            if (results.kmeans_results.cluster_data_points) {
                html += '<h6 class="mt-3">Visualización de Clusters</h6>';
                html += '<p class="text-muted small">Los clusters se muestran con elipses sombreadas. Cada punto representa un outlier.</p>';
                html += `<div id="kmeansClusteringPlot" style="min-height: 500px;"></div>`;
            }
            
            // Tabla de asignaciones de clusters
            if (results.kmeans_results.cluster_assignments_ids || results.kmeans_results.cluster_assignments) {
                html += '<h6 class="mt-3">Asignaciones de Clusters</h6>';
                html += '<div class="table-responsive">';
                html += '<table class="table table-sm table-striped">';
                html += '<thead><tr><th>Cluster</th><th>Número de Outliers</th><th>IDs de Sujetos</th></tr></thead>';
                html += '<tbody>';
                
                // Usar IDs de sujetos si están disponibles, sino usar índices
                const assignments = results.kmeans_results.cluster_assignments_ids || results.kmeans_results.cluster_assignments;
                Object.keys(assignments).sort((a, b) => parseInt(a) - parseInt(b)).forEach(clusterId => {
                    const ids = assignments[clusterId];
                    html += `<tr>`;
                    html += `<td><span class="badge bg-primary">Cluster ${clusterId}</span></td>`;
                    html += `<td>${ids.length}</td>`;
                    html += `<td><small>${ids.join(', ')}</small></td>`;
                    html += `</tr>`;
                });
                
                html += '</tbody></table></div>';
            }
            
            html += '</div></div>';
        }
        
        // Resultados de DBSCAN
        if (results.dbscan_results) {
            html += '<div class="card mb-3">';
            html += '<div class="card-header bg-warning text-dark"><h6 class="mb-0"><i class="fas fa-sitemap me-2"></i>DBSCAN</h6></div>';
            html += '<div class="card-body">';
            html += `<p class="mb-3">${results.dbscan_results.interpretation}</p>`;
            
            html += `<p><strong>Parámetros utilizados:</strong></p>`;
            html += `<ul>`;
            html += `<li><strong>eps (distancia máxima):</strong> ${results.dbscan_results.eps}</li>`;
            html += `<li><strong>min_samples (mínimo de puntos por cluster):</strong> ${results.dbscan_results.min_samples}</li>`;
            html += `</ul>`;
            
            html += `<p><strong>Clusters densos identificados:</strong> ${results.dbscan_results.n_clusters}</p>`;
            html += `<p><strong>Puntos de ruido:</strong> ${results.dbscan_results.n_noise}</p>`;
            
            // Tabla de asignaciones de clusters DBSCAN
            if ((results.dbscan_results.cluster_assignments_ids || results.dbscan_results.cluster_assignments) && 
                Object.keys(results.dbscan_results.cluster_assignments_ids || results.dbscan_results.cluster_assignments || {}).length > 0) {
                html += '<h6 class="mt-3">Asignaciones de Clusters</h6>';
                html += '<div class="table-responsive">';
                html += '<table class="table table-sm table-striped">';
                html += '<thead><tr><th>Cluster</th><th>Número de Outliers</th><th>IDs de Sujetos</th></tr></thead>';
                html += '<tbody>';
                
                // Usar IDs de sujetos si están disponibles, sino usar índices
                const assignments = results.dbscan_results.cluster_assignments_ids || results.dbscan_results.cluster_assignments;
                Object.keys(assignments).sort((a, b) => parseInt(a) - parseInt(b)).forEach(clusterId => {
                    const ids = assignments[clusterId];
                    html += `<tr>`;
                    html += `<td><span class="badge bg-warning text-dark">Cluster ${clusterId}</span></td>`;
                    html += `<td>${ids.length}</td>`;
                    html += `<td><small>${ids.join(', ')}</small></td>`;
                    html += `</tr>`;
                });
                
                html += '</tbody></table></div>';
            } else {
                html += '<div class="alert alert-info mt-3">';
                html += '<i class="fas fa-info-circle me-2"></i>';
                html += 'No se identificaron clusters densos. Todos los puntos fueron clasificados como ruido, lo que sugiere que los outliers no forman grupos densos claramente definidos.';
                html += '</div>';
        }
        
        html += '</div></div>';
        }
        
        // Mensaje si no hay resultados
        if (!results.kmeans_results && !results.dbscan_results) {
            html += '<div class="alert alert-warning">';
            html += '<i class="fas fa-exclamation-triangle me-2"></i>';
            html += 'No se generaron resultados de clustering. Verifica que haya suficientes outliers y variables numéricas.';
            html += '</div>';
            }
        
        container.innerHTML = html;
        
        // Crear gráfico de clustering con elipses si hay datos de K-means
        if (results.kmeans_results && results.kmeans_results.cluster_data_points) {
            setTimeout(() => {
                this.createKmeansClusteringPlot(results.kmeans_results);
            }, 100);
        }
    },
    
    createKmeansClusteringPlot(kmeansResults) {
        const container = document.getElementById('kmeansClusteringPlot');
        if (!container) return;
        
        const clusterDataPoints = kmeansResults.cluster_data_points;
        const clusterCentersPCA = kmeansResults.cluster_centers_pca || {};
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
        
        const traces = [];
        
        // Crear trazas para cada cluster con puntos
        Object.keys(clusterDataPoints).sort((a, b) => parseInt(a) - parseInt(b)).forEach((clusterId, index) => {
            const points = clusterDataPoints[clusterId];
            const color = colors[index % colors.length];
            
            // Puntos del cluster
            const x = points.map(p => p.pc1);
            const y = points.map(p => p.pc2);
            const text = points.map(p => `ID: ${p.subject_id}<br>Cluster: ${clusterId}`);
            
            traces.push({
                x: x,
                y: y,
                mode: 'markers',
                type: 'scatter',
                name: `Cluster ${clusterId}`,
                marker: {
                    color: color,
                    size: 10,
                    opacity: 0.7,
                    line: { color: 'white', width: 1 }
                },
                hovertemplate: '%{text}<br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>',
                text: text
            });
            
            // Centroide del cluster
            const center = clusterCentersPCA[clusterId];
            if (center) {
                traces.push({
                    x: [center.pc1],
                    y: [center.pc2],
                    mode: 'markers',
                    type: 'scatter',
                    name: `Centroide ${clusterId}`,
                    marker: {
                        color: color,
                        size: 20,
                        symbol: 'diamond',
                        line: { color: 'white', width: 2 }
                    },
                    hovertemplate: `<b>Centroide Cluster ${clusterId}</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>`,
                    showlegend: false
                });
            }
            
            // Crear elipse alrededor del cluster
            if (points.length >= 3) {
                const ellipse = this.calculateEllipse(points, center || { pc1: 0, pc2: 0 });
                if (ellipse) {
                    traces.push({
                        x: ellipse.x,
                        y: ellipse.y,
                        mode: 'lines',
                        type: 'scatter',
                        name: `Cluster ${clusterId} Ellipse`,
                        line: { color: color, width: 2, dash: 'dash' },
                        fill: 'toself',
                        fillcolor: color,
                        opacity: 0.1,
                        showlegend: false,
                        hoverinfo: 'skip'
                    });
                }
            }
        });
        
        const layout = {
            title: {
                text: `K-means Clusters Visualization (K=${Object.keys(clusterDataPoints).length})`,
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: `PC1 (${(kmeansResults.pca_explained_variance[0] * 100).toFixed(1)}% variance explained)`,
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: true,
                zerolinecolor: 'rgba(128, 128, 128, 0.5)'
            },
            yaxis: {
                title: {
                    text: `PC2 (${(kmeansResults.pca_explained_variance[1] * 100).toFixed(1)}% variance explained)`,
                    font: { size: 14, color: '#34495e' }
                },
                showgrid: true,
                gridcolor: 'rgba(128, 128, 128, 0.2)',
                zeroline: true,
                zerolinecolor: 'rgba(128, 128, 128, 0.5)'
            },
            hovermode: 'closest',
            legend: {
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            showlegend: true,
            dragmode: 'zoom',
            width: null,
            height: 600,
            margin: { l: 80, r: 120, t: 90, b: 70 },
            plot_bgcolor: 'rgba(250, 250, 250, 0.8)',
            paper_bgcolor: 'white',
            annotations: []
        };
        
        const config = {
            responsive: true,
            scrollZoom: true,
            displayModeBar: 'hover',
            displaylogo: false,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'kmeans_clustering',
                height: 800,
                width: 1200,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, traces, layout, config);
    },
    
    calculateEllipse(points, center) {
        if (points.length < 3) return null;
        
        // Calcular desviación estándar en cada dirección
        const xValues = points.map(p => p.pc1);
        const yValues = points.map(p => p.pc2);
        
        const meanX = center.pc1 || (xValues.reduce((a, b) => a + b, 0) / xValues.length);
        const meanY = center.pc2 || (yValues.reduce((a, b) => a + b, 0) / yValues.length);
        
        const stdX = Math.sqrt(xValues.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0) / xValues.length);
        const stdY = Math.sqrt(yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0) / yValues.length);
        
        // Calcular correlación
        let covariance = 0;
        for (let i = 0; i < points.length; i++) {
            covariance += (xValues[i] - meanX) * (yValues[i] - meanY);
        }
        covariance /= points.length;
        const correlation = covariance / (stdX * stdY || 1);
        
        // Crear elipse usando 2 desviaciones estándar (aproximadamente 95% de los datos)
        const nPoints = 100;
        const ellipseX = [];
        const ellipseY = [];
        const scale = 2.0; // 2 desviaciones estándar
        
        for (let i = 0; i <= nPoints; i++) {
            const angle = (2 * Math.PI * i) / nPoints;
            const x = meanX + scale * stdX * Math.cos(angle);
            const y = meanY + scale * stdY * (Math.sin(angle) * Math.sqrt(1 - correlation * correlation) + correlation * Math.cos(angle));
            ellipseX.push(x);
            ellipseY.push(y);
        }
        
        return { x: ellipseX, y: ellipseY };
    },

    async runPredictiveModel() {
        if (!this.selectedDataset || !this.outlierResults) {
            this.showError('Por favor, ejecuta primero la detección de outliers');
            return;
        }

        try {
            const predictorsSelect = document.getElementById('predictorVariables');
            const predictors = Array.from(predictorsSelect.selectedOptions).map(opt => opt.value);
            
            if (predictors.length === 0) {
                this.showError('Por favor, selecciona al menos una variable predictora');
                return;
            }

            const button = document.getElementById('runPredictiveModel');
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Entrenando modelo...';
            button.disabled = true;

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/predictive-model`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    outlier_results: this.outlierResults,
                    predictors: predictors
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                // Si el error viene con información adicional (available_data_points, minimum_required, etc.)
                if (errorData.detail && typeof errorData.detail === 'object' && errorData.detail.error) {
                    const errorInfo = errorData.detail;
                    const container = document.getElementById('predictiveModelResults');
                    if (container) {
                        let errorHtml = `
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                <strong>Datos insuficientes:</strong> ${errorInfo.error}
                        `;
                        if (errorInfo.available_data_points !== undefined) {
                            errorHtml += `<br><small>Datos disponibles: ${errorInfo.available_data_points}`;
                            if (errorInfo.minimum_required !== undefined) {
                                errorHtml += ` | Mínimo requerido: ${errorInfo.minimum_required}`;
                            }
                            errorHtml += `</small>`;
                        }
                        if (errorInfo.class_distribution) {
                            errorHtml += `<br><small>Distribución de clases: ${JSON.stringify(errorInfo.class_distribution)}</small>`;
                        }
                        if (errorInfo.minority_class_count !== undefined) {
                            errorHtml += `<br><small>Clase minoritaria: ${errorInfo.minority_class_count} observaciones</small>`;
                        }
                        errorHtml += `</div>`;
                        container.innerHTML = errorHtml;
                    }
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            if (results.error) {
                // Mostrar información detallada si está disponible
                const container = document.getElementById('predictiveModelResults');
                if (container && (results.available_data_points !== undefined || results.minimum_required !== undefined)) {
                    let errorHtml = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Datos insuficientes:</strong> ${results.error}
                    `;
                    if (results.available_data_points !== undefined) {
                        errorHtml += `<br><small>Datos disponibles: ${results.available_data_points}`;
                        if (results.minimum_required !== undefined) {
                            errorHtml += ` | Mínimo requerido: ${results.minimum_required}`;
                        }
                        errorHtml += `</small>`;
                    }
                    if (results.class_distribution) {
                        errorHtml += `<br><small>Distribución de clases: ${JSON.stringify(results.class_distribution)}</small>`;
                    }
                    errorHtml += `</div>`;
                    container.innerHTML = errorHtml;
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                throw new Error(results.error);
            }

            this.displayPredictiveModelResults(results);
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error: ${error.message}`);
            const button = document.getElementById('runPredictiveModel');
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Entrenar Modelo Predictivo';
                button.disabled = false;
            }
        }
    },

    displayPredictiveModelResults(results) {
        const container = document.getElementById('predictiveModelResults');
        if (!container) return;

        let html = '<div class="card"><div class="card-body">';
        html += `<h5 class="mb-4"><i class="fas fa-brain me-2"></i>Resultados del Modelo Random Forest</h5>`;
        
        // Panel de métricas principales
        html += '<div class="row mb-4">';
        html += `<div class="col-md-3"><div class="card border-primary"><div class="card-body text-center"><h5 class="text-primary">${results.auc_score?.toFixed(3) || 'N/A'}</h5><small class="text-muted">AUC-ROC</small><br><small class="text-muted" style="font-size: 0.7rem;">Área bajo la curva ROC</small></div></div></div>`;
        html += `<div class="col-md-3"><div class="card border-success"><div class="card-body text-center"><h5 class="text-success">${results.accuracy?.toFixed(3) || 'N/A'}</h5><small class="text-muted">Exactitud (Accuracy)</small><br><small class="text-muted" style="font-size: 0.7rem;">% predicciones correctas</small></div></div></div>`;
        html += `<div class="col-md-3"><div class="card border-info"><div class="card-body text-center"><h5 class="text-info">${results.precision?.toFixed(3) || 'N/A'}</h5><small class="text-muted">Valor Predictivo Positivo</small><br><small class="text-muted" style="font-size: 0.7rem;">(Precision) % outliers correctos</small></div></div></div>`;
        html += `<div class="col-md-3"><div class="card border-warning"><div class="card-body text-center"><h5 class="text-warning">${results.recall?.toFixed(3) || 'N/A'}</h5><small class="text-muted">Sensibilidad (Recall)</small><br><small class="text-muted" style="font-size: 0.7rem;">% outliers detectados</small></div></div></div>`;
        html += '</div>';
        
        // Agregar explicación de métricas
        html += `<div class="alert alert-light mb-4">
            <h6 class="mb-2"><i class="fas fa-info-circle me-2"></i>Explicación de Métricas:</h6>
            <ul class="mb-0 small">
                <li><strong>Exactitud (Accuracy):</strong> Proporción de todas las predicciones que fueron correctas (tanto outliers como normales). Fórmula: (Verdaderos Positivos + Verdaderos Negativos) / Total</li>
                <li><strong>Valor Predictivo Positivo (Precision):</strong> De todas las predicciones de "outlier" que hizo el modelo, ¿cuántas fueron correctas? Fórmula: Verdaderos Positivos / (Verdaderos Positivos + Falsos Positivos)</li>
                <li><strong>Sensibilidad (Recall):</strong> De todos los outliers reales en los datos, ¿cuántos detectó correctamente el modelo? Fórmula: Verdaderos Positivos / (Verdaderos Positivos + Falsos Negativos)</li>
            </ul>
        </div>`;
        
        // Mostrar advertencia de sobreajuste si existe
        if (results.overfitting_warning) {
            html += `<div class="alert alert-warning mb-4"><i class="fas fa-exclamation-triangle me-2"></i><strong>Advertencia de Sobreajuste:</strong> ${results.overfitting_warning}</div>`;
        }
        
        // Mostrar parámetros del modelo
        if (results.model_params) {
            html += `<div class="alert alert-secondary mb-4"><strong>Parámetros del Modelo:</strong> `;
            html += `Árboles: ${results.model_params.n_estimators}, `;
            html += `Profundidad máxima: ${results.model_params.max_depth}, `;
            html += `Mínimo muestras para dividir: ${results.model_params.min_samples_split}, `;
            html += `Mínimo muestras por hoja: ${results.model_params.min_samples_leaf}, `;
            html += `Muestras entrenamiento: ${results.training_size}, `;
            html += `Muestras prueba: ${results.test_size}`;
            if (results.training_class_distribution && results.test_class_distribution) {
                html += `<br><small class="text-muted">`;
                html += `Entrenamiento: `;
                const trainDist = Object.entries(results.training_class_distribution)
                    .map(([cls, count]) => `${cls}: ${count}`).join(', ');
                html += trainDist;
                html += ` | Prueba: `;
                const testDist = Object.entries(results.test_class_distribution)
                    .map(([cls, count]) => `${cls}: ${count}`).join(', ');
                html += testDist;
                html += `</small>`;
            }
            html += `</div>`;
        }
        
        html += `<div class="alert alert-info mb-4"><strong>Interpretación:</strong> ${results.interpretation}</div>`;
        
        // Gráfico de Importancia de Variables
        if (results.feature_importance && results.feature_importance.length > 0) {
            html += '<div class="row mb-4">';
            html += '<div class="col-md-6">';
            html += '<h6 class="mb-3"><i class="fas fa-chart-bar me-2"></i>Importancia de Variables</h6>';
            html += '<div id="featureImportancePlot"></div>';
            html += '</div>';
            
            // Matriz de Confusión
            html += '<div class="col-md-6">';
            html += '<h6 class="mb-3"><i class="fas fa-table me-2"></i>Matriz de Confusión</h6>';
            html += '<div id="confusionMatrixPlot"></div>';
            html += '</div>';
            html += '</div>';
            
            // Tabla de Importancia
            html += '<h6 class="mt-4">Tabla de Importancia de Variables</h6>';
            html += '<div class="table-responsive"><table class="table table-sm table-hover"><thead><tr><th>Variable</th><th>Importancia</th><th>%</th></tr></thead><tbody>';
            const totalImportance = results.feature_importance.reduce((sum, f) => sum + f.importance, 0);
            results.feature_importance.forEach(feat => {
                const percentage = (feat.importance / totalImportance * 100).toFixed(2);
                html += `<tr><td>${feat.variable}</td><td>${feat.importance.toFixed(4)}</td><td>${percentage}%</td></tr>`;
            });
            html += '</tbody></table></div>';
        }
        
        // Curva ROC
        if (results.roc_curve) {
            html += '<div class="row mt-4">';
            html += '<div class="col-12">';
            html += '<h6 class="mb-3"><i class="fas fa-chart-line me-2"></i>Curva ROC</h6>';
            html += '<div id="rocCurvePlot"></div>';
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div></div>';
        container.innerHTML = html;
        
        // Crear gráficos
        if (results.feature_importance && results.feature_importance.length > 0) {
            this.createFeatureImportancePlot(results.feature_importance);
        }
        
        if (results.confusion_matrix) {
            this.createConfusionMatrixPlot(results.confusion_matrix);
        }
        
        if (results.roc_curve) {
            this.createROCCurvePlot(results.roc_curve, results.auc_score);
        }
    },

    createFeatureImportancePlot(featureImportance) {
        const container = document.getElementById('featureImportancePlot');
        if (!container) return;
        
        // Ordenar por importancia descendente
        const sorted = [...featureImportance].sort((a, b) => b.importance - a.importance);
        const top10 = sorted.slice(0, 10); // Top 10 variables
        
        const trace = {
            x: top10.map(f => f.importance),
            y: top10.map(f => f.variable),
            type: 'bar',
            orientation: 'h',
            marker: {
                color: top10.map((f, i) => `rgba(46, 159, 223, ${0.7 + (i / top10.length) * 0.3})`),
                line: { color: '#2E9FDF', width: 1 }
            },
            hovertemplate: '<b>%{y}</b><br>Importancia: %{x:.4f}<extra></extra>'
        };
        
        const layout = {
            title: {
                text: 'Top 10 Most Important Variables',
                font: { size: 14, color: '#2c3e50' }
            },
            xaxis: {
                title: 'Importance',
                showgrid: true,
                gridcolor: '#e0e0e0'
            },
            yaxis: {
                title: '',
                showgrid: false
            },
            margin: { l: 150, r: 50, t: 50, b: 50 },
            height: 400,
            plot_bgcolor: 'white',
            paper_bgcolor: 'white'
        };
        
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'feature_importance',
                height: 400,
                width: 800,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, [trace], layout, config);
    },

    createConfusionMatrixPlot(confusionMatrix) {
        const container = document.getElementById('confusionMatrixPlot');
        if (!container) return;
        
        const matrix = confusionMatrix.matrix || [
            [confusionMatrix.true_negatives, confusionMatrix.false_positives],
            [confusionMatrix.false_negatives, confusionMatrix.true_positives]
        ];
        
        const trace = {
            z: matrix,
            x: ['Predicted: Normal', 'Predicted: Outlier'],
            y: ['Actual: Normal', 'Actual: Outlier'],
            type: 'heatmap',
            colorscale: [
                [0, '#e8f5e9'],
                [0.5, '#81c784'],
                [1, '#2e7d32']
            ],
            showscale: true,
            colorbar: {
                title: 'Count',
                titleside: 'right'
            },
            text: matrix.map(row => row.map(val => val.toString())),
            texttemplate: '%{text}',
            textfont: { size: 14, color: '#000' },
            hovertemplate: '<b>%{y}</b><br><b>%{x}</b><br>Count: %{z}<extra></extra>'
        };
        
        const layout = {
            title: {
                text: 'Confusion Matrix',
                font: { size: 14, color: '#2c3e50' }
            },
            xaxis: {
                title: '',
                side: 'bottom'
            },
            yaxis: {
                title: '',
                autorange: 'reversed'
            },
            margin: { l: 100, r: 50, t: 50, b: 80 },
            height: 300,
            plot_bgcolor: 'white',
            paper_bgcolor: 'white'
        };
        
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'confusion_matrix',
                height: 300,
                width: 600,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, [trace], layout, config);
    },

    createROCCurvePlot(rocCurve, aucScore) {
        const container = document.getElementById('rocCurvePlot');
        if (!container) return;
        
        // Área bajo la curva (sombreada)
        const areaTrace = {
            x: rocCurve.fpr,
            y: rocCurve.tpr,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: 'rgba(46, 159, 223, 0.3)',
            line: { color: 'transparent' },
            name: `Área bajo la curva (AUC = ${aucScore?.toFixed(3)})`,
            showlegend: false,
            hoverinfo: 'skip'
        };
        
        // Curva ROC principal
        const rocTrace = {
            x: rocCurve.fpr,
            y: rocCurve.tpr,
            type: 'scatter',
            mode: 'lines',
            name: `ROC Curve (AUC = ${aucScore?.toFixed(3)})`,
            line: { 
                color: '#2E9FDF', 
                width: 3,
                shape: 'spline'
            },
            hovertemplate: '<b>FPR:</b> %{x:.3f}<br><b>TPR:</b> %{y:.3f}<extra></extra>'
        };
        
        // Línea diagonal de referencia (AUC = 0.5)
        const diagonalTrace = {
            x: [0, 1],
            y: [0, 1],
            type: 'scatter',
            mode: 'lines',
            name: 'Reference Line (AUC = 0.5)',
            line: { 
                color: '#95a5a6', 
                width: 2, 
                dash: 'dash' 
            },
            hovertemplate: 'Reference line<extra></extra>'
        };
        
        // Anotación con el valor de AUC
        const annotations = [
            {
                x: 0.6,
                y: 0.3,
                text: `AUC = ${aucScore?.toFixed(3)}`,
                showarrow: false,
                font: {
                    size: 16,
                    color: '#2E9FDF',
                    family: 'Arial, sans-serif'
                },
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                bordercolor: '#2E9FDF',
                borderwidth: 2,
                borderpad: 8
            }
        ];
        
        const layout = {
            title: {
                text: 'ROC Curve (Receiver Operating Characteristic)',
                font: { size: 18, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                title: {
                    text: 'False Positive Rate (1 - Specificity)',
                    font: { size: 13, color: '#34495e' }
                },
                range: [0, 1],
                showgrid: true,
                gridcolor: '#ecf0f1',
                gridwidth: 1,
                zeroline: true,
                zerolinecolor: '#bdc3c7',
                zerolinewidth: 1
            },
            yaxis: {
                title: {
                    text: 'True Positive Rate (Sensitivity)',
                    font: { size: 13, color: '#34495e' }
                },
                range: [0, 1],
                showgrid: true,
                gridcolor: '#ecf0f1',
                gridwidth: 1,
                zeroline: true,
                zerolinecolor: '#bdc3c7',
                zerolinewidth: 1
            },
            margin: { l: 90, r: 50, t: 70, b: 70 },
            height: 550,
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            legend: {
                x: 0.02,
                y: 0.98,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 12 }
            },
            annotations: annotations
        };
        
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'roc_curve',
                height: 550,
                width: 900,
                scale: 2
            }
        };
        
        // Orden importante: primero el área sombreada, luego la línea diagonal, y finalmente la curva ROC
        Plotly.newPlot(container, [areaTrace, diagonalTrace, rocTrace], layout, config);
    },

    async runSupervisedPCA() {
        if (!this.selectedDataset || !this.outlierResults) {
            this.showError('Por favor, ejecuta primero la detección de outliers');
            return;
        }

        const button = document.getElementById('runSupervisedPCA');
        if (!button) {
            this.showError('Error: No se pudo encontrar el botón de ejecución');
            return;
        }

        try {
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ejecutando...';
            button.disabled = true;

            // Obtener variables numéricas disponibles del dataset ya cargado
            if (!this.selectedDataset || !this.selectedDataset.variable_types) {
                throw new Error('Información del dataset no disponible. Por favor, selecciona un dataset primero.');
            }
            
            const variableTypes = this.selectedDataset.variable_types || {};
            const numericalVars = Object.keys(variableTypes).filter(v => 
                v !== 'es_outlier' && 
                (variableTypes[v] && (variableTypes[v].includes('cuantitativa') || variableTypes[v].includes('continua')))
            );

            if (numericalVars.length < 2) {
                throw new Error(`Se requieren al menos 2 variables numéricas para PCA. Se encontraron: ${numericalVars.length}`);
            }

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/supervised-pca`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    outlier_results: this.outlierResults,
                    variables: numericalVars
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `HTTP error! status: ${response.status}` }));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            if (results.error) throw new Error(results.error);

            this.displaySupervisedPCAResults(results);
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error en PCA Supervisado: ${error.message}`);
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar PCA Supervisado';
                button.disabled = false;
            }
        }
    },

    displaySupervisedPCAResults(results) {
        const container = document.getElementById('supervisedPCAResults');
        if (!container) {
            this.showError('Error: No se pudo encontrar el contenedor de resultados');
            return;
        }

        let html = '<div class="card"><div class="card-body">';
        
        // Información sobre qué hace el PCA Supervisado
        html += '<div class="alert alert-info mb-4">';
        html += '<h6 class="alert-heading"><i class="fas fa-info-circle me-2"></i>¿Qué hace el PCA Supervisado?</h6>';
        html += '<p class="mb-0">El PCA Supervisado reduce la dimensionalidad de las variables numéricas y visualiza cómo se agrupan los <strong>outliers</strong> (rojos) versus los <strong>datos normales</strong> (azules) en el espacio de componentes principales. Esto permite identificar si los outliers forman grupos distintos o están mezclados con los datos normales.</p>';
        html += '</div>';
        
        if (results.supervised_analysis) {
            html += '<div class="card border-success mb-3">';
            html += '<div class="card-header bg-success text-white"><h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>Análisis Supervisado</h6></div>';
            html += '<div class="card-body">';
            html += `<div>${results.supervised_analysis.interpretation}</div>`;
            
            // Información de conteo
            html += '<div class="row mt-3 mb-3">';
            html += '<div class="col-12"><h6>Conteo de Observaciones</h6></div>';
            html += `<div class="col-md-6"><strong>Outliers finales detectados:</strong> ${results.supervised_analysis.outliers_count_original || results.supervised_analysis.outliers_count || 'N/A'}</div>`;
            html += `<div class="col-md-6"><strong>Datos normales totales:</strong> ${results.supervised_analysis.normals_count_original || results.supervised_analysis.normals_count || 'N/A'}</div>`;
            
            if (results.supervised_analysis.outliers_count_after_dropna !== undefined) {
                html += `<div class="col-md-6 mt-2"><strong>Outliers incluidos en PCA:</strong> ${results.supervised_analysis.outliers_count_after_dropna}</div>`;
                html += `<div class="col-md-6 mt-2"><strong>Normales incluidos en PCA:</strong> ${results.supervised_analysis.normals_count_after_dropna}</div>`;
                
                if (results.supervised_analysis.outliers_excluded > 0 || results.supervised_analysis.normals_excluded > 0) {
                    html += '<div class="col-12 mt-2">';
                    html += '<div class="alert alert-warning py-2 mb-0">';
                    html += '<small><i class="fas fa-info-circle me-1"></i>';
                    html += `${results.supervised_analysis.outliers_excluded || 0} outlier(s) y ${results.supervised_analysis.normals_excluded || 0} dato(s) normal(es) fueron excluidos por tener valores faltantes en alguna variable seleccionada.`;
                    html += '</small></div></div>';
                }
            }
            html += '</div>';
            
            html += '<div class="row mt-3">';
            html += `<div class="col-md-6"><strong>Distancia entre centroides:</strong> ${this.formatScientific(results.supervised_analysis.centroid_distance)}</div>`;
            html += `<div class="col-md-6"><strong>Distancia de Mahalanobis:</strong> ${this.formatScientific(results.supervised_analysis.mahalanobis_distance)}</div>`;
            html += '</div>';
            html += '</div></div>';
        }
        
        // Información del PCA
        if (results.n_components) {
            html += '<div class="card border-primary mb-3">';
            html += '<div class="card-header bg-primary text-white"><h6 class="mb-0"><i class="fas fa-cogs me-2"></i>Configuración del PCA</h6></div>';
            html += '<div class="card-body">';
            html += `<p><strong>Componentes principales recomendados:</strong> ${results.n_components}</p>`;
            html += `<p><strong>Varianza explicada por PC1:</strong> ${(results.explained_variance_ratio[0] * 100).toFixed(2)}%</p>`;
            html += `<p><strong>Varianza explicada por PC2:</strong> ${(results.explained_variance_ratio[1] * 100).toFixed(2)}%</p>`;
            html += `<p><strong>Varianza acumulada (PC1+PC2):</strong> ${(results.cumulative_variance[1] * 100).toFixed(2)}%</p>`;
            html += `<p><strong>Variables analizadas:</strong> ${results.variables_used.length}</p>`;
            html += '</div></div>';
        }
        
        // Reutilizar visualización de PCA existente
        if (results.biplot_data) {
            html += '<div class="card border-info mb-3">';
            html += '<div class="card-header bg-info text-white"><h6 class="mb-0"><i class="fas fa-chart-area me-2"></i>Biplot PCA Supervisado</h6></div>';
            html += '<div class="card-body">';
            html += '<p class="text-muted"><small>Los puntos rojos representan outliers y los azules datos normales. Las flechas verdes muestran la dirección y magnitud de cada variable en el espacio PCA.</small></p>';
            html += `<div id="supervisedPCABiplot" style="min-height: 500px;"></div>`;
            html += '</div></div>';
        } else {
            html += '<div class="alert alert-warning">No se pudo generar el biplot. Verifica que haya suficientes datos.</div>';
        }
        
        html += '</div></div>';
        container.innerHTML = html;

        // Crear biplot si hay datos
        if (results.biplot_data) {
            setTimeout(() => {
                // Pasar los conteos originales al biplot
                const supervisedCounts = results.supervised_analysis ? {
                    outliers_original: results.supervised_analysis.outliers_count_original,
                    normals_original: results.supervised_analysis.normals_count_original,
                    outliers_after_dropna: results.supervised_analysis.outliers_count_after_dropna,
                    normals_after_dropna: results.supervised_analysis.normals_count_after_dropna
                } : null;
                this.createPCABiplot('supervisedPCABiplot', results.biplot_data, results.loadings_labels || results.variables_used, supervisedCounts);
            }, 100);
        }
    },

    createPCABiplot(containerId, biplotData, variableNames, supervisedCounts = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Verificar que tenemos los datos necesarios
        if (!biplotData.pc1 || !biplotData.pc2 || !biplotData.outlier_status) {
            container.innerHTML = '<div class="alert alert-warning">Error: Datos de biplot incompletos</div>';
            return;
        }

        // Separar puntos por grupo (manejar tanto booleanos como strings)
        const outliersIndices = [];
        const normalIndices = [];
        
        biplotData.outlier_status.forEach((status, i) => {
            // Manejar diferentes formatos: string 'Outlier', boolean true, o número 1
            if (status === 'Outlier' || status === true || status === 'true' || status === 1) {
                outliersIndices.push(i);
            } else {
                normalIndices.push(i);
            }
        });

        // Crear scatter plot de puntos
        const outliersX = outliersIndices.map(i => biplotData.pc1[i]);
        const outliersY = outliersIndices.map(i => biplotData.pc2[i]);
        const normalX = normalIndices.map(i => biplotData.pc1[i]);
        const normalY = normalIndices.map(i => biplotData.pc2[i]);

        // SIEMPRE usar conteos originales en la leyenda principal
        const outliersLabel = supervisedCounts && supervisedCounts.outliers_original !== undefined
            ? `Outliers (${supervisedCounts.outliers_original})`
            : `Outliers (${outliersX.length})`;
        const normalsLabel = supervisedCounts && supervisedCounts.normals_original !== undefined
            ? `Normales (${supervisedCounts.normals_original})`
            : `Normales (${normalX.length})`;
        
        // Si hay diferencias, agregar nota en hover
        let outliersHover = '<b>Outlier</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}';
        let normalsHover = '<b>Normal</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}';
        
        if (supervisedCounts && supervisedCounts.outliers_original !== undefined && supervisedCounts.outliers_original !== outliersX.length) {
            outliersHover += `<br><small>${outliersX.length} de ${supervisedCounts.outliers_original} outliers en gráfico</small>`;
        }
        if (supervisedCounts && supervisedCounts.normals_original !== undefined && supervisedCounts.normals_original !== normalX.length) {
            normalsHover += `<br><small>${normalX.length} de ${supervisedCounts.normals_original} normales en gráfico</small>`;
        }

        const outliersTrace = {
            x: outliersX,
            y: outliersY,
            mode: 'markers',
            type: 'scatter',
            name: outliersLabel,
            marker: { 
                color: 'red', 
                size: 12, 
                opacity: 0.8,
                line: { color: 'darkred', width: 1 }
            },
            hovertemplate: outliersHover + '<extra></extra>'
        };

        const normalTrace = {
            x: normalX,
            y: normalY,
            mode: 'markers',
            type: 'scatter',
            name: normalsLabel,
            marker: { 
                color: 'blue', 
                size: 8, 
                opacity: 0.7,
                line: { color: 'darkblue', width: 0.5 }
            },
            hovertemplate: normalsHover + '<extra></extra>'
        };

        const traces = [];
        
        // Agregar primero los puntos normales (para que los outliers queden encima)
        if (normalX.length > 0) {
            traces.push(normalTrace);
        }
        if (outliersX.length > 0) {
            traces.push(outliersTrace);
        }
        
        // Si no hay puntos, mostrar mensaje
        if (traces.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">No se encontraron puntos para mostrar en el biplot.</div>';
            return;
        }

        // Agregar vectores de variables
        const allPC1 = [...outliersX, ...normalX];
        const allPC2 = [...outliersY, ...normalY];
        const maxPC1 = allPC1.length > 0 ? Math.max(...allPC1.map(Math.abs)) : 1;
        const maxPC2 = allPC2.length > 0 ? Math.max(...allPC2.map(Math.abs)) : 1;
        const scale = Math.min(maxPC1, maxPC2) * 0.8;

        variableNames.forEach((varName, idx) => {
            if (biplotData.loadings_pc1 && biplotData.loadings_pc2 && idx < biplotData.loadings_pc1.length) {
                const x_end = biplotData.loadings_pc1[idx] * scale;
                const y_end = biplotData.loadings_pc2[idx] * scale;
                
                traces.push({
                    x: [0, x_end],
                    y: [0, y_end],
                    mode: 'lines+text',
                    type: 'scatter',
                    name: varName,
                    line: { color: 'green', width: 2 },
                    text: ['', varName],
                    textposition: 'top center',
                    showlegend: false
                });
            }
        });

        // Calcular rangos para asegurar que todos los puntos sean visibles
        const allX = [...outliersX, ...normalX];
        const allY = [...outliersY, ...normalY];
        const xRange = allX.length > 0 ? [Math.min(...allX) * 1.1, Math.max(...allX) * 1.1] : undefined;
        const yRange = allY.length > 0 ? [Math.min(...allY) * 1.1, Math.max(...allY) * 1.1] : undefined;

        // Obtener porcentajes de varianza explicada
        const pc1_variance = biplotData.explained_variance_pc1 || biplotData.explained_variance_ratio?.[0] || 0;
        const pc2_variance = biplotData.explained_variance_pc2 || biplotData.explained_variance_ratio?.[1] || 0;

        const layout = {
            title: {
                text: 'Supervised PCA - Outliers vs Normal',
                font: { size: 16 }
            },
            xaxis: { 
                title: pc1_variance > 0 ? `PC1 (${(pc1_variance * 100).toFixed(1)}% variance explained)` : 'PC1',
                showgrid: true,
                zeroline: true,
                range: xRange,
                fixedrange: false  // Permitir zoom
            },
            yaxis: { 
                title: pc2_variance > 0 ? `PC2 (${(pc2_variance * 100).toFixed(1)}% variance explained)` : 'PC2',
                showgrid: true,
                zeroline: true,
                range: yRange,
                fixedrange: false  // Permitir zoom
            },
            hovermode: 'closest',
            legend: {
                x: 1.02,
                y: 1,
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                bordercolor: 'rgba(0, 0, 0, 0.2)',
                borderwidth: 1
            },
            showlegend: true,
            dragmode: 'zoom',  // Permitir zoom arrastrando
            autosize: true
        };

        const config = {
            responsive: true,
            scrollZoom: true,  // Habilitar zoom con scroll
            displayModeBar: true,
            modeBarButtonsToAdd: ['drawline', 'drawopenpath', 'drawclosedpath', 'drawcircle', 'drawrect', 'eraseshape'],
            modeBarButtonsToRemove: [],
            displaylogo: false,
            toImageButtonOptions: {
                format: 'png',
                filename: 'pca_supervisado',
                height: 800,
                width: 1200,
                scale: 2
            }
        };

        Plotly.newPlot(container, traces, layout, config);
        
        // Agregar botón para tamaño completo
        const plotContainer = container.parentElement;
        if (plotContainer && !plotContainer.querySelector('.btn-fullscreen-pca')) {
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.className = 'btn btn-sm btn-outline-primary btn-fullscreen-pca mt-2';
            fullscreenBtn.innerHTML = '<i class="fas fa-expand me-1"></i>Ver en tamaño completo';
            fullscreenBtn.onclick = () => {
                this.showFullscreenPCA(traces, layout, config);
            };
            plotContainer.appendChild(fullscreenBtn);
        }
    },

    showFullscreenPCA(traces, layout, config) {
        // Crear modal para mostrar el gráfico en tamaño completo
        const modalId = 'pcaFullscreenModal';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'pcaFullscreenModalLabel');
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="pcaFullscreenModalLabel">PCA Supervisado - Vista Completa</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-3">
                            <div id="pcaFullscreenPlot" style="width: 100%; height: calc(100vh - 150px);"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // Mostrar modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Crear gráfico en el modal después de que se muestre
        modal.addEventListener('shown.bs.modal', function onShown() {
            const plotContainer = document.getElementById('pcaFullscreenPlot');
            if (plotContainer) {
                Plotly.newPlot(plotContainer, traces, layout, config);
            }
            modal.removeEventListener('shown.bs.modal', onShown);
        }, { once: true });
    },

    async runNetworkAnalysis() {
        if (!this.selectedDataset || !this.outlierResults) {
            this.showError('Por favor, ejecuta primero la detección de outliers');
            return;
        }

        try {
            const button = document.getElementById('runNetworkAnalysis');
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ejecutando...';
            button.disabled = true;

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/network-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outlier_results: this.outlierResults })
            });

            if (!response.ok) {
                const errorData = await response.json();
                // Si el error viene con información adicional (outliers_detected, normal_records, minimum_required)
                if (errorData.detail && typeof errorData.detail === 'object' && errorData.detail.error) {
                    const errorInfo = errorData.detail;
                    const container = document.getElementById('networkAnalysisResults');
                    if (container) {
                        container.innerHTML = `
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                <strong>Datos insuficientes:</strong> ${errorInfo.error}
                                ${errorInfo.outliers_detected !== undefined ? `<br><small>Outliers detectados: ${errorInfo.outliers_detected} | Mínimo requerido: ${errorInfo.minimum_required}</small>` : ''}
                                ${errorInfo.normal_records !== undefined ? `<br><small>Registros normales: ${errorInfo.normal_records} | Mínimo requerido: ${errorInfo.minimum_required}</small>` : ''}
                            </div>
                        `;
                    }
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            if (results.error) {
                // Mostrar información detallada si está disponible
                const container = document.getElementById('networkAnalysisResults');
                if (container && (results.outliers_detected !== undefined || results.normal_records !== undefined || results.minimum_required !== undefined)) {
                    container.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Datos insuficientes:</strong> ${results.error}
                            ${results.outliers_detected !== undefined ? `<br><small>Outliers detectados: ${results.outliers_detected} | Mínimo requerido: ${results.minimum_required}</small>` : ''}
                            ${results.normal_records !== undefined ? `<br><small>Registros normales: ${results.normal_records} | Mínimo requerido: ${results.minimum_required}</small>` : ''}
                        </div>
                    `;
                    button.innerHTML = originalText;
                    button.disabled = false;
                    return;
                }
                throw new Error(results.error);
            }

            this.displayNetworkAnalysisResults(results);
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error: ${error.message}`);
            const button = document.getElementById('runNetworkAnalysis');
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar Análisis de Redes';
                button.disabled = false;
            }
        }
    },

    displayNetworkAnalysisResults(results) {
        const container = document.getElementById('networkAnalysisResults');
        if (!container) return;

        let html = '<div class="card"><div class="card-body">';
        html += `<h5 class="mb-4"><i class="fas fa-network-wired me-2"></i>Análisis de Redes de Co-expresión</h5>`;
        html += `<div class="alert alert-info mb-4">${results.interpretation}</div>`;
        
        // Panel de resumen comparativo
        html += '<div class="row mb-4">';
        html += `<div class="col-md-4"><div class="card border-danger"><div class="card-body text-center"><h5 class="text-danger">${results.outliers_network.n_nodes}</h5><small class="text-muted">Nodos (Outliers)</small><br><small class="text-muted">${results.outliers_network.n_edges} conexiones</small></div></div></div>`;
        html += `<div class="col-md-4"><div class="card border-success"><div class="card-body text-center"><h5 class="text-success">${results.normal_network.n_nodes}</h5><small class="text-muted">Nodos (Normales)</small><br><small class="text-muted">${results.normal_network.n_edges} conexiones</small></div></div></div>`;
        html += `<div class="col-md-4"><div class="card border-warning"><div class="card-body text-center"><h5 class="text-warning">${results.hubs_comparison?.common?.length || 0}</h5><small class="text-muted">Hubs Comunes</small><br><small class="text-muted">${results.hubs_comparison?.only_outliers?.length || 0} solo outliers, ${results.hubs_comparison?.only_normal?.length || 0} solo normales</small></div></div></div>`;
        html += '</div>';
        
        // Gráfico integrado comparativo
        html += '<div class="row mb-4">';
        html += '<div class="col-12">';
        html += '<h6 class="mb-3"><i class="fas fa-project-diagram me-2"></i>Red Comparativa Integrada (Normales vs Outliers)</h6>';
        html += '<div class="alert alert-info mb-3">';
        html += '<strong>Interpretación:</strong> Este gráfico muestra ambas redes superpuestas. Los cambios en hubs se destacan visualmente: ';
        html += '<ul class="mb-0 mt-2">';
        html += '<li><strong>Hubs principales:</strong> Nodos con borde grueso y tamaño grande</li>';
        html += '<li><strong>Cambios en hubs:</strong> Compara qué variables son hubs en cada grupo</li>';
        html += '<li><strong>Centralidad:</strong> El tamaño del nodo refleja su grado de conexión</li>';
        html += '</ul>';
        html += '</div>';
        html += '<div id="comparativeNetworkPlot"></div>';
        html += '</div>';
        html += '</div>';
        
        // Diagramas separados para referencia
        html += '<div class="row mb-4">';
        html += '<div class="col-md-6">';
        html += '<h6 class="mb-3"><i class="fas fa-project-diagram me-2"></i>Outliers Network</h6>';
        html += '<div id="outliersNetworkPlot"></div>';
        html += '</div>';
        html += '<div class="col-md-6">';
        html += '<h6 class="mb-3"><i class="fas fa-project-diagram me-2"></i>Normal Network</h6>';
        html += '<div id="normalNetworkPlot"></div>';
        html += '</div>';
        html += '</div>';
        
        // Comparación de hubs
        if (results.hubs_comparison) {
            html += '<div class="row mb-4">';
            html += '<div class="col-12">';
            html += '<h6 class="mb-3"><i class="fas fa-exchange-alt me-2"></i>Hub Changes</h6>';
            html += '<div class="card">';
            html += '<div class="card-body">';
            
            if (results.hubs_comparison.only_outliers.length > 0) {
                html += `<p class="text-danger"><strong>Hubs solo en Outliers:</strong> ${results.hubs_comparison.only_outliers.join(', ')}</p>`;
                html += '<p class="text-muted"><small>Estas variables ganan importancia como hubs en outliers, sugiriendo cambios en la arquitectura de la red.</small></p>';
            }
            
            if (results.hubs_comparison.only_normal.length > 0) {
                html += `<p class="text-success"><strong>Hubs only in Normal:</strong> ${results.hubs_comparison.only_normal.join(', ')}</p>`;
                html += '<p class="text-muted"><small>These variables lose importance as hubs in outliers.</small></p>';
            }
            
            if (results.hubs_comparison.common.length > 0) {
                html += `<p class="text-info"><strong>Common Hubs:</strong> ${results.hubs_comparison.common.join(', ')}</p>`;
                html += '<p class="text-muted"><small>These variables maintain their importance as hubs in both groups.</small></p>';
            }
            
            html += '</div></div>';
            html += '</div></div>';
        }
        
        // Comparación de centralidad
        if (results.centrality_comparison.length > 0) {
            html += '<h6 class="mt-4 mb-3"><i class="fas fa-chart-bar me-2"></i>Comparación de Centralidad</h6>';
            html += '<div class="table-responsive"><table class="table table-sm table-hover"><thead><tr><th>Variable</th><th>Centralidad Outliers</th><th>Centralidad Normales</th><th>Diferencia</th><th>Interpretación</th></tr></thead><tbody>';
            results.centrality_comparison.slice(0, 15).forEach(comp => {
                const diffClass = comp.difference > 0 ? 'text-danger' : 'text-success';
                html += `<tr><td><strong>${comp.variable}</strong></td><td>${comp.outliers_degree_centrality.toFixed(3)}</td><td>${comp.normal_degree_centrality.toFixed(3)}</td><td class="${diffClass}">${comp.difference > 0 ? '+' : ''}${comp.difference.toFixed(3)}</td><td><small>${comp.interpretation}</small></td></tr>`;
            });
            html += '</tbody></table></div>';
        }
        
        html += '</div></div>';
        container.innerHTML = html;
        
        // Crear visualización comparativa integrada
        this.createComparativeNetworkPlot(results.outliers_network, results.normal_network, results.hubs_comparison);
        
        // Crear visualizaciones de redes separadas
        this.createNetworkPlot('outliersNetworkPlot', results.outliers_network, 'Outliers Network', '#dc3545');
        this.createNetworkPlot('normalNetworkPlot', results.normal_network, 'Normal Network', '#28a745');
    },

    createComparativeNetworkPlot(outliersNetwork, normalNetwork, hubsComparison) {
        const container = document.getElementById('comparativeNetworkPlot');
        if (!container || !outliersNetwork.nodes_data || !normalNetwork.nodes_data) return;
        
        // Combinar todos los nodos únicos
        const allNodesMap = new Map();
        
        // Añadir nodos de outliers
        outliersNetwork.nodes_data.forEach(node => {
            allNodesMap.set(node.id, {
                ...node,
                outliers_degree: node.degree,
                outliers_centrality: node.degree_centrality,
                outliers_is_hub: node.is_hub,
                normal_degree: 0,
                normal_centrality: 0,
                normal_is_hub: false
            });
        });
        
        // Añadir/actualizar con nodos de normales
        normalNetwork.nodes_data.forEach(node => {
            if (allNodesMap.has(node.id)) {
                const existing = allNodesMap.get(node.id);
                existing.normal_degree = node.degree;
                existing.normal_centrality = node.degree_centrality;
                existing.normal_is_hub = node.is_hub;
            } else {
                allNodesMap.set(node.id, {
                    ...node,
                    outliers_degree: 0,
                    outliers_centrality: 0,
                    outliers_is_hub: false,
                    normal_degree: node.degree,
                    normal_centrality: node.degree_centrality,
                    normal_is_hub: node.is_hub
                });
            }
        });
        
        const allNodes = Array.from(allNodesMap.values());
        
        // Identificar cambios en hubs
        const hubChanges = {
            onlyOutliers: hubsComparison?.only_outliers || [],
            onlyNormal: hubsComparison?.only_normal || [],
            common: hubsComparison?.common || []
        };
        
        // Calcular posiciones usando layout circular mejorado
        const nNodes = allNodes.length;
        const radius = 4;
        const centerX = 0;
        const centerY = 0;
        
        const nodePositions = {};
        allNodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nNodes;
            nodePositions[node.id] = {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            };
        });
        
        // Crear trazas de edges para outliers (rojo)
        const outliersEdgeTraces = [];
        outliersNetwork.edges.forEach(edge => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            
            if (sourcePos && targetPos) {
                outliersEdgeTraces.push({
                    x: [sourcePos.x, targetPos.x],
                    y: [sourcePos.y, targetPos.y],
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                        color: edge.correlation > 0 ? 'rgba(220, 53, 69, 0.2)' : 'rgba(220, 53, 69, 0.15)',
                        width: Math.abs(edge.correlation) * 2,
                        dash: 'dot'
                    },
                    showlegend: false,
                    hoverinfo: 'skip',
                    name: 'Outliers Connection'
                });
            }
        });
        
        // Crear trazas de edges para normales (verde)
        const normalEdgeTraces = [];
        normalNetwork.edges.forEach(edge => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            
            if (sourcePos && targetPos) {
                normalEdgeTraces.push({
                    x: [sourcePos.x, targetPos.x],
                    y: [sourcePos.y, targetPos.y],
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                        color: edge.correlation > 0 ? 'rgba(40, 167, 69, 0.2)' : 'rgba(40, 167, 69, 0.15)',
                        width: Math.abs(edge.correlation) * 2
                    },
                    showlegend: false,
                    hoverinfo: 'skip',
                    name: 'Normal Connection'
                });
            }
        });
        
        // Crear trazas de nodos con información comparativa
        const nodeTraces = [];
        
        // Nodos que son hubs solo en outliers (nuevos hubs)
        const onlyOutliersHubs = allNodes.filter(n => hubChanges.onlyOutliers.includes(n.id));
        if (onlyOutliersHubs.length > 0) {
            nodeTraces.push({
                x: onlyOutliersHubs.map(n => nodePositions[n.id].x),
                y: onlyOutliersHubs.map(n => nodePositions[n.id].y),
                mode: 'markers+text',
                type: 'scatter',
                text: onlyOutliersHubs.map(n => n.label),
                textposition: 'middle center',
                textfont: { size: 11, color: '#fff', family: 'Arial, sans-serif' },
                marker: {
                    size: onlyOutliersHubs.map(n => 20 + n.outliers_degree * 3),
                    color: '#dc3545',
                    line: { color: '#8b0000', width: 3 },
                    opacity: 0.9
                },
                customdata: onlyOutliersHubs.map(n => ({
                    label: n.label,
                    outliers_degree: n.outliers_degree,
                    outliers_centrality: n.outliers_centrality.toFixed(3),
                    normal_degree: n.normal_degree,
                    normal_centrality: n.normal_centrality.toFixed(3),
                    category: n.category,
                    status: 'New Hub (Outliers only)'
                })),
                hovertemplate: '<b>%{text}</b><br>' +
                              '<b style="color:#dc3545;">NEW HUB (Outliers only)</b><br>' +
                              'Outliers Centrality: %{customdata.outliers_centrality}<br>' +
                              'Normal Centrality: %{customdata.normal_centrality}<br>' +
                              'Outliers Degree: %{customdata.outliers_degree}<br>' +
                              'Category: %{customdata.category}<br>' +
                              '<extra></extra>',
                name: 'New Hubs (Outliers only)',
                legendgroup: 'hubs'
            });
        }
        
        // Nodos que son hubs solo en normales (hubs perdidos)
        const onlyNormalHubs = allNodes.filter(n => hubChanges.onlyNormal.includes(n.id));
        if (onlyNormalHubs.length > 0) {
            nodeTraces.push({
                x: onlyNormalHubs.map(n => nodePositions[n.id].x),
                y: onlyNormalHubs.map(n => nodePositions[n.id].y),
                mode: 'markers+text',
                type: 'scatter',
                text: onlyNormalHubs.map(n => n.label),
                textposition: 'middle center',
                textfont: { size: 11, color: '#fff', family: 'Arial, sans-serif' },
                marker: {
                    size: onlyNormalHubs.map(n => 20 + n.normal_degree * 3),
                    color: '#28a745',
                    line: { color: '#155724', width: 3 },
                    opacity: 0.9
                },
                customdata: onlyNormalHubs.map(n => ({
                    label: n.label,
                    outliers_degree: n.outliers_degree,
                    outliers_centrality: n.outliers_centrality.toFixed(3),
                    normal_degree: n.normal_degree,
                    normal_centrality: n.normal_centrality.toFixed(3),
                    category: n.category,
                    status: 'Lost Hub (Normal only)'
                })),
                hovertemplate: '<b>%{text}</b><br>' +
                              '<b style="color:#28a745;">LOST HUB (Normal only)</b><br>' +
                              'Outliers Centrality: %{customdata.outliers_centrality}<br>' +
                              'Normal Centrality: %{customdata.normal_centrality}<br>' +
                              'Normal Degree: %{customdata.normal_degree}<br>' +
                              'Category: %{customdata.category}<br>' +
                              '<extra></extra>',
                name: 'Lost Hubs (Normal only)',
                legendgroup: 'hubs'
            });
        }
        
        // Nodos que son hubs comunes
        const commonHubs = allNodes.filter(n => hubChanges.common.includes(n.id));
        if (commonHubs.length > 0) {
            nodeTraces.push({
                x: commonHubs.map(n => nodePositions[n.id].x),
                y: commonHubs.map(n => nodePositions[n.id].y),
                mode: 'markers+text',
                type: 'scatter',
                text: commonHubs.map(n => n.label),
                textposition: 'middle center',
                textfont: { size: 11, color: '#fff', family: 'Arial, sans-serif' },
                marker: {
                    size: commonHubs.map(n => 20 + Math.max(n.outliers_degree, n.normal_degree) * 3),
                    color: '#ffc107',
                    line: { color: '#856404', width: 3 },
                    opacity: 0.9
                },
                customdata: commonHubs.map(n => ({
                    label: n.label,
                    outliers_degree: n.outliers_degree,
                    outliers_centrality: n.outliers_centrality.toFixed(3),
                    normal_degree: n.normal_degree,
                    normal_centrality: n.normal_centrality.toFixed(3),
                    category: n.category,
                    status: 'Common Hub'
                })),
                hovertemplate: '<b>%{text}</b><br>' +
                              '<b style="color:#ffc107;">COMMON HUB</b><br>' +
                              'Outliers Centrality: %{customdata.outliers_centrality}<br>' +
                              'Normal Centrality: %{customdata.normal_centrality}<br>' +
                              'Category: %{customdata.category}<br>' +
                              '<extra></extra>',
                name: 'Common Hubs',
                legendgroup: 'hubs'
            });
        }
        
        // Nodos no-hubs
        const nonHubs = allNodes.filter(n => 
            !hubChanges.onlyOutliers.includes(n.id) && 
            !hubChanges.onlyNormal.includes(n.id) && 
            !hubChanges.common.includes(n.id)
        );
        if (nonHubs.length > 0) {
            nodeTraces.push({
                x: nonHubs.map(n => nodePositions[n.id].x),
                y: nonHubs.map(n => nodePositions[n.id].y),
                mode: 'markers+text',
                type: 'scatter',
                text: nonHubs.map(n => n.label),
                textposition: 'middle center',
                textfont: { size: 9, color: '#2c3e50', family: 'Arial, sans-serif' },
                marker: {
                    size: nonHubs.map(n => 10 + Math.max(n.outliers_degree, n.normal_degree) * 2),
                    color: nonHubs.map(n => n.category === 'gen' ? '#3498db' : '#e74c3c'),
                    line: { color: '#95a5a6', width: 1 },
                    opacity: 0.6
                },
                customdata: nonHubs.map(n => ({
                    label: n.label,
                    outliers_degree: n.outliers_degree,
                    outliers_centrality: n.outliers_centrality.toFixed(3),
                    normal_degree: n.normal_degree,
                    normal_centrality: n.normal_centrality.toFixed(3),
                    category: n.category
                })),
                hovertemplate: '<b>%{text}</b><br>' +
                              'Outliers Centrality: %{customdata.outliers_centrality}<br>' +
                              'Normal Centrality: %{customdata.normal_centrality}<br>' +
                              'Category: %{customdata.category}<br>' +
                              '<extra></extra>',
                name: 'Other Nodes',
                legendgroup: 'nonhubs'
            });
        }
        
        const layout = {
            title: {
                text: 'Comparative Co-expression Network: Normal vs Outliers',
                font: { size: 16, color: '#2c3e50', family: 'Arial, sans-serif' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-6, 6]
            },
            yaxis: {
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-6, 6],
                scaleanchor: 'x',
                scaleratio: 1
            },
            height: 700,
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            showlegend: true,
            legend: {
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                bordercolor: '#bdc3c7',
                borderwidth: 1,
                font: { size: 11 }
            },
            annotations: [
                {
                    x: -5,
                    y: 5.5,
                    text: '<b>Red dashed lines:</b> Outliers connections<br><b>Green solid lines:</b> Normal connections',
                    showarrow: false,
                    xref: 'x',
                    yref: 'y',
                    font: { size: 10, color: '#7f8c8d' },
                    bgcolor: 'rgba(255, 255, 255, 0.8)',
                    bordercolor: '#bdc3c7',
                    borderwidth: 1,
                    borderpad: 5
                }
            ]
        };
        
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'comparative_network',
                height: 700,
                width: 1000,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, [...normalEdgeTraces, ...outliersEdgeTraces, ...nodeTraces], layout, config);
    },

    createNetworkPlot(containerId, networkData, title, color) {
        const container = document.getElementById(containerId);
        if (!container || !networkData.nodes_data || !networkData.edges) return;
        
        // Preparar datos para visualización tipo force-directed graph usando scatter
        // Usaremos un layout circular simplificado para visualización
        
        const nodes = networkData.nodes_data;
        const edges = networkData.edges;
        
        // Calcular posiciones usando layout circular
        const nNodes = nodes.length;
        const radius = 3;
        const centerX = 0;
        const centerY = 0;
        
        const nodePositions = {};
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nNodes;
            nodePositions[node.id] = {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            };
        });
        
        // Crear trazas de edges (conexiones)
        const edgeTraces = [];
        edges.forEach(edge => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            
            if (sourcePos && targetPos) {
                edgeTraces.push({
                    x: [sourcePos.x, targetPos.x],
                    y: [sourcePos.y, targetPos.y],
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                        color: edge.correlation > 0 ? 'rgba(46, 159, 223, 0.3)' : 'rgba(220, 53, 69, 0.3)',
                        width: Math.abs(edge.correlation) * 3
                    },
                    showlegend: false,
                    hoverinfo: 'skip'
                });
            }
        });
        
        // Crear trazas de nodos
        const nodeTrace = {
            x: nodes.map(n => nodePositions[n.id].x),
            y: nodes.map(n => nodePositions[n.id].y),
            mode: 'markers+text',
            type: 'scatter',
            text: nodes.map(n => n.label),
            textposition: 'middle center',
            textfont: {
                size: 10,
                color: '#2c3e50'
            },
            marker: {
                size: nodes.map(n => 15 + n.degree * 5),
                color: nodes.map(n => {
                    if (n.is_hub) return color;
                    return n.category === 'gen' ? '#3498db' : '#e74c3c';
                }),
                line: {
                    color: nodes.map(n => n.is_hub ? '#2c3e50' : 'white'),
                    width: nodes.map(n => n.is_hub ? 2 : 1)
                },
                opacity: 0.8
            },
            customdata: nodes.map(n => ({
                degree: n.degree,
                degree_centrality: n.degree_centrality.toFixed(3),
                betweenness_centrality: n.betweenness_centrality.toFixed(3),
                category: n.category,
                is_hub: n.is_hub
            })),
            hovertemplate: '<b>%{text}</b><br>' +
                          'Degree: %{customdata.degree}<br>' +
                          'Degree Centrality: %{customdata.degree_centrality}<br>' +
                          'Category: %{customdata.category}<br>' +
                          '<extra></extra>',
            name: title
        };
        
        const layout = {
            title: {
                text: title,
                font: { size: 14, color: '#2c3e50' }
            },
            xaxis: {
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-5, 5]
            },
            yaxis: {
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-5, 5],
                scaleanchor: 'x',
                scaleratio: 1
            },
            height: 400,
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            showlegend: false
        };
        
        const config = {
            responsive: true,
            displayModeBar: true,
            toImageButtonOptions: {
                format: 'png',
                filename: `network_${title.toLowerCase()}`,
                height: 400,
                width: 500,
                scale: 2
            }
        };
        
        Plotly.newPlot(container, [...edgeTraces, nodeTrace], layout, config);
    },

    async runSurvivalAnalysis() {
        if (!this.selectedDataset || !this.outlierResults) {
            this.showError('Por favor, ejecuta primero la detección de outliers');
            return;
        }

        const timeVar = document.getElementById('survivalTimeVariable')?.value;
        const eventVar = document.getElementById('survivalEventVariable')?.value;

        if (!timeVar || !eventVar) {
            this.showError('Por favor, selecciona las variables de tiempo y evento');
            return;
        }

        try {
            const button = document.getElementById('runSurvivalAnalysis');
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ejecutando...';
            button.disabled = true;

            const response = await fetch(`/api/analyze-viz/${this.selectedDataset.filename}/survival-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    outlier_results: this.outlierResults,
                    time_variable: timeVar,
                    event_variable: eventVar
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            if (results.error) throw new Error(results.error);

            this.displaySurvivalAnalysisResults(results);
            button.innerHTML = originalText;
            button.disabled = false;

        } catch (error) {
            this.showError(`Error: ${error.message}`);
            const button = document.getElementById('runSurvivalAnalysis');
            if (button) {
                button.innerHTML = '<i class="fas fa-play me-2"></i>Ejecutar Análisis de Supervivencia';
                button.disabled = false;
            }
        }
    },

    formatScientific(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return 'N/A';
        }
        const absValue = Math.abs(value);
        if (absValue < 0.001 && absValue > 0) {
            return value.toExponential(2);
        } else if (absValue >= 0.001 && absValue < 1000) {
            return value.toFixed(3);
        } else {
            return value.toExponential(2);
        }
    },

    displaySurvivalAnalysisResults(results) {
        const container = document.getElementById('survivalAnalysisResults');
        if (!container) return;

        let html = '<div class="card"><div class="card-body">';
        html += `<h6>Análisis de Supervivencia</h6>`;
        html += `<p>${results.interpretation}</p>`;
        
        html += `<h6 class="mt-3">Test de Log-Rank</h6>`;
        html += `<p>Estadístico: ${results.logrank_test.test_statistic?.toFixed(3) || 'N/A'}, P-Valor: ${results.logrank_test.p_value?.toFixed(4) || 'N/A'}</p>`;
        html += `<p>${results.logrank_test.interpretation}</p>`;
        
        if (results.median_survival.outliers !== null || results.median_survival.normal !== null) {
            html += `<h6 class="mt-3">Medianas de Supervivencia</h6>`;
            html += `<p>Outliers: ${results.median_survival.outliers?.toFixed(2) || 'No alcanzada'}</p>`;
            html += `<p>Normales: ${results.median_survival.normal?.toFixed(2) || 'No alcanzada'}</p>`;
        }
        
        if (results.cox_model && !results.cox_model.error) {
            html += `<h6 class="mt-3">Modelo de Cox</h6>`;
            html += `<p>Hazard Ratio: ${results.cox_model.hazard_ratio?.toFixed(3) || 'N/A'}</p>`;
            html += `<p>P-Valor: ${results.cox_model.p_value?.toFixed(4) || 'N/A'}</p>`;
            html += `<p>${results.cox_model.interpretation}</p>`;
        }
        
        // Crear gráfico de curvas de supervivencia
        html += `<div id="survivalCurvesPlot"></div>`;
        
        html += '</div></div>';
        container.innerHTML = html;

        // Crear gráfico de curvas de Kaplan-Meier
        setTimeout(() => {
            this.createSurvivalCurvesPlot('survivalCurvesPlot', results.survival_curves);
        }, 100);
    },

    createSurvivalCurvesPlot(containerId, survivalCurves) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const outliersTrace = {
            x: survivalCurves.outliers.times,
            y: survivalCurves.outliers.survival_probability,
            mode: 'lines',
            type: 'scatter',
            name: 'Outliers',
            line: { color: 'red', width: 2 }
        };

        const normalTrace = {
            x: survivalCurves.normal.times,
            y: survivalCurves.normal.survival_probability,
            mode: 'lines',
            type: 'scatter',
            name: 'Normales',
            line: { color: 'blue', width: 2 }
        };

        const layout = {
            title: 'Curvas de Supervivencia de Kaplan-Meier',
            xaxis: { title: 'Tiempo' },
            yaxis: { title: 'Probabilidad de Supervivencia', range: [0, 1] },
            hovermode: 'closest'
        };

        Plotly.newPlot(container, [outliersTrace, normalTrace], layout, { responsive: true });
    },

    async loadComprehensiveTabVariables() {
        // Cargar variables en los selectores del tab de Marco Analítico Completo
        if (!this.selectedDataset) {
            return;
        }

        try {
            
            // Usar variable_types directamente de selectedDataset
            const variableTypes = this.selectedDataset.variable_types || {};
            
            // Cargar variables en el selector de predictores (siempre, incluso si el accordion no está expandido)
            await this.loadPredictorVariables();

            // Cargar variables en los selectores de supervivencia
            const timeSelect = document.getElementById('survivalTimeVariable');
            const eventSelect = document.getElementById('survivalEventVariable');
            
            if (timeSelect) {
                timeSelect.innerHTML = '<option value="">Seleccionar variable de tiempo...</option>';
                Object.keys(variableTypes).forEach(varName => {
                    if (varName !== 'es_outlier' && this.isNumericVariable(variableTypes[varName])) {
                        const option = document.createElement('option');
                        option.value = varName;
                        option.textContent = varName;
                        timeSelect.appendChild(option);
                    }
                });
            }

            if (eventSelect) {
                eventSelect.innerHTML = '<option value="">Seleccionar variable de evento...</option>';
                Object.keys(variableTypes).forEach(varName => {
                    if (varName !== 'es_outlier' && this.isCategoricalVariable(variableTypes[varName])) {
                        const option = document.createElement('option');
                        option.value = varName;
                        option.textContent = varName;
                        eventSelect.appendChild(option);
                    }
                });
            }
        } catch (error) {
        }
    },

    async loadPredictorVariables() {
        // Cargar variables en el selector de predictores
        if (!this.selectedDataset) {
            return;
        }

        try {
            const predictorSelect = document.getElementById('predictorVariables');
            if (!predictorSelect) {
                return;
            }

            
            // Usar variable_types directamente de selectedDataset, o obtenerlo si no está disponible
            let variableTypes = this.selectedDataset.variable_types || {};
            
            // Si no tiene variable_types, intentar obtenerlo del endpoint /load
            if (Object.keys(variableTypes).length === 0) {
                try {
                    const response = await fetch(`/api/datasets/${encodeURIComponent(this.selectedDataset.filename)}/load`);
                    if (response.ok) {
                        const datasetInfo = await response.json();
                        variableTypes = datasetInfo.variable_types || {};
                        // Actualizar selectedDataset con los variable_types obtenidos
                        this.selectedDataset.variable_types = variableTypes;
                    }
                } catch (e) {
                }
            }
            
            
            // Limpiar selector
            predictorSelect.innerHTML = '';
            
            let variablesAdded = 0;
            let numericCount = 0;
            let categoricalCount = 0;
            
            Object.keys(variableTypes).forEach(varName => {
                if (varName === 'es_outlier') {
                    return;
                }
                
                const varType = variableTypes[varName];
                const isNumeric = this.isNumericVariable(varType);
                const isCategorical = this.isCategoricalVariable(varType);
                
                
                if (isNumeric || isCategorical) {
                    const option = document.createElement('option');
                    option.value = varName;
                    option.textContent = varName;
                    predictorSelect.appendChild(option);
                    variablesAdded++;
                    if (isNumeric) numericCount++;
                    if (isCategorical) categoricalCount++;
                }
            });
            
            
            if (variablesAdded === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No hay variables disponibles';
                option.disabled = true;
                predictorSelect.appendChild(option);
            }
        } catch (error) {
            const predictorSelect = document.getElementById('predictorVariables');
            if (predictorSelect) {
                predictorSelect.innerHTML = '<option value="">Error al cargar variables</option>';
            }
        }
    },

    isNumericVariable(varType) {
        return varType && (varType.includes('cuantitativa') || varType.includes('continua') || varType.includes('discreta'));
    },

    isCategoricalVariable(varType) {
        return varType && (varType.includes('cualitativa') || varType.includes('nominal') || varType.includes('ordinal'));
    }

};

// Close the if block
}

// Make module available globally
