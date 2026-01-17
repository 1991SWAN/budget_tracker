
import zipfile
import re
import sys
import os

file_path = "/Users/apple/macWork/macCoding/vivecoding/01_antigravity/02_smartpenny/smartpenny/storage/SmartPenny_Backup_2026-01-17 (1).xlsx"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    sys.exit(1)

try:
    with zipfile.ZipFile(file_path, 'r') as z:
        # List sheet names from workbook.xml
        if 'xl/workbook.xml' in z.namelist():
            workbook_xml = z.read('xl/workbook.xml').decode('utf-8')
            sheets = re.findall(r'<sheet name="([^"]+)"', workbook_xml)
            print("Sheets found:", sheets)
            
            # Try to read shared strings to decode content (simplified)
            shared_strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                ss_xml = z.read('xl/sharedStrings.xml').decode('utf-8')
                # Very naive regex for shared strings, might miss some but good enough for headers usually
                shared_strings = re.findall(r'<t>(.*?)</t>', ss_xml)
            
            # Read first sheet for headers
            if 'xl/worksheets/sheet1.xml' in z.namelist():
                sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
                # Find first row cells
                # This is tricky with regex on XML, but let's try to just dump the first few string references
                print("\nSampling content from Sheet1 (first few shared strings matching):")
                # In standard xlsx produced by sheetjs, headers are usually early shared strings
                print(shared_strings[:20]) 
        else:
            print("Invalid XLSX structure (no workbook.xml)")

except Exception as e:
    print(f"Error reading xlsx: {e}")
