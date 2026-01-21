// JS logic of the load_data tab

const loadDataModule = {
    app: null,
    currentEditingDataset: null,

    init(app) {
        this.app = app;
        this.setupEventListeners();
        this.renderDatasets();
    },

    async updateContent(app) {
        this.app = app;
        // Re-renderizar datasets para asegurar que se muestren los más recientes
        this.renderDatasets();
    },

    setupEventListeners() {
        
        // File input change - configuración para validación inmediata
        this.setupFileInputListener();

        // Drag and drop
        const uploadArea = document.getElementById('uploadArea');
        
        if (uploadArea) {
            uploadArea.addEventListener('click', () => {
                document.getElementById('fileInput').click();
            });

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                if (e.dataTransfer.files.length > 0) {
                    // Validar y mostrar feedback inmediato
                    const file = e.dataTransfer.files[0];
                    const validationResult = this.validateFile(file);
                    this.showFileValidationFeedback(file, validationResult);
                } else {
                    this.app.showError('No se detectó ningún archivo en el arrastre');
                }
            });
        }
        
    },

    validateFile(file) {
        /**
         * Valida un archivo antes de subirlo al servidor.
         * Retorna objeto con {valid: boolean, errors: string[]}
         */
        const errors = [];
        const MAX_FILE_SIZE_MB = 500; // Debe coincidir con el backend
        const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        // Validar que el archivo existe
        if (!file) {
            errors.push('No se seleccionó ningún archivo');
            return { valid: false, errors };
        }
        
        // Validar nombre del archivo
        if (!file.name || file.name.trim() === '') {
            errors.push('El archivo no tiene un nombre válido');
        }
        
        // Validar extensión del archivo
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
            errors.push(
                `Formato de archivo no soportado (${fileExtension}). ` +
                `Solo se permiten archivos CSV (.csv) y Excel (.xlsx, .xls)`
            );
        }
        
        // Validar tamaño del archivo
        if (file.size === 0) {
            errors.push('El archivo está vacío');
        } else if (file.size > MAX_FILE_SIZE_BYTES) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            errors.push(
                `El archivo es demasiado grande (${fileSizeMB} MB). ` +
                `El tamaño máximo permitido es ${MAX_FILE_SIZE_MB} MB`
            );
        }
        
        // Validar tipo MIME si está disponible
        if (file.type) {
            const allowedMimeTypes = [
                'text/csv',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ];
            
            // Solo validar si el tipo MIME está disponible y no es genérico
            if (file.type !== 'application/octet-stream' && !allowedMimeTypes.includes(file.type)) {
                // Advertencia pero no bloqueo, ya que algunos navegadores no detectan bien los tipos MIME
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    showFileValidationFeedback(file, validationResult) {
        /**
         * Muestra feedback visual inmediato sobre la validación del archivo.
         */
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;
        
        // Remover clases de estado previas
        uploadArea.classList.remove('file-valid', 'file-invalid', 'file-validating');
        
        if (!validationResult.valid) {
            // Archivo inválido - mostrar errores
            uploadArea.classList.add('file-invalid');
            
            // Actualizar contenido del área de carga con errores
            const errorHTML = `
                <div class="upload-content">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <h5 class="text-danger">Archivo inválido</h5>
                    <ul class="text-danger text-start small mt-2">
                        ${validationResult.errors.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                    <p class="text-muted small mt-2">Por favor selecciona un archivo válido</p>
                    <button class="btn btn-primary mt-2" onclick="document.getElementById('fileInput').click()">
                        <i class="fas fa-folder-open me-2"></i>
                        Seleccionar Otro Archivo
                    </button>
                </div>
            `;
            uploadArea.innerHTML = errorHTML;
            
            // Restaurar contenido original después de 5 segundos
            setTimeout(() => {
                this.restoreUploadArea();
            }, 5000);
        } else {
            // Archivo válido - mostrar información del archivo
            uploadArea.classList.add('file-valid');
            
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const fileSizeKB = (file.size / 1024).toFixed(2);
            const displaySize = file.size < 1024 * 1024 ? `${fileSizeKB} KB` : `${fileSizeMB} MB`;
            
            const validHTML = `
                <div class="upload-content">
                    <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                    <h5 class="text-success">Archivo válido</h5>
                    <p class="mb-1"><strong>${file.name}</strong></p>
                    <p class="text-muted small mb-2">Tamaño: ${displaySize}</p>
                    <p class="text-success small">
                        <i class="fas fa-check me-1"></i>
                        Listo para cargar
                    </p>
                    <button class="btn btn-success mt-2" onclick="window.loadDataModule.confirmUpload()">
                        <i class="fas fa-upload me-2"></i>
                        Cargar Archivo
                    </button>
                    <button class="btn btn-outline-secondary mt-2 ms-2" onclick="window.loadDataModule.cancelUpload()">
                        <i class="fas fa-times me-2"></i>
                        Cancelar
                    </button>
                </div>
            `;
            uploadArea.innerHTML = validHTML;
            
            // Guardar referencia al archivo válido
            this.pendingFile = file;
        }
    },
    
    restoreUploadArea() {
        /**
         * Restaura el contenido original del área de carga.
         */
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;
        
        uploadArea.classList.remove('file-valid', 'file-invalid', 'file-validating');
        uploadArea.innerHTML = `
            <div class="upload-content">
                <i class="fas fa-file-upload fa-3x text-primary mb-3"></i>
                <h5>Arrastra y suelta archivos aquí</h5>
                <p class="text-muted">o haz clic para seleccionar archivos</p>
                <p class="small text-muted">Formatos soportados: CSV, Excel (.xlsx, .xls)</p>
                <p class="small text-muted">Tamaño máximo: 500 MB</p>
                <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display: none;">
                <button class="btn btn-primary mt-2" onclick="document.getElementById('fileInput').click()">
                    <i class="fas fa-folder-open me-2"></i>
                    Seleccionar Archivo
                </button>
            </div>
        `;
        
        // Reconfigurar event listeners
        this.setupFileInputListener();
        this.pendingFile = null;
    },
    
    setupFileInputListener() {
        /**
         * Configura el listener del input de archivo para validación inmediata.
         */
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const validationResult = this.validateFile(file);
                    this.showFileValidationFeedback(file, validationResult);
                }
            });
        }
    },
    
    async confirmUpload() {
        /**
         * Confirma y ejecuta la carga del archivo validado.
         */
        if (!this.pendingFile) {
            this.app.showError('No hay archivo pendiente para cargar');
            return;
        }
        
        // Validar nuevamente antes de cargar (por seguridad)
        const validationResult = this.validateFile(this.pendingFile);
        if (!validationResult.valid) {
            this.app.showError('El archivo ya no es válido. Por favor selecciona otro archivo.');
            this.restoreUploadArea();
            return;
        }
        
        // Mostrar progreso y cargar
        this.showUploadProgress();
        
        try {
            const dataset = await this.app.uploadDataset(this.pendingFile);
            
            this.hideUploadProgress();
            this.restoreUploadArea();
            this.renderDatasets();
            this.showUploadSuccess();
            
            // Limpiar input de archivo
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                fileInput.value = '';
            }
            
        } catch (error) {
            this.hideUploadProgress();
            this.app.showError(`Error al cargar el archivo: ${error.message}`);
            this.restoreUploadArea();
        }
    },
    
    cancelUpload() {
        /**
         * Cancela la carga pendiente y restaura el área de carga.
         */
        this.pendingFile = null;
        this.restoreUploadArea();
        
        // Limpiar input de archivo
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
    },

    async handleFileUpload(file) {
        /**
         * Maneja la carga de archivo con validación previa.
         * Este método ahora valida primero y muestra feedback antes de cargar.
         */
        
        // Validar archivo antes de proceder
        const validationResult = this.validateFile(file);
        
        if (!validationResult.valid) {
            // Mostrar errores de validación
            this.showFileValidationFeedback(file, validationResult);
            return;
        }
        
        // Si es válido, mostrar feedback positivo y permitir confirmación
        this.showFileValidationFeedback(file, validationResult);
    },

    showUploadProgress() {
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            progressDiv.style.display = 'block';
            const progressBar = progressDiv.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '100%';
            }
        }
    },

    hideUploadProgress() {
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
            const progressBar = progressDiv.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }
    },

    showUploadSuccess() {
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.add('upload-success');
            setTimeout(() => {
                uploadArea.classList.remove('upload-success');
            }, 500);
        }
    },

    renderDatasets() {
        const container = document.getElementById('datasetsContainer');
        const emptyState = document.getElementById('emptyState');
        const countBadge = document.getElementById('datasetCount');
        
        if (!container) {
            return;
        }

        
        const datasets = Object.values(this.app.datasets || {});
        
        // Update count
        if (countBadge) {
            countBadge.textContent = `${datasets.length} dataset${datasets.length !== 1 ? 's' : ''}`;
        }

        if (datasets.length === 0) {
            container.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }

        if (emptyState) {
            emptyState.style.display = 'none';
        }

        container.innerHTML = datasets.map(dataset => this.createDatasetCard(dataset)).join('');
        
        // Add event listeners to new cards
        this.addCardEventListeners();
    },

    createDatasetCard(dataset) {
        const fileTypeIcon = this.getFileTypeIcon(dataset.filename);
        const uploadDate = this.app.formatDate(dataset.uploaded_at);
        
        return `
            <div class="col-md-4">
                <div class="card dataset-card h-100" data-filename="${dataset.filename}">
                    <div class="card-header">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center">
                                <span class="file-type-icon ${fileTypeIcon.class} me-2">${fileTypeIcon.icon}</span>
                                <h6 class="mb-0 text-truncate">${dataset.filename}</h6>
                            </div>
                        </div>
                    </div>
                    <div class="card-body d-flex flex-column">
                        <div class="dataset-info mb-3">
                            <div class="dataset-stats">
                                <div class="stat-item mb-2">
                                    <i class="fas fa-table me-2 text-primary"></i>
                                    <span>${dataset.rows} filas</span>
                                </div>
                                <div class="stat-item mb-2">
                                    <i class="fas fa-columns me-2 text-primary"></i>
                                    <span>${dataset.columns} columnas</span>
                                </div>
                                <div class="stat-item mb-2">
                                    <i class="fas fa-clock me-2 text-muted"></i>
                                    <small class="text-muted">${uploadDate}</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="dataset-actions mt-auto">
                            <div class="d-flex justify-content-center gap-2">
                                <button class="btn btn-sm btn-outline-primary" title="Vista previa" onclick="loadDataModule.showDatasetPreview('${dataset.filename}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-info" title="Ver detalles" onclick="loadDataModule.showDatasetDetails('${dataset.filename}')">
                                    <i class="fas fa-info-circle"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-warning" title="Editar tipos de variables" onclick="loadDataModule.showEditVariables('${dataset.filename}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" title="Eliminar dataset" onclick="loadDataModule.deleteDataset('${dataset.filename}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getFileTypeIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        if (extension === 'csv') {
            return { icon: '<i class="fas fa-file-csv"></i>', class: 'file-type-csv' };
        } else {
            return { icon: '<i class="fas fa-file-excel"></i>', class: 'file-type-excel' };
        }
    },

    addCardEventListeners() {
        // Event listeners are added inline in the HTML for simplicity
    },

    async showDatasetDetails(filename) {
        try {
            const dataset = await this.app.getDatasetDetails(filename);
            const modal = new bootstrap.Modal(document.getElementById('datasetDetailsModal'));
            const content = document.getElementById('datasetDetailsContent');
            
            content.innerHTML = this.createDatasetDetailsContent(dataset);
            modal.show();
        } catch (error) {
        }
    },

    createDatasetDetailsContent(dataset) {
        const summaryStats = dataset.summary_stats || {};
        
        let statsHtml = '';
        for (const [column, stats] of Object.entries(summaryStats)) {
            if (stats.type && stats.type.includes('cuantitativa')) {
                statsHtml += `
                    <div class="col-md-6 mb-3">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">${column}</h6>
                                <span class="badge ${this.app.getVariableTypeBadgeClass(stats.type)}">
                                    ${this.app.getVariableTypeLabel(stats.type)}
                                </span>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-6">
                                        <small class="text-muted">Media</small>
                                        <div>${stats.mean ? stats.mean.toFixed(2) : 'N/A'}</div>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted">Mediana</small>
                                        <div>${stats.median ? stats.median.toFixed(2) : 'N/A'}</div>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted">Desv. Est.</small>
                                        <div>${stats.std ? stats.std.toFixed(2) : 'N/A'}</div>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted">Valores únicos</small>
                                        <div>${stats.unique_values || 'N/A'}</div>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted">Mínimo</small>
                                        <div>${stats.min ? stats.min.toFixed(2) : 'N/A'}</div>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted">Máximo</small>
                                        <div>${stats.max ? stats.max.toFixed(2) : 'N/A'}</div>
                                    </div>
                                    <div class="col-12">
                                        <small class="text-muted">Valores faltantes</small>
                                        <div>${stats.missing_values || 0}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                statsHtml += `
                    <div class="col-md-6 mb-3">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">${column}</h6>
                                <span class="badge ${this.app.getVariableTypeBadgeClass(stats.type)}">
                                    ${this.app.getVariableTypeLabel(stats.type)}
                                </span>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-6">
                                        <small class="text-muted">Valores únicos</small>
                                        <div>${stats.unique_values || 'N/A'}</div>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted">Valores faltantes</small>
                                        <div>${stats.missing_values || 0}</div>
                                    </div>
                                    <div class="col-12">
                                        <small class="text-muted">Valor más común</small>
                                        <div>${stats.most_common || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="row">
                <div class="col-12 mb-3">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Información General</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-3">
                                    <strong>Archivo:</strong><br>
                                    ${dataset.filename}
                                </div>
                                <div class="col-md-3">
                                    <strong>Filas:</strong><br>
                                    ${dataset.rows}
                                </div>
                                <div class="col-md-3">
                                    <strong>Columnas:</strong><br>
                                    ${dataset.columns}
                                </div>
                                <div class="col-md-3">
                                    <strong>Fecha de carga:</strong><br>
                                    ${this.app.formatDate(dataset.uploaded_at)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-12">
                    <h5 class="mb-3">Estadísticas Descriptivas</h5>
                    <div class="row">
                        ${statsHtml}
                    </div>
                </div>
            </div>
        `;
    },

    async showDatasetPreview(filename) {
        try {
            const dataset = await this.app.getDatasetDetails(filename);
            const modal = new bootstrap.Modal(document.getElementById('datasetPreviewModal'));
            const content = document.getElementById('datasetPreviewContent');
            
            content.innerHTML = this.createDatasetPreviewContent(dataset);
            modal.show();
        } catch (error) {
        }
    },

    createDatasetPreviewContent(dataset) {
        const previewData = dataset.preview || [];
        
        if (previewData.length === 0) {
            return '<p class="text-muted">No hay datos de vista previa disponibles.</p>';
        }

        const headers = Object.keys(previewData[0]);
        const rows = previewData.map(row => 
            headers.map(header => `<td>${row[header] || ''}</td>`).join('')
        );

        return `
            <div class="preview-table-container">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `<tr>${row}</tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="mt-3">
                <small class="text-muted">
                    Mostrando las primeras ${previewData.length} filas de ${dataset.rows} totales
                </small>
                <br>
                <small class="text-info">
                    <i class="fas fa-info-circle me-1"></i>
                    Desliza horizontalmente para ver todas las columnas
                </small>
            </div>
        `;
    },

    async showEditVariables(filename) {
        try {
            const dataset = await this.app.getDatasetDetails(filename);
            
            this.currentEditingDataset = filename;
            
            const modal = new bootstrap.Modal(document.getElementById('editVariablesModal'));
            const content = document.getElementById('editVariablesContent');
            
            const editContent = this.createEditVariablesContent(dataset);
            
            content.innerHTML = editContent;
            modal.show();
            
        } catch (error) {
            this.app.showError(`Error al abrir el editor de variables: ${error.message}`);
        }
    },

    createEditVariablesContent(dataset) {
        const variableTypes = dataset.variable_types || {};
        
        
        // Verificar si existe la columna es_outlier en el dataset
        // Si existe pero no está en variable_types, agregarla
        if (dataset.column_names && dataset.column_names.includes('es_outlier') && !('es_outlier' in variableTypes)) {
            variableTypes['es_outlier'] = 'cualitativa_nominal_binaria';
        }
        
        
        const variablesHtml = Object.entries(variableTypes).map(([column, currentType]) => `
            <div class="row mb-3">
                <div class="col-md-4">
                    <label class="form-label">${column}</label>
                </div>
                <div class="col-md-8">
                    <select class="form-select" data-column="${column}">
                        <option value="cualitativa_nominal" ${currentType === 'cualitativa_nominal' ? 'selected' : ''}>
                            Cualitativa Nominal
                        </option>
                        <option value="cualitativa_nominal_binaria" ${currentType === 'cualitativa_nominal_binaria' ? 'selected' : ''}>
                            Cualitativa Nominal Binaria
                        </option>
                        <option value="cuantitativa_continua" ${currentType === 'cuantitativa_continua' ? 'selected' : ''}>
                            Cuantitativa Continua
                        </option>
                        <option value="cuantitativa_discreta" ${currentType === 'cuantitativa_discreta' ? 'selected' : ''}>
                            Cuantitativa Discreta
                        </option>
                    </select>
                </div>
            </div>
        `).join('');

        return `
            <div class="mb-3">
                <h6>Dataset: ${dataset.filename}</h6>
                <p class="text-muted">Edita los tipos de variables según tus necesidades de análisis.</p>
            </div>
            <form id="editVariablesForm">
                ${variablesHtml}
            </form>
        `;
    },



    async saveVariableTypes() {
        
        if (!this.currentEditingDataset) {
            this.app.showError('No hay dataset seleccionado para editar');
            return;
        }

        try {
            const form = document.getElementById('editVariablesForm');
            if (!form) {
                this.app.showError('Error: Formulario de edición no encontrado');
                return;
            }
            
            const selects = form.querySelectorAll('select');
            
            const variableTypes = {};
            selects.forEach(select => {
                const columnName = select.dataset.column;
                const selectedValue = select.value;
                variableTypes[columnName] = selectedValue;
            });


            // Show loading state
            const saveButton = document.getElementById('saveVariableTypes');
            const originalText = saveButton.innerHTML;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';
            saveButton.disabled = true;

            const updatedDataset = await this.app.updateVariableTypes(this.currentEditingDataset, variableTypes);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editVariablesModal'));
            if (modal) {
                modal.hide();
            }
            
            // Refresh datasets list
            this.renderDatasets();
            
            // Show success message
            this.app.showSuccess('Tipos de variables actualizados correctamente');
            
            this.currentEditingDataset = null;
            
        } catch (error) {
            this.app.showError(`Error al guardar los tipos de variables: ${error.message}`);
        } finally {
            // Restore button state
            const saveButton = document.getElementById('saveVariableTypes');
            if (saveButton) {
                saveButton.innerHTML = 'Guardar Cambios';
                saveButton.disabled = false;
            }
        }
    },

    async deleteDataset(filename) {
        if (confirm('¿Estás seguro de que quieres eliminar este dataset? Esta acción no se puede deshacer.')) {
            try {
                await this.app.deleteDataset(filename);
                this.renderDatasets();
            } catch (error) {
            }
        }
    }
};

// Make module available globally
window.loadDataModule = loadDataModule;
window['load-dataModule'] = loadDataModule; // Also register with kebab-case name


// Inicialización controlada por el sistema de carga de módulos
// El módulo se inicializará cuando loadModuleJS() llame a init()
// Esto previene race conditions y asegura que la app esté lista