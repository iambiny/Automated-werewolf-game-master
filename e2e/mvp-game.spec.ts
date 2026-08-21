import { expect, type Page, test } from '@playwright/test';

const ROLES = [
  'Villager',
  'Seer',
  'Guard',
  'Werewolf',
  'Werewolf',
  'Witch',
  'Hunter',
  'Fool',
] as const;

test('completes the full MVP offline and recovers every safe checkpoint', async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The full gameplay path runs once; mobile projects run the release smoke.',
  );
  test.setTimeout(240_000);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Werewolf' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page.reload();
  await context.setOffline(true);

  try {
    await startConfiguredGame(page);

    await registerRole(page, ROLES[0]);
    await recover(page, 'Secret role registration');
    for (const role of ROLES.slice(1)) await registerRole(page, role);

    await page.getByRole('button', { name: 'Validate the deck' }).click();
    await expect(
      page.getByRole('heading', { name: 'The village is ready' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Begin Night 1' }).click();
    await page.getByRole('button', { name: 'Everyone is ready' }).click();

    await openNightTurn(page, 'Seer');
    await recover(page, 'Night 1');
    await openNightTurn(page, 'Seer');
    await chooseTarget(page, 'Player 4');
    await page.getByRole('button', { name: 'Hide result and sleep' }).click();
    await sleepRole(page);

    await openNightTurn(page, 'Guard');
    await chooseTarget(page, 'Player 2');
    await sleepRole(page);

    await openNightTurn(page, 'Werewolf');
    await page.getByRole('button', { name: 'No attack' }).click();
    await sleepRole(page);

    await openNightTurn(page, 'Witch');
    await page.getByRole('button', { name: 'Use no potion' }).click();
    await sleepRole(page);

    await revealMorning(page);
    await electMayor(page, 'Player 1');
    await page.getByRole('button', { name: 'Begin discussion' }).click();
    await expect(
      page.getByRole('heading', { name: 'Find the Werewolves.' }),
    ).toBeVisible();
    await recover(page, 'discussion');
    await expect(page.getByText('5:00')).toBeVisible();
    await page.getByRole('button', { name: 'End discussion and vote' }).click();

    await castBallots(page, 'Player 5', 2);
    await recover(page, 'voting');
    await castBallots(page, 'Player 5', 6);
    await page.getByRole('button', { name: 'Resolve the vote' }).click();
    await expect(
      page.getByRole('heading', { name: 'Player 5 is executed.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Night 2')).toBeVisible();
    await page.getByRole('button', { name: 'Everyone is ready' }).click();

    await openNightTurn(page, 'Seer');
    await chooseTarget(page, 'Player 4');
    await page.getByRole('button', { name: 'Hide result and sleep' }).click();
    await sleepRole(page);

    await openNightTurn(page, 'Guard');
    await chooseTarget(page, 'Player 1');
    await sleepRole(page);

    await openNightTurn(page, 'Werewolf');
    await chooseTarget(page, 'Player 7');
    await sleepRole(page);

    await openNightTurn(page, 'Witch');
    await page.getByRole('button', { name: /Player 4/ }).click();
    await page.getByRole('button', { name: 'Confirm poison' }).click();
    await sleepRole(page);

    await revealMorning(page);
    await expect(
      page.getByRole('heading', { name: /Player 7, take your final shot/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Player 8/ }).click();
    await page
      .getByRole('button', { name: 'Confirm shot at Player 8' })
      .click();
    await page.getByRole('button', { name: 'Continue the morning' }).click();

    await expect(
      page.getByRole('heading', { name: 'The Village wins.' }),
    ).toBeVisible();
    await expect(page.getByText('Player 4')).toBeVisible();
    await expect(page.getByText('Player 5')).toBeVisible();
  } finally {
    if (!page.isClosed()) await context.setOffline(false);
  }
});

test('exposes installable PWA metadata and no secret browser logs', async ({
  page,
}) => {
  const messages: string[] = [];
  page.on('console', (message) => messages.push(message.text()));
  await page.goto('/');

  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  await expect(manifest.json()).resolves.toMatchObject({
    display: 'standalone',
    orientation: 'portrait-primary',
    start_url: '/',
  });
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  expect(messages).toEqual([]);
});

async function startConfiguredGame(page: Page) {
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Continue with 8 players' }).click();
  await page.getByRole('button', { name: 'Remove Villager' }).click();
  await page.getByRole('button', { name: 'Add Fool' }).click();
  await page.getByRole('button', { name: 'Review game rules' }).click();
  await page.getByRole('button', { name: 'Begin secret registration' }).click();
}

async function registerRole(page: Page, role: string) {
  const reveal = page.getByRole('button', { name: 'Hold to reveal roles' });
  await reveal.dispatchEvent('pointerdown');
  await page.waitForTimeout(750);
  await page
    .locator('.role-choice')
    .filter({ hasText: new RegExp(`^.${role}$`) })
    .click();
  await page.getByRole('button', { name: 'Confirm my role' }).click();
  await expect(page.getByRole('heading', { name: 'Role saved' })).toBeVisible();
  if (role !== ROLES.at(-1)) {
    await page.getByRole('button', { name: 'Pass to next player' }).click();
  }
}

async function recover(page: Page, label: string) {
  await page.reload();
  const resume = page.getByRole('button', { name: /Resume game/ });
  await expect(resume).toContainText(new RegExp(label, 'i'));
  await resume.click();
}

async function openNightTurn(page: Page, role: string) {
  await expect(
    page.getByRole('heading', { name: `${role}, open your eyes.` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open private controls' }).click();
}

async function chooseTarget(page: Page, player: string) {
  await page.getByRole('button', { name: new RegExp(player) }).click();
  await page.getByRole('button', { name: `Confirm ${player}` }).click();
}

async function sleepRole(page: Page) {
  const button = page.getByRole('button', { name: 'Role is asleep' });
  await button.click();
  await expect(button).toBeHidden();
}

async function revealMorning(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'The village wakes.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reveal the morning' }).click();
  await page.getByRole('button', { name: 'Continue the morning' }).click();
}

async function electMayor(page: Page, candidate: string) {
  await castBallots(page, candidate, 8);
  await page.getByRole('button', { name: 'Resolve the vote' }).click();
}

async function castBallots(page: Page, candidate: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    const progress = page.locator('.vote-progress span');
    const previous = await progress.textContent();
    await page.locator('.target-button').filter({ hasText: candidate }).click();
    await page
      .getByRole('button', { name: `Record vote for ${candidate}` })
      .click();
    await expect(progress).not.toHaveText(previous ?? '');
  }
}
