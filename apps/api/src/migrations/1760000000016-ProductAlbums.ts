import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductAlbums1760000000016 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE variants ADD COLUMN photo_album bytea[] NOT NULL DEFAULT '{}';
      ALTER TABLE product_publication_revisions
        ADD COLUMN photo_album bytea[] NOT NULL DEFAULT '{}';
      ALTER TABLE product_publications
        ADD COLUMN photo_album bytea[] NOT NULL DEFAULT '{}';
      UPDATE variants SET photo_album = ARRAY[photo_data]
        WHERE photo_data IS NOT NULL;
      UPDATE product_publication_revisions SET photo_album = ARRAY[photo_data]
        WHERE photo_data IS NOT NULL;
      UPDATE product_publications SET photo_album = ARRAY[photo_data]
        WHERE photo_data IS NOT NULL;
      ALTER TABLE variants ADD CONSTRAINT variants_photo_album_limit
        CHECK (cardinality(photo_album) <= 8);
      ALTER TABLE product_publication_revisions
        ADD CONSTRAINT revisions_photo_album_limit
        CHECK (cardinality(photo_album) <= 8);
      ALTER TABLE product_publications
        ADD CONSTRAINT publications_photo_album_limit
        CHECK (cardinality(photo_album) <= 8);
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      ALTER TABLE product_publications DROP COLUMN photo_album;
      ALTER TABLE product_publication_revisions DROP COLUMN photo_album;
      ALTER TABLE variants DROP COLUMN photo_album;
    `);
  }
}
