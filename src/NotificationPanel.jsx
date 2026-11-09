import React, { useEffect, useState } from 'react';
import { Icon } from './Artwork.jsx';
import { nextReminder } from './reminderSchedule.js';
import { phoneNotificationSupport, reminderService, serviceRequest, deviceCredential, saveDeviceCredential, applicationServerKey } from './notifications.js';
import './notifications.css';

export function NotificationPanel({ onInstall }) {
  const support = phoneNotificationSupport();
  const [service, setService] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setEnabled(false);
    (async () => {
      try {
        const connection = await reminderService();
        if (cancelled) return;
        setService(connection);
        if (!connection || !support.supported || support.needsInstall) return;
        const worker = await navigator.serviceWorker.getRegistration('/');
        if (cancelled) return;
        setRegistration(worker?.active ? worker : null);
        const credential = deviceCredential();
        if (credential) {
          try {
            const device = await serviceRequest(connection.base, '/device', { credential });
            const subscription = await worker?.pushManager.getSubscription();
            if (!cancelled) setEnabled(device.enabled && !!subscription && Notification.permission === 'granted');
          } catch (failure) { if (failure.status !== 401) throw failure; }
        }
      } catch (failure) { if (!cancelled) setError(failure.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [revision]);

  const enable = async () => {
    if (!registration || !service || !code.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      // Subscribe directly inside the tap handler, so iOS can show its prompt.
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(service.publicKey) });
      const result = await serviceRequest(service.base, '/devices', { method: 'POST', body: { code: code.trim(), subscription: subscription.toJSON() } });
      try { saveDeviceCredential(result.credential); }
      catch {
        await serviceRequest(service.base, '/device', { method: 'DELETE', credential: result.credential });
        throw new Error('Allow device storage before enabling reminders.');
      }
      setCode(''); setEnabled(true);
      setMessage('This device is connected. Send a test to check your iPhone.');
    } catch (failure) {
      setError(Notification.permission === 'denied' ? 'Notifications are blocked. Allow them in your iPhone notification settings, then reopen the app.' : failure.message);
    } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await serviceRequest(service.base, '/test', { method: 'POST', credential: deviceCredential() });
      setMessage('Test accepted by the push service. Check your notifications; acceptance does not confirm delivery.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await serviceRequest(service.base, '/device', { method: 'DELETE', credential: deviceCredential() });
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe(); saveDeviceCredential(null); setEnabled(false);
      setMessage('Class reminders are off on this device.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const next = nextReminder();
  const status = loading ? 'Checking connection…' : support.needsInstall ? 'Add to Home Screen first' : !support.supported ? 'Browser not supported' : !service ? 'Service setup pending' : enabled ? service.schedulerReady ? 'On for this device' : 'Connected · scheduler not ready' : 'Off for this device';

  return <div className="notification-content" data-native-scroll>
    <div className="notification-intro"><span className="notification-symbol"><Icon name="bell" size={27} /></span><p>Know your next class.<br />A reminder 10 minutes before every session.</p></div>
    <div className="notification-example"><span>Reminder preview</span><strong>{next?.name || 'OOP'} in 10 minutes</strong><p>{next ? `${next.start}–${next.end} · ${next.room}` : '12:30–13:45 · SST1-702'}</p><small>Preview only · not a sent notification</small></div>
    <div className={`notification-status ${enabled && service?.schedulerReady ? 'is-on' : ''}`} role="status"><i />{status}</div>
    {support.needsInstall ? <><p className="notification-help">On iPhone, open the app from your Home Screen to enable notifications. Safari tabs cannot receive these class reminders.</p><button type="button" className="primary-button" onClick={onInstall}>How to install<Icon name="share" size={19} /></button></>
      : !support.supported ? <p className="notification-help">Use a supported browser. On iPhone, update iOS and install the app on your Home Screen.</p>
      : !loading && !service ? <p className="notification-help">Your timetable is ready. Reminders are not active yet—the cloud service still needs to be connected. You can test the rest of the app now.</p>
      : service && !loading && !enabled ? <><label className="connection-label" htmlFor="reminder-code">Device connection code</label><input id="reminder-code" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={event => setCode(event.target.value)} placeholder="Enter your setup code" /><p className="notification-help">Enter your private code once, then allow notifications. Your code is not saved on this device.</p><button type="button" className="primary-button" disabled={busy || !registration || !code.trim()} onClick={enable}>{busy ? 'Connecting…' : 'Enable class reminders'}<Icon name="bell" size={19} /></button>{!registration && <p className="notification-help">Your offline app is preparing. Close and reopen the app, then try again.</p>}</>
      : enabled ? <><button type="button" className="primary-button" disabled={busy} onClick={test}>{busy ? 'Please wait…' : 'Send a test notification'}<Icon name="arrow" size={19} /></button><button type="button" className="notification-disable" disabled={busy} onClick={disable}>Turn reminders off on this device</button></> : null}
    {error && <p className="notification-error" role="alert">{error}</p>}{message && <p className="notification-help" role="status">{message}</p>}
    <button type="button" className="notification-refresh" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Check connection again</button>
    <p className="notification-footnote">Internet is required. Delivery targets 10 minutes before class; iPhone settings and connectivity can affect arrival. Stale reminders are not resent. Attendance notifications will come later.</p>
  </div>;
}
