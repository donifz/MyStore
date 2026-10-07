import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="market-empty">
      <h1>Страница недоступна</h1>
      <p>Магазин или товар скрыт либо не найден.</p>
      <Link href="/">Вернуться в каталог</Link>
    </section>
  );
}
