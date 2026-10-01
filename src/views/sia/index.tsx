import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { ChatBubbles, Chip, useChat } from './chat';

const GREETING = "Ask S!a about operations, revenue, assets or security across Al Dhaher — I'll answer in plain language with the sources behind it.";

export default function Sia(_props: ViewProps) {
  const { t } = useT();
  const { messages, input, setInput, ask } = useChat(GREETING);

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-title"><span>{t('S!a — Ask it. Act on it.')}</span> <span className="hint">{t('natural-language query over operations, revenue & assets')}</span></div>
        <ChatBubbles messages={messages} id="chat-window" t={t} />
        <div className="chat-input-row">
          <input
            type="text"
            id="chat-input"
            placeholder={t('Ask S!a about operations, revenue, assets...')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ask(input); }}
          />
          <button className="btn btn-primary" id="chat-send" onClick={() => ask(input)}>{t('Ask')}</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <Chip q="Which bays are underperforming today?" onAsk={ask}>{t('Which bays are underperforming today?')}</Chip>
          <Chip q="Forecast tomorrow's peak demand" onAsk={ask}>{t("Forecast tomorrow's peak demand")}</Chip>
          <Chip q="Any accounts flagged for fraud?" onAsk={ask}>{t('Any accounts flagged for fraud?')}</Chip>
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <div className="card-title">{t('Background Agents')}</div>
          <div className="metric-line"><span className="k">{t('Demand Forecaster')}</span><span className="tag green">{t('Active')}</span></div>
          <div className="metric-line"><span className="k">{t('Revenue Reconciler')}</span><span className="tag green">{t('Active')}</span></div>
          <div className="metric-line"><span className="k">{t('Water-Loss Analyzer')}</span><span className="tag green">{t('Active')}</span></div>
        </div>
        <div className="card">
          <div className="card-title">{t('Governance')}</div>
          <div className="util-text">{t('Every S!a recommendation is explainable and traceable to its trigger. Actions run behind human-approval gates — MEW owns the data, logic and roadmap. Glass Box AI, no black-box lock-in.')}</div>
          <div className="badge-row" style={{ marginTop: 10 }}>
            <div className="std-badge">IEC 62443</div>
            <div className="std-badge">ISO 27001</div>
            <div className="std-badge">ISO 22320</div>
          </div>
        </div>
      </div>
    </div>
  );
}
