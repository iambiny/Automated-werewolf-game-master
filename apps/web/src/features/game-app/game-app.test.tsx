// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { GameApp } from './game-app';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('GameApp setup journey', () => {
  it('localizes settings and home before continuing navigation', async () => {
    const user = userEvent.setup();
    render(<GameApp />);

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Language' }),
      'vi',
    );
    expect(
      screen.getByRole('heading', { name: 'Luật chơi đi cùng ván đấu' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Luật riêng và đồng hồ được chọn khi tạo ván mới/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← Trang chủ' }));
    expect(
      screen.getByRole('button', { name: 'Ván chơi mới' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Được thiết kế cho một điện thoại chuyền quanh bàn'),
    ).toBeInTheDocument();
  });

  it('takes the default eight-player setup into private registration', async () => {
    const user = userEvent.setup();
    render(<GameApp />);

    await user.click(await screen.findByRole('button', { name: 'New game' }));
    expect(
      screen.getByRole('heading', { name: 'Who is at the table?' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(8);

    await user.click(
      screen.getByRole('button', { name: 'Continue with 8 players' }),
    );
    expect(screen.getByText('8 / 8')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review game rules' }));

    expect(
      screen.getByRole('heading', { name: 'Set the house rules' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Begin secret registration' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Pass the phone to')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Player 1' }),
      ).toBeInTheDocument();
      expect(screen.getByText('1 / 8')).toBeInTheDocument();
    });
  });
});
