import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#090b12',
    description: 'An offline game master for physical-card Werewolf.',
    display: 'standalone',
    icons: [
      {
        purpose: 'any',
        sizes: 'any',
        src: '/icons/werewolf.svg',
        type: 'image/svg+xml',
      },
      {
        purpose: 'maskable',
        sizes: 'any',
        src: '/icons/werewolf-maskable.svg',
        type: 'image/svg+xml',
      },
    ],
    name: 'Automated Werewolf Game Master',
    orientation: 'portrait-primary',
    scope: '/',
    short_name: 'Werewolf GM',
    start_url: '/',
    theme_color: '#090b12',
  };
}
