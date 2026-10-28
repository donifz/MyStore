import Link from 'next/link';
import { ThemeBlock } from '../../lib/public-api';

export default function StorefrontBanner({
  banner,
}: {
  banner?: ThemeBlock | null;
}) {
  if (
    !banner ||
    !Object.values(banner).some((value) => typeof value === 'string' && value)
  )
    return null;
  return (
    <section className="sf-store-banner">
      {banner.imageDataUrl && (
        // The API validates and normalizes this bounded JPEG data URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner.imageDataUrl} alt={banner.imageAlt || ''} />
      )}
      <div>
        {banner.title && <h2>{banner.title}</h2>}
        {banner.text && <p>{banner.text}</p>}
        {banner.link &&
          banner.buttonLabel &&
          (banner.link.startsWith('/') ? (
            <Link className="sf-button sf-button--primary" href={banner.link}>
              {banner.buttonLabel}
            </Link>
          ) : (
            <a
              className="sf-button sf-button--primary"
              href={banner.link}
              rel="noopener noreferrer"
            >
              {banner.buttonLabel}
            </a>
          ))}
      </div>
    </section>
  );
}
