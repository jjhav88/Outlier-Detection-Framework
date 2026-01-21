// Main logic, navigation, and module loading

class ANOUTApp {
    constructor() {
        this.currentTab = 'load-data';
        this.datasets = {};
        this.selectedDataset = null; // Dataset seleccionado globalmente
        
        // Sistema de estados de carga para prevenir race conditions
        this.moduleLoadingStates = new Map(); // Map<moduleName, Promise>
        this.moduleLoadedModules = new Set(); // Set<moduleName> - módulos completamente cargados
        this.moduleInitialized = new Set(); // Set<moduleName> - módulos inicializados
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadDatasets();
        await this.loadModule('load-data');
    }

    setupEventListeners() {
        // Tab navigation con soporte de teclado
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach((tab, index) => {
            tab.addEventListener('click', (e) => {
                const target = e.target.getAttribute('data-bs-target').replace('#', '');
                this.switchTab(target);
            });
            
            // Navegación por teclado (flechas izquierda/derecha)
            tab.addEventListener('keydown', (e) => {
                const tabs = Array.from(document.querySelectorAll('[data-bs-toggle="tab"]'));
                const currentIndex = tabs.indexOf(e.target);
                let nextIndex;
                
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    nextIndex = (currentIndex + 1) % tabs.length;
                    tabs[nextIndex].focus();
                    const target = tabs[nextIndex].getAttribute('data-bs-target').replace('#', '');
                    this.switchTab(target);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    tabs[nextIndex].focus();
                    const target = tabs[nextIndex].getAttribute('data-bs-target').replace('#', '');
                    this.switchTab(target);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    tabs[0].focus();
                    const target = tabs[0].getAttribute('data-bs-target').replace('#', '');
                    this.switchTab(target);
                } else if (e.key === 'End') {
                    e.preventDefault();
                    const lastTab = tabs[tabs.length - 1];
                    lastTab.focus();
                    const target = lastTab.getAttribute('data-bs-target').replace('#', '');
                    this.switchTab(target);
                }
            });
        });

