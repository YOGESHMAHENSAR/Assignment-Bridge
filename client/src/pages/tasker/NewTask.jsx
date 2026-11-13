import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FileDropzone } from '../../components/ui';
import { money, toDatetimeLocal } from '../../utils/format';
import { payForTask } from '../../utils/payment';

export default function NewTask() {
  const { user, config } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', subject: '', pages: '', deadline: '', description: '', additionalInfo: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const price = config?.price ?? 100;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    let created;
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== '' && body.append(k, k === 'deadline' ? new Date(v).toISOString() : v));
      files.forEach((f) => body.append('files', f));
      created = (await api.post('/tasks', body)).data;
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
      return;
    }

    try {
      await payForTask({ task: created.task, order: created.order, user });
      toast.success('Payment received. Your request is now visible to workers.');
    } catch (err) {
      // The request exists but is unpaid; the tasker can finish paying from its page.
      toast.info(`${err.message}. You can complete payment from the request page.`);
    }
    navigate(`/tasks/${created.task._id}`);
  };

  return (
    <div className="narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">New assignment request</h1>
          <p className="muted">Describe the work clearly. Workers see everything on this page before accepting.</p>
        </div>
      </div>

      <form className="card form-card" onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Title *</span>
          <input required maxLength={120} placeholder="e.g. Data Structures assignment 3: Linked lists" value={form.title} onChange={set('title')} />
        </label>

        <div className="grid-3">
          <label className="field">
            <span>Subject</span>
            <input maxLength={60} placeholder="e.g. Computer Science" value={form.subject} onChange={set('subject')} />
          </label>
          <label className="field">
            <span>Pages / length</span>
            <input type="number" min="0" placeholder="e.g. 10" value={form.pages} onChange={set('pages')} />
          </label>
          <label className="field">
            <span>Deadline</span>
            <input type="datetime-local" min={toDatetimeLocal(new Date())} value={form.deadline} onChange={set('deadline')} />
          </label>
        </div>

        <label className="field">
          <span>What needs to be done? *</span>
          <textarea required rows={6} maxLength={5000} placeholder="Explain the assignment: questions to answer, topics to cover, format, handwritten or typed…" value={form.description} onChange={set('description')} />
        </label>

        <label className="field">
          <span>Additional information</span>
          <textarea rows={4} maxLength={3000} placeholder="Teacher's guidelines, references, preferred style, anything else the worker should know" value={form.additionalInfo} onChange={set('additionalInfo')} />
        </label>

        <div className="field">
          <span>Attach files</span>
          <FileDropzone files={files} onChange={setFiles} maxFiles={config?.maxFiles} maxFileMb={config?.maxFileMb} disabled={busy} />
        </div>

        <div className="pay-box">
          <div>
            <strong>{money(price)}</strong> per assignment
            <small>Held securely until you approve the finished work. Cancel any time before a worker accepts for a full refund.</small>
          </div>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Please wait…' : `Post & pay ${money(price)}`}
          </button>
        </div>
      </form>
    </div>
  );
}
