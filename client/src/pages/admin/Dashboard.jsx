import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Loading } from '../../components/ui';
import { STATUS, money } from '../../utils/format';

export default function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api
      .get('/admin/stats')
      .then((r) => setStats(r.data))
      .catch((e) => toast.error(errMsg(e)));
  }, [toast]);

  if (!stats) return <Loading />;
  const { users, tasks, money: m } = stats;
  const totalTasks = Object.values(tasks).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h1 className="page-title">Admin dashboard</h1>

      {stats.pendingPayoutCount > 0 && (
        <div className="alert alert-info">
          {stats.pendingPayoutCount} worker withdrawal request{stats.pendingPayoutCount > 1 ? 's' : ''} ({money(m.payoutsPending)}) waiting.{' '}
          <Link to="/admin/payouts">Review</Link>
        </div>
      )}

      <h3 className="section-title">Money</h3>
      <div className="stat-grid">
        <div className="stat primary">
          <small>Platform earnings</small>
          <strong>{money(m.platformEarnings)}</strong>
          <em>From approved tasks</em>
        </div>
        <div className="stat">
          <small>Collected from taskers</small>
          <strong>{money(m.collected)}</strong>
          <em>Excludes refunds</em>
        </div>
        <div className="stat">
          <small>Held for open tasks</small>
          <strong>{money(m.inEscrow)}</strong>
          <em>Paid, work not approved yet</em>
        </div>
        <div className="stat">
          <small>Earned by workers</small>
          <strong>{money(m.workerEarned)}</strong>
          <em>Total worker share</em>
        </div>
        <div className="stat">
          <small>Owed to workers</small>
          <strong>{money(m.workerBalances + m.payoutsPending)}</strong>
          <em>Balances + pending withdrawals</em>
        </div>
        <div className="stat">
          <small>Paid out to workers</small>
          <strong>{money(m.payoutsPaid)}</strong>
        </div>
        <div className="stat">
          <small>Refunded to taskers</small>
          <strong>{money(m.refunded)}</strong>
        </div>
      </div>

      <div className="two-col">
        <div>
          <h3 className="section-title">Users</h3>
          <div className="stat-grid compact">
            <Link to="/admin/users" className="stat">
              <small>Taskers</small>
              <strong>{users.tasker || 0}</strong>
            </Link>
            <Link to="/admin/users" className="stat">
              <small>Workers</small>
              <strong>{users.worker || 0}</strong>
            </Link>
          </div>
        </div>
        <div>
          <h3 className="section-title">Tasks ({totalTasks})</h3>
          <div className="card">
            <ul className="status-list">
              {Object.keys(STATUS).map((s) => (
                <li key={s}>
                  <span className={`dot dot-${STATUS[s].tone}`} />
                  <span>{STATUS[s].label}</span>
                  <strong>{tasks[s] || 0}</strong>
                </li>
              ))}
            </ul>
            <Link to="/admin/tasks" className="btn btn-outline btn-sm">
              View all tasks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
