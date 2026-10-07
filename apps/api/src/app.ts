import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import helmet from 'helmet';
import { DATABASE } from './database';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';
import { ShopAccessService } from './shops/shop-access.service';
import { ShopsController } from './shops/shops.controller';
import { VariantsService } from './catalog/variants.service';
import { VariantsController } from './catalog/variants.controller';
import { StockService } from './inventory/stock.service';
import { ReceivingService } from './inventory/receiving.service';
import { InventoryController } from './inventory/inventory.controller';
import { IdempotencyService } from './common/idempotency.service';
import { SalesService } from './pos/sales.service';
import { SalesController } from './pos/sales.controller';
export async function createApp(db: DataSource) {
  @Module({
    controllers: [
      AuthController,
      ShopsController,
      VariantsController,
      InventoryController,
      SalesController,
    ],
    providers: [
      { provide: DATABASE, useValue: db },
      AuthService,
      AuthGuard,
      ShopAccessService,
      VariantsService,
      StockService,
      ReceivingService,
      IdempotencyService,
      SalesService,
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
