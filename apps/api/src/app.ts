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
import { StockOperationsService } from './inventory/stock-operations.service';
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
} from './storefront/storefront.controller';
import { OrdersService } from './orders/orders.service';
import { OrderExpirationService } from './orders/order-expiration.service';
import {
  OrdersController,
  PublicOrdersController,
} from './orders/orders.controller';
import { CaptureService } from './catalog/capture.service';
import { BarcodeLookupService } from './catalog/barcode-lookup.service';
import { PhotoAssistantService } from './catalog/photo-assistant.service';
import { CaptureController } from './catalog/capture.controller';
import { CategoriesController } from './catalog/categories.controller';
import { CategoriesService } from './catalog/categories.service';
import { AdminSessionController } from './platform/admin-session.controller';
import { PlatformAdminService } from './platform/platform-admin.service';
import {
  AdminApplicationsController,
  PartnerApplicationsController,
} from './platform/partner-applications.controller';
import { PartnerApplicationsService } from './platform/partner-applications.service';
import { ProductModerationService } from './platform/product-moderation.service';
import { ProductModerationController } from './platform/product-moderation.controller';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { OperationsController } from './operations/operations.controller';
import { NotificationsService } from './operations/notifications.service';
import { HealthController } from './operations/health.controller';
import { FiscalController } from './fiscal/fiscal.controller';
import { FiscalService } from './fiscal/fiscal.service';
import { EmailQueueService } from './email/email-queue.service';
import { StaffService } from './staff/staff.service';
import {
  StaffController,
  StaffAcceptanceController,
} from './staff/staff.controller';
import { PasswordRecoveryService } from './auth/password-recovery.service';
import { PasswordRecoveryController } from './auth/password-recovery.controller';
import { EmailSettingsService } from './email/email-settings.service';
import { EmailSettingsController } from './email/email-settings.controller';
import { EventEmailService } from './email/event-email.service';
export async function createApp(
  db: DataSource,
  publicHandler?: express.RequestHandler,
) {
  @Module({
    controllers: [
      AdminSessionController,
      AdminApplicationsController,
      ProductModerationController,
      PartnerApplicationsController,
      CaptureController,
      CategoriesController,
      PublicOrdersController,
      OrdersController,
      PublicStorefrontController,
      StorefrontSettingsController,
      AuthController,
      WebAuthController,
      ShopsController,
      VariantsController,
      InventoryController,
      SalesController,
      ShiftsController,
      PosSalesController,
      ReturnsController,
      ReportsController,
      OperationsController,
      HealthController,
      FiscalController,
      StaffController,
      EmailSettingsController,
      PasswordRecoveryController,
      StaffAcceptanceController,
    ],
    providers: [
      PlatformAdminService,
      PartnerApplicationsService,
      ProductModerationService,
      { provide: DATABASE, useValue: db },
      CaptureService,
      BarcodeLookupService,
      CategoriesService,
      PhotoAssistantService,
      OrdersService,
      OrderExpirationService,
      StorefrontService,
      AuthService,
      AuthGuard,
      ShopAccessService,
      VariantsService,
      StockService,
      ReceivingService,
      StockOperationsService,
      IdempotencyService,
      SalesService,
      ShiftsService,
      PosSalesService,
      ReturnsService,
      SalesHistoryService,
      ReportsService,
      NotificationsService,
      FiscalService,
      EmailQueueService,
      EmailSettingsService,
      EventEmailService,
      StaffService,
      PasswordRecoveryService,
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: false });
  // Render's public ingress appends the connecting client address. Trust
  // only that final hop, never caller-supplied earlier forwarded addresses.
  // Direct/local deployments continue to ignore forwarded headers.
  if (process.env.RENDER === 'true')
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
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
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (
        [
          '/seller/staff/accept',
          '/seller/reset-password',
          '/partner/activate',
        ].includes(req.path)
      ) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex');
        res.setHeader('Referrer-Policy', 'no-referrer');
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
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (
        [
          '/seller/staff/accept',
          '/seller/reset-password',
          '/partner/activate',
        ].includes(req.path)
      )
        res.setHeader('Referrer-Policy', 'no-referrer');
      next();
    },
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
              req.path === '/partner/activate' ||
              req.path === '/cart' ||
              req.path === '/favorites' ||
              req.path === '/ui-kit' ||
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
          req.path.startsWith('/seller/') ||
          req.path === '/platform/admin'
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
