import { Page } from '../api/types';
export type PublicStore = {
  theme?: 'classic' | 'festive' | 'minimal' | 'nature';
  slug: string;
  name: string;
  description: string;
  city: string;
  address?: string;
  phone?: string;
  hours?: string;
};
export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  salePriceMinor: number;
  available: number;
  store: PublicStore;
};
export type PublicProducts = Page<PublicProduct> & { categories: string[] };
export type StoreProfile = PublicStore & {
  theme: 'classic' | 'festive' | 'minimal' | 'nature';
  timeZone?: string;
  businessSchedule?: BusinessSchedule | null;
  reservationPolicy?: 'business-hours' | 'legacy-30-minutes';
  confirmationPreview?: { from: string; expiresAt: string };
  district?: string;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
  phone: string;
  address: string;
  hours: string;
  published: boolean;
};
export type BusinessInterval = { open: string; close: string };
export type BusinessSchedule = BusinessInterval[][];
