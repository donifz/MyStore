import { createServer, Socket } from 'node:net';
export type TestMail = { to: string; text: string; raw: string };
// Test-only SMTP receiver; never included in dist (test excluded by tsconfig.build).
export async function startSmtpServer(port = 0, holdReply = false) {
  const messages: TestMail[] = [];
  const sockets = new Set<Socket>();
  const timers = new Set<ReturnType<typeof setInterval>>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost test SMTP\r\n');
    let buffer = '',
      data = false,
      lines: string[] = [],
      recipient = '';
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let p;
      while ((p = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, p);
        buffer = buffer.slice(p + 2);
        if (data) {
          if (line !== '.') {
            lines.push(line.startsWith('..') ? line.slice(1) : line);
            continue;
          }
          data = false;
          const raw = lines.join('\r\n'),
            split = raw.indexOf('\r\n\r\n'),
            headers = raw.slice(0, split),
            body = raw.slice(split + 4);
          let text = body;
          if (/Content-Transfer-Encoding: base64/i.test(headers))
            text = Buffer.from(body.replace(/\s/g, ''), 'base64').toString(
              'utf8',
            );
          else if (/Content-Transfer-Encoding: quoted-printable/i.test(headers))
            text = Buffer.from(
              body
                .replace(/=\r\n/g, '')
                .replace(/=([A-F0-9]{2})/gi, (_, h) =>
                  String.fromCharCode(parseInt(h, 16)),
                ),
              'binary',
            ).toString('utf8');
          messages.push({ to: recipient, text, raw });
          if (holdReply) {
            const timer = setInterval(
              () => socket.write('250-waiting\r\n'),
              3000,
            );
            timers.add(timer);
            socket.once('close', () => {
              clearInterval(timer);
              timers.delete(timer);
            });
          } else socket.write('250 message accepted\r\n');
          lines = [];
          continue;
        }
        if (/^EHLO/i.test(line))
          socket.write('250-localhost\r\n250 8BITMIME\r\n');
        else if (/^HELO/i.test(line)) socket.write('250 localhost\r\n');
        else if (/^MAIL FROM/i.test(line))
          socket.write('250 sender accepted\r\n');
        else if (/^RCPT TO/i.test(line)) {
          recipient = line.match(/<([^>]+)>/)?.[1] || '';
          socket.write('250 recipient accepted\r\n');
        } else if (/^DATA/i.test(line)) {
          data = true;
          socket.write('354 send data\r\n');
        } else if (/^QUIT/i.test(line)) {
          socket.end('221 bye\r\n');
        } else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  return {
    messages,
    port: (server.address() as { port: number }).port,
    close: async () => {
      for (const timer of timers) clearInterval(timer);
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
