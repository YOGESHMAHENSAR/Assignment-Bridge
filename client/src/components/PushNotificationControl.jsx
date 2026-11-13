import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useToast } from '../context/ToastContext';

const base64ToBytes = (value) => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export default function PushNotificationControl() {
  const toast = useToast();
  const [status, setStatus] = useState('loading');
  const [publicKey, setPublicKey] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setStatus('unsupported');
        return;
      }

      try {
        const { data } = await api.get('/notifications/vapid-public-key');
        if (!active) return;
        if (!data.enabled || !data.publicKey) {
          setStatus('unconfigured');
          return;
        }
        setPublicKey(data.publicKey);
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        const subscription = await registration.pushManager.getSubscription();
        if (!active) return;
        if (subscription && Notification.permission === 'granted') {
          await api.post('/notifications/subscribe', subscription.toJSON());
          if (active) setStatus('enabled');
        } else {
          setStatus(Notification.permission === 'denied' ? 'blocked' : 'disabled');
        }
      } catch (error) {
        if (active) {
          setStatus('error');
          toast.error(errMsg(error));
        }
      }
    };

    initialize();
    return () => {
      active = false;
    };
  }, [toast]);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'disabled');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToBytes(publicKey),
        });
      }
      await api.post('/notifications/subscribe', subscription.toJSON());
      setStatus('enabled');
      toast.success('Push notifications enabled');
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete('/notifications/subscribe', { data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setStatus('disabled');
      toast.info('Push notifications disabled');
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  };

  if (['loading', 'error'].includes(status)) return null;
  if (status === 'unconfigured') {
    return <span className="push-hint">Push needs server VAPID keys</span>;
  }
  if (status === 'unsupported') {
    return <span className="push-hint">Push not supported</span>;
  }
  if (status === 'blocked') {
    return <span className="push-hint">Notifications blocked in browser settings</span>;
  }

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm push-control"
      disabled={busy}
      onClick={status === 'enabled' ? disable : enable}
    >
      {busy ? 'Please wait…' : status === 'enabled' ? 'Notifications on' : 'Enable notifications'}
    </button>
  );
}
