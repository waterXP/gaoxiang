# Point Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build reusable chapter-scoped point data, inline point expansion, inline point references, modal preview, and `?point=<id>` standalone viewing without changing the current chapter reading layout.

**Architecture:** Point data will live in `app/src/data/books/book-001/points/` and be aggregated through a book-local `pointMap`. Rendering stays centered in `app/src/utils/renderContent.jsx`, which will learn two new point syntaxes: object-based chapter expansion with `{ point, prefix }` and inline string references with `{{point:id|text}}`. App-level state in `app/src/App.jsx` will own point modal and URL syncing so chapter rendering remains mostly declarative.

**Tech Stack:** React 18, Vite 5, existing custom content DSL, Vitest + React Testing Library for the new test harness.

---

## File Structure

### New Files

- `app/src/data/books/book-001/points/ch_11.js`
  Purpose: first real chapter-scoped point dataset used as the seed sample for the feature.
- `app/src/data/books/book-001/points/index.js`
  Purpose: aggregate chapter point arrays into `pointsByChapter` and `pointMap`, and throw on duplicate ids.
- `app/src/components/PointModal.jsx`
  Purpose: render modal preview for a resolved point using the existing content DSL.
- `app/src/utils/pointText.js`
  Purpose: shared text extraction helpers for point-aware search and point fallback labels.
- `app/src/utils/renderContent.test.jsx`
  Purpose: renderer-focused tests for point inline expansion, inline references, tables, and missing references.
- `app/src/App.test.jsx`
  Purpose: app-level tests for URL parsing, modal open flow, and standalone point view behavior.
- `app/vitest.config.js`
  Purpose: Vitest config for jsdom-based component tests.
- `app/vitest.setup.js`
  Purpose: Testing Library setup and DOM helpers.

### Modified Files

- `app/package.json`
  Purpose: add test dependencies and scripts.
- `app/src/App.jsx`
  Purpose: parse `?point=`, sync URL state, expose modal/standalone point view, and make search text extraction point-aware.
- `app/src/components/ChapterView.jsx`
  Purpose: pass point resolution and point click handlers into content rendering.
- `app/src/utils/renderContent.jsx`
  Purpose: support `{ point, prefix }`, `{{point:id|text}}`, and point-aware rendering callbacks.
- `app/src/index.css`
  Purpose: modal and inline point reference styling.

## Task 1: Add A Test Harness

**Files:**
- Modify: `app/package.json`
- Create: `app/vitest.config.js`
- Create: `app/vitest.setup.js`

- [ ] **Step 1: Add failing test dependencies and scripts to `app/package.json`**

Replace the file contents with:

```json
{
  "name": "gx-study",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fuse.js": "^7.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@vitejs/plugin-react": "^4.4.1",
    "jsdom": "^25.0.1",
    "vite": "^5.4.10",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: Add Vitest config in `app/vitest.config.js`**

Create:

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    css: true,
  },
})
```

- [ ] **Step 3: Add setup file in `app/vitest.setup.js`**

Create:

```js
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm install
```

Expected: install completes and `package-lock.json` updates.

- [ ] **Step 5: Run the empty test suite**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm test
```

Expected: Vitest starts successfully and reports `No test files found`, which confirms the harness is wired.

- [ ] **Step 6: Commit the harness**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add app/package.json app/package-lock.json app/vitest.config.js app/vitest.setup.js
git commit -m "test: add vitest harness for point feature"
```

## Task 2: Add Point Data And Aggregation

**Files:**
- Create: `app/src/data/books/book-001/points/ch_11.js`
- Create: `app/src/data/books/book-001/points/index.js`

- [ ] **Step 1: Create the first point dataset in `app/src/data/books/book-001/points/ch_11.js`**

Create:

