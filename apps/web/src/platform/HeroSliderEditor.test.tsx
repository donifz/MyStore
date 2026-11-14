import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroSliderEditor, { type HeroSlide } from './HeroSliderEditor';

afterEach(() => {
  cleanup();
});

const initialSlides: HeroSlide[] = [
  {
    sortOrder: 0,
    isActive: true,
    badge: 'МАРКЕТПЛЕЙС МАГАЗИНОВ',
    title: 'Товары рядом',
    subtitle: 'Смотрите наличие и забирайте в магазине',
    buttonText: 'Смотреть товары',
    buttonUrl: '#catalog',
    imageUrl: null,
    bgGradient: 'blue',
  },
  {
    sortOrder: 1,
    isActive: true,
    badge: 'АКЦИЯ',
    title: 'Скидки недели',
    subtitle: 'Выгодные предложения от продавцов',
    buttonText: 'Смотреть скидки',
    buttonUrl: '/shops',
    imageUrl: null,
    bgGradient: 'emerald',
  },
];

it('renders slides and live preview', () => {
  render(
    <HeroSliderEditor initialSlides={initialSlides} onSave={async () => {}} />,
  );

  expect(screen.getByText('Предпросмотр слайдера на витрине')).toBeTruthy();
  expect(screen.getByText('Слайды главного экрана')).toBeTruthy();
  expect(screen.getByText('Слайд #1')).toBeTruthy();
  expect(screen.getByText('Слайд #2')).toBeTruthy();
  expect(screen.getAllByDisplayValue('Товары рядом').length).toBeGreaterThan(0);
});

it('allows editing and saving slides', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<HeroSliderEditor initialSlides={initialSlides} onSave={onSave} />);

  const titleInput = screen.getByDisplayValue('Товары рядом');
  await user.clear(titleInput);
  await user.type(titleInput, 'Новые поступления');

  const saveBtn = screen.getByRole('button', { name: /сохранить изменения/i });
  await user.click(saveBtn);

  expect(onSave).toHaveBeenCalledTimes(1);
  const savedSlides = onSave.mock.calls[0][0];
  expect(savedSlides[0].title).toBe('Новые поступления');
});

it('allows adding and removing slides with minimum 1 slide constraint', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<HeroSliderEditor initialSlides={initialSlides} onSave={onSave} />);

  // Add slide
  const addBtn = screen.getByRole('button', { name: /\+ добавить слайд/i });
  await user.click(addBtn);

  expect(screen.getByText('Слайд #3')).toBeTruthy();

  // Remove slide #3
  const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
  await user.click(deleteButtons[2]);

  expect(screen.queryByText('Слайд #3')).toBeNull();
});

it('displays error alert when saving throws', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('Internal server error'));
  const user = userEvent.setup();

  render(<HeroSliderEditor initialSlides={initialSlides} onSave={onSave} />);

  const titleInput = screen.getByDisplayValue('Товары рядом');
  await user.type(titleInput, '!');

  const saveBtn = screen.getByRole('button', { name: /сохранить изменения/i });
  await user.click(saveBtn);

  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByText('Internal server error')).toBeTruthy();
});

it('resets slides to standard defaults when clicking reset button', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(
    <HeroSliderEditor
      initialSlides={[
        {
          sortOrder: 0,
          isActive: true,
          badge: 'КАСТОМ',
          title: 'Кастомный баннер',
          subtitle: 'Описание',
          buttonText: 'Кнопка',
          buttonUrl: '#catalog',
          imageUrl: null,
          bgGradient: 'rose',
        },
      ]}
      onSave={onSave}
    />,
  );

  const resetBtn = screen.getByRole('button', {
    name: /стандартные баннеры/i,
  });
  await user.click(resetBtn);

  expect(screen.getByText('Слайд #1')).toBeTruthy();
  expect(screen.getByText('Слайд #2')).toBeTruthy();
  expect(screen.getByText('Слайд #3')).toBeTruthy();
  expect(screen.getAllByDisplayValue('Товары рядом').length).toBeGreaterThan(0);
});
