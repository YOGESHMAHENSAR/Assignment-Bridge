import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
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
        <h1>Get assignments done. Or earn by doing them.</h1>
        <p>
          Taskers post an assignment with files and instructions. Workers pick the ones they want, deliver the work, and get paid when it's approved.
        </p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>Welcome back</h2>
        <p className="muted">Log in to continue</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label className="field">
          <span>Email</span>
          <input type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
