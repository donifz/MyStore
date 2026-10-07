import { Link, NavLink, Outlet } from 'react-router-dom';
export default function PublicLayout() {
  return (
    <div className="market-shell">
      <header className="market-header">
        <Link className="market-brand" to="/">
          MyStore<span>Магазины рядом</span>
        </Link>
        <nav aria-label="Для покупателей">
          <NavLink to="/" end>
            Товары
          </NavLink>
          <NavLink to="/shops">Магазины</NavLink>
        </nav>
        <span className="market-country">Кыргызстан · сом</span>
      </header>
      <main className="market-main">
        <Outlet />
      </main>
      <footer className="market-footer">
        <div>
          <Link className="market-brand" to="/">
            MyStore
          </Link>
          <p>Ваши магазины. Актуальное наличие.</p>
        </div>
        <nav aria-label="Для продавцов">
          <Link to="/partner">Стать партнёром</Link>
          <Link to="/seller">Войти для продавцов</Link>
        </nav>
        <small>Покупку и получение товара согласуйте с магазином.</small>
      </footer>
    </div>
  );
}