```js
export default [
  {
    id: 'ch11-project-is-temporary',
    content: [
      '项目是为创造独特的产品、服务或成果而进行的临时性工作。（掌握）',
    ],
  },
  {
    id: 'ch11-deliverable-definition',
    content: [
      '可交付成果是指在某一过程、阶段或项目完成时，必须产出的任何独特并可核实的产品、成果或服务能力。',
    ],
  },
  {
    id: 'ch11-integrated-change-control',
    content: [
      'h4:定义、作用',
      '实施整体变更控制是审查所有变更请求、批准变更，管理对可交付成果、项目文件和项目管理计划的变更，并对变更处理结果进行沟通的过程。',
      {
        headers: ['关注点', '说明'],
        rows: [
          ['变更请求', '需要统一审查'],
          ['沟通', '处理结果要同步'],
        ],
      },
    ],
  },
]
```

- [ ] **Step 2: Create the point index in `app/src/data/books/book-001/points/index.js`**

Create:

```js
import ch11Points from './ch_11.js'

export const pointsByChapter = {
  ch_11: ch11Points,
}

const allPoints = Object.values(pointsByChapter).flat()

const duplicates = allPoints
  .map(point => point.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index)

if (duplicates.length > 0) {
  throw new Error(`Duplicate point ids: ${[...new Set(duplicates)].join(', ')}`)
}

export const pointMap = Object.fromEntries(
  allPoints.map(point => [point.id, point]),
)
```

- [ ] **Step 3: Run a build to verify the new data module parses**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm run build
```

Expected: build passes because the new data files are valid modules even if not yet consumed.

- [ ] **Step 4: Commit the seed point data**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add app/src/data/books/book-001/points/ch_11.js app/src/data/books/book-001/points/index.js
git commit -m "feat: add initial chapter point data"
```

## Task 3: Add Renderer Tests Before Changing The Renderer

**Files:**
- Create: `app/src/utils/renderContent.test.jsx`

- [ ] **Step 1: Write failing renderer tests in `app/src/utils/renderContent.test.jsx`**

Create:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderContent } from './renderContent.jsx'

const pointMap = {
  'ch11-project-is-temporary': {
    id: 'ch11-project-is-temporary',
    content: ['项目是为创造独特的产品、服务或成果而进行的临时性工作。（掌握）'],
  },
  'ch11-integrated-change-control': {
    id: 'ch11-integrated-change-control',
    content: [
      'h4:定义、作用',
      {
        headers: ['关注点', '说明'],
        rows: [['变更请求', '需要统一审查']],
      },
    ],
  },
}

