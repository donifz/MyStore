'use client';
import { useState } from 'react';
import {
  Button,
  LinkButton,
  Input,
  Select,
  Textarea,
  Checkbox,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
} from './ui';
export default function UiKitExamples() {
  const [submits, setSubmits] = useState(0);
  return (
    <div className="sf-stack">
      <section className="sf-panel sf-kit-section" id="buttons">
        <h2>Кнопки и действия</h2>
        <p className="sf-muted">
          Навигация — ссылка. Действие — кнопка. Все примеры демонстрационные.
        </p>
        <div className="sf-actions">
          <Button>Основная</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="ghost">Без фона</Button>
          <Button variant="danger">Удалить</Button>
          <Button disabled>Недоступно</Button>
          <Button loading>Загрузка примера</Button>
          <LinkButton href="#fields" variant="secondary">
            Перейти к полям
          </LinkButton>
        </div>
        <form
          className="sf-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmits((n) => n + 1);
          }}
        >
          <p className="sf-kit-label">Безопасный пример формы</p>
          <div className="sf-actions">
            <Button variant="secondary">Действие без отправки</Button>
            <Button type="submit">Отправить пример</Button>
          </div>
          <p role="status">Отправок формы: {submits}</p>
        </form>
      </section>
      <section className="sf-panel sf-kit-section" id="fields">
        <h2>Поля и формы</h2>
        <div className="sf-kit-grid">
          <Input
            id="demo-name"
            label="Имя примера"
            placeholder="Как к вам обращаться?"
            hint="Видимая подпись остаётся при вводе."
          />
          <Input
            id="demo-phone"
            label="Телефон с ошибкой"
            type="tel"
            hint="Например, +996 700 123 456"
            error="Введите номер телефона"
          />
          <Select id="demo-category" label="Категория примера">
            <option>Все категории</option>
            <option>Посуда</option>
          </Select>
          <Input
            id="demo-disabled"
            label="Недоступное поле"
            disabled
            value="Недоступно"
            readOnly
          />
        </div>
        <Textarea
          id="demo-comment"
          label="Комментарий примера"
          placeholder="Уточнения к заказу"
        />
        <Checkbox label="Согласен с условиями примера" />
      </section>
      <section className="sf-panel sf-kit-section" id="states">
        <h2>Статусы и обратная связь</h2>
        <div className="sf-actions">
          <Badge>Нейтральный</Badge>
          <Badge variant="success">В наличии</Badge>
          <Badge variant="warning">Ожидает подтверждения</Badge>
          <Badge variant="danger">Нет в наличии</Badge>
        </div>
        <div className="sf-stack">
          <Alert>Оплата при получении</Alert>
          <Alert variant="success">Демонстрационная заявка принята</Alert>
          <Alert variant="error">Пример ошибки. Проверьте поля.</Alert>
        </div>
      </section>
      <section className="sf-kit-section">
        <h2>Пустые и загрузочные состояния</h2>
        <div className="sf-kit-grid">
          <EmptyState
            title="Ничего не найдено"
            description="Попробуйте другой запрос или измените фильтры."
            action={
              <LinkButton href="#fields" variant="secondary">
                Изменить поиск
              </LinkButton>
            }
          />
          <div className="sf-panel sf-stack" aria-busy="true">
            <p role="status">Демонстрация загрузки…</p>
            <Skeleton style={{ aspectRatio: '1' }} />
            <Skeleton />
            <Skeleton />
          </div>
        </div>
      </section>
    </div>
  );
}
