import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PaymentBottomSheet, {
  type PaymentBottomSheetProps,
} from './PaymentBottomSheet';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const shopId = '11111111-1111-4111-8111-111111111111';

function props(
  overrides: Partial<PaymentBottomSheetProps> = {},
): PaymentBottomSheetProps {
  return {
    open: true,
    onClose: vi.fn(),
    shopId,
    creditMode: false,
    setCreditMode: vi.fn(),
    creditCustomerId: '',
    setCreditCustomerId: vi.fn(),
    setCreditCustomerEligible: vi.fn(),
    creditPaidText: '0',
    setCreditPaidText: vi.fn(),
    creditDueOn: '',
    setCreditDueOn: vi.fn(),
    creditDebtMinor: null,
    loyaltyEnabled: true,
    loyaltyToken: '',
    setLoyaltyToken: vi.fn(),
    redeemPoints: 0,
    setRedeemPoints: vi.fn(),
    originalTotalMinor: 120000,
    method: 'cash',
    setMethod: vi.fn(),
    received: '',
    setReceived: vi.fn(),
    totalText: '1 200,00 сом',
    totalMinor: 120000,
    changeMinor: null,
    receivedMinor: null,
    quickAmounts: [150000, 200000, 500000],
    canSubmit: true,
    isSubmitting: false,
    isSubmissionPending: false,
    onSubmit: vi.fn(),
    ...overrides,
  };
}

it('keeps payment, quick cash, change and submit in a permanent footer', () => {
  const onSubmit = vi.fn();
  const setReceived = vi.fn();
  const { container } = render(
    <PaymentBottomSheet
      {...props({
        onSubmit,
        setReceived,
        received: '1500',
        receivedMinor: 150000,
        changeMinor: 30000n,
      })}
    />,
  );
  const footer = container.querySelector('.pos-sheet-footer');
  const scrollArea = container.querySelector('.pos-sheet-scroll');
  expect(footer).toBeTruthy();
  expect(scrollArea).toBeTruthy();
  expect(scrollArea?.contains(footer)).toBe(false);
  expect(footer?.textContent).toContain('Сдача');
  expect(footer?.textContent).toContain('300,00 сом');
  expect(footer?.textContent).toContain('Быстрые суммы');
  fireEvent.click(screen.getByRole('button', { name: '2 000' }));
  expect(setReceived).toHaveBeenCalledWith('2000');
  fireEvent.click(screen.getByRole('button', { name: /Провести продажу/ }));
  expect(onSubmit).toHaveBeenCalledOnce();
});

