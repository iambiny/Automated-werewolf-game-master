export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}
