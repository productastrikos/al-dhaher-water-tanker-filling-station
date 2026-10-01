import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { SIA_RESPONSES } from '../../sim/data';
import { erpSiaAnswer } from '../../erp/sia';

/** Shared S!a chat logic (legacy wireChatSurface / askInSurface / pushChat) used by both the S!a page and the floating panel. */
export const SIA_FALLBACK =
  'S!a is analyzing across S!aP Datalake (42 bays, CCTV analytics, K-net settlement) — here\'s a summary answer for the demo. In production this is generated live from the historian with a confidence score and source trace.';

export interface ChatMsg { id: number; who: 'bot' | 'user'; text: string; /** greeting strings are translated at render time */ i18n?: boolean; }

export function useChat(greeting: string) {
  const [messages, setMessages] = useState<ChatMsg[]>([{ id: 0, who: 'bot', text: greeting, i18n: true }]);
  const [input, setInput] = useState('');
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const push = useCallback((who: ChatMsg['who'], text: string) => {
    setMessages((m) => [...m, { id: nextId.current++, who, text }]);
  }, []);

  /** Ask a question (typed or from a chip): echoes it, then answers after 500 ms from the canned table. */
  const ask = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    push('user', text);
    setInput('');
    timers.current.push(setTimeout(() => push('bot', erpSiaAnswer(text) || SIA_RESPONSES[text.toLowerCase()] || SIA_FALLBACK), 500));
  }, [push]);

  return { messages, input, setInput, ask };
}

/** Bubble list; newlines become <br> like the legacy innerHTML replace. Keeps the window scrolled to the newest bubble. */
export function ChatBubbles({ messages, id, t }: { messages: ChatMsg[]; id: string; t: (s: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [messages]);
  return (
    <div className="chat-window" id={id} ref={ref}>
      {messages.map((m) => (
        <div key={m.id} className={`chat-bubble ${m.who}`}>
          {(m.i18n ? t(m.text) : m.text).split('\n').map((line, i, arr) => (
            <Fragment key={i}>{line}{i < arr.length - 1 && <br />}</Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Chip({ q, children, onAsk }: { q: string; children: React.ReactNode; onAsk: (q: string) => void }) {
  return (
    <span
      className="suggest-chip"
      data-q={q}
      role="button"
      tabIndex={0}
      onClick={() => onAsk(q)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAsk(q); } }}
    >{children}</span>
  );
}
