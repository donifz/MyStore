import { DataSource } from 'typeorm';
import { EmailWorker, EmailTransport, stopEmailWorker } from './email-worker';
import { EmailQueueService } from './email-queue.service';
import { EventEmailService } from './event-email.service';
import { createEmailTransport } from './email-transport';
import { readEmailConfig } from './email-config';
export class EmailRunner {
  private readonly worker: EmailWorker;
  private readonly events: EventEmailService;
  private running: Promise<void> | null = null;
  private stopped = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    db: DataSource,
    private readonly transport: EmailTransport & { close(): void },
  ) {
    this.worker = new EmailWorker(db, transport);
    this.events = new EventEmailService(db, new EmailQueueService(db));
  }
  tick(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        await this.events.expandBatch();
      } catch {
        console.error('Email event expansion failed');
      }
      if (!this.stopped) await this.worker.tick();
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  start() {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => {
      void this.tick().catch(() => console.error('Email processing failed'));
    }, 5000);
    void this.tick().catch(() => console.error('Email processing failed'));
  }
  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try {
      await stopEmailWorker(this.worker, this.running);
    } finally {
      this.transport.close();
    }
  }
}
export function startInlineEmail(db: DataSource): EmailRunner | null {
  if (
    process.env.EMAIL_WORKER_MODE !== 'inline' ||
    process.env.EMAIL_ENABLED !== 'true'
  )
    return null;
  try {
    if (!readEmailConfig().enabled) return null;
    const runner = new EmailRunner(db, createEmailTransport());
    runner.start();
    return runner;
  } catch {
    console.error('Inline email disabled: check email configuration');
    return null;
  }
}
