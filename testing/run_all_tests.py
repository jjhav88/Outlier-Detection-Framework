# -*- coding: utf-8 -*-
"""
Script para ejecutar todas las pruebas del sistema SISTAOUT
Genera reportes en múltiples formatos (HTML, JSON, texto)
"""

import sys
import os
import subprocess
import argparse
import json
import datetime
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def ensure_reports_dir():
    """Crear directorio de reportes si no existe"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    reports_dir = os.path.join(base_dir, 'reports')
    os.makedirs(reports_dir, exist_ok=True)
    return reports_dir


def parse_pytest_output(output):
    """Parsear la salida de pytest para extraer estadísticas"""
    import re
    stats = {
        'passed': 0,
        'failed': 0,
        'skipped': 0,
        'errors': 0,
        'total': 0
    }
    
    # Buscar línea final de pytest que contiene las estadísticas
    # Formato común: "X passed, Y failed, Z skipped in T.TTs"
    # O: "X passed, Y warnings in T.TTs"
    patterns = [
        r'(\d+)\s+passed',
        r'(\d+)\s+failed',
        r'(\d+)\s+skipped',
        r'(\d+)\s+error',
        r'(\d+)\s+warnings'
    ]
    
    # Buscar en toda la salida
    passed_match = re.search(r'(\d+)\s+passed', output)
    failed_match = re.search(r'(\d+)\s+failed', output)
    skipped_match = re.search(r'(\d+)\s+skipped', output)
    error_match = re.search(r'(\d+)\s+error', output)
    
    if passed_match:
        stats['passed'] = int(passed_match.group(1))
    if failed_match:
        stats['failed'] = int(failed_match.group(1))
    if skipped_match:
        stats['skipped'] = int(skipped_match.group(1))
    if error_match:
        stats['errors'] = int(error_match.group(1))
    
    stats['total'] = stats['passed'] + stats['failed'] + stats['skipped'] + stats['errors']
    return stats


def run_tests(test_type=None, verbose=False, coverage=False, generate_reports=True):
    """Ejecutar pruebas y generar reportes"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    reports_dir = ensure_reports_dir() if generate_reports else None
    
    test_files = {
        'regression': os.path.join(base_dir, 'test_regression.py'),
        'functional': os.path.join(base_dir, 'test_functional.py'),
        'whitebox': os.path.join(base_dir, 'test_whitebox.py'),
        'blackbox': os.path.join(base_dir, 'test_blackbox.py')
    }
    
    test_descriptions = {
        'regression': 'Pruebas de Regresión',
        'functional': 'Pruebas Funcionales',
        'whitebox': 'Pruebas de Caja Blanca',
        'blackbox': 'Pruebas de Caja Negra'
    }
    
    if test_type and test_type not in test_files:
        print("[ERROR] Tipo de prueba invalido:", test_type)
        print("Tipos disponibles:", ', '.join(test_files.keys()))
        return False, {}
    
    # Usar 'py' en Windows para Python 3, o 'python3' en Linux/Mac
    import platform
    if platform.system() == 'Windows':
        python_cmd = 'py'
    else:
        python_cmd = 'python3'
    
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    results = {}
    
    # Si se especifica un tipo, ejecutar solo ese tipo
    if test_type:
        test_types_to_run = [test_type]
    else:
        test_types_to_run = list(test_files.keys())
    
    all_results = {}
    
    for current_test_type in test_types_to_run:
        cmd = [python_cmd, '-m', 'pytest']
        
        if verbose:
            cmd.append('-v')
        else:
            cmd.append('-q')
        
        # Agregar opciones de reporte
        if generate_reports:
            html_report = os.path.join(reports_dir, f'report_{current_test_type}_{timestamp}.html')
            cmd.extend([
                '--html', html_report,
                '--self-contained-html'
            ])
        
        if coverage and current_test_type == test_types_to_run[0]:
            # Solo agregar coverage en la primera ejecución
            cov_dir = os.path.join(reports_dir, 'coverage') if generate_reports else 'htmlcov'
            cmd.extend([
                '--cov=analysis_core',
                '--cov=main',
                '--cov-report=html:' + cov_dir,
                '--cov-report=term'
            ])
        
        cmd.append(test_files[current_test_type])
        
        print(f"\n[TEST] Ejecutando pruebas de {test_descriptions[current_test_type]}...")
        
        try:
            parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            result = subprocess.run(
                cmd,
                cwd=parent_dir,
                capture_output=True,
                text=True
            )
            
            # Parsear estadísticas de la salida
            stats = parse_pytest_output(result.stdout + result.stderr)
            stats['success'] = result.returncode == 0
            stats['test_type'] = current_test_type
            stats['description'] = test_descriptions[current_test_type]
            stats['timestamp'] = timestamp
            stats['output'] = result.stdout + result.stderr
            
            all_results[current_test_type] = stats
            
            # Guardar JSON individual si se generan reportes
            if generate_reports:
                json_report = os.path.join(reports_dir, f'report_{current_test_type}_{timestamp}.json')
                with open(json_report, 'w', encoding='utf-8') as f:
                    json.dump(stats, f, indent=2, ensure_ascii=False)
            
            # Mostrar resumen
            print(f"  [RESULTADO] {stats['passed']} pasaron, {stats['failed']} fallaron, {stats['skipped']} omitidas")
            
            if generate_reports:
                print(f"  [REPORTE] HTML: {html_report}")
                print(f"  [REPORTE] JSON: {json_report}")
            
        except Exception as e:
            print(f"[ERROR] Error ejecutando pruebas de {current_test_type}:", e)
            all_results[current_test_type] = {
                'success': False,
                'error': str(e),
                'test_type': current_test_type,
                'description': test_descriptions[current_test_type]
            }
    
    # Generar reporte consolidado
    if generate_reports and len(test_types_to_run) > 1:
        generate_consolidated_report(all_results, reports_dir, timestamp)
    
    # Determinar éxito general
    overall_success = all(r.get('success', False) for r in all_results.values())
    
    return overall_success, all_results


