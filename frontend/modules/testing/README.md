# Módulo de Testing - Interfaz Visual

Este módulo proporciona una interfaz visual para ejecutar pruebas automatizadas y visualizar reportes directamente desde la aplicación web.

## 📋 Características

- ✅ **Ejecución de Pruebas**: Ejecuta pruebas de regresión, funcionales, caja blanca o caja negra desde la interfaz
- ✅ **Monitoreo en Tiempo Real**: Visualiza el progreso de las pruebas mientras se ejecutan
- ✅ **Resultados Detallados**: Muestra resumen y detalles de cada tipo de prueba
- ✅ **Reportes Disponibles**: Lista todos los reportes HTML y JSON generados
- ✅ **Visualización de Reportes**: Abre reportes HTML directamente en nueva pestaña

## 🎯 Uso

1. **Navegar al módulo**: Haz clic en la pestaña "Testing" en la barra de navegación
2. **Seleccionar tipo de prueba**: Elige el tipo de prueba o deja en blanco para ejecutar todas
3. **Configurar opciones**: Marca las opciones deseadas (verbose, cobertura)
4. **Ejecutar**: Haz clic en "Ejecutar Pruebas"
5. **Monitorear**: Observa el progreso en tiempo real
6. **Revisar resultados**: Los resultados se muestran automáticamente al completar
7. **Ver reportes**: Accede a reportes anteriores desde la lista de reportes disponibles

## 🔧 Endpoints del Backend

- `POST /api/testing/run` - Iniciar ejecución de pruebas
- `GET /api/testing/status/{test_run_id}` - Obtener estado de ejecución
- `POST /api/testing/stop/{test_run_id}` - Detener ejecución
- `GET /api/testing/reports` - Listar reportes disponibles
- `GET /api/testing/report/{filename}` - Descargar reporte específico

## 📁 Estructura de Archivos

```
frontend/modules/testing/
├── testing.html      # Interfaz HTML del módulo
├── testing.js        # Lógica JavaScript
├── testing.css       # Estilos
└── README.md         # Este archivo
```

## 🎨 Componentes de la Interfaz

### Panel de Control
- Selector de tipo de prueba
- Opciones de ejecución (verbose, cobertura)
- Botones de control (Ejecutar, Detener, Actualizar)

### Panel de Progreso
- Barra de progreso animada
- Mensaje de estado
- Output en tiempo real de las pruebas

### Panel de Resultados
- Resumen con tarjetas de estadísticas
- Acordeón con detalles por tipo de prueba
- Enlaces a reportes HTML

### Lista de Reportes
- Tabla con todos los reportes disponibles
- Filtrado por fecha y tipo
- Enlaces directos a reportes HTML y JSON

## 🚀 Próximas Mejoras

- [ ] Filtrado y búsqueda de reportes
- [ ] Comparación de reportes
- [ ] Exportación de resultados
- [ ] Programación de pruebas automáticas
- [ ] Notificaciones cuando las pruebas completen
- [ ] Gráficos de tendencias de pruebas

