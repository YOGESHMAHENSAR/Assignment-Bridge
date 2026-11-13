import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Loading, Stars } from '../../components/ui';
import { dateTime, money } from '../../utils/format';

const PAYOUT_TONE = { requested: 'amber', paid: 'green', rejected: 'gray' };
const PAYOUT_LABEL = { requested: 'Pending', paid: 'Paid', rejected: 'Rejected' };

export default function Earnings() {
  const toast = useToast();
  const [wallet, setWallet] = useState(null);
  const [form, setForm] = useState({ amount: '', upiId: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/wallet');
      setWallet(data);
      setForm((f) => ({ ...f, upiId: f.upiId || data.upiId }));
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/wallet/payouts', { amount: Number(form.amount), upiId: form.upiId });
      toast.success('Withdrawal requested. The admin will send it to your UPI ID.');
      setForm((f) => ({ ...f, amount: '' }));
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (!wallet) return <Loading />;

  return (
    <div>
      <h1 className="page-title">Earnings</h1>

      <div className="stat-grid">
        <div className="stat primary">
          <small>Available balance</small>
          <strong>{money(wallet.balance)}</strong>
        </div>
        <div className="stat">
          <small>Total earned</small>
          <strong>{money(wallet.totalEarned)}</strong>
        </div>
        <div className="stat">
          <small>Tasks completed</small>
          <strong>{wallet.completedCount}</strong>
        </div>
        <div className="stat">
          <small>Your rating</small>
          {wallet.rating ? (
            <strong className="inline">
              {wallet.rating} <Stars value={Math.round(wallet.rating)} size={16} />
              <em>({wallet.ratingCount})</em>
            </strong>
          ) : (
            <strong>—</strong>
          )}
        </div>
      </div>

      <div className="two-col">
        <form className="card form-card" onSubmit={submit}>
          <h3>Withdraw earnings</h3>
          <p className="muted">Minimum withdrawal {money(wallet.minPayout)}. Paid to your UPI ID by the platform admin.</p>
          <label className="field">
            <span>Amount (₹)</span>
            <input type="number" min={wallet.minPayout} max={wallet.balance} step="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <small>
              <button type="button" className="link-btn" onClick={() => setForm({ ...form, amount: String(wallet.balance) })}>
                Withdraw everything ({money(wallet.balance)})
              </button>
            </small>
          </label>
          <label className="field">
            <span>UPI ID</span>
            <input required placeholder="name@bank" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
          </label>
          <button className="btn btn-primary" disabled={busy || wallet.balance < wallet.minPayout}>
            {busy ? 'Requesting…' : 'Request withdrawal'}
          </button>
        </form>

        <div className="card">
          <h3>Withdrawal history</h3>
          {wallet.payouts.length === 0 ? (
            <p className="muted">No withdrawals yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.payouts.map((p) => (
                    <tr key={p._id}>
                      <td>{dateTime(p.createdAt)}</td>
                      <td>{money(p.amount)}</td>
                      <td>
                        <span className={`badge badge-${PAYOUT_TONE[p.status]}`}>{PAYOUT_LABEL[p.status]}</span>
                        {p.status === 'rejected' && p.adminNote && <small className="block muted">{p.adminNote}</small>}
                        {p.status === 'paid' && p.reference && <small className="block muted">Ref: {p.reference}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
