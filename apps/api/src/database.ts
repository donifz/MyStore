import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Initial1760000000000 } from './migrations/1760000000000-Initial';
import { Variants1760000000001 } from './migrations/1760000000001-Variants';
import { Inventory1760000000002 } from './migrations/1760000000002-Inventory';
import { Sales1760000000003 } from './migrations/1760000000003-Sales';
import { Pos1760000000004 } from './migrations/1760000000004-Pos';
import { Returns1760000000005 } from './migrations/1760000000005-Returns';
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
    ],
  });
}
