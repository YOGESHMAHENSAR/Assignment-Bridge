import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LocationFields from '../components/LocationFields';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    upiId: user.upiId || '',
    location: {
      name: user.location?.name || '',
      latitude: user.location?.point?.coordinates?.[1]?.toString() || '',
      longitude: user.location?.point?.coordinates?.[0]?.toString() || '',
    },
    currentPassword: '',
    newPassword: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name: form.name, phone: form.phone, location: form.location };
      if (user.role === 'worker') payload.upiId = form.upiId;
      if (form.newPassword) Object.assign(payload, { currentPassword: form.currentPassword, newPassword: form.newPassword });
      const { data } = await api.put('/auth/profile', payload);
      setUser(data.user);
      setForm({ ...form, currentPassword: '', newPassword: '' });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <h1 className="page-title">Your profile</h1>
      <form className="card form-card" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input value={user.email} disabled />
        </label>
        <label className="field">
          <span>Full name</span>
          <input required value={form.name} onChange={set('name')} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input value={form.phone} onChange={set('phone')} />
        </label>
        <LocationFields
          value={form.location}
          onChange={(location) => setForm({ ...form, location })}
          title="Your campus location"
        />
        {user.role === 'worker' && (
          <label className="field">
            <span>UPI ID for withdrawals</span>
            <input placeholder="name@bank" value={form.upiId} onChange={set('upiId')} />
          </label>
        )}
        <hr />
        <h3>Change password</h3>
        <label className="field">
          <span>Current password</span>
          <input type="password" value={form.currentPassword} onChange={set('currentPassword')} />
        </label>
        <label className="field">
          <span>New password</span>
          <input type="password" minLength={6} value={form.newPassword} onChange={set('newPassword')} />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
