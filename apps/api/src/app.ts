import 'reflect-metadata';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import helmet from 'helmet';
import { DATABASE } from './database';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { WebAuthController } from './auth/web-auth.controller';
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
import { ShiftsController } from './pos/shifts.controller';
import { ShiftsService } from './pos/shifts.service';
import { PosSalesController } from './pos/pos-sales.controller';
import { PosSalesService } from './pos/pos-sales.service';
import { SalesHistoryService } from './pos/sales-history.service';
import { ReturnsController } from './pos/returns.controller';
import { ReturnsService } from './pos/returns.service';
export async function createApp(db: DataSource) {
  @Module({
    controllers: [
      AuthController,
      WebAuthController,
      ShopsController,
      VariantsController,
      InventoryController,
      SalesController,
      ShiftsController,
      PosSalesController,
      ReturnsController,
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
      ShiftsService,
      PosSalesService,
      ReturnsService,
      SalesHistoryService,
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: false });
  if (process.env.NODE_ENV === 'production' && !process.env.WEB_ORIGINS)
    throw new Error('WEB_ORIGINS required');
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (req.url.startsWith('/api/')) {
        res.locals.apiRequest = true;
        req.url = req.url.slice(4);
      }
      next();
    },
  );
  app.use(helmet());
  const webDir = resolve(__dirname, '../../web/dist');
  if (existsSync(resolve(webDir, 'index.html'))) {
    app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        if (res.locals.apiRequest || !['GET', 'HEAD'].includes(req.method))
          return next();
        if (
          req.path === '/' ||
          req.path === '/seller' ||
          req.path.startsWith('/seller/')
        ) {
          res.setHeader('Cache-Control', 'no-store');
          return res.sendFile(resolve(webDir, 'index.html'));
        }
        if (req.path.startsWith('/assets/'))
          return express.static(webDir, { maxAge: '1y', immutable: true })(
            req,
            res,
            next,
          );
        next();
      },
    );
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
