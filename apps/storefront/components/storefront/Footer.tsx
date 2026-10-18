import Link from 'next/link';
export default function Footer() {
  return (
    <footer className="sf-footer">
      <div className="sf-container sf-footer__inner">
        <div>
          <Link className="sf-brand" href="/">
            MyStore
          </Link>
          <p className="sf-muted">Ваши магазины. Актуальное наличие.</p>
        </div>
        <nav className="sf-footer__nav" aria-label="Информация и вход">
          <Link href="/terms">Правила сервиса</Link>
          <Link href="/privacy">Обработка данных</Link>
          <Link href="/partner">
            Стать партнёром <span aria-hidden="true">↗</span>
          </Link>
          <a href="/seller">Войти для продавцов</a>
        </nav>
        <small className="sf-muted">
          Покупку и получение товара согласуйте с магазином.
        </small>
      </div>
    </footer>
  );
}
