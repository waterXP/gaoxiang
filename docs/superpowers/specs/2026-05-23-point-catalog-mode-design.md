# Point Catalog Mode Design

## Summary

This design adds a chapter-level point catalog mode to the reader.

When the mode is enabled, the chapter no longer renders its normal page content. Instead, it renders a deduplicated list of point names referenced by that chapter. The list acts like a directory:

- only referenced points are shown
- all non-point content is hidden
- clicking a point opens its standalone point detail view

The catalog must detect points from all currently supported content forms:

- block point references: `{ point: '...' }`
- inline point references inside strings: `{{point:id|label}}`
- point references that appear inside tables

## Goals

- Add a chapter-scoped catalog mode that shows only referenced points.
- Preserve the current chapter rendering behavior when catalog mode is off.
- Support point discovery from block references, inline references, and table content.
- Deduplicate point entries while preserving first-appearance order.
- Reuse existing standalone point navigation instead of creating a new detail route.

## Non-Goals

- No cross-chapter point catalog.
- No change to point authoring syntax.
- No change to point modal semantics.
- No attempt to infer points from plain text that is not an explicit point reference.

## Current Context

The current reader has three relevant pieces:

- [`app/src/utils/renderContent.jsx`](/Users/wenjie/Projects/gaoxiang/app/src/utils/renderContent.jsx:1) renders chapter DSL content and already understands both block point references and inline `{{point:...|...}}` syntax.
- [`app/src/components/ChapterView.jsx`](/Users/wenjie/Projects/gaoxiang/app/src/components/ChapterView.jsx:1) renders either normal chapter pages or a standalone point body.
- [`app/src/App.jsx`](/Users/wenjie/Projects/gaoxiang/app/src/App.jsx:1) owns chapter navigation, standalone point state, and point lookup.

The current system can render point references, but it cannot analyze chapter content into a reusable point index. That analysis needs to be added as a separate capability instead of being mixed into the renderer.

## Recommended Approach

Implement point catalog mode through a dedicated extraction layer plus a simple view switch.

This approach keeps the existing renderer stable and gives the app a reusable utility for finding point references in chapter content.

## Alternatives Considered

### Option 1: Extract From Rendered DOM

Read the rendered article DOM and collect `.point-inline-link` and point block nodes after render.

Pros:

- little apparent data-model work

Cons:

- fragile against markup and styling changes
- hard to cover nested table content reliably
- mixes content analysis with runtime DOM structure
- less testable than a pure content traversal

This option is rejected.

### Option 2: Add A Special Catalog Branch Inside `renderContent`

Teach the renderer to switch into a catalog-only rendering mode.

Pros:

- uses an existing central file

Cons:

- couples traversal, extraction, and rendering
- expands an already complex renderer
- makes later reuse of point extraction harder

This option is rejected.

### Option 3: Add A Dedicated Point Extraction Utility

Traverse chapter `content` recursively and return referenced points in appearance order, then let the chapter view render either normal content or the extracted catalog.

Pros:

- clean separation between content analysis and rendering
- stable and easy to unit test
- works uniformly across paragraphs, lists, tables, and legacy object content

Cons:

- adds one new utility layer

This is the recommended option.

## Data Flow

The new flow is:

1. `App` computes the current chapter pages as it does today.
2. `App` derives the current chapter catalog entries from page `content`.
3. `Toolbar` exposes a catalog mode toggle.
4. `ChapterView` renders one of two modes:
   - normal chapter content
   - point catalog list
5. Clicking a catalog item calls the existing standalone point open handler.

## Extraction Rules

Add a new utility, recommended path:

```txt
app/src/utils/extractChapterPoints.js
```

Primary API:

```js
extractChapterPoints(items, pointMap)
```

Recommended return shape:

```js
[
  { id: 'ch11-1', name: '项目的临时性', source: 'block' },
  { id: 'ch11-2', name: '可交付成果', source: 'inline' },
]
```

Rules:

- Return only explicit point references that can be resolved in `pointMap`.
- Deduplicate by `id`.
- Preserve the order of first appearance in chapter content.
- Prefer `point.name` for display.
- If `point.name` is missing and the reference is inline, fall back to the inline label.
- If both are missing, fall back to `id`.
- Ignore missing point ids instead of rendering broken catalog items.

