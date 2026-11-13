import { useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api';
import { dateTime } from '../utils/format';
import { useRealtime } from '../context/RealtimeContext';

const mergeMessages = (current, incoming) => {
  const messages = new Map(current.map((message) => [message._id, message]));
  incoming.forEach((message) => messages.set(message._id, message));
  return [...messages.values()].sort(
    (left, right) =>
      new Date(left.createdAt) - new Date(right.createdAt) ||
      String(left._id).localeCompare(String(right._id))
  );
};

export default function TaskChat({ taskId, userId, peerName, isOpen }) {
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(isOpen);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const { socket, connected } = useRealtime();

  useEffect(() => {
    setChatOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const { data } = await api.get(`/tasks/${taskId}/messages`);
        if (cancelled) return;
        setMessages((current) => mergeMessages(current, data.messages));
        setChatOpen(data.chatOpen);
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError(errMsg(err));
        if ([403, 404].includes(err.response?.status)) setChatOpen(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const onMessage = (payload) => {
      if (String(payload.taskId) === String(taskId)) {
        setMessages((current) => mergeMessages(current, [payload.message]));
      }
    };
    const onChatClosed = (payload) => {
      if (String(payload.taskId) === String(taskId)) setChatOpen(false);
    };
    const joinRoom = () => {
      socket.emit('task:join', taskId, (result) => {
        if (!result?.ok && !cancelled) setError(result?.message || 'Could not join this task chat');
      });
    };

    refresh();
    if (socket && chatOpen) {
      socket.on('connect', joinRoom);
      socket.on('chat:new-message', onMessage);
      socket.on('task:chat-closed', onChatClosed);
      if (socket.connected) joinRoom();
    }
    const interval = chatOpen && !connected ? window.setInterval(refresh, 4000) : null;
    return () => {
      cancelled = true;
      if (socket) {
        socket.off('connect', joinRoom);
        socket.off('chat:new-message', onMessage);
        socket.off('task:chat-closed', onChatClosed);
        socket.emit('task:leave', taskId);
      }
      if (interval) window.clearInterval(interval);
    };
  }, [taskId, chatOpen, socket, connected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || !chatOpen) return;

    setSending(true);
    setError('');
    try {
      const { data } = await api.post(`/tasks/${taskId}/messages`, { content });
      setMessages((current) => mergeMessages(current, [data.message]));
      setChatOpen(data.chatOpen);
      setDraft('');
    } catch (err) {
      setError(errMsg(err));
      if (err.response?.status === 409) setChatOpen(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="card chat-card">
      <header className="chat-heading">
        <div>
          <h3>Chat with {peerName}</h3>
          <p className="muted small">
            {chatOpen ? (connected ? 'Live messages enabled.' : 'Reconnecting; checking for messages.') : 'This chat is closed; previous messages are read-only.'}
          </p>
        </div>
        <span className={chatOpen ? 'chat-state open' : 'chat-state'}>{chatOpen ? 'Open' : 'Closed'}</span>
      </header>

      <div className="chat-messages" aria-live="polite">
        {loading && messages.length === 0 ? (
          <p className="muted">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="muted">No messages yet. Start the conversation.</p>
        ) : (
          messages.map((message) => {
            const mine = String(message.sender?._id) === String(userId);
            return (
              <article key={message._id} className={mine ? 'chat-message mine' : 'chat-message'}>
                <div className="chat-message-meta">
                  <strong>{mine ? 'You' : message.sender?.name || 'Participant'}</strong>
                  <time>{dateTime(message.createdAt)}</time>
                </div>
                <p>{message.content}</p>
              </article>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      {chatOpen && (
        <form className="chat-compose" onSubmit={send}>
          <textarea
            required
            maxLength={2000}
            rows={2}
            placeholder="Write a message…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={sending}
          />
          <button className="btn btn-primary" disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
    </section>
  );
}
