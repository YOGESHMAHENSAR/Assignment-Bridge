import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Empty, Loading, Pagination, PromptModal } from '../../components/ui';
import { dateTime, money } from '../../utils/format';

const TONE = { requested: 'amber', paid: 'green', rejected: 'gray' };
const LABEL = { requested: 'Pending', paid: 'Paid', rejected: 'Rejected' };

export default function AdminPayouts() {
  const toast = useToast();
  const [status, setStatus] = useState('requested');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // { payout, action }

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get('/admin/payouts', { params: { status: status || undefined, page } });
      setData(res);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, [status, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const process = async (value) => {
    const { payout, action } = modal;
    try {
      await api.patch(`/admin/payouts/${payout._id}`, action === 'paid' ? { status: 'paid', reference: value } : { status: 'rejected', note: value });
      toast.success(action === 'paid' ? 'Marked as paid' : 'Request rejected and balance restored');
      setModal(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Worker payouts</h1>
          <p className="muted">Send the money to the worker's UPI ID, then mark the request as paid.</p>
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="requested">Pending</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title="No payout requests here" />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Amount</th>
                <th>UPI ID</th>
                <th>Requested</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong>{p.worker?.name}</strong>
                    <small className="block muted">{p.worker?.email}</small>
                  </td>
                  <td><strong>{money(p.amount)}</strong></td>
                  <td><code>{p.upiId}</code></td>
                  <td>{dateTime(p.createdAt)}</td>
                  <td>
                    <span className={`badge badge-${TONE[p.status]}`}>{LABEL[p.status]}</span>
                    {p.reference && <small className="block muted">Ref: {p.reference}</small>}
                    {p.adminNote && <small className="block muted">{p.adminNote}</small>}
                  </td>
                  <td className="right">
                    {p.status === 'requested' && (
                      <div className="row-end">
                        <button className="btn btn-outline-danger btn-sm" onClick={() => setModal({ payout: p, action: 'rejected' })}>
                          Reject
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ payout: p, action: 'paid' })}>
                          Mark paid
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}

      {modal && (
        <PromptModal
          title={modal.action === 'paid' ? `Mark ${money(modal.payout.amount)} as paid` : 'Reject withdrawal'}
          label={modal.action === 'paid' ? 'UPI transaction reference (optional)' : 'Reason shown to the worker'}
          placeholder={modal.action === 'paid' ? 'UTR / reference number' : 'e.g. UPI ID is invalid'}
          required={modal.action === 'rejected'}
          multiline={modal.action === 'rejected'}
          danger={modal.action === 'rejected'}
          confirmText={modal.action === 'paid' ? 'Mark as paid' : 'Reject'}
          onSubmit={process}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