## Supported Source Forms

The extractor must recurse through all content forms already present in the project.

### Block Point Reference

Detect objects like:

```js
{ point: 'ch11-1', prefix: '1、' }
```

Behavior:

- add `ch11-1` to the result if it exists in `pointMap`
- record `source: 'block'`
- do not recurse into the point body itself

The catalog is a chapter directory of referenced points, not a transitive expansion of point content.

### Inline Point Reference

Parse strings for:

```txt
{{point:ch11-1|项目的临时性}}
```

Behavior:

- add `ch11-1` to the result if it exists in `pointMap`
- record `source: 'inline'`
- keep the first encountered label as fallback display text only if `point.name` is absent

### Table Content

The extractor must walk:

- `headers`
- `rows`
- table cells that are strings
- table cells that are nested arrays
- table cells that are nested legacy objects

This is required because point references may appear inside table cells rather than only in top-level paragraph content.

### Arrays And Legacy Objects

The extractor must recurse through:

- nested arrays used for lists
- legacy objects with `text`
- legacy objects with `parts`
- legacy objects with `items`
- objects with `headers` / `rows`

It must ignore:

- images
- plain styling metadata
- unknown object shapes that do not contain traversable content fields

## UI Changes

### Toolbar

[`app/src/components/Toolbar.jsx`](/Users/wenjie/Projects/gaoxiang/app/src/components/Toolbar.jsx:1) gets a new toggle button, placed alongside the existing reading-mode actions.

Recommended label:

- `目录`

Behavior:

- off by default
- toggles chapter catalog mode on and off
- uses the same active button styling pattern as the existing memo toggle

### Chapter View

[`app/src/components/ChapterView.jsx`](/Users/wenjie/Projects/gaoxiang/app/src/components/ChapterView.jsx:1) gains a third rendering state:

- standalone point view
- normal chapter view
- point catalog view

Catalog view behavior:

- render a single chapter panel body
- do not render normal page blocks
- do not render non-point text
- render a simple list of point names in first-appearance order
- each item is a button
- each button opens standalone point view via the existing point navigation callback

Recommended empty state:

- if a chapter has no referenced points, show `本章暂无知识点目录`

## State Changes

[`app/src/App.jsx`](/Users/wenjie/Projects/gaoxiang/app/src/App.jsx:1) adds a boolean state:

```js
const [pointCatalogMode, setPointCatalogMode] = useState(false)
```

Rules:

- the mode is chapter-scoped UI state, not URL state
- opening standalone point view should not require disabling the mode
- switching books or chapters may keep the mode on; the view should simply recompute the new chapter catalog
- search result navigation should still work as today; catalog mode only changes chapter body rendering

## Navigation Behavior

Clicking a catalog item should call the existing standalone point handler:

```js
onOpenStandalone(pointId)
```

This preserves current point-detail behavior:

- the URL gets `?point=<id>`
- the chapter content area renders that standalone point
- point content still uses the existing renderer

This avoids introducing a second detail-page implementation.

## Error Handling

- Missing point ids are skipped during extraction.
- Duplicate inline references to the same point produce one catalog entry only.
- Inline labels that disagree with `point.name` do not create duplicate entries; `point.name` remains the preferred display text.
- If a chapter mixes block and inline references to the same point, the first occurrence determines order, but the display name still prefers `point.name`.

## Testing

Add test coverage in two layers.

### Extraction Unit Tests

Create unit tests for the new extractor covering:

- block point references
- inline point references
- table cell point references
- nested array and legacy object traversal
- missing point ids
- deduplication by first appearance order
- name fallback behavior

### UI Tests

Extend component/app tests to verify:

- toggling catalog mode hides ordinary chapter text
- catalog mode shows only referenced point names
- clicking a catalog item opens the corresponding standalone point view
- chapters without referenced points show the empty state

## Implementation Notes

- Keep extraction logic out of `renderContent.jsx`.
- Keep the extractor pure and deterministic.
- Reuse existing `pointMap` instead of creating a second lookup structure.
- Reuse the existing `name` field now present on point data as the primary catalog label.

## Open Decisions Resolved

The following product behaviors are fixed by this design:

- Deduplication: yes
- Deduplication order: first appearance order
- Catalog scope: current chapter only
- Catalog target: standalone point view
- Missing point handling: skip
