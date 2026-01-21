# -*- coding: utf-8 -*-
"""
Script para visualizar reportes de pruebas generados
"""

import sys
import os
import json
import argparse
from pathlib import Path
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def list_reports():
    """Listar todos los reportes disponibles"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    reports_dir = os.path.join(base_dir, 'reports')
    
    if not os.path.exists(reports_dir):
        print("[ERROR] No existe el directorio de reportes")
        return []
    
    reports = []
    for file in os.listdir(reports_dir):
        if file.endswith('.json'):
            filepath = os.path.join(reports_dir, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Extraer timestamp del nombre del archivo si no está en los datos
                    timestamp = data.get('timestamp', '')
                    if not timestamp and '_' in file:
                        parts = file.replace('.json', '').split('_')
                        if len(parts) >= 3:
                            timestamp = '_'.join(parts[-2:])
                    
                    reports.append({
                        'file': file,
                        'path': filepath,
                        'timestamp': timestamp,
                        'date': data.get('date', ''),
                        'data': data,
                        'is_consolidated': 'consolidado' in file
                    })
            except Exception as e:
                print(f"[WARN] No se pudo cargar {file}: {e}")
                pass
    
    # Ordenar por fecha (más reciente primero)
    reports.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return reports


def display_report(report_data, is_individual=False):
    """Mostrar reporte en consola"""
    print("=" * 80)
    print("SISTAOUT - Reporte de Pruebas")
    print("=" * 80)
    print(f"Fecha: {report_data.get('date', 'N/A')}")
    print("=" * 80)
    
    # Si es un reporte individual, mostrar directamente
    if is_individual:
        test_type = report_data.get('test_type', 'unknown')
        description = report_data.get('description', test_type)
        print(f"\n{description}")
        print("-" * 80)
        
        if 'error' in report_data:
            print(f"  ERROR: {report_data['error']}")
        else:
            passed = report_data.get('passed', 0)
            failed = report_data.get('failed', 0)
            skipped = report_data.get('skipped', 0)
            total = report_data.get('total', 0)
            
            status = "PASO" if report_data.get('success', False) else "FALLO"
            print(f"  Estado: {status}")
            print(f"  Pruebas pasadas: {passed}")
            print(f"  Pruebas fallidas: {failed}")
            print(f"  Pruebas omitidas: {skipped}")
            print(f"  Total: {total}")
            
            if total > 0:
                success_rate = (passed / total) * 100
                print(f"  Tasa de éxito: {success_rate:.2f}%")
        print("\n" + "=" * 80)
        return
    
    summary = report_data.get('summary', {})
    if summary:
        print("\nRESUMEN GENERAL:")
        print("-" * 80)
        print(f"  Total de pruebas: {summary.get('total_tests', 0)}")
        print(f"  Pruebas pasadas: {summary.get('total_passed', 0)}")
        print(f"  Pruebas fallidas: {summary.get('total_failed', 0)}")
        print(f"  Pruebas omitidas: {summary.get('total_skipped', 0)}")
        print(f"  Tasa de éxito: {summary.get('success_rate', 0):.2f}%")
        print(f"  Estado general: {'PASO' if summary.get('overall_success', False) else 'FALLO'}")
    
    results = report_data.get('results', {})
    if results:
        print("\nDETALLE POR TIPO DE PRUEBA:")
        print("-" * 80)
        for test_type, stats in results.items():
            print(f"\n{stats.get('description', test_type)}")
            print("  " + "-" * 76)
            
            if 'error' in stats:
                print(f"  ERROR: {stats['error']}")
            else:
                passed = stats.get('passed', 0)
                failed = stats.get('failed', 0)
                skipped = stats.get('skipped', 0)
                total = stats.get('total', 0)
                
                status = "PASO" if stats.get('success', False) else "FALLO"
                print(f"  Estado: {status}")
                print(f"  Pruebas pasadas: {passed}")
                print(f"  Pruebas fallidas: {failed}")
                print(f"  Pruebas omitidas: {skipped}")
                print(f"  Total: {total}")
                
                if total > 0:
                    success_rate = (passed / total) * 100
                    print(f"  Tasa de éxito: {success_rate:.2f}%")
    
    print("\n" + "=" * 80)


def main():
    parser = argparse.ArgumentParser(description='Visualizar reportes de pruebas')
    parser.add_argument('--latest', '-l', action='store_true', help='Mostrar el reporte más reciente')
    parser.add_argument('--list', action='store_true', help='Listar todos los reportes disponibles')
    parser.add_argument('--file', '-f', help='Ruta al archivo JSON del reporte')
    
    args = parser.parse_args()
    
    if args.list:
        reports = list_reports()
        if not reports:
            print("[INFO] No hay reportes disponibles")
            return 0
        
        print("\nReportes disponibles:")
        print("-" * 80)
        for i, report in enumerate(reports, 1):
            print(f"{i}. {report['file']}")
            print(f"   Fecha: {report.get('date', 'N/A')}")
            print()
        return 0
    
    # Cargar reporte
    if args.file:
        report_path = args.file
        is_individual = 'consolidado' not in args.file
    elif args.latest:
        reports = list_reports()
        if not reports:
            print("[ERROR] No hay reportes disponibles")
            return 1
        # Priorizar reportes consolidados
        consolidated = [r for r in reports if r.get('is_consolidated', False)]
        if consolidated:
            report_path = consolidated[0]['path']
            is_individual = False
        else:
            report_path = reports[0]['path']
            is_individual = True
    else:
        # Por defecto, mostrar el más reciente (priorizando consolidados)
        reports = list_reports()
        if not reports:
            print("[ERROR] No hay reportes disponibles")
            print("Ejecuta primero: py testing/run_all_tests.py")
            return 1
        consolidated = [r for r in reports if r.get('is_consolidated', False)]
        if consolidated:
            report_path = consolidated[0]['path']
            is_individual = False
        else:
            report_path = reports[0]['path']
            is_individual = True
    
    try:
        with open(report_path, 'r', encoding='utf-8') as f:
            report_data = json.load(f)
        display_report(report_data, is_individual=is_individual)
    except Exception as e:
        print(f"[ERROR] No se pudo cargar el reporte: {e}")
        return 1
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

