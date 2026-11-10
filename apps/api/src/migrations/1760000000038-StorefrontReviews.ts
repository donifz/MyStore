import { MigrationInterface, QueryRunner } from 'typeorm';

export class StorefrontReviews1760000000038 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE storefront_reviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        variant_id uuid REFERENCES variants(id) ON DELETE CASCADE,
        buyer_id uuid NOT NULL REFERENCES buyer_accounts(id) ON DELETE CASCADE,
        operation_key varchar(64) NOT NULL UNIQUE,
        author_name varchar(120) NOT NULL CHECK (char_length(btrim(author_name)) BETWEEN 1 AND 120),
        rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 2000),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX storefront_reviews_shop_idx
        ON storefront_reviews (shop_id, created_at DESC);
      CREATE INDEX storefront_reviews_variant_idx
        ON storefront_reviews (variant_id, created_at DESC)
        WHERE variant_id IS NOT NULL;
      CREATE UNIQUE INDEX storefront_reviews_buyer_shop_uq
        ON storefront_reviews (buyer_id, shop_id)
        WHERE variant_id IS NULL;
      CREATE UNIQUE INDEX storefront_reviews_buyer_variant_uq
        ON storefront_reviews (buyer_id, variant_id)
        WHERE variant_id IS NOT NULL;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE storefront_reviews');
  }
}
