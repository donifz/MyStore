import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrintJobsService } from './print-jobs.service';

describe('PrintJobsService', () => {
  it('creates, claims, and completes a print job and prevents double claiming', async () => {
    const jobs: any[] = [];
    const db = {
      query: vi.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO print_jobs')) {
          const row = {
            id: 'job-1',
            shop_id: params[0],
            created_by: params[1],
            kind: params[2],
            status: 'pending',
            payload: JSON.parse(params[3]),
            error: null,
            created_at: new Date('2026-11-21T12:00:00Z'),
            printed_at: null,
          };
          jobs.push(row);
          return [row];
        }
        if (sql.includes("SET status='printing'")) {
          const found = jobs.find(
            (j) =>
              j.id === params[0] &&
              j.shop_id === params[1] &&
              (j.status === 'pending' || j.status === 'failed'),
          );
          if (!found) return [];
          found.status = 'printing';
          return [found];
        }
        if (sql.includes('SELECT id FROM print_jobs')) {
          return jobs
            .filter((j) => j.id === params[0] && j.shop_id === params[1])
            .map((j) => ({ id: j.id }));
        }
        if (sql.includes("SET status='printed'")) {
          const found = jobs.find(
            (j) => j.id === params[0] && j.shop_id === params[1],
          );
          if (!found) return [];
          found.status = 'printed';
          found.printed_at = new Date('2026-11-21T12:00:05Z');
          return [found];
        }
        return [];
      }),
    };

    const service = new PrintJobsService(db as any);
    const created = await service.create('shop-1', 'user-1', 'label', {
      labelSize: '30x20',
      items: [{ name: 'Чай', barcode: '123456', copies: 2 }],
    });
    expect(created.status).toBe('pending');
    expect(created.kind).toBe('label');

    const claimed = await service.claim('shop-1', 'job-1');
    expect(claimed.status).toBe('printing');

    await expect(service.claim('shop-1', 'job-1')).rejects.toThrow(
      ConflictException,
    );
    await expect(service.claim('other-shop', 'job-1')).rejects.toThrow(
      NotFoundException,
    );

    const completed = await service.complete('shop-1', 'job-1');
    expect(completed.status).toBe('printed');
    expect(completed.printedAt).toBeTruthy();
  });
});
