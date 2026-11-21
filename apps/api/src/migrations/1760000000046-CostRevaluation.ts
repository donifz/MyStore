import { MigrationInterface, QueryRunner } from 'typeorm';

export class CostRevaluation1760000000046 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE stock_documents DROP CONSTRAINT stock_documents_kind_check;
      ALTER TABLE stock_documents ADD CONSTRAINT stock_documents_kind_check
        CHECK(kind IN ('receiving','sale','return','inventory_count','writeoff','defect_disposal','cost_revaluation'));
      CREATE TABLE cost_revaluations (
        document_id uuid NOT NULL,
        shop_id uuid NOT NULL,
        variant_id uuid NOT NULL,
        physical_quantity bigint NOT NULL CHECK(physical_quantity > 0),
        previous_unit_cost_minor bigint NOT NULL CHECK(previous_unit_cost_minor >= 0),
        new_unit_cost_minor bigint NOT NULL CHECK(new_unit_cost_minor >= 0 AND new_unit_cost_minor <= 9007199254740991),
        previous_value_minor bigint NOT NULL CHECK(previous_value_minor >= 0),
        new_value_minor bigint NOT NULL CHECK(new_value_minor >= 0 AND new_value_minor <= 9007199254740991),
        delta_value_minor bigint NOT NULL,
        reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
        PRIMARY KEY(shop_id, document_id, variant_id),
        FOREIGN KEY(shop_id, document_id) REFERENCES stock_documents(shop_id, id),
        FOREIGN KEY(shop_id, variant_id) REFERENCES variants(shop_id, id)
      );
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      DROP TABLE IF EXISTS cost_revaluations;
      ALTER TABLE stock_documents DROP CONSTRAINT stock_documents_kind_check;
      ALTER TABLE stock_documents ADD CONSTRAINT stock_documents_kind_check
        CHECK(kind IN ('receiving','sale','return','inventory_count','writeoff','defect_disposal'));
    `);
  }
}
