import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReceivingDocuments1760000000024 implements MigrationInterface {
  name = 'ReceivingDocuments1760000000024';
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE stock_documents
        ADD COLUMN document_number text,
        ADD COLUMN supplier text,
        ADD COLUMN received_on date NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN comment text
    `);
    await q.query(`
      UPDATE stock_documents
      SET document_number='DOC-' || upper(substr(replace(id::text,'-',''),1,10))
      WHERE document_number IS NULL
    `);
    await q.query(
      `CREATE UNIQUE INDEX stock_documents_shop_number_idx ON stock_documents(shop_id,document_number)`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP INDEX IF EXISTS stock_documents_shop_number_idx');
    await q.query(
      'ALTER TABLE stock_documents DROP COLUMN IF EXISTS document_number, DROP COLUMN IF EXISTS supplier, DROP COLUMN IF EXISTS received_on, DROP COLUMN IF EXISTS comment',
    );
  }
}
