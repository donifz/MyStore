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

it('supports toggling hideOverlay, onlyImage, and mobileImageUrl', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<HeroSliderEditor initialSlides={initialSlides} onSave={onSave} />);

  // Toggle hideOverlay on slide 1
  const noOverlayCheckboxes = screen.getAllByRole('checkbox', {
    name: /без затемнения/i,
  });
  await user.click(noOverlayCheckboxes[0]);

  // Toggle onlyImage on slide 1
  const onlyImageCheckboxes = screen.getAllByRole('checkbox', {
    name: /только фото/i,
  });
  await user.click(onlyImageCheckboxes[0]);

  // Set mobile banner URL
  const mobileUrlInputs = screen.getAllByPlaceholderText(
    'URL мобильного фото (https://...)',
  );
  await user.type(mobileUrlInputs[0], 'https://example.com/mobile.jpg');

  // Switch preview to mobile
  const mobilePreviewBtn = screen.getByRole('button', {
    name: /смартфон/i,
  });
  await user.click(mobilePreviewBtn);
  expect(screen.getByText('Только баннер (текст скрыт)')).toBeTruthy();

  // Save
  const saveBtn = screen.getByRole('button', { name: /сохранить изменения/i });
  await user.click(saveBtn);

  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0];
  expect(saved[0].hideOverlay).toBe(true);
  expect(saved[0].onlyImage).toBe(true);
  expect(saved[0].mobileImageUrl).toBe('https://example.com/mobile.jpg');
});

it('strips createdAt and updatedAt metadata when saving loaded slides', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  const slidesWithMeta = [
    {
      id: '77235f74-b922-4d07-af91-84a049d7b6e1',
      sortOrder: 0,
      isActive: true,
      badge: 'МАРКЕТПЛЕЙС',
      title: 'Товары рядом',
      subtitle: 'Описание',
      buttonText: 'Смотреть',
      buttonUrl: '#catalog',
      imageUrl: '/banners/banner-shops.jpg',
      mobileImageUrl: null,
      hideOverlay: false,
      onlyImage: false,
      bgGradient: 'blue',
      createdAt: '2026-11-14T04:06:55.475Z',
      updatedAt: '2026-11-14T04:06:55.475Z',
    } as any,
  ];
  render(
    <HeroSliderEditor
      initialSlides={slidesWithMeta}
      saving={false}
      onSave={onSave}
    />,
  );

  await user.click(screen.getByRole('checkbox', { name: /без затемнения/i }));
  await user.click(
    screen.getByRole('button', { name: /сохранить изменения/i }),
  );
  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0][0];
  expect('createdAt' in saved).toBe(false);
  expect('updatedAt' in saved).toBe(false);
});