        // Modal event listeners
        document.getElementById('saveVariableTypes').addEventListener('click', () => {
            if (window.loadDataModule && window.loadDataModule.saveVariableTypes) {
                window.loadDataModule.saveVariableTypes();
            } else {
                console.error('loadDataModule no está disponible o no tiene saveVariableTypes');
            }
        });
    }

    async switchTab(tabName) {
        console.log(`Cambiando a pestaña: ${tabName}`);
        
        // Prevenir múltiples cargas simultáneas del mismo módulo
        if (this.moduleLoadingStates.has(tabName)) {
            console.log(`Módulo ${tabName} ya está cargando, esperando...`);
            await this.moduleLoadingStates.get(tabName);
            return;
        }
        
        // Recargar datasets antes de cambiar de módulo para asegurar que siempre estén actualizados
        await this.loadDatasets();
        
        this.currentTab = tabName;
        await this.loadModule(tabName);
    }

    async loadModule(moduleName) {
        // Prevenir race conditions: si ya está cargando, esperar a que termine
        if (this.moduleLoadingStates.has(moduleName)) {
            console.log(`Módulo ${moduleName} ya está cargando, esperando a que termine...`);
            try {
                await this.moduleLoadingStates.get(moduleName);
                return;
            } catch (error) {
                console.error(`Error esperando carga previa de ${moduleName}:`, error);
                // Continuar con nueva carga si la anterior falló
            }
        }
        
        // Crear Promise para rastrear el estado de carga
        const loadingPromise = this._loadModuleInternal(moduleName);
        this.moduleLoadingStates.set(moduleName, loadingPromise);
        
        try {
            await loadingPromise;
            this.moduleLoadedModules.add(moduleName);
        } catch (error) {
            console.error(`Error loading module ${moduleName}:`, error);
            this.showError(`Error cargando el módulo ${moduleName}`);
            throw error;
        } finally {
            // Limpiar estado de carga después de completar (éxito o error)
            this.moduleLoadingStates.delete(moduleName);
        }
    }
    
    async _loadModuleInternal(moduleName) {
        console.log(`[LOAD] Iniciando carga de módulo: ${moduleName}`);
        
        // Recargar datasets ANTES de cargar el HTML para asegurar que estén disponibles
        await this.loadDatasets();
        console.log(`[LOAD] Datasets recargados antes de cargar HTML de ${moduleName}`);
        
        // Convert module name from kebab-case to snake_case for file names and directory names
        const fileName = moduleName.replace(/-/g, '_');
        const dirName = moduleName.replace(/-/g, '_');
        
        // Agregar timestamp para evitar caché
        const timestamp = new Date().getTime();
        const url = `/static/modules/${dirName}/${fileName}.html?t=${timestamp}`;
        console.log(`[LOAD] Buscando archivo HTML: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        console.log(`[LOAD] HTML cargado para ${moduleName}, longitud: ${html.length}`);
        
        const contentDiv = document.getElementById(`${moduleName}-content`);
        if (!contentDiv) {
            throw new Error(`No se encontró el div de contenido para ${moduleName}`);
        }
        
        console.log(`[LOAD] Contenido div encontrado para ${moduleName}`);
        contentDiv.innerHTML = html;
        
        // Load module CSS
        this.loadModuleCSS(moduleName);
        
        // Recargar datasets DESPUÉS de que el HTML esté listo pero ANTES de cargar el JS
        await this.loadDatasets();
        console.log(`[LOAD] Datasets recargados después de cargar HTML de ${moduleName}`);
        
        // Load and execute module JS
        await this.loadModuleJS(moduleName);
        
        // Asegurar que updateContent se llame después de que el HTML esté cargado
        // Esto es crítico porque el HTML se recarga cada vez, y necesita actualizarse con los datasets
        const moduleKey = moduleName.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Module';
        if (window[moduleKey] && typeof window[moduleKey].updateContent === 'function') {
            console.log(`[LOAD] Llamando updateContent después de cargar HTML para ${moduleKey}`);
            // Recargar datasets una vez más para estar seguros
            await this.loadDatasets();
            console.log(`[LOAD] Datasets disponibles para updateContent:`, Object.keys(this.datasets).length);
            const updateResult = window[moduleKey].updateContent(this);
            if (updateResult && typeof updateResult.then === 'function') {
                await updateResult;
            }
        }
        
        console.log(`[LOAD] Módulo ${moduleName} cargado exitosamente`);
    }

    loadModuleCSS(moduleName) {
        // Remove existing module CSS
        const existingLink = document.querySelector(`link[data-module="${moduleName}"]`);
        if (existingLink) {
            existingLink.remove();
        }

        // Add new module CSS with timestamp to avoid cache
        const fileName = moduleName.replace(/-/g, '_');
        const dirName = moduleName.replace(/-/g, '_');
        const timestamp = new Date().getTime();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `/static/modules/${dirName}/${fileName}.css?t=${timestamp}`;
        link.setAttribute('data-module', moduleName);
        document.head.appendChild(link);
    }

    async loadModuleJS(moduleName) {
        try {
            console.log(`[LOAD JS] Cargando módulo JS: ${moduleName}`);
            
            // Convert module name from kebab-case to camelCase for module lookup
            const moduleKey = moduleName.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Module';
            
            // Verificar si el módulo ya está inicializado
            // NOTA: No retornar temprano aquí, necesitamos asegurar que el HTML esté cargado
            // y que updateContent se llame incluso si el módulo ya está inicializado
            const isAlreadyInitialized = this.moduleInitialized.has(moduleName) && window[moduleKey] && window[moduleKey].initialized;
            if (isAlreadyInitialized) {
                console.log(`[LOAD JS] Módulo ${moduleKey} ya está inicializado, pero continuando para asegurar HTML y updateContent`);
            }
            
            // Remover script existente si existe (para forzar recarga)
            const existingScript = document.querySelector(`script[data-module="${moduleName}"]`);
            if (existingScript) {
                console.log(`[LOAD JS] Removiendo script existente de ${moduleName}`);
                existingScript.remove();
                // Reset initialization flag si existe
                if (window[moduleKey]) {
                    window[moduleKey].initialized = false;
                }
            }
            
            const fileName = moduleName.replace(/-/g, '_');
            const dirName = moduleName.replace(/-/g, '_');
            
            // Agregar timestamp para evitar caché del navegador
            const timestamp = new Date().getTime();
            const script = document.createElement('script');
            script.src = `/static/modules/${dirName}/${fileName}.js?t=${timestamp}`;
            script.setAttribute('data-module', moduleName);
            script.setAttribute('data-timestamp', timestamp.toString());
            
            // Wait for script to load and execute
            await new Promise((resolve, reject) => {
                // Timeout para evitar esperas infinitas
                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout cargando script ${moduleName} después de 30 segundos`));
                }, 30000);
                
                script.onload = () => {
                    clearTimeout(timeout);
                    console.log(`[LOAD JS] Script ${moduleName} cargado exitosamente`);
                    resolve();
                };
                
                script.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error(`[LOAD JS] Error cargando script ${moduleName}:`, error);
                    reject(new Error(`Error cargando script ${moduleName}`));
                };
                
                document.head.appendChild(script);
            });
            
            // Esperar un momento para que el script se ejecute completamente
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Initialize module if it has an init function
            console.log(`[LOAD JS] Verificando si existe ${moduleKey}:`, window[moduleKey]);
            if (window[moduleKey] && typeof window[moduleKey].init === 'function') {
                console.log(`[LOAD JS] Inicializando ${moduleKey}`);
                
                // Asegurar que los datasets estén cargados antes de inicializar/actualizar el módulo
                await this.loadDatasets();
                
                // Verificar si ya está inicializado
                if (window[moduleKey].initialized) {
                    console.log(`[LOAD JS] Módulo ${moduleKey} ya estaba inicializado`);
                    // Si el módulo tiene updateContent, llamarlo para actualizar el contenido
                    if (typeof window[moduleKey].updateContent === 'function') {
                        console.log(`[LOAD JS] Llamando updateContent para ${moduleKey}`);
                        const updateResult = window[moduleKey].updateContent(this);
                        if (updateResult && typeof updateResult.then === 'function') {
                            await updateResult;
                        }
                    }
                } else {
                    // Handle async init function
                    const initResult = window[moduleKey].init(this);
                    if (initResult && typeof initResult.then === 'function') {
                        await initResult;
                    }
                    // Mark module as initialized
                    window[moduleKey].initialized = true;
                    this.moduleInitialized.add(moduleName);
                    console.log(`[LOAD JS] Módulo ${moduleKey} inicializado exitosamente`);
                }
            } else {
                console.warn(`[LOAD JS] No se encontró ${moduleKey} o no tiene función init`);
            }
        } catch (error) {
            console.error(`[LOAD JS] Error loading module JS ${moduleName}:`, error);
            // Remover del conjunto de inicializados si hay error
            this.moduleInitialized.delete(moduleName);
            throw error;
        }
    }

    async loadDatasets() {
        try {
            console.log('[LOAD DATASETS] Recargando datasets desde servidor...');
            const response = await fetch('/api/datasets');
            if (response.ok) {
                const datasetsResponse = await response.json();
                console.log('[LOAD DATASETS] Respuesta del servidor:', datasetsResponse);
                console.log('[LOAD DATASETS] Tipo de respuesta:', typeof datasetsResponse);
                console.log('[LOAD DATASETS] Es array?', Array.isArray(datasetsResponse));
                
                // El servidor devuelve un objeto (diccionario) con filename como clave
                if (typeof datasetsResponse === 'object' && datasetsResponse !== null) {
                    if (Array.isArray(datasetsResponse)) {
                        // Si viene como array, convertirlo a objeto
                        this.datasets = {};
                        datasetsResponse.forEach(dataset => {
                            if (dataset && dataset.filename) {
                                this.datasets[dataset.filename] = dataset;
                            }
                        });
                    } else {
                        // Si ya es un objeto, usarlo directamente
                        this.datasets = datasetsResponse;
                    }
                } else {
                    console.warn('[LOAD DATASETS] Respuesta inesperada, inicializando objeto vacío');
                    this.datasets = {};
                }
                console.log(`[LOAD DATASETS] ${Object.keys(this.datasets).length} datasets cargados:`, Object.keys(this.datasets));
                console.log('[LOAD DATASETS] Datasets:', this.datasets);
            } else {
                console.error('[LOAD DATASETS] Error en respuesta del servidor:', response.status);
                // No sobrescribir datasets si hay error, mantener los existentes
            }
        } catch (error) {
            console.error('[LOAD DATASETS] Error loading datasets:', error);
            // No sobrescribir datasets si hay error, mantener los existentes
        }
    }

    async uploadDataset(file) {
        try {
            console.log('Iniciando uploadDataset con archivo:', file.name, file.size);
            const formData = new FormData();
            formData.append('file', file);
            console.log('FormData creado');

            console.log('Enviando request a /api/upload-dataset...');
            const response = await fetch('/api/upload-dataset', {
                method: 'POST',
                body: formData
            });

            console.log('Response recibida:', response.status, response.statusText);

            if (response.ok) {
                const result = await response.json();
                console.log('Resultado exitoso:', result);
                this.datasets[result.dataset.filename] = result.dataset;
                
                // Si es el primer dataset cargado, seleccionarlo automáticamente
                if (Object.keys(this.datasets).length === 1) {
                    this.selectedDataset = result.dataset.filename;
                }
                
                this.showSuccess('Dataset cargado exitosamente');
                return result.dataset;
            } else {
                let errorMessage = 'Error al cargar el dataset';
                try {
                    const error = await response.json();
                    errorMessage = error.detail || errorMessage;
                } catch (e) {
                    // Si no se puede parsear como JSON, usar solo el status
                    console.error('Error response status:', response.status, response.statusText);
                    errorMessage = `Error del servidor: ${response.status} ${response.statusText}`;
                }
                console.error('Error en response:', errorMessage);
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Error uploading dataset:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async deleteDataset(filename) {
        try {
            const response = await fetch(`/api/dataset/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                delete this.datasets[filename];
                this.showSuccess('Dataset eliminado exitosamente');
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Error al eliminar el dataset');
            }
        } catch (error) {
            console.error('Error deleting dataset:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async updateVariableTypes(filename, variableTypes) {
        try {
            const response = await fetch(`/api/dataset/${encodeURIComponent(filename)}/variable-types`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(variableTypes)
            });

            if (response.ok) {
                const result = await response.json();
                this.datasets[filename] = result.dataset;
                this.showSuccess('Tipos de variables actualizados exitosamente');
                return result.dataset;
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Error al actualizar los tipos de variables');
            }
        } catch (error) {
            console.error('Error updating variable types:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async getDatasetDetails(filename) {
        try {
            const response = await fetch(`/api/dataset/${encodeURIComponent(filename)}`);
            if (response.ok) {
                return await response.json();
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Error al obtener detalles del dataset');
            }
        } catch (error) {
            console.error('Error getting dataset details:', error);
            this.showError(error.message);
            throw error;
        }
    }



    getSelectedDataset() {
        if (!this.selectedDataset || !this.datasets[this.selectedDataset]) {
            return null;
        }
        return this.datasets[this.selectedDataset];
    }

    setSelectedDataset(filename) {
        if (this.datasets[filename]) {
            this.selectedDataset = filename;
            return true;
        }
        return false;
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showWarning(message) {
        this.showAlert(message, 'warning');
    }

    showInfo(message) {
        this.showAlert(message, 'info');
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    /**
     * Utilidades de validación en cliente
     */
    validateDatasetSelected() {
        if (!this.selectedDataset || !this.datasets[this.selectedDataset]) {
            this.showError('Por favor, selecciona un dataset primero');
            return false;
        }
        return true;
    }

    validateRequired(value, fieldName) {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            this.showError(`El campo '${fieldName}' es requerido`);
            return false;
        }
        return true;
    }

    validateArrayNotEmpty(array, fieldName) {
        if (!Array.isArray(array) || array.length === 0) {
            this.showError(`Debes seleccionar al menos un elemento en '${fieldName}'`);
            return false;
        }
        return true;
    }

    validateMinLength(value, minLength, fieldName) {
        if (!value || value.length < minLength) {
            this.showError(`El campo '${fieldName}' debe tener al menos ${minLength} caracteres`);
            return false;
        }
        return true;
    }

    validateNumericRange(value, min, max, fieldName) {
        const num = parseFloat(value);
        if (isNaN(num)) {
            this.showError(`El campo '${fieldName}' debe ser un número válido`);
            return false;
        }
        if (num < min || num > max) {
            this.showError(`El campo '${fieldName}' debe estar entre ${min} y ${max}`);
            return false;
        }
        return true;
    }

    getVariableTypeLabel(type) {
        const labels = {
            'cualitativa_nominal': 'Cualitativa Nominal',
            'cualitativa_nominal_binaria': 'Cualitativa Nominal Binaria',
            'cuantitativa_continua': 'Cuantitativa Continua',
            'cuantitativa_discreta': 'Cuantitativa Discreta'
        };
        return labels[type] || type;
    }

    getVariableTypeBadgeClass(type) {
        const classes = {
            'cualitativa_nominal': 'cualitativa-nominal',
            'cualitativa_nominal_binaria': 'cualitativa-nominal-binaria',
            'cuantitativa_continua': 'cuantitativa-continua',
            'cuantitativa_discreta': 'cuantitativa-discreta'
        };
        return classes[type] || 'secondary';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Feature Slider functionality
    initFeatureSlider() {
        this.currentSlide = 1;
        this.totalSlides = 4;
        this.slideInterval = null;
        
        // Start auto-slide
        this.startAutoSlide();
        
        // Setup slider controls
        this.setupSliderControls();
    }

    setupSliderControls() {
        // Navigation dots con soporte de teclado
        document.querySelectorAll('.nav-dot').forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                const slideNumber = parseInt(e.target.getAttribute('data-slide'));
                this.goToSlide(slideNumber);
            });
            
            // Navegación por teclado
            dot.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const slideNumber = parseInt(e.target.getAttribute('data-slide'));
                    this.goToSlide(slideNumber);
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const dots = Array.from(document.querySelectorAll('.nav-dot'));
                    const currentIndex = dots.indexOf(e.target);
                    let nextIndex;
                    
                    if (e.key === 'ArrowRight') {
                        nextIndex = (currentIndex + 1) % dots.length;
                    } else {
                        nextIndex = (currentIndex - 1 + dots.length) % dots.length;
                    }
                    
                    dots[nextIndex].focus();
                    const slideNumber = parseInt(dots[nextIndex].getAttribute('data-slide'));
                    this.goToSlide(slideNumber);
                }
            });
        });

        // Previous/Next buttons con soporte de teclado
        const prevBtn = document.getElementById('prevSlide');
        const nextBtn = document.getElementById('nextSlide');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.previousSlide();
            });
            
            prevBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.previousSlide();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.nextSlide();
            });
            
            nextBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.nextSlide();
                }
            });
        }

        // Pause auto-slide on hover
        const sliderContainer = document.querySelector('.full-banner-slider');
        if (sliderContainer) {
            sliderContainer.addEventListener('mouseenter', () => {
                this.pauseAutoSlide();
            });

            sliderContainer.addEventListener('mouseleave', () => {
                this.startAutoSlide();
            });
            
            // Pausar también cuando hay foco en controles
            sliderContainer.addEventListener('focusin', () => {
                this.pauseAutoSlide();
            });
        }
    }

    goToSlide(slideNumber) {
        // Remove active class from current slide and dot
        const currentSlide = document.querySelector('.banner-slide.active');
        const currentDot = document.querySelector('.nav-dot.active');
        
        if (currentSlide) {
            currentSlide.classList.remove('active');
            currentSlide.setAttribute('aria-hidden', 'true');
        }
        
        if (currentDot) {
            currentDot.classList.remove('active');
            currentDot.setAttribute('aria-selected', 'false');
        }

        // Add active class to new slide and dot
        const newSlide = document.querySelector(`.banner-slide[data-slide="${slideNumber}"]`);
        const newDot = document.querySelector(`.nav-dot[data-slide="${slideNumber}"]`);
        
        if (newSlide) {
            newSlide.classList.add('active');
            newSlide.setAttribute('aria-hidden', 'false');
        }
        
        if (newDot) {
            newDot.classList.add('active');
            newDot.setAttribute('aria-selected', 'true');
        }

        this.currentSlide = slideNumber;
    }

    nextSlide() {
        const nextSlide = this.currentSlide === this.totalSlides ? 1 : this.currentSlide + 1;
        this.goToSlide(nextSlide);
    }

    previousSlide() {
        const prevSlide = this.currentSlide === 1 ? this.totalSlides : this.currentSlide - 1;
        this.goToSlide(prevSlide);
    }

    startAutoSlide() {
        this.slideInterval = setInterval(() => {
            this.nextSlide();
        }, 6000); // Change slide every 5 seconds
    }

    pauseAutoSlide() {
        if (this.slideInterval) {
            clearInterval(this.slideInterval);
            this.slideInterval = null;
        }
    }

    // Preprocessing methods
    async preprocessMissingValues(filename, strategy, constantValue = null) {
        try {
            const response = await fetch(`/api/preprocess/${encodeURIComponent(filename)}/missing-values`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    strategy: strategy,
                    constant_value: constantValue
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Error al procesar valores faltantes');
            }
        } catch (error) {
            console.error('Error preprocessing missing values:', error);
            throw error;
        }
    }

    async preprocessDuplicates(filename, strategy) {
        try {
            const response = await fetch(`/api/preprocess/${encodeURIComponent(filename)}/duplicates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    strategy: strategy
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Error al procesar duplicados');
            }
        } catch (error) {
            console.error('Error preprocessing duplicates:', error);
            throw error;
        }
    }

    async preprocessOutliers(filename, method, strategy) {
        try {
            const response = await fetch(`/api/preprocess/${encodeURIComponent(filename)}/outliers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    method: method,
                    strategy: strategy
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Error al procesar outliers');
            }
        } catch (error) {
            console.error('Error preprocessing outliers:', error);
            throw error;
        }
    }

    async preprocessDataTypes(filename, action, conversionParams = null) {
        try {
            const requestBody = {
                action: action
            };
            
            if (conversionParams) {
                requestBody.conversion_params = conversionParams;
            }
            
            const response = await fetch(`/api/preprocess/${encodeURIComponent(filename)}/data-types`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Error al procesar tipos de datos');
            }
        } catch (error) {
            console.error('Error preprocessing data types:', error);
            throw error;
        }
    }

    async applyAllPreprocessing(filename, steps) {
        try {
            const response = await fetch(`/api/preprocess/${encodeURIComponent(filename)}/apply-all`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    steps: steps
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Error al aplicar todos los cambios');
            }
        } catch (error) {
            console.error('Error applying all preprocessing:', error);
            throw error;
        }
    }

    async saveProcessedDataset(originalFilename, newName, processedData) {
        try {
            const response = await fetch('/api/preprocess/save-dataset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    original_filename: originalFilename,
                    new_name: newName,
                    processed_data: processedData
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error saving processed dataset:', error);
            throw error;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.anoutApp = new ANOUTApp();
    
    // Initialize feature slider after a short delay to ensure DOM is ready
    setTimeout(() => {
        window.anoutApp.initFeatureSlider();
    }, 100);
}); 

