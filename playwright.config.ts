import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: { timeout: 10_000 },
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3200',
    colorScheme: 'dark',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'android-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iphone-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'yarn build && yarn workspace @werewolf/web start --port 3200',
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://127.0.0.1:3200',
  },
});
