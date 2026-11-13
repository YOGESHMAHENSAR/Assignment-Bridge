import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PushNotificationControl from './PushNotificationControl';

const NAV = {
  tasker: [
    { to: '/', label: 'My requests', end: true },
    { to: '/new', label: 'New request' },
  ],
  worker: [
    { to: '/', label: 'Find tasks', end: true },
    { to: '/work', label: 'My work' },
    { to: '/earnings', label: 'Earnings' },
  ],
  admin: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/admin/tasks', label: 'Tasks' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/payouts', label: 'Payouts' },
  ],
};

const ROLE_LABEL = { tasker: 'Tasker', worker: 'Worker', admin: 'Admin' };

export default function Layout() {
  const { user, logout, config } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">AB</span> Assignment Bridge
          </Link>
          <nav className="nav">
            {NAV[user.role].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          {user.role !== 'admin' && <PushNotificationControl />}
          <div className="topbar-user">
            <Link to="/profile" className="user-chip">
              <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
              <span className="user-meta">
                <strong>{user.name}</strong>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
            </Link>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {config?.mockPayments && (
        <div className="banner">
          Demo payment mode: no Razorpay keys are configured, so payments are simulated. Add keys in <code>server/.env</code> for real payments.
        </div>
      )}

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
