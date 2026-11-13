import { useEffect, useRef, useState } from 'react';
import { STATUS, fileSize } from '../utils/format';

export const Spinner = () => <div className="spinner" aria-label="Loading" />;

export const Loading = () => (
  <div className="center-block">
    <Spinner />
  </div>
);

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'gray' };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 22 }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={n <= value ? 'star on' : 'star'}
          style={{ fontSize: size }}
          onClick={onChange ? () => onChange(n === value ? 0 : n) : undefined}
          disabled={!onChange}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function FileList({ files = [], empty = 'No files attached' }) {
  if (!files.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="file-list">
      {files.map((f) => (
        <li key={f.url}>
          <span className="file-icon">📄</span>
          <a href={f.url} target="_blank" rel="noreferrer" download={f.name}>
            {f.name}
          </a>
          {f.size ? <small>{fileSize(f.size)}</small> : null}
        </li>
      ))}
    </ul>
  );
}

export function FileDropzone({ files, onChange, maxFiles = 5, maxFileMb = 10, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  const add = (incoming) => {
    setError('');
    const list = [...files];
    for (const f of incoming) {
      if (f.size > maxFileMb * 1024 * 1024) {
        setError(`"${f.name}" is larger than ${maxFileMb} MB`);
        continue;
      }
      if (list.length >= maxFiles) {
        setError(`You can attach at most ${maxFiles} files`);
        break;
      }
      if (!list.some((x) => x.name === f.name && x.size === f.size)) list.push(f);
    }
    onChange(list);
  };

  return (
    <div>
      <div
        className={`dropzone ${over ? 'over' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add([...e.dataTransfer.files]);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <strong>Drop files here or click to browse</strong>
        <small>
          PDF, Word, PowerPoint, Excel, images, ZIP · up to {maxFiles} files, {maxFileMb} MB each
        </small>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            add([...e.target.files]);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      {files.length > 0 && (
        <ul className="file-list picked">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span className="file-icon">📎</span>
              <span>{f.name}</span>
              <small>{fileSize(f.size)}</small>
              <button type="button" className="link-btn" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Small modal asking for one text value (payout reference, rejection reason...). */
export function PromptModal({ title, label, placeholder, required, multiline, confirmText = 'Confirm', danger, onSubmit, onClose }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(value.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{title}</h3>
        <label className="field">
          <span>{label}</span>
          {multiline ? (
            <textarea autoFocus rows={3} value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <input autoFocus value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
          )}
        </label>
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy || (required && !value.trim())}>
            {busy ? 'Please wait…' : confirmText}
          </button>
        </div>
      </form>
    </div>
  );
}
