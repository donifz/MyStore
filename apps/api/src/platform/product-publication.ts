import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';

// Called inside the same transaction that writes the accounting variant.
export async function stageProduct(
  tx: EntityManager,
  row: any,
  actor: string | null,
) {
  await tx.query(
    `UPDATE product_publication_revisions SET status='rejected',reason='Superseded',decided_at=now()
     WHERE variant_id=$1 AND status='pending'`,
    [row.id],
  );
  const id = randomUUID();
  await tx.query(
    `INSERT INTO product_publication_revisions
      (id,variant_id,shop_id,name,description,category,subcategory,photo_data,photo_album,status,submitted_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$10,'pending',$9)`,
    [
      id,
      row.id,
      row.shop_id,
      row.name,
      row.description,
      row.category,
      row.subcategory ?? '',
      row.photo_data,
      actor,
      row.photo_album ?? (row.photo_data ? [row.photo_data] : []),
    ],
  );
  return id;
}
