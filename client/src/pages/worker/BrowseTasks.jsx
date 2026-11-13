import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useToast } from '../../context/ToastContext';
import TaskCard from '../../components/TaskCard';
import { Empty, Loading, Pagination } from '../../components/ui';

export default function BrowseTasks() {
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get('/tasks/available', { params: { search: query || undefined, page } });
      setData(res);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, [query, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/tasks/${id}/accept`);
      toast.success('Task accepted. Upload your work when it is done.');
      navigate(`/tasks/${id}`);
    } catch (err) {
      toast.error(errMsg(err));
      load();
    } finally {
      setBusyId(null);
    }
  };

  const ignore = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/tasks/${id}/ignore`);
      setData((d) => ({ ...d, items: d.items.filter((t) => t._id !== id), total: d.total - 1 }));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Find tasks</h1>
          <p className="muted">Open assignments posted by taskers. Accept the ones you can do, ignore the rest.</p>
        </div>
        <input
          className="search"
          type="search"
          placeholder="Search by title, subject or keyword"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title={query ? 'No tasks match your search' : 'No open tasks right now'}>
          New assignments appear here as soon as taskers post them. Check back soon.
        </Empty>
      ) : (
        <div className="stack">
          <p className="muted">{data.total} open task{data.total === 1 ? '' : 's'}</p>
          {data.items.map((t) => (
            <TaskCard
              key={t._id}
              task={t}
              amount={t.workerEarning}
              amountLabel="you earn"
              showStatus={false}
              showPerson="tasker"
              actions={
                <>
                  <button className="btn btn-ghost btn-sm" disabled={busyId === t._id} onClick={() => ignore(t._id)}>
                    Ignore
                  </button>
                  <button className="btn btn-primary btn-sm" disabled={busyId === t._id} onClick={() => accept(t._id)}>
                    Accept
                  </button>
                </>
              }
            />
          ))}
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
