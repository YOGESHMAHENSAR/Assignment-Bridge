import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { money } from '../utils/format';
import LocationFields from '../components/LocationFields';

export default function Register() {
  const { register, config } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'tasker',
    location: { name: '', latitude: '', longitude: '' },
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-side">
        <div className="brand brand-lg">
          <span className="brand-mark">AB</span> Assignment Bridge
        </div>
        <h1>Pick how you want to use it.</h1>
        <p>You can pay for an assignment to be done, or earn by completing assignments for others.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>Create your account</h2>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="role-pick">
          <button type="button" className={form.role === 'tasker' ? 'role on' : 'role'} onClick={() => setForm({ ...form, role: 'tasker' })}>
            <strong>Tasker</strong>
            <small>I need an assignment done{config ? ` (${money(config.price)} each)` : ''}</small>
          </button>
          <button type="button" className={form.role === 'worker' ? 'role on' : 'role'} onClick={() => setForm({ ...form, role: 'worker' })}>
            <strong>Worker</strong>
            <small>I want to earn by doing assignments</small>
          </button>
        </div>

        <label className="field">
          <span>Full name</span>
          <input required value={form.name} onChange={set('name')} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" required value={form.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>Phone (optional)</span>
          <input value={form.phone} onChange={set('phone')} />
        </label>
        <LocationFields
          value={form.location}
          onChange={(location) => setForm({ ...form, location })}
          title="Your campus location"
        />
        <label className="field">
          <span>Password</span>
          <input type="password" required minLength={6} value={form.password} onChange={set('password')} />
          <small>At least 6 characters</small>
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
