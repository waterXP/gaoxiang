# Point Extraction And Reference Design

## Summary

This design adds reusable point entities to the reading experience without changing the current chapter-page presentation.

The system will:

- keep chapter rendering visually consistent with the current `.article` page flow
- extract selected knowledge points into chapter-scoped `points` files
- support inline expansion inside chapter content through object references
- support clickable inline references inside strings
- support standalone point viewing through a `?point=<id>` URL entry

## Goals

- Preserve the current chapter reading layout.
- Let important numbered items be extracted into reusable point entities.
- Reuse one content source for:
  - chapter inline expansion
  - modal preview
  - standalone point view
- Keep authoring simple enough for manual maintenance after auto-extraction.

## Non-Goals

- No fully automatic semantic linking across the whole book.
- No attempt to infer point boundaries at runtime.
- No new content DSL for point bodies.
- No per-point file split.

## Current Context

The current reader renders chapter page content through [`app/src/utils/renderContent.jsx`](/Users/chenwenjie/Projects/gaoxiang/app/src/utils/renderContent.jsx:1). The existing content model already supports:

- string DSL paragraphs and headings
- nested lists
- table objects with `headers` and `rows`
- images
- inline emphasis using `[[...]]` and `((...))`

This means point content should continue to use the same DSL instead of introducing a second content format.

## File Layout

Point data lives under each book, parallel to chapter data:

```txt
app/src/data/books/book-001/chapters/
app/src/data/books/book-001/points/ch_11.js
app/src/data/books/book-001/points/ch_12.js
app/src/data/books/book-001/points/index.js
```

Rules:

- One `points/ch_xx.js` file per chapter.
- Each chapter points file exports an array of point objects.
- `points/index.js` aggregates all chapter point files and builds lookup maps.

## Point Data Model

Each point object contains:

```js
{
  id: 'ch11-project-is-temporary',
  content: [
    '项目是为创造独特的产品、服务或成果而进行的临时性工作。（掌握）'
  ]
}
```

Rules:

- `id` is unique across the book.
- `id` should default to `ch11-...` style names generated during extraction.
- `content` continues to use the existing chapter content DSL.
- Point entities do not store chapter numbering such as `1、`.
- Point entities do not store display alias text for inline references in v1.

## Chapter Content Syntax

Two point-related syntaxes are supported in chapter content.

### Inline Expansion Object

This keeps the current chapter presentation unchanged while sourcing content from the point store:

```js
{ point: 'ch11-project-is-temporary', prefix: '1、' }
```

Rules:

- `point` is the target point id.
- `prefix` is optional display text prepended only in chapter inline expansion.
- `prefix` is not limited to numeric values. Examples: `1、`, `（1）`, `①`, `一、`.
- If `prefix` exists, it is rendered before the first visible line of the point content in chapter view only.

### Inline Reference In Strings

This is used when a sentence should contain a clickable point reference:

```txt
{{point:ch11-integrated-change-control|实施整体变更控制}}
```

Rules:

- `point` identifies the reference type.
- the middle segment is the target point id
- the final segment is the visible text
- this syntax can appear in plain paragraph strings, list items, and table cell strings

## Rendering Behavior

### Chapter Inline Expansion

When the renderer encounters:

```js
{ point: 'ch11-project-is-temporary', prefix: '1、' }
```

it should:

1. resolve `pointMap['ch11-project-is-temporary']`
2. render that point's `content` using the same `renderContent` pipeline
3. prepend `prefix` only in the chapter context

This is intended to preserve the visual result of the current chapter page.

### Inline Reference Click

When the renderer encounters:

```txt
{{point:ch11-integrated-change-control|实施整体变更控制}}
```

it should render clickable inline text. Clicking it opens a point modal.

### Modal View

The point modal should:

- render the point body using the same content DSL
- not render chapter `prefix`
- show only the point content for v1
- expose an action to open standalone point view using `?point=<id>`

### Standalone Point View

If the URL contains:

```txt
?point=ch11-integrated-change-control
```

the reader should enter a standalone point view state.

