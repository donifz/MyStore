import { Page } from '../api/types';
export type PublicStore = {
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
  district?: string;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
  phone: string;
  address: string;
  hours: string;
  published: boolean;
};
