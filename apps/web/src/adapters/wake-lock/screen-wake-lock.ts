export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;

  get supported(): boolean {
    return 'wakeLock' in navigator;
  }

  async request(): Promise<boolean> {
    if (!this.supported || document.visibilityState !== 'visible') return false;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
      return true;
    } catch {
      this.sentinel = null;
      return false;
    }
  }

  async release(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel && !sentinel.released) await sentinel.release();
  }
}
