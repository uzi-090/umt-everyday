export function requestOfflineStatus(worker, type = 'OFFLINE_STATUS') {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error, value) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('Offline copy check timed out.')), 12000);
    channel.port1.onmessage = event => finish(null, event.data);
    worker.postMessage({ type }, [channel.port2]);
  });
}

// Readiness is confirmed by every cached asset, not just a registered worker.
// Retry on connectivity/activation changes and after returning to the app.
export function observeOffline(onStatus) {
  let disposed = false, checking = false, repeat = false;
  const workers = navigator.serviceWorker;
  const report = value => { if (!disposed) onStatus(value); };
  const refresh = async () => {
    if (disposed) return;
    if (checking) { repeat = true; return; }
    checking = true;
    try {
      if (!workers || !import.meta.env.PROD) { report({ state: 'unavailable' }); return; }
      const existing = await workers.getRegistration('/');
      let registration = existing;
      if (navigator.onLine) {
        try { registration = await workers.register('/sw.js', { scope: '/', updateViaCache: 'none' }); }
        catch (error) { if (!existing?.active) throw error; }
      }
      const installing = registration?.installing;
      if (installing) installing.addEventListener('statechange', () => {
        if (installing.state === 'activated' || installing.state === 'redundant') refresh();
      }, { once: false });
      const worker = workers.controller || registration?.active;
      if (!worker) { report({ state: navigator.onLine && installing ? 'preparing' : 'error' }); return; }
      let result = await requestOfflineStatus(worker);
      if (!result.ready && navigator.onLine) result = await requestOfflineStatus(worker, 'OFFLINE_PREPARE');
      report({ ...result, state: result.ready ? 'ready' : 'error' });
    } catch { report({ state: 'error' }); }
    finally {
      checking = false;
      if (repeat) { repeat = false; refresh(); }
    }
  };
  const visible = () => { if (document.visibilityState === 'visible') refresh(); };
  window.addEventListener('online', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', visible);
  workers?.addEventListener('controllerchange', refresh);
  refresh();
  return { refresh, dispose() {
    disposed = true;
    window.removeEventListener('online', refresh);
    window.removeEventListener('pageshow', refresh);
    document.removeEventListener('visibilitychange', visible);
    workers?.removeEventListener('controllerchange', refresh);
  } };
}
