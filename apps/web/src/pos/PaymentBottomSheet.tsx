import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { formatSom } from '../api/money';
import CreditFields from './CreditFields';
import LoyaltyCheckout, { type CustomerQrProfile } from './LoyaltyCheckout';
import PaymentIcon from './PaymentIcon';
import type { CheckoutDiscountMode } from './checkout-discount';
import './payment-bottom-sheet.css';

const creditSalesEnabled =
  import.meta.env.DEV || import.meta.env.VITE_CREDIT_SALES_ENABLED === 'true';
const wholeSom = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const formatQuickSom = (amount: number) =>
  wholeSom.format(amount).replace(/[\u00a0\u202f]/g, ' ');

export type PaymentBottomSheetProps = {
  open: boolean;
  /** Render the same checkout experience inline on desktop, without a page overlay. */
  embedded?: boolean;
  onClose: () => void;
  shopId: string;
  shiftId?: string;
  creditMode: boolean;
  setCreditMode: (value: boolean) => void;
  creditCustomerId: string;
  setCreditCustomerId: (value: string) => void;
  setCreditCustomerEligible: (value: boolean) => void;
  creditPaidText: string;
  setCreditPaidText: (value: string) => void;
  creditDueOn: string;
  setCreditDueOn: (value: string) => void;
  creditDebtMinor: number | null;
  loyaltyEnabled: boolean;
  loyaltyToken: string;
  setLoyaltyToken: (value: string) => void;
  loyaltyCustomerName?: string;
  onLoyaltyProfileLoaded?: (profile: CustomerQrProfile | null) => void;
  redeemPoints: number;
  setRedeemPoints: (value: number) => void;
  originalTotalMinor: number;
  checkoutOriginalMinor?: number;
  checkoutDiscountText?: string;
  setCheckoutDiscountText?: (value: string) => void;
  checkoutDiscountMode?: CheckoutDiscountMode;
  setCheckoutDiscountMode?: (value: CheckoutDiscountMode) => void;
  checkoutDiscountMinor?: number;
  checkoutDiscountError?: string;
  method: 'cash' | 'card';
  setMethod: (m: 'cash' | 'card') => void;
  received: string;
  setReceived: (v: string) => void;
  totalText: string;
  totalMinor: number;
  changeMinor: bigint | null;
  receivedMinor: number | null;
  receivedError?: string;
  quickAmounts: number[];
  canSubmit: boolean;
  isSubmitting: boolean;
  isSubmissionPending: boolean;
  onSubmit: () => void;
  error?: string;
  success?: string;
  onNewReceipt?: () => void;
};

