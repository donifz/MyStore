import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';

type Summary = {
  revenueMinor: number;
  salesMinor: number;
  returnsMinor: number;
  costOfGoodsMinor: number;
  grossProfitMinor: number;
  paymentsReceivedMinor: number;
  paymentsRefundedMinor: number;
  cashReceivedMinor: number;
  cardReceivedMinor: number;
  physicalUnits: number;
  reservedUnits: number;
  stockValueMinor: number;
  lowStockCount: number;
  openOrders: number;
  issuedOrders: number;
  closedShifts: number;
  cashDiscrepancyMinor: number;
};
const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KGS' }).format(n / 100);

export default function ReportsPage() {
  const { shopId = '' } = useParams();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void api<Summary>(`/shops/${shopId}/reports/summary`)
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [shopId]);
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!data) return <p className="loading">Загрузка отчёта…</p>;
  const cards: [string, string][] = [
    ['Выручка за вычетом возвратов', money(data.revenueMinor)],
    ['Себестоимость проданного', money(data.costOfGoodsMinor)],
    ['Валовая прибыль', money(data.grossProfitMinor)],
    ['Получено оплат', money(data.paymentsReceivedMinor - data.paymentsRefundedMinor)],
    ['Наличные', money(data.cashReceivedMinor)],
    ['Карта', money(data.cardReceivedMinor)],
    ['Стоимость остатка', money(data.stockValueMinor)],
    ['Доступно / резерв', `${data.physicalUnits - data.reservedUnits} / ${data.reservedUnits}`],
    ['Товаров с низким остатком', String(data.lowStockCount)],
    ['Открытых заказов', String(data.openOrders)],
    ['Закрытых смен', String(data.closedShifts)],
    ['Расхождение кассы', money(data.cashDiscrepancyMinor)],
  ];
  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">Финансы и склад</p><h1>Отчёты</h1></div>
      </div>
      <p className="muted">Валовая прибыль не учитывает аренду, зарплаты, налоги и другие расходы бизнеса.</p>
      <div className="stat-grid">
        {cards.map(([label, value]) => <article className="panel" key={label}><small>{label}</small><h2>{value}</h2></article>)}
      </div>
      <div className="panel">
        <h2>CSV-экспорт</h2>
        <div className="actions">
          {['products','stock','sales','orders'].map((kind) => (
            <a className="button secondary" key={kind} href={`/api/shops/${shopId}/reports/export/${kind}.csv`}>
              {kind === 'products' ? 'Товары' : kind === 'stock' ? 'Остатки' : kind === 'sales' ? 'Продажи' : 'Заказы'}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
