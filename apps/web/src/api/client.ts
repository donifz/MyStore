let csrf = '';
export function setCsrf(value: string) {
  csrf = value;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: any,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    key?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const r = await fetch('/api' + path, {
    method: options.method ?? 'GET',
    signal: options.signal,
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrf,
      ...(options.key ? { 'idempotency-key': options.key } : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401)
      window.dispatchEvent(new Event('mystore:unauthorized'));
    throw new ApiError(
      r.status,
      typeof data?.message === 'string' ? data.message : 'Ошибка сервера',
      data,
    );
  }
  return data;
}
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Сессия истекла. Войдите снова.';
    if (error.status === 403) return 'Недостаточно прав для этой операции.';
    if (error.status === 404) return 'Товар или документ не найден.';
    if (error.status === 409)
      return error.details?.currentUnitPriceMinor !== undefined
        ? 'Цена изменилась. Подтвердите новую цену.'
        : 'Данные изменились. Проверьте остаток и смену.';
    if (error.status === 429)
      return 'Слишком много попыток. Повторите через минуту.';
    if (error.status >= 500)
      return 'Результат неизвестен. Повторите исходную операцию.';
    return 'Проверьте заполненные поля.';
  }
  return error instanceof TypeError
    ? 'Нет связи с сервером.'
    : error instanceof Error
      ? error.message
      : 'Операция не выполнена.';
}
