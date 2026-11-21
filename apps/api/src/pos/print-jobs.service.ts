import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

export type PrintJobKind = 'label' | 'receipt';
export type PrintJobStatus = 'pending' | 'printing' | 'printed' | 'failed';

export type PrintJobRow = {
  id: string;
  shopId: string;
  createdBy: string | null;
  kind: PrintJobKind;
  status: PrintJobStatus;
  payload: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  printedAt: string | null;
};

function mapRow(row: any): PrintJobRow {
  return {
    id: row.id,
    shopId: row.shop_id,
    createdBy: row.created_by ?? null,
    kind: row.kind,
    status: row.status,
    payload: row.payload ?? {},
    error: row.error ?? null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    printedAt: row.printed_at
      ? row.printed_at instanceof Date
        ? row.printed_at.toISOString()
        : String(row.printed_at)
      : null,
  };
}

@Injectable()
export class PrintJobsService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  async create(
    shopId: string,
    userId: string,
    kind: PrintJobKind,
    payload: Record<string, unknown>,
  ): Promise<PrintJobRow> {
    if (kind !== 'label' && kind !== 'receipt') {
      throw new BadRequestException('Неподдерживаемый тип печати');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Некорректные данные для печати');
    }
    const [row] = await this.db.query(
      `INSERT INTO print_jobs (shop_id, created_by, kind, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [shopId, userId, kind, JSON.stringify(payload)],
    );
    return mapRow(row);
  }

  async list(
    shopId: string,
    status?: string,
    limit = 30,
  ): Promise<PrintJobRow[]> {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 30), 100);
    if (
      status &&
      status !== 'pending' &&
      status !== 'printing' &&
      status !== 'printed' &&
      status !== 'failed'
    ) {
      throw new BadRequestException('Некорректный статус задания');
    }
    const rows = status
      ? await this.db.query(
          `SELECT * FROM print_jobs
           WHERE shop_id=$1 AND status=$2
           ORDER BY created_at ASC
           LIMIT $3`,
          [shopId, status, safeLimit],
        )
      : await this.db.query(
          `SELECT * FROM print_jobs
           WHERE shop_id=$1
           ORDER BY created_at DESC
           LIMIT $2`,
          [shopId, safeLimit],
        );
    return rows.map(mapRow);
  }

  async claim(shopId: string, jobId: string): Promise<PrintJobRow> {
    const [row] = await this.db.query(
      `UPDATE print_jobs
       SET status='printing', error=NULL
       WHERE id=$1 AND shop_id=$2 AND status IN ('pending', 'failed')
       RETURNING *`,
      [jobId, shopId],
    );
    if (!row) {
      const [exists] = await this.db.query(
        'SELECT id FROM print_jobs WHERE id=$1 AND shop_id=$2',
        [jobId, shopId],
      );
      if (!exists) throw new NotFoundException('Задание печати не найдено');
      throw new ConflictException('Задание уже печатается или выполнено');
    }
    return mapRow(row);
  }

  async complete(shopId: string, jobId: string): Promise<PrintJobRow> {
    const [row] = await this.db.query(
      `UPDATE print_jobs
       SET status='printed', printed_at=now(), error=NULL
       WHERE id=$1 AND shop_id=$2
       RETURNING *`,
      [jobId, shopId],
    );
    if (!row) throw new NotFoundException('Задание печати не найдено');
    return mapRow(row);
  }

  async fail(
    shopId: string,
    jobId: string,
    error: string,
  ): Promise<PrintJobRow> {
    const [row] = await this.db.query(
      `UPDATE print_jobs
       SET status='failed', error=$3
       WHERE id=$1 AND shop_id=$2
       RETURNING *`,
      [jobId, shopId, (error || 'Ошибка печати').slice(0, 500)],
    );
    if (!row) throw new NotFoundException('Задание печати не найдено');
    return mapRow(row);
  }

  async remove(shopId: string, jobId: string): Promise<{ ok: true }> {
    const rows = await this.db.query(
      'DELETE FROM print_jobs WHERE id=$1 AND shop_id=$2 RETURNING id',
      [jobId, shopId],
    );
    if (!rows.length) throw new NotFoundException('Задание печати не найдено');
    return { ok: true };
  }
}
