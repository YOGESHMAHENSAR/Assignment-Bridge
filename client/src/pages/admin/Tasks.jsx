import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Empty, Loading, Pagination, StatusBadge } from '../../components/ui';
import { STATUS, dateOnly, money } from '../../utils/format';

export default function AdminTasks() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get('/admin/tasks', { params: { status: status || undefined, search: query || undefined, page } });
      setData(res);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, [status, query, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (t) => {
    const paid = t.payment?.status === 'paid';
    if (!window.confirm(paid ? `Cancel "${t.title}" and refund ${money(t.price)} to the tasker?` : `Cancel "${t.title}"?`)) return;
    try {
      await api.post(`/admin/tasks/${t._id}/cancel`);
      toast.success('Task cancelled');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">All tasks</h1>
        <div className="row-end">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <input className="search" type="search" placeholder="Search title or subject" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title="No tasks found" />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Tasker</th>
                <th>Worker</th>
                <th>Status</th>
                <th>Paid</th>
                <th>Posted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t._id}>
                  <td>
                    <Link to={`/tasks/${t._id}`} className="task-title sm">{t.title}</Link>
                    {t.subject && <small className="block muted">{t.subject}</small>}
                  </td>
                  <td>{t.tasker?.name}</td>
                  <td>{t.worker?.name || '—'}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>
                    {money(t.price)}
                    <small className="block muted">{t.payment?.status}</small>
                  </td>
                  <td>{dateOnly(t.createdAt)}</td>
                  <td className="right">
                    {['pending_payment', 'open'].includes(t.status) && (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => cancel(t)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
