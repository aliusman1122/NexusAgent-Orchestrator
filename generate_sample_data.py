"""Helper script to generate realistic sample files in ./data/ for testing doc ingestion."""

from pathlib import Path
import openpyxl
from docx import Document as DocxWriter
from pypdf import PdfWriter

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 1. Create Sample DOCX
docx_path = DATA_DIR / "sample_services.docx"
doc = DocxWriter()
doc.add_heading("A7 Logics Enterprise Solutions & Technical Offerings", level=1)
doc.add_paragraph(
    "A7 Logics is an agile digital engineering agency providing enterprise-grade software development, "
    "cloud migration, and dedicated software teams."
)
doc.add_heading("Key Service Pillars", level=2)
doc.add_paragraph(
    "1. Full-Stack Web Development: Scalable architectures built on Laravel, Python FastAPI, and React."
)
doc.add_paragraph(
    "2. Mobile App Development: Cross-platform iOS and Android apps powered by Flutter and React Native."
)
doc.add_paragraph(
    "3. Enterprise ColdFusion Modernization: Legacy application maintenance and seamless cloud modernization."
)
doc.add_paragraph(
    "4. AI & Chatbot Automation: Custom conversational agents integrated into enterprise ERP and CRM systems."
)
doc.save(docx_path)
print(f"Created DOCX: {docx_path}")

# 2. Create Sample XLSX
xlsx_path = DATA_DIR / "sample_pricing.xlsx"
wb = openpyxl.Workbook()

# Sheet 1: Service Rates
ws1 = wb.active
ws1.title = "Service_Tiers"
ws1.append(["Service Name", "Category", "Engagement Model", "Estimated Starting Cost", "Typical Turnaround"])
ws1.append(["Custom Web Application", "Web Development", "Fixed Price / Milestone", "$5,000", "4 - 8 Weeks"])
ws1.append(["Mobile App (iOS/Android)", "Mobile", "Dedicated Sprint", "$8,000", "6 - 12 Weeks"])
ws1.append(["E-Commerce Storefront", "E-Commerce", "Turnkey", "$3,500", "3 - 5 Weeks"])
ws1.append(["Legacy ColdFusion Support", "Maintenance", "Hourly Retainer", "$75/hour", "Ongoing"])
ws1.append(["Enterprise AI Chatbot", "AI Solutions", "Milestone Based", "$6,000", "4 - 6 Weeks"])

# Sheet 2: SLA & Support
ws2 = wb.create_sheet(title="Support_SLA")
ws2.append(["Support Tier", "Coverage Hours", "Guaranteed Response Time", "Included Maintenance Hours"])
ws2.append(["Standard Support", "8x5 Business Hours", "< 24 Hours", "10 Hours / month"])
ws2.append(["Premium Enterprise", "24x7 Critical Support", "< 2 Hours", "30 Hours / month"])

wb.save(xlsx_path)
print(f"Created XLSX: {xlsx_path}")

# 3. Create Sample PDF
# Minimal valid PDF writer using pypdf or minimal stream
pdf_path = DATA_DIR / "sample_overview.pdf"

# A minimal single-page valid PDF with text stream
pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 260 >>
stream
BT
/F1 18 Tf
50 720 Td
(A7 Logics Company Profile and Capability Statement) Tj
/F1 12 Tf
0 -30 Td
(A7 Logics delivers high-performance digital products for global businesses.) Tj
0 -20 Td
(Core values include: Transparency, Agile Delivery, and Code Quality.) Tj
0 -20 Td
(Official Contact: info@a7logics.com | Website: https://a7logics.com/) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000305 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
618
%%EOF
"""
with open(pdf_path, "wb") as f:
    f.write(pdf_content)
print(f"Created PDF: {pdf_path}")
