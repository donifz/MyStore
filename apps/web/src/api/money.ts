export function parseSom(input: string): number {
  const text = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error('Введите сумму в сомах с точностью до тыйына.');
  const [units, decimals = ''] = text.split('.');
  const amount = BigInt(units) * 100n + BigInt(decimals.padEnd(2, '0'));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Сумма слишком велика.');
  return Number(amount);
}
export function formatSom(amount: number) {
  return (
    new Intl.NumberFormat('ru-KG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100) + ' сом'
  );
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Bishkek',
  }).format(new Date(date));
}
