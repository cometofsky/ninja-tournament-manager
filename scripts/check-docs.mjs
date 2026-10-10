#!/usr/bin/env node
// Documentation checker from the project-context standard (~/.agents/skills/project-context).
// Checks:
//  1. the basics exist with their exact names, with no case/underscore variants or duplicates;
//  2. CLAUDE.md / GEMINI.md import AGENTS.md, and AGENTS.md carries the managed project-context block;
//  3. every other doc (root *.md, docs/**, specs/**) is reachable from AGENTS.md or README.md,
//     so AI tools know it exists and when to read it;
//  4. specs follow specs/<ID>/product.md + tech.md;
//  5. local Markdown links + anchors resolve with exact filename case and never point at a
//     gitignored path (which breaks in a clean clone); code fences balance;
//  6. the ADR log (INDEX.md rows <-> files, frontmatter, headings);
//  7. the TASKS.md ledger (statuses, owners, dated Done) and development-plan <-> ledger parity.
// Exceptions: docs/.doc-exceptions, one `<glob> <reason>` per line; every one applied is printed.
// It proves structure only — never that a document is factually right.
// Usage: node scripts/check-docs.mjs   (exit 1 on any error)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = []; // [file, message]
const err = (file, msg) => errors.push([file, msg]);
const VENDORED = new Set(['Pods', 'Carthage', 'vendor', 'node_modules', 'third_party', 'third-party', 'bower_components',
  '.dart_tool', 'build', 'dist', 'target', 'bundled', 'graphify-out', 'coverage', 'venv', '.venv']);
const BASICS = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'README.md', 'CONTEXT.md', 'TASKS.md', 'lessons_learned.md',
  'docs/product.md', 'docs/business.md', 'docs/architecture.md', 'docs/development-plan.md', 'docs/adr/INDEX.md', 'docs/wiki/README.md'];
// Files every reader knows by convention; they need no listing to be discoverable.
const KNOWN = /^(LICEN[CS]E[^/]*|CHANGELOG\.md|CONTRIBUTING\.md|CODE_OF_CONDUCT\.md|SECURITY\.md|SUPPORT\.md|README\.[\w-]+\.md|HANDOFF\.md|lessons_learned\.archive\.md|\.codereview\.md)$/;
// Names that duplicate a basic's job when found at the root or top level of docs/.
const DUPLICATE = [
  [/^(project[-_ ]?context|llms?|architecture[-_ ].+|phase[-_ ]?\d+[-_ ]architecture|invariants|ai[-_ ]layer([-_ ]plan)?)\.md$/i, 'docs/architecture.md (design) + docs/development-plan.md (pending work)'],
  [/^(roadmap([-_ ].*)?|plans?|todo|roadmap[-_ ]status|development[-_ ]plan[-_ ].+)\.md$/i, 'docs/development-plan.md + TASKS.md'],
  [/^(features?|product[-_ ].+)\.md$/i, 'docs/product.md'],
  [/^(business[-_ ].+|business[-_ ]model)\.md$/i, 'docs/business.md'],
  [/^(glossary|terms)\.md$/i, 'CONTEXT.md'],
];
const norm = s => s.toLowerCase().replace(/_/g, '-');

// ---- file list: git (respects .gitignore) with a filesystem fallback
let inGit = false; // gitignored-link check only applies when the file list came from git
function listFiles() {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 });
    inGit = true;
    return out.split('\0').filter(Boolean).filter(f => fs.existsSync(path.join(root, f)));
  } catch {
    const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e =>
      e.name === '.git' ? [] : e.isDirectory() ? walk(path.posix.join(dir, e.name)) : [path.posix.join(dir, e.name)]);
    return walk('');
  }
}
// Git's index keeps the old letter case after a case-only rename on case-insensitive disks
// (macOS, Windows), so each path is mapped to its real on-disk spelling.
const dirCache = new Map();
function onDisk(f) {
  let dir = root, out = [];
  for (const part of f.split('/')) {
    if (!dirCache.has(dir)) { try { dirCache.set(dir, fs.readdirSync(dir)); } catch { dirCache.set(dir, []); } }
    const names = dirCache.get(dir);
    const real = names.includes(part) ? part : names.find(n => n.toLowerCase() === part.toLowerCase()) ?? part;
    out.push(real); dir = path.join(dir, real);
  }
  return out.join('/');
}
const allFiles = [...new Set(listFiles().map(onDisk))].filter(f => !f.split('/').some(seg => VENDORED.has(seg)));
// Some repos gitignore their instruction files on purpose; a basic that exists on disk with its
// exact name still counts (and is still read for links and reachability).
for (const b of BASICS) if (!allFiles.includes(b) && onDisk(b) === b && fs.existsSync(path.join(root, b))) allFiles.push(b);
const fileSet = new Set(allFiles);
const dirSet = new Set(allFiles.flatMap(f => f.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))));
// Markdown under dot-directories (.agents/, .claude/, .github/) is tool state: link-checked only if referenced.
const mdFiles = allFiles.filter(f => f.endsWith('.md') && !f.split('/').slice(0, -1).some(s => s.startsWith('.')));
const text = new Map(mdFiles.map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]));
const read = f => text.get(f) ?? (fileSet.has(f) ? fs.readFileSync(path.join(root, f), 'utf8') : '');