it('opens loyalty modal and applies without closing checkout', () => {
  render(<PaymentBottomSheet {...props()} />);
  const trigger = screen.getByRole('button', {
    name: 'QR покупателя',
  });
  expect(trigger.querySelector('svg')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Сканировать QR' })).toBeNull();
  fireEvent.click(trigger);
  const option = screen.getByRole('dialog', { name: 'Карта клиента' });
  expect(option).toBeTruthy();
  expect(option.querySelector('button.pos-sheet-option-apply')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Сканировать QR' })).toBeTruthy();
  expect(screen.getByLabelText('Код карты покупателя')).toBeTruthy();
  expect(screen.getByLabelText('Списать баллов')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
  expect(screen.queryByRole('dialog', { name: 'Карта клиента' })).toBeNull();
  expect(screen.getByRole('dialog', { name: 'Оплата чека' })).toBeTruthy();
});

it('cancels changes to loyalty and keeps checkout open', () => {
  const setRedeemPoints = vi.fn();
  const setLoyaltyToken = vi.fn();
  render(
    <PaymentBottomSheet {...props({ setRedeemPoints, setLoyaltyToken })} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'QR покупателя' }));
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(setRedeemPoints).toHaveBeenCalledWith(0);
  expect(setLoyaltyToken).toHaveBeenCalledWith('');
  expect(screen.queryByRole('dialog', { name: 'Карта клиента' })).toBeNull();
});

it('opens credit modal and keeps checkout footer', () => {
  const setCreditPaidText = vi.fn();
  const { container } = render(
    <PaymentBottomSheet
      {...props({
        creditMode: true,
        creditPaidText: '500',
        creditDebtMinor: 70000,
        loyaltyEnabled: false,
        setCreditPaidText,
      })}
    />,
  );
  const credit = screen.getByRole('button', { name: /Продажа в долг/ });
  expect(credit.querySelector('svg')).toBeTruthy();
  fireEvent.click(credit);
  expect(screen.getByRole('dialog', { name: 'Продажа в долг' })).toBeTruthy();
  const footer = container.querySelector('.pos-sheet-footer');
  expect(footer?.textContent).toContain('В долг');
  expect(footer?.textContent).toContain('700,00 сом');
  expect(footer?.textContent).toContain('Оформить долг');
  expect(footer?.querySelector('input')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(screen.queryByRole('dialog', { name: 'Продажа в долг' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '1 000' }));
  expect(setCreditPaidText).toHaveBeenCalledWith('1000');
});

it('separates buyer selection from bonus and credit and keeps recognizable icons', () => {
  const { container } = render(
    <PaymentBottomSheet {...props({ loyaltyCustomerName: 'Дон' })} />,
  );
  for (const name of ['Покупатель', 'QR покупателя', 'Продажа в долг']) {
    const button = screen.getByRole('button', { name: new RegExp(name) });
    expect(button.querySelector('svg')).toBeTruthy();
  }
  expect(screen.getAllByText('Дон').length).toBeGreaterThanOrEqual(1);
  expect(container.querySelector('.pos-heading-icon svg')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Покупатель/ }));
  const customer = screen.getByRole('dialog', { name: 'Покупатель' });
  expect(customer).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Новый клиент' })).toBeTruthy();
  expect(screen.getByPlaceholderText('Имя или +996…')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Новый клиент' }));
  expect(screen.getByPlaceholderText('+996 700 123 456')).toBeTruthy();
  expect(screen.getByPlaceholderText('Введите адрес')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(screen.queryByRole('dialog', { name: 'Покупатель' })).toBeNull();
  expect(screen.getByRole('dialog', { name: 'Оплата чека' })).toBeTruthy();
});

it('shows money received and checkout discount beside each other without auto discount', () => {
  const setDiscount = vi.fn();
  const setMode = vi.fn();
  const { container } = render(
    <PaymentBottomSheet
      {...props({
        checkoutOriginalMinor: 80000,
        totalMinor: 75000,
        totalText: '750,00 сом',
        checkoutDiscountMinor: 5000,
        checkoutDiscountText: '50',
        setCheckoutDiscountText: setDiscount,
        setCheckoutDiscountMode: setMode,
        received: '750',
        receivedMinor: 75000,
        changeMinor: 0n,
      })}
    />,
  );
  const moneyRow = container.querySelector('.pos-checkout-money-row');
  expect(moneyRow?.textContent).toContain('Получено от покупателя');
  expect(moneyRow?.textContent).toContain('Скидка');
  const input = screen.getByLabelText('Скидка при оплате');
  expect((input as HTMLInputElement).value).toBe('50');
  fireEvent.change(input, { target: { value: '80' } });
  expect(setDiscount).toHaveBeenCalledWith('80');
  fireEvent.click(screen.getByRole('button', { name: '%' }));
  expect(setMode).toHaveBeenCalledWith('percent');
  expect(
    container.querySelector('.pos-summary-discount')?.textContent,
  ).toContain('50,00 сом');
  expect(container.querySelector('.pos-summary-due')?.textContent).toContain(
    '750,00 сом',
  );
});

it('shows active checkmark badge, buyer name, and debt amount on Продажа в долг tile when creditMode is true', () => {
  const { container } = render(
    <PaymentBottomSheet
      {...props({
        creditMode: true,
        creditCustomerId: 'cust-1',
        loyaltyCustomerName: 'Дон',
        creditDebtMinor: 100000,
      })}
    />,
  );
  const creditTile = container.querySelector('.pos-option-credit');
  expect(creditTile?.classList.contains('is-active')).toBe(true);
  expect(
    creditTile?.querySelector('.pos-option-check-badge')?.textContent,
  ).toBe('✓');
  expect(creditTile?.querySelector('.pos-option-buyer')?.textContent).toBe(
    'Дон',
  );
  expect(creditTile?.querySelector('.pos-option-debt')?.textContent).toContain(
    'Долг: 1',
  );
  expect(
    screen.getByRole('button', { name: 'Убрать продажу в долг' }),
  ).toBeTruthy();
});
