import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Empty, Loading, Pagination } from '../../components/ui';
import { dateOnly, money } from '../../utils/format';

export default function AdminUsers() {
  const toast = useToast();
  const [role, setRole] = useState('');
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
      const { data: res } = await api.get('/admin/users', { params: { role: role || undefined, search: query || undefined, page } });
      setData(res);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, [role, query, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBlock = async (u) => {
    if (!window.confirm(`${u.isBlocked ? 'Unblock' : 'Block'} ${u.name}?`)) return;
    try {
      await api.patch(`/admin/users/${u._id}/block`, { blocked: !u.isBlocked });
      toast.success(u.isBlocked ? 'User unblocked' : 'User blocked');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Users</h1>
        <div className="row-end">
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            <option value="tasker">Taskers</option>
            <option value="worker">Workers</option>
            <option value="admin">Admins</option>
          </select>
          <input className="search" type="search" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title="No users found" />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Worker stats</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u._id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small className="block muted">{u.email}</small>
                  </td>
                  <td><span className="chip">{u.role}</span></td>
                  <td>{dateOnly(u.createdAt)}</td>
                  <td>
                    {u.role === 'worker' ? (
                      <>
                        {u.completedCount} done · {money(u.totalEarned)} earned
                        {u.rating ? <small className="block muted">★ {u.rating} ({u.ratingCount})</small> : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{u.isBlocked ? <span className="badge badge-gray">Blocked</span> : <span className="badge badge-green">Active</span>}</td>
                  <td className="right">
                    {u.role !== 'admin' && (
                      <button className={`btn btn-sm ${u.isBlocked ? 'btn-outline' : 'btn-outline-danger'}`} onClick={() => toggleBlock(u)}>
                        {u.isBlocked ? 'Unblock' : 'Block'}
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
