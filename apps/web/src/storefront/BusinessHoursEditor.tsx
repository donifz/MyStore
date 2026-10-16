import { BusinessSchedule } from './types';

const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const defaultDay = () => [{ open: '10:00', close: '19:00' }];
export default function BusinessHoursEditor({
  value,
  timeZone,
  disabled,
  onChange,
  onTimeZoneChange,
}: {
  value: BusinessSchedule | null;
  timeZone: string;
  disabled: boolean;
  onChange: (schedule: BusinessSchedule | null) => void;
  onTimeZoneChange: (zone: string) => void;
}) {
  const update = (index: number, day: BusinessSchedule[number]) =>
    onChange(value!.map((current, i) => (i === index ? day : current)));
  return (
    <section
      className="business-hours-card"
      aria-labelledby="business-hours-title"
    >
      <div className="business-hours-heading">
        <div>
          <p className="eyebrow">Время магазина</p>
          <h2 id="business-hours-title">Рабочие часы и резерв</h2>
          <p className="muted">
            Дайте себе время ответить на заказ, даже если он пришёл ночью.
          </p>
        </div>
        <span className="badge">{value ? '2 рабочих часа' : '30 минут'}</span>
      </div>
      <label htmlFor="shop-time-zone">Часовой пояс</label>
      <input
        id="shop-time-zone"
        value={timeZone}
        required
        maxLength={80}
        list="shop-time-zones"
        disabled={disabled}
        aria-describedby="shop-time-zone-hint"
        onChange={(e) => onTimeZoneChange(e.target.value)}
      />
      <datalist id="shop-time-zones">
        <option value="Asia/Bishkek" />
        <option value="Asia/Almaty" />
        <option value="Europe/Berlin" />
        <option value="UTC" />
      </datalist>
      <p id="shop-time-zone-hint" className="muted">
        Например, Asia/Bishkek. В этом поясе показываются сроки заказов.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? Array.from({ length: 7 }, (_, i) =>
                    i < 5 ? defaultDay() : [],
                  )
                : null,
            )
          }
        />
        Учитывать рабочие часы
      </label>
      {value ? (
        <>
          <p className="notice">
            Новый заказ ждёт подтверждения 2 рабочих часа. Выходные и перерывы
            не учитываются.
          </p>
          <div className="actions business-hours-tools">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange(
                  value.map((day, i) =>
                    i < 5 ? value[0].map((v) => ({ ...v })) : day,
                  ),
                )
              }
            >
              Скопировать Пн на будни
            </button>
            <span className="muted">До двух интервалов в день</span>
          </div>
          <div className="business-hours-week">
            {value.map((day, index) => (
              <div key={index} className="business-hours-day">
                <div className="business-hours-day-name">
                  <strong>{days[index]}</strong>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      aria-label={`Выходной, ${days[index]}`}
                      checked={!day.length}
                      onChange={(e) =>
                        update(index, e.target.checked ? [] : defaultDay())
                      }
                    />
                    Выходной
                  </label>
                </div>
                <div className="business-hours-intervals">
                  {!day.length && <span className="muted">Магазин закрыт</span>}
                  {day.map((interval, n) => (
                    <div key={n} className="business-hours-interval">
                      <div>
                        <label htmlFor={`hours-${index}-${n}-open`}>
                          Начало
                        </label>
                        <input
                          id={`hours-${index}-${n}-open`}
                          aria-label={`${days[index]}, начало ${n + 1}`}
                          type="time"
                          required
                          disabled={disabled}
                          value={interval.open}
                          onChange={(e) =>
                            update(
                              index,
                              day.map((v, i) =>
                                i === n ? { ...v, open: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label htmlFor={`hours-${index}-${n}-close`}>
                          Конец
                        </label>
                        <input
                          id={`hours-${index}-${n}-close`}
                          aria-label={`${days[index]}, конец ${n + 1}`}
                          type="time"
                          required
                          disabled={disabled}
                          value={interval.close}
                          onChange={(e) =>
                            update(
                              index,
                              day.map((v, i) =>
                                i === n ? { ...v, close: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="business-hours-remove"
                        disabled={disabled}
                        aria-label={`Удалить интервал ${n + 1}, ${days[index]}`}
                        onClick={() =>
                          update(
                            index,
                            day.filter((_, i) => i !== n),
                          )
                        }
                      >
                        Удалить
                      </button>
                      {interval.close < interval.open && (
                        <small className="business-hours-day-note">
                          До следующего дня
                        </small>
                      )}
                      {interval.close === interval.open && (
                        <small
                          className="error business-hours-day-note"
                          role="alert"
                        >
                          Начало и конец не должны совпадать.
                        </small>
                      )}
                    </div>
                  ))}
                  {!!day.length && day.length < 2 && (
                    <button
                      type="button"
                      className="business-hours-add"
                      disabled={disabled}
                      aria-label={`Добавить интервал, ${days[index]}`}
                      onClick={() =>
                        update(index, [
                          ...day,
                          { open: '19:00', close: '21:00' },
                        ])
                      }
                    >
                      + Интервал
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="notice">
          Расписание не настроено: резерв нового заказа — 30 минут. Включите
          рабочие часы, чтобы ночи и выходные не сокращали время ответа.
        </p>
      )}
    </section>
  );
}
