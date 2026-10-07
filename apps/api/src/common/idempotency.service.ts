import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
@Injectable()
export class IdempotencyService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}
  async execute<T>(
    shopId: string,
    key: string,
    payload: unknown,
    work: (tx: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key required, 1–128 printable characters',
      );
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${shopId.toLowerCase()}:${key}`,
      ]);
      const [previous] = await tx.query(
        'SELECT fingerprint,result FROM operation_results WHERE shop_id=$1 AND key=$2',
        [shopId, key],
      );
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ConflictException('Key reused with different request');
        return previous.result as T;
      }
      const result = await work(tx);
      await tx.query(
        'INSERT INTO operation_results(shop_id,key,fingerprint,result)VALUES($1,$2,$3,$4)',
        [shopId, key, fingerprint, JSON.stringify(result)],
      );
      return result;
    });
  }
}
