
import zipfile
import sys
import os

file_path = "/Users/apple/macWork/macCoding/vivecoding/01_antigravity/02_smartpenny/smartpenny/storage/SmartPenny_Backup_2026-01-17 (1).xlsx"

try:
    with zipfile.ZipFile(file_path, 'r') as z:
        if 'xl/worksheets/sheet1.xml' in z.namelist():
            xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
            print(f"--- Raw XML Dump (First 2000 chars) ---")
            print(xml[:2000])
        else:
            print("sheet1.xml not found")
except Exception as e:
    print(f"Error: {e}")
