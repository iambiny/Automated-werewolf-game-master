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
yarn build
```

The framework-independent domain engine lives in `packages/game-engine`.
