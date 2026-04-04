#!/bin/bash
# pipeline.sh — 完整数据处理流水线
#
# 用法:
#   ./pipeline.sh <pdf路径> <book_id> <书名> [副标题]
#
# 示例:
#   ./pipeline.sh "新书.pdf" book-002 "系统分析师" "2026 重点汇总"
#   ./pipeline.sh "book.pdf" book-001 "信息系统项目管理师" "2026 考试重点汇总 V23.0"
#
# 说明:
#   如果 ocr_{book_id}.json 已存在则跳过 OCR（支持断点续跑）

set -e  # 任意步骤失败则退出

PDF="$1"
BOOK_ID="$2"
TITLE="$3"
SUBTITLE="$4"

# ── 参数校验 ──────────────────────────────────────────────────────
if [ -z "$PDF" ] || [ -z "$BOOK_ID" ] || [ -z "$TITLE" ]; then
  echo "用法: ./pipeline.sh <pdf路径> <book_id> <书名> [副标题]"
  echo "示例: ./pipeline.sh \"新书.pdf\" book-002 \"系统分析师\" \"2026 重点汇总\""
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OCR_OUTPUT="$SCRIPT_DIR/ocr_${BOOK_ID}.json"

echo "========================================"
echo "  书籍 ID : $BOOK_ID"
echo "  书名    : $TITLE"
echo "  副标题  : $SUBTITLE"
echo "  PDF     : $PDF"
echo "========================================"

# ── Step 1: OCR ───────────────────────────────────────────────────
echo ""
echo "[ 1/3 ] OCR 识别..."
if [ -f "$OCR_OUTPUT" ]; then
  echo "  已找到 $OCR_OUTPUT，断点续跑"
fi
python "$SCRIPT_DIR/ocr_full.py" "$PDF" "$BOOK_ID"

# ── Step 2: 生成 data.js ──────────────────────────────────────────
echo ""
echo "[ 2/3 ] 生成 site/data_${BOOK_ID}.js..."
python "$SCRIPT_DIR/build_site.py" "$BOOK_ID"

# ── Step 3: 拆分 + 转换 ───────────────────────────────────────────
echo ""
echo "[ 3/3 ] 拆分章节 + 转换为 content 格式..."
node "$SCRIPT_DIR/split_data.js" "$BOOK_ID" "$TITLE" "$SUBTITLE"

echo ""
echo "========================================"
echo "  全部完成！"
echo "  数据位于: app/src/data/books/$BOOK_ID/"
echo "========================================"
