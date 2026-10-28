import { StorefrontBanner as StorefrontBannerData } from '../../lib/public-api';

export default function StorefrontBanner({
  banner,
}: {
  banner?: StorefrontBannerData | null;
}) {
  if (!banner?.imageDataUrl) return null;
  return (
    <section className="sf-store-banner" aria-label="Баннер магазина">
      {/* The API validates and normalizes this bounded JPEG data URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={banner.imageDataUrl} alt="" />
    </section>
  );
}
