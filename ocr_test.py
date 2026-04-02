#!/usr/bin/env python3
"""OCR test script - process first 3 pages to verify quality."""

import fitz  # pymupdf
import json
import sys
from pathlib import Path

# Apple Vision OCR
import Vision
import Quartz
from Foundation import NSData


def ocr_image_with_vision(image_bytes: bytes) -> str:
    """Use Apple Vision to OCR an image, returning extracted text."""
    ns_data = NSData.dataWithBytes_length_(image_bytes, len(image_bytes))
    cg_image_source = Quartz.CGImageSourceCreateWithData(ns_data, None)
    cg_image = Quartz.CGImageSourceCreateImageAtIndex(cg_image_source, 0, None)

    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLanguages_(["zh-Hans", "zh-Hant", "en-US"])
    request.setUsesLanguageCorrection_(True)
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, {})
    success, error = handler.performRequests_error_([request], None)

    if not success:
        print(f"  Vision error: {error}", file=sys.stderr)
        return ""

    lines = []
    for obs in (request.results() or []):
        text, confidence = obs.topCandidates_(1)[0].string(), obs.topCandidates_(1)[0].confidence()
        if confidence > 0.3:
            lines.append(text)
    return "\n".join(lines)


def process_pdf(pdf_path: str, start_page: int = 0, end_page: int = 3) -> list[dict]:
    """Convert PDF pages to images and OCR them."""
    doc = fitz.open(pdf_path)
    total = len(doc)
    end_page = min(end_page, total)
    print(f"PDF has {total} pages. Processing pages {start_page+1}–{end_page}...")

    results = []
    for i in range(start_page, end_page):
        page = doc[i]
        # Render at 2x resolution for better OCR accuracy
        mat = fitz.Matrix(2.0, 2.0)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")

        print(f"  OCR page {i+1}/{total}...", end=" ", flush=True)
        text = ocr_image_with_vision(img_bytes)
        print(f"got {len(text)} chars")

        results.append({"page": i + 1, "text": text})

    doc.close()
    return results


if __name__ == "__main__":
    pdf_file = "26年重点考点汇总、案例专题、论文专题.pdf"
    pages = process_pdf(pdf_file, start_page=0, end_page=3)

    output_file = "ocr_test_output.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to {output_file}")
    print("\n--- Page 1 preview (first 500 chars) ---")
    if pages:
        print(pages[0]["text"][:500])
