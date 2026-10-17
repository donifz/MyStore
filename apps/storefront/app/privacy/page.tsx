import Link from 'next/link';
import { metadata } from '../../lib/seo';
import { Alert } from '../../components/ui';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return metadata(
    'Политика обработки данных — MyStore',
    'Политика конфиденциальности и правила обработки персональных данных на платформе MyStore.',
    '/privacy',
  );
}

export default function PrivacyPage() {
  return (
    <div
      className="sf-container"
      style={{ maxWidth: '840px', padding: '2rem 1rem 4rem' }}
    >
      <nav
        aria-label="Хлебные крошки"
        style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}
      >
        <Link
          href="/"
          className="sf-muted"
          style={{ textDecoration: 'underline' }}
        >
          ← Главная
        </Link>
      </nav>

      <div style={{ marginBottom: '2rem' }}>
        <p className="sf-eyebrow" style={{ color: '#00523d', fontWeight: 600 }}>
          Конфиденциальность
        </p>
        <h1
          style={{ fontSize: '2rem', margin: '0.5rem 0 1rem', lineHeight: 1.2 }}
        >
          Политика обработки данных
        </h1>
        <p className="sf-muted" style={{ fontSize: '0.95rem' }}>
          Редакция от 17 октября 2026 года
        </p>
      </div>

      <Alert variant="info" style={{ marginBottom: '2rem' }}>
        <strong>Статус документа: проект.</strong> Окончательные реквизиты
        оператора персональных данных и контактная информация службы поддержки
        утверждаются владельцем платформы перед запуском в промышленную
        эксплуатацию.
      </Alert>

      <article
        className="sf-prose"
        style={{ lineHeight: 1.6, color: '#334155' }}
      >
        <section style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              color: '#0f172a',
              marginBottom: '0.75rem',
            }}
          >
            1. Состав обрабатываемой информации
          </h2>
          <p>
            Платформа MyStore обрабатывает только минимально необходимый объём
            данных для функционирования торговых сервисов:
          </p>
          <ul>
            <li>
              <strong>Покупатели:</strong> имя, контактный номер телефона и
              адрес доставки/самовывоза, указанные при оформлении онлайн-заказа
              в корзине.
            </li>
            <li>
              <strong>Сотрудники магазинов:</strong> рабочий email, роль в
              системе (владелец, менеджер, кассир) и хешированный пароль.
            </li>
            <li>
              <strong>Магазины-партнёры:</strong> наименование, контактный
              телефон, адрес точки продаж, график работы и категория товаров.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              color: '#0f172a',
              marginBottom: '0.75rem',
            }}
          >
            2. Цели обработки данных
          </h2>
          <ul>
            <li>Оформление и учёт бронирования товаров на складе продавца.</li>
            <li>
              Обеспечение оперативной связи продавца с покупателем для
              подтверждения заказа.
            </li>
            <li>
              Разграничение прав доступа и безопасная аутентификация сотрудников
              магазинов в кассовой системе.
            </li>
            <li>
              Ведение обязательного журнала аудита операций и изменений прав.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              color: '#0f172a',
              marginBottom: '0.75rem',
            }}
          >
            3. Защита и передача третьим лицам
          </h2>
          <p>
            Персональные данные покупателей передаются исключительно конкретному
            магазину, у которого оформлен заказ, и не продаются третьим лицам
            или рекламным сетям.
          </p>
          <p>
            Публичные квитанции заказов не раскрывают персональные контакты
            покупателя; доступ к деталям заказов строго изолирован правами
            доступа конкретного магазина. Пароли хранятся с использованием
            криптографического хеширования, а сессии защищены HTTP-only cookie с
            проверкой origin.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              color: '#0f172a',
              marginBottom: '0.75rem',
            }}
          >
            4. Вопросы и обратная связь
          </h2>
          <p>
            По вопросам изменения или удаления персональных данных пользователи
            и покупатели могут обратиться к администрации сервиса через форму
            партнёрства или напрямую в магазин, в котором производился заказ.
          </p>
        </section>
      </article>
    </div>
  );
}
