import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FileDropzone, FileList, Loading, StatusBadge, Stars, Empty } from '../components/ui';
import { dateTime, deadlineInfo, money } from '../utils/format';
import { payForTask } from '../utils/payment';

const TEXT = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };

export default function TaskDetail() {
  const { id } = useParams();
  const { user, config } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/${id}`);
      setTask(data.task);
      setError('');
    } catch (err) {
      setError(errMsg(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Run an API call, toast the result, then refresh the task. */
  const run = async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
      await load();
      return true;
    } catch (err) {
      toast.error(err.response ? errMsg(err) : err.message);
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Empty title="Can't open this task">
        {error}
        <br />
        <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>Back to home</Link>
      </Empty>
    );
  }
  if (!task) return <Loading />;

  const isTasker = user.role === 'tasker';
  const isWorker = user.role === 'worker';
  const isAdmin = user.role === 'admin';
  const mineAsWorker = isWorker && task.worker && String(task.worker._id) === String(user._id);
  const dl = deadlineInfo(task.deadline);
  const submissions = task.submissions || [];
  const latest = submissions[submissions.length - 1];

  /* ---- actions ---- */
  const payNow = () =>
    run(async () => {
      const { data } = await api.post(`/tasks/${task._id}/order`);
      await payForTask({ task, order: data.order, user });
    }, 'Payment received. Your request is now visible to workers.');

  const cancel = () => {
    const paid = task.payment?.status === 'paid';
    if (!window.confirm(paid ? `Cancel this request and refund ${money(task.price)}?` : 'Cancel this request?')) return;
    return run(() => api.post(isAdmin ? `/admin/tasks/${task._id}/cancel` : `/tasks/${task._id}/cancel`), paid ? 'Cancelled. Your refund has been initiated.' : 'Request cancelled');
  };

  const accept = () => run(() => api.post(`/tasks/${task._id}/accept`), 'Task accepted. Upload your work when it is done.');
  const ignore = async () => {
    setBusy(true);
    try {
      await api.post(`/tasks/${task._id}/ignore`);
      navigate('/');
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };
  const release = () => {
    if (!window.confirm('Give this task back? It will return to the open list for other workers.')) return;
    return run(async () => {
      await api.post(`/tasks/${task._id}/release`);
      navigate('/work');
    });
  };

  return (
    <div className="detail">
      <Link to={isAdmin ? '/admin/tasks' : isWorker ? (mineAsWorker ? '/work' : '/') : '/'} className="back">
        ← Back
      </Link>

      <div className="detail-head">
        <div>
          <h1 className="page-title">{task.title}</h1>
          <div className="meta">
            <StatusBadge status={task.status} />
            {task.subject && <span className="chip">{task.subject}</span>}
            {task.pages ? <span>{task.pages} pages</span> : null}
            <span>Posted {dateTime(task.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <h3>What needs to be done</h3>
            <p style={TEXT}>{task.description}</p>
            {task.additionalInfo && (
              <>
                <h4>Additional information</h4>
                <p style={TEXT}>{task.additionalInfo}</p>
              </>
            )}
            <h4>Attached files</h4>
            <FileList files={task.files} />
          </section>

          {task.revisionNote && ['revision'].includes(task.status) && (
            <section className="card note-card">
              <h3>Revision requested</h3>
              <p style={TEXT}>{task.revisionNote}</p>
            </section>
          )}

          {submissions.length > 0 && (
            <section className="card">
              <h3>Submitted work</h3>
              {[...submissions].reverse().map((s, i) => (
                <div key={s.submittedAt} className={i === 0 ? 'submission latest' : 'submission'}>
                  <div className="meta">
                    <strong>Version {submissions.length - i}</strong>
                    <span>{dateTime(s.submittedAt)}</span>
                    {i === 0 && <span className="chip">Latest</span>}
                  </div>
                  {s.note && <p style={TEXT}>{s.note}</p>}
                  <FileList files={s.files} />
                </div>
              ))}
            </section>
          )}

          {task.status === 'approved' && task.review?.rating && (
            <section className="card">
              <h3>Review</h3>
              <Stars value={task.review.rating} />
              {task.review.comment && <p style={TEXT}>{task.review.comment}</p>}
            </section>
          )}

          {/* ---- Tasker: review submitted work ---- */}
          {isTasker && task.status === 'submitted' && latest && (
            <ReviewPanel task={task} busy={busy} run={run} maxRevisions={config?.maxRevisions} />
          )}

          {/* ---- Worker: submit work ---- */}
          {mineAsWorker && ['accepted', 'revision'].includes(task.status) && (
            <SubmitPanel task={task} busy={busy} run={run} config={config} />
          )}
        </div>

        <aside className="stack">
          <section className="card side-card">
            <h3>Details</h3>
            <dl>
              <dt>Deadline</dt>
              <dd className={dl?.urgent ? 'urgent' : ''}>
                {task.deadline ? `${dateTime(task.deadline)} (${dl.text})` : 'No deadline'}
              </dd>
              {(isWorker || isAdmin) && task.tasker && (
                <>
                  <dt>Posted by</dt>
                  <dd>
                    {task.tasker.name}
                  </dd>
                </>
              )}
              {(isTasker || isAdmin) && task.worker && (
                <>
                  <dt>Worker</dt>
                  <dd>
                    {task.worker.name}
                    {task.worker.ratingCount > 0 && <small className="muted"> · ★ {task.worker.rating}</small>}
                  </dd>
                </>
              )}
              {task.revisionCount > 0 && (
                <>
                  <dt>Revisions</dt>
                  <dd>
                    {task.revisionCount}
                    {config?.maxRevisions ? ` of ${config.maxRevisions}` : ''}
                  </dd>
                </>
              )}
              {task.acceptedAt && (isTasker || isAdmin) && (
                <>
                  <dt>Accepted</dt>
                  <dd>{dateTime(task.acceptedAt)}</dd>
                </>
              )}
              {task.completedAt && (
                <>
                  <dt>Completed</dt>
                  <dd>{dateTime(task.completedAt)}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="card side-card">
            <h3>Payment</h3>
            <dl>
              {isWorker && (
                <>
                  <dt>You earn</dt>
                  <dd className="big">{money(task.workerEarning)}</dd>
                  <dd className="muted small">
                    {task.status === 'approved' ? 'Added to your balance' : 'Paid once the tasker approves your work'}
                  </dd>
                </>
              )}
              {isTasker && (
                <>
                  <dt>Price</dt>
                  <dd className="big">{money(task.price)}</dd>
                  <dd className="muted small">
                    {{ unpaid: 'Not paid yet', paid: 'Paid and held until you approve', refunded: 'Refunded' }[task.payment?.status]}
                  </dd>
                </>
              )}
              {isAdmin && (
                <>
                  <dt>Paid by tasker</dt>
                  <dd className="big">{money(task.price)}</dd>
                  <dd className="muted small">Payment: {task.payment?.status}</dd>
                  <dt>Worker earning</dt>
                  <dd>{money(task.workerEarning)}</dd>
                  <dt>Platform fee</dt>
                  <dd>{money(task.platformFee)}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="card side-card actions">
            <h3>Actions</h3>

            {isTasker && task.status === 'pending_payment' && (
              <>
                <p className="muted small">Workers can't see this request until it's paid.</p>
                <button className="btn btn-primary btn-block" disabled={busy} onClick={payNow}>
                  Pay {money(task.price)} now
                </button>
              </>
            )}
            {isTasker && ['pending_payment', 'open'].includes(task.status) && (
              <button className="btn btn-outline-danger btn-block" disabled={busy} onClick={cancel}>
                {task.status === 'open' ? 'Cancel & refund' : 'Discard request'}
              </button>
            )}

            {isWorker && task.status === 'open' && !mineAsWorker && (
              <>
                <button className="btn btn-primary btn-block" disabled={busy} onClick={accept}>
                  Accept task
                </button>
                <button className="btn btn-ghost btn-block" disabled={busy} onClick={ignore}>
                  Ignore
                </button>
              </>
            )}
            {mineAsWorker && task.status === 'accepted' && (
              <button className="btn btn-outline-danger btn-block" disabled={busy} onClick={release}>
                Give task back
              </button>
            )}

            {isAdmin && ['pending_payment', 'open'].includes(task.status) && (
              <button className="btn btn-outline-danger btn-block" disabled={busy} onClick={cancel}>
                Cancel task{task.payment?.status === 'paid' ? ' & refund tasker' : ''}
              </button>
            )}

            {!(
              (isTasker && ['pending_payment', 'open'].includes(task.status)) ||
              (isWorker && (task.status === 'open' || (mineAsWorker && task.status === 'accepted'))) ||
              (isAdmin && ['pending_payment', 'open'].includes(task.status))
            ) && <p className="muted small">No actions available right now.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ReviewPanel({ task, busy, run, maxRevisions }) {
  const [mode, setMode] = useState(null); // 'approve' | 'revise'
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const left = maxRevisions ? maxRevisions - (task.revisionCount || 0) : null;

  return (
    <section className="card review-card">
      <h3>Review the submitted work</h3>
      <p className="muted">Download and check the files above. Approving releases the worker's payment.</p>

      {!mode && (
        <div className="row-start">
          <button className="btn btn-primary" onClick={() => setMode('approve')}>
            Approve work
          </button>
          <button className="btn btn-outline" disabled={left !== null && left <= 0} onClick={() => setMode('revise')}>
            Request changes{left !== null ? ` (${Math.max(left, 0)} left)` : ''}
          </button>
        </div>
      )}

      {mode === 'approve' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.post(`/tasks/${task._id}/approve`, { rating: rating || undefined, comment }), 'Work approved. The worker has been paid.');
          }}
        >
          <div className="field">
            <span>Rate the worker (optional)</span>
            <Stars value={rating} onChange={setRating} />
          </div>
          <label className="field">
            <span>Comment (optional)</span>
            <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <div className="row-start">
            <button className="btn btn-primary" disabled={busy}>
              Confirm approval
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>
              Back
            </button>
          </div>
        </form>
      )}

      {mode === 'revise' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.post(`/tasks/${task._id}/revision`, { note }), 'Revision requested');
          }}
        >
          <label className="field">
            <span>What should be changed? *</span>
            <textarea required rows={4} maxLength={2000} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="row-start">
            <button className="btn btn-primary" disabled={busy || !note.trim()}>
              Send to worker
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>
              Back
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function SubmitPanel({ task, busy, run, config }) {
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const body = new FormData();
    files.forEach((f) => body.append('files', f));
    if (note.trim()) body.append('note', note.trim());
    const ok = await run(() => api.post(`/tasks/${task._id}/submit`, body), 'Work submitted. You will be paid once the tasker approves it.');
    if (ok) {
      setFiles([]);
      setNote('');
    }
  };

  return (
    <form className="card review-card" onSubmit={submit}>
      <h3>{task.status === 'revision' ? 'Upload the revised work' : 'Submit your completed work'}</h3>
      <div className="field">
        <span>Files *</span>
        <FileDropzone files={files} onChange={setFiles} maxFiles={config?.maxFiles} maxFileMb={config?.maxFileMb} disabled={busy} />
      </div>
      <label className="field">
        <span>Note to the tasker (optional)</span>
        <textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="btn btn-primary" disabled={busy || files.length === 0}>
        {busy ? 'Uploading…' : 'Submit work'}
      </button>
    </form>
  );
}
