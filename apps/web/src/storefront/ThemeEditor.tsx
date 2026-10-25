import { ChangeEvent } from 'react';
import { ThemeBlock, ThemePresentation } from './types';

const themes = [
  ['base', 'Базовая'],
  ['new-year', 'Новый год'],
  ['womens-day', '8 Марта'],
  ['nooruz', 'Нооруз'],
] as const;

export default function ThemeEditor({
  value,
  disabled,
  onChange,
}: {
  value: ThemePresentation;
  disabled?: boolean;
  onChange: (value: ThemePresentation) => void;
}) {
  const scheduled = Boolean(value.startsAt && value.endsAt);
  const updateBlock = (name: 'hero' | 'info', patch: Partial<ThemeBlock>) =>
    onChange({ ...value, [name]: { ...value[name], ...patch } });
  const upload = (name: 'hero' | 'info', e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      updateBlock(name, { imageDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };
  return (
    <section className={`theme-editor theme-editor--${value.id}`}>
      <h2>Оформление витрины</h2>
      <label htmlFor="storefront-theme">Тематика</label>
      <select
        id="storefront-theme"
        disabled={disabled}
        value={value.id}
        onChange={(e) =>
          onChange({ ...value, id: e.target.value as ThemePresentation['id'] })
        }
      >
        {themes.map(([id, label]) => (
          <option value={id} key={id}>
            {label}
          </option>
        ))}
      </select>
      <label className="checkbox">
        <input
          type="checkbox"
          disabled={disabled}
          checked={scheduled}
          onChange={(e) =>
            onChange({
              ...value,
              startsAt: e.target.checked
                ? new Date(Date.now() + 60_000).toISOString()
                : null,
              endsAt: e.target.checked
                ? new Date(Date.now() + 86_400_000).toISOString()
                : null,
            })
          }
        />
        Показывать по расписанию
      </label>
      {scheduled && (
        <div className="theme-schedule">
          <label>
            Начало показа
            <input
              type="datetime-local"
              disabled={disabled}
              value={value.startsAt?.slice(0, 16) || ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  startsAt: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
            />
          </label>
          <label>
            Окончание показа
            <input
              type="datetime-local"
              disabled={disabled}
              value={value.endsAt?.slice(0, 16) || ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  endsAt: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
            />
          </label>
        </div>
      )}
      {(['hero', 'info'] as const).map((name) => {
        const block = value[name] || {};
        const title =
          name === 'hero' ? 'Главный баннер' : 'Информационный блок';
        return (
          <fieldset className="theme-block-editor" key={name}>
            <legend>{title}</legend>
            <label>
              Заголовок
              <input
                maxLength={160}
                disabled={disabled}
                value={block.title || ''}
                onChange={(e) => updateBlock(name, { title: e.target.value })}
              />
            </label>
            <label>
              Текст
              <textarea
                rows={3}
                maxLength={1000}
                disabled={disabled}
                value={block.text || ''}
                onChange={(e) => updateBlock(name, { text: e.target.value })}
              />
            </label>
            <label>
              Ссылка
              <input
                maxLength={1000}
                disabled={disabled}
                placeholder="/ или https://…"
                value={block.link || ''}
                onChange={(e) => updateBlock(name, { link: e.target.value })}
              />
            </label>
            <label>
              Текст кнопки
              <input
                maxLength={80}
                disabled={disabled}
                value={block.buttonLabel || ''}
                onChange={(e) =>
                  updateBlock(name, { buttonLabel: e.target.value })
                }
              />
            </label>
            <label>
              Изображение JPEG
              <input
                type="file"
                accept="image/jpeg"
                disabled={disabled}
                onChange={(e) => upload(name, e)}
              />
            </label>
            <label>
              Alt-текст изображения
              <input
                maxLength={160}
                disabled={disabled}
                value={block.imageAlt || ''}
                onChange={(e) =>
                  updateBlock(name, { imageAlt: e.target.value })
                }
              />
            </label>
          </fieldset>
        );
      })}
      <div className="theme-preview" aria-label="Предпросмотр темы">
        <small>Предпросмотр</small>
        <strong>{value.hero?.title || 'Название магазина'}</strong>
        {value.hero?.text && <p>{value.hero.text}</p>}
      </div>
    </section>
  );
}
