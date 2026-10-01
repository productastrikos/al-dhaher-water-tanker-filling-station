import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Icon } from '../lib/Icon';
import { ChatBubbles, Chip, useChat } from '../views/sia/chat';

const GREETING = "Hi — I'm S!a. Ask me about bay performance, revenue, forecasts or security across Al Dhaher.";

/** Floating S!a assistant: FAB + slide-in chat panel (port of legacy wireAiFab()). Mounted once by <Shell/>. */
export default function AiFab() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const { messages, input, setInput, ask } = useChat(GREETING);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button className={`ai-fab${open ? ' open' : ''}`} id="ai-fab" title={t('Ask S!a')} aria-label="Ask S!a — AI assistant" onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? 'x' : 'sparkles'} />
      </button>

      <div className={`ai-panel${open ? ' open' : ''}`} id="ai-panel">
        <div className="ai-panel-header">
          <div className="ai-panel-title"><Icon name="sparkles" /> <span>{t('S!a — Ask it. Act on it.')}</span></div>
          <div className="ai-panel-close" id="ai-panel-close" role="button" tabIndex={0} aria-label="Close" onClick={() => setOpen(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(false); }}>
            <Icon name="x" />
          </div>
        </div>
        <ChatBubbles messages={messages} id="ai-panel-window" t={t} />
        <div className="ai-panel-chips" id="ai-panel-chips">
          <Chip q="Which bays are underperforming today?" onAsk={ask}>{t('Underperforming bays?')}</Chip>
          <Chip q="Forecast tomorrow's peak demand" onAsk={ask}>{t('Forecast peak demand')}</Chip>
          <Chip q="Any accounts flagged for fraud?" onAsk={ask}>{t('Fraud flags?')}</Chip>
        </div>
        <div className="chat-input-row ai-panel-input-row">
          <input
            type="text"
            id="ai-panel-input"
            ref={inputRef}
            placeholder={t('Ask S!a about operations, revenue, assets...')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ask(input); }}
          />
          <button className="btn btn-primary" id="ai-panel-send" aria-label="Send" onClick={() => ask(input)}><Icon name="send" /></button>
        </div>
      </div>
    </>
  );
}
