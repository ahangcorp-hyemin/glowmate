/* global process, console, fetch, setTimeout, AbortController */
/**
 * DS0 SSR probe 실행기 — REQ-3.
 *
 *   node run-probe.mjs
 *
 * 산출물 (전부 logs/ 아래, 계약 REQ-3 의 "3개 파일"):
 *   logs/build.log    `next build` 원문 출력 + 마지막 줄에 `DS0_PROBE_BUILD_EXIT=<code>`
 *   logs/console.log  브라우저 콘솔 메시지 전량 (production `next start` + development `next dev` 양쪽)
 *   logs/nojs.html    JS 를 **실행하지 않고** HTTP 로 받은 원문 HTML
 *
 * 판정은 이 스크립트가 하지 않는다. 수치는 로그에 남고,
 * `scripts/design-system/validate_ds0.mjs --check ssr` 가 로그를 **다시 파싱**해
 * ssr_probe.md 의 기재값과 대조한다. (요약값을 그대로 믿지 않는다)
 *
 * 하이드레이션 메시지는 production 빌드에서 축약(Minified React error #418 등)되므로
 * development 서버에서도 한 번 더 수집해 합집합을 남긴다 — 미탐을 줄이기 위한 것이다.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGS = path.join(HERE, 'logs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROD_PORT = 3131;
const DEV_PORT = 3132;

mkdirSync(LOGS, { recursive: true });

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: HERE, ...opts });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, '');
}

async function waitForServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 2000);
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: ac.signal });
      clearTimeout(t);
      if (res.ok) return true;
    } catch {
      /* 서버가 아직 안 떴다 — 재시도 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function collectConsole(url, label) {
  const puppeteer = await import('puppeteer-core');
  const browser = await puppeteer.default.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const lines = [];
  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      lines.push(`[${label}][console.${msg.type()}] ${String(msg.text()).replace(/\r?\n/g, '\\n')}`);
    });
    page.on('pageerror', (err) => {
      lines.push(`[${label}][pageerror] ${String(err.message).replace(/\r?\n/g, '\\n')}`);
    });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
    // hydration 은 첫 페인트 이후에 일어난다. 충분히 기다린 뒤 수집을 끝낸다.
    await new Promise((r) => setTimeout(r, 4000));
  } finally {
    await browser.close();
  }
  return lines;
}

/**
 * next 는 서버를 손자 프로세스로 띄운다. 부모만 kill 하면 포트가 물린 채 남아
 * 다음 실행이 조용히 실패한다 — detached 로 띄워 **프로세스 그룹째** 종료한다.
 */
async function startServer(args, port) {
  const child = spawn('npx', args, { cwd: HERE, detached: true });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  const ok = await waitForServer(port, 120_000);
  if (!ok) {
    stopServer(child);
    throw new Error(`서버가 ${port} 에서 뜨지 않았다: npx ${args.join(' ')}`);
  }
  return child;
}

function stopServer(child) {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

// ── 1. build ──────────────────────────────────────────────────────────────
const build = await run('npx', ['next', 'build']);
writeFileSync(
  path.join(LOGS, 'build.log'),
  `# DS0 probe build log — \`npx next build\` (cwd: docs/design-system/DS0/probe)\n` +
    `# 생성: run-probe.mjs\n\n` +
    stripAnsi(build.out).trimEnd() +
    `\n\nDS0_PROBE_BUILD_EXIT=${build.code}\n`,
);
console.log(`build exit=${build.code}`);
if (build.code !== 0) {
  console.error('빌드가 실패했다. 로그를 남기고 중단한다 — 실패를 성공으로 삼키지 않는다.');
  process.exit(1);
}

// ── 2. production 서버: JS 미실행 HTML + 콘솔 ────────────────────────────
const prod = await startServer(['next', 'start', '-p', String(PROD_PORT)], PROD_PORT);
const html = await (await fetch(`http://127.0.0.1:${PROD_PORT}/`)).text();
writeFileSync(path.join(LOGS, 'nojs.html'), html);
console.log(`nojs.html bytes=${html.length}`);
const prodLines = await collectConsole(`http://127.0.0.1:${PROD_PORT}/`, 'production');
stopServer(prod);

// ── 3. development 서버: 축약되지 않은 React 경고 ────────────────────────
const dev = await startServer(['next', 'dev', '-p', String(DEV_PORT)], DEV_PORT);
const devLines = await collectConsole(`http://127.0.0.1:${DEV_PORT}/`, 'development');
stopServer(dev);

// ── 4. 콘솔 로그 기록 ────────────────────────────────────────────────────
writeFileSync(
  path.join(LOGS, 'console.log'),
  `# DS0 probe console log — 브라우저(Chrome headless) 콘솔 메시지 전량\n` +
    `# production = next start -p ${PROD_PORT} / development = next dev -p ${DEV_PORT}\n` +
    `# 생성: run-probe.mjs · 판정 패턴은 verdict_rule.md 의 hydration_patterns 에 잠겨 있다\n`,
);
for (const line of [...prodLines, ...devLines]) {
  appendFileSync(path.join(LOGS, 'console.log'), line + '\n');
}
console.log(`console lines: production=${prodLines.length} development=${devLines.length}`);
process.exit(0);
