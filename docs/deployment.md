# Production deployment

PR-13 prepares the application for Vercel deployment. The game has no backend,
account, analytics, or production secrets. Match data remains in browser
IndexedDB.

## Vercel project

1. Import the repository into Vercel.
2. Keep the project root at the repository root.
3. Let `vercel.json` provide the framework, install, build, and output settings.
4. Require the GitHub `quality` and `e2e` jobs before merging to `main`.
5. Enable Vercel Deployment Protection if the MVP URL should remain private.

Every pull request receives a preview deployment. Production should track
`main`. No application environment variables are required.

## Automated release gates

Run before promotion:

```sh
yarn lint
yarn typecheck
yarn test
yarn test:e2e
yarn build
```

ESLint excludes repository-local Python virtual environments matching
`.venv*` (including `.venv-voice`). These directories contain generated and
third-party JavaScript from Python packages and are not application source.

After deployment, verify the real HTTPS response:

```sh
yarn smoke:deployment https://your-project.vercel.app
```

The smoke command checks the application shell, manifest, service worker,
offline fetch handler, update-safe service-worker caching, CSP, and security
headers.

## Real-device sign-off

Browser emulation runs in CI for Android Chrome and iPhone Safari dimensions.
Before declaring a release production-ready, record a manual pass on physical
devices:

- [ ] iPhone Safari: load, Add to Home Screen, and launch standalone.
- [ ] Android Chrome: install the PWA and launch standalone.
- [ ] Unlock/test audio once; confirm later phase cues play without another tap.
- [ ] Start a match, enable airplane mode, and complete at least one full cycle.
- [ ] Lock/unlock the screen and confirm the active match resumes safely.
- [ ] Confirm wake lock where supported and non-blocking fallback where absent.
- [ ] Play one real eight-player smoke match with physical cards.
- [ ] Verify no role, target, potion, curse, or investigation appears in browser
      logs, URLs, or public screens.

## Promotion and rollback

Promote a preview only after CI, HTTPS smoke, and real-device sign-off pass.
If a regression is found, use Vercel's deployment history to promote the last
known-good deployment. Do not force-refresh devices during an active match;
the installed service worker continues serving compatible cached assets and
refreshes its shell cache in the background.
