import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { FileDropzone, Loading } from '../../components/ui';
import { fileSize, toDatetimeLocal } from '../../utils/format';
import { hasPdfFile } from '../../utils/files';
import LocationFields from '../../components/LocationFields';

export default function EditTask() {
  const { id } = useParams();
  const { config } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState([]);
  const [removedUrls, setRemovedUrls] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/tasks/${id}`)
      .then(({ data }) => {
        setTask(data.task);
        setForm({
          title: data.task.title || '',
          subject: data.task.subject || '',
          pages: data.task.pages ?? '',
          deadline: data.task.deadline ? toDatetimeLocal(new Date(data.task.deadline)) : '',
          description: data.task.description || '',
          additionalInfo: data.task.additionalInfo || '',
          workLocation: {
            name: data.task.workLocation?.name || '',
            latitude: data.task.workLocation?.point?.coordinates?.[1]?.toString() || '',
            longitude: data.task.workLocation?.point?.coordinates?.[0]?.toString() || '',
          },
        });
      })
      .catch((err) => setError(errMsg(err)));
  }, [id]);

  if (error) {
    return (
      <div className="narrow">
        <div className="alert alert-error">{error}</div>
        <Link to={`/tasks/${id}`} className="btn btn-outline">Back to request</Link>
      </div>
    );
  }
  if (!task || !form) return <Loading />;

  const existingFiles = task.files || [];
  const remainingFiles = existingFiles.filter((file) => !removedUrls.includes(file.url));
  const maxFiles = config?.maxFiles ?? 5;
  const maxFileMb = config?.maxFileMb ?? 10;
  const maxNewFiles = Math.max(0, maxFiles - remainingFiles.length);
  const hasAssignmentPdf = hasPdfFile([...remainingFiles, ...files]);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!hasAssignmentPdf) {
      setError('Keep or upload at least one PDF assignment file.');
      return;
    }
    if (remainingFiles.length + files.length > maxFiles) {
      setError(`You can attach at most ${maxFiles} files.`);
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append('title', form.title);
      body.append('subject', form.subject);
      body.append('pages', form.pages);
      body.append('deadline', form.deadline ? new Date(form.deadline).toISOString() : '');
      body.append('description', form.description);
      body.append('additionalInfo', form.additionalInfo);
      body.append('workLocation', JSON.stringify(form.workLocation));
      body.append('removeFileUrls', JSON.stringify(removedUrls));
      files.forEach((file) => body.append('files', file));
      await api.put(`/tasks/${id}`, body);
      navigate(`/tasks/${id}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">Edit request</h1>
          <p className="muted">You can edit this request until a worker accepts it. At least one PDF must remain attached.</p>
        </div>
      </div>

      <form className="card form-card" onSubmit={save}>
        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Title *</span>
          <input required maxLength={120} value={form.title} onChange={set('title')} />
        </label>

        <div className="grid-3">
          <label className="field">
            <span>Subject</span>
            <input maxLength={60} value={form.subject} onChange={set('subject')} />
          </label>
          <label className="field">
            <span>Pages / length</span>
            <input type="number" min="0" value={form.pages} onChange={set('pages')} />
          </label>
          <label className="field">
            <span>Deadline</span>
            <input type="datetime-local" value={form.deadline} onChange={set('deadline')} />
          </label>
        </div>

        <label className="field">
          <span>What needs to be done? *</span>
          <textarea required rows={6} maxLength={5000} value={form.description} onChange={set('description')} />
        </label>

        <label className="field">
          <span>Additional information</span>
          <textarea rows={4} maxLength={3000} value={form.additionalInfo} onChange={set('additionalInfo')} />
        </label>

        <LocationFields
          value={form.workLocation}
          onChange={(workLocation) => setForm({ ...form, workLocation })}
          title="Where the work is located"
          disabled={busy}
        />

        <div className="field">
          <span>Current attachments</span>
          {remainingFiles.length ? (
            <ul className="file-list picked">
              {remainingFiles.map((file) => (
                <li key={file.url}>
                  <span className="file-icon">📄</span>
                  <a href={file.url} target="_blank" rel="noreferrer" download={file.name}>{file.name}</a>
                  {file.size ? <small>{fileSize(file.size)}</small> : null}
                  <button
                    type="button"
                    className="link-btn"
                    disabled={busy}
                    onClick={() => setRemovedUrls([...removedUrls, file.url])}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No current attachments.</p>}
        </div>

        <div className="field">
          <span>Add files *</span>
          <small className="muted">Keep or upload at least one PDF. Other allowed file types are optional.</small>
          <FileDropzone
            files={files}
            onChange={setFiles}
            maxFiles={maxNewFiles}
            maxFileMb={maxFileMb}
            disabled={busy || maxNewFiles === 0}
          />
        </div>

        <div className="row-start">
          <button className="btn btn-primary" disabled={busy || !hasAssignmentPdf}>
            {busy ? 'Saving…' : 'Save request'}
          </button>
          <Link to={`/tasks/${id}`} className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