describe('renderContent point support', () => {
  it('renders inline point expansion with prefix', () => {
    render(
      <div>
        {renderContent(
          [{ point: 'ch11-project-is-temporary', prefix: '1、' }],
          { pointMap },
        )}
      </div>,
    )

    expect(
      screen.getByText('1、项目是为创造独特的产品、服务或成果而进行的临时性工作。（掌握）'),
    ).toBeInTheDocument()
  })

  it('renders inline string references as clickable elements', async () => {
    const onPointClick = vi.fn()
    const user = userEvent.setup()

    render(
      <div>
        {renderContent(
          ['项目执行过程中，经常要做好{{point:ch11-integrated-change-control|实施整体变更控制}}。'],
          { pointMap, onPointClick },
        )}
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '实施整体变更控制' }))
    expect(onPointClick).toHaveBeenCalledWith('ch11-integrated-change-control')
  })

  it('renders nested point content with existing DSL support', () => {
    render(
      <div>
        {renderContent(
          [{ point: 'ch11-integrated-change-control', prefix: '2、' }],
          { pointMap },
        )}
      </div>,
    )

    expect(screen.getByText('定义、作用')).toBeInTheDocument()
    expect(screen.getByText('关注点')).toBeInTheDocument()
    expect(screen.getByText('变更请求')).toBeInTheDocument()
  })

  it('shows a visible placeholder when a point id is missing', () => {
    render(
      <div>
        {renderContent(
          [{ point: 'missing-point-id', prefix: '9、' }],
          { pointMap },
        )}
      </div>,
    )

    expect(screen.getByText(/missing point/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the renderer tests to confirm failure**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm test -- renderContent.test.jsx
```

Expected: FAIL because `renderContent` does not yet accept point options or render clickable point references.

- [ ] **Step 3: Commit the failing tests**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add app/src/utils/renderContent.test.jsx
git commit -m "test: add failing point renderer coverage"
```

## Task 4: Implement Point-Aware Rendering

**Files:**
- Modify: `app/src/utils/renderContent.jsx`

- [ ] **Step 1: Extend the inline parser and point helpers in `app/src/utils/renderContent.jsx`**

Add these constants and helpers near the top of the file after the existing `INLINE_RE`:

```jsx
const POINT_INLINE_RE = /\{\{point:([^|}]+)\|([^}]+)\}\}/g

function renderPointBrokenInline(id, key) {
  return (
    <span key={key} className="point-inline-broken">
      [missing point: {id}]
    </span>
  )
}

function renderPointReference(id, text, key, onPointClick, pointMap) {
  if (!pointMap?.[id]) {
    return renderPointBrokenInline(id, key)
  }

  return (
    <button
      key={key}
      type="button"
      className="point-inline-link"
      onClick={() => onPointClick?.(id)}
    >
      {text}
    </button>
  )
}
```

- [ ] **Step 2: Replace `renderInline` with a point-aware version**

Replace the current `renderInline` function with:

```jsx
function renderInline(str, options = {}) {
  const { pointMap, onPointClick } = options
  if (!str || typeof str !== 'string') return str

  const tokenRe = /\[\[(.*?)\]\]|\(\((.*?)\)\)|\{\{point:([^|}]+)\|([^}]+)\}\}/g
  if (!tokenRe.test(str)) return str
  tokenRe.lastIndex = 0

  const parts = []
  let last = 0
  let match
  let key = 0

  while ((match = tokenRe.exec(str)) !== null) {
    if (match.index > last) {
      parts.push(str.slice(last, match.index))
    }

    if (match[1] !== undefined) {
      parts.push(
        <span key={key++} style={{ background: '#fff176' }}>
          {match[1]}
        </span>,
      )
    } else if (match[2] !== undefined) {
      parts.push(
        <span key={key++} style={{ color: '#e53935' }}>
          {match[2]}
        </span>,
      )
    } else {
      parts.push(
        renderPointReference(match[3], match[4], key++, onPointClick, pointMap),
      )
    }

    last = match.index + match[0].length
  }

  if (last < str.length) {
    parts.push(str.slice(last))
  }

  return parts
}
```

- [ ] **Step 3: Thread renderer options through `renderText`, table cells, list items, and old object rendering**

Make these targeted replacements:

1. Replace `function renderText(text) {` with:

```jsx
function renderText(text, options = {}) {
```

2. Replace both `renderInline(...)` calls inside `renderText` with `renderInline(..., options)`.

3. Replace `function renderTableObj(tbl, key) {` with:

```jsx
function renderTableObj(tbl, key, options = {}) {
```

4. Inside `renderTableObj`, replace both `renderText(...)` calls with `renderText(..., options)` and replace `renderUl(cell)` with `renderUl(cell, undefined, options)`.

5. Replace `function renderUl(items, key) {` with:

```jsx
function renderUl(items, key, options = {}) {
```

6. Inside `renderUl`, replace:

```jsx
return <li key={j}>{renderUl(item)}</li>
```

with:

```jsx
return <li key={j}>{renderUl(item, undefined, options)}</li>
```

and replace:

```jsx
return <li key={j} style={node.style}>{renderText(node.content)}</li>
```

with:

```jsx
return <li key={j} style={node.style}>{renderText(node.content, options)}</li>
```

and replace:

```jsx
return <li key={j} style={s}>{renderText(item.text)}</li>
```

with:

```jsx
return <li key={j} style={s}>{renderText(item.text, options)}</li>
```

7. Replace `function renderCell(cell) {` with:

```jsx
function renderCell(cell, options = {}) {
```

and thread `options` through both `renderText` calls.

8. Replace `function renderObj(obj, i) {` with:

```jsx
function renderObj(obj, i, options = {}) {
```

and thread `options` through every `renderText`, `renderParts`, `renderUl`, and `renderCell` call inside `renderObj`.
```

- [ ] **Step 4: Add point expansion support to the main renderer**

In `app/src/utils/renderContent.jsx`, replace the exported function with:

```jsx
function renderPointBlock(item, key, options = {}) {
  const point = options.pointMap?.[item.point]
  if (!point) {
    return (
      <p key={key} className="point-block-missing">
        [missing point: {item.point}]
      </p>
    )
  }

  const content = item.prefix
    ? point.content.map((entry, index) => {
        if (index !== 0 || typeof entry !== 'string') return entry
        return `${item.prefix}${entry}`
      })
    : point.content

  return (
    <div key={key} className="point-block">
      {renderContent(content, options)}
    </div>
  )
}

export function renderContent(content, options = {}) {
  return group(content).map((g, i) => {
    if (g.kind === 'ul') return renderUl(g.items, i, options)
    if (g.kind === 'table-obj') return renderTableObj(g.tbl, i, options)
    if (g.kind === 'obj') {
      if (g.item && typeof g.item === 'object' && g.item.point) {
        return renderPointBlock(g.item, i, options)
      }
      return renderObj(g.item, i, options)
    }
    if (g.kind === 'node') {
      const { tag, content: text, style } = g.node
      if (/^h[1-6]$/.test(tag)) {
        const H = tag
        return <H key={i} style={style}>{renderText(text, options)}</H>
      }
      if (tag === 'p') return <p key={i} style={style}>{renderText(text, options)}</p>
      if (tag === 'img') return <img key={i} src={text} alt="" style={{ maxWidth: '100%', borderRadius: 4 }} />
      return null
    }
    if (g.kind === 'table') {
      const { tbl } = g
      return (
        <table key={i}>
          {tbl.headers && (
            <thead>
              <tr>{tbl.headers.map((h, j) => <th key={j}>{renderText(h, options)}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {tbl.rows.map((row, j) => (
              <tr key={j}>
                {row.map((cell, k) => <td key={k}>{renderText(cell, options)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    return null
  })
}
```

- [ ] **Step 5: Run the renderer tests**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm test -- renderContent.test.jsx
```

Expected: PASS with four passing renderer tests.

- [ ] **Step 6: Run a production build**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm run build
```

Expected: build passes with the updated renderer.

- [ ] **Step 7: Commit the renderer implementation**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add app/src/utils/renderContent.jsx
git commit -m "feat: add point-aware content rendering"
```

## Task 5: Add Shared Point Text Extraction

**Files:**
- Create: `app/src/utils/pointText.js`
- Modify: `app/src/App.jsx`

- [ ] **Step 1: Create point-aware text helpers in `app/src/utils/pointText.js`**

Create:

```js
function normalizeInlineText(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\[\[(.*?)\]\]/g, '$1')
    .replace(/\(\((.*?)\)\)/g, '$1')
    .replace(/\{\{point:([^|}]+)\|([^}]+)\}\}/g, '$2')
}

export function extractContentText(items, pointMap = {}) {
  if (!Array.isArray(items)) return ''

  return items.map(item => {
    if (typeof item === 'string') {
      return normalizeInlineText(item)
    }

    if (Array.isArray(item)) {
      return extractContentText(item, pointMap)
    }

    if (!item || typeof item !== 'object') {
      return ''
    }

    if (item.point) {
      const point = pointMap[item.point]
      if (!point) return ''
      const prefix = item.prefix || ''
      return `${prefix}${extractContentText(point.content, pointMap)}`
    }

    if (item.text) {
      return normalizeInlineText(item.text)
    }

    if (item.parts) {
      return item.parts.map(part => typeof part === 'string' ? part : part.text || '').join(' ')
    }

    if (item.items) {
      return extractContentText(item.items, pointMap)
    }

    if (item.rows) {
      return item.rows.flat().map(cell => {
        if (typeof cell === 'string') return normalizeInlineText(cell)
        return cell?.text || ''
      }).join(' ')
    }

    return ''
  }).join(' ')
}
```

- [ ] **Step 2: Replace the local `extractText` logic in `app/src/App.jsx`**

At the top of `app/src/App.jsx`, add:

```js
import { pointMap } from './data/books/book-001/points/index.js'
import { extractContentText } from './utils/pointText.js'
```

Then replace the current local `extractText` function with:

```js
function extractText(p) {
  if (p.text) return p.text
  if (p.html) return p.html.replace(/<[^>]+>/g, ' ')
  if (p.content) {
    return extractContentText(p.content, pointMap)
  }
  return ''
}
```

- [ ] **Step 3: Run the renderer tests again to catch regressions**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm test -- renderContent.test.jsx
```

Expected: PASS.

- [ ] **Step 4: Commit the shared text helper**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add app/src/utils/pointText.js app/src/App.jsx
git commit -m "feat: make search text extraction point-aware"
```

## Task 6: Add App-Level Point Modal And URL State Tests

**Files:**
- Create: `app/src/App.test.jsx`

- [ ] **Step 1: Write failing app tests in `app/src/App.test.jsx`**

Create:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

vi.mock('./hooks/useStorage.js', () => ({
  useStorage: () => ({
    state: {},
    update: vi.fn(),
  }),
}))

describe('App point interactions', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('opens a point modal from an inline point reference', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByText('第十一章 项目管理概论'))
    await user.click(screen.getByRole('button', { name: '实施整体变更控制' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('定义、作用')).toBeInTheDocument()
  })

  it('renders standalone point view from the query string', async () => {
    window.history.replaceState(
      null,
      '',
      '/?book=book-001&ch=10&point=ch11-integrated-change-control',
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('定义、作用')).toBeInTheDocument()
    })

    expect(screen.queryByText('第十一章 项目管理概论')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the app tests to confirm failure**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm test -- App.test.jsx
```

Expected: FAIL because App does not yet provide point modal state or `?point=` standalone rendering.

- [ ] **Step 3: Commit the failing app tests**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add app/src/App.test.jsx
git commit -m "test: add failing app coverage for point flows"
```

## Task 7: Implement Modal, URL State, And Chapter Wiring

**Files:**
- Create: `app/src/components/PointModal.jsx`
- Modify: `app/src/App.jsx`
- Modify: `app/src/components/ChapterView.jsx`
- Modify: `app/src/index.css`

- [ ] **Step 1: Create the modal component in `app/src/components/PointModal.jsx`**

Create:

```jsx
import { renderContent } from '../utils/renderContent.jsx'

export default function PointModal({ point, onClose, onOpenStandalone }) {
  if (!point) return null

  return (
    <div className="point-modal-backdrop" onClick={onClose}>
      <div
        className="point-modal"
        role="dialog"
        aria-modal="true"
        aria-label="知识点详情"
        onClick={event => event.stopPropagation()}
      >
        <div className="point-modal-actions">
          <button type="button" onClick={() => onOpenStandalone(point.id)}>
            单独查看
          </button>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="point-modal-content">
          {renderContent(point.content)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Thread point state and query parsing through `app/src/App.jsx`**

Make these targeted changes:

1. Add the imports:

```js
import PointModal from './components/PointModal.jsx'
import { pointMap } from './data/books/book-001/points/index.js'
```

2. Replace `getInitialNav()` with:

```js
function getInitialNav() {
  const params = new URLSearchParams(window.location.search)
  const bookId = params.get('book')
  const chParam = params.get('ch')
  const pointId = params.get('point')
  const bookIdx = bookId ? Math.max(0, books.findIndex(b => b.id === bookId)) : 0
  const chIdx = chParam !== null ? Math.max(0, parseInt(chParam, 10) || 0) : 0
  return { bookIdx, chIdx, pointId }
}
```

3. Replace:

```js
const { bookIdx: initBookIdx, chIdx: initChIdx } = getInitialNav()
```

with:

```js
const { bookIdx: initBookIdx, chIdx: initChIdx, pointId: initPointId } = getInitialNav()
```

4. Add point state next to the existing state hooks:

```js
const [activePointId, setActivePointId] = useState(initPointId)
```

5. Replace the URL sync effect with:

```js
useEffect(() => {
  const params = new URLSearchParams()
  params.set('book', curBook.id)
  params.set('ch', String(curChIdx))
  if (activePointId) {
    params.set('point', activePointId)
  }
  history.replaceState(null, '', `${window.location.pathname}?${params}`)
}, [activePointId, curBook.id, curChIdx])
```

6. Add these handlers before `showSearch`:

```js
const activePoint = activePointId ? pointMap[activePointId] || null : null
const standalonePointView = Boolean(activePointId && activePoint)

const handleOpenPoint = useCallback((pointId) => {
  setActivePointId(pointId)
}, [])

const handleClosePoint = useCallback(() => {
  setActivePointId(null)
}, [])
```

7. In `handleSelectResult`, after `setScrollToPage(page)`, add:

```js
setActivePointId(null)
```

8. In `handleSelectBook`, after `setSearchResults([])`, add:

```js
setActivePointId(null)
```

9. In the render branch, replace the `ChapterView` block with:

```jsx
<ChapterView
  chapter={chapters[curChIdx]}
  pages={curPages}
  curChIdx={curChIdx}
  totalChapters={chapters.length}
  done={!!done[curChIdx]}
  onToggleDone={handleToggleDone}
  onPrev={() => {
    setCurChIdx(i => i - 1)
    setActivePointId(null)
  }}
  onNext={() => {
    setCurChIdx(i => i + 1)
    setActivePointId(null)
  }}
  memoMode={memoMode}
  scrollToPage={scrollToPage}
  pointMap={pointMap}
  onPointClick={handleOpenPoint}
  standalonePoint={standalonePointView ? activePoint : null}
/>
```

10. After the main layout content, render the modal:

```jsx
{activePoint && !standalonePointView ? (
  <PointModal
    point={activePoint}
    onClose={handleClosePoint}
    onOpenStandalone={setActivePointId}
  />
) : null}
```

- [ ] **Step 3: Make `ChapterView` point-aware in `app/src/components/ChapterView.jsx`**

Change the `PageBlock` signature to:

```jsx
function PageBlock({ page, memoMode, pointMap, onPointClick }) {
```

Replace:

```jsx
{page.content ? renderContent(page.content) : null}
```

with:

```jsx
{page.content ? renderContent(page.content, { pointMap, onPointClick }) : null}
```

Change the `ChapterView` export signature to:

```jsx
export default function ChapterView({
  chapter, pages, curChIdx, totalChapters, done, onToggleDone,
  onPrev, onNext, memoMode, scrollToPage, pointMap, onPointClick, standalonePoint,
}) {
```

Inside the `article` block, replace the `pages.map` with:

```jsx
{standalonePoint ? (
  <div className="page-block type-普通" data-page="point">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span className="page-marker">知识点</span>
    </div>
    {renderContent(standalonePoint.content, { pointMap, onPointClick })}
  </div>
) : pages.map((p, i) => (
  <PageBlock
    key={`${p.page}-${i}`}
    page={p}
    memoMode={memoMode}
    pointMap={pointMap}
    onPointClick={onPointClick}
  />
))}
```

- [ ] **Step 4: Add point styles in `app/src/index.css`**

Append:

```css
.point-inline-link {
  border: 0;
  background: none;
  color: #1565c0;
  cursor: pointer;
  padding: 0;
  font: inherit;
  text-decoration: underline;
}

.point-inline-broken,
.point-block-missing {
  color: #c62828;
  font-weight: 600;
}

.point-block {
  display: block;
}

.point-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 200;
}

.point-modal {
  width: min(820px, 100%);
  max-height: min(85vh, 900px);
  overflow: auto;
  background: #fffdf8;
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.2);
  padding: 20px 24px 28px;
}

.point-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 16px;
}
```

- [ ] **Step 5: Run app and renderer tests**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm test -- renderContent.test.jsx App.test.jsx
```

Expected: PASS with all renderer and app tests green.

- [ ] **Step 6: Run a production build**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm run build
```

Expected: build passes.

- [ ] **Step 7: Commit the point interaction flow**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add app/src/App.jsx app/src/components/ChapterView.jsx app/src/components/PointModal.jsx app/src/index.css
git commit -m "feat: add point modal and standalone point view"
```

## Task 8: Convert One Real Chapter To Use Points

**Files:**
- Modify: `app/src/data/books/book-001/chapters/ch_11.js`

- [ ] **Step 1: Find the first numbered “官方教程重点考点” block in `app/src/data/books/book-001/chapters/ch_11.js`**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
rg -n "官方教程重点考点|1、|2、" app/src/data/books/book-001/chapters/ch_11.js
```

Expected: locate the concrete text block that will become the first real point-backed chapter sample.

- [ ] **Step 2: Replace the first two extracted numbered strings with point expansion objects**

Update the matching content block so the original raw strings:

```js
'1、项目是为创造独特的产品、服务或成果而进行的临时性工作。（掌握）',
'2、可交付成果是指在某一过程、阶段或项目完成时，必须产出的任何独特并可核实的产品、成果或服务能力。',
```

become:

```js
{ point: 'ch11-project-is-temporary', prefix: '1、' },
{ point: 'ch11-deliverable-definition', prefix: '2、' },
```

Also replace one nearby plain sentence containing “实施整体变更控制” with:

```js
'项目执行过程中，经常要做好{{point:ch11-integrated-change-control|实施整体变更控制}}。'
```

- [ ] **Step 3: Run focused tests and build**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm test -- renderContent.test.jsx App.test.jsx
npm run build
```

Expected: all tests and build pass with real data conversion in place.

- [ ] **Step 4: Manually verify the chapter in the browser**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm run dev
```

Then verify:

- chapter 11 still shows the numbered items inline
- the inline reference opens the modal
- the modal can open standalone point view
- `?point=ch11-integrated-change-control` loads direct point view

- [ ] **Step 5: Commit the real chapter conversion**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add app/src/data/books/book-001/chapters/ch_11.js
git commit -m "feat: convert chapter 11 sample points"
```

## Task 9: Final Verification

**Files:**
- Modify: none expected

- [ ] **Step 1: Run the full test suite**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang/app
npm run build
```

Expected: build succeeds without warnings that block release.

- [ ] **Step 3: Review git status**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git status --short
```

Expected: clean working tree.

- [ ] **Step 4: Create the final integration commit if any verification fixes were needed**

Run:

```bash
cd /Users/chenwenjie/Projects/gaoxiang
git add -A
git commit -m "chore: finalize point extraction feature"
```

Expected: only needed if verification required a last adjustment.

## Spec Coverage Check

- File layout: covered by Tasks 2 and 8.
- Point data model: covered by Tasks 2 and 8.
- `{ point, prefix }`: covered by Tasks 3, 4, and 8.
- `{{point:id|text}}`: covered by Tasks 3, 4, and 8.
- Modal preview: covered by Tasks 6 and 7.
- `?point=<id>` standalone view: covered by Tasks 6 and 7.
- Duplicate id failure: covered by Task 2.
- Missing point visibility: covered by Tasks 3 and 4.
- Search extraction compatibility: covered by Task 5.
- Real chapter sample conversion: covered by Task 8.

## Placeholder Scan

- No `TBD`, `TODO`, or deferred implementation markers remain.
- Every task names exact files.
- Every code step contains concrete code to write.
- Every verification step includes exact commands and expected outcomes.

## Type Consistency Check

- Object expansion syntax is consistently `{ point, prefix }`.
- Inline reference syntax is consistently `{{point:id|text}}`.
- Standalone URL key is consistently `point`.
- Point lookup source is consistently `pointMap`.
