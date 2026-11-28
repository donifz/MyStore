import Link from 'next/link';
import Icon from './Icon';

export default function Footer() {
  return (
    <footer className="sf-footer">
      <div className="sf-container sf-footer__inner">
        <div className="sf-footer__grid">
          <div className="sf-footer__brand">
            <Link className="sf-footer__logo" href="/">
              <span className="sf-footer__logo-mark" aria-hidden="true">
                <Icon name="shop" width={18} height={18} />
              </span>
              <span>MyStore</span>
            </Link>
            <p className="sf-footer__tagline">
              Ваши магазины. Актуальное наличие.
            </p>
            <div className="sf-footer__pill">
              <span className="sf-footer__pill-dot" aria-hidden="true" />
              <span>Честные остатки прямо из кассы</span>
            </div>
          </div>

          <nav className="sf-footer__columns" aria-label="Информация и вход">
            <div className="sf-footer__col">
              <span className="sf-footer__heading">Покупателям</span>
              <div className="sf-footer__links">
                <Link href="/catalog">Каталог</Link>
                <Link href="/shops">Магазины</Link>
                <Link href="/cart">Корзина</Link>
                <a href="/buyer">Личный кабинет</a>
              </div>
            </div>

            <div className="sf-footer__col">
              <span className="sf-footer__heading">Для бизнеса</span>
              <div className="sf-footer__links">
                <Link href="/partner" className="sf-footer__partner-link">
                  Стать партнёром <span aria-hidden="true">↗</span>
                </Link>
                <a href="/seller">Войти для продавцов</a>
              </div>
            </div>

            <div className="sf-footer__col">
              <span className="sf-footer__heading">Информация</span>
              <div className="sf-footer__links">
                <Link href="/terms">Правила сервиса</Link>
                <Link href="/privacy">Обработка данных</Link>
              </div>
            </div>
          </nav>
        </div>

        <div className="sf-footer__bottom">
          <small className="sf-footer__note">
            © MyStore · Покупку и получение товара согласуйте с магазином.
          </small>
          <span className="sf-footer__region">Кыргызстан</span>
        </div>
      </div>
    </footer>
  );
}