// ---- exceptions
const exceptions = [];
const excPath = 'docs/.doc-exceptions';
if (fs.existsSync(path.join(root, excPath))) {
  for (const line of fs.readFileSync(path.join(root, excPath), 'utf8').split('\n')) {
    const m = line.trim().match(/^(\S+)\s+(.+)$/);
    if (!m || m[1].startsWith('#')) continue;
    const re = new RegExp('^' + m[1].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
    exceptions.push({ glob: m[1], reason: m[2], re, used: 0 });
  }
}

// ---- 1. basics, variants, duplicates
for (const b of BASICS) if (!fileSet.has(b)) err(b, 'missing basic doc (exact name and place required)');
const topLevel = allFiles.filter(f => /^[^/]+$/.test(f) || /^docs\/[^/]+$/.test(f) || /^docs\/adr\/[^/]+$/.test(f));
for (const f of topLevel) {
  const dir = path.posix.dirname(f), base = path.posix.basename(f);
  const canonical = BASICS.find(b => path.posix.dirname(b) === dir && norm(path.posix.basename(b)) === norm(base));
  if (canonical && canonical !== f) { err(f, `name variant of ${canonical} — rename to exactly ${canonical}`); continue; }
  if (canonical || !f.endsWith('.md') || dir === 'docs/adr') continue;
  const dup = DUPLICATE.find(([re]) => re.test(base));
  if (dup) err(f, `duplicates a basic doc's job — merge into ${dup[1]}`);
}

// ---- 2. stubs and managed block
for (const s of ['CLAUDE.md', 'GEMINI.md']) {
  if (fileSet.has(s) && read(s).split('\n').find(l => l.trim()) !== '@AGENTS.md') err(s, 'must start with `@AGENTS.md` (AGENTS.md is the single source)');
}
if (fileSet.has('AGENTS.md')) {
  const a = read('AGENTS.md');
  if (!a.includes('<!-- project-context:begin') || !a.includes('<!-- project-context:end -->')) {
    err('AGENTS.md', 'managed project-context block missing — run ~/.agents/skills/project-context/scaffold.sh');
  }
  if (!/^#{2,3} Repo-specific docs/m.test(a)) err('AGENTS.md', 'no "Repo-specific docs" table (`| Doc | Read when |`)');
}

// ---- 4. specs
for (const f of allFiles.filter(f => f.startsWith('specs/') && f.endsWith('.md'))) {
  const parts = f.split('/');
  if (parts[1] === '_template') continue;
  if (parts.length !== 3 || !['product.md', 'tech.md'].includes(parts[2])) err(f, 'specs hold only specs/<ID>/product.md and specs/<ID>/tech.md');
  else {
    const pair = `specs/${parts[1]}/${parts[2] === 'product.md' ? 'tech.md' : 'product.md'}`;
    if (!fileSet.has(pair)) err(f, `spec is missing its pair: ${pair}`);
  }
}

// ---- 5. links, anchors, fences (+ collect references for reachability)
const stripFences = t => t.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
const stripCode = t => stripFences(t).replace(/`[^`\n]*`/g, '');
// GitHub slugs keep inline-code text (only the backticks go), so headings strip fences, not inline code.
const slug = t => t.trim().toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s/g, '-');
function anchors(t) {
  const out = new Set(), counts = new Map();
  for (const m of stripFences(t).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(m[1]), n = counts.get(base) ?? 0;
    out.add(n ? `${base}-${n}` : base); counts.set(base, n + 1);
  }
  for (const m of t.matchAll(/<a\s+(?:id|name)="([^"]+)"\s*>/g)) out.add(m[1]);
  return out;
}
// Exact-case existence for targets outside the git file list (ignored or vendored files).
function existsExact(target) {
  if (target.startsWith('..')) return fs.existsSync(path.join(root, target));
  let dir = root;
  for (const part of target.split('/').filter(Boolean)) {
    let names;
    try { names = fs.readdirSync(dir); } catch { return false; }
    if (!names.includes(part)) return false;
    dir = path.join(dir, part);
  }
  return true;
}
// A malformed %-escape must not abort the whole run; the raw text then fails to resolve and is reported.
const decode = s => { try { return decodeURIComponent(s); } catch { return s; } };
const refs = new Map(); // file -> Set of repo-relative paths it references (files or dirs)
const resolveRef = (from, p) => {
  const clean = decode(p.split('#')[0]).replace(/\/$/, '');
  if (!clean) return null;
  const cands = [path.posix.normalize(path.posix.join(path.posix.dirname(from), clean)), path.posix.normalize(clean.replace(/^\.\//, ''))];
  return cands.find(c => fileSet.has(c) || dirSet.has(c)) ?? null;
};
let links = 0;
for (const [f, t] of text) {
  if ((t.match(/^```/gm) ?? []).length % 2) err(f, 'unbalanced code fences');
  const found = new Set();
  for (const m of stripCode(t).matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const ref = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) continue;
    links++;
    const [name, frag] = ref.split('#');
    const target = name ? path.posix.normalize(path.posix.join(path.posix.dirname(f), decode(name))).replace(/\/$/, '') : f;
    const onDiskOnly = !fileSet.has(target) && !dirSet.has(target);
    if (onDiskOnly && !existsExact(target)) {
      err(f, `missing link target or wrong filename case: ${ref}`);
    } else if (onDiskOnly && inGit && !target.startsWith('..') && !BASICS.includes(target) && !target.split('/').some(seg => VENDORED.has(seg))) {
      err(f, `links to a gitignored path (works here, broken in any clean clone) — link a tracked file or mention it as local-only text: ${ref}`);
    } else {
      found.add(target);
      if (frag && text.has(target) && !anchors(text.get(target)).has(decode(frag))) err(f, `missing anchor: ${ref}`);
    }
  }
  // Plain path mentions (`docs/runbooks/deploy.md`, docs/wiki/) also count as references.
  for (const m of t.matchAll(/(?:^|[\s`(|"'])((?:\.{1,2}\/)?[\w.@-]+(?:\/[\w.@ -]+)*\/?(?:\.md)?)(?=[\s`)|"',:;]|$)/gm)) {
    if (!/\.md$|\/$/.test(m[1]) && !m[1].includes('/')) continue;
    const r = resolveRef(f, m[1]);
    if (r && r !== 'docs' && r !== '.') found.add(r); // a bare docs/ mention lists nothing
  }
  refs.set(f, found);
}

// ---- 3. reachability from AGENTS.md / README.md
const reachable = new Set();
const queue = ['AGENTS.md', 'README.md', ...BASICS].filter(f => fileSet.has(f));
while (queue.length) {
  const f = queue.pop();
  if (reachable.has(f)) continue;
  reachable.add(f);
  for (const r of refs.get(f) ?? []) {
    if (fileSet.has(r)) queue.push(r);
    else for (const g of mdFiles) if (g.startsWith(r + '/')) queue.push(g); // a listed folder covers its files
  }
}
for (const f of mdFiles) {
  const scoped = /^[^/]+\.md$/.test(f) || f.startsWith('docs/') || f.startsWith('specs/');
  if (!scoped || reachable.has(f) || KNOWN.test(path.posix.basename(f)) && !f.includes('/')) continue;
  if (f.startsWith('docs/adr/')) continue; // ADRs are reached through INDEX.md (checked below)
  err(f, 'orphan doc — list it (or its folder) in the AGENTS.md "Repo-specific docs" table with a read-when trigger');
}

// ---- 6. ADR log
const adrFiles = allFiles.filter(f => /^docs\/adr\/\d{4}-.+\.md$/.test(f)).sort();
if (fileSet.has('docs/adr/INDEX.md')) {
  const rows = new Map();
  for (const m of read('docs/adr/INDEX.md').matchAll(/^\|\s*\[(\d{4})\]\(([^)]+)\)\s*\|(.*)\|\s*$/gm)) rows.set(`docs/adr/${m[2]}`, m[3].split('|').map(c => c.trim()));
  const statusOk = s => /^(proposed|accepted|rejected|deprecated|superseded by ADR-\d{4}(, ADR-\d{4})*)$/.test(s);
  for (const f of adrFiles) {
    const t = read(f), n = path.posix.basename(f).slice(0, 4);
    const fm = t.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fm) { err(f, 'missing YAML frontmatter'); continue; }
    const meta = Object.fromEntries(fm[1].split('\n').map(l => l.match(/^([\w-]+):\s*(.*?)\s*(?:#.*)?$/)).filter(Boolean).map(m => [m[1], m[2]]));
    if (!statusOk(meta.status ?? '')) err(f, `invalid status "${meta.status ?? ''}" (proposed | accepted | rejected | deprecated | superseded by ADR-NNNN)`);
    if (!['technical', 'product', 'business'].includes(meta.type)) err(f, 'type must be technical | product | business');
    if (!meta.area) err(f, 'area is empty');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date ?? '')) err(f, 'date must be YYYY-MM-DD');
    if (!('decided-by' in meta)) err(f, 'decided-by field missing');
    else if (meta.status === 'accepted' && !meta['decided-by']) err(f, 'accepted ADR needs decided-by');
    if (!new RegExp(`^# ${n}\\. `, 'm').test(t)) err(f, `heading must be "# ${n}. <title>"`);
    const row = rows.get(f);
    if (!row) err('docs/adr/INDEX.md', `no row for ${path.posix.basename(f)}`);
    else if (row.at(-1) !== meta.status) err('docs/adr/INDEX.md', `status for ${path.posix.basename(f)} is "${row.at(-1)}", file says "${meta.status}"`);
  }
  for (const r of rows.keys()) if (!fileSet.has(r)) err('docs/adr/INDEX.md', `row points at missing ADR ${r}`);
}

// ---- 7. ledger and plan
const ledger = read('TASKS.md'), plan = read('docs/development-plan.md');
// IDs are padded when a formatter aligns the table column (e.g. RM-01 next to REV-001).
const lrows = [...stripCode(ledger).matchAll(/^\| ([A-Z][A-Z0-9]*-\d+) +\| (.+)$/gm)];
const ledgerIds = lrows.map(m => m[1]);
const planIds = [...stripCode(plan).matchAll(/^- \*\*(P\d+-\d+) —/gm)].map(m => m[1]);
const statuses = new Set(['Planned', 'In progress', 'Blocked', 'In review', 'Done']);
for (const [label, ids, f] of [['plan', planIds, 'docs/development-plan.md'], ['ledger', ledgerIds, 'TASKS.md']]) {
  const d = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (d.length) err(f, `duplicate task IDs in ${label}: ${[...new Set(d)].join(', ')}`);
}
for (const r of lrows) {
  const c = r[2].split('|').map(x => x.trim());
  if (!statuses.has(c[1])) err('TASKS.md', `invalid status for ${r[1]}: "${c[1]}"`);
  if (c[1] !== 'Planned' && (!c[2] || c[2] === 'Unassigned')) err('TASKS.md', `active/completed task needs an owner: ${r[1]}`);
  if (c[1] === 'Done' && !/\d{4}-\d{2}-\d{2}/.test(c.at(-2) ?? '')) err('TASKS.md', `Done task needs dated evidence: ${r[1]}`);
}
for (const id of planIds) {
  if (!ledgerIds.includes(id)) err('TASKS.md', `plan task missing from ledger: ${id}`);
  if (!plan.includes(`<a id="${id.toLowerCase()}"></a>`)) err('docs/development-plan.md', `missing task anchor: ${id}`);
}
for (const id of ledgerIds.filter(id => /^P\d+-/.test(id))) if (!planIds.includes(id)) err('TASKS.md', `ledger task missing from plan: ${id}`);
if (/^\s*- \[[ xX]\]/m.test(stripCode(plan))) err('docs/development-plan.md', 'contains status checkboxes; status lives only in TASKS.md');

// ---- report
const kept = errors.filter(([f]) => {
  const e = exceptions.find(x => x.re.test(f));
  if (e) { e.used++; return false; }
  return true;
});
for (const e of exceptions) console.log(`exception: ${e.glob} — ${e.reason} (${e.used} finding${e.used === 1 ? '' : 's'} waived)`);
if (kept.length) {
  console.error(kept.map(([f, m]) => `${f}: ${m}`).join('\n'));
  console.error(`FAIL: ${kept.length} problem(s)`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${text.size} Markdown files, ${links} local links, ${adrFiles.length} ADRs, ${planIds.length} plan tasks, ${ledgerIds.length} ledger entries, ${reachable.size} docs reachable from AGENTS.md/README.md.`);
}
