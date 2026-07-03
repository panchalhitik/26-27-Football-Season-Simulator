import pdfplumber
import sys
from pathlib import Path

src = Path(r"C:\Users\panch\Downloads\Football simulator context .pdf")
out_dir = Path(__file__).parent / "_pdf_text"
out_dir.mkdir(exist_ok=True)

with pdfplumber.open(src) as pdf:
    print(f"pages: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages, 1):
        text = page.extract_text() or ""
        (out_dir / f"page_{i:02d}.txt").write_text(text, encoding="utf-8")
        first = (text.strip().splitlines()[:3] if text.strip() else ["(no text)"])
        print(f"--- page {i} ({len(text)} chars) ---")
        for line in first:
            print(line)
