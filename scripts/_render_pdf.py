import pypdfium2 as pdfium
from pathlib import Path

src = Path(r"C:\Users\panch\Downloads\Football simulator context .pdf")
out_dir = Path(__file__).parent / "_pdf_images"
out_dir.mkdir(exist_ok=True)

pdf = pdfium.PdfDocument(src)
print(f"pages: {len(pdf)}")
for i in range(len(pdf)):
    page = pdf[i]
    pil = page.render(scale=1.5).to_pil()
    out = out_dir / f"page_{i+1:02d}.png"
    pil.save(out, "PNG")
    print(f"  wrote {out.name}  ({pil.size[0]}x{pil.size[1]})")
