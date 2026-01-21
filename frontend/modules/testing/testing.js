// Módulo de Testing y Pruebas

window.testingModule = {
    app: null,
    currentTestRun: null,
    testInterval: null,
    reports: [],
    showAllReports: false,
    lastTestRunTimestamp: null,
    currentPage: 1,
    reportsPerPage: 10,
    currentLoadTestRun: null,
    loadTestInterval: null,
    performanceMetricsInterval: null,

    init(app) {
        this.app = app;
        
        this.setupEventListeners();
        this.loadAvailableReports();
        
    },

    setupEventListeners() {
        const runTestsBtn = document.getElementById('runTestsBtn');
        const stopTestsBtn = document.getElementById('stopTestsBtn');
        const refreshReportsBtn = document.getElementById('refreshReportsBtn');
        const showAllReportsCheck = document.getElementById('showAllReports');

        if (runTestsBtn) {
            runTestsBtn.addEventListener('click', () => this.runTests());
        }

        if (stopTestsBtn) {
            stopTestsBtn.addEventListener('click', () => this.stopTests());
        }

        if (refreshReportsBtn) {
            refreshReportsBtn.addEventListener('click', () => this.loadAvailableReports());
        }

        if (showAllReportsCheck) {
            showAllReportsCheck.addEventListener('change', (e) => {
                this.showAllReports = e.target.checked;
                this.currentPage = 1; // Resetear a primera página
                this.displayReports();
            });
        }

        // Event listeners para pruebas de carga
        const runLoadTestBtn = document.getElementById('runLoadTestBtn');
        const stopLoadTestBtn = document.getElementById('stopLoadTestBtn');
        const viewPerformanceMetricsBtn = document.getElementById('viewPerformanceMetricsBtn');
        const closeMetricsPanelBtn = document.getElementById('closeMetricsPanelBtn');

        if (runLoadTestBtn) {
            runLoadTestBtn.addEventListener('click', () => this.runLoadTest());
        }

        if (stopLoadTestBtn) {
            stopLoadTestBtn.addEventListener('click', () => this.stopLoadTest());
        }

        if (viewPerformanceMetricsBtn) {
            viewPerformanceMetricsBtn.addEventListener('click', () => this.showPerformanceMetrics());
        }

        if (closeMetricsPanelBtn) {
            closeMetricsPanelBtn.addEventListener('click', () => this.hidePerformanceMetrics());
        }
    },

    async runTests() {
        const testType = document.getElementById('testTypeSelect')?.value || '';
        const verbose = document.getElementById('verboseCheck')?.checked || false;
        const coverage = document.getElementById('coverageCheck')?.checked || false;

        // Mostrar panel de progreso
        const progressPanel = document.getElementById('progressPanel');
        const resultsPanel = document.getElementById('resultsPanel');
        const runBtn = document.getElementById('runTestsBtn');
        const stopBtn = document.getElementById('stopTestsBtn');

        if (progressPanel) progressPanel.style.display = 'block';
        if (resultsPanel) resultsPanel.style.display = 'none';
        if (runBtn) runBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;

        // Resetear progreso
        this.updateProgress(0, 'Iniciando pruebas...');

        try {
            const response = await fetch('/api/testing/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    test_type: testType,
                    verbose: verbose,
                    coverage: coverage
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.currentTestRun = data.test_run_id;

            // Iniciar polling de estado
            this.startPolling(data.test_run_id);

        } catch (error) {
            this.showError('Error al ejecutar pruebas: ' + error.message);
            this.resetUI();
        }
    },

    startPolling(testRunId) {
        let attempts = 0;
        const maxAttempts = 300; // 5 minutos máximo

        this.testInterval = setInterval(async () => {
            attempts++;
            
            try {
                const response = await fetch(`/api/testing/status/${testRunId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const status = await response.json();

                // Actualizar progreso
                if (status.status === 'running') {
                    const progress = status.progress || 0;
                    const message = status.message || 'Ejecutando pruebas...';
                    this.updateProgress(progress, message);
                    
                    // Actualizar output
                    if (status.output) {
                        const outputText = document.getElementById('testOutputText');
                        if (outputText) {
                            outputText.textContent = status.output;
                            outputText.scrollTop = outputText.scrollHeight;
                        }
                    }
                } else if (status.status === 'completed') {
                    clearInterval(this.testInterval);
                    this.handleTestCompletion(status);
                } else if (status.status === 'failed') {
                    clearInterval(this.testInterval);
                    this.handleTestFailure(status);
                }

                if (attempts >= maxAttempts) {
                    clearInterval(this.testInterval);
                    this.showError('Timeout: Las pruebas están tardando demasiado');
                    this.resetUI();
                }

            } catch (error) {
                if (attempts >= 10) {
                    clearInterval(this.testInterval);
                    this.showError('Error al obtener estado de las pruebas');
                    this.resetUI();
                }
            }
        }, 1000); // Poll cada segundo
    },

    stopTests() {
        if (this.testInterval) {
            clearInterval(this.testInterval);
        }
        
        if (this.currentTestRun) {
            fetch(`/api/testing/stop/${this.currentTestRun}`, { method: 'POST' })
        }

        this.resetUI();
        this.showNotification('Pruebas detenidas', 'warning');
    },

    handleTestCompletion(status) {
        this.updateProgress(100, 'Pruebas completadas');
        
        // Ocultar panel de progreso después de un momento
        setTimeout(() => {
            const progressPanel = document.getElementById('progressPanel');
            if (progressPanel) {
                progressPanel.style.display = 'none';
            }
        }, 2000);
        
        // Mostrar resultados
        if (status.results) {
            this.displayResults(status.results);
        } else {
            // Si no hay resultados en el status, mostrar mensaje
            const resultsPanel = document.getElementById('resultsPanel');
            if (resultsPanel) {
                resultsPanel.style.display = 'block';
                const summaryDiv = document.getElementById('testResultsSummary');
                if (summaryDiv) {
                    summaryDiv.innerHTML = `
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            Las pruebas se completaron. Revisa los reportes disponibles para ver los detalles.
                        </div>
                    `;
                }
            }
        }
        
        // Guardar timestamp de esta ejecución para filtrar reportes
        // Buscar el timestamp más reciente en los resultados
        if (status.results) {
            const timestamps = Object.values(status.results)
                .map(r => r && r.timestamp ? r.timestamp : null)
                .filter(t => t)
                .sort()
                .reverse();
            if (timestamps.length > 0) {
                this.lastTestRunTimestamp = timestamps[0];
            }
        }
        
        // Recargar reportes
        setTimeout(() => {
            this.loadAvailableReports();
        }, 1500);

        this.resetUI();
        this.showNotification('Pruebas completadas exitosamente', 'success');
    },

    handleTestFailure(status) {
        this.updateProgress(0, 'Error en las pruebas');
        this.showError(status.error || 'Error desconocido al ejecutar pruebas');
        this.resetUI();
    },

    displayResults(results) {
        const resultsPanel = document.getElementById('resultsPanel');
        const summaryDiv = document.getElementById('testResultsSummary');
        const detailsDiv = document.getElementById('testResultsDetails');

        if (!resultsPanel || !summaryDiv) return;

        resultsPanel.style.display = 'block';

        // Resumen
        let summaryHTML = '<div class="row">';
        
        if (results.summary) {
            const summary = results.summary;
            const successRate = summary.total_tests > 0 
                ? ((summary.total_passed / summary.total_tests) * 100).toFixed(2)
                : 0;

            summaryHTML += `
                <div class="col-md-3">
                    <div class="card border-success">
                        <div class="card-body text-center">
                            <h3 class="text-success mb-0">${summary.total_passed}</h3>
                            <small class="text-muted">Pasadas</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-danger">
                        <div class="card-body text-center">
                            <h3 class="text-danger mb-0">${summary.total_failed}</h3>
                            <small class="text-muted">Fallidas</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-warning">
                        <div class="card-body text-center">
                            <h3 class="text-warning mb-0">${summary.total_skipped}</h3>
                            <small class="text-muted">Omitidas</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-info">
                        <div class="card-body text-center">
                            <h3 class="text-info mb-0">${successRate}%</h3>
                            <small class="text-muted">Tasa de Éxito</small>
                        </div>
                    </div>
                </div>
            `;
        }

        summaryHTML += '</div>';
        summaryDiv.innerHTML = summaryHTML;

        // Detalles por tipo de prueba
        if (results.results && Object.keys(results.results).length > 0) {
            let detailsHTML = '<h6 class="mb-3">Detalle por Tipo de Prueba</h6>';
            detailsHTML += '<div class="accordion" id="testResultsAccordion">';

            Object.entries(results.results).forEach(([testType, stats], index) => {
                const isSuccess = stats.success;
                const badgeClass = isSuccess ? 'bg-success' : 'bg-danger';
                const icon = isSuccess ? 'fa-check-circle' : 'fa-times-circle';

                detailsHTML += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="heading${index}">
                            <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" 
                                    type="button" 
                                    data-bs-toggle="collapse" 
                                    data-bs-target="#collapse${index}">
                                <span class="badge ${badgeClass} me-2">
                                    <i class="fas ${icon}"></i>
                                </span>
                                ${stats.description || testType}
                                <span class="ms-auto text-muted">
                                    ${stats.passed || 0}/${stats.total || 0}
                                </span>
                            </button>
                        </h2>
                        <div id="collapse${index}" 
                             class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                             data-bs-parent="#testResultsAccordion">
                            <div class="accordion-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>Estado:</strong> 
                                            <span class="badge ${badgeClass}">${isSuccess ? 'PASO' : 'FALLO'}</span>
                                        </p>
                                        <p><strong>Pruebas pasadas:</strong> ${stats.passed || 0}</p>
                                        <p><strong>Pruebas fallidas:</strong> ${stats.failed || 0}</p>
                                        <p><strong>Pruebas omitidas:</strong> ${stats.skipped || 0}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><strong>Total:</strong> ${stats.total || 0}</p>
                                        ${stats.total > 0 ? `
                                            <p><strong>Tasa de éxito:</strong> 
                                                ${((stats.passed / stats.total) * 100).toFixed(2)}%
                                            </p>
                                        ` : ''}
                                        ${stats.html_report ? `
                                            <a href="/api/testing/report/${stats.html_report}" 
                                               target="_blank" 
                                               class="btn btn-sm btn-outline-primary">
                                                <i class="fas fa-external-link-alt me-1"></i>
                                                Ver Reporte HTML
                                            </a>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            detailsHTML += '</div>';
            detailsDiv.innerHTML = detailsHTML;
        }
    },

    async loadAvailableReports() {
        try {
            const response = await fetch('/api/testing/reports');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.reports = data.reports || [];
            this.displayReports();

        } catch (error) {
            this.showError('Error al cargar reportes: ' + error.message);
        }
    },

    displayReports() {
        const reportsList = document.getElementById('reportsList');
        if (!reportsList) return;

        if (this.reports.length === 0) {
            reportsList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-file-alt fa-3x mb-3"></i>
                    <p>No hay reportes disponibles. Ejecuta pruebas para generar reportes.</p>
                </div>
            `;
            return;
        }

        // Actualizar contador de reportes
        const reportsCount = document.getElementById('reportsCount');
        if (reportsCount) {
            reportsCount.textContent = this.reports.length;
        }

        // Filtrar reportes: si no mostrar todos, mostrar solo los más recientes (últimos 10) o los de la última ejecución
        let reportsToShow = this.reports;
        let totalReports = this.reports.length;
        
        if (!this.showAllReports) {
            if (this.lastTestRunTimestamp) {
                // Mostrar solo reportes de la última ejecución
                reportsToShow = this.reports.filter(r => r.timestamp === this.lastTestRunTimestamp);
            } else {
                // Si no hay timestamp de última ejecución, mostrar los 10 más recientes
                reportsToShow = this.reports.slice(0, this.reportsPerPage);
            }
            totalReports = reportsToShow.length;
        } else {
            // Si mostrar todos, aplicar paginación
            totalReports = this.reports.length;
            const startIndex = (this.currentPage - 1) * this.reportsPerPage;
            const endIndex = startIndex + this.reportsPerPage;
            reportsToShow = this.reports.slice(startIndex, endIndex);
        }

        if (reportsToShow.length === 0 && !this.showAllReports) {
            reportsList.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    No hay reportes de la última ejecución. Activa "Mostrar todos" para ver el historial completo.
                </div>
            `;
            // Ocultar paginación
            const pagination = document.getElementById('reportsPagination');
            if (pagination) pagination.style.display = 'none';
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Resultados</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
        `;

        reportsToShow.forEach(report => {
            // Parsear fecha de manera más robusta
            let dateStr = 'Fecha no disponible';
            try {
                if (report.date) {
                    const dateObj = new Date(report.date);
                    if (!isNaN(dateObj.getTime())) {
                        dateStr = dateObj.toLocaleString('es-ES');
                    }
                } else if (report.timestamp) {
                    // Intentar parsear timestamp del formato YYYYMMDD_HHMMSS
                    const ts = report.timestamp;
                    if (ts && ts.length >= 15) {
                        const year = ts.substring(0, 4);
                        const month = ts.substring(4, 6);
                        const day = ts.substring(6, 8);
                        const hour = ts.substring(9, 11);
                        const minute = ts.substring(11, 13);
                        const second = ts.substring(13, 15);
                        const dateObj = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                        if (!isNaN(dateObj.getTime())) {
                            dateStr = dateObj.toLocaleString('es-ES');
                        }
                    }
                }
            } catch (e) {
            }
            
            // Determinar estado basado en summary
            const summary = report.summary || {};
            const totalTests = summary.total_tests || 0;
            const totalPassed = summary.total_passed || 0;
            const totalFailed = summary.total_failed || 0;
            
            // Determinar estado: PASO si overall_success es true O si hay pruebas y todas pasaron
            const isSuccess = summary.overall_success === true || 
                             (totalTests > 0 && totalFailed === 0 && totalPassed > 0);
            
            const statusBadge = isSuccess
                ? '<span class="badge bg-success">PASO</span>'
                : '<span class="badge bg-danger">FALLO</span>';
            
            const results = `${totalPassed}/${totalTests}`;

            html += `
                <tr>
                    <td>${report.test_type || 'Consolidado'}</td>
                    <td>${dateStr}</td>
                    <td>${statusBadge}</td>
                    <td>${results}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" 
                                onclick="testingModule.viewReport('${report.filename}', '${report.json_file || ''}')"
                                title="Ver reporte HTML">
                            <i class="fas fa-eye"></i> Ver HTML
                        </button>
                        ${report.json_file ? `
                            <button class="btn btn-sm btn-outline-secondary" 
                                    onclick="testingModule.viewReport('${report.filename}', '${report.json_file}')"
                                    title="Ver datos JSON">
                                <i class="fas fa-code"></i> Ver JSON
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        reportsList.innerHTML = html;

        // Mostrar/ocultar y actualizar paginación
        this.updatePagination(totalReports);
    },

    updatePagination(totalReports) {
        const pagination = document.getElementById('reportsPagination');
        const paginationList = document.getElementById('paginationList');
        
        if (!pagination || !paginationList) return;

        // Solo mostrar paginación si estamos mostrando todos y hay más de una página
        if (this.showAllReports && totalReports > this.reportsPerPage) {
            pagination.style.display = 'block';
            
            const totalPages = Math.ceil(totalReports / this.reportsPerPage);
            let paginationHTML = '';

            // Botón Anterior
            paginationHTML += `
                <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="testingModule.goToPage(${this.currentPage - 1}); return false;">
                        <i class="fas fa-chevron-left"></i> Anterior
                    </a>
                </li>
            `;

            // Números de página
            const maxVisiblePages = 5;
            let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }

            if (startPage > 1) {
                paginationHTML += `
                    <li class="page-item">
                        <a class="page-link" href="#" onclick="testingModule.goToPage(1); return false;">1</a>
                    </li>
                `;
                if (startPage > 2) {
                    paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                paginationHTML += `
                    <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="testingModule.goToPage(${i}); return false;">${i}</a>
                    </li>
                `;
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                }
                paginationHTML += `
                    <li class="page-item">
                        <a class="page-link" href="#" onclick="testingModule.goToPage(${totalPages}); return false;">${totalPages}</a>
                    </li>
                `;
            }

            // Botón Siguiente
            paginationHTML += `
                <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="testingModule.goToPage(${this.currentPage + 1}); return false;">
                        Siguiente <i class="fas fa-chevron-right"></i>
                    </a>
                </li>
            `;

            paginationList.innerHTML = paginationHTML;
        } else {
            pagination.style.display = 'none';
        }
    },

    goToPage(page) {
        const totalPages = Math.ceil(this.reports.length / this.reportsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.displayReports();
            // Scroll al inicio de la tabla
            const reportsList = document.getElementById('reportsList');
            if (reportsList) {
                reportsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    },

    updateProgress(percent, message) {
        const progressBar = document.getElementById('testProgressBar');
        const statusText = document.getElementById('testStatusText');

        if (progressBar) {
            progressBar.style.width = percent + '%';
            progressBar.textContent = Math.round(percent) + '%';
        }

        if (statusText) {
            statusText.textContent = message || 'Ejecutando pruebas...';
        }
    },

    resetUI() {
        const runBtn = document.getElementById('runTestsBtn');
        const stopBtn = document.getElementById('stopTestsBtn');

        if (runBtn) runBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
    },

    showNotification(message, type = 'info') {
        // Implementar notificación (puedes usar Bootstrap toast o similar)
        // Aquí puedes agregar un sistema de notificaciones visual
    },

    showError(message) {
        this.showNotification(message, 'error');
        const outputText = document.getElementById('testOutputText');
        if (outputText) {
            outputText.textContent = message;
            outputText.classList.add('text-danger');
        }
    },

    async viewReport(htmlFilename, jsonFilename) {
        const modalElement = document.getElementById('reportViewerModal');
        if (!modalElement) {
            return;
        }
        
        const modal = new bootstrap.Modal(modalElement);
        const reportSummaryContent = document.getElementById('reportSummaryContent');
        const jsonContent = document.getElementById('jsonReportContent');
        const downloadBtn = document.getElementById('downloadReportBtn');
        const jsonTab = document.getElementById('json-tab');
        
        // Actualizar título del modal
        const modalTitle = document.getElementById('reportViewerModalLabel');
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-file-alt me-2"></i>Reporte: ${htmlFilename}`;
        }
        
        // Limpiar contenido previo
        if (reportSummaryContent) {
            reportSummaryContent.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success" role="status"></div><p class="mt-3">Cargando reporte...</p></div>';
        }
        if (jsonContent) {
            jsonContent.textContent = 'Cargando...';
        }
        
        // Mostrar modal
        modal.show();
        
        // Cargar datos JSON primero para construir el resumen visual
        let reportData = null;
        if (jsonFilename) {
            try {
                const response = await fetch(`/api/testing/report/${jsonFilename}?download=false`);
                if (response.ok) {
                    reportData = await response.json();
                    
                    // Mostrar resumen visual del reporte
                    if (reportSummaryContent && reportData) {
                        this.displayReportSummary(reportSummaryContent, reportData, htmlFilename);
                    }
                    
                    // Mostrar JSON formateado
                    if (jsonContent) {
                        jsonContent.textContent = JSON.stringify(reportData, null, 2);
                    }
                    
                    // Mostrar tab JSON
                    if (jsonTab) {
                        jsonTab.style.display = 'block';
                    }
                } else {
                    throw new Error('Error al cargar datos JSON');
                }
            } catch (error) {
                if (reportSummaryContent) {
                    reportSummaryContent.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Error al cargar el reporte: ${error.message}
                        </div>
                    `;
                }
                if (jsonContent) {
                    jsonContent.textContent = `Error: ${error.message}`;
                }
            }
        } else {
            // Si no hay JSON, intentar cargar HTML directamente
            if (htmlFilename && reportSummaryContent) {
                try {
                    const response = await fetch(`/api/testing/report/${htmlFilename}?download=false`);
                    if (response.ok) {
                        const htmlContent = await response.text();
                        reportSummaryContent.innerHTML = htmlContent;
                    }
                } catch (error) {
                    reportSummaryContent.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Error al cargar el reporte HTML: ${error.message}
                        </div>
                    `;
                }
            }
            
            // Ocultar tab JSON si no hay archivo JSON
            if (jsonTab) {
                jsonTab.style.display = 'none';
            }
        }
        
        // Configurar botón de descarga (con parámetro download=true)
        if (downloadBtn && htmlFilename) {
            downloadBtn.onclick = () => {
                window.open(`/api/testing/report/${htmlFilename}?download=true`, '_blank');
            };
        }
        
        // Activar tab HTML por defecto
        const htmlTabBtn = document.getElementById('html-tab');
        if (htmlTabBtn) {
            htmlTabBtn.click();
        }
    },

    displayReportSummary(container, reportData, htmlFilename) {
        if (!container || !reportData) return;

        // Información sobre cada tipo de prueba
        const testTypeInfo = {
            'regression': {
                title: 'Pruebas de Regresión',
                description: 'Verifican que los cambios recientes no hayan roto funcionalidades existentes que anteriormente funcionaban correctamente. Estas pruebas aseguran la estabilidad del sistema a lo largo del tiempo.',
                purpose: 'Garantizar que nuevas implementaciones no rompan código existente y mantener la integridad del sistema.',
                tests: [
                    'Procesamiento de datos',
                    'Detección de outliers (IQR, Z-Score, MAD)',
                    'Prueba U de Mann-Whitney',
                    'Estadísticas descriptivas',
                    'Análisis de clustering',
                    'Regresión logística',
                    'Modelos predictivos',
                    'Estructura de endpoints API',
                    'Tipos de datos'
                ]
            },
            'functional': {
                title: 'Pruebas Funcionales',
                description: 'Verifican que cada función realiza correctamente su tarea específica según los requisitos del sistema. Estas pruebas validan el comportamiento esperado de cada componente.',
                purpose: 'Asegurar que todas las funcionalidades del sistema operan según las especificaciones y requisitos definidos.',
                tests: [
                    'Subida de datasets',
                    'Detección de outliers (IQR, Z-Score, MAD)',
                    'Prueba U de Mann-Whitney',
                    'Análisis descriptivo',
                    'Clustering K-means',
                    'Regresión logística',
                    'Modelos predictivos (Random Forest)',
                    'Detección de tipos de variables',
                    'Limpieza de datos',
                    'Estrategias de combinación de outliers'
                ]
            },
            'whitebox': {
                title: 'Pruebas de Caja Blanca',
                description: 'Verifican el funcionamiento interno del código, incluyendo rutas de ejecución, condiciones, bucles y lógica interna. Estas pruebas examinan la implementación detallada.',
                purpose: 'Validar la lógica interna, cobertura de código y manejo de casos extremos para garantizar robustez.',
                tests: [
                    'Lógica de cálculos (IQR, Z-Score, MAD)',
                    'Casos extremos (DataFrames vacíos, valores únicos)',
                    'Manejo de valores NaN',
                    'Cobertura de condiciones y bucles',
                    'Manejo de errores',
                    'Lógica interna de procesamiento',
                    'Lógica interna de tests estadísticos',
                    'Lógica interna de clustering',
                    'Lógica interna de entrenamiento de modelos'
                ]
            },
            'blackbox': {
                title: 'Pruebas de Caja Negra',
                description: 'Verifican la funcionalidad del sistema desde la perspectiva del usuario final, sin conocer los detalles internos de implementación. Se prueban entradas y salidas esperadas.',
                purpose: 'Validar que el sistema responde correctamente a las interacciones del usuario y maneja adecuadamente diferentes escenarios de uso.',
                tests: [
                    'Health check del API',
                    'Subida de datasets',
                    'Obtención de lista de datasets',
                    'Detección de outliers',
                    'Manejo de entradas inválidas',
                    'Manejo de parámetros faltantes',
                    'Consistencia del formato de respuestas',
                    'Claridad de mensajes de error',
                    'Manejo de timeouts',
                    'Solicitudes concurrentes',
                    'Integridad de datos',
                    'Headers CORS',
                    'Validación de tipos de contenido'
                ]
            }
        };

        let html = '<div class="report-summary">';

        // Determinar el tipo de prueba desde el reporte
        let testType = null;
        
        // Primero intentar desde test_type directo
        if (reportData.test_type) {
            testType = reportData.test_type.toLowerCase();
        }
        // Si es un reporte consolidado, buscar en results
        else if (reportData.results && Object.keys(reportData.results).length > 0) {
            // Si solo hay un tipo en results, usar ese
            const resultKeys = Object.keys(reportData.results);
            if (resultKeys.length === 1) {
                testType = resultKeys[0].toLowerCase();
            }
            // Si hay múltiples tipos, no mostrar panel específico (es consolidado)
        }
        // Intentar extraer del nombre del archivo
        else if (htmlFilename) {
            const filenameLower = htmlFilename.toLowerCase();
            if (filenameLower.includes('regression')) testType = 'regression';
            else if (filenameLower.includes('functional')) testType = 'functional';
            else if (filenameLower.includes('whitebox')) testType = 'whitebox';
            else if (filenameLower.includes('blackbox')) testType = 'blackbox';
        }

        // Panel informativo sobre el tipo de prueba
        if (testType && testTypeInfo[testType]) {
            const info = testTypeInfo[testType];
            html += `
                <div class="card mb-3 border-info">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0">
                            <i class="fas fa-info-circle me-2"></i>
                            ${info.title}
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-12 mb-3">
                                <h6><i class="fas fa-question-circle me-2"></i>¿Qué función tiene esta prueba?</h6>
                                <p class="mb-2">${info.purpose}</p>
                            </div>
                            <div class="col-md-12 mb-3">
                                <h6><i class="fas fa-book me-2"></i>Descripción</h6>
                                <p class="mb-2">${info.description}</p>
                            </div>
                            <div class="col-md-12">
                                <h6><i class="fas fa-list-check me-2"></i>Pruebas que se ejecutan:</h6>
                                <ul class="list-group list-group-flush">
                                    ${info.tests.map(test => `
                                        <li class="list-group-item d-flex align-items-center">
                                            <i class="fas fa-check-circle text-success me-2"></i>
                                            <span>${test}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Encabezado con información general
        html += `
            <div class="card mb-3">
                <div class="card-header bg-success text-white">
                    <h5 class="mb-0">
                        <i class="fas fa-clipboard-check me-2"></i>
                        Resumen del Reporte de Pruebas
                    </h5>
                </div>
                <div class="card-body">
        `;

        // Si hay summary consolidado
        if (reportData.summary) {
            const summary = reportData.summary;
            const successRate = summary.total_tests > 0 
                ? ((summary.total_passed / summary.total_tests) * 100).toFixed(2)
                : 0;

            html += `
                <div class="row mb-3">
                    <div class="col-md-3">
                        <div class="card border-success">
                            <div class="card-body text-center">
                                <h3 class="text-success mb-0">${summary.total_passed || 0}</h3>
                                <small class="text-muted">Pruebas Pasadas</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-danger">
                            <div class="card-body text-center">
                                <h3 class="text-danger mb-0">${summary.total_failed || 0}</h3>
                                <small class="text-muted">Pruebas Fallidas</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-warning">
                            <div class="card-body text-center">
                                <h3 class="text-warning mb-0">${summary.total_skipped || 0}</h3>
                                <small class="text-muted">Pruebas Omitidas</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-info">
                            <div class="card-body text-center">
                                <h3 class="text-info mb-0">${successRate}%</h3>
                                <small class="text-muted">Tasa de Éxito</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="alert ${summary.overall_success ? 'alert-success' : 'alert-danger'}">
                    <i class="fas ${summary.overall_success ? 'fa-check-circle' : 'fa-times-circle'} me-2"></i>
                    <strong>Estado General:</strong> ${summary.overall_success ? 'TODAS LAS PRUEBAS PASARON' : 'ALGUNAS PRUEBAS FALLARON'}
                </div>
            `;
        }

        // Detalles por tipo de prueba si hay results
        if (reportData.results && Object.keys(reportData.results).length > 0) {
            html += `
                <h6 class="mt-4 mb-3">
                    <i class="fas fa-list me-2"></i>
                    Detalle por Tipo de Prueba
                </h6>
                <div class="accordion" id="reportDetailsAccordion">
            `;

            Object.entries(reportData.results).forEach(([testType, stats], index) => {
                const isSuccess = stats.success;
                const badgeClass = isSuccess ? 'bg-success' : 'bg-danger';
                const icon = isSuccess ? 'fa-check-circle' : 'fa-times-circle';

                html += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="heading${index}">
                            <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" 
                                    type="button" 
                                    data-bs-toggle="collapse" 
                                    data-bs-target="#collapse${index}">
                                <span class="badge ${badgeClass} me-2">
                                    <i class="fas ${icon}"></i>
                                </span>
                                ${stats.description || testType}
                                <span class="ms-auto text-muted">
                                    ${stats.passed || 0}/${stats.total || 0}
                                </span>
                            </button>
                        </h2>
                        <div id="collapse${index}" 
                             class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                             data-bs-parent="#reportDetailsAccordion">
                            <div class="accordion-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>Estado:</strong> 
                                            <span class="badge ${badgeClass}">${isSuccess ? 'PASO' : 'FALLO'}</span>
                                        </p>
                                        <p><strong>Pruebas pasadas:</strong> ${stats.passed || 0}</p>
                                        <p><strong>Pruebas fallidas:</strong> ${stats.failed || 0}</p>
                                        <p><strong>Pruebas omitidas:</strong> ${stats.skipped || 0}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><strong>Total de pruebas:</strong> ${stats.total || 0}</p>
                                        ${stats.total > 0 ? `
                                            <p><strong>Tasa de éxito:</strong> 
                                                ${((stats.passed / stats.total) * 100).toFixed(2)}%
                                            </p>
                                        ` : ''}
                                        ${stats.timestamp ? `
                                            <p><strong>Fecha de ejecución:</strong> ${stats.timestamp}</p>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        // Si es un reporte individual (no consolidado)
        else if (reportData.passed !== undefined) {
            const isSuccess = reportData.success;
            const badgeClass = isSuccess ? 'bg-success' : 'bg-danger';
            const icon = isSuccess ? 'fa-check-circle' : 'fa-times-circle';
            const successRate = reportData.total > 0 
                ? ((reportData.passed / reportData.total) * 100).toFixed(2)
                : 0;

            html += `
                <div class="row mb-3">
                    <div class="col-md-3">
                        <div class="card border-success">
                            <div class="card-body text-center">
                                <h3 class="text-success mb-0">${reportData.passed || 0}</h3>
                                <small class="text-muted">Pruebas Pasadas</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-danger">
                            <div class="card-body text-center">
                                <h3 class="text-danger mb-0">${reportData.failed || 0}</h3>
                                <small class="text-muted">Pruebas Fallidas</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-warning">
                            <div class="card-body text-center">
                                <h3 class="text-warning mb-0">${reportData.skipped || 0}</h3>
                                <small class="text-muted">Pruebas Omitidas</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-info">
                            <div class="card-body text-center">
                                <h3 class="text-info mb-0">${successRate}%</h3>
                                <small class="text-muted">Tasa de Éxito</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="alert ${isSuccess ? 'alert-success' : 'alert-danger'}">
                    <i class="fas ${icon} me-2"></i>
                    <strong>Estado:</strong> ${isSuccess ? 'TODAS LAS PRUEBAS PASARON' : 'ALGUNAS PRUEBAS FALLARON'}
                </div>
                <div class="mt-3">
                    <p><strong>Tipo de prueba:</strong> ${reportData.description || reportData.test_type || 'N/A'}</p>
                    <p><strong>Total de pruebas:</strong> ${reportData.total || 0}</p>
                    ${reportData.timestamp ? `<p><strong>Fecha de ejecución:</strong> ${reportData.timestamp}</p>` : ''}
                </div>
            `;
        }
        
        // Si no hay summary ni results, mostrar información básica
        else if (!reportData.summary && !reportData.results) {
            html += `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    Este reporte no contiene información de resumen. 
                    <a href="/api/testing/report/${htmlFilename}?download=true" target="_blank" class="alert-link">
                        Descarga el reporte HTML completo
                    </a> para ver todos los detalles.
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;

        // Enlace para ver reporte HTML completo
        html += `
            <div class="card">
                <div class="card-body text-center">
                    <p class="mb-2">Para ver el reporte HTML completo con todos los detalles:</p>
                    <a href="/api/testing/report/${htmlFilename}?download=true" 
                       target="_blank" 
                       class="btn btn-success">
                        <i class="fas fa-download me-2"></i>
                        Descargar Reporte HTML Completo
                    </a>
                </div>
            </div>
        `;

        html += '</div>';
        container.innerHTML = html;
    },

    async runLoadTest() {
        const users = parseInt(document.getElementById('loadTestUsers')?.value || 10);
        const spawnRate = parseFloat(document.getElementById('loadTestSpawnRate')?.value || 2);
        const runTime = document.getElementById('loadTestRunTime')?.value || '60s';
        const host = document.getElementById('loadTestHost')?.value || 'http://localhost:8000';

        try {
            // Resetear métricas de rendimiento antes de iniciar la prueba
            try {
                await fetch('/api/performance/metrics/reset', { method: 'POST' });
            } catch (resetError) {
            }

            const response = await fetch('/api/testing/performance/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    users,
                    spawn_rate: spawnRate,
                    run_time: runTime,
                    host
                })
            });

            if (!response.ok) {
                throw new Error('Error al iniciar pruebas de carga');
            }

            const data = await response.json();
            this.currentLoadTestRun = data.load_test_id;

            // Mostrar panel de progreso
            const progressPanel = document.getElementById('loadTestProgressPanel');
            const resultsPanel = document.getElementById('loadTestResultsPanel');
            if (progressPanel) progressPanel.style.display = 'block';
            if (resultsPanel) resultsPanel.style.display = 'none';

            // Habilitar botón de detener
            const stopBtn = document.getElementById('stopLoadTestBtn');
            if (stopBtn) stopBtn.disabled = false;

            // Deshabilitar botón de ejecutar
            const runBtn = document.getElementById('runLoadTestBtn');
            if (runBtn) runBtn.disabled = true;

            // Iniciar polling de estado
            this.startLoadTestPolling();
        } catch (error) {
            this.app?.showError(`Error al ejecutar pruebas de carga: ${error.message}`);
        }
    },

    startLoadTestPolling() {
        if (this.loadTestInterval) {
            clearInterval(this.loadTestInterval);
        }

        this.loadTestInterval = setInterval(async () => {
            if (!this.currentLoadTestRun) return;

            try {
                const response = await fetch(`/api/testing/performance/status/${this.currentLoadTestRun}`);
                if (!response.ok) {
                    clearInterval(this.loadTestInterval);
                    return;
                }

                const status = await response.json();

                // Actualizar progreso
                const progressBar = document.getElementById('loadTestProgressBar');
                const statusText = document.getElementById('loadTestStatusText');
                
                if (progressBar) {
                    progressBar.style.width = status.progress + '%';
                    progressBar.textContent = Math.round(status.progress) + '%';
                }

                if (statusText) {
                    statusText.textContent = status.message || 'Ejecutando...';
                }

                // Si completó o falló, mostrar resultados
                if (status.status === 'completed' || status.status === 'failed' || status.status === 'error' || status.status === 'timeout') {
                    clearInterval(this.loadTestInterval);
                    this.loadTestInterval = null;
                    
                    // Ocultar panel de progreso
                    const progressPanel = document.getElementById('loadTestProgressPanel');
                    if (progressPanel) progressPanel.style.display = 'none';
                    
                    this.displayLoadTestResults(status);
                    
                    // Restaurar botones
                    const stopBtn = document.getElementById('stopLoadTestBtn');
                    const runBtn = document.getElementById('runLoadTestBtn');
                    if (stopBtn) stopBtn.disabled = true;
                    if (runBtn) runBtn.disabled = false;
                }
            } catch (error) {
            }
        }, 2000); // Poll cada 2 segundos
    },

    async stopLoadTest() {
        if (!this.currentLoadTestRun) return;

        if (this.loadTestInterval) {
            clearInterval(this.loadTestInterval);
        }

        const stopBtn = document.getElementById('stopLoadTestBtn');
        const runBtn = document.getElementById('runLoadTestBtn');
        if (stopBtn) stopBtn.disabled = true;
        if (runBtn) runBtn.disabled = false;

        this.app?.showInfo('Las pruebas de carga se detendrán al completar la iteración actual');
    },

    displayLoadTestResults(status) {
        const resultsPanel = document.getElementById('loadTestResultsPanel');
        const summaryDiv = document.getElementById('loadTestResultsSummary');
        const detailsDiv = document.getElementById('loadTestResultsDetails');
        const progressPanel = document.getElementById('loadTestProgressPanel');

        if (!resultsPanel || !summaryDiv) return;

        // Ocultar panel de progreso cuando se muestran los resultados
        if (progressPanel) progressPanel.style.display = 'none';
        
        resultsPanel.style.display = 'block';

        let html = '<div class="row mb-3">';
        
        // Estado general
        const isSuccess = status.status === 'completed' && status.results?.success;
        html += `
            <div class="col-md-12 mb-3">
                <div class="alert ${isSuccess ? 'alert-success' : 'alert-danger'}">
                    <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-2"></i>
                    <strong>Estado:</strong> ${status.message || status.status}
                    ${status.error ? `<br><small class="mt-2 d-block"><strong>Error detallado:</strong><br><pre class="bg-dark text-light p-2 rounded mt-2" style="font-size: 11px; max-height: 200px; overflow-y: auto;">${status.error}</pre></small>` : ''}
                    ${status.results?.error_message ? `<br><small class="mt-2 d-block"><strong>Mensaje de error:</strong><br><pre class="bg-dark text-light p-2 rounded mt-2" style="font-size: 11px; max-height: 200px; overflow-y: auto;">${status.results.error_message}</pre></small>` : ''}
                </div>
            </div>
        `;

        // Configuración usada
        if (status.config) {
            html += `
                <div class="col-md-6">
                    <div class="card border-info">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0">Configuración</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Usuarios:</strong> ${status.config.users}</p>
                            <p><strong>Tasa de spawn:</strong> ${status.config.spawn_rate} usuarios/s</p>
                            <p><strong>Duración:</strong> ${status.config.run_time}</p>
                            <p><strong>Host:</strong> ${status.config.host}</p>
                            ${status.elapsed_time ? `<p><strong>Tiempo transcurrido:</strong> ${status.elapsed_time.toFixed(2)}s</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        // Estadísticas si están disponibles
        if (status.results?.stats && status.results.stats.length > 0) {
            html += `
                <div class="col-md-6">
                    <div class="card border-success">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0">Estadísticas</h6>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Endpoint</th>
                                            <th>Requests</th>
                                            <th>Fails</th>
                                            <th>Avg (ms)</th>
                                            <th>Min (ms)</th>
                                            <th>Max (ms)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
            `;

            status.results.stats.forEach(stat => {
                html += `
                    <tr>
                        <td>${stat.Name || stat.name || 'N/A'}</td>
                        <td>${stat['Request Count'] || stat.request_count || 0}</td>
                        <td>${stat['Failure Count'] || stat.failure_count || 0}</td>
                        <td>${stat['Average Response Time'] || stat.avg_response_time || 0}</td>
                        <td>${stat['Min Response Time'] || stat.min_response_time || 0}</td>
                        <td>${stat['Max Response Time'] || stat.max_response_time || 0}</td>
                    </tr>
                `;
            });

            html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';

        // Enlaces a reportes
        if (status.results?.html_report) {
            // Extraer solo el nombre del archivo de la ruta completa
            const reportPath = status.results.html_report;
            const reportFilename = reportPath.includes('\\') 
                ? reportPath.split('\\').pop() 
                : reportPath.includes('/')
                    ? reportPath.split('/').pop()
                    : reportPath;
            
            // Verificar que el nombre del archivo sea válido
            if (reportFilename && reportFilename.endsWith('.html')) {
                html += `
                    <div class="alert alert-info">
                        <i class="fas fa-file-alt me-2"></i>
                        <strong>Reportes generados:</strong>
                        <button onclick="testingModule.viewLoadTestReport('${reportFilename}')" 
                                class="btn btn-sm btn-primary ms-2">
                            <i class="fas fa-eye me-1"></i>Ver Reporte HTML
                        </button>
                        <small class="d-block mt-2 text-muted">
                            <i class="fas fa-info-circle me-1"></i>
                            Archivo: ${reportFilename}
                        </small>
                    </div>
                `;
            } else {
                html += `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Reporte generado:</strong> ${reportPath}
                        <br><small class="text-muted">El archivo se guardó pero no se puede visualizar directamente.</small>
                    </div>
                `;
            }
        }

        summaryDiv.innerHTML = html;

        // Detalles adicionales - Mostrar salida de Locust en un expander colapsado
        if (status.results?.stdout || status.results?.stderr) {
            let outputContent = '';
            
            // Locust escribe su salida normal a stderr (no son errores)
            if (status.results.stderr) {
                // Filtrar solo líneas informativas, no mostrar tablas repetitivas vacías
                const stderrLines = status.results.stderr.split('\n');
                const filteredLines = stderrLines.filter(line => {
                    const trimmed = line.trim();
                    // Excluir líneas vacías repetitivas y tablas vacías
                    if (!trimmed) return false;
                    if (trimmed.includes('Aggregated') && trimmed.includes('0     0(0.00%)')) return false;
                    if (trimmed.includes('--------|')) return false;
                    if (trimmed.includes('Type     Name') && trimmed.includes('# reqs')) return false;
                    return true;
                });
                
                const filteredOutput = filteredLines.join('\n');
                
                if (filteredOutput.trim()) {
                    outputContent += `
                        <div class="accordion-item rounded mb-2">
                            <h2 class="accordion-header" id="locustOutputHeader">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#locustOutputCollapse">
                                    <i class="fas fa-terminal me-2"></i>
                                    Salida de Locust (Información de ejecución)
                                </button>
                            </h2>
                            <div id="locustOutputCollapse" class="accordion-collapse collapse" data-bs-parent="#loadTestOutputAccordion">
                                <div class="accordion-body">
                                    <pre class="bg-dark text-light p-3 rounded" style="max-height: 400px; overflow-y: auto; font-size: 11px; white-space: pre-wrap;">${filteredOutput}</pre>
                                    <small class="text-muted d-block mt-2">
                                        <i class="fas fa-info-circle me-1"></i>
                                        Nota: Locust escribe su salida informativa a stderr por diseño. Esto no indica errores.
                                    </small>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
            
            if (status.results.stdout && status.results.stdout.trim()) {
                outputContent += `
                    <div class="accordion-item rounded mb-2">
                        <h2 class="accordion-header" id="stdoutHeader">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#stdoutCollapse">
                                <i class="fas fa-file-alt me-2"></i>
                                Salida estándar (stdout)
                            </button>
                        </h2>
                        <div id="stdoutCollapse" class="accordion-collapse collapse" data-bs-parent="#loadTestOutputAccordion">
                            <div class="accordion-body">
                                <pre class="bg-dark text-light p-3 rounded" style="max-height: 400px; overflow-y: auto; font-size: 11px; white-space: pre-wrap;">${status.results.stdout}</pre>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            if (outputContent) {
                detailsDiv.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">
                                <i class="fas fa-info-circle me-2"></i>
                                Detalles de Ejecución
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="accordion" id="loadTestOutputAccordion">
                                ${outputContent}
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    },

    async showPerformanceMetrics() {
        const metricsPanel = document.getElementById('performanceMetricsPanel');
        if (!metricsPanel) return;

        metricsPanel.style.display = 'block';
        await this.updatePerformanceMetrics();

        // Actualizar métricas cada 3 segundos
        if (this.performanceMetricsInterval) {
            clearInterval(this.performanceMetricsInterval);
        }

        this.performanceMetricsInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, 3000);
    },

    hidePerformanceMetrics() {
        const metricsPanel = document.getElementById('performanceMetricsPanel');
        if (metricsPanel) metricsPanel.style.display = 'none';

        if (this.performanceMetricsInterval) {
            clearInterval(this.performanceMetricsInterval);
            this.performanceMetricsInterval = null;
        }
    },

    async updatePerformanceMetrics() {
        const contentDiv = document.getElementById('performanceMetricsContent');
        if (!contentDiv) return;

        try {
            const response = await fetch('/api/performance/metrics');
            if (!response.ok) {
                contentDiv.innerHTML = '<div class="alert alert-warning">No se pudieron cargar las métricas de rendimiento.</div>';
                return;
            }

            const metrics = await response.json();
            
            let html = '<div class="row">';

            // Información sobre las métricas
            const hasRequests = metrics.performance_summary?.total_requests > 0;
            if (hasRequests) {
                html += `
                    <div class="col-12 mb-2">
                        <div class="alert alert-info mb-0">
                            <i class="fas fa-info-circle me-2"></i>
                            <small>
                                <strong>Nota:</strong> Las métricas de rendimiento muestran datos acumulativos desde el último reset 
                                (se resetean automáticamente al iniciar una nueva prueba de carga). 
                                Las métricas del sistema (CPU, memoria, uptime) reflejan el estado actual del servidor.
                            </small>
                        </div>
                    </div>
                `;
            }

            // Métricas del sistema
            if (metrics.system_metrics) {
                const sys = metrics.system_metrics;
                html += `
                    <div class="col-md-6 mb-3">
                        <div class="card border-primary">
                            <div class="card-header bg-primary text-white">
                                <h6 class="mb-0">Métricas del Sistema</h6>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-6 mb-2">
                                        <strong>CPU:</strong> ${sys.cpu_percent?.toFixed(1) || 0}%
                                    </div>
                                    <div class="col-6 mb-2">
                                        <strong>Memoria:</strong> ${sys.memory_mb?.toFixed(2) || 0} MB (${sys.memory_percent?.toFixed(1) || 0}%)
                                    </div>
                                    <div class="col-6 mb-2">
                                        <strong>Uptime:</strong> ${Math.floor(sys.uptime_seconds / 60)}m ${Math.floor(sys.uptime_seconds % 60)}s
                                    </div>
                                    <div class="col-6 mb-2">
                                        <strong>Threads:</strong> ${sys.num_threads || 0}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Resumen de rendimiento
            if (metrics.performance_summary) {
                const perf = metrics.performance_summary;
                html += `
                    <div class="col-md-6 mb-3">
                        <div class="card border-success">
                            <div class="card-header bg-success text-white">
                                <h6 class="mb-0">Resumen de Rendimiento</h6>
                            </div>
                            <div class="card-body">
                                ${perf.total_requests === 0 ? `
                                    <div class="alert alert-light mb-0">
                                        <i class="fas fa-info-circle me-2"></i>
                                        <small>No hay datos de rendimiento aún. Las métricas se actualizarán cuando se ejecuten peticiones.</small>
                                    </div>
                                ` : `
                                    <p><strong>Total de requests:</strong> ${perf.total_requests || 0}</p>
                                    <p><strong>Tiempo promedio:</strong> ${(perf.avg_response_time * 1000 || 0).toFixed(2)} ms</p>
                                    <p><strong>Tiempo mínimo:</strong> ${(perf.min_response_time * 1000 || 0).toFixed(2)} ms</p>
                                    <p><strong>Tiempo máximo:</strong> ${(perf.max_response_time * 1000 || 0).toFixed(2)} ms</p>
                                    <p><strong>Requests/segundo:</strong> ${perf.requests_per_second?.toFixed(2) || 0}</p>
                                    <p><strong>Tasa de error:</strong> ${((perf.error_rate || 0) * 100).toFixed(2)}%</p>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }

            html += '</div>';

            // Estadísticas por endpoint
            if (metrics.performance_summary?.endpoint_stats) {
                html += `
                    <div class="row mt-3">
                        <div class="col-12">
                            <h6>Estadísticas por Endpoint</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-hover">
                                    <thead>
                                        <tr>
                                            <th>Endpoint</th>
                                            <th>Requests</th>
                                            <th>Promedio (ms)</th>
                                            <th>Mínimo (ms)</th>
                                            <th>Máximo (ms)</th>
                                            <th>Errores</th>
                                            <th>Éxito</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                `;

                Object.entries(metrics.performance_summary.endpoint_stats).forEach(([endpoint, stats]) => {
                    html += `
                        <tr>
                            <td><code>${endpoint}</code></td>
                            <td>${stats.count || 0}</td>
                            <td>${((stats.avg_time || 0) * 1000).toFixed(2)}</td>
                            <td>${((stats.min_time || 0) * 1000).toFixed(2)}</td>
                            <td>${((stats.max_time || 0) * 1000).toFixed(2)}</td>
                            <td><span class="badge bg-danger">${stats.errors || 0}</span></td>
                            <td><span class="badge bg-success">${stats.success || 0}</span></td>
                        </tr>
                    `;
                });

                html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Requests lentos
            if (metrics.slow_requests && metrics.slow_requests.length > 0) {
                html += `
                    <div class="row mt-3">
                        <div class="col-12">
                            <h6 class="text-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Requests Lentos (>1 segundo)
                            </h6>
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            <th>Endpoint</th>
                                            <th>Método</th>
                                            <th>Duración (s)</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                `;

                metrics.slow_requests.slice(0, 10).forEach(req => {
                    html += `
                        <tr>
                            <td>${new Date(req.timestamp).toLocaleTimeString()}</td>
                            <td><code>${req.endpoint}</code></td>
                            <td>${req.method}</td>
                            <td>${req.duration.toFixed(3)}</td>
                            <td><span class="badge ${req.status_code >= 400 ? 'bg-danger' : 'bg-success'}">${req.status_code}</span></td>
                        </tr>
                    `;
                });

                html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            }

            contentDiv.innerHTML = html;
        } catch (error) {
            contentDiv.innerHTML = '<div class="alert alert-danger">Error al cargar métricas de rendimiento.</div>';
        }
    },

    async viewLoadTestReport(filename) {
        const modalElement = document.getElementById('reportViewerModal');
        if (!modalElement) {
            return;
        }
        
        const modal = new bootstrap.Modal(modalElement);
        const reportSummaryContent = document.getElementById('reportSummaryContent');
        const loadTestReportIframe = document.getElementById('loadTestReportIframe');
        const downloadBtn = document.getElementById('downloadReportBtn');
        const htmlTab = document.getElementById('html-tab');
        const jsonTab = document.getElementById('json-tab');
        
        // Actualizar título del modal
        const modalTitle = document.getElementById('reportViewerModalLabel');
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-chart-area me-2"></i>Reporte de Pruebas de Carga: ${filename}`;
        }
        
        // Ocultar pestaña JSON para reportes de Locust (solo HTML)
        if (jsonTab) {
            jsonTab.style.display = 'none';
        }
        
        // Mostrar solo la pestaña HTML
        if (htmlTab) {
            htmlTab.click();
        }
        
        // Ocultar contenido de resumen y mostrar iframe
        if (reportSummaryContent) {
            reportSummaryContent.style.display = 'none';
        }
        if (loadTestReportIframe) {
            loadTestReportIframe.style.display = 'block';
            // Limpiar src primero para forzar recarga
            loadTestReportIframe.src = '';
            
            // Agregar listener para cuando el iframe cargue
            loadTestReportIframe.onload = () => {
                try {
                    // Intentar acceder al contenido del iframe para verificar que cargó
                    const iframeDoc = loadTestReportIframe.contentDocument || loadTestReportIframe.contentWindow?.document;
                    if (iframeDoc) {
                        // Verificar si hay un elemento root (React necesita esto)
                        const root = iframeDoc.getElementById('root');
                        if (!root) {
                        }
                    }
                } catch (e) {
                    // Error de CORS al acceder al contenido del iframe (normal)
                }
            };
            
            // Usar setTimeout para asegurar que el iframe se recargue correctamente
            setTimeout(() => {
                loadTestReportIframe.src = `/api/testing/report/${filename}`;
            }, 100);
            
            // Manejar errores de carga del iframe
            loadTestReportIframe.onerror = () => {
                if (reportSummaryContent) {
                    reportSummaryContent.style.display = 'block';
                    reportSummaryContent.innerHTML = `
                        <div class="alert alert-danger">
                            <h5><i class="fas fa-exclamation-triangle me-2"></i>Error cargando reporte</h5>
                            <p>No se pudo cargar el reporte HTML en el iframe. Esto puede deberse a políticas de seguridad del navegador.</p>
                            <p><strong>Solución:</strong> Usa el botón "Descargar Reporte" para ver el reporte completo.</p>
                            <button class="btn btn-primary mt-2" onclick="window.open('/api/testing/report/${filename}?download=true', '_blank')">
                                <i class="fas fa-download me-2"></i>Descargar Reporte
                            </button>
                        </div>
                    `;
                }
            };
        }
        
        // Configurar botón de descarga
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                window.open(`/api/testing/report/${filename}?download=true`, '_blank');
            };
        }
        
        // Mostrar modal
        modal.show();
        
        // Limpiar cuando se cierre el modal
        const cleanup = () => {
            if (loadTestReportIframe) {
                loadTestReportIframe.src = '';
                loadTestReportIframe.style.display = 'none';
            }
            if (reportSummaryContent) {
                reportSummaryContent.style.display = 'block';
            }
            if (jsonTab) {
                jsonTab.style.display = '';
            }
            modalElement.removeEventListener('hidden.bs.modal', cleanup);
        };
        
        modalElement.addEventListener('hidden.bs.modal', cleanup, { once: true });
    }
};

// El módulo se inicializará cuando loadModuleJS() llame a init()

