import { describe, expect, it } from 'vitest';
import { buildProductWhatsAppUrl, getWhatsAppPhone } from './whatsapp';

describe('whatsapp helper', () => {
  describe('getWhatsAppPhone', () => {
    it('returns null for empty or invalid numbers', () => {
      expect(getWhatsAppPhone(undefined)).toBeNull();
      expect(getWhatsAppPhone(null)).toBeNull();
      expect(getWhatsAppPhone('')).toBeNull();
      expect(getWhatsAppPhone('abc')).toBeNull();
    });

    it('normalizes local 10-digit number starting with 0 to 996', () => {
      expect(getWhatsAppPhone('0776112499')).toBe('996776112499');
      expect(getWhatsAppPhone('(0776) 11-24-99')).toBe('996776112499');
    });

    it('normalizes 9-digit number without country code to 996', () => {
      expect(getWhatsAppPhone('776112499')).toBe('996776112499');
    });

    it('preserves international number starting with 996', () => {
      expect(getWhatsAppPhone('+996776112499')).toBe('996776112499');
      expect(getWhatsAppPhone('+996 776 11-24-99')).toBe('996776112499');
    });
  });

  describe('buildProductWhatsAppUrl', () => {
    it('builds prefilled chat link with product name, price, and store', () => {
      const url = buildProductWhatsAppUrl({
        phone: '+996 776 11 24 99',
        productName: 'Магнитная карта',
        priceMinor: 90000,
        storeName: 'Мир игрушек',
      });
      expect(url).toBeDefined();
      expect(url).toContain('https://wa.me/996776112499?text=');
      const decoded = decodeURIComponent(url!);
      expect(decoded).toContain(
        'Здравствуйте! Хочу заказать «Магнитная карта»',
      );
      expect(decoded).toContain('900');
      expect(decoded).toContain('Мир игрушек');
      expect(decoded).toContain('Есть в наличии?');
    });

    it('appends pageUrl if provided', () => {
      const url = buildProductWhatsAppUrl({
        phone: '0776112499',
        productName: 'Мячик',
        priceMinor: 5000,
        storeName: 'Мир игрушек',
        pageUrl: 'https://mystore.tezkur.kg/shop/mir-igrushek/products/123',
      });
      const decoded = decodeURIComponent(url!);
      expect(decoded).toContain(
        'https://mystore.tezkur.kg/shop/mir-igrushek/products/123',
      );
    });

    it('returns null if phone is missing', () => {
      const url = buildProductWhatsAppUrl({
        phone: null,
        productName: 'Мячик',
        priceMinor: 5000,
        storeName: 'Мир игрушек',
      });
      expect(url).toBeNull();
    });
  });
});
