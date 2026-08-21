const rawUrl = process.argv[2] ?? process.env.DEPLOYMENT_URL;

if (!rawUrl) {
  process.stderr.write(
    'Usage: yarn smoke:deployment https://your-deployment.example\n',
  );
  process.exit(1);
}

const baseUrl = new URL(rawUrl);
if (
  baseUrl.protocol !== 'https:' &&
  !['localhost', '127.0.0.1'].includes(baseUrl.hostname)
) {
  throw new Error('Production smoke checks require HTTPS.');
}

const [home, manifestResponse, worker] = await Promise.all([
  fetch(new URL('/', baseUrl), { redirect: 'follow' }),
  fetch(new URL('/manifest.webmanifest', baseUrl), { redirect: 'follow' }),
  fetch(new URL('/sw.js', baseUrl), { redirect: 'follow' }),
]);

assertResponse(home, 'application shell');
assertResponse(manifestResponse, 'PWA manifest');
assertResponse(worker, 'service worker');

const homeHtml = await home.text();
const manifest = await manifestResponse.json();
const workerSource = await worker.text();

assert(
  homeHtml.includes('/manifest.webmanifest'),
  'Application shell does not link its manifest.',
);
assert(manifest.display === 'standalone', 'Manifest is not standalone.');
assert(manifest.start_url === '/', 'Manifest start URL is not root-scoped.');
assert(
  Array.isArray(manifest.icons) && manifest.icons.length >= 2,
  'Manifest icons are incomplete.',
);
assert(
  workerSource.includes("self.addEventListener('fetch'"),
  'Service worker has no offline fetch handler.',
);
assert(
  worker.headers.get('cache-control')?.includes('no-cache') === true,
  'Service worker must be served with no-cache.',
);
assert(
  home.headers.get('x-content-type-options') === 'nosniff',
  'Security headers are missing.',
);
assert(
  home.headers.get('strict-transport-security')?.includes('max-age=') === true,
  'HTTPS transport policy is missing.',
);
assert(
  home.headers
    .get('content-security-policy')
    ?.includes("default-src 'self'") === true,
  'Content Security Policy is missing.',
);

process.stdout.write(`Deployment smoke checks passed for ${baseUrl.origin}\n`);

function assertResponse(response, label) {
  assert(response.ok, `${label} returned HTTP ${response.status}.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
