import { formatSom } from './public-api';

/**
 * Normalizes phone number to international WhatsApp format (Kyrgyzstan 996 default).
 */
export function getWhatsAppPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // If local format like 0776112499 (10 digits starting with 0) -> convert to 996776112499
  if (digits.startsWith('0') && digits.length === 10) {
    return '996' + digits.slice(1);
  }
  // If 9 digits without country code (e.g. 776112499) -> convert to 996776112499
  if (digits.length === 9) {
    return '996' + digits;
  }
  return digits;
}

/**
 * Builds a direct WhatsApp order chat link with prefilled order details.
 */
export function buildProductWhatsAppUrl({
  phone,
  productName,
  priceMinor,
  storeName,
  pageUrl,
}: {
  phone?: string | null;
  productName: string;
  priceMinor: number;
  storeName: string;
  pageUrl?: string;
}): string | null {
  const cleanPhone = getWhatsAppPhone(phone);
  if (!cleanPhone) return null;

  const price = formatSom(priceMinor);
  let text = `Здравствуйте! Хочу заказать «${productName}» (${price}) в магазине «${storeName}». Есть в наличии?`;
  if (pageUrl) {
    text += `\n${pageUrl}`;
  }

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
