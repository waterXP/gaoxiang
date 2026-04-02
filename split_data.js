#!/usr/bin/env node
// split_data.js — Splits data.js into per-chapter files for the React app
// Run: node split_data.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dataPath = path.join(__dirname, 'site/data.js');
const outDir = path.join(__dirname, 'app/src/data/chapters');

// Load data.js
const content = fs.readFileSync(dataPath, 'utf8');
// Evaluate to get STUDY_DATA
const fn = new Function(content + '\nreturn STUDY_DATA;');
const { chapters, pages } = fn();

// Group pages by chapterIdx
const pagesByChapter = {};
for (const p of pages) {
  const idx = p.chapterIdx ?? 0;
  if (!pagesByChapter[idx]) pagesByChapter[idx] = [];
  pagesByChapter[idx].push(p);
}

// Write per-chapter files
for (let i = 0; i < chapters.length; i++) {
  const ch = chapters[i];
  const chPages = pagesByChapter[i] || [];
  const filename = `ch_${String(i).padStart(2, '0')}.js`;
  const outPath = path.join(outDir, filename);

  const entries = chPages.map(p => {
    const htmlEscaped = p.html.replace(/`/g, '\\`').replace(/\${/g, '\\${');
    return `  {
    page: ${p.page},
    type: "普通",  // 内容类型: 重点 | 难点 | 考点 | 定义 | 公式 | 案例 | 普通
    // color: "",  // 可选: 自定义颜色 (如 "#ff6b6b")，留空则使用类型默认颜色
    html: \`${htmlEscaped}\`,
  }`;
  }).join(',\n');

  const fileContent = `// ${ch.num} - ${ch.title}
// ================================================================
// 格式说明:
//   type  - 内容类型: 重点 | 难点 | 考点 | 定义 | 公式 | 案例 | 普通
//   color - 可选自定义颜色 (如 "#ff6b6b")，不填则使用类型默认颜色
//   html  - 页面内容 HTML，支持 <h2>, <h3>, <p>, <ul><li>, <table>
//
// 新增条目示例:
//   {
//     page: 999,
//     type: "重点",
//     color: "#ff6b6b",
//     html: \`<h2>标题</h2><p>正文内容</p>\`,
//   },
// ================================================================

export default [
${entries}
];
`;

  fs.writeFileSync(outPath, fileContent, 'utf8');
  process.stdout.write(`  ✓ ${filename}  (${chPages.length} pages)\n`);
}

// Write meta.js
const metaContent = `// 章节元数据 — 手动可编辑
// title: 章节显示名称
// num: 章节编号标识

export const chapters = ${JSON.stringify(chapters, null, 2)};
`;
fs.writeFileSync(path.join(__dirname, 'app/src/data/meta.js'), metaContent, 'utf8');
console.log('\n✓ meta.js written');

// Write index.js
const imports = chapters.map((_, i) => {
  const name = `ch${String(i).padStart(2, '0')}`;
  return `import ${name} from './chapters/ch_${String(i).padStart(2, '0')}.js';`;
}).join('\n');

const exports = chapters.map((_, i) => `  ch${String(i).padStart(2, '0')}`).join(',\n');

const indexContent = `// 数据入口 — 自动生成，无需手动编辑
// 各章节数据请在 chapters/ch_XX.js 中编辑

${imports}

export const allChapterPages = [
${exports}
];
`;
fs.writeFileSync(path.join(__dirname, 'app/src/data/index.js'), indexContent, 'utf8');
console.log('✓ index.js written');

console.log(`\n完成! 共 ${chapters.length} 章, ${pages.length} 页`);
