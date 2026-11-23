export const PRINT_AGENT_JS = `#!/usr/bin/env node
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const PORT = Number(process.env.PRINT_AGENT_PORT || 9191);
const PRINTER_NAME = process.env.PRINTER_NAME || '';
const PRINTER_HOST = process.env.PRINTER_HOST || '';
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

function formatSom(minor) {
  const value = Number(minor || 0) / 100;
  return \`\${value.toFixed(2).replace('.', ',')} сом\`;
}

function formatReceiptText(payload) {
  const lines = [];
  lines.push(String(payload?.shopName || 'MyStore'));
  if (payload?.createdAt) {
    lines.push(new Date(payload.createdAt).toLocaleString('ru-RU'));
  }
  lines.push('--------------------------------');
  const items = Array.isArray(payload?.lines) ? payload.lines : [];
  for (const item of items) {
    const qty = Number(item.quantity || 1);
    const unit = Number(item.unitPriceMinor || 0) - Number(item.discountMinor || 0);
    lines.push(\`\${item.name}\`);
    lines.push(\`  \${qty} x \${formatSom(unit)} = \${formatSom(qty * unit)}\`);
  }
  lines.push('--------------------------------');
  lines.push(\`ИТОГО: \${formatSom(payload?.totalMinor || 0)}\`);
  lines.push(
    \`Оплата: \${payload?.method === 'card' ? 'Безналичные / QR' : 'Наличные'}\`,
  );
  lines.push('--------------------------------');
  lines.push('Спасибо за покупку!\\n\\n\\n');
  return lines.join('\\n');
}

function formatTsplLabels(payload) {
  const size = payload?.labelSize === '58x40' ? '58 mm,40 mm' : '30 mm,20 mm';
  const items = Array.isArray(payload?.items) ? payload.items : [payload];
  const chunks = [];
  for (const item of items) {
    const copies = Math.max(1, Math.min(100, Number(item.copies || 1)));
    const name = String(item.name || '').replace(/"/g, "'").slice(0, 28);
    const barcode = String(item.shortBarcode || item.barcode || '').replace(/"/g, '');
    const price = formatSom(item.priceMinor || 0);
    chunks.push(
      [
        \`SIZE \${size}\`,
        'GAP 2 mm,0 mm',
        'DIRECTION 1',
        'CLS',
        \`TEXT 16,14,"2",0,1,1,"\${name}"\`,
        \`BARCODE 16,44,"128",44,1,0,2,2,"\${barcode}"\`,
        \`TEXT 16,112,"2",0,1,1,"\${price}"\`,
        \`PRINT \${copies},1\`,
      ].join('\\r\\n'),
    );
  }
  return chunks.join('\\r\\n') + '\\r\\n';
}

function sendToTcpPrinter(data) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PRINTER_PORT, PRINTER_HOST, () => {
      socket.end(data, resolve);
    });
    socket.on('error', reject);
  });
}

function sendToOsPrinter(data) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), \`mystore-print-\${Date.now()}.txt\`);
    fs.writeFileSync(tmpFile, data, 'utf8');
    const cleanup = () => {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    };
    if (process.platform === 'win32') {
      const target = PRINTER_NAME
        ? \`Get-Content -Raw -Encoding UTF8 '\${tmpFile}' | Out-Printer -Name '\${PRINTER_NAME}'\`
        : \`Get-Content -Raw -Encoding UTF8 '\${tmpFile}' | Out-Printer\`;
      execFile('powershell', ['-NoProfile', '-Command', target], (err) => {
        cleanup();
        if (err) reject(err);
        else resolve();
      });
    } else {
      const args = PRINTER_NAME ? ['-d', PRINTER_NAME, tmpFile] : [tmpFile];
      execFile('lp', args, (err) => {
        cleanup();
        if (err) reject(err);
        else resolve();
      });
    }
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, printer: PRINTER_NAME || 'default' }));
    return;
  }
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const job = JSON.parse(body || '{}');
        const data = job.kind === 'label' ? formatTsplLabels(job.payload) : formatReceiptText(job.payload);
        if (PRINTER_HOST) await sendToTcpPrinter(data);
        else await sendToOsPrinter(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(err instanceof Error ? err.message : 'Print error');
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(\`MyStore Print Agent listening on http://127.0.0.1:\${PORT}\`);
});
`;

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

export function buildWindowsInstallerBat(): string {
  const b64 = toBase64Utf8(PRINT_AGENT_JS);
  return [
    '@echo off',
    'setlocal',
    'set "DIR=%LOCALAPPDATA%\\MyStorePrintAgent"',
    'if not exist "%DIR%" mkdir "%DIR%"',
    'where node >nul 2>nul',
    'if errorlevel 1 (',
    '  echo Installing Node.js LTS...',
    '  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements',
    '  if errorlevel 1 (',
    '    echo Please install Node.js from https://nodejs.org and re-run this file.',
    '    start https://nodejs.org/',
    '    pause',
    '    exit /b 1',
    '  )',
    ')',
    `powershell -NoProfile -Command "[IO.File]::WriteAllBytes('%DIR%\\print-agent.mjs',[Convert]::FromBase64String('${b64}'))"`,
    'reg add "HKCU\\Software\\Classes\\mystore-print" /ve /d "URL:MyStore Print Agent" /f >nul',
    'reg add "HKCU\\Software\\Classes\\mystore-print" /v "URL Protocol" /d "" /f >nul',
    'reg add "HKCU\\Software\\Classes\\mystore-print\\shell\\open\\command" /ve /d "cmd /c start \\"MyStore Print Agent\\" /min node \\"%DIR%\\print-agent.mjs\\"" /f >nul',
    'echo Starting MyStore Print Agent...',
    'start "MyStore Print Agent" /min node "%DIR%\\print-agent.mjs"',
    'echo Done! You can return to the browser.',
    'timeout /t 2 >nul',
  ].join('\r\n');
}

export function buildMacTerminalCommand(): string {
  const b64 = toBase64Utf8(PRINT_AGENT_JS);
  return `PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" bash -c 'mkdir -p "$HOME/.mystore-print-agent" && node -e "require(\\"fs\\").writeFileSync(process.env.HOME+\\"/.mystore-print-agent/print-agent.mjs\\", Buffer.from(\\"${b64}\\",\\"base64\\"))" && node "$HOME/.mystore-print-agent/print-agent.mjs"'`;
}

export function buildMacInstallerCommand(): string {
  const b64 = toBase64Utf8(PRINT_AGENT_JS);
  return [
    '#!/usr/bin/env bash',
    'set -e',
    'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"',
    'DIR="$HOME/.mystore-print-agent"',
    'mkdir -p "$DIR"',
    'if ! command -v node >/dev/null 2>&1; then',
    '  echo "Node.js is required. Opening https://nodejs.org ..."',
    '  open "https://nodejs.org/" 2>/dev/null || xdg-open "https://nodejs.org/" 2>/dev/null || true',
    '  exit 1',
    'fi',
    `node -e 'require("fs").writeFileSync(process.argv[1], Buffer.from(process.argv[2], "base64"))' "$DIR/print-agent.mjs" "${b64}"`,
    'echo "Starting MyStore Print Agent..."',
    'node "$DIR/print-agent.mjs"',
  ].join('\n');
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
