"""Read-only PDF integrity/layout verification. Requires pypdf; optionally Poppler."""
import argparse
import json
import re
import subprocess
import unicodedata
from pathlib import Path
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument('--pdftoppm', help='Optional Poppler executable for representative page PNGs')
args = parser.parse_args()
source = Path('output/pdf/T058-large-content.pdf')
directory = Path('output/verification/T058')
reader = PdfReader(source)
pages = [unicodedata.normalize('NFKC', page.extract_text()) for page in reader.pages]
text = re.sub(r'\s+', '', '\n'.join(pages))
assert 'T058-END中文导出核对完成' in text
found = re.findall(r'(?:本地样例|最后行针尖)-(\d+)-(\d+)注册', text)
expected = {(str(row), str(col)) for row in range(1, 201) for col in range(1, 9)}
assert set(found) == expected, (len(set(found)), len(expected))
assert len(found) == 1600, 'Duplicated or missing table cells'
selected = sorted({1, len(pages) // 2, next(i + 1 for i, page in enumerate(pages) if '栏目' in page), len(pages)})
if args.pdftoppm:
    for number in selected:
        subprocess.run([args.pdftoppm, '-f', str(number), '-l', str(number), '-scale-to', '1100', '-singlefile', '-png', str(source), str(directory / f'pdf-page-{number}')], check=True)
report = {'pages': len(pages), 'tableCellsVerified': len(found), 'all200RowsPresent': True, 'finalChineseTextPresent': True, 'textNormalization': 'NFKC and layout whitespace removed for CJK glyph mapping', 'selectedPages': selected, 'rendered': bool(args.pdftoppm)}
(directory / 'pdf-inspection.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False))
