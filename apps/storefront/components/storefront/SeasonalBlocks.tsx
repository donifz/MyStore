import Link from 'next/link';
import { ThemeBlock, ThemePresentation } from '../../lib/public-api';

function Block({ block, kind }: { block?: ThemeBlock; kind: 'hero' | 'info' }) {
  if (
    !block ||
    !Object.values(block).some((value) => typeof value === 'string' && value)
  )
    return null;
  const content = (
    <>
      {block.imageDataUrl && (
        // The API validates and normalizes this bounded JPEG data URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.imageDataUrl} alt={block.imageAlt || ''} />
      )}
      <div>
        {block.title && <h2>{block.title}</h2>}
        {block.text && <p>{block.text}</p>}
        {block.link &&
          block.buttonLabel &&
          (block.link.startsWith('/') ? (
            <Link className="sf-button sf-button--primary" href={block.link}>
              {block.buttonLabel}
            </Link>
          ) : (
            <a
              className="sf-button sf-button--primary"
              href={block.link}
              rel="noopener noreferrer"
            >
              {block.buttonLabel}
            </a>
          ))}
      </div>
    </>
  );
  return (
    <section className={`sf-seasonal-block sf-seasonal-block--${kind}`}>
      {content}
    </section>
  );
}

export default function SeasonalBlocks({
  presentation,
}: {
  presentation?: ThemePresentation;
}) {
  if (!presentation) return null;
  return (
    <div className="sf-seasonal-blocks">
      <Block block={presentation.hero} kind="hero" />
      <Block block={presentation.info} kind="info" />
    </div>
  );
}