export default function PaymentBottomSheet({
  open,
  embedded = false,
  onClose,
  method,
  setMethod,
  shopId,
  shiftId,
  creditMode,
  setCreditMode,
  creditCustomerId,
  setCreditCustomerId,
  setCreditCustomerEligible,
  creditPaidText,
  setCreditPaidText,
  creditDueOn,
  setCreditDueOn,
  creditDebtMinor,
  loyaltyEnabled,
  loyaltyToken,
  setLoyaltyToken,
  loyaltyCustomerName,
  onLoyaltyProfileLoaded,
  redeemPoints,
  setRedeemPoints,
  originalTotalMinor,
  checkoutOriginalMinor = originalTotalMinor,
  checkoutDiscountText = '',
  setCheckoutDiscountText = () => undefined,
  checkoutDiscountMode = 'som',
  setCheckoutDiscountMode = () => undefined,
  checkoutDiscountMinor = 0,
  checkoutDiscountError = '',
  received,
  setReceived,
  totalText,
  totalMinor,
  changeMinor,
  receivedMinor,
  receivedError,
  quickAmounts,
  canSubmit,
  isSubmitting,
  isSubmissionPending,
  onSubmit,
  error,
  success,
  onNewReceipt,
}: PaymentBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<
    'bonus' | 'credit' | 'customer' | null
  >(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [selectedCustomerDebt, setSelectedCustomerDebt] = useState(0);
  const [selectedCustomerPoints, setSelectedCustomerPoints] = useState(0);
  const [terminalQr, setTerminalQr] = useState<{
    enabled: boolean;
    paymentQrData: string | null;
    paymentQrLabel: string;
    showQrOnCheckout: boolean;
  } | null>(null);
  const returnToCredit = useRef(false);
  const previousCustomer = useRef({ id: '', name: '', debt: 0, points: 0 });
  useEffect(() => {
    if (!open || !shopId) return;
    let alive = true;
    api<{
      enabled: boolean;
      paymentQrData: string | null;
      paymentQrLabel: string;
      showQrOnCheckout: boolean;
    }>(`/shops/${shopId}/pos/terminal/settings`)
      .then((res) => {
        if (alive) setTerminalQr(res);
      })
      .catch(() => {
        if (alive) setTerminalQr(null);
      });
    return () => {
      alive = false;
    };
  }, [open, shopId]);
  useEffect(() => {
    if (!creditCustomerId) {
      setSelectedCustomerName('');
      setSelectedCustomerDebt(0);
      setSelectedCustomerPoints(0);
    }
  }, [creditCustomerId]);
  function openCustomer(fromCredit = false) {
    previousCustomer.current = {
      id: creditCustomerId,
      name: selectedCustomerName,
      debt: selectedCustomerDebt,
      points: selectedCustomerPoints,
    };
    returnToCredit.current = fromCredit;
    setActivePanel('customer');
  }
  function openBonus() {
    previousBonus.current = { token: loyaltyToken, points: redeemPoints };
    setActivePanel('bonus');
  }
  const previousBonus = useRef({ token: '', points: 0 });
  const previousCredit = useRef({
    enabled: false,
    customerId: '',
    paid: '0',
    dueOn: '',
    customerName: '',
    debt: 0,
    points: 0,
  });

  function cancelPanel() {
    if (activePanel === 'customer') {
      const previous = previousCustomer.current;
      setCreditCustomerId(previous.id);
      setCreditCustomerEligible(Boolean(previous.id));
      setSelectedCustomerName(previous.name);
      setSelectedCustomerDebt(previous.debt);
      setSelectedCustomerPoints(previous.points);
      setActivePanel(returnToCredit.current ? 'credit' : null);
      return;
    }
    if (activePanel === 'bonus') {
      setLoyaltyToken(previousBonus.current.token);
      setRedeemPoints(previousBonus.current.points);
    } else if (activePanel === 'credit') {
      const previous = previousCredit.current;
      setCreditMode(previous.enabled);
      setCreditCustomerId(previous.customerId);
      setCreditCustomerEligible(Boolean(previous.customerId));
      setCreditPaidText(previous.paid);
      setCreditDueOn(previous.dueOn);
      setSelectedCustomerName(previous.customerName);
      setSelectedCustomerDebt(previous.debt);
      setSelectedCustomerPoints(previous.points);
    }
    setActivePanel(null);
  }

  useEffect(() => {
    if (!open || (embedded && !activePanel)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activePanel) cancelPanel();
        else if (!embedded) onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, embedded, onClose, activePanel]);

  if (!open) return null;

  const isShort = changeMinor !== null && changeMinor < 0n;
  const isChange = changeMinor !== null && changeMinor >= 0n;
  const paymentPending = isSubmitting || isSubmissionPending;
  const creditQuick = [0, 500, 1000, 2000, 5000].filter(
    (som) => som * 100 < originalTotalMinor,
  );

  return (
    <div
      className={
        embedded ? 'pos-sheet-root pos-sheet-embedded' : 'pos-sheet-root'
      }
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-label="Оплата чека"
    >
      {!embedded && (
        <div
          className="pos-sheet-backdrop"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <div className="pos-sheet-drawer" ref={sheetRef}>
        <div className="pos-sheet-handle" aria-hidden="true" />
        <div className="pos-sheet-head">
          <div className="pos-sheet-head-copy">
            <h2>
              <span className="pos-heading-icon">
                <PaymentIcon name="cart" size={22} />
              </span>{' '}
              Оплата чека
            </h2>
            <strong className="pos-sheet-total">К оплате: {totalText}</strong>
          </div>
          {!embedded && (
            <button
              type="button"
              className="pos-sheet-close"
              aria-label="Закрыть оплату"
              onClick={onClose}
            >
              <PaymentIcon name="close" size={21} />
            </button>
          )}
        </div>

        {success ? (
          <div
            className="pos-sheet-success"
            role={embedded ? undefined : 'status'}
          >
            <div className="pos-sheet-success-icon" aria-hidden="true">
              <PaymentIcon name="check" size={26} />
            </div>
            <h3>Продажа проведена</h3>
            <p className="muted">
              {success} · Чек отправлен на терминал печати
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button secondary pos-sheet-new-btn"
                onClick={() => window.print()}
              >
                Печать чека
              </button>
              <button
                type="button"
                className="button primary pos-sheet-new-btn"
                onClick={() => {
                  onClose();
                  onNewReceipt?.();
                }}
              >
                Новый чек
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="pos-sheet-body pos-sheet-scroll">
              <fieldset className="pos-methods" disabled={paymentPending}>
                <legend className="pos-sheet-section-title">
                  Способ оплаты
                </legend>
                <div className="pos-methods-grid">
                  <label
                    className={
                      method === 'cash' ? 'pos-method selected' : 'pos-method'
                    }
                  >
                    <input
                      type="radio"
                      name="bottom-sheet-method"
                      value="cash"
                      checked={method === 'cash'}
                      disabled={paymentPending}
                      onChange={() => setMethod('cash')}
                    />
                    <PaymentIcon name="cash" />
                    <span>Наличные</span>
                  </label>
                  <label
                    className={
                      method === 'card' ? 'pos-method selected' : 'pos-method'
                    }
                  >
                    <input
                      type="radio"
                      name="bottom-sheet-method"
                      value="card"
                      checked={method === 'card'}
                      disabled={paymentPending}
                      onChange={() => setMethod('card')}
                    />
                    <PaymentIcon name="card" />
                    <span>Безналичные</span>
                  </label>
                  {loyaltyEnabled && (
                    <button
                      type="button"
                      className={`pos-method pos-method-qr${loyaltyToken || loyaltyCustomerName ? ' selected' : ''}`}
                      aria-label="QR покупателя"
                      title={
                        loyaltyCustomerName
                          ? `Карта: ${loyaltyCustomerName}`
                          : 'Карта клиента (QR)'
                      }
                      disabled={paymentPending}
                      onClick={openBonus}
                    >
                      <PaymentIcon name="qr" size={20} />
                      <span>QR</span>
                    </button>
                  )}
                </div>
              </fieldset>

              <section className="pos-payment-option pos-option-customer">
                <button
                  type="button"
                  className="pos-option-trigger"
                  disabled={paymentPending}
                  aria-haspopup="dialog"
                  onClick={() => openCustomer()}
                >
                  <span className="pos-option-icon" aria-hidden="true">
                    <PaymentIcon name="user" />
                  </span>
                  <strong>Покупатель</strong>
                  <span className="pos-option-detail">
                    {selectedCustomerName || loyaltyCustomerName || 'Не выбран'}
                  </span>
                  <span className="pos-option-chevron" aria-hidden="true">
                    <PaymentIcon name="chevron" size={18} />
                  </span>
                </button>
              </section>

              {creditSalesEnabled && (
                <section
                  className={`pos-payment-option pos-option-credit${creditMode ? ' is-active' : ''}`}
                >
                  {creditMode && (
                    <span className="pos-option-check-badge" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  <button
                    type="button"
                    className="pos-option-trigger"
                    disabled={paymentPending}
                    aria-haspopup="dialog"
                    aria-pressed={creditMode}
                    onClick={() => {
                      previousCredit.current = {
                        enabled: creditMode,
                        customerId: creditCustomerId,
                        paid: creditPaidText,
                        dueOn: creditDueOn,
                        customerName: selectedCustomerName,
                        debt: selectedCustomerDebt,
                        points: selectedCustomerPoints,
                      };
                      if (!creditMode) setCreditMode(true);
                      setActivePanel('credit');
                    }}
                  >
                    <span className="pos-option-icon" aria-hidden="true">
                      <PaymentIcon name="coins" />
                    </span>
                    <strong>Продажа в долг</strong>
                    <span className="pos-option-state">
                      {creditMode ? (
                        <>
                          {(selectedCustomerName || loyaltyCustomerName) && (
                            <span className="pos-option-buyer">
                              {selectedCustomerName || loyaltyCustomerName}
                            </span>
                          )}
                          <span className="pos-option-debt">
                            {creditDebtMinor === null
                              ? 'Долг: расчёт…'
                              : 'Долг: ' + formatSom(creditDebtMinor)}
                          </span>
                        </>
                      ) : selectedCustomerName || loyaltyCustomerName ? (
                        <span className="pos-option-buyer">
                          {selectedCustomerName || loyaltyCustomerName}
                        </span>
                      ) : selectedCustomerDebt > 0 ? (
                        'Долг: ' + formatSom(selectedCustomerDebt)
                      ) : (
                        ''
                      )}
                    </span>
                    <span className="pos-option-chevron" aria-hidden="true">
                      <PaymentIcon name="chevron" size={18} />
                    </span>
                  </button>
                  {creditMode && (
                    <button
                      type="button"
                      className="pos-option-clear"
                      disabled={paymentPending}
                      aria-label="Убрать продажу в долг"
                      onClick={() => setCreditMode(false)}
                    >
                      <PaymentIcon name="close" size={18} />
                    </button>
                  )}
                </section>
              )}
              {method === 'card' && !creditMode && (
                <div className="pos-sheet-payment-hint">
                  {terminalQr?.enabled &&
                  terminalQr.paymentQrData &&
                  terminalQr.showQrOnCheckout ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem',
                        background: '#fff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        marginTop: '0.5rem',
                      }}
                    >
                      <img
                        src={terminalQr.paymentQrData}
                        alt={terminalQr.paymentQrLabel || 'QR для оплаты'}
                        style={{
                          width: '180px',
                          height: '180px',
                          objectFit: 'contain',
                        }}
                      />
                      <strong>
                        {terminalQr.paymentQrLabel || 'Оплата по QR'}
                      </strong>
                      <span className="muted">К оплате: {totalText}</span>
                    </div>
                  ) : (
                    <p>После оплаты на терминале подтвердите продажу.</p>
                  )}
                </div>
              )}
            </div>

            <div className="pos-sheet-footer">
              {!creditMode && method === 'cash' && (
                <div className="pos-sheet-cash-section">
                  <div className="pos-checkout-money-row">
                    <label className="pos-received">
                      <span>
                        <PaymentIcon name="wallet" size={17} /> Получено от
                        покупателя, сом
                      </span>
                      <input
                        inputMode="decimal"
                        placeholder="0,00"
                        disabled={paymentPending}
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                      />
                    </label>
                    <label className="pos-discount-field">
                      <span>
                        <PaymentIcon name="tag" size={17} /> Скидка, сом / %
                      </span>
                      <span className="pos-discount-control">
                        <input
                          inputMode="decimal"
                          aria-label="Скидка при оплате"
                          value={checkoutDiscountText}
                          disabled={paymentPending}
                          placeholder="0,00"
                          onChange={(event) =>
                            setCheckoutDiscountText(event.target.value)
                          }
                        />
                        <span
                          className="pos-discount-modes"
                          role="group"
                          aria-label="Единица скидки"
                        >
                          <button
                            type="button"
                            className={
                              checkoutDiscountMode === 'som' ? 'selected' : ''
                            }
                            aria-pressed={checkoutDiscountMode === 'som'}
                            disabled={paymentPending}
                            onClick={() => setCheckoutDiscountMode('som')}
                          >
                            сом
                          </button>
                          <button
                            type="button"
                            className={
                              checkoutDiscountMode === 'percent'
                                ? 'selected'
                                : ''
                            }
                            aria-pressed={checkoutDiscountMode === 'percent'}
                            disabled={paymentPending}
                            onClick={() => setCheckoutDiscountMode('percent')}
                          >
                            %
                          </button>
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="pos-quick">
                    <span className="pos-quick-label">Быстрые суммы</span>
                    <div className="pos-quick-buttons">
                      <button
                        type="button"
                        className={
                          receivedMinor === totalMinor && totalMinor > 0
                            ? 'pos-quick-button selected'
                            : 'pos-quick-button'
                        }
                        disabled={paymentPending || totalMinor <= 0}
                        onClick={() =>
                          setReceived((totalMinor / 100).toString())
                        }
                      >
                        Без сдачи
                      </button>
                      {quickAmounts.map((amount) => (
                        <button
                          type="button"
                          key={amount}
                          className={
                            receivedMinor === amount
                              ? 'pos-quick-button selected'
                              : 'pos-quick-button'
                          }
                          disabled={paymentPending}
                          onClick={() => setReceived((amount / 100).toString())}
                        >
                          {wholeSom
                            .format(amount / 100)
                            .replace(/\u00a0/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {creditMode && (
                <div className="pos-sheet-cash-section">
                  <label className="pos-received">
                    Оплачено сейчас, сом
                    <input
                      inputMode="decimal"
                      value={creditPaidText}
                      disabled={paymentPending}
                      onChange={(e) => setCreditPaidText(e.target.value)}
                    />
                  </label>
                  <div className="pos-quick">
                    <span className="pos-quick-label">Быстрые суммы</span>
                    <div className="pos-quick-buttons">
                      {creditQuick.map((amount) => (
                        <button
                          type="button"
                          key={amount}
                          disabled={paymentPending}
                          className={
                            Number(creditPaidText) === amount
                              ? 'pos-quick-button selected'
                              : 'pos-quick-button'
                          }
                          onClick={() => setCreditPaidText(amount.toString())}
                        >
                          {amount === 0 ? 'Без взноса' : formatQuickSom(amount)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {checkoutDiscountError && (
                <p role="alert" className="pos-sheet-warning">
                  {checkoutDiscountError}
                </p>
              )}
              {receivedError && !creditMode && (
                <p role="alert" className="error">
                  {receivedError}
                </p>
              )}
              {isShort && !creditMode && (
                <p role="alert" className="pos-sheet-warning">
                  Не хватает средств для оплаты.
                </p>
              )}

              <div className="pos-totals pos-sheet-totals pos-checkout-summary">
                <div className="pos-total-tile pos-summary-original">
                  <span>
                    <PaymentIcon name="cart" size={16} /> Сумма
                  </span>
                  <strong>{formatSom(checkoutOriginalMinor)}</strong>
                </div>
                <div className="pos-total-tile pos-summary-discount">
                  <span>
                    <PaymentIcon name="tag" size={16} /> Скидка
                  </span>
                  <strong>− {formatSom(checkoutDiscountMinor)}</strong>
                </div>
                <div className="pos-total-tile pos-summary-due">
                  <span>
                    <PaymentIcon name="wallet" size={16} /> К оплате
                  </span>
                  <strong>{totalText}</strong>
                </div>
              </div>
              <div className="pos-totals pos-sheet-totals pos-change-row">
                <div
                  role={changeMinor !== null ? 'status' : undefined}
                  className={
                    !creditMode && isShort
                      ? 'pos-total-tile short'
                      : isChange
                        ? 'pos-total-tile change'
                        : 'pos-total-tile'
                  }
                >
                  <span>{!creditMode && isShort ? 'Не хватает' : 'Сдача'}</span>
                  <strong>
                    {creditMode || changeMinor === null
                      ? '—'
                      : formatSom(
                          Number(
                            changeMinor >= 0n ? changeMinor : -changeMinor,
                          ),
                        )}
                  </strong>
                </div>
              </div>
              {creditMode && (
                <div className="pos-sheet-credit-total">
                  <span>В долг</span>
                  <strong>
                    {creditDebtMinor === null
                      ? '—'
                      : formatSom(creditDebtMinor)}
                  </strong>
                </div>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button
                type="button"
                className="pos-submit pos-sheet-submit"
                aria-label={
                  embedded
                    ? isSubmitting
                      ? 'Проведение…'
                      : isSubmissionPending
                        ? 'Повторить исходный запрос'
                        : creditMode
                          ? 'Оформить долг'
                          : 'Провести продажу'
                    : undefined
                }
                disabled={!canSubmit || isSubmitting}
                onClick={onSubmit}
              >
                <span aria-hidden="true">
                  <PaymentIcon name="check" size={19} />
                </span>
                <span>
                  {isSubmitting
                    ? 'Проведение…'
                    : isSubmissionPending
                      ? 'Повторить исходный запрос'
                      : creditMode
                        ? `Оформить долг — ${creditDebtMinor === null ? '—' : formatSom(creditDebtMinor)}`
                        : `Провести продажу — ${totalText}`}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
      {activePanel && (
        <div className="pos-sheet-option-layer">
          <div
            className="pos-sheet-option-backdrop"
            aria-hidden="true"
            onClick={cancelPanel}
          />
          <section
            className="pos-sheet-option-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={
              activePanel === 'credit'
                ? 'Продажа в долг'
                : activePanel === 'customer'
                  ? 'Покупатель'
                  : 'Карта клиента'
            }
          >
            <div className="pos-sheet-option-handle" aria-hidden="true" />
            <div className="pos-sheet-option-head">
              <span className="pos-sheet-option-title">
                <span
                  className={
                    activePanel === 'credit'
                      ? 'option-graphic credit'
                      : activePanel === 'customer'
                        ? 'option-graphic customer'
                        : 'option-graphic'
                  }
                >
                  <PaymentIcon
                    name={
                      activePanel === 'credit'
                        ? 'coins'
                        : activePanel === 'customer'
                          ? 'user'
                          : 'qr'
                    }
                    size={22}
                  />
                </span>
                <strong>
                  {activePanel === 'credit'
                    ? 'Продажа в долг'
                    : activePanel === 'customer'
                      ? 'Покупатель'
                      : 'Карта клиента'}
                </strong>
              </span>
              <button
                type="button"
                className="pos-sheet-close"
                aria-label="Закрыть настройки"
                onClick={cancelPanel}
              >
                <PaymentIcon name="close" size={21} />
              </button>
            </div>
            <div className="pos-sheet-option-scroll">
              {activePanel === 'credit' ? (
                <CreditFields
                  selectionOnly
                  selectedCustomerName={
                    selectedCustomerName || loyaltyCustomerName
                  }
                  onOpenCustomer={() => openCustomer(true)}
                  shopId={shopId}
                  enabled
                  disabled={paymentPending}
                  customerId={creditCustomerId}
                  onCustomerChange={setCreditCustomerId}
                  onCustomerEligible={setCreditCustomerEligible}
                  paid={creditPaidText}
                  onPaidChange={setCreditPaidText}
                  dueOn={creditDueOn}
                  onDueChange={setCreditDueOn}
                  debtMinor={creditDebtMinor}
                />
              ) : activePanel === 'customer' ? (
                <CreditFields
                  shopId={shopId}
                  enabled
                  customerOnly
                  disabled={paymentPending}
                  customerId={creditCustomerId}
                  onCustomerChange={setCreditCustomerId}
                  onCustomerEligible={setCreditCustomerEligible}
                  onSelectedCustomer={(customer) => {
                    setSelectedCustomerName(customer.name);
                    setSelectedCustomerDebt(Number(customer.debtMinor || 0));
                    setSelectedCustomerPoints(
                      Number(customer.balancePoints || 0),
                    );
                  }}
                  paid={creditPaidText}
                  onPaidChange={setCreditPaidText}
                  dueOn={creditDueOn}
                  onDueChange={setCreditDueOn}
                  debtMinor={creditDebtMinor}
                />
              ) : (
                <>
                  <p className="pos-option-subtitle">
                    Сканируйте QR покупателя, чтобы увидеть долг и бонусы,
                    погасить долг или списать баллы.
                  </p>
                  <LoyaltyCheckout
                    shopId={shopId}
                    shiftId={shiftId}
                    token={loyaltyToken}
                    setToken={setLoyaltyToken}
                    points={redeemPoints}
                    setPoints={setRedeemPoints}
                    totalMinor={originalTotalMinor}
                    disabled={paymentPending}
                    onProfileLoaded={onLoyaltyProfileLoaded}
                  />
                </>
              )}
            </div>
            <div className="pos-sheet-option-actions">
              <button
                type="button"
                className="pos-sheet-option-cancel"
                onClick={cancelPanel}
              >
                Отмена
              </button>
              <button
                type="button"
                className="pos-sheet-option-apply"
                disabled={
                  paymentPending ||
                  (activePanel === 'customer' && !creditCustomerId) ||
                  (activePanel === 'credit' &&
                    (!creditCustomerId ||
                      creditDebtMinor === null ||
                      creditDebtMinor <= 0 ||
                      !creditDueOn)) ||
                  (activePanel === 'bonus' &&
                    (redeemPoints > Math.floor(originalTotalMinor / 500) ||
                      (redeemPoints > 0 &&
                        !/^[A-Za-z0-9_-]{43}$/.test(loyaltyToken))))
                }
                onClick={() => {
                  setActivePanel(
                    activePanel === 'customer' && returnToCredit.current
                      ? 'credit'
                      : null,
                  );
                }}
              >
                {activePanel === 'customer'
                  ? 'Выбрать клиента'
                  : activePanel === 'bonus'
                    ? redeemPoints > 0
                      ? 'Применить бонусы'
                      : 'Готово'
                    : 'Применить'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
