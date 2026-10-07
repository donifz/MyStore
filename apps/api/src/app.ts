import 'reflect-metadata';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
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
import { StorefrontService } from './storefront/storefront.service';
import {
  PublicStorefrontController,
  StorefrontSettingsController,
  PartnersController,
} from './storefront/storefront.controller';
import { OrdersService } from './orders/orders.service';
import { OrderExpirationService } from './orders/order-expiration.service';
import {
  OrdersController,
  PublicOrdersController,
} from './orders/orders.controller';
import { CaptureService } from './catalog/capture.service';
import { CaptureController } from './catalog/capture.controller';
export async function createApp(
  db: DataSource,
  publicHandler?: express.RequestHandler,
) {
  @Module({
    controllers: [
      CaptureController,
      PublicOrdersController,
      OrdersController,
      PublicStorefrontController,
      StorefrontSettingsController,
      PartnersController,
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
      CaptureService,
      OrdersService,
      OrderExpirationService,
      StorefrontService,
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
  app.use(express.json({ limit: '1mb' }));
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
  if (publicHandler) {
    app.use(
      (
        _req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        res.locals.nonce = randomBytes(18).toString('base64');
        next();
      },
    );
  }
  app.use(
    helmet(
      publicHandler
        ? {
            contentSecurityPolicy: {
              directives: {
                scriptSrc: [
                  "'self'",
                  (_req, res) =>
                    `'nonce-${(res as express.Response).locals.nonce}'`,
                ],
              },
            },
          }
        : undefined,
    ),
  );
  if (publicHandler) {
    app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        if (res.locals.apiRequest) return next();
        if (
          req.path.startsWith('/_next/') ||
          req.path === '/robots.txt' ||
          req.path === '/sitemap.xml' ||
          (['GET', 'HEAD'].includes(req.method) &&
            (req.path === '/' ||
              req.path === '/partner' ||
              req.path === '/cart' ||
              req.path === '/shops' ||
              /^\/shops\/[^/]+(?:\/products\/[^/]+)?\/?$/.test(req.path)))
        ) {
          req.headers['content-security-policy'] = String(
            res.getHeader('Content-Security-Policy'),
          );
          req.headers['x-nonce'] = res.locals.nonce;
          return publicHandler(req, res, next);
        }
        next();
      },
    );
  }
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
          req.path === '/partner' ||
          req.path === '/shops' ||
          /^\/shops\/[^/]+(?:\/products\/[^/]+)?\/?$/.test(req.path) ||
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
