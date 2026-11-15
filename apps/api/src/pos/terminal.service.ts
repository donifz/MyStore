import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';

export type TerminalSettings = {
  paymentQrData: string | null;
  paymentQrLabel: string;
  showQrOnCheckout: boolean;
  printQrOnReceipt: boolean;
  paperWidth: 58 | 80;
  autoPrint: boolean;
  receiptHeader: string;
  receiptFooter: string;
};

export type TerminalJob = {
  id: string;
  shopId: string;
  saleId: string | null;
  kind: 'receipt' | 'test';
  status: 'pending' | 'printed' | 'failed';
  payload: Record<string, any>;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_SETTINGS: TerminalSettings = {
  paymentQrData: null,
  paymentQrLabel: 'Оплата по QR',
  showQrOnCheckout: true,
  printQrOnReceipt: false,
  paperWidth: 58,
  autoPrint: true,
  receiptHeader: '',
  receiptFooter: 'Спасибо за покупку!',
};

@Injectable()
export class PosTerminalService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  private mapSettings(row: any): TerminalSettings {
    if (!row) return { ...DEFAULT_SETTINGS };
    return {
      paymentQrData: row.payment_qr_data ?? null,
      paymentQrLabel: row.payment_qr_label || DEFAULT_SETTINGS.paymentQrLabel,
      showQrOnCheckout: Boolean(row.show_qr_on_checkout),
      printQrOnReceipt: Boolean(row.print_qr_on_receipt),
      paperWidth: row.paper_width === 80 ? 80 : 58,
      autoPrint: Boolean(row.auto_print),
      receiptHeader: row.receipt_header ?? '',
      receiptFooter: row.receipt_footer ?? DEFAULT_SETTINGS.receiptFooter,
    };
  }

  private mapJob(row: any): TerminalJob {
    return {
      id: row.id,
      shopId: row.shop_id,
      saleId: row.sale_id ?? null,
      kind: row.kind === 'test' ? 'test' : 'receipt',
      status: row.status,
      payload: row.payload || {},
      error: row.error ?? null,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    };
  }

  async getSettings(shopId: string): Promise<TerminalSettings> {
    try {
      const [row] = await this.db.query(
        'SELECT * FROM pos_terminal_settings WHERE shop_id=$1',
        [shopId],
      );
      return this.mapSettings(row);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async updateSettings(
    shopId: string,
    input: Partial<TerminalSettings>,
  ): Promise<TerminalSettings> {
    const current = await this.getSettings(shopId);
    const next: TerminalSettings = {
      paymentQrData:
        input.paymentQrData !== undefined
          ? input.paymentQrData?.trim() || null
          : current.paymentQrData,
      paymentQrLabel:
        input.paymentQrLabel !== undefined
          ? input.paymentQrLabel.trim() || DEFAULT_SETTINGS.paymentQrLabel
          : current.paymentQrLabel,
      showQrOnCheckout:
        input.showQrOnCheckout !== undefined
          ? Boolean(input.showQrOnCheckout)
          : current.showQrOnCheckout,
      printQrOnReceipt:
        input.printQrOnReceipt !== undefined
          ? Boolean(input.printQrOnReceipt)
          : current.printQrOnReceipt,
      paperWidth:
        input.paperWidth === 80
          ? 80
          : input.paperWidth === 58
            ? 58
            : current.paperWidth,
      autoPrint:
        input.autoPrint !== undefined
          ? Boolean(input.autoPrint)
          : current.autoPrint,
      receiptHeader:
        input.receiptHeader !== undefined
          ? input.receiptHeader.trim()
          : current.receiptHeader,
      receiptFooter:
        input.receiptFooter !== undefined
          ? input.receiptFooter.trim()
          : current.receiptFooter,
    };

    const [row] = await this.db.query(
      `INSERT INTO pos_terminal_settings(
        shop_id, payment_qr_data, payment_qr_label, show_qr_on_checkout,
        print_qr_on_receipt, paper_width, auto_print, receipt_header, receipt_footer, updated_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
      ON CONFLICT (shop_id) DO UPDATE SET
        payment_qr_data=EXCLUDED.payment_qr_data,
        payment_qr_label=EXCLUDED.payment_qr_label,
        show_qr_on_checkout=EXCLUDED.show_qr_on_checkout,
        print_qr_on_receipt=EXCLUDED.print_qr_on_receipt,
        paper_width=EXCLUDED.paper_width,
        auto_print=EXCLUDED.auto_print,
        receipt_header=EXCLUDED.receipt_header,
        receipt_footer=EXCLUDED.receipt_footer,
        updated_at=now()
      RETURNING *`,
      [
        shopId,
        next.paymentQrData,
        next.paymentQrLabel,
        next.showQrOnCheckout,
        next.printQrOnReceipt,
        next.paperWidth,
        next.autoPrint,
        next.receiptHeader,
        next.receiptFooter,
      ],
    );
    return this.mapSettings(row);
  }

  async enqueueSaleReceiptInTx(
    tx: EntityManager,
    shopId: string,
    saleId: string,
    payload: Record<string, any>,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO pos_terminal_jobs(id, shop_id, sale_id, kind, status, payload)
       VALUES($1, $2, $3, 'receipt', 'pending', $4)
       ON CONFLICT (shop_id, sale_id, kind) WHERE sale_id IS NOT NULL DO NOTHING`,
      [randomUUID(), shopId, saleId, JSON.stringify(payload)],
    );
  }

  async enqueueTestReceipt(shopId: string): Promise<TerminalJob> {
    const [shop] = await this.db.query('SELECT name FROM shops WHERE id=$1', [
      shopId,
    ]);
    const id = randomUUID();
    const payload = {
      shopName: shop?.name || 'Магазин',
      method: 'cash',
      totalMinor: 15000,
      createdAt: new Date().toISOString(),
      lines: [
        {
          name: 'Тестовый товар',
          quantity: 1,
          unitPriceMinor: 15000,
          discountMinor: 0,
        },
      ],
    };
    const [row] = await this.db.query(
      `INSERT INTO pos_terminal_jobs(id, shop_id, sale_id, kind, status, payload)
       VALUES($1, $2, NULL, 'test', 'pending', $3)
       RETURNING *`,
      [id, shopId, JSON.stringify(payload)],
    );
    return this.mapJob(row);
  }

  async listJobs(shopId: string): Promise<TerminalJob[]> {
    try {
      const rows = await this.db.query(
        `SELECT * FROM pos_terminal_jobs
         WHERE shop_id=$1
         ORDER BY created_at DESC
         LIMIT 20`,
        [shopId],
      );
      return rows.map((r: any) => this.mapJob(r));
    } catch {
      return [];
    }
  }

  async pollPendingJobs(
    shopId: string,
    aborted: () => boolean,
  ): Promise<TerminalJob[]> {
    const deadline = Date.now() + 20_000;
    while (!aborted()) {
      const rows = await this.db.query(
        `SELECT * FROM pos_terminal_jobs
         WHERE shop_id=$1 AND status='pending'
         ORDER BY created_at ASC
         LIMIT 10`,
        [shopId],
      );
      if (rows.length > 0) {
        return rows.map((r: any) => this.mapJob(r));
      }
      if (Date.now() >= deadline) {
        return [];
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    return [];
  }

  async ackJob(
    shopId: string,
    jobId: string,
    status: 'printed' | 'failed',
    error?: string,
  ): Promise<TerminalJob> {
    const [row] = await this.db.query(
      `UPDATE pos_terminal_jobs
       SET status=$3, error=$4, updated_at=now()
       WHERE shop_id=$1 AND id=$2
       RETURNING *`,
      [shopId, jobId, status, error?.trim() || null],
    );
    if (!row) throw new NotFoundException('Terminal job not found');
    return this.mapJob(row);
  }
}
