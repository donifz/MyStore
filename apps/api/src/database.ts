import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Initial1760000000000 } from './migrations/1760000000000-Initial';
import { Variants1760000000001 } from './migrations/1760000000001-Variants';
import { Inventory1760000000002 } from './migrations/1760000000002-Inventory';
import { Sales1760000000003 } from './migrations/1760000000003-Sales';
import { Pos1760000000004 } from './migrations/1760000000004-Pos';
import { Returns1760000000005 } from './migrations/1760000000005-Returns';
import { Storefront1760000000006 } from './migrations/1760000000006-Storefront';
import { Orders1760000000007 } from './migrations/1760000000007-Orders';
import { ProductPhotos1760000000008 } from './migrations/1760000000008-ProductPhotos';
import { Categories1760000000009 } from './migrations/1760000000009-Categories';
import { Moderation1760000000010 } from './migrations/1760000000010-Moderation';
import { StockOperations1760000000011 } from './migrations/1760000000011-StockOperations';
import { Operations1760000000012 } from './migrations/1760000000012-Operations';
import { StaffEmail1760000000013 } from './migrations/1760000000013-StaffEmail';
import { Marketplace1760000000014 } from './migrations/1760000000014-Marketplace';
import { VariantAttributes1760000000015 } from './migrations/1760000000015-VariantAttributes';
import { ProductAlbums1760000000016 } from './migrations/1760000000016-ProductAlbums';
import { BusinessHours1760000000017 } from './migrations/1760000000017-BusinessHours';
import { StaffPermissions1760000000018 } from './migrations/1760000000018-StaffPermissions';
import { PlatformFinancialAccess1760000000019 } from './migrations/1760000000019-PlatformFinancialAccess';
import { StorefrontSearch1760000000020 } from './migrations/1760000000020-StorefrontSearch';
import { ArchiveAndVariants1760000000021 } from './migrations/1760000000021-ArchiveAndVariants';
import { CashOperationsAndDiscounts1760000000022 } from './migrations/1760000000022-CashOperationsAndDiscounts';
export const DATABASE = Symbol('DATABASE');
export function buildDataSource(url: string) {
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    migrations: [
      Initial1760000000000,
      Variants1760000000001,
      Inventory1760000000002,
      Sales1760000000003,
      Pos1760000000004,
      Returns1760000000005,
      Storefront1760000000006,
      Orders1760000000007,
      ProductPhotos1760000000008,
      Categories1760000000009,
      Moderation1760000000010,
      StockOperations1760000000011,
      Operations1760000000012,
      StaffEmail1760000000013,
      Marketplace1760000000014,
      VariantAttributes1760000000015,
      ProductAlbums1760000000016,
      BusinessHours1760000000017,
      StaffPermissions1760000000018,
      PlatformFinancialAccess1760000000019,
      StorefrontSearch1760000000020,
      ArchiveAndVariants1760000000021,
      CashOperationsAndDiscounts1760000000022,
    ],
  });
}
