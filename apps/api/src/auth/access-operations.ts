import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { EntityManager } from 'typeorm';
export async function accessOperation<T>(
  tx: EntityManager,
  scope: string,
  key: string,
  payload: unknown,
  work: () => Promise<T>,
): Promise<T> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key || '',
    )
  )
    throw new BadRequestException('UUID operation key required');
  key = key.toLowerCase();
  const fingerprint = createHmac('sha256', process.env.SESSION_SECRET!)
    .update(JSON.stringify(payload))
    .digest('hex');
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    scope + ':' + key,
  ]);
  const [previous] = await tx.query(
    'SELECT fingerprint,result FROM access_operations WHERE scope=$1 AND key=$2',
    [scope, key],
  );
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new ConflictException('Key reused');
    return previous.result;
  }
  const result = await work();
  await tx.query(
    'INSERT INTO access_operations(scope,key,fingerprint,result) VALUES($1,$2,$3,$4)',
    [scope, key, fingerprint, JSON.stringify(result)],
  );
  return result;
}
