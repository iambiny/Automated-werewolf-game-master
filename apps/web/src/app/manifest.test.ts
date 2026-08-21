import { describe, expect, it } from 'vitest';

import manifest from './manifest';

describe('PWA manifest', () => {
  it('defines an installable portrait standalone application', () => {
    expect(manifest()).toMatchObject({
      background_color: '#090b12',
      display: 'standalone',
      name: 'Automated Werewolf Game Master',
      orientation: 'portrait-primary',
      short_name: 'Werewolf GM',
      start_url: '/',
      theme_color: '#090b12',
    });
    expect(manifest().icons).toHaveLength(2);
  });
});
