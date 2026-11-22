#!/usr/bin/env node
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
  return `${value.toFixed(2).replace('.', ',')} сом`;
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
    const unit =
      Number(item.unitPriceMinor || 0) - Number(item.discountMinor || 0);
    lines.push(`${item.name}`);
    lines.push(`  ${qty} x ${formatSom(unit)} = ${formatSom(qty * unit)}`);
  }
  lines.push('--------------------------------');
  lines.push(`ИТОГО: ${formatSom(payload?.totalMinor || 0)}`);
  lines.push(
    `Оплата: ${payload?.method === 'card' ? 'Безналичные / QR' : 'Наличные'}`,
  );
  lines.push('--------------------------------');
  lines.push('Спасибо за покупку!\n\n\n');
  return lines.join('\n');
}

function formatTsplLabels(payload) {
  const size = payload?.labelSize === '40x30' ? '40 mm,30 mm' : '30 mm,20 mm';
  const items = Array.isArray(payload?.items) ? payload.items : [payload];
  const chunks = [];
  for (const item of items) {
    const copies = Math.max(1, Math.min(100, Number(item.copies || 1)));
    const name = String(item.name || '')
      .replace(/"/g, "'")
      .slice(0, 28);
    const barcode = String(item.shortBarcode || item.barcode || '').replace(
      /"/g,
      '',
    );
    const price = formatSom(item.priceMinor || 0);
    chunks.push(
      [
        `SIZE ${size}`,
        'GAP 2 mm,0 mm',
        'DIRECTION 1',
        'CLS',
        `TEXT 16,14,"2",0,1,1,"${name}"`,
        `BARCODE 16,44,"128",44,1,0,2,2,"${barcode}"`,
        `TEXT 16,112,"2",0,1,1,"${price}"`,
        `PRINT ${copies},1`,
      ].join('\r\n'),
    );
  }
  return chunks.join('\r\n') + '\r\n';
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
    const tmpFile = path.join(os.tmpdir(), `mystore-print-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, data, 'utf8');
    const cleanup = () => {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // ignore
      }
    };
    if (process.platform === 'win32') {
      const target = PRINTER_NAME
        ? `Get-Content -Raw -Encoding UTF8 '${tmpFile}' | Out-Printer -Name '${PRINTER_NAME}'`
        : `Get-Content -Raw -Encoding UTF8 '${tmpFile}' | Out-Printer`;
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
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const job = JSON.parse(body || '{}');
        const data =
          job.kind === 'label'
            ? formatTsplLabels(job.payload)
            : formatReceiptText(job.payload);
        if (PRINTER_HOST) {
          await sendToTcpPrinter(data);
        } else {
          await sendToOsPrinter(data);
        }
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
  console.log(
    `MyStore Print Agent listening on http://127.0.0.1:${PORT} (printer: ${PRINTER_HOST || PRINTER_NAME || 'system default'})`,
  );
});