def generate_consolidated_report(results, reports_dir, timestamp):
    """Generar reporte consolidado en formato texto y JSON"""
    report_file = os.path.join(reports_dir, f'report_consolidado_{timestamp}.txt')
    json_file = os.path.join(reports_dir, f'report_consolidado_{timestamp}.json')
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("SISTAOUT - Reporte Consolidado de Pruebas\n")
        f.write("=" * 80 + "\n")
        f.write(f"Fecha: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")
        
        total_passed = 0
        total_failed = 0
        total_skipped = 0
        total_tests = 0
        
        for test_type, stats in results.items():
            f.write(f"\n{stats.get('description', test_type)}\n")
            f.write("-" * 80 + "\n")
            
            if 'error' in stats:
                f.write(f"  ERROR: {stats['error']}\n")
            else:
                passed = stats.get('passed', 0)
                failed = stats.get('failed', 0)
                skipped = stats.get('skipped', 0)
                total = stats.get('total', 0)
                
                f.write(f"  Estado: {'PASO' if stats.get('success', False) else 'FALLO'}\n")
                f.write(f"  Pruebas pasadas: {passed}\n")
                f.write(f"  Pruebas fallidas: {failed}\n")
                f.write(f"  Pruebas omitidas: {skipped}\n")
                f.write(f"  Total de pruebas: {total}\n")
                
                if total > 0:
                    success_rate = (passed / total) * 100
                    f.write(f"  Tasa de éxito: {success_rate:.2f}%\n")
                
                total_passed += passed
                total_failed += failed
                total_skipped += skipped
                total_tests += total
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("RESUMEN GENERAL\n")
        f.write("=" * 80 + "\n")
        f.write(f"Total de pruebas pasadas: {total_passed}\n")
        f.write(f"Total de pruebas fallidas: {total_failed}\n")
        f.write(f"Total de pruebas omitidas: {total_skipped}\n")
        f.write(f"Total de pruebas ejecutadas: {total_tests}\n")
        
        if total_tests > 0:
            overall_success_rate = (total_passed / total_tests) * 100
            f.write(f"Tasa de éxito general: {overall_success_rate:.2f}%\n")
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("ESTADO GENERAL: ")
        overall_success = all(r.get('success', False) for r in results.values())
        f.write("PASO" if overall_success else "FALLO")
        f.write("\n" + "=" * 80 + "\n")
    
    # Guardar JSON consolidado
    consolidated_data = {
        'timestamp': timestamp,
        'date': datetime.datetime.now().isoformat(),
        'results': results,
        'summary': {
            'total_passed': total_passed,
            'total_failed': total_failed,
            'total_skipped': total_skipped,
            'total_tests': total_tests,
            'overall_success': overall_success,
            'success_rate': (total_passed / total_tests * 100) if total_tests > 0 else 0
        }
    }
    
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(consolidated_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n[REPORTE] Consolidado texto: {report_file}")
    print(f"[REPORTE] Consolidado JSON: {json_file}")


def main():
    parser = argparse.ArgumentParser(description='Ejecutar pruebas del sistema SISTAOUT')
    
    parser.add_argument('--type', choices=['regression', 'functional', 'whitebox', 'blackbox'],
                       help='Tipo de prueba a ejecutar')
    parser.add_argument('--verbose', '-v', action='store_true', help='Salida detallada')
    parser.add_argument('--coverage', '-c', action='store_true', help='Reporte de cobertura')
    parser.add_argument('--no-reports', action='store_true', help='No generar reportes')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("SISTAOUT - Suite de Pruebas")
    print("=" * 60)
    print()
    
    success, results = run_tests(
        test_type=args.type,
        verbose=args.verbose,
        coverage=args.coverage,
        generate_reports=not args.no_reports
    )
    
    print()
    print("=" * 60)
    if success:
        print("[OK] Todas las pruebas completadas exitosamente")
    else:
        print("[FAIL] Algunas pruebas fallaron")
    print("=" * 60)
    
    # Mostrar resumen de resultados
    if results:
        print("\nRESUMEN DE RESULTADOS:")
        print("-" * 60)
        for test_type, stats in results.items():
            if 'error' not in stats:
                status = "PASO" if stats.get('success', False) else "FALLO"
                print(f"  {stats.get('description', test_type)}: {status} "
                      f"({stats.get('passed', 0)}/{stats.get('total', 0)})")
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
