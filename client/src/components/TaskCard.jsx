import { Link } from 'react-router-dom';
import { StatusBadge } from './ui';
import { dateOnly, deadlineInfo, money } from '../utils/format';

/**
 * `amount` is what to show on the right (e.g. the worker's earning or the price the tasker paid).
 * `actions` renders optional buttons under the card.
 */
export default function TaskCard({ task, amount, amountLabel, showStatus = true, actions, showPerson }) {
  const dl = deadlineInfo(task.deadline);
  const person = showPerson === 'tasker' ? task.tasker : showPerson === 'worker' ? task.worker : null;

  return (
    <article className="card task-card">
      <div className="task-card-top">
        <div>
          <Link to={`/tasks/${task._id}`} className="task-title">
            {task.title}
          </Link>
          <div className="meta">
            {task.subject && <span className="chip">{task.subject}</span>}
            {task.pages ? <span>{task.pages} pages</span> : null}
            {task.workLocation?.name && <span>{task.workLocation.name}</span>}
            {task.files?.length ? <span>{task.files.length} file{task.files.length > 1 ? 's' : ''}</span> : null}
            {person && <span>{showPerson === 'tasker' ? 'By' : 'Worker:'} {person.name}</span>}
          </div>
        </div>
        <div className="task-card-side">
          {amount !== undefined && (
            <div className="amount">
              {money(amount)}
              {amountLabel && <small>{amountLabel}</small>}
            </div>
          )}
          {showStatus && <StatusBadge status={task.status} />}
        </div>
      </div>

      <p className="task-desc">{task.description}</p>

      <div className="task-card-bottom">
        <div className="meta">
          {task.deadline ? (
            <span className={dl?.urgent ? 'urgent' : ''}>
              Due {dateOnly(task.deadline)} · {dl?.text}
            </span>
          ) : (
            <span>No deadline</span>
          )}
          <span>Posted {dateOnly(task.createdAt)}</span>
        </div>
        <div className="row-end">
          {actions}
          <Link to={`/tasks/${task._id}`} className="btn btn-outline btn-sm">
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
