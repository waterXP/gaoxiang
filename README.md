# 学习网站 — 操作手册

## 目录结构

```
gaoxiang/
├── pipeline.sh              # 一键处理流水线
├── ocr_full.py              # Step 1: PDF → OCR JSON
├── build_site.py            # Step 2: OCR JSON → data.js
├── split_data.js            # Step 3: data.js → 章节 JS 文件
├── ocr_<book_id>.json       # OCR 中间产物（自动生成）
├── site/
│   └── data_<book_id>.js   # 处理后数据（自动生成）
└── app/
    └── src/
        └── data/
            ├── books.js          # 书籍注册表（自动生成）
            ├── types.js          # 内容类型定义（全局共享）
            └── books/
                └── book-001/
                    ├── info.js       # 书籍元数据
                    ├── meta.js       # 章节列表
                    ├── index.js      # 自动生成，勿手动编辑
                    └── chapters/
                        ├── ch_00.js
                        └── ch_XX.js  # 各章节内容
```

---

## 添加新书

### 前提条件

- macOS（OCR 依赖 Apple Vision 框架）
- Python 依赖：`pip install pymupdf pyobjc-framework-Vision pyobjc-framework-Quartz`
- Node.js

### 一键运行

```bash
./pipeline.sh "新书.pdf" book-002 "系统分析师" "2026 重点汇总"
```

四个参数：

| 参数 | 说明 | 示例 |
|------|------|------|
| `pdf路径` | PDF 文件路径 | `"新书.pdf"` |
| `book_id` | 书籍目录名，建议递增 | `book-002` |
| `书名` | 显示在侧边栏的书名 | `"系统分析师"` |
| `副标题` | 可选，显示在书名下方 | `"2026 重点汇总"` |

脚本会自动完成：

1. **OCR 识别** — PDF 每页转图片后用 Vision 识别文字，保存到 `ocr_book-002.json`
2. **结构化处理** — 识别章节分界、提取表格，生成 `site/data_book-002.js`
3. **拆分章节** — 按章节拆成独立 JS 文件，转换为结构化 content 格式，注册到 `books.js`

> OCR 耗时较长（约每页 2-3 秒）。中途中断后重跑会自动断点续跑，已识别的页跳过。

完成后运行 `cd app && npm run build` 重新构建即可。

---

## 手动编辑章节内容

每个章节对应 `app/src/data/books/<book_id>/chapters/ch_XX.js`，可直接编辑。

### 内容格式

每个条目结构：

```js
{
  page: 42,
  type: "重点",       // 重点 | 难点 | 考点 | 定义 | 公式 | 案例 | 普通
  color: "#ff6b6b",  // 可选，留空使用类型默认颜色
  content: [
    { tag: "h2", text: "章节标题" },
    { tag: "h3", text: "小节标题" },
    { tag: "p",  text: "正文段落" },
    { tag: "p",  text: "红色加粗", color: "#f00", bold: true },
    { tag: "p",  bg: "#fff0f0", parts: [
      { text: "普通文字" },
      { text: "高亮文字", color: "#e00", bold: true },
    ]},
    { tag: "ul", items: [
      { text: "列表项一" },
      { text: "重点列表项", bold: true, color: "#c00" },
    ]},
    { tag: "table",
      headers: [{ text: "列A" }, { text: "列B" }],
      rows: [
        [{ text: "单元格1" }, { text: "单元格2" }],
      ]
    },
    { tag: "img", src: "图片路径", alt: "描述" },
  ],
}
```

### 内容类型与颜色

| type | 含义 | 默认颜色 |
|------|------|----------|
| `重点` | 重要考点 | 红色 |
| `难点` | 理解难点 | 橙色 |
| `考点` | 历年真题 | 蓝色 |
| `定义` | 名词定义 | 紫色 |
| `公式` | 计算公式 | 绿色 |
| `案例` | 案例分析 | 青色 |
| `普通` | 普通内容 | 无边框 |

---

## 修改书籍信息

编辑 `app/src/data/books/<book_id>/info.js`：

```js
export default {
  id: 'book-001',
  title: '信息系统项目管理师',
  subtitle: '2026 考试重点汇总 V23.0',
}
```

修改后重新构建：`cd app && npm run build`

---

## 修复章节名称

OCR 自动识别的章节名有时不准确，可直接编辑 `app/src/data/books/<book_id>/meta.js`：

```js
export const chapters = [
  { num: "第一章", title: "第一章 正确的章节名", startPage: 5 },
  ...
]
```

---

## 本地开发

```bash
cd app
npm install
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
```

推送到 `main` 分支后 GitHub Actions 自动部署到 GitHub Pages。
