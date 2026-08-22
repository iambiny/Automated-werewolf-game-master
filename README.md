# Automated Werewolf Game Master

An offline-first, single-device game master for in-person Werewolf games played
with physical role cards.

## Development

Requirements: Node.js 20.9 or newer and Corepack.

```sh
corepack enable
yarn install
yarn dev
```

Quality checks:

```sh
yarn lint
yarn typecheck
yarn test
yarn test:e2e
yarn build
```

The framework-independent domain engine lives in `packages/game-engine`.

## Languages

The web app supports English and Vietnamese. Choose **Tiếng Việt** in Settings;
the preference is saved on the device and does not change an active match's
rules or saved state.

## Deployment

The repository includes Vercel configuration, production security/cache
headers, desktop and mobile browser smoke tests, and a post-deployment verifier.
See [docs/deployment.md](docs/deployment.md) for promotion, physical-device
sign-off, and rollback instructions.

```sh
yarn smoke:deployment https://your-project.vercel.app
```
