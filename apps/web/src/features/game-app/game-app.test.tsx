// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { GameApp } from './game-app';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('GameApp setup journey', () => {
  it('persists the night action sound-effects preference', async () => {
    const user = userEvent.setup();
    render(<GameApp />);

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const toggle = screen.getByRole('checkbox', {
      name: 'Night action sound effects',
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(
      JSON.parse(
        localStorage.getItem('werewolf-audio-preferences-v1') ?? 'null',
      ),
    ).toMatchObject({ nightActions: false });
  });

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
    const villagers = screen.getByRole('region', { name: 'Villagers' });
    const werewolves = screen.getByRole('region', { name: 'Werewolves' });
    const thirdParty = screen.getByRole('region', { name: 'Third Party' });
    expect(within(villagers).getByText('Villager')).toBeInTheDocument();
    expect(within(villagers).getByText('Seer')).toBeInTheDocument();
    expect(within(werewolves).getByText('Werewolf')).toBeInTheDocument();
    expect(within(werewolves).getByText('Demon Wolf')).toBeInTheDocument();
    expect(within(thirdParty).getByText('Fool')).toBeInTheDocument();
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

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Hold to reveal roles' }),
    );
    await screen.findByRole(
      'heading',
      { name: 'Choose your role' },
      { timeout: 1_500 },
    );
    expect(screen.getByText('Villager')).toBeInTheDocument();
    expect(screen.queryByText('Demon Wolf')).not.toBeInTheDocument();
    expect(screen.queryByText('Fool')).not.toBeInTheDocument();
  });
});
