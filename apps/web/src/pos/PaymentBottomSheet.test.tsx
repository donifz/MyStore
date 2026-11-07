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

it('shows compact loyalty controls and QR scanner only when expanded', () => {
  render(<PaymentBottomSheet {...props()} />);
  expect(screen.queryByRole('button', { name: 'Сканировать QR' })).toBeNull();
  const trigger = screen.getByRole('button', { name: /Бонусы \/ скидка/ });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('button', { name: 'Сканировать QR' })).toBeTruthy();
  expect(screen.getByLabelText('Код карты покупателя')).toBeTruthy();
  expect(screen.getByLabelText('Списать баллов')).toBeTruthy();
  expect(screen.getByText(/Только подтверждённый покупатель/)).toBeTruthy();
});

it('has a collapsible credit section and up-front amount in the fixed footer', () => {
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
  expect(credit.getAttribute('aria-expanded')).toBe('true');
  const footer = container.querySelector('.pos-sheet-footer');
  expect(footer?.textContent).toContain('В долг');
  expect(footer?.textContent).toContain('700,00 сом');
  expect(footer?.textContent).toContain('Оформить долг');
  expect(footer?.querySelector('input')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /1\s000/ }));
  expect(setCreditPaidText).toHaveBeenCalledWith('1000');
});
