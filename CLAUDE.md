# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A study web app for the Chinese IT certification exam **信息系统项目管理师** (Information Systems Project Manager). Built with React + Vite, deployed to GitHub Pages at `/gaoxiang/`.

## Commands

All dev commands run from the `app/` directory:

```bash
cd app
npm install       # Install dependencies
npm run dev       # Start dev server
npm run build     # Build to app/dist/
npm run preview   # Preview production build
```

Data pipeline scripts (run from repo root):

```bash
python build_site.py                                # Process ocr_full_output.json → site/data_<book-id>.js
node split_data.js [book_id] [title] [subtitle]     # Split site/data_<book-id>.js → per-book files + regenerate books.js
# Examples:
#   node split_data.js                              # default: book-001, preserves existing info.js
#   node split_data.js book-002 "系统分析师" "2026 重点汇总"
```

## Architecture

### Data Pipeline

Raw OCR output (`ocr_full_output.json`) → `build_site.py` → `site/data_<book-id>.js` → `split_data.js` → per-chapter JS files in `app/src/data/books/<book-id>/chapters/`.

`split_data.js` also regenerates `app/src/data/books.js` (the book registry). The React app imports all chapter data statically (no runtime fetch). When re-running OCR or adding content, run both pipeline scripts then rebuild.

### App Structure (`app/src/`)

- **`data/books/<book-id>/chapters/ch_XX.js`** — Per-chapter study content. Each exports an array of page objects. Primary files to edit when updating content.
- **`data/books/<book-id>/meta.js`** — Chapter metadata (title, num, startPage). Manually editable to fix chapter names.
- **`data/books/<book-id>/index.js`** — Auto-generated barrel of chapter imports. Do not edit manually.
- **`data/books/<book-id>/info.js`** — Book identity: `id`, `title`, `subtitle`.
- **`data/books.js`** — Auto-generated registry of all books (imports info/meta/index per book). Do not edit manually.
- **`data/types.js`** — Content type definitions with colors/icons: `重点`, `难点`, `考点`, `定义`, `公式`, `案例`, `普通`.
- **`hooks/useStorage.js`** — All user state persisted to `localStorage` under key `'sp'`. Shape: `{ booksDone: { [bookId]: { [chIdx]: 1 } }, streak: { days, last } }`.

### Page Data Format

Each entry in a `ch_XX.js` file:

```js
{
  page: 42,
  type: "重点",   // 类型标签，见下方
  content: [ ... ]  // 内容数组（或用 html 字符串，二选一）
}
```

A page uses either `html` or `content`, not both.

#### `type` values (`data/types.js`)

| value | icon | color |
|---|---|---|
| `重点` | ⭐ | red |
| `难点` | 🔥 | orange |
| `考点` | 📝 | green |
| `定义` | 📖 | blue |
| `公式` | 📐 | purple |
| `案例` | 💼 | cyan |
| `普通` | — | gray |

#### `content` array — String DSL (primary format)

Each element is a string `"[tag][/modifier...]:text"`:

**Tags:**

| string | renders as |
|---|---|
| `"txt:..."` or `"..."` (no tag) | `<p>` |
| `"h1:"` ~ `"h6:"` | heading |
| `"img:path"` | `<img>` |
| `"headers:A::B::C"` | table header row (columns separated by `::`) |
| `"row:A::B::C"` | table data row — consecutive headers+rows auto-combine into `<table>` |

**Modifiers** (between `/` and `:`):

| modifier | effect |
|---|---|
| `im` | red text `#e53935` |
| `hi` | yellow background `#fff176` |
| `bold` | bold |
| `left` / `center` / `right` | text align |

**Array element → `<ul>`** (supports nesting):

```js
["项目1", "txt/im:重要项", ["嵌套A", "嵌套B"]]
```

**Table cell span modifiers** (inside headers/row cells):

```
"cols-2/hi:合并两列"   // colspan=2, yellow bg
"rows-2:跨两行"        // rowspan=2
```

#### `content` array — Object format (legacy, still supported)

```js
{ tag: "h2", text: "标题", bold: true, color: "#f00", bg: "#fef", align: "center" }
{ tag: "p", text: "内容", important: true, highlight: true }
{ tag: "p", parts: [{ text: "红字", color: "#f00" }, "普通"] }
{ tag: "ul", items: ["项1", { text: "项2", bold: true }] }
{ tag: "table", headers: ["A", "B"], rows: [["c1", "c2"]] }
{ tag: "img", src: "路径", alt: "说明" }
```

#### Full example

```js
{
  page: 55,
  type: "考点",
  content: [
    "h2:项目整合管理",
    "txt/hi:整合管理是项目管理的核心",
    ["制定项目章程", "制定项目管理计划", "txt/im:指导与管理项目执行"],
    "headers:过程组::主要输出",
    "row:启动::项目章程",
    "row:规划::项目管理计划",
  ]
}
```

### Key Components

- **`App.jsx`** — Root state: current book index, current chapter index, memo mode, search, streak. Builds Fuse.js search index from all pages when the active book changes.
- **`Sidebar.jsx`** — Book switcher + chapter list with progress tracking and daily check-in button. Collapsible on mobile (toggled by Toolbar).
- **`Toolbar.jsx`** — Search input, streak display, memo mode toggle, sidebar toggle.
- **`ChapterView.jsx`** — Renders a chapter's pages as `PageBlock` components. Memo mode hides `<p>` and `<li>` text until clicked.
- **`SearchPanel.jsx`** — Displays Fuse.js search results; clicking a result navigates to the chapter/page.

### Deployment

Push to `main` triggers GitHub Actions (`.github/workflows/deploy.yml`) which runs `npm ci && npm run build` in `app/` and deploys `app/dist/` to GitHub Pages. The Vite base path is `/gaoxiang/`.
