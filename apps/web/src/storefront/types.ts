import { Page } from '../api/types';
export type PublicStore = {
  presentation?: ThemePresentation;
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
  presentation: ThemePresentation;
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
export type ThemeId = 'base' | 'new-year' | 'womens-day' | 'nooruz';
export type ThemeBlock = {
  imageDataUrl?: string;
  imageAlt?: string;
  title?: string;
  text?: string;
  link?: string;
  buttonLabel?: string;
};
export type ThemePresentation = {
  id: ThemeId;
  startsAt: string | null;
  endsAt: string | null;
  hero?: ThemeBlock;
  info?: ThemeBlock;
};
