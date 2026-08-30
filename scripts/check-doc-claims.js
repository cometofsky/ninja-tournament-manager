#!/usr/bin/env node
/**
 * Re-measure the executable claims embedded in this repo's docs.
 *
 * Docs carry measured facts (entry counts, file counts, version pins). They rot
 * silently: tests, lint and build stay green while "33 entries" becomes 34 and
 * the next agent plans against a stale number. No conventional gate can see doc
 * drift. This one can.
 *
 * USAGE:
 *   npm run check:claims
 *   node scripts/check-doc-claims.js
 *   node scripts/check-doc-claims.js --self-test
 *
 * Anchor format — ONE line, an HTML comment (invisible in rendered Markdown),
 * placed next to the prose claim it verifies:
 *
 *   <!-- claim: cmd=`git ls-files 'src/Command/*.php' | wc -l` expect=`22` -->
 *
 * The command is re-run from the repo root; PASS iff trimmed stdout equals
 * `expect` exactly (even when the command exits nonzero — `grep -c` with zero
 * matches exits 1 but still prints the correct `0`). Backticks delimit both
 * fields, which is collision-free BY CONSTRUCTION: the injection guard below
 * bans backticks inside commands, so the delimiter can never occur in a payload.
 *
 * SECURITY — commands here are parsed out of Markdown, i.e. this is an execution
 * surface. The guard is a read-only allowlist per pipe segment plus a
 * forbidden-token scan, and it is deliberately conservative: a forbidden char
 * inside a quoted grep pattern (e.g. searching for `->` or `;`) false-positives
 * as BLOCKED. That is the safe direction — such a claim simply cannot use this
 * format. BLOCKED is a failure, not a skip, so a typo'd or disallowed claim can
 * never silently stop being checked.
 *
 * Exit 0 = every claim holds; 1 = any FAIL, BLOCKED, or malformed anchor.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Anchor discovery
// ---------------------------------------------------------------------------

// A full, well-formed anchor. Anchors must fit on one line — a multi-line
// anchor is reported as malformed rather than silently ignored.
const CLAIM_RE = /<!--\s*claim:\s*cmd=`([^`]+)`\s+expect=`([^`]*)`\s*-->/;
// Anything that *looks* like a claim, so near-misses fail loudly.
const CLAIM_HINT_RE = /<!--\s*claim:/;

function listMarkdownFiles() {
  const files = [];
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const abs = path.join(root, name);
    if (fs.existsSync(abs)) files.push(abs);
  }
  for (const dir of ['.agents/rules', 'docs']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    const stack = [abs];
    while (stack.length > 0) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(entryPath);
        else if (entry.isFile() && entry.name.endsWith('.md')) files.push(entryPath);
      }
    }
  }
  return files.sort();
}

// Returns { claims: [{file, line, cmd, expect}], malformed: [{file, line}] }.
function parseClaims(filePath, content) {
  const claims = [];
  const malformed = [];
  const rel = path.relative(root, filePath);
  content.split('\n').forEach((lineText, index) => {
    const match = lineText.match(CLAIM_RE);
    if (match) {
      claims.push({ file: rel, line: index + 1, cmd: match[1], expect: match[2] });
    } else if (CLAIM_HINT_RE.test(lineText)) {
      malformed.push({ file: rel, line: index + 1 });
    }
  });
  return { claims, malformed };
}

// ---------------------------------------------------------------------------
// Injection guard
// ---------------------------------------------------------------------------

// Substrings never allowed anywhere in a command. `-exec`/`-delete` and friends
// close find's escape hatches; the rest close shell chaining and redirection.
const FORBIDDEN = [
  ';', '&&', '||', '&', '>', '<', '`', '$(', '${', '\n',
  '-exec', '-execdir', '-ok', '-okdir', '-delete', '-fls', '-fprint',
  'sudo',
];

// First word of every pipe segment must be one of these.
const ALLOWED_COMMANDS = new Set([
  'git', 'grep', 'ls', 'find', 'wc', 'head', 'tail', 'cat',
  'sort', 'uniq', 'cut', 'tr', 'sed', 'node', 'php',
]);

// git is allowlisted per subcommand — read-only ones only.
const ALLOWED_GIT_SUBCOMMANDS = new Set([
  'ls-files', 'grep', 'log', 'diff', 'show', 'rev-parse', 'merge-tree',
]);

// Returns null when allowed, otherwise a human-readable reason.
function commandBlockReason(cmd) {
  for (const token of FORBIDDEN) {
    if (cmd.includes(token)) return `forbidden token ${JSON.stringify(token)}`;
  }
  for (const segment of cmd.split('|')) {
    const words = segment.trim().split(/\s+/);
    const program = words[0] || '';
    if (!ALLOWED_COMMANDS.has(program)) {
      return `'${program}' is not in the read-only allowlist`;
    }
    if (program === 'git' && !ALLOWED_GIT_SUBCOMMANDS.has(words[1])) {
      return `git subcommand '${words[1] || ''}' is not read-only allowlisted`;
    }
    // sed edits files with -i; node/php execute arbitrary code unless pinned
    // to their syntax-check modes.
    if (program === 'sed' && words.some((w) => w === '-i' || w.startsWith('--in-place') || /^-[a-zA-Z]*i/.test(w))) {
      return 'sed -i (in-place edit) is not allowed';
    }
    if (program === 'node' && !words.includes('--check') && !words.includes('-c')) {
      return 'node is only allowed with --check';
    }
    if (program === 'php' && !words.includes('-l')) {
      return 'php is only allowed with -l';
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Execution + comparison
// ---------------------------------------------------------------------------

// PASS iff trimmed stdout equals expect — even on nonzero exit, because
// `grep -c` with zero matches exits 1 while printing the correct "0".
function runClaim(cmd, expect) {
  let stdout = '';
  let exitNote = '';
  try {
    stdout = execSync(cmd, {
      cwd: root,
      shell: '/bin/sh',
      timeout: 30000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    stdout = typeof err.stdout === 'string' ? err.stdout : '';
    exitNote = ` (exit ${err.status !== undefined && err.status !== null ? err.status : 'signal'})`;
  }
  const actual = stdout.trim();
  if (actual === expect) return { ok: true };
  const shown = actual === '' ? '<empty>' : actual.length > 200 ? `${actual.slice(0, 200)}…` : actual;
  return { ok: false, detail: `expected \`${expect}\` got \`${shown}\`${exitNote}` };
}

// ---------------------------------------------------------------------------
// Self-test — the runnable check behind the parser, guard and comparison logic
// ---------------------------------------------------------------------------

function selfTest() {
  // Parser: well-formed, expect capture, malformed near-miss.
  const parsed = parseClaims('/x/doc.md', [
    'prose',
    '<!-- claim: cmd=`git ls-files \'src/*.php\' | wc -l` expect=`22` -->',
    '<!-- claim: cmd=`grep \'"php":\' composer.json` expect=`"php": "^7.4",` -->',
    '<!-- claim: cmd=missing-backticks expect=`1` -->',
  ].join('\n'));
  assert.strictEqual(parsed.claims.length, 2, 'parses well-formed anchors');
  assert.strictEqual(parsed.claims[0].cmd, "git ls-files 'src/*.php' | wc -l");
  assert.strictEqual(parsed.claims[1].expect, '"php": "^7.4",');
  assert.strictEqual(parsed.malformed.length, 1, 'near-miss anchors are malformed, not ignored');
  assert.strictEqual(parsed.malformed[0].line, 4, 'malformed anchor reports its line');

  // Guard: the real claim shapes pass…
  for (const good of [
    "git ls-files 'src/Command/*.php' | wc -l",
    'grep -c \': "\\./assets/\' webpack.config.js',
    'grep -A1 \'"name": "symfony/console",\' composer.lock | grep \'"version"\'',
    'php -l src/Kernel.php',
    'node --check webpack.config.js',
  ]) {
    assert.strictEqual(commandBlockReason(good), null, `allows: ${good}`);
  }
  // …and every escape hatch is blocked.
  for (const bad of [
    'rm -rf /',
    'git push origin main',
    'find . -exec rm {} +',
    'find . -delete',
    'echo hi > pwned',
    'cat x; ls',
    'true && ls',
    'wc -l `ls`',
    'wc -l $(ls)',
    'node -e "process.exit(0)"',
    'php -r "echo 1;"',
    "sed -i '' 's/a/b/' AGENTS.md",
    'curl https://example.com',
  ]) {
    assert.notStrictEqual(commandBlockReason(bad), null, `blocks: ${bad}`);
  }

  // Comparison: grep exiting 1 with correct "0" on stdout is a PASS; a wrong
  // value is a FAIL that reports what it saw. Grep this script itself — the
  // one file guaranteed to exist regardless of what repo (if any) cwd is in.
  // The probe token is built at runtime so its literal is NOT in this source;
  // a literal would be found by the grep and silently skip the exit-1 path.
  const absentToken = ['zzz', 'this', 'token', 'is', 'assembled'].join('_');
  // POSIX single-quote escaping. Inside single quotes the shell expands
  // nothing, so this is safe for a path containing $, backticks or spaces —
  // the only character needing care is a single quote, closed and reopened
  // around an escaped one. NOT JSON.stringify: double quotes would still let
  // the shell expand `$(...)` in a checkout path, turning a quoting bug into
  // command execution.
  const selfTarget = `'${__filename.replace(/'/g, "'\\''")}'`;
  assert.strictEqual(runClaim(`grep -c ${absentToken} ${selfTarget}`, '0').ok, true, 'nonzero exit with matching stdout passes');
  const miss = runClaim(`grep -c ${absentToken} ${selfTarget}`, '7');
  assert.strictEqual(miss.ok, false);
  assert.ok(miss.detail.includes('expected `7` got `0`'), 'mismatch reports both values');

  console.log('self-test: all assertions passed');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return 0;
  }

  const results = { pass: 0, fail: 0, blocked: 0, malformed: 0 };
  let claimCount = 0;
  for (const filePath of listMarkdownFiles()) {
    const { claims, malformed } = parseClaims(filePath, fs.readFileSync(filePath, 'utf8'));
    for (const bad of malformed) {
      results.malformed += 1;
      console.error(`MALFORMED ${bad.file}:${bad.line} — looks like a claim but does not parse; fix or remove it`);
    }
    for (const claim of claims) {
      claimCount += 1;
      const where = `${claim.file}:${claim.line}`;
      const blockReason = commandBlockReason(claim.cmd);
      if (blockReason !== null) {
        results.blocked += 1;
        console.error(`BLOCKED ${where} — ${blockReason} (cmd: ${claim.cmd})`);
        continue;
      }
      const outcome = runClaim(claim.cmd, claim.expect);
      if (outcome.ok) {
        results.pass += 1;
        console.log(`PASS ${where} — ${claim.expect}`);
      } else {
        results.fail += 1;
        console.error(`FAIL ${where} — ${outcome.detail}\n     cmd: ${claim.cmd}`);
      }
    }
  }

  if (claimCount === 0 && results.malformed === 0) {
    console.log(`no claim anchors found under ${root} — nothing to check`);
    return 0;
  }
  const broken = results.fail + results.blocked + results.malformed;
  console.log(`summary: ${results.pass} pass, ${results.fail} fail, ${results.blocked} blocked, ${results.malformed} malformed`);
  return broken === 0 ? 0 : 1;
}

process.exit(main());
