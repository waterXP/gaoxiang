#!/usr/bin/env python3
"""Full OCR script - process all 516 pages."""

import fitz
import json
import sys
import time
from pathlib import Path

import Vision
import Quartz
from Foundation import NSData


def ocr_image_with_vision(image_bytes: bytes) -> str:
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
        return ""

    lines = []
    for obs in (request.results() or []):
        candidate = obs.topCandidates_(1)[0]
        if candidate.confidence() > 0.3:
            lines.append(candidate.string())
    return "\n".join(lines)


def process_all(pdf_path: str, output_path: str, resume: bool = True):
    # Load existing progress if resuming
    results = []
    done_pages = set()
    if resume and Path(output_path).exists():
        with open(output_path, "r", encoding="utf-8") as f:
            results = json.load(f)
        done_pages = {r["page"] for r in results}
        print(f"Resuming: {len(done_pages)} pages already done.")

    doc = fitz.open(pdf_path)
    total = len(doc)
    start_time = time.time()

    for i in range(total):
        page_num = i + 1
        if page_num in done_pages:
            continue

        page = doc[i]
        mat = fitz.Matrix(2.0, 2.0)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")

        text = ocr_image_with_vision(img_bytes)
        results.append({"page": page_num, "text": text})

        # Save progress every 10 pages
        if len(results) % 10 == 0 or page_num == total:
            results_sorted = sorted(results, key=lambda x: x["page"])
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(results_sorted, f, ensure_ascii=False, indent=2)

        elapsed = time.time() - start_time
        done_count = len(results)
        avg = elapsed / done_count
        remaining = (total - max(done_pages) - done_count) * avg if done_pages else (total - done_count) * avg
        print(f"  [{page_num}/{total}] {len(text)} chars | ETA: {remaining/60:.1f}min", flush=True)

    doc.close()
    print(f"\nDone! Saved to {output_path}")


if __name__ == "__main__":
    process_all(
        pdf_path="26年重点考点汇总、案例专题、论文专题.pdf",
        output_path="ocr_full_output.json",
        resume=True,
    )
