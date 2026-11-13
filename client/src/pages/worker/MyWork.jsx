import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useToast } from '../../context/ToastContext';
import TaskCard from '../../components/TaskCard';
import { Empty, Loading, Pagination } from '../../components/ui';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'accepted,revision', label: 'To do' },
  { key: 'submitted', label: 'Under review' },
  { key: 'approved', label: 'Completed' },
];

const countFor = (key, counts) =>
  key === '' ? Object.values(counts).reduce((a, b) => a + b, 0) : key.split(',').reduce((s, k) => s + (counts[k] || 0), 0);

export default function MyWork() {
  const toast = useToast();
  const [filter, setFilter] = useState('accepted,revision');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get('/tasks/assigned', { params: { status: filter || undefined, page } });
      setData(res);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, [filter, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = data?.counts || {};

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">My work</h1>
          <p className="muted">Tasks you've accepted. Upload the finished work to get paid.</p>
        </div>
      </div>

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            className={`filter ${filter === f.key ? 'on' : ''}`}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
          >
            {f.label} <span>{countFor(f.key, counts)}</span>
          </button>
        ))}
      </div>

      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title="Nothing here yet">
          <Link to="/" className="btn btn-primary">Find tasks</Link>
        </Empty>
      ) : (
        <div className="stack">
          {data.items.map((t) => (
            <TaskCard
              key={t._id}
              task={t}
              amount={t.workerEarning}
              amountLabel={t.status === 'approved' ? 'earned' : 'you earn'}
              showPerson="tasker"
              actions={
                ['accepted', 'revision'].includes(t.status) ? (
                  <Link to={`/tasks/${t._id}`} className="btn btn-primary btn-sm">
                    {t.status === 'revision' ? 'Fix & resubmit' : 'Submit work'}
                  </Link>
                ) : null
              }
            />
          ))}
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