Behavior:

- render only that point's content
- do not show chapter numbering prefix
- keep the view shareable and directly addressable

V1 does not require breadcrumb or chapter-origin metadata in the point entity.

## Point Aggregation

`app/src/data/books/book-001/points/index.js` should export:

```js
export const pointsByChapter = {
  ch_11: ch11Points,
  ch_12: ch12Points,
}

export const pointMap = {
  'ch11-project-is-temporary': { ... },
}
```

Expected structure:

```js
import ch11Points from './ch_11.js'
import ch12Points from './ch_12.js'

export const pointsByChapter = {
  ch_11: ch11Points,
  ch_12: ch12Points,
}

const allPoints = Object.values(pointsByChapter).flat()

export const pointMap = Object.fromEntries(
  allPoints.map(point => [point.id, point])
)
```

Additional rule:

- duplicate point ids must throw during point map construction rather than silently overwrite

## Auto-Extraction Expectations

The initial extraction flow may automatically:

- identify selected numbered point blocks
- move those blocks into `points/ch_xx.js`
- generate conservative ids such as `ch11-project-is-temporary`
- replace the original chapter body with `{ point, prefix }`
- generate initial inline reference text when converting known references

Post-extraction manual editing is explicitly allowed.

Manual editing expectations:

- authors may change point ids later if they also update references
- authors may shorten inline reference display text later
- authors may fine-tune extracted point boundaries later

## Error Handling

### Missing Point Reference

If a chapter references a non-existent point id:

- inline expansion should render a clear visible warning placeholder
- inline string references should render a visible broken-reference marker
- the failure must be obvious in local authoring, not silently ignored

### Duplicate Point Id

If two points share the same `id`:

- `points/index.js` construction should fail immediately

### Invalid Inline Syntax

If a `{{point:...|...}}` token is malformed:

- leave the raw text visible rather than guessing

## Parsing Scope

The renderer must support point references in all existing places where text strings are already supported:

- paragraphs
- headings if needed
- list items
- table cell strings

Object-based inline expansion remains a top-level content item in the content array for v1.

## Recommended Implementation Areas

- extend [`app/src/utils/renderContent.jsx`](/Users/chenwenjie/Projects/gaoxiang/app/src/utils/renderContent.jsx:1) to:
  - detect `{ point, prefix }` objects
  - parse `{{point:id|text}}` inline references
  - route click events for point references
- add point aggregation under `app/src/data/books/book-001/points/`
- extend page or app state to support:
  - active point modal
  - `?point=<id>` URL parsing and syncing

## Testing Requirements

The implementation should include coverage for:

- rendering `{ point, prefix }` inline expansion
- rendering `{{point:id|text}}` clickable inline references
- point content rendering with existing DSL features such as tables and nested lists
- `?point=<id>` standalone view behavior
- missing point reference visibility
- duplicate point id failure
- inline references inside table cells and list items

## Example

### Point File

```js
export default [
  {
    id: 'ch11-project-is-temporary',
    content: [
      '项目是为创造独特的产品、服务或成果而进行的临时性工作。（掌握）'
    ]
  },
  {
    id: 'ch11-integrated-change-control',
    content: [
      'h4:定义、作用',
      '实施整体变更控制是审查所有变更请求、批准变更...',
      {
        headers: ['关注点', '说明'],
        rows: [
          ['变更请求', '需要统一审查'],
          ['沟通', '处理结果要同步']
        ]
      }
    ]
  }
]
```

### Chapter Content

```js
content: [
  'h3:官方教程重点考点：（掌握部分可直接理解记忆）',
  { point: 'ch11-project-is-temporary', prefix: '1、' },
  { point: 'ch11-deliverable-definition', prefix: '2、' },
  '项目执行过程中，经常要做好{{point:ch11-integrated-change-control|实施整体变更控制}}。'
]
```

## Recommendation

This design should be implemented as the initial reusable point system for the reader because it preserves the current reading experience, keeps authoring cost low, and creates a stable foundation for later modal references, standalone point pages, and richer cross-linking.
