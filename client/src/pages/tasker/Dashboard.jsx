import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useToast } from '../../context/ToastContext';
import TaskCard from '../../components/TaskCard';
import { Empty, Loading, Pagination } from '../../components/ui';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending_payment', label: 'Awaiting payment' },
  { key: 'open', label: 'Open' },
  { key: 'accepted,revision', label: 'In progress' },
  { key: 'submitted', label: 'Needs review' },
  { key: 'approved', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const countFor = (key, counts) =>
  key === '' ? Object.values(counts).reduce((a, b) => a + b, 0) : key.split(',').reduce((s, k) => s + (counts[k] || 0), 0);

export default function TaskerDashboard() {
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get('/tasks/mine', { params: { status: filter || undefined, page } });
      setData(res);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, [filter, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = data?.counts || {};
  const needsReview = counts.submitted || 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">My requests</h1>
          <p className="muted">Assignments you've posted for workers to pick up.</p>
        </div>
        <Link to="/new" className="btn btn-primary">
          + New request
        </Link>
      </div>

      {needsReview > 0 && (
        <div className="alert alert-info">
          {needsReview} submission{needsReview > 1 ? 's are' : ' is'} waiting for your review.{' '}
          <button className="link-btn" onClick={() => { setFilter('submitted'); setPage(1); }}>
            Show them
          </button>
        </div>
      )}

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
        <Empty title={filter ? `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} requests` : 'No requests yet'}>
          {!filter && <Link to="/new" className="btn btn-primary">Post your first assignment</Link>}
        </Empty>
      ) : (
        <div className="stack">
          {data.items.map((t) => (
            <TaskCard
              key={t._id}
              task={t}
              amount={t.status === 'cancelled' || t.status === 'pending_payment' ? undefined : t.price}
              amountLabel={t.payment?.status === 'refunded' ? 'refunded' : 'paid'}
              showPerson="worker"
              actions={
                t.status === 'pending_payment' ? (
                  <Link to={`/tasks/${t._id}`} className="btn btn-primary btn-sm">Pay now</Link>
                ) : t.status === 'submitted' ? (
                  <Link to={`/tasks/${t._id}`} className="btn btn-primary btn-sm">Review work</Link>
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
