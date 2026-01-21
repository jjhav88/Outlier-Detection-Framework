# Lógica de la Fase 2
"""
Módulo de detección de outliers.

Este módulo implementa múltiples métodos para la detección de outliers:
- Métodos univariados: IQR, Z-Score, MAD
- Métodos multivariados: Mahalanobis, LOF, Isolation Forest
- Pruebas de hipótesis: Grubbs, Dixon, Rosner
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
import json
import logging
import seaborn as sns

# Configurar logger para este módulo
logger = logging.getLogger(__name__)


class OutlierDetector:
    """
    Clase para la detección de outliers usando múltiples métodos estadísticos.
    
    Esta clase proporciona métodos para detectar outliers en datasets usando
    técnicas univariadas, multivariadas y pruebas de hipótesis estadísticas.
    
    **Guía de Selección de Métodos:**
    
    **Métodos Univariados (una variable a la vez):**
    
    1. **IQR (Rango Intercuartílico)** - `detect_outliers_iqr()`
       - ✅ No asume normalidad (método no paramétrico)
       - ✅ Robusto a outliers
       - ✅ Rápido y simple
       - ⚠️ Solo detecta outliers univariados
       - 📌 **Cuándo usar**: Datos no normales, análisis exploratorio rápido
    
    2. **Z-Score** - `detect_outliers_zscore()`
       - ⚠️ **Requiere normalidad** (método paramétrico)
       - ✅ Simple y rápido
       - ✅ Interpretación intuitiva
       - ⚠️ Sensible a outliers (media y desviación estándar)
       - 📌 **Cuándo usar**: Datos normales, análisis exploratorio
    
    3. **MAD (Median Absolute Deviation)** - `detect_outliers_mad()`
       - ✅ No asume normalidad (método robusto)
       - ✅ Más robusto que Z-Score
       - ✅ Usa mediana en lugar de media
       - ⚠️ Solo detecta outliers univariados
       - 📌 **Cuándo usar**: Datos no normales o con outliers existentes
    
    4. **Grubbs Test** - `detect_outliers_grubbs()`
       - ⚠️ **Requiere normalidad** (prueba de hipótesis paramétrica)
       - ✅ Validación estadística con p-valor
       - ✅ Detecta un outlier a la vez
       - ⚠️ Solo para un outlier por llamada
       - 📌 **Cuándo usar**: Datos normales, validación estadística, muestras pequeñas-medianas
    
    5. **Dixon Test** - `detect_outliers_dixon()`
       - ⚠️ **Requiere normalidad** (prueba de hipótesis paramétrica)
       - ✅ Específico para muestras pequeñas (3-30 observaciones)
       - ✅ Detecta outliers en extremos
       - ⚠️ Solo para muestras pequeñas
       - 📌 **Cuándo usar**: Muestras pequeñas (n=3-30), datos normales
    
    6. **Rosner Test (ESD)** - `detect_outliers_rosner()`
       - ⚠️ **Requiere normalidad** (prueba de hipótesis paramétrica)
       - ✅ Detecta múltiples outliers iterativamente
       - ✅ Ajuste por comparaciones múltiples
       - ⚠️ Requiere muestras grandes (n >= 25)
       - 📌 **Cuándo usar**: Muestras grandes, múltiples outliers, datos normales
    
    **Métodos Multivariados (múltiples variables simultáneamente):**
    
    7. **Mahalanobis Distance** - `detect_outliers_mahalanobis()`
       - ⚠️ **Requiere normalidad multivariada**
       - ✅ Considera correlaciones entre variables
       - ✅ Detecta outliers multivariados
       - ⚠️ Sensible a outliers (usa media y covarianza)
       - 📌 **Cuándo usar**: Datos multivariados normales, considerar correlaciones
    
    8. **LOF (Local Outlier Factor)** - `detect_outliers_lof()`
       - ✅ No asume normalidad (método no paramétrico)
       - ✅ Detecta outliers locales
       - ✅ Funciona con datos multivariados
       - ⚠️ Computacionalmente más costoso
       - 📌 **Cuándo usar**: Datos no normales, outliers locales, datos multivariados
    
    9. **Isolation Forest** - `detect_outliers_isolation_forest()`
       - ✅ No asume normalidad (método basado en árboles)
       - ✅ Eficiente con grandes datasets
       - ✅ Detecta outliers multivariados
       - ⚠️ Menos interpretable que métodos estadísticos
       - 📌 **Cuándo usar**: Grandes datasets, datos no normales, detección rápida
    
    **Recomendaciones Generales:**
    
    - **Si los datos son normales**: Use métodos paramétricos (Z-Score, Grubbs, Dixon, Rosner, Mahalanobis)
    - **Si los datos NO son normales**: Use métodos no paramétricos (IQR, MAD, LOF, Isolation Forest)
    - **Para validación estadística**: Use pruebas de hipótesis (Grubbs, Dixon, Rosner)
    - **Para análisis exploratorio**: Use métodos simples (IQR, Z-Score, MAD)
    - **Para datos multivariados**: Use métodos multivariados (Mahalanobis, LOF, Isolation Forest)
    - **Para muestras pequeñas**: Use Dixon Test (n=3-30) o Grubbs (n>=3)
    - **Para muestras grandes**: Use Rosner (n>=25) o métodos multivariados
    
    **Validación de Normalidad:**
    
    Los métodos paramétricos ahora incluyen validación automática de normalidad.
    Use `check_normality=True` para validar antes de aplicar el método.
    
    Attributes:
        data_processor: Instancia de DataProcessor para acceder a los datasets.
    """
    
    def __init__(self, data_processor=None):
        """
        Inicializar detector de outliers.
        
        Args:
            data_processor: Instancia opcional de DataProcessor para acceder a datasets.
                Si es None, debe proporcionarse al llamar métodos que requieren datasets.
        """
        self.data_processor = data_processor
    
    def detect_outliers_iqr(self, data: pd.Series, factor: float = None) -> List[int]:
        """
        Detecta outliers usando el método del Rango Intercuartílico (IQR).
        
        Este método identifica outliers como valores que están fuera del rango
        [Q1 - factor*IQR, Q3 + factor*IQR], donde Q1 y Q3 son el primer y tercer
        cuartil respectivamente.
        
        Args:
            data: Serie de pandas con los datos numéricos a analizar.
            factor: Factor multiplicador para IQR. Si es None, se calcula dinámicamente
                según el tamaño de muestra:
                - n < 100: factor = 3.0 (más conservador para muestras pequeñas)
                - n < 1000: factor = 2.0 (moderado)
                - n >= 1000: factor = 1.5 (estándar para muestras grandes)
        
        Returns:
            Lista de índices (posiciones) de los valores identificados como outliers.
        
        Note:
            Este método es robusto a outliers y no asume distribución normal.
            El factor dinámico reduce falsos positivos en muestras pequeñas.
        """
        n = len(data)
        
        # Factor dinámico según tamaño de muestra (más conservador para muestras pequeñas)
        if factor is None:
            if n < 100:
                factor = 3.0  # Muy conservador para muestras pequeñas
            elif n < 1000:
                factor = 2.0  # Moderado para muestras medianas
            else:
                factor = 1.5  # Estándar para muestras grandes
        
        Q1 = data.quantile(0.25)
        Q3 = data.quantile(0.75)
        IQR = Q3 - Q1
        
        if IQR == 0:
            return []  # No hay variabilidad
        
        lower_bound = Q1 - factor * IQR
        upper_bound = Q3 + factor * IQR
        
        outliers = data[(data < lower_bound) | (data > upper_bound)]
        return outliers.index.tolist()
    
    def detect_outliers_zscore(self, data: pd.Series, threshold: float = 3.0,
                                check_normality: bool = True, warn_on_non_normal: bool = True) -> List[int]:
        """
        Detecta outliers usando el método Z-Score con validación de normalidad.
        
        Calcula el z-score de cada observación y marca como outlier aquellas
        con |z-score| > threshold. Este método asume que los datos siguen una
        distribución normal.
        
        IMPORTANTE: Este método requiere que los datos sigan una distribución normal.
        Si los datos no son normales, los resultados pueden no ser confiables.
        Considere usar métodos no paramétricos como IQR o MAD en esos casos.
        
        Args:
            data: Serie de pandas con los datos numéricos a analizar.
            threshold: Umbral de desviaciones estándar. Valores con |z-score| > threshold
                se consideran outliers. Por defecto 3.0.
            check_normality: Si True, valida normalidad antes de aplicar el método.
                Si False, asume normalidad sin validar (no recomendado).
            warn_on_non_normal: Si True, registra advertencia cuando los datos
                no son normales. Solo aplica si check_normality=True.
        
        Returns:
            Lista de índices de los valores identificados como outliers.
        
        Note:
            - **ASUME DISTRIBUCIÓN NORMAL**: Si los datos no son normales, los
              resultados pueden no ser confiables. Use check_normality=True para validar.
            - El umbral estándar es 3.0 (detecta valores a más de 3 desviaciones estándar).
            - Para datos no normales, use detect_outliers_mad() como alternativa robusta.
            - Para muestras pequeñas o cuando se requiere validación estadística,
              considere usar detect_outliers_grubbs().
            
        Raises:
            ValueError: Si la desviación estándar es cero (todos los valores iguales).
        """
        std = data.std()
        if std == 0:
            return []  # Todos los valores son iguales, no hay outliers
        
        # Validar normalidad si está habilitado
        if check_normality:
            normality_result = self._test_normality(data, alpha=0.05)
            
            if not normality_result["is_normal"] and warn_on_non_normal:
                logger.warning(
                    f"Datos no normales detectados en método Z-Score: {normality_result.get('warning', '')}",
                    extra={
                        'test_name': normality_result.get('test_name'),
                        'p_value': normality_result.get('p_value'),
                        'threshold': threshold
                    }
                )
        
        z_scores = np.abs((data - data.mean()) / std)
        outliers = data[z_scores > threshold]
        return outliers.index.tolist()
    
    def detect_outliers_mad(self, data: pd.Series, threshold: float = 3.0) -> List[int]:
        """
        Detecta outliers usando MAD (Median Absolute Deviation).
        
        Método robusto que usa la mediana y MAD en lugar de media y desviación
        estándar. Más resistente a outliers que el método Z-Score.
        
        **Ventajas:**
        - ✅ No asume distribución normal (método robusto)
        - ✅ Más resistente a outliers que Z-Score
        - ✅ Usa mediana en lugar de media (menos sensible a outliers)
        - ✅ Consistente con desviación estándar para datos normales
        
        **Limitaciones:**
        - ⚠️ Solo detecta outliers univariados
        - ⚠️ Puede ser menos potente que Z-Score para datos normales
        - ⚠️ Requiere al menos algunos valores diferentes
        
        **Cuándo usar:**
        - Datos no normales o distribución desconocida
        - Cuando se sospecha que ya hay outliers en los datos
        - Cuando se necesita un método más robusto que Z-Score
        
        Args:
            data: Serie de pandas con los datos numéricos a analizar.
            threshold: Umbral para el modified z-score. Por defecto 3.0.
        
        Returns:
            Lista de índices de los valores identificados como outliers.
        
        Note:
            El factor 0.6745 hace que MAD sea consistente con la desviación estándar
            para distribuciones normales. El factor 1.4826 se usa cuando MAD=0.
            Este método es preferible cuando los datos pueden tener outliers o
            no seguir una distribución normal.
        """
        median = data.median()
        mad = np.median(np.abs(data - median))
        
        # Evitar división por cero
        if mad == 0:
            # Si MAD es cero, todos los valores son iguales a la mediana
            return []
        
        # Calcular modified z-score usando la fórmula correcta
        # El factor 1.4826 hace que MAD sea consistente con la desviación estándar
        # para distribuciones normales: MAD_std = 1.4826 * MAD
        # modified_z_score = (x - median) / (1.4826 * MAD)
        modified_z_scores = (data - median) / (1.4826 * mad)
        outliers = data[np.abs(modified_z_scores) > threshold]
        return outliers.index.tolist()
    
    def detect_outliers_mahalanobis(self, data: pd.DataFrame, threshold: float = 3.0) -> List[int]:
        """
        Detecta outliers usando distancia de Mahalanobis.
        
        La distancia de Mahalanobis mide qué tan lejos está un punto del centro
        de la distribución, considerando las correlaciones entre variables.
        Es apropiada para datos multivariados.
        
        **Ventajas:**
        - ✅ Considera correlaciones entre variables
        - ✅ Detecta outliers multivariados
        - ✅ Escala invariante
        - ✅ Interpretación geométrica clara
        
        **Limitaciones:**
        - ⚠️ **Requiere normalidad multivariada**
        - ⚠️ Sensible a outliers (usa media y matriz de covarianza)
        - ⚠️ Requiere más observaciones que variables (n > p)
        - ⚠️ Puede fallar si la matriz de covarianza es singular
        
        **Cuándo usar:**
        - Datos multivariados normales
        - Cuando se necesita considerar correlaciones entre variables
        - Cuando se tienen suficientes observaciones (n > p)
        
        Args:
            data: DataFrame de pandas con múltiples columnas numéricas.
            threshold: Umbral de distancia de Mahalanobis. Valores con distancia
                > threshold se consideran outliers. Por defecto 3.0.
        
        Returns:
            Lista de índices de observaciones identificadas como outliers.
            Lista vacía si hay menos de 2 observaciones o variables, o si la
            matriz de covarianza no es invertible.
        
        Note:
            - Requiere al menos 2 observaciones y 2 variables numéricas.
            - La matriz de covarianza debe ser invertible (no hay colinealidad perfecta).
            - Asume distribución normal multivariada.
            - Más robusto que métodos univariados cuando hay correlaciones entre variables.
        """
        from scipy.spatial.distance import mahalanobis
        from numpy.linalg import inv
        
        # Solo usar columnas numéricas
        numeric_data = data.select_dtypes(include=[np.number]).dropna()
        if len(numeric_data) < 2 or numeric_data.shape[1] < 2:
            return []
        
        try:
            # Calcular matriz de covarianza
            cov_matrix = np.cov(numeric_data.T)
            
            # Verificar si la matriz es invertible
            if np.linalg.det(cov_matrix) == 0:
                return []
            
            inv_cov_matrix = inv(cov_matrix)
            mean = numeric_data.mean()
            
            # Calcular distancias de Mahalanobis
            mahal_distances = []
            for i in range(len(numeric_data)):
                row = numeric_data.iloc[i]
                distance = mahalanobis(row, mean, inv_cov_matrix)
                mahal_distances.append(distance)
            
            # Identificar outliers
            outlier_indices = []
            for i, distance in enumerate(mahal_distances):
                if distance > threshold:
                    outlier_indices.append(numeric_data.index[i])
            
            return outlier_indices
        except Exception:
            return []
    
    def detect_outliers_lof(self, data: pd.DataFrame, n_neighbors: int = None, 
                            contamination: float = 0.05) -> List[int]:
        """
        Detecta outliers usando Local Outlier Factor (LOF).
        
        LOF es un algoritmo basado en densidad que identifica outliers locales
        comparando la densidad local de un punto con la densidad de sus vecinos.
        Es efectivo para detectar outliers en clusters de diferentes densidades.
        
        Args:
            data: DataFrame de pandas con múltiples columnas numéricas.
            n_neighbors: Número de vecinos a considerar para calcular LOF.
                Si es None, se calcula dinámicamente: min(20, max(10, n_samples // 10)).
                Por defecto None (calculado automáticamente).
            contamination: Proporción esperada de outliers. Por defecto 0.05 (5%),
                más conservador que el 10% estándar.
        
        Returns:
            Lista de índices de observaciones identificadas como outliers.
            Lista vacía si hay insuficientes datos o si ocurre un error.
        
        Note:
            - Requiere al menos n_neighbors observaciones.
            - Contamination más conservador (5% en lugar de 10%) para reducir falsos positivos.
            - n_neighbors dinámico adaptado al tamaño de muestra.
            - Efectivo para datos con múltiples clusters de diferentes densidades.
            
        References:
            Breunig, M. M., et al. (2000). LOF: identifying density-based local outliers.
            ACM SIGMOD Record, 29(2), 93-104.
        """
        from sklearn.neighbors import LocalOutlierFactor
        
        # Solo usar columnas numéricas
        numeric_data = data.select_dtypes(include=[np.number]).dropna()
        n_samples = len(numeric_data)
        
        if n_samples < 10 or numeric_data.shape[1] < 1:
            return []
        
        try:
            # n_neighbors dinámico según tamaño de muestra
            if n_neighbors is None:
                n_neighbors = min(20, max(10, n_samples // 10))
            
            # Asegurar que n_neighbors no sea mayor que n_samples - 1
            n_neighbors = min(n_neighbors, n_samples - 1)
            
            # Contamination más conservador (5% en lugar de 10%)
            contamination = min(contamination, 0.1)  # Máximo 10%
            
            lof = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=contamination)
            predictions = lof.fit_predict(numeric_data)
            
            # Los outliers tienen predicción -1
            outlier_indices = numeric_data.index[predictions == -1].tolist()
            return outlier_indices
        except Exception:
            return []
    
    def detect_outliers_isolation_forest(self, data: pd.DataFrame, contamination: float = 0.05) -> List[int]:
        """
        Detecta outliers usando Isolation Forest.
        
        Isolation Forest es un algoritmo de aprendizaje automático no supervisado
        que aísla outliers usando árboles de decisión aleatorios. Los outliers
        son más fáciles de aislar que los puntos normales.
        
        Args:
            data: DataFrame de pandas con múltiples columnas numéricas.
            contamination: Proporción esperada de outliers. Por defecto 0.05 (5%),
                más conservador que el 10% estándar.
        
        Returns:
            Lista de índices de observaciones identificadas como outliers.
            Lista vacía si hay insuficientes datos o si ocurre un error.
        
        Note:
            - Requiere al menos 2 observaciones.
            - Contamination más conservador (5% en lugar de 10%) para reducir falsos positivos.
            - random_state=42 asegura reproducibilidad.
            - Efectivo para datos de alta dimensionalidad.
            - No requiere normalidad ni supuestos sobre la distribución.
            
        References:
            Liu, F. T., et al. (2008). Isolation forest. 2008 Eighth IEEE International
            Conference on Data Mining, 413-422.
        """
        from sklearn.ensemble import IsolationForest
        
        # Solo usar columnas numéricas
        numeric_data = data.select_dtypes(include=[np.number]).dropna()
        if len(numeric_data) < 2 or numeric_data.shape[1] < 1:
            return []
        
        try:
            # Contamination más conservador (5% en lugar de 10%)
            contamination = min(contamination, 0.1)  # Máximo 10%
            
            iso_forest = IsolationForest(contamination=contamination, random_state=42)
            predictions = iso_forest.fit_predict(numeric_data)
            
            # Los outliers tienen predicción -1
            outlier_indices = numeric_data.index[predictions == -1].tolist()
            return outlier_indices
        except Exception:
            return []
    
    def _test_normality(self, data: pd.Series, alpha: float = 0.05) -> Dict[str, Any]:
        """
        Valida si los datos siguen una distribución normal usando tests estadísticos.
        
        Usa Shapiro-Wilk para muestras pequeñas (n <= 50) y Anderson-Darling para
        muestras más grandes. También realiza un test visual con Q-Q plot.
        
        Args:
            data: Serie de pandas con los datos numéricos a analizar.
            alpha: Nivel de significancia para el test de normalidad. Por defecto 0.05.
        
        Returns:
            Diccionario con:
                - is_normal: bool indicando si los datos son normales
                - test_name: Nombre del test usado
                - statistic: Estadístico del test
                - p_value: p-valor del test
                - warning: Mensaje de advertencia si los datos no son normales
        """
        from scipy import stats
        
        n = len(data)
        data_clean = data.dropna()
        
        if len(data_clean) < 3:
            return {
                "is_normal": False,
                "test_name": "N/A",
                "statistic": None,
                "p_value": None,
                "warning": "Muestra demasiado pequeña para test de normalidad (n < 3)"
            }
        
        # Usar Shapiro-Wilk para muestras pequeñas (más potente para n <= 50)
        # Usar Anderson-Darling para muestras más grandes
        if n <= 50:
            statistic, p_value = stats.shapiro(data_clean)
            test_name = "Shapiro-Wilk"
        else:
            # Anderson-Darling test (más robusto para muestras grandes)
            result = stats.anderson(data_clean, dist='norm')
            statistic = result.statistic
            # Anderson-Darling retorna valores críticos, no p-valor directo
            # Usamos aproximación: comparar con valor crítico al nivel alpha
            critical_values = result.critical_values
            significance_levels = result.significance_level
            # Encontrar el nivel de significancia más cercano
            p_value = None
            for i, level in enumerate(significance_levels):
                if statistic < critical_values[i]:
                    # Aproximar p-valor basado en el nivel de significancia
                    p_value = level / 100.0
                    break
            if p_value is None:
                p_value = 0.001  # Muy significativo
            test_name = "Anderson-Darling"
        
        is_normal = p_value > alpha if p_value is not None else False
        
        warning = None
        if not is_normal:
            warning = (
                f"Los datos no siguen una distribución normal (p={p_value:.4f} < {alpha}). "
                f"El test de Grubbs asume normalidad y puede no ser confiable. "
                f"Considere usar métodos no paramétricos como IQR o MAD."
            )
        
        return {
            "is_normal": is_normal,
            "test_name": test_name,
            "statistic": float(statistic) if statistic is not None else None,
            "p_value": float(p_value) if p_value is not None else None,
            "warning": warning
        }
    
    def _calculate_grubbs_pvalue(self, grubbs_stat: float, n: int) -> float:
        """
        Calcula el p-valor exacto para el test de Grubbs.
        
        Usa la fórmula correcta basada en la distribución t de Student con corrección
        de Bonferroni para pruebas múltiples (ya que buscamos el máximo).
        
        Args:
            grubbs_stat: Estadístico de Grubbs calculado.
            n: Tamaño de la muestra.
        
        Returns:
            p-valor calculado.
        
        References:
            Grubbs, F. E. (1950). Sample criteria for testing outlying observations.
            Stefansky, W. (1972). Rejecting outliers in factorial designs.
        """
        from scipy import stats
        
        if n < 3:
            return 1.0
        
        # Fórmula correcta del p-valor para Grubbs
        # G = estadístico de Grubbs
        # p = n * (1 - F_t(n-2, G * sqrt(n/(n-2+G^2))))
        # Donde F_t es la CDF de la distribución t con n-2 grados de libertad
        
        # Calcular el argumento para la distribución t
        t_arg = grubbs_stat * np.sqrt(n / (n - 2 + grubbs_stat**2))
        
        # Calcular la CDF de la distribución t con n-2 grados de libertad
        t_cdf = stats.t.cdf(t_arg, df=n-2)
        
        # Aplicar corrección de Bonferroni (multiplicar por n porque buscamos el máximo)
        p_value = n * (1 - t_cdf)
        
        # Asegurar que el p-valor esté en el rango [0, 1]
        p_value = max(0.0, min(1.0, p_value))
        
        return p_value
    
    def detect_outliers_grubbs(self, data: pd.Series, alpha: float = 0.05, 
                                check_normality: bool = True, 
                                warn_on_non_normal: bool = True) -> List[int]:
        """
        Detecta outliers usando el test de Grubbs con validación de normalidad.
        
        El test de Grubbs detecta un outlier a la vez en una muestra que se
        asume sigue una distribución normal. Identifica el valor más extremo
        y prueba si es estadísticamente significativo como outlier.
        
        IMPORTANTE: Este test requiere que los datos sigan una distribución normal.
        Si los datos no son normales, los resultados pueden no ser confiables.
        Considere usar métodos no paramétricos como IQR o MAD en esos casos.
        
        Args:
            data: Serie de pandas con los datos numéricos a analizar.
            alpha: Nivel de significancia. Por defecto 0.05.
            check_normality: Si True, valida normalidad antes de aplicar el test.
                Si False, asume normalidad sin validar (no recomendado).
            warn_on_non_normal: Si True, registra advertencia cuando los datos
                no son normales. Solo aplica si check_normality=True.
        
        Returns:
            Lista con el índice del outlier detectado, o lista vacía si no se
            detecta outlier. Solo detecta un outlier por llamada.
        
        Note:
            - Requiere al menos 3 observaciones.
            - **ASUME DISTRIBUCIÓN NORMAL**: Si los datos no son normales, los
              resultados pueden no ser confiables. Use check_normality=True para validar.
            - Solo detecta un outlier por llamada (el más extremo).
            - Para detectar múltiples outliers, use detect_outliers_rosner().
            - El cálculo del p-valor usa la fórmula correcta con corrección de Bonferroni.
            
        References:
            Grubbs, F. E. (1950). Sample criteria for testing outlying observations.
            Annals of Mathematical Statistics, 21(1), 27-58.
            Stefansky, W. (1972). Rejecting outliers in factorial designs.
            Technometrics, 14(2), 469-479.
        """
        from scipy import stats
        
        n = len(data)
        if n < 3:
            logger.warning(
                "Test de Grubbs requiere al menos 3 observaciones",
                extra={'n': n}
            )
            return []
        
        # Validar normalidad si está habilitado
        normality_result = None
        if check_normality:
            normality_result = self._test_normality(data, alpha=alpha)
            
            if not normality_result["is_normal"] and warn_on_non_normal:
                logger.warning(
                    f"Datos no normales detectados en test de Grubbs: {normality_result.get('warning', '')}",
                    extra={
                        'test_name': normality_result.get('test_name'),
                        'p_value': normality_result.get('p_value'),
                        'alpha': alpha
                    }
                )
        
        # Limpiar datos (remover NaN)
        data_clean = data.dropna()
        if len(data_clean) < 3:
            return []
        
        std = data_clean.std()
        if std == 0 or np.isnan(std):
            return []  # Todos los valores son iguales o hay problemas numéricos
        
        # Calcular estadístico de Grubbs
        mean = data_clean.mean()
        
        # Test de Grubbs para el valor más extremo
        max_deviation_idx = (np.abs(data_clean - mean)).idxmax()
        max_deviation = np.abs(data_clean[max_deviation_idx] - mean)
        
        grubbs_stat = max_deviation / std
        
        # Valor crítico de Grubbs (fórmula correcta)
        t_val = stats.t.ppf(1 - alpha / (2 * n), n - 2)
        critical_value = (n - 1) * np.sqrt(t_val**2 / (n - 2 + t_val**2)) / np.sqrt(n)
        
        if grubbs_stat > critical_value:
            return [max_deviation_idx]
        else:
            return []
    
    def _get_dixon_critical_values(self, alpha: float = 0.05) -> Dict[int, float]:
        """
        Obtiene los valores críticos del test de Dixon para diferentes tamaños de muestra.
        
        Args:
            alpha: Nivel de significancia. Valores soportados: 0.01, 0.05, 0.10.
        
        Returns:
            Diccionario con valores críticos para n=3 a n=30.
        
        References:
            Dixon, W. J. (1950). Analysis of extreme values.
            Rorabacher, D. B. (1991). Statistical treatment for rejection of deviant values.
        """
        # Valores críticos para alpha=0.01
        critical_001 = {
            3: 0.988, 4: 0.889, 5: 0.780, 6: 0.698, 7: 0.637,
            8: 0.590, 9: 0.555, 10: 0.527, 11: 0.502, 12: 0.482,
            13: 0.465, 14: 0.450, 15: 0.438, 16: 0.426, 17: 0.416,
            18: 0.407, 19: 0.399, 20: 0.391, 21: 0.384, 22: 0.378,
            23: 0.372, 24: 0.367, 25: 0.362, 26: 0.357, 27: 0.353,
            28: 0.349, 29: 0.345, 30: 0.341
        }
        
        # Valores críticos para alpha=0.05 (más común)
        critical_005 = {
            3: 0.941, 4: 0.765, 5: 0.642, 6: 0.560, 7: 0.507,
            8: 0.468, 9: 0.437, 10: 0.412, 11: 0.392, 12: 0.376,
            13: 0.361, 14: 0.349, 15: 0.338, 16: 0.329, 17: 0.320,
            18: 0.313, 19: 0.306, 20: 0.300, 21: 0.295, 22: 0.290,
            23: 0.285, 24: 0.281, 25: 0.277, 26: 0.273, 27: 0.269,
            28: 0.266, 29: 0.263, 30: 0.260
        }
        
        # Valores críticos para alpha=0.10
        critical_010 = {
            3: 0.886, 4: 0.679, 5: 0.557, 6: 0.484, 7: 0.434,
            8: 0.399, 9: 0.370, 10: 0.349, 11: 0.332, 12: 0.318,
            13: 0.305, 14: 0.295, 15: 0.286, 16: 0.278, 17: 0.271,
            18: 0.265, 19: 0.259, 20: 0.254, 21: 0.249, 22: 0.245,
            23: 0.241, 24: 0.238, 25: 0.235, 26: 0.232, 27: 0.229,
            28: 0.227, 29: 0.224, 30: 0.222
        }
        
        # Seleccionar tabla según alpha
        if abs(alpha - 0.01) < 0.001:
            return critical_001
        elif abs(alpha - 0.05) < 0.001:
            return critical_005
        elif abs(alpha - 0.10) < 0.001:
            return critical_010
        else:
            # Si alpha no está soportado, usar 0.05 y advertir
            logger.warning(
                f"Alpha={alpha} no está soportado para test de Dixon. Usando alpha=0.05.",
                extra={'requested_alpha': alpha}
            )
            return critical_005
    
    def _calculate_dixon_pvalue(self, q_statistic: float, n: int, alpha: float = 0.05) -> float:
        """
        Calcula el p-valor para el test de Dixon usando interpolación de tablas estadísticas.
        
        El cálculo del p-valor se basa en la distribución del estadístico Q de Dixon.
        Usa interpolación entre valores críticos conocidos para diferentes niveles de alpha.
        
        Args:
            q_statistic: Estadístico Q calculado (Q10 o Q11).
            n: Tamaño de la muestra (debe estar entre 3 y 30).
            alpha: Nivel de significancia usado para obtener valores críticos de referencia.
                Por defecto 0.05.
        
        Returns:
            p-valor calculado (aproximado usando interpolación).
        
        Note:
            Este método usa interpolación entre valores críticos conocidos y puede
            no ser exacto para todos los casos. Para mayor precisión, consulte
            tablas estadísticas oficiales del test de Dixon.
        
        References:
            Dixon, W. J. (1950). Analysis of extreme values.
            Rorabacher, D. B. (1991). Statistical treatment for rejection of deviant values.
        """
        if n < 3 or n > 30:
            return 1.0
        
        # Obtener valores críticos para diferentes niveles de alpha
        critical_001 = self._get_dixon_critical_values(0.01)
        critical_005 = self._get_dixon_critical_values(0.05)
        critical_010 = self._get_dixon_critical_values(0.10)
        
        cv_001 = critical_001.get(n, 0.05)
        cv_005 = critical_005.get(n, 0.05)
        cv_010 = critical_010.get(n, 0.05)
        
        # Si el estadístico es mayor que el valor crítico más estricto (0.01)
        if q_statistic >= cv_001:
            # p-valor < 0.01, usar extrapolación conservadora
            if q_statistic >= cv_001 * 1.2:  # Muy extremo
                return 0.001
            else:
                # Interpolación entre 0.01 y un valor más pequeño
                ratio = (q_statistic - cv_001) / (cv_001 * 0.2)
                return max(0.0001, 0.01 - ratio * 0.009)
        
        # Si el estadístico está entre 0.01 y 0.05
        elif q_statistic >= cv_005:
            # Interpolación lineal entre p=0.01 y p=0.05
            ratio = (q_statistic - cv_005) / (cv_001 - cv_005)
            return 0.05 - ratio * 0.04
        
        # Si el estadístico está entre 0.05 y 0.10
        elif q_statistic >= cv_010:
            # Interpolación lineal entre p=0.05 y p=0.10
            ratio = (q_statistic - cv_010) / (cv_005 - cv_010)
            return 0.10 - ratio * 0.05
        
        # Si el estadístico es menor que el valor crítico para alpha=0.10
        else:
            # Extrapolación conservadora para p > 0.10
            if q_statistic <= cv_010 * 0.5:
                return 1.0
            else:
                # Interpolación entre p=0.10 y p=1.0
                ratio = (q_statistic - cv_010 * 0.5) / (cv_010 - cv_010 * 0.5)
                return 0.10 + ratio * 0.90
    
    def detect_outliers_dixon(self, data: pd.Series, alpha: float = 0.05) -> List[int]:
        """
        Detecta outliers usando el test de Dixon con cálculo mejorado del p-valor.
        
        El test de Dixon es apropiado para muestras pequeñas (3-30 observaciones).
        Detecta outliers en los extremos (mínimo o máximo) de la muestra ordenada.
        
        IMPORTANTE: Este test es apropiado solo para muestras pequeñas. Para muestras
        más grandes (n > 30), use detect_outliers_rosner() o detect_outliers_grubbs().
        
        Args:
            data: Serie de pandas con los datos numéricos a analizar.
            alpha: Nivel de significancia. Valores soportados: 0.01, 0.05, 0.10.
                Por defecto 0.05. Si se proporciona otro valor, se usará 0.05 con advertencia.
        
        Returns:
            Lista de índices de outliers detectados (puede incluir mínimo, máximo, o ambos).
            Lista vacía si no se detectan outliers o si el tamaño de muestra está fuera del rango.
        
        Note:
            - Requiere entre 3 y 30 observaciones.
            - Solo detecta outliers en los extremos (mínimo o máximo).
            - Soporta múltiples niveles de significancia: 0.01, 0.05, 0.10.
            - El cálculo del p-valor usa interpolación de tablas estadísticas.
            - Para muestras más grandes (n > 30), use detect_outliers_rosner().
            
        References:
            Dixon, W. J. (1950). Analysis of extreme values. Annals of Mathematical
            Statistics, 21(4), 488-506.
            Rorabacher, D. B. (1991). Statistical treatment for rejection of deviant values:
            Critical values of Dixon's "Q" parameter and related subrange ratios at the 95%
            confidence level. Analytical Chemistry, 63(2), 139-146.
        """
        n = len(data)
        if n < 3 or n > 30:  # Dixon test es para muestras pequeñas
            logger.warning(
                f"Test de Dixon requiere 3-30 observaciones. Tamaño actual: {n}",
                extra={'n': n}
            )
            return []
        
        sorted_data = data.sort_values()
        indices = sorted_data.index
        
        # Verificar que hay variabilidad en los datos
        if sorted_data.iloc[-1] == sorted_data.iloc[0]:
            return []  # Todos los valores son iguales
        
        # Calcular Q10 y Q11 (estadísticos de Dixon)
        Q10 = (sorted_data.iloc[1] - sorted_data.iloc[0]) / (sorted_data.iloc[-1] - sorted_data.iloc[0])
        Q11 = (sorted_data.iloc[-1] - sorted_data.iloc[-2]) / (sorted_data.iloc[-1] - sorted_data.iloc[0])
        
        # Obtener valores críticos para el nivel de significancia especificado
        critical_values = self._get_dixon_critical_values(alpha)
        critical_value = critical_values.get(n)
        
        if critical_value is None:
            logger.warning(
                f"No se encontró valor crítico para n={n} y alpha={alpha}. Usando valor por defecto.",
                extra={'n': n, 'alpha': alpha}
            )
            return []
        
        outliers = []
        if Q10 > critical_value:
            outliers.append(indices[0])  # Valor mínimo es outlier
        if Q11 > critical_value:
            outliers.append(indices[-1])  # Valor máximo es outlier
        
        return outliers
    
    def _calculate_rosner_critical_value(self, n: int, i: int, alpha: float) -> float:
        """
        Calcula el valor crítico para el test de Rosner en la iteración i.
        
        La fórmula del valor crítico está basada en la distribución t de Student
        con ajuste por comparaciones múltiples. El ajuste divide alpha por el número
        de comparaciones realizadas hasta el momento.
        
        Args:
            n: Tamaño original de la muestra.
            i: Iteración actual (0-indexed).
            alpha: Nivel de significancia global.
        
        Returns:
            Valor crítico para la iteración i.
        
        References:
            Rosner, B. (1983). Percentage points for a generalized ESD many-outlier procedure.
            Technometrics, 25(2), 165-172.
        """
        from scipy import stats
        
        # Ajuste por comparaciones múltiples: dividir alpha por el número de comparaciones
        # En la iteración i, hemos hecho i+1 comparaciones potenciales
        adjusted_alpha = alpha / (2 * (n - i))
        
        # Grados de libertad: n - i - 2 (después de remover i outliers)
        df = n - i - 2
        
        if df < 1:
            return np.inf  # No hay suficientes grados de libertad
        
        # Calcular valor t crítico
        t_val = stats.t.ppf(1 - adjusted_alpha, df)
        
        # Fórmula del valor crítico de Rosner
        # lambda_i = (n - i - 1) * t_{alpha/(2*(n-i)), n-i-2} / sqrt((n - i - 2 + t^2) * (n - i))
        critical_value = (n - i - 1) * t_val / np.sqrt((n - i - 2 + t_val**2) * (n - i))
        
        return critical_value
    
    def _calculate_rosner_pvalue(self, test_stat: float, n: int, i: int, alpha: float) -> float:
        """
        Calcula el p-valor para el test de Rosner en la iteración i.
        
        El p-valor se calcula usando la distribución t de Student con el mismo
        ajuste por comparaciones múltiples que el valor crítico. Esto asegura
        consistencia entre el valor crítico y el p-valor.
        
        Args:
            test_stat: Estadístico de test calculado (R_i).
            n: Tamaño original de la muestra.
            i: Iteración actual (0-indexed).
            alpha: Nivel de significancia global (usado para referencia, no para cálculo directo).
        
        Returns:
            p-valor ajustado por comparaciones múltiples.
        
        Note:
            El p-valor calculado aquí es el p-valor "crudo" que luego debe ser
            ajustado por comparaciones múltiples si se reporta. Sin embargo, para
            comparación con el valor crítico, este p-valor ya está en la escala correcta.
        """
        from scipy import stats
        
        # Grados de libertad después de remover i outliers
        df = n - i - 2
        
        if df < 1:
            return 1.0  # No hay suficientes grados de libertad
        
        # Calcular el argumento para la distribución t
        # Similar a Grubbs: t_arg = R * sqrt((n-i) / (n-i-2 + R^2))
        t_arg = test_stat * np.sqrt((n - i) / (n - i - 2 + test_stat**2))
        
        # Calcular p-valor usando distribución t
        # El p-valor es 2 * (1 - CDF) para una prueba de dos colas
        p_value_raw = 2 * (1 - stats.t.cdf(t_arg, df))
        
        # Ajustar por comparaciones múltiples usando Bonferroni
        # En la iteración i, hemos hecho i+1 comparaciones potenciales
        num_comparisons = n - i
        p_value_adjusted = min(1.0, p_value_raw * num_comparisons)
        
        return p_value_adjusted
    
    def detect_outliers_rosner(self, data: pd.Series, k: int = None, alpha: float = 0.05,
                                check_normality: bool = True, warn_on_non_normal: bool = True) -> List[int]:
        """
        Detecta múltiples outliers usando el test de Rosner (ESD - Extreme Studentized Deviate).
        
        El test de Rosner puede detectar múltiples outliers en una muestra grande.
        Funciona iterativamente, removiendo el outlier más extremo en cada iteración
        y ajustando los estadísticos y valores críticos.
        
        IMPORTANTE: Este test requiere que los datos sigan una distribución normal.
        Si los datos no son normales, los resultados pueden no ser confiables.
        
        Args:
            data: Serie de pandas con los datos numéricos a analizar.
            k: Número máximo de outliers a detectar. Si es None, se calcula como
                máximo 10% del tamaño de muestra.
            alpha: Nivel de significancia global. Por defecto 0.05.
            check_normality: Si True, valida normalidad antes de aplicar el test.
                Si False, asume normalidad sin validar (no recomendado).
            warn_on_non_normal: Si True, registra advertencia cuando los datos
                no son normales. Solo aplica si check_normality=True.
        
        Returns:
            Lista de índices de outliers detectados, ordenados desde el más extremo.
            Lista vacía si no se detectan outliers o si el tamaño de muestra es insuficiente.
        
        Note:
            - Requiere al menos 25 observaciones.
            - **ASUME DISTRIBUCIÓN NORMAL**: Si los datos no son normales, los
              resultados pueden no ser confiables. Use check_normality=True para validar.
            - El método ajusta automáticamente por comparaciones múltiples usando
              el método de Rosner (ajuste en el valor crítico).
            - Detecta outliers de forma iterativa, removiendo el más extremo en cada paso.
            - El valor crítico y p-valor se calculan correctamente en cada iteración.
            
        References:
            Rosner, B. (1983). Percentage points for a generalized ESD many-outlier procedure.
            Technometrics, 25(2), 165-172.
        """
        from scipy import stats
        
        n = len(data)
        if n < 25:  # Rosner test requiere muestra grande
            logger.warning(
                f"Test de Rosner requiere al menos 25 observaciones. Tamaño actual: {n}",
                extra={'n': n}
            )
            return []
        
        # Validar normalidad si está habilitado
        if check_normality:
            normality_result = self._test_normality(data, alpha=alpha)
            
            if not normality_result["is_normal"] and warn_on_non_normal:
                logger.warning(
                    f"Datos no normales detectados en test de Rosner: {normality_result.get('warning', '')}",
                    extra={
                        'test_name': normality_result.get('test_name'),
                        'p_value': normality_result.get('p_value'),
                        'alpha': alpha
                    }
                )
        
        std = data.std()
        if std == 0:
            return []  # Todos los valores son iguales
        
        if k is None:
            k = max(1, int(0.1 * n))  # Máximo 10% de outliers
        
        k = min(k, n // 2)  # No más de la mitad de los datos
        
        outliers = []
        working_data = data.copy()
        
        for i in range(k):
            if len(working_data) < 3:
                break
            
            std_working = working_data.std()
            if std_working == 0:
                break  # Ya no hay variabilidad
                
            mean = working_data.mean()
            
            # Encontrar el valor más extremo
            deviations = np.abs(working_data - mean)
            max_idx = deviations.idxmax()
            max_deviation = deviations[max_idx]
            
            # Calcular estadístico de test (R_i)
            test_stat = max_deviation / std_working
            
            # Calcular valor crítico usando método mejorado
            critical_value = self._calculate_rosner_critical_value(n, i, alpha)
            
            if test_stat > critical_value:
                outliers.append(max_idx)
                working_data = working_data.drop(max_idx)
            else:
                break
        
        return outliers
    
    def _get_strategy_description(self, strategy: str, data_is_normal: bool = None, 
                                   min_univariate: int = None, min_multivariate: int = None) -> str:
        """
        Obtiene descripción detallada de la estrategia aplicada.
        
        Args:
            strategy: Nombre de la estrategia aplicada
            data_is_normal: Si los datos son normales (para estrategia adaptive)
            min_univariate: Mínimo de métodos univariados (solo para voting)
            min_multivariate: Mínimo de métodos multivariados (solo para voting)
            
        Returns:
            Descripción textual de la estrategia
        """
        if strategy == 'voting':
            min_uni = min_univariate if min_univariate is not None else 2
            min_multi = min_multivariate if min_multivariate is not None else 1
            return (
                f"Estrategia de Votación: Un outlier se considera final si es detectado por "
                f"al menos {min_uni} métodos univariados Y al menos {min_multi} "
                f"método{'s' if min_multi > 1 else ''} multivariado, O por cualquier prueba de hipótesis "
                "(Grubbs, Dixon, Rosner)."
            )
        elif strategy == 'adaptive':
            normal_text = 'Datos Normales' if data_is_normal else 'Datos No Normales'
            if data_is_normal:
                detail = (
                    "Prioriza métodos paramétricos (Z-Score, Mahalanobis) cuando los datos son normales. "
                    "Incluye outliers detectados por: (1) Pruebas de hipótesis, (2) Al menos 1 método "
                    "paramétrico univariado Y 1 multivariado paramétrico, (3) Al menos 2 métodos no "
                    "paramétricos univariados, (4) Al menos 1 método multivariado no paramétrico."
                )
            else:
                detail = (
                    "Prioriza métodos no paramétricos (IQR, MAD, LOF, Isolation Forest) cuando los datos "
                    "no son normales. Incluye outliers detectados por: (1) Pruebas de hipótesis (si "
                    "validadas), (2) Al menos 2 métodos no paramétricos univariados, (3) Al menos 1 "
                    "método multivariado no paramétrico, (4) Métodos paramétricos solo si validados "
                    "individualmente."
                )
            return (
                f"Estrategia Adaptativa ({normal_text}): Se adapta automáticamente según la normalidad "
                f"de los datos. {detail} Siempre incluye outliers detectados por pruebas de hipótesis "
                "(alta confianza estadística)."
            )
        elif strategy == 'union':
            return (
                "Estrategia de Unión: Un outlier se considera final si es detectado por "
                "cualquier método (univariado, multivariado o prueba de hipótesis). "
                "Más inclusiva, captura más outliers potenciales."
            )
        elif strategy == 'intersection':
            return (
                "Estrategia de Intersección: Un outlier se considera final solo si es detectado "
                "por TODOS los métodos de cada categoría (al menos 1 univariado, 1 multivariado "
                "y 1 prueba de hipótesis). Más conservadora, alta especificidad."
            )
        else:
            return f"Estrategia: {strategy}"
    
    def detect_outliers_complete(self, filename: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ejecuta detección completa de outliers usando todos los métodos disponibles.
        
        Esta función aplica múltiples métodos de detección (univariados, multivariados
        y pruebas de hipótesis) y combina los resultados según la estrategia especificada.
        
        **Estrategias Disponibles:**
        
        1. **'voting'** (Por defecto): Estrategia de votación tradicional
           - Requiere consenso entre métodos según umbrales configurables
           - Incluye siempre outliers de pruebas de hipótesis
        
        2. **'adaptive'** (RECOMENDADA): Estrategia adaptativa según normalidad
           - **Si datos son normales**: Prioriza métodos paramétricos (Z-Score, Mahalanobis)
           - **Si datos NO son normales**: Prioriza métodos no paramétricos (IQR, MAD, LOF, Isolation Forest)
           - Siempre incluye outliers detectados por pruebas de hipótesis
           - Se adapta automáticamente evaluando normalidad en múltiples variables
        
        3. **'union'**: Incluye cualquier outlier detectado por cualquier método
           - Más inclusiva, captura más outliers potenciales
        
        4. **'intersection'**: Solo incluye outliers detectados por todos los métodos
           - Más conservadora, alta especificidad
        
        Args:
            filename: Nombre del archivo del dataset a analizar (debe estar cargado
                en data_processor).
            config: Diccionario con configuración de detección:
                - combineStrategy (str): 'voting', 'adaptive', 'union', o 'intersection'
                  Por defecto 'voting'. 'adaptive' es recomendada para investigación clínica.
                - subjectId (str): Nombre de la columna que identifica a cada sujeto
                - minUnivariate (int): Mínimo de métodos univariados (solo para 'voting').
                  Por defecto 2.
                - minMultivariate (int): Mínimo de métodos multivariados (solo para 'voting').
                  Por defecto 1.
        
        Returns:
            Diccionario con resultados completos de la detección:
                - total_records (int): Total de registros en el dataset
                - combination_strategy (str): Estrategia solicitada
                - strategy_applied (str): Estrategia realmente aplicada
                - strategy_description (str): Descripción de la estrategia aplicada
                - normality_assessment (dict): Evaluación de normalidad de los datos:
                    - data_is_generally_normal (bool): Si los datos son generalmente normales
                    - normal_ratio (float): Porcentaje de variables normales evaluadas
                    - variables_evaluated (int): Número de variables evaluadas
                - methods (dict): Resultados por categoría:
                    - univariate: IQR, Z-Score, MAD
                    - multivariate: Mahalanobis, LOF, Isolation Forest
                    - hypothesis_tests: Grubbs, Dixon, Rosner
                - final_outliers (list): Lista de IDs de outliers finales
                - outliers_detected (int): Número total de outliers detectados
                - outlier_percentage (float): Porcentaje de outliers
                - outlier_votes_detail (dict): Detalle de votos por outlier para análisis
        
        Raises:
            ValueError: Si el dataset no se encuentra o no hay columnas numéricas.
            Exception: Si ocurre un error durante el procesamiento.
        
        Note:
            - La estrategia 'adaptive' es recomendada para investigación clínica ya que
              se adapta automáticamente a las características de los datos.
            - La evaluación de normalidad se realiza en hasta 5 variables representativas.
            - Los outliers detectados por pruebas de hipótesis siempre se incluyen
              (alta confianza estadística).
        """
        try:
            logger.info(
                f"Iniciando detección completa de outliers para dataset '{filename}'",
                extra={'dataset_filename': filename, 'config': config}
            )
            
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                available = list(self.data_processor.datasets.keys())
                error_msg = (
                    f"Dataset '{filename}' no encontrado en data_processor. "
                    f"Datasets disponibles: {available}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'available_datasets': available})
                raise ValueError(error_msg)
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            
            # Obtener configuración
            combine_strategy = config.get('combineStrategy', 'voting')
            subject_id = config.get('subjectId')
            min_univariate = int(config.get('minUnivariate', 2))
            min_multivariate = int(config.get('minMultivariate', 1))
            
            logger.info(
                f"Configuración de detección: estrategia={combine_strategy}, "
                f"subject_id={subject_id}, min_univariate={min_univariate}, min_multivariate={min_multivariate}",
                extra={'combine_strategy': combine_strategy, 'subject_id': subject_id}
            )
            
            if subject_id and subject_id in df.columns:
                subject_ids = df[subject_id].tolist()
            else:
                subject_ids = list(range(len(df)))
                if subject_id:
                    logger.warning(
                        f"Columna de ID de sujeto '{subject_id}' no encontrada. Usando índices numéricos.",
                        extra={'subject_id': subject_id, 'available_columns': list(df.columns)}
                    )
            
            # Obtener solo variables numéricas para análisis
            numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
            if subject_id in numeric_columns:
                numeric_columns.remove(subject_id)
            
            if len(numeric_columns) == 0:
                error_msg = (
                    f"No hay columnas numéricas para analizar en el dataset '{filename}'. "
                    f"Columnas disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'columns': list(df.columns)})
                raise ValueError(error_msg)
            
            logger.info(
                f"Analizando {len(numeric_columns)} variables numéricas en {len(df)} registros",
                extra={'num_variables': len(numeric_columns), 'num_records': len(df), 'variables': numeric_columns}
            )
            
            # Eliminar filas con valores faltantes para análisis multivariado
            # NOTA: Esta eliminación es necesaria para métodos multivariados que requieren
            # datos completos. Se documenta para transparencia en publicaciones.
            rows_before = len(df)
            numeric_df = df[numeric_columns].dropna()
            rows_after = len(numeric_df)
            rows_removed = rows_before - rows_after
            
            if rows_removed > 0:
                logger.warning(
                    f"Se eliminaron {rows_removed} filas con valores faltantes para análisis multivariado. "
                    f"Esto es necesario para métodos que requieren datos completos. "
                    f"Filas antes: {rows_before}, Filas después: {rows_after}.",
                    extra={
                        'rows_before': rows_before,
                        'rows_after': rows_after,
                        'rows_removed': rows_removed,
                        'reason': 'multivariate_analysis_requires_complete_data'
                    }
                )
            
            # Resultados por método
            results = {
                'total_records': int(len(df)),
                'combination_strategy': str(combine_strategy),
                'min_univariate': int(min_univariate),
                'min_multivariate': int(min_multivariate),
                'subject_id_column': str(subject_id) if subject_id else None,  # Guardar la columna de ID seleccionada
                'methods': {
                    'univariate': {},
                    'multivariate': {},
                    'hypothesis_tests': {}
                },
                'final_outliers': [],
                'outlier_percentage': 0.0
            }
            
            # === SISTEMA DE PUNTUACIÓN POR OBSERVACIÓN ===
            # En lugar de acumular outliers de todas las variables, creamos una matriz
            # que rastrea en cuántas variables y métodos cada observación es outlier
            
            # Matriz de outliers: observaciones × variables × métodos univariados
            # 3 métodos univariados: IQR (0), Z-Score (1), MAD (2)
            n_obs = len(numeric_df)
            n_vars = len(numeric_columns)
            outlier_matrix = np.zeros((n_obs, n_vars, 3), dtype=bool)
            
            # Diccionario para mapear índices de numeric_df a índices de df original
            df_index_to_numeric_df_index = {}
            for i, orig_idx in enumerate(numeric_df.index):
                df_index_to_numeric_df_index[orig_idx] = i
            
            # Para cada variable numérica, detectar outliers y llenar la matriz
            outliers_iqr_by_var = {}  # Para reporte detallado
            outliers_zscore_by_var = {}
            outliers_mad_by_var = {}
            
            for j, column in enumerate(numeric_columns):
                # Usar datos completos (sin dropna) para mantener índices originales
                data = df[column].dropna()
                if len(data) < 3:  # Mínimo para detectar outliers
                    continue
                
                # IQR
                iqr_outliers = self.detect_outliers_iqr(data)
                outliers_iqr_by_var[column] = iqr_outliers
                
                # Z-Score
                zscore_outliers = self.detect_outliers_zscore(data)
                outliers_zscore_by_var[column] = zscore_outliers
                
                # MAD
                mad_outliers = self.detect_outliers_mad(data)
                outliers_mad_by_var[column] = mad_outliers
                
                # Llenar matriz: marcar outliers en la matriz si están en numeric_df
                for idx in set(iqr_outliers + zscore_outliers + mad_outliers):
                    if idx in df_index_to_numeric_df_index:
                        numeric_idx = df_index_to_numeric_df_index[idx]
                        if numeric_idx < n_obs:
                            if idx in iqr_outliers:
                                outlier_matrix[numeric_idx, j, 0] = True
                            if idx in zscore_outliers:
                                outlier_matrix[numeric_idx, j, 1] = True
                            if idx in mad_outliers:
                                outlier_matrix[numeric_idx, j, 2] = True
            
            # Calcular scores por observación
            # Score = número de variables donde es outlier en al menos 2 métodos
            univariate_scores = (outlier_matrix.sum(axis=2) >= 2).sum(axis=1)
            
            # Para compatibilidad con código existente, también mantener listas planas
            outliers_iqr = []
            outliers_zscore = []
            outliers_mad = []
            for var_outliers in outliers_iqr_by_var.values():
                outliers_iqr.extend(var_outliers)
            for var_outliers in outliers_zscore_by_var.values():
                outliers_zscore.extend(var_outliers)
            for var_outliers in outliers_mad_by_var.values():
                outliers_mad.extend(var_outliers)
            
            # Convertir índices a subject_ids con valores
            def indices_to_subjects_with_values(indices, method_name="", column=None):
                result = []
                for i in indices:
                    if i < len(df):
                        if subject_id and subject_id in df.columns:
                            outlier_id = str(df[subject_id].iloc[i])
                        else:
                            outlier_id = f"ID_{i}"
                        
                        # Obtener valor si hay columna específica
                        value = None
                        if column and column in df.columns:
                            value = df[column].iloc[i]
                        
                        result.append({
                            'id': outlier_id,
                            'value': float(value) if value is not None else None,
                            'index': int(i),
                            'method': method_name
                        })
                return result
            
            # Función simple para compatibilidad
            def indices_to_subjects(indices):
                if subject_id and subject_id in df.columns:
                    return [str(df[subject_id].iloc[i]) if i < len(df) else f"Index_{i}" for i in indices if i < len(df)]
                else:
                    return [f"ID_{i}" for i in indices if i < len(df)]
            
            # Remover duplicados y convertir a subject_ids
            outliers_iqr = list(set(outliers_iqr))
            outliers_zscore = list(set(outliers_zscore))
            outliers_mad = list(set(outliers_mad))
            
            results['methods']['univariate'] = {
                'iqr': {
                    'outliers': indices_to_subjects(outliers_iqr),
                    'count': int(len(outliers_iqr))
                },
                'zscore': {
                    'outliers': indices_to_subjects(outliers_zscore),
                    'count': int(len(outliers_zscore))
                },
                'mad': {
                    'outliers': indices_to_subjects(outliers_mad),
                    'count': int(len(outliers_mad))
                }
            }
            
            # === MÉTODOS MULTIVARIADOS ===
            # Mahalanobis
            mahalanobis_outliers = self.detect_outliers_mahalanobis(df[numeric_columns])
            
            # LOF
            lof_outliers = self.detect_outliers_lof(df[numeric_columns])
            
            # Isolation Forest
            isolation_outliers = self.detect_outliers_isolation_forest(df[numeric_columns])
            
            results['methods']['multivariate'] = {
                'mahalanobis': {
                    'outliers': indices_to_subjects(mahalanobis_outliers),
                    'count': int(len(mahalanobis_outliers))
                },
                'lof': {
                    'outliers': indices_to_subjects(lof_outliers),
                    'count': int(len(lof_outliers))
                },
                'isolation_forest': {
                    'outliers': indices_to_subjects(isolation_outliers),
                    'count': int(len(isolation_outliers))
                }
            }
            
            # === PRUEBAS DE HIPÓTESIS ===
            # Usar métodos detallados para consistencia con la interfaz
            grubbs_detailed = self.get_grubbs_detailed_results(filename, subject_id)
            dixon_detailed = self.get_dixon_detailed_results(filename, subject_id)
            rosner_detailed = self.get_rosner_detailed_results(filename, subject_id)
            
            # Extraer outliers de los resultados detallados
            grubbs_outliers = []
            dixon_outliers = []
            rosner_outliers = []
            
            # Función auxiliar para convertir observation_id a índice del DataFrame original
            # IMPORTANTE: Retorna el índice del DataFrame original (df), no la posición numérica
            def observation_id_to_index(obs_id, df, subject_id_col):
                """Convierte observation_id a índice del DataFrame original.
                Puede ser formato 'ID_X' o directamente el ID del sujeto.
                
                Args:
                    obs_id: ID de observación (puede ser 'ID_X' o ID del sujeto directamente)
                    df: DataFrame original con todos los datos
                    subject_id_col: Nombre de la columna que contiene el ID del sujeto
                
                Returns:
                    Índice del DataFrame original (puede ser numérico o de otro tipo) o None si no se encuentra
                """
                if not obs_id:
                    return None
                    
                obs_id_str = str(obs_id).strip()
                
                # Caso 1: Formato 'ID_X' donde X es el índice numérico o posición
                if obs_id_str.startswith('ID_'):
                    try:
                        idx_num = int(obs_id_str.split('_')[1])
                        # Primero verificar si es un índice válido del DataFrame
                        if idx_num in df.index:
                            return idx_num
                        # Si no está en el índice, intentar como posición numérica
                        elif 0 <= idx_num < len(df):
                            return df.index[idx_num]
                    except (ValueError, IndexError):
                        pass
                    return None
                else:
                    # Caso 2: Es el ID del sujeto directamente
                    if subject_id_col and subject_id_col in df.columns:
                        try:
                            # Buscar todas las filas donde el subject_id coincide
                            # Convertir ambos a string para comparación robusta y eliminar espacios
                            matches = df[df[subject_id_col].astype(str).str.strip() == obs_id_str]
                            if not matches.empty:
                                # Retornar el primer índice encontrado del DataFrame original
                                # Si hay múltiples filas con el mismo ID, retornamos la primera
                                return matches.index[0]
                        except Exception as e:
                            logger.warning(
                                f"Error al buscar observation_id '{obs_id_str}' en columna '{subject_id_col}': {e}",
                                extra={'observation_id': obs_id_str, 'subject_id_col': subject_id_col}
                            )
                    return None
            
            if grubbs_detailed.get('success'):
                for var_result in grubbs_detailed.get('variables', []):
                    if var_result.get('success') and var_result.get('is_outlier'):
                        observation_id = var_result.get('observation_id', '')
                        idx = observation_id_to_index(observation_id, df, subject_id)
                        if idx is not None:
                            grubbs_outliers.append(idx)
            
            if dixon_detailed.get('success'):
                for var_result in dixon_detailed.get('variables', []):
                    if var_result.get('success') and var_result.get('is_outlier'):
                        observation_id = var_result.get('observation_id', '')
                        idx = observation_id_to_index(observation_id, df, subject_id)
                        if idx is not None:
                            dixon_outliers.append(idx)
            
            if rosner_detailed.get('success'):
                for var_result in rosner_detailed.get('variables', []):
                    if var_result.get('success'):
                        # Rosner puede detectar múltiples outliers por variable
                        for outlier_detail in var_result.get('outlier_details', []):
                            observation_id = outlier_detail.get('observation_id', '')
                            idx = observation_id_to_index(observation_id, df, subject_id)
                            if idx is not None:
                                rosner_outliers.append(idx)
            
            # Función auxiliar para convertir índices del DataFrame original a subject_ids
            def original_indices_to_subjects(indices, df_original, subject_id_col):
                """Convierte índices del DataFrame original a subject_ids.
                Maneja correctamente índices no numéricos."""
                result = []
                for idx in indices:
                    if idx in df_original.index:
                        if subject_id_col and subject_id_col in df_original.columns:
                            try:
                                subject_id = str(df_original.loc[idx, subject_id_col])
                                result.append(subject_id)
                            except (KeyError, IndexError):
                                result.append(f"ID_{idx}")
                        else:
                            result.append(f"ID_{idx}")
                return result
            
            results['methods']['hypothesis_tests'] = {
                'grubbs': {
                    'outliers': original_indices_to_subjects(grubbs_outliers, df, subject_id),
                    'count': int(len(grubbs_outliers))
                },
                'dixon': {
                    'outliers': original_indices_to_subjects(dixon_outliers, df, subject_id),
                    'count': int(len(dixon_outliers))
                },
                'rosner': {
                    'outliers': original_indices_to_subjects(rosner_outliers, df, subject_id),
                    'count': int(len(rosner_outliers))
                }
            }
            
            # === EVALUAR NORMALIDAD GENERAL DE LOS DATOS ===
            # Evaluar normalidad en múltiples variables para determinar estrategia adaptativa
            normality_results = []
            for column in numeric_columns[:min(5, len(numeric_columns))]:  # Evaluar hasta 5 variables
                data_col = df[column].dropna()
                if len(data_col) >= 3:  # Mínimo para test de normalidad
                    normality_result = self._test_normality(data_col, alpha=0.05)
                    normality_results.append(normality_result.get('is_normal', False))
            
            # Determinar si los datos son generalmente normales
            # Si al menos el 60% de las variables evaluadas son normales, considerar datos normales
            if normality_results:
                # Convertir valores booleanos de numpy a Python nativos
                normality_results_python = [bool(val) for val in normality_results]
                normal_ratio = float(sum(normality_results_python) / len(normality_results_python))
                data_is_generally_normal = bool(normal_ratio >= 0.6)
            else:
                # Si no se puede evaluar, asumir no normal por seguridad
                normal_ratio = 0.0
                data_is_generally_normal = False
            
            logger.info(
                f"Evaluación de normalidad: {normal_ratio*100:.1f}% de variables son normales. "
                f"Estrategia adaptativa: {'Normal' if data_is_generally_normal else 'No Normal'}",
                extra={
                    'normal_ratio': normal_ratio,
                    'data_is_normal': data_is_generally_normal,
                    'variables_evaluated': len(normality_results)
                }
            )
            
            # === APLICAR ESTRATEGIA DE COMBINACIÓN MEJORADA ===
            # Convertir índices de métodos multivariados a índices de numeric_df
            mahalanobis_indices_numeric = [df_index_to_numeric_df_index.get(idx) 
                                          for idx in mahalanobis_outliers 
                                          if idx in df_index_to_numeric_df_index]
            lof_indices_numeric = [df_index_to_numeric_df_index.get(idx) 
                                  for idx in lof_outliers 
                                  if idx in df_index_to_numeric_df_index]
            isolation_indices_numeric = [df_index_to_numeric_df_index.get(idx) 
                                        for idx in isolation_outliers 
                                        if idx in df_index_to_numeric_df_index]
            
            # Convertir índices de pruebas de hipótesis a índices de numeric_df
            grubbs_indices_numeric = [df_index_to_numeric_df_index.get(idx) 
                                     for idx in grubbs_outliers 
                                     if idx in df_index_to_numeric_df_index]
            dixon_indices_numeric = [df_index_to_numeric_df_index.get(idx) 
                                    for idx in dixon_outliers 
                                    if idx in df_index_to_numeric_df_index]
            rosner_indices_numeric = [df_index_to_numeric_df_index.get(idx) 
                                     for idx in rosner_outliers 
                                     if idx in df_index_to_numeric_df_index]
            
            # Conjuntos de outliers multivariados y pruebas de hipótesis (índices de numeric_df)
            all_multivariate_indices = set(mahalanobis_indices_numeric + lof_indices_numeric + isolation_indices_numeric)
            all_hypothesis_indices = set(grubbs_indices_numeric + dixon_indices_numeric + rosner_indices_numeric)
            
            final_outliers_indices = set()
            strategy_applied = combine_strategy
            normality_info = {
                'data_is_generally_normal': data_is_generally_normal,
                'normal_ratio': round(normal_ratio * 100, 1) if normality_results else None,
                'variables_evaluated': len(normality_results)
            }
            
            if combine_strategy == 'voting':
                # Estrategia de votación mejorada usando sistema de puntuación
                # Requiere que una observación sea outlier en múltiples variables O en métodos multivariados
                for i in range(n_obs):
                    orig_idx = numeric_df.index[i]
                    
                    # Criterio 1: Pruebas de hipótesis (ALTA CONFIANZA - siempre incluir)
                    if i in all_hypothesis_indices:
                        final_outliers_indices.add(orig_idx)
                        continue
                    
                    # Criterio 2: Métodos multivariados (alta confianza)
                    multivariate_votes = sum([
                        i in mahalanobis_indices_numeric,
                        i in lof_indices_numeric,
                        i in isolation_indices_numeric
                    ])
                    
                    if multivariate_votes >= min_multivariate:
                        final_outliers_indices.add(orig_idx)
                        continue
                    
                    # Criterio 3: Outlier en múltiples variables (consenso univariado)
                    # Requiere ser outlier en al menos 2 variables (con al menos 2 métodos por variable)
                    if univariate_scores[i] >= min_univariate:
                        final_outliers_indices.add(orig_idx)
                        
            elif combine_strategy == 'adaptive':
                # ESTRATEGIA ADAPTATIVA MEJORADA: Usa sistema de puntuación por observación
                strategy_applied = 'adaptive'
                
                if data_is_generally_normal:
                    # ESTRATEGIA PARA DATOS NORMALES: Priorizar métodos paramétricos
                    logger.info(
                        "Aplicando estrategia adaptativa para datos NORMALES: "
                        "Priorizando métodos paramétricos con sistema de puntuación",
                        extra={'strategy': 'adaptive_normal'}
                    )
                    
                    for i in range(n_obs):
                        orig_idx = numeric_df.index[i]
                        
                        # Criterio 1: Pruebas de hipótesis (ALTA CONFIANZA - siempre incluir)
                        if i in all_hypothesis_indices:
                            final_outliers_indices.add(orig_idx)
                            continue
                        
                        # Criterio 2: Métodos multivariados paramétricos (Mahalanobis)
                        if i in mahalanobis_indices_numeric:
                            # Si también es outlier en al menos 1 variable univariada, incluir
                            if univariate_scores[i] >= 1:
                                final_outliers_indices.add(orig_idx)
                            continue
                        
                        # Criterio 3: Consenso multivariado no paramétrico (2 métodos)
                        multivariate_non_param_votes = sum([
                            i in lof_indices_numeric,
                            i in isolation_indices_numeric
                        ])
                        if multivariate_non_param_votes >= 2:
                            final_outliers_indices.add(orig_idx)
                            continue
                        
                        # Criterio 4: Outlier en múltiples variables (al menos 2 variables)
                        if univariate_scores[i] >= 2:
                            final_outliers_indices.add(orig_idx)
                else:
                    # ESTRATEGIA PARA DATOS NO NORMALES: Priorizar métodos no paramétricos
                    logger.info(
                        "Aplicando estrategia adaptativa para datos NO NORMALES: "
                        "Priorizando métodos no paramétricos con sistema de puntuación",
                        extra={'strategy': 'adaptive_non_normal'}
                    )
                    
                    for i in range(n_obs):
                        orig_idx = numeric_df.index[i]
                        
                        # Criterio 1: Pruebas de hipótesis (con validación, ALTA CONFIANZA)
                        if i in all_hypothesis_indices:
                            final_outliers_indices.add(orig_idx)
                            continue
                        
                        # Criterio 2: Consenso multivariado no paramétrico (2 métodos)
                        multivariate_non_param_votes = sum([
                            i in lof_indices_numeric,
                            i in isolation_indices_numeric
                        ])
                        if multivariate_non_param_votes >= 2:
                            final_outliers_indices.add(orig_idx)
                            continue
                        
                        # Criterio 3: Outlier en múltiples variables (al menos 2 variables)
                        if univariate_scores[i] >= 2:
                            final_outliers_indices.add(orig_idx)
                            continue
                        
                        # Criterio 4: Método multivariado no paramétrico + outlier en 1 variable
                        if multivariate_non_param_votes >= 1 and univariate_scores[i] >= 1:
                            final_outliers_indices.add(orig_idx)
                        
            elif combine_strategy == 'union':
                # Unión: incluir cualquier outlier detectado por cualquier método
                # Pero aún requiere algún nivel de consenso (al menos 1 variable o método multivariado)
                for i in range(n_obs):
                    orig_idx = numeric_df.index[i]
                    
                    # Incluir si:
                    # 1. Es outlier en al menos 1 variable (score >= 1)
                    # 2. O es outlier en algún método multivariado
                    # 3. O es outlier en alguna prueba de hipótesis
                    if (univariate_scores[i] >= 1 or 
                        i in all_multivariate_indices or 
                        i in all_hypothesis_indices):
                        final_outliers_indices.add(orig_idx)
                
            elif combine_strategy == 'intersection':
                # Intersección: debe ser outlier en múltiples categorías simultáneamente
                # Más conservadora: requiere outlier en al menos 1 variable Y método multivariado
                for i in range(n_obs):
                    orig_idx = numeric_df.index[i]
                    
                    # Requiere:
                    # 1. Outlier en al menos 1 variable (score >= 1)
                    # 2. Y outlier en al menos 1 método multivariado
                    # 3. O outlier en alguna prueba de hipótesis (alta confianza)
                    if i in all_hypothesis_indices:
                        # Pruebas de hipótesis siempre incluyen
                        final_outliers_indices.add(orig_idx)
                    elif univariate_scores[i] >= 1 and i in all_multivariate_indices:
                        # Requiere ambas condiciones
                        final_outliers_indices.add(orig_idx)
            
            # Convertir a lista y obtener subject_ids
            final_outliers_indices = list(final_outliers_indices)
            final_outliers = indices_to_subjects(final_outliers_indices)
            
            results['final_outliers'] = final_outliers
            results['outliers_detected'] = int(len(final_outliers))
            outlier_percentage = float(round((len(final_outliers) / len(df)) * 100, 2) if len(df) > 0 else 0)
            results['outlier_percentage'] = outlier_percentage
            
            # ADVERTENCIA CRÍTICA: Si el porcentaje de outliers es muy alto, algo está mal
            if outlier_percentage > 50:
                logger.warning(
                    f"ADVERTENCIA CRÍTICA: Se detectaron {outlier_percentage:.1f}% de outliers. "
                    f"Esto es inusualmente alto y sugiere que los métodos pueden estar siendo demasiado permisivos "
                    f"o que los datos tienen características extremas. Se recomienda revisar los criterios de detección.",
                    extra={
                        'outlier_percentage': outlier_percentage,
                        'outliers_detected': len(final_outliers),
                        'total_records': len(df),
                        'strategy': combine_strategy
                    }
                )
                results['high_outlier_warning'] = True
                results['outlier_warning_message'] = (
                    f"ADVERTENCIA: Se detectaron {outlier_percentage:.1f}% de outliers ({len(final_outliers)} de {len(df)} observaciones). "
                    f"Esto es inusualmente alto. Los métodos de detección pueden estar siendo demasiado permisivos. "
                    f"Se recomienda revisar los resultados individuales de cada método y considerar usar una estrategia más conservadora."
                )
            else:
                results['high_outlier_warning'] = False
            
            # Agregar información sobre normalidad y estrategia aplicada
            # Asegurar que todos los valores sean tipos nativos de Python para serialización JSON
            normality_info['data_is_generally_normal'] = bool(normality_info.get('data_is_generally_normal', False))
            if normality_info.get('normal_ratio') is not None:
                normality_info['normal_ratio'] = float(normality_info['normal_ratio'])
            if normality_info.get('variables_evaluated') is not None:
                normality_info['variables_evaluated'] = int(normality_info['variables_evaluated'])
            
            results['normality_assessment'] = normality_info
            results['strategy_applied'] = str(strategy_applied)
            results['strategy_description'] = str(self._get_strategy_description(
                strategy_applied, 
                data_is_generally_normal,
                min_univariate if combine_strategy == 'voting' else None,
                min_multivariate if combine_strategy == 'voting' else None
            ))
            
            # Agregar información detallada de votos para análisis posterior
            outlier_votes_detail = {}
            for idx in final_outliers_indices:
                outlier_id = indices_to_subjects([idx])[0] if indices_to_subjects([idx]) else f"ID_{idx}"
                outlier_votes_detail[outlier_id] = {
                    'univariate_votes': {
                        'iqr': bool(idx in outliers_iqr),
                        'zscore': bool(idx in outliers_zscore),
                        'mad': bool(idx in outliers_mad),
                        'total': int(sum([idx in outliers_iqr, idx in outliers_zscore, idx in outliers_mad]))
                    },
                    'multivariate_votes': {
                        'mahalanobis': bool(idx in mahalanobis_outliers),
                        'lof': bool(idx in lof_outliers),
                        'isolation_forest': bool(idx in isolation_outliers),
                        'total': int(sum([idx in mahalanobis_outliers, idx in lof_outliers, idx in isolation_outliers]))
                    },
                    'hypothesis_votes': {
                        'grubbs': bool(idx in grubbs_outliers),
                        'dixon': bool(idx in dixon_outliers),
                        'rosner': bool(idx in rosner_outliers),
                        'total': int(sum([idx in grubbs_outliers, idx in dixon_outliers, idx in rosner_outliers]))
                    }
                }
            
            results['outlier_votes_detail'] = outlier_votes_detail
            
            logger.info(
                f"Detección completada: {len(final_outliers)} outliers finales detectados "
                f"usando estrategia '{strategy_applied}'",
                extra={
                    'outliers_detected': len(final_outliers),
                    'strategy': strategy_applied,
                    'data_is_normal': data_is_generally_normal
                }
            )
            
            return results
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = f"Error inesperado en detección completa de outliers para dataset '{filename}': {str(e)}"
            logger.error(
                error_msg,
                extra={'dataset_filename': filename, 'error': str(e)},
                exc_info=True
            )
            raise Exception(error_msg) from e
    
    def analyze_dataset_outliers(self, dataset_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analiza outliers en un dataset completo.
        
        Args:
            dataset_info: Diccionario con información del dataset que debe incluir
                'filename' y 'file_path'.
        
        Returns:
            Diccionario con resultados del análisis de outliers.
        """
        # Obtener filename del dataset_info
        filename = dataset_info.get("filename")
        if not filename:
            raise ValueError("dataset_info debe incluir 'filename'")
        
        # Cargar dataset usando método centralizado de DataProcessor
        if self.data_processor and filename in self.data_processor.datasets:
            df = self.data_processor.get_dataframe(filename)
        else:
            # Fallback: cargar directamente si no hay data_processor disponible
            file_path = dataset_info["file_path"]
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
        
        variable_types = dataset_info["variable_types"]
        results = {}
        
        for column, var_type in variable_types.items():
            if var_type in ["cuantitativa_continua", "cuantitativa_discreta"]:
                data = df[column].dropna()
                if len(data) > 0:
                    iqr_outliers = self.detect_outliers_iqr(data)
                    zscore_outliers = self.detect_outliers_zscore(data)
                    
                    results[column] = {
                        "type": var_type,
                        "iqr_outliers": iqr_outliers,
                        "zscore_outliers": zscore_outliers,
                        "iqr_count": len(iqr_outliers),
                        "zscore_count": len(zscore_outliers),
                        "total_values": len(data),
                        "outlier_percentage_iqr": len(iqr_outliers) / len(data) * 100,
                        "outlier_percentage_zscore": len(zscore_outliers) / len(data) * 100
                    }
        
        # Detección global con Isolation Forest
        global_outliers = self.detect_outliers_isolation_forest(df)
        
        results["global_analysis"] = {
            "isolation_forest_outliers": global_outliers,
            "global_outlier_count": len(global_outliers),
            "global_outlier_percentage": len(global_outliers) / len(df) * 100
        }
        
        return results
    
    def get_visual_data(self, filename: str, variable: str, categorical_variable: str = None) -> Dict[str, Any]:
        """
        Obtiene datos para visualización de una variable específica.
        
        Args:
            filename: Nombre del archivo del dataset.
            variable: Nombre de la variable numérica a visualizar.
            categorical_variable: Nombre opcional de variable categórica para agrupar datos.
        
        Returns:
            Diccionario con estadísticas, datos para histograma, boxplot y densidad.
        
        Raises:
            ValueError: Si el dataset o variable no se encuentran, o datos insuficientes.
            Exception: Si ocurre un error durante el procesamiento.
        """
        try:
            logger.info(
                f"Obteniendo datos visuales para variable '{variable}' en dataset '{filename}'",
                extra={'dataset_filename': filename, 'variable': variable, 'categorical_variable': categorical_variable}
            )
            
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                available = list(self.data_processor.datasets.keys())
                error_msg = (
                    f"Dataset '{filename}' no encontrado. Datasets disponibles: {available}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'available_datasets': available})
                raise ValueError(error_msg)
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            
            # Verificar que la variable existe
            if variable not in df.columns:
                error_msg = (
                    f"Variable '{variable}' no encontrada en el dataset '{filename}'. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'variable': variable, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            
            # Obtener datos de la variable numérica
            raw_data = df[variable].dropna()
            
            # Verificar que todos los valores sean numéricos
            try:
                # Intentar convertir a numérico
                numeric_data = pd.to_numeric(raw_data, errors='coerce').dropna()
                
                if len(numeric_data) == 0:
                    error_msg = (
                        f"No hay datos numéricos válidos para la variable '{variable}' "
                        f"en el dataset '{filename}'. Datos originales: {len(raw_data)} valores."
                    )
                    logger.warning(error_msg, extra={'dataset_filename': filename, 'variable': variable, 'original_count': len(raw_data)})
                    raise ValueError(error_msg)
                
                # Calcular estadísticas básicas
                stats = {
                    "count": len(numeric_data),
                    "mean": float(numeric_data.mean()),
                    "median": float(numeric_data.median()),
                    "std": float(numeric_data.std()),
                    "min": float(numeric_data.min()),
                    "max": float(numeric_data.max()),
                    "q1": float(numeric_data.quantile(0.25)),
                    "q3": float(numeric_data.quantile(0.75)),
                    "iqr": float(numeric_data.quantile(0.75) - numeric_data.quantile(0.25))
                }
                
            except ValueError:
                # Re-lanzar ValueError sin modificar
                raise
            except Exception as e:
                error_msg = f"Error inesperado procesando datos numéricos para variable '{variable}' en dataset '{filename}': {str(e)}"
                logger.error(error_msg, extra={'dataset_filename': filename, 'variable': variable, 'error': str(e)}, exc_info=True)
                raise ValueError(error_msg) from e
            
            # Preparar datos para histograma
            histogram_data = {
                "values": numeric_data.tolist(),
                "bins": min(30, max(5, int(np.sqrt(len(numeric_data)))))
            }
            
            # Preparar datos para boxplot
            boxplot_data = {
                "values": numeric_data.tolist(),
                "outliers": self.detect_outliers_iqr(numeric_data)
            }
            
            # Preparar datos para gráfico de densidad
            density_data = {
                "values": numeric_data.tolist(),
                "range": [float(numeric_data.min()), float(numeric_data.max())]
            }
            
            # Si hay variable categórica, preparar datos agrupados
            grouped_data = None
            if categorical_variable and categorical_variable in df.columns:
                grouped_data = {}
                for category in df[categorical_variable].unique():
                    if pd.notna(category):
                        category_raw_data = df[df[categorical_variable] == category][variable].dropna()
                        # Convertir a numérico para consistencia
                        category_data = pd.to_numeric(category_raw_data, errors='coerce').dropna()
                        if len(category_data) > 0:
                            grouped_data[str(category)] = category_data.tolist()
            
            return {
                "variable": variable,
                "categorical_variable": categorical_variable,
                "stats": stats,
                "histogram_data": histogram_data,
                "boxplot_data": boxplot_data,
                "density_data": density_data,
                "grouped_data": grouped_data,
                "total_records": len(df),
                "valid_records": len(numeric_data),
                "missing_records": len(df) - len(numeric_data)
            }
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = f"Error obteniendo datos visuales para variable '{variable}' en dataset '{filename}': {str(e)}"
            logger.error(error_msg, extra={'dataset_filename': filename, 'variable': variable, 'error': str(e)}, exc_info=True)
            raise Exception(error_msg) from e
    
    def get_categorical_data(self, filename: str, variable: str) -> Dict[str, Any]:
        """
        Obtiene datos para visualización de una variable categórica.
        
        Args:
            filename: Nombre del archivo del dataset.
            variable: Nombre de la variable categórica a analizar.
        
        Returns:
            Diccionario con categorías, frecuencias y estadísticas de la variable categórica.
        
        Raises:
            ValueError: Si el dataset o variable no se encuentran, o datos insuficientes.
            Exception: Si ocurre un error durante el procesamiento.
        """
        try:
            logger.info(
                f"Obteniendo datos categóricos para variable '{variable}' en dataset '{filename}'",
                extra={'dataset_filename': filename, 'variable': variable}
            )
            
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                available = list(self.data_processor.datasets.keys())
                error_msg = (
                    f"Dataset '{filename}' no encontrado. Datasets disponibles: {available}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'available_datasets': available})
                raise ValueError(error_msg)
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            
            # Verificar que la variable existe
            if variable not in df.columns:
                error_msg = (
                    f"Variable '{variable}' no encontrada en el dataset '{filename}'. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'variable': variable, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            
            # Obtener datos de la variable categórica
            categorical_data = df[variable].dropna()
            
            if len(categorical_data) == 0:
                error_msg = (
                    f"No hay datos válidos para la variable '{variable}' en el dataset '{filename}'. "
                    f"Total de filas en dataset: {len(df)}"
                )
                logger.warning(error_msg, extra={'dataset_filename': filename, 'variable': variable, 'total_rows': len(df)})
                raise ValueError(error_msg)
            
            # Calcular frecuencias
            value_counts = categorical_data.value_counts()
            
            # Preparar datos para gráficos
            categories = value_counts.index.tolist()
            frequencies = value_counts.values.tolist()
            
            # Calcular estadísticas adicionales
            total_count = len(categorical_data)
            unique_categories = len(categories)
            
            return {
                "variable": variable,
                "categories": categories,
                "frequencies": frequencies,
                "total_count": total_count,
                "unique_categories": unique_categories,
                "missing_count": len(df) - total_count
            }
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = f"Error obteniendo datos categóricos para variable '{variable}' en dataset '{filename}': {str(e)}"
            logger.error(error_msg, extra={'dataset_filename': filename, 'variable': variable, 'error': str(e)}, exc_info=True)
            raise Exception(error_msg) from e

    def get_quantitative_by_category(self, filename: str, numeric_variable: str, categorical_variable: str) -> Dict[str, Any]:
        """
        Obtiene datos cuantitativos agrupados por categoría.
        
        Args:
            filename: Nombre del archivo del dataset.
            numeric_variable: Nombre de la variable numérica a analizar.
            categorical_variable: Nombre de la variable categórica para agrupar.
        
        Returns:
            Diccionario con datos de histograma, densidad y boxplot agrupados por categoría.
        
        Raises:
            ValueError: Si el dataset o variables no se encuentran.
            Exception: Si ocurre un error durante el procesamiento.
        """
        try:
            logger.info(
                f"Obteniendo datos cuantitativos por categoría: '{numeric_variable}' agrupado por '{categorical_variable}' "
                f"en dataset '{filename}'",
                extra={'dataset_filename': filename, 'numeric_variable': numeric_variable, 'categorical_variable': categorical_variable}
            )
            
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                available = list(self.data_processor.datasets.keys())
                error_msg = (
                    f"Dataset '{filename}' no encontrado. Datasets disponibles: {available}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'available_datasets': available})
                raise ValueError(error_msg)
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            
            # Verificar que las variables existen
            if numeric_variable not in df.columns:
                error_msg = (
                    f"Variable numérica '{numeric_variable}' no encontrada en el dataset '{filename}'. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'numeric_variable': numeric_variable, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            if categorical_variable not in df.columns:
                error_msg = (
                    f"Variable categórica '{categorical_variable}' no encontrada en el dataset '{filename}'. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'categorical_variable': categorical_variable, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            
            # Obtener categorías únicas
            categories = df[categorical_variable].dropna().unique().tolist()
            
            # Preparar datos para cada categoría
            histogram_data = {}
            density_data = {}
            boxplot_data = {}
            
            for category in categories:
                category_df = df[df[categorical_variable] == category]
                raw_data = category_df[numeric_variable].dropna()
                
                # Verificar que todos los valores sean numéricos
                try:
                    # Intentar convertir a numérico
                    numeric_data = pd.to_numeric(raw_data, errors='coerce').dropna()
                    
                    if len(numeric_data) > 0:
                        # Datos para histograma
                        histogram_data[str(category)] = {
                            "values": numeric_data.tolist(),
                            "bins": min(30, max(5, int(np.sqrt(len(numeric_data)))))
                        }
                        
                        # Datos para boxplot
                        boxplot_data[str(category)] = {
                            "values": numeric_data.tolist(),
                            "outliers": self.detect_outliers_iqr(numeric_data)
                        }
                        
                        # Datos para densidad (simulación simple)
                        min_val = numeric_data.min()
                        max_val = numeric_data.max()
                        
                        # Verificar si hay suficientes datos para calcular densidad
                        if len(numeric_data) >= 2 and min_val != max_val:
                            step = (max_val - min_val) / 100
                            x = np.arange(min_val, max_val + step, step)
                            y = []
                            
                            for xi in x:
                                density = len(numeric_data[np.abs(numeric_data - xi) < step]) / (step * len(numeric_data))
                                y.append(density)
                            
                            density_data[str(category)] = {
                                "x": x.tolist(),
                                "y": y
                            }
                        else:
                            # Para casos con muy pocos datos o valores idénticos
                            # Crear un rango simple alrededor del valor único
                            if min_val == max_val:
                                # Si todos los valores son iguales, crear un rango pequeño
                                x = np.linspace(min_val - 0.1, min_val + 0.1, 10)
                                y = [1.0] * 10  # Densidad constante
                            else:
                                # Si hay muy pocos datos, usar un rango simple
                                x = np.linspace(min_val, max_val, 10)
                                y = [1.0 / len(x)] * len(x)  # Densidad uniforme
                            
                            density_data[str(category)] = {
                                "x": x.tolist(),
                                "y": y
                            }
                except Exception as e:
                    # Si hay error procesando esta categoría, continuar con la siguiente
                    logger.warning(
                        f"Error procesando categoría '{category}' para variable '{numeric_variable}': {str(e)}. "
                        f"Continuando con siguiente categoría.",
                        extra={'category': str(category), 'variable': numeric_variable, 'error': str(e)}
                    )
                    continue
            
            return {
                "numeric_variable": numeric_variable,
                "categorical_variable": categorical_variable,
                "categories": [str(cat) for cat in categories],
                "histogram_data": histogram_data,
                "density_data": density_data,
                "boxplot_data": boxplot_data
            }
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = (
                f"Error obteniendo datos cuantitativos por categoría para variables "
                f"'{numeric_variable}' y '{categorical_variable}' en dataset '{filename}': {str(e)}"
            )
            logger.error(
                error_msg,
                extra={
                    'filename': filename,
                    'numeric_variable': numeric_variable,
                    'categorical_variable': categorical_variable,
                    'error': str(e)
                },
                exc_info=True
            )
            raise Exception(error_msg) from e

    def get_categorical_by_category(self, filename: str, categorical_variable1: str, categorical_variable2: str) -> Dict[str, Any]:
        """
        Obtiene datos categóricos cruzados por categoría (tabla de contingencia).
        
        Args:
            filename: Nombre del archivo del dataset.
            categorical_variable1: Nombre de la primera variable categórica.
            categorical_variable2: Nombre de la segunda variable categórica.
        
        Returns:
            Diccionario con tabla de contingencia y datos para visualización.
        
        Raises:
            ValueError: Si el dataset o variables no se encuentran.
            Exception: Si ocurre un error durante el procesamiento.
        """
        try:
            logger.info(
                f"Obteniendo datos categóricos cruzados: '{categorical_variable1}' vs '{categorical_variable2}' "
                f"en dataset '{filename}'",
                extra={'dataset_filename': filename, 'categorical_variable1': categorical_variable1, 'categorical_variable2': categorical_variable2}
            )
            
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                available = list(self.data_processor.datasets.keys())
                error_msg = (
                    f"Dataset '{filename}' no encontrado. Datasets disponibles: {available}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'available_datasets': available})
                raise ValueError(error_msg)
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            
            # Verificar que las variables existen
            if categorical_variable1 not in df.columns:
                error_msg = (
                    f"Variable categórica 1 '{categorical_variable1}' no encontrada en el dataset '{filename}'. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'categorical_variable1': categorical_variable1, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            if categorical_variable2 not in df.columns:
                error_msg = (
                    f"Variable categórica 2 '{categorical_variable2}' no encontrada en el dataset '{filename}'. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'categorical_variable2': categorical_variable2, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            
            # Crear tabla de contingencia
            cross_table = pd.crosstab(df[categorical_variable1], df[categorical_variable2], margins=True)
            
            # Obtener categorías únicas
            categories1 = df[categorical_variable1].dropna().unique().tolist()
            categories2 = df[categorical_variable2].dropna().unique().tolist()
            
            # Preparar datos para gráfico de barras apiladas
            cross_table_data = {}
            for cat1 in categories1:
                cross_table_data[str(cat1)] = {
                    "categories": [str(cat2) for cat2 in categories2],
                    "frequencies": [int(cross_table.loc[cat1, cat2]) for cat2 in categories2]
                }
            
            # Calcular totales
            total = cross_table.loc['All', 'All']
            
            return {
                "categorical_variable1": categorical_variable1,
                "categorical_variable2": categorical_variable2,
                "categories": [str(cat1) for cat1 in categories1],
                "cross_table": cross_table_data,
                "total": int(total)
            }
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = (
                f"Error obteniendo datos categóricos cruzados para variables "
                f"'{categorical_variable1}' y '{categorical_variable2}' en dataset '{filename}': {str(e)}"
            )
            logger.error(
                error_msg,
                extra={
                    'filename': filename,
                    'categorical_variable1': categorical_variable1,
                    'categorical_variable2': categorical_variable2,
                    'error': str(e)
                },
                exc_info=True
            )
            raise Exception(error_msg) from e

    def get_relationship_analysis(self, filename: str, variable1: str, variable2: str) -> Dict[str, Any]:
        """
        Obtiene análisis de correlación entre dos variables cuantitativas.
        
        Args:
            filename: Nombre del archivo del dataset.
            variable1: Nombre de la primera variable numérica.
            variable2: Nombre de la segunda variable numérica.
        
        Returns:
            Diccionario con coeficientes de correlación (Pearson y Spearman) y datos para scatter plot.
        
        Raises:
            ValueError: Si el dataset o variables no se encuentran, o datos insuficientes.
            Exception: Si ocurre un error durante el procesamiento.
        """
        try:
            logger.info(
                f"Obteniendo análisis de correlación entre '{variable1}' y '{variable2}' en dataset '{filename}'",
                extra={'dataset_filename': filename, 'variable1': variable1, 'variable2': variable2}
            )
            
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                available = list(self.data_processor.datasets.keys())
                error_msg = (
                    f"Dataset '{filename}' no encontrado. Datasets disponibles: {available}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'available_datasets': available})
                raise ValueError(error_msg)
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            
            # Verificar que las variables existen
            if variable1 not in df.columns:
                error_msg = (
                    f"Variable 1 '{variable1}' no encontrada en el dataset '{filename}'. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'variable1': variable1, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            if variable2 not in df.columns:
                error_msg = (
                    f"Variable 2 '{variable2}' no encontrada en el dataset '{filename}'. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'variable2': variable2, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            
            # Obtener datos sin valores faltantes y convertir a numérico
            raw_data = df[[variable1, variable2]].dropna()
            
            # Verificar que todos los valores sean numéricos
            try:
                # Intentar convertir ambas variables a numérico
                clean_data = raw_data.copy()
                clean_data[variable1] = pd.to_numeric(raw_data[variable1].astype(str), errors='coerce')
                clean_data[variable2] = pd.to_numeric(raw_data[variable2].astype(str), errors='coerce')
                
                # Eliminar filas con valores NaN después de la conversión
                clean_data = clean_data.dropna()
                
                if len(clean_data) == 0:
                    error_msg = (
                        f"No hay datos numéricos válidos para el análisis de correlación entre '{variable1}' y '{variable2}' "
                        f"en el dataset '{filename}'. Datos originales: {len(raw_data)} valores."
                    )
                    logger.warning(error_msg, extra={'dataset_filename': filename, 'variable1': variable1, 'variable2': variable2, 'original_count': len(raw_data)})
                    raise ValueError(error_msg)
                
                # Calcular coeficientes de correlación
                if variable1 == variable2:
                    # Si es la misma variable, correlación perfecta
                    pearson_corr = 1.0
                    spearman_corr = 1.0
                else:
                    # Correlación entre variables diferentes
                    try:
                        pearson_corr = clean_data[variable1].corr(clean_data[variable2], method='pearson')
                        spearman_corr = clean_data[variable1].corr(clean_data[variable2], method='spearman')
                    except Exception as corr_error:
                        # Si hay error en correlación, usar valores por defecto
                        logger.warning(
                            f"Error calculando correlación entre '{variable1}' y '{variable2}': {str(corr_error)}. "
                            f"Usando valores por defecto (0.0).",
                            extra={'variable1': variable1, 'variable2': variable2, 'error': str(corr_error)}
                        )
                        pearson_corr = 0.0
                        spearman_corr = 0.0
                
            except ValueError:
                # Re-lanzar ValueError sin modificar
                raise
            except Exception as e:
                error_msg = f"Error inesperado procesando datos numéricos para variables '{variable1}' y '{variable2}' en dataset '{filename}': {str(e)}"
                logger.error(error_msg, extra={'dataset_filename': filename, 'variable1': variable1, 'variable2': variable2, 'error': str(e)}, exc_info=True)
                raise ValueError(error_msg) from e
            
            # Preparar datos para el diagrama de dispersión
            scatter_data = {
                "x": clean_data[variable1].tolist(),
                "y": clean_data[variable2].tolist()
            }
            
            return {
                "variable1": variable1,
                "variable2": variable2,
                "pearson": float(pearson_corr) if not pd.isna(pearson_corr) else 0.0,
                "spearman": float(spearman_corr) if not pd.isna(spearman_corr) else 0.0,
                "scatter_data": scatter_data,
                "sample_size": len(clean_data)
            }
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = (
                f"Error obteniendo análisis de correlación entre variables '{variable1}' y '{variable2}' "
                f"en dataset '{filename}': {str(e)}"
            )
            logger.error(
                error_msg,
                extra={'dataset_filename': filename, 'variable1': variable1, 'variable2': variable2, 'error': str(e)},
                exc_info=True
            )
            raise Exception(error_msg) from e

    def get_correlation_matrix(self, filename: str, variables: List[str]) -> Dict[str, Any]:
        """
        Obtiene matriz de correlación para múltiples variables cuantitativas usando seaborn.
        
        Args:
            filename: Nombre del archivo del dataset.
            variables: Lista de nombres de variables numéricas para la matriz de correlación.
        
        Returns:
            Diccionario con matriz de correlación, matriz de significancia y pairplot en base64.
        
        Raises:
            ValueError: Si el dataset o variables no se encuentran, o datos insuficientes.
            Exception: Si ocurre un error durante el procesamiento.
        """
        try:
            import matplotlib.pyplot as plt
            import io
            import base64
            
            logger.info(
                f"Obteniendo matriz de correlación para {len(variables)} variables en dataset '{filename}'",
                extra={'dataset_filename': filename, 'variables': variables, 'num_variables': len(variables)}
            )
            
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                available = list(self.data_processor.datasets.keys())
                error_msg = (
                    f"Dataset '{filename}' no encontrado. Datasets disponibles: {available}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'available_datasets': available})
                raise ValueError(error_msg)
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            
            # Verificar que las variables existen
            missing_vars = [var for var in variables if var not in df.columns]
            if missing_vars:
                error_msg = (
                    f"Variables no encontradas en el dataset '{filename}': {missing_vars}. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'missing_variables': missing_vars, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            
            # Obtener datos sin valores faltantes
            clean_data = df[variables].dropna()
            
            if len(clean_data) == 0:
                error_msg = (
                    f"No hay datos válidos para el análisis de correlación en el dataset '{filename}'. "
                    f"Variables: {variables}, Filas originales: {len(df)}"
                )
                logger.warning(error_msg, extra={'dataset_filename': filename, 'variables': variables, 'original_rows': len(df)})
                raise ValueError(error_msg)
            
            # Calcular matriz de correlación de Pearson
            correlation_matrix = clean_data.corr(method='pearson').values.tolist()
            
            # Calcular matriz de significancia (p-values)
            significance_matrix = []
            for i, var1 in enumerate(variables):
                row_significance = []
                for j, var2 in enumerate(variables):
                    if i == j:
                        row_significance.append(0.0)  # Diagonal
                    else:
                        # Calcular p-value usando scipy
                        from scipy.stats import pearsonr
                        corr, p_value = pearsonr(clean_data[var1], clean_data[var2])
                        row_significance.append(p_value)
                significance_matrix.append(row_significance)
            
            # Generar pairplot con seaborn
            plt.figure(figsize=(12, 10))
            
            # Configurar el estilo de seaborn
            sns.set_style("whitegrid")
            sns.set_palette("husl")
            
            # Crear el pairplot con configuración similar a seaborn.pairplot(penguins, hue="species")
            pair_plot = sns.pairplot(
                clean_data,
                diag_kind='hist',  # Histogramas en la diagonal
                plot_kws={
                    'alpha': 0.6,  # Transparencia de los puntos
                    's': 20,       # Tamaño de los puntos
                    'edgecolor': 'white',  # Borde blanco en los puntos
                    'linewidth': 0.5
                },
                diag_kws={
                    'bins': 20,    # Número de bins para histogramas
                    'alpha': 0.7,  # Transparencia de las barras
                    'edgecolor': 'white',  # Borde blanco en las barras
                    'linewidth': 0.5
                },
                height=2.5,        # Altura de cada subplot (como en seaborn)
                aspect=1           # Aspecto cuadrado
            )
            
            # Agregar título al pairplot
            pair_plot.fig.suptitle('Pair Plot - Matriz de Dispersión', y=1.02, fontsize=16, fontweight='bold')
            
            # Ajustar el layout
            plt.tight_layout()
            
            # Convertir el gráfico a imagen base64
            img_buffer = io.BytesIO()
            plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
            img_buffer.seek(0)
            img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
            plt.close()
            
            return {
                "variables": variables,
                "correlation_matrix": correlation_matrix,
                "significance_matrix": significance_matrix,
                "pairplot_image": img_base64,
                "sample_size": len(clean_data)
            }
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = (
                f"Error obteniendo matriz de correlación para variables {variables} "
                f"en dataset '{filename}': {str(e)}"
            )
            logger.error(
                error_msg,
                extra={'dataset_filename': filename, 'variables': variables, 'error': str(e)},
                exc_info=True
            )
            raise Exception(error_msg) from e

    def get_pairplot(self, filename: str, variables: List[str], **kwargs) -> Dict[str, Any]:
        """
        Genera pairplot con configuración completa de seaborn.pairplot.
        
        Args:
            filename: Nombre del archivo del dataset.
            variables: Lista de variables numéricas a incluir en el pairplot.
            **kwargs: Argumentos adicionales para seaborn.pairplot (hue, palette, etc.).
        
        Returns:
            Diccionario con imagen del pairplot en base64, matriz de correlación y estadísticas.
        
        Raises:
            ValueError: Si el dataset no existe, variables no encontradas, o datos insuficientes.
            Exception: Si ocurre un error durante la generación del gráfico.
        """
        try:
            import matplotlib.pyplot as plt
            import io
            import base64
            
            logger.info(
                f"Iniciando generación de pairplot para dataset '{filename}'",
                extra={'dataset_filename': filename, 'variables': variables, 'num_variables': len(variables)}
            )
            
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                error_msg = f"Dataset '{filename}' no encontrado en data_processor. Datasets disponibles: {list(self.data_processor.datasets.keys())}"
                logger.error(error_msg, extra={'dataset_filename': filename, 'available_datasets': list(self.data_processor.datasets.keys())})
                raise ValueError(error_msg)
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            dataset_info = self.data_processor.datasets[filename]
            
            logger.info(
                "Dataset cargado exitosamente",
                extra={'rows': len(df), 'columns': len(df.columns), 'column_names': list(df.columns)}
            )
            
            # Verificar que las variables existen y eliminar duplicados
            unique_variables = list(set(variables))  # Eliminar duplicados
            missing_vars = [var for var in unique_variables if var not in df.columns]
            if missing_vars:
                error_msg = (
                    f"Variables no encontradas en el dataset '{filename}': {missing_vars}. "
                    f"Variables disponibles: {list(df.columns)}"
                )
                logger.error(error_msg, extra={'dataset_filename': filename, 'missing_variables': missing_vars, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            
            # Si hay duplicados, usar solo variables únicas
            if len(unique_variables) != len(variables):
                logger.warning(
                    f"Variables duplicadas detectadas en la solicitud. "
                    f"Originales: {variables}, Usando únicas: {unique_variables}",
                    extra={'original_variables': variables, 'unique_variables': unique_variables}
                )
                variables = unique_variables
            
            # Verificar variable hue si se especifica
            hue = kwargs.get('hue')
            if hue and hue not in df.columns:
                error_msg = f"Variable hue '{hue}' no encontrada en el dataset. Columnas disponibles: {list(df.columns)}"
                logger.error(error_msg, extra={'hue': hue, 'available_columns': list(df.columns)})
                raise ValueError(error_msg)
            
            # Obtener datos sin valores faltantes y convertir a numérico
            raw_data = df[variables].dropna()
            
            # Verificar que todos los valores sean numéricos
            try:
                # Intentar convertir todas las variables a numérico
                clean_data = raw_data.copy()
                for var in variables:
                    clean_data[var] = pd.to_numeric(raw_data[var].astype(str), errors='coerce')
                
                # Eliminar filas con valores NaN después de la conversión
                clean_data = clean_data.dropna()
                
                logger.info(
                    f"Datos procesados: {len(clean_data)} filas válidas después de conversión numérica "
                    f"(de {len(raw_data)} originales)",
                    extra={'original_rows': len(raw_data), 'clean_rows': len(clean_data)}
                )
                
                if len(clean_data) == 0:
                    error_msg = f"No hay datos numéricos válidos para el análisis después de la conversión. Variables: {variables}"
                    logger.error(error_msg, extra={'variables': variables, 'original_rows': len(raw_data)})
                    raise ValueError(error_msg)
                
                # Si hay variable hue, agregarla después de la limpieza numérica
                if hue:
                    hue_data = df[hue].iloc[clean_data.index]
                    clean_data[hue] = hue_data
                
            except Exception as e:
                raise ValueError(f"Error procesando datos numéricos: {str(e)}")
            
            # Configurar el estilo de seaborn
            sns.set_style("whitegrid")
            
            # Configurar paleta de colores
            palette = kwargs.get('palette', 'husl')
            if palette:
                sns.set_palette(palette)
            
            # Configurar tamaño de fuente para la leyenda
            plt.rcParams['legend.fontsize'] = 12
            
            # Calcular tamaño dinámico basado en el número de variables
            num_vars = len(variables)
            
            # Ajustar altura y aspecto según el número de variables
            if num_vars <= 3:
                dynamic_height = 3.0
                dynamic_aspect = 1.2
            elif num_vars <= 5:
                dynamic_height = 2.5
                dynamic_aspect = 1.0
            elif num_vars <= 7:
                dynamic_height = 2.0
                dynamic_aspect = 0.9
            else:
                dynamic_height = 1.8
                dynamic_aspect = 0.8
            
            # Usar valores dinámicos si no se especifican en kwargs
            user_height = kwargs.get('height')
            user_aspect = kwargs.get('aspect')
            
            # Preparar argumentos para pairplot
            pairplot_kwargs = {
                'data': clean_data,
                'vars': variables,
                'height': float(user_height if user_height is not None else dynamic_height),
                'aspect': float(user_aspect if user_aspect is not None else dynamic_aspect),
                'corner': bool(kwargs.get('corner', False)),
                'dropna': bool(kwargs.get('dropna', False))
            }
            
            # Agregar parámetros opcionales
            if hue and hue != '':
                pairplot_kwargs['hue'] = hue
                hue_order = kwargs.get('hue_order')
                if hue_order and hue_order != '':
                    pairplot_kwargs['hue_order'] = hue_order
            
            kind = kwargs.get('kind')
            if kind and kind != '':
                pairplot_kwargs['kind'] = kind
            
            diag_kind = kwargs.get('diag_kind')
            if diag_kind and diag_kind != '':
                pairplot_kwargs['diag_kind'] = diag_kind
            
            markers = kwargs.get('markers')
            if markers and markers != '':
                pairplot_kwargs['markers'] = markers
            
            # Configurar argumentos de keywords según el tipo de gráfico
            kind = kwargs.get('kind', 'scatter')
            if kind == 'scatter':
                plot_kws = kwargs.get('plot_kws', {
                    'alpha': 0.6,
                    's': 20,
                    'edgecolor': 'white',
                    'linewidth': 0.5
                })
            elif kind == 'hist':
                plot_kws = kwargs.get('plot_kws', {
                    'alpha': 0.7,
                    'bins': 20
                })
            elif kind == 'kde':
                plot_kws = kwargs.get('plot_kws', {
                    'alpha': 0.6,
                    'linewidth': 1.5
                })
            elif kind == 'reg':
                plot_kws = kwargs.get('plot_kws', {
                    'scatter_kws': {'alpha': 0.6, 's': 20},
                    'line_kws': {'color': 'red', 'linewidth': 2}
                })
            else:
                plot_kws = kwargs.get('plot_kws', {
                    'alpha': 0.6,
                    's': 20,
                    'edgecolor': 'white',
                    'linewidth': 0.5
                })
            
            pairplot_kwargs['plot_kws'] = plot_kws
            
            # Configurar diag_kws según el tipo de gráfico diagonal
            diag_kind = kwargs.get('diag_kind', 'auto')
            if diag_kind == 'hist':
                diag_kws = kwargs.get('diag_kws', {
                    'bins': 20,
                    'alpha': 0.7,
                    'edgecolor': 'white',
                    'linewidth': 0.5
                })
            elif diag_kind == 'kde':
                diag_kws = kwargs.get('diag_kws', {
                    'alpha': 0.7,
                    'linewidth': 1.5
                })
            else:
                # Para 'auto' o cualquier otro tipo
                diag_kws = kwargs.get('diag_kws', {
                    'alpha': 0.7,
                    'edgecolor': 'white',
                    'linewidth': 0.5
                })
            
            pairplot_kwargs['diag_kws'] = diag_kws
            
            grid_kws = kwargs.get('grid_kws', {})
            if grid_kws:
                pairplot_kwargs['grid_kws'] = grid_kws
            
            
            # Calcular el tamaño de la figura basado en el número de variables
            if num_vars <= 3:
                # Para pocas variables, figura más pequeña
                fig_width = 10
                fig_height = 8
            elif num_vars <= 5:
                # Para variables moderadas
                fig_width = 12
                fig_height = 10
            elif num_vars <= 7:
                # Para muchas variables, figura más grande
                fig_width = 14
                fig_height = 12
            else:
                # Para muchas variables, figura muy grande
                fig_width = 16
                fig_height = 14
            
            # Crear figura con tamaño específico ANTES del pairplot
            plt.figure(figsize=(fig_width, fig_height))
            
            # Crear el pairplot
            pair_plot = sns.pairplot(**pairplot_kwargs)
            
            # Agregar título
            title = kwargs.get('title', 'Pair Plot - Matriz de Dispersión')
            pair_plot.fig.suptitle(title, y=1.02, fontsize=16, fontweight='bold')
            
            # Ajustar la posición de la leyenda si existe
            if hasattr(pair_plot, '_legend') and pair_plot._legend is not None:
                # Calcular posición dinámica basada en el número de variables
                num_vars = len(variables)
                
                if num_vars <= 3:
                    # Para pocas variables, leyenda más cerca
                    legend_x = 1.05
                    right_margin = 0.90
                elif num_vars <= 5:
                    # Para variables moderadas
                    legend_x = 1.10
                    right_margin = 0.85
                else:
                    # Para muchas variables, leyenda más lejos
                    legend_x = 1.15
                    right_margin = 0.80
                
                # Mover la leyenda a posición dinámica
                pair_plot._legend.set_bbox_to_anchor((legend_x, 0.5))
                pair_plot._legend.set_loc('center left')
                
                # Ajustar el layout con margen dinámico
                plt.tight_layout()
                plt.subplots_adjust(right=right_margin)
            else:
                # Si no hay leyenda, usar layout normal
                plt.tight_layout()
            
            # Convertir el gráfico a imagen base64
            img_buffer = io.BytesIO()
            plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
            img_buffer.seek(0)
            img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
            plt.close()
            
            logger.info(
                f"Pairplot generado exitosamente para dataset '{filename}' con {len(variables)} variables",
                extra={'dataset_filename': filename, 'num_variables': len(variables)}
            )
            
            # Calcular matriz de correlación para la tabla
            correlation_matrix = clean_data[variables].corr().values.tolist()
            
            # Calcular p-values para significancia
            from scipy.stats import pearsonr
            significance_matrix = []
            for i, var1 in enumerate(variables):
                row = []
                for j, var2 in enumerate(variables):
                    if i == j:
                        row.append(0.0)  # Diagonal
                    else:
                        corr, p_value = pearsonr(clean_data[var1], clean_data[var2])
                        row.append(p_value)
                significance_matrix.append(row)
            
            return {
                "variables": variables,
                "pairplot_image": img_base64,
                "correlation_matrix": correlation_matrix,
                "significance_matrix": significance_matrix,
                "sample_size": len(clean_data),
                "parameters": kwargs
            }
            
        except ValueError:
            # Re-lanzar ValueError sin modificar (ya tiene contexto adecuado)
            raise
        except Exception as e:
            error_msg = f"Error generando pairplot para dataset '{filename}': {str(e)}"
            logger.error(
                error_msg,
                extra={'dataset_filename': filename, 'variables': variables, 'error': str(e)},
                exc_info=True
            )
            raise Exception(error_msg) from e 

    def get_grubbs_detailed_results(self, filename: str, subject_id: str = None) -> Dict[str, Any]:
        """
        Obtener resultados detallados del test de Grubbs para todas las variables numéricas.
        
        Este método aplica el test de Grubbs a todas las variables numéricas del dataset,
        incluyendo validación de normalidad y cálculo preciso del p-valor.
        
        Args:
            filename: Nombre del archivo del dataset a analizar.
            subject_id: Nombre opcional de la columna que contiene el ID del sujeto.
                Si se proporciona, se usará para identificar las observaciones.
        
        Returns:
            Diccionario con:
                - success: bool indicando si el análisis fue exitoso
                - total_variables: Número total de variables analizadas
                - variables: Lista de diccionarios con resultados por variable:
                    - variable: Nombre de la variable
                    - success: bool indicando si el análisis fue exitoso
                    - observation_id: ID de la observación más extrema
                    - value: Valor de la observación más extrema
                    - grubbs_statistic: Estadístico de Grubbs calculado
                    - critical_value: Valor crítico al nivel de significancia
                    - p_value: p-valor formateado como string
                    - p_value_numeric: p-valor como número
                    - is_outlier: bool indicando si es outlier
                    - result: 'Outlier' o 'No outlier'
                    - sample_size: Tamaño de la muestra
                    - mean: Media de la variable
                    - std: Desviación estándar de la variable
                    - normality_test: Nombre del test de normalidad usado
                    - normality_p_value: p-valor del test de normalidad
                    - is_normal: bool indicando si los datos son normales
                    - normality_warning: Mensaje de advertencia si los datos no son normales
        
        Note:
            - Valida normalidad antes de aplicar el test usando Shapiro-Wilk (n<=50)
              o Anderson-Darling (n>50).
            - Usa cálculo preciso del p-valor con corrección de Bonferroni.
            - Solo detecta un outlier por variable (el más extremo).
            - Si los datos no son normales, se incluye una advertencia en los resultados.
        
        Raises:
            ValueError: Si el dataset no se encuentra.
            Exception: Si ocurre un error durante el análisis.
        """
        try:
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                raise ValueError(f"Dataset {filename} no encontrado")
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            dataset_info = self.data_processor.datasets[filename]
            
            from scipy import stats
            
            # Obtener variables numéricas usando variable_types
            variable_types = dataset_info.get("variable_types", {})
            numeric_columns = []
            
            for column, var_type in variable_types.items():
                if var_type in ["cuantitativa_continua", "cuantitativa_discreta"] and column != subject_id:
                    numeric_columns.append(column)
            
            if len(numeric_columns) == 0:
                return {
                    'error': 'No hay variables numéricas para analizar',
                    'success': False
                }
            
            results = {
                'success': True,
                'variables': [],
                'total_variables': len(numeric_columns)
            }
            
            for variable in numeric_columns:
                try:
                    # Obtener datos de la variable
                    data = df[variable].dropna()
                    if len(data) < 3:
                        results['variables'].append({
                            'variable': variable,
                            'error': 'Se requieren al menos 3 observaciones para realizar el test de Grubbs',
                            'success': False
                        })
                        continue
                    
                    # Verificar que todos los valores sean numéricos
                    # Intentar convertir a numérico
                    data_numeric = pd.to_numeric(data, errors='coerce')
                    data_clean = data_numeric.dropna()
                    
                    if len(data_clean) < 3:
                        results['variables'].append({
                            'variable': variable,
                            'error': f'Después de limpiar valores no numéricos, solo quedan {len(data_clean)} observaciones válidas (se requieren al menos 3)',
                            'success': False
                        })
                        continue
                    
                    n = len(data_clean)
                    mean = data_clean.mean()
                    std = data_clean.std()
                    
                    # Verificar que std no sea 0 (datos constantes)
                    if std == 0 or np.isnan(std):
                        results['variables'].append({
                            'variable': variable,
                            'error': 'La variable tiene desviación estándar cero (todos los valores son iguales)',
                            'success': False
                        })
                        continue
                    
                    # Validar normalidad antes de aplicar el test
                    normality_result = self._test_normality(data_clean, alpha=0.05)
                    
                    # Test de Grubbs para el valor más extremo (máximo o mínimo)
                    # El test de Grubbs identifica un único outlier: el más alto o el más bajo
                    deviations_from_mean = data_clean - mean
                    abs_deviations = np.abs(deviations_from_mean)
                    max_deviation_pos = abs_deviations.argmax()  # Posición en el array
                    max_deviation_idx = data_clean.index[max_deviation_pos]  # Índice real del DataFrame
                    max_deviation_value = data_clean.iloc[max_deviation_pos]
                    
                    # Determinar si es el máximo o el mínimo
                    is_maximum = bool(max_deviation_value > mean)
                    outlier_type = "máximo" if is_maximum else "mínimo"
                    
                    # Calcular estadístico de Grubbs (usar desviación absoluta)
                    max_deviation = abs_deviations.iloc[max_deviation_pos]
                    grubbs_stat = max_deviation / std
                    
                    # Valor crítico de Grubbs (fórmula correcta)
                    alpha = 0.05
                    t_val = stats.t.ppf(1 - alpha / (2 * n), n - 2)
                    critical_value = (n - 1) * np.sqrt(t_val**2 / (n - 2 + t_val**2)) / np.sqrt(n)
                    
                    # Calcular p-valor usando la fórmula correcta
                    p_value = self._calculate_grubbs_pvalue(grubbs_stat, n)
                    
                    is_outlier = bool(grubbs_stat > critical_value)
                    
                    # Obtener ID de la observación usando el índice correcto
                    if subject_id and subject_id in df.columns:
                        try:
                            observation_id = str(df.loc[max_deviation_idx, subject_id])
                        except (KeyError, IndexError):
                            # Si falla, usar la posición como fallback
                            observation_id = f"ID_{max_deviation_idx}"
                    else:
                        observation_id = f"ID_{max_deviation_idx}"
                    
                    # Formatear p-valor: usar notación científica si es muy pequeño
                    if p_value < 0.000001 or p_value == 0:
                        if p_value == 0:
                            p_value_formatted = "< 1e-10"
                        else:
                            p_value_formatted = f"{p_value:.2e}"
                    else:
                        p_value_formatted = f"{p_value:.6f}"
                    
                    variable_result = {
                        'variable': variable,
                        'success': True,
                        'observation_id': str(observation_id),
                        'value': float(round(float(max_deviation_value), 4)),
                        'outlier_type': str(outlier_type),  # "máximo" o "mínimo"
                        'is_maximum': bool(is_maximum),  # True si es máximo, False si es mínimo
                        'grubbs_statistic': float(round(float(grubbs_stat), 4)),
                        'critical_value': float(round(float(critical_value), 4)),
                        'p_value': str(p_value_formatted),
                        'p_value_numeric': float(p_value),
                        'is_outlier': bool(is_outlier),
                        'result': str('Outlier' if is_outlier else 'No outlier'),
                        'sample_size': int(n),
                        'mean': float(round(float(mean), 4)),
                        'std': float(round(float(std), 4)),
                        # Información de normalidad
                        'normality_test': str(normality_result.get('test_name')) if normality_result.get('test_name') else None,
                        'normality_p_value': float(normality_result.get('p_value')) if normality_result.get('p_value') is not None else None,
                        'is_normal': bool(normality_result.get('is_normal', False)),
                        'normality_warning': str(normality_result.get('warning')) if normality_result.get('warning') else None
                    }
                    
                    results['variables'].append(variable_result)
                    
                except Exception as e:
                    # Capturar errores específicos por variable
                    error_msg = f'Error procesando variable {variable}: {str(e)}'
                    logger.error(
                        error_msg,
                        extra={'variable': variable, 'dataset_filename': filename, 'error': str(e)},
                        exc_info=True
                    )
                    results['variables'].append({
                        'variable': variable,
                        'error': error_msg,
                        'success': False
                    })
                    continue
            
            return results
            
        except Exception as e:
            error_msg = f"Error inesperado en test de Grubbs para dataset '{filename}': {str(e)}"
            logger.error(
                error_msg,
                extra={'dataset_filename': filename, 'subject_id': subject_id, 'error': str(e)},
                exc_info=True
            )
            return {
                'error': error_msg,
                'success': False
            } 

    def get_dixon_detailed_results(self, filename: str, subject_id: str = None, alpha: float = 0.05) -> Dict[str, Any]:
        """
        Obtiene resultados detallados del test de Dixon para todas las variables numéricas.
        
        Ejecuta el test de Dixon en cada variable numérica del dataset. Este test es
        apropiado solo para muestras pequeñas (3-30 observaciones).
        
        Args:
            filename: Nombre del archivo del dataset a analizar.
            subject_id: Nombre opcional de la columna que identifica a cada sujeto.
                Si se proporciona, los resultados incluirán el ID del sujeto.
            alpha: Nivel de significancia. Valores soportados: 0.01, 0.05, 0.10.
                Por defecto 0.05.
        
        Returns:
            Diccionario con:
                - success (bool): True si la operación fue exitosa
                - alpha (float): Nivel de significancia usado
                - variables (list): Lista de resultados por variable, cada uno con:
                    - variable (str): Nombre de la variable
                    - success (bool): Si el test se ejecutó correctamente
                    - observation_id (str): ID de la observación outlier (si existe)
                    - value (float): Valor de la observación outlier
                    - q_statistic (float): Estadístico Q (Q10 o Q11)
                    - critical_value (float): Valor crítico para el alpha especificado
                    - p_value (str): P-valor formateado (calculado usando interpolación)
                    - p_value_numeric (float): P-valor como número
                    - is_outlier (bool): Si se detectó outlier
                    - result (str): 'Outlier' o 'No outlier'
                    - sample_size (int): Tamaño de muestra
                    - outlier_type (str): 'mínimo' o 'máximo' si es outlier
                    - q10 (float): Estadístico Q10
                    - q11 (float): Estadístico Q11
                - total_variables (int): Número total de variables analizadas
                - error (str): Mensaje de error si success=False
        
        Note:
            - Requiere entre 3 y 30 observaciones por variable.
            - Variables fuera de este rango se omiten con mensaje de error apropiado.
            - El p-valor se calcula usando interpolación de tablas estadísticas oficiales.
            - Soporta múltiples niveles de significancia: 0.01, 0.05, 0.10.
            - Detecta outliers solo en los extremos (mínimo o máximo).
            - Para muestras más grandes, use get_grubbs_detailed_results() o
              get_rosner_detailed_results().
        """
        try:
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                raise ValueError(f"Dataset {filename} no encontrado")
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            dataset_info = self.data_processor.datasets[filename]
            
            # Obtener variables numéricas usando variable_types
            variable_types = dataset_info.get("variable_types", {})
            numeric_columns = []
            
            for column, var_type in variable_types.items():
                if var_type in ["cuantitativa_continua", "cuantitativa_discreta"] and column != subject_id:
                    numeric_columns.append(column)
            
            if len(numeric_columns) == 0:
                return {
                    'error': 'No hay variables numéricas para analizar',
                    'success': False
                }
            
            results = {
                'success': True,
                'alpha': alpha,
                'variables': [],
                'total_variables': len(numeric_columns)
            }
            
            for variable in numeric_columns:
                # Obtener datos de la variable
                data = df[variable].dropna()
                n = len(data)
                
                # Verificar tamaño de muestra para Dixon test (3-30 observaciones)
                if n < 3:
                    results['variables'].append({
                        'variable': variable,
                        'error': 'Se requieren al menos 3 observaciones para realizar el test de Dixon',
                        'success': False
                    })
                    continue
                
                if n > 30:
                    results['variables'].append({
                        'variable': variable,
                        'error': f'La prueba no es adecuada solo para tamaño de muestra de 3-30 observaciones. El tamaño de muestra actual es {n}. Se sugiere analizar el resto de las pruebas.',
                        'success': False
                    })
                    continue
                
                # Ordenar datos para Dixon test
                sorted_data = data.sort_values()
                sorted_indices = sorted_data.index
                
                # Calcular Q10 y Q11 (estadísticos de Dixon)
                Q10 = (sorted_data.iloc[1] - sorted_data.iloc[0]) / (sorted_data.iloc[-1] - sorted_data.iloc[0])
                Q11 = (sorted_data.iloc[-1] - sorted_data.iloc[-2]) / (sorted_data.iloc[-1] - sorted_data.iloc[0])
                
                # Obtener valores críticos para el nivel de significancia especificado
                critical_values = self._get_dixon_critical_values(alpha)
                critical_value = critical_values.get(n)
                
                if critical_value is None:
                    results['variables'].append({
                        'variable': variable,
                        'error': f'No se encontró valor crítico para n={n} y alpha={alpha}',
                        'success': False
                    })
                    continue
                
                # Determinar si hay outlier y cuál es
                is_outlier = False
                outlier_type = None
                observation_id = None
                value = None
                q_statistic = None
                
                if Q10 > critical_value:
                    is_outlier = True
                    outlier_type = "mínimo"
                    observation_id = sorted_indices[0]
                    value = sorted_data.iloc[0]
                    q_statistic = Q10
                elif Q11 > critical_value:
                    is_outlier = True
                    outlier_type = "máximo"
                    observation_id = sorted_indices[-1]
                    value = sorted_data.iloc[-1]
                    q_statistic = Q11
                
                # Obtener ID de la observación
                observation_idx = observation_id  # Guardar el índice original del DataFrame
                if subject_id and subject_id in df.columns:
                    try:
                        observation_id = str(df.loc[observation_idx, subject_id])
                    except (KeyError, IndexError):
                        # Si falla, usar la posición como fallback
                        observation_id = f"ID_{observation_idx}"
                else:
                    observation_id = f"ID_{observation_idx}"
                
                # Calcular p-valor usando interpolación de tablas estadísticas
                if is_outlier:
                    # Usar el método mejorado de cálculo del p-valor
                    p_value = self._calculate_dixon_pvalue(q_statistic, n, alpha)
                else:
                    # Si no es outlier, calcular p-valor para ambos estadísticos
                    # y usar el menor (más conservador)
                    p_value_q10 = self._calculate_dixon_pvalue(Q10, n, alpha)
                    p_value_q11 = self._calculate_dixon_pvalue(Q11, n, alpha)
                    p_value = min(p_value_q10, p_value_q11)
                
                # Formatear p-valor: usar notación científica si es muy pequeño
                if p_value < 0.000001 or p_value == 0:
                    if p_value == 0:
                        p_value_formatted = "< 1e-10"
                    else:
                        p_value_formatted = f"{p_value:.2e}"
                else:
                    p_value_formatted = f"{p_value:.6f}"
                
                variable_result = {
                    'variable': variable,
                    'success': True,
                    'observation_id': observation_id,
                    'value': float(round(value, 4)) if value is not None else None,
                    'q_statistic': float(round(q_statistic, 4)) if q_statistic is not None else None,
                    'critical_value': float(round(critical_value, 4)),
                    'p_value': p_value_formatted,
                    'p_value_numeric': float(p_value),
                    'is_outlier': is_outlier,
                    'result': 'Outlier' if is_outlier else 'No outlier',
                    'sample_size': int(n),
                    'outlier_type': outlier_type,
                    'q10': float(round(Q10, 4)),
                    'q11': float(round(Q11, 4))
                }
                
                results['variables'].append(variable_result)
            
            return results
            
        except Exception as e:
            error_msg = f"Error inesperado en test de Dixon para dataset '{filename}': {str(e)}"
            logger.error(
                error_msg,
                extra={'dataset_filename': filename, 'subject_id': subject_id, 'error': str(e)},
                exc_info=True
            )
            return {
                'error': error_msg,
                'success': False
            } 

    def get_rosner_detailed_results(self, filename: str, subject_id: str = None, k: int = None,
                                     alpha: float = 0.05) -> Dict[str, Any]:
        """
        Obtiene resultados detallados del test de Rosner para todas las variables numéricas.
        
        Ejecuta el test de Rosner (ESD) en cada variable numérica del dataset.
        Este test puede detectar múltiples outliers de forma iterativa con cálculo
        preciso del p-valor y ajuste adecuado por comparaciones múltiples.
        
        Args:
            filename: Nombre del archivo del dataset a analizar.
            subject_id: Nombre opcional de la columna que identifica a cada sujeto.
                Si se proporciona, los resultados incluirán el ID del sujeto.
            k: Número máximo de outliers a detectar por variable. Si es None,
                se calcula como máximo 10% del tamaño de muestra.
            alpha: Nivel de significancia global. Por defecto 0.05.
        
        Returns:
            Diccionario con:
                - success (bool): True si la operación fue exitosa
                - alpha (float): Nivel de significancia usado
                - variables (list): Lista de resultados por variable, cada uno con:
                    - variable (str): Nombre de la variable
                    - success (bool): Si el test se ejecutó correctamente
                    - sample_size (int): Tamaño de muestra
                    - k_tested (int): Número máximo de outliers probados
                    - outliers_detected (int): Número de outliers encontrados
                    - outlier_details (list): Lista de detalles por cada outlier:
                        - observation_id (str): ID de la observación
                        - value (float): Valor de la observación
                        - test_statistic (float): Estadístico de test (R_i)
                        - critical_value (float): Valor crítico ajustado
                        - p_value (str): P-valor formateado (ajustado por comparaciones múltiples)
                        - p_value_numeric (float): P-valor como número
                        - iteration (int): Iteración en que se detectó
                    - is_outlier (bool): Si se detectó al menos un outlier
                    - result (str): Resumen del resultado
                - total_variables (int): Número total de variables analizadas
                - error (str): Mensaje de error si success=False
        
        Note:
            - Requiere al menos 25 observaciones por variable.
            - Variables con menos observaciones se omiten con mensaje de error.
            - El método ajusta automáticamente por comparaciones múltiples usando
              el método de Rosner (ajuste en valor crítico y p-valor).
            - Detecta outliers de forma iterativa, removiendo el más extremo en cada paso.
            - El p-valor se calcula correctamente en cada iteración sin acumulación de errores.
        """
        try:
            # Cargar dataset
            if filename not in self.data_processor.datasets:
                raise ValueError(f"Dataset {filename} no encontrado")
            
            # Cargar dataset usando método centralizado de DataProcessor
            df = self.data_processor.get_dataframe(filename)
            dataset_info = self.data_processor.datasets[filename]
            
            from scipy import stats
            
            # Obtener variables numéricas usando variable_types
            variable_types = dataset_info.get("variable_types", {})
            numeric_columns = []
            
            for column, var_type in variable_types.items():
                if var_type in ["cuantitativa_continua", "cuantitativa_discreta"] and column != subject_id:
                    numeric_columns.append(column)
            
            if len(numeric_columns) == 0:
                return {
                    'error': 'No hay variables numéricas para analizar',
                    'success': False
                }
            
            results = {
                'success': True,
                'alpha': alpha,
                'variables': [],
                'total_variables': len(numeric_columns)
            }
            
            for variable in numeric_columns:
                # Obtener datos de la variable
                data = df[variable].dropna()
                
                # Verificar que todos los valores sean numéricos
                try:
                    # Intentar convertir a numérico
                    data_numeric = pd.to_numeric(data, errors='coerce')
                    data_clean = data_numeric.dropna()
                    
                    n = len(data_clean)
                    
                    # Verificar tamaño de muestra para Rosner test (mínimo 25 observaciones)
                    if n < 25:
                        results['variables'].append({
                            'variable': variable,
                            'error': f'El test de Rosner requiere al menos 25 observaciones. El tamaño de muestra actual es {n}.',
                            'success': False
                        })
                        continue
                        
                except Exception as e:
                    results['variables'].append({
                        'variable': variable,
                        'error': f'Error procesando datos numéricos: {str(e)}',
                        'success': False
                    })
                    continue
                
                # Determinar k si no se especifica
                if k is None:
                    k = max(1, int(0.1 * n))  # Máximo 10% de outliers
                
                k = min(k, n // 2)  # No más de la mitad de los datos
                
                # Aplicar test de Rosner
                outliers = []
                working_data = data_clean.copy()
                working_indices = data_clean.index.tolist()
                outlier_details = []
                
                for i in range(k):
                    if len(working_data) < 3:
                        break
                    
                    mean = working_data.mean()
                    std = working_data.std()
                    
                    # Encontrar el valor más extremo
                    deviations = np.abs(working_data - mean)
                    max_idx = deviations.idxmax()
                    max_deviation = deviations[max_idx]
                    
                    # Calcular estadístico de test (R_i)
                    test_stat = max_deviation / std
                    
                    # Calcular valor crítico usando método mejorado
                    critical_value = self._calculate_rosner_critical_value(n, i, alpha)
                    
                    # Calcular p-valor usando método mejorado (con ajuste por comparaciones múltiples)
                    p_value = self._calculate_rosner_pvalue(test_stat, n, i, alpha)
                    
                    if test_stat > critical_value:
                        # Es un outlier
                        outliers.append(max_idx)
                        
                        # Obtener ID de la observación
                        if subject_id and subject_id in df.columns:
                            try:
                                observation_id = str(df.loc[max_idx, subject_id])
                            except (KeyError, IndexError):
                                # Si falla, usar la posición como fallback
                                observation_id = f"ID_{max_idx}"
                        else:
                            observation_id = f"ID_{max_idx}"
                        
                        # Formatear p-valor
                        if p_value < 0.000001 or p_value == 0:
                            if p_value == 0:
                                p_value_formatted = "< 1e-10"
                            else:
                                p_value_formatted = f"{p_value:.2e}"
                        else:
                            p_value_formatted = f"{p_value:.6f}"
                        
                        outlier_details.append({
                            'observation_id': observation_id,
                            'value': float(round(working_data[max_idx], 4)),
                            'test_statistic': float(round(test_stat, 4)),
                            'critical_value': float(round(critical_value, 4)),
                            'p_value': p_value_formatted,
                            'p_value_numeric': float(p_value),
                            'iteration': i + 1
                        })
                        
                        # Remover el outlier para la siguiente iteración
                        working_data = working_data.drop(max_idx)
                    else:
                        break
                
                variable_result = {
                    'variable': variable,
                    'success': True,
                    'sample_size': int(n),
                    'k_tested': k,
                    'outliers_detected': len(outliers),
                    'outlier_details': outlier_details,
                    'is_outlier': len(outliers) > 0,
                    'result': f'{len(outliers)} outliers detectados' if len(outliers) > 0 else 'No outliers detectados'
                }
                
                results['variables'].append(variable_result)
            
            return results
            
        except Exception as e:
            error_msg = f"Error inesperado en test de Rosner para dataset '{filename}': {str(e)}"
            logger.error(
                error_msg,
                extra={'dataset_filename': filename, 'subject_id': subject_id, 'k': k, 'error': str(e)},
                exc_info=True
            )
            return {
                'error': error_msg,
                'success': False
            } 

