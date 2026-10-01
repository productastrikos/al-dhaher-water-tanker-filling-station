import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar } from 'react-chartjs-2';
import { BarController, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import type { ViewProps } from '../../shell/types';
import { useT } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { REPORTS } from '../../sim/data';
import { chartBaseOptions, verticalGradient } from './chartOptions';

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

type Period = 'shift' | 'day' | 'month';
interface Schedule { period: Period; time: string; emails: string; createdAt: number; }

const LS_KEY = 'siap.reports.schedules';
const PERIODS: { id: Period; label: string; aria: string }[] = [
  { id: 'shift', label: 'Shift-wise', aria: 'Shift-wise report' },
  { id: 'day', label: 'Day-wise', aria: 'Day-wise report' },
  { id: 'month', label: 'Month-wise', aria: 'Month-wise report' },
];
const PERIOD_LABEL: Record<string, string> = { shift: 'Shift-wise', day: 'Day-wise', month: 'Month-wise' };

function loadSchedules(): Schedule[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function storeSchedules(list: Schedule[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

/** Real CSV download for the active period (ported from legacy exportReportCsv). */
function exportReportCsv(period: Period) {
  const r = REPORTS[period];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [r.cols.map(esc).join(',')].concat(r.rows.map((row) => row.map(esc).join(',')));
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `siap-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports(_props: ViewProps) {
  const { t } = useT();
  const [period, setPeriod] = useState<Period>('shift');
  const [schedules, setSchedules] = useState<Schedule[]>(loadSchedules);
  const [modalOpen, setModalOpen] = useState(false);
  // modal form fields persist between opens (like the legacy DOM inputs did)
  const [schedPeriod, setSchedPeriod] = useState<Period>('shift');
  const [schedTime, setSchedTime] = useState('07:00');
  const [schedEmails, setSchedEmails] = useState('');

  const r = REPORTS[period];

  const openModal = () => { setSchedPeriod(period); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);
  const save = () => {
    const list = [{ period: schedPeriod, time: schedTime || '07:00', emails: schedEmails.trim() || 'ops@mew.gov.kw', createdAt: Date.now() }, ...schedules];
    storeSchedules(list);
    setSchedules(list);
    closeModal();
  };
  const remove = (i: number) => {
    const list = schedules.filter((_, idx) => idx !== i);
    storeSchedules(list);
    setSchedules(list);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const chartData = {
    labels: r.chartLabels,
    datasets: [{
      label: t('Volume'),
      data: r.chartData,
      backgroundColor: (c: { chart: ChartJS }) => {
        const { chart } = c;
        if (!chart.chartArea) return 'rgba(34,211,238,0.55)';
        return verticalGradient(chart.ctx, chart.chartArea, 'rgba(34,211,238,0.75)', 'rgba(34,211,238,0.12)');
      },
      hoverBackgroundColor: 'rgba(34,211,238,0.9)',
      borderRadius: 5,
      borderSkipped: false as const,
      barPercentage: 0.55,
    }],
  };

  return (
    <>
      <div className="card">
        <div className="card-title"><span>{t('Reporting — Shift, Day & Month')}</span> <span className="hint">{t('generated from the S!aP central historian · scheduled or on demand')}</span></div>
        <div className="report-tabs">
          {PERIODS.map((p) => (
            <div
              key={p.id}
              className={`report-tab${period === p.id ? ' active' : ''}`}
              data-period={p.id}
              tabIndex={0}
              role="button"
              aria-label={p.aria}
              onClick={() => setPeriod(p.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPeriod(p.id); } }}
            >{t(p.label)}</div>
          ))}
        </div>
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <table className="data-table">
            <thead id="report-thead"><tr>{r.cols.map((c) => <th key={c}>{t(c)}</th>)}</tr></thead>
            <tbody id="report-tbody">
              {r.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
            </tbody>
          </table>
          <div className="chart-box" style={{ height: 260 }}>
            {/* key = period so the chart is rebuilt (and re-animates) on tab change, like the legacy destroy()/new Chart() */}
            <Bar key={period} id="report-chart" data={chartData} options={chartBaseOptions(false)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary" id="btn-export-pdf" onClick={() => window.print()}><Icon name="download" /> <span>{t('Export PDF')}</span></button>
          <button className="btn" id="btn-export-csv" onClick={() => exportReportCsv(period)}><Icon name="sheet" /> <span>{t('Export CSV')}</span></button>
          <button className="btn" id="btn-schedule-report" onClick={openModal}><Icon name="calendar-clock" /> <span>{t('Schedule Report')}</span></button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', margin: '20px 0 8px' }}>{t('Scheduled Reports')}</div>
        <div id="scheduled-reports-list" className="scheduled-list">
          {!schedules.length ? (
            <div className="util-text">{t('No scheduled reports yet — click "Schedule Report" to add one.')}</div>
          ) : schedules.map((s, i) => (
            <div className="scheduled-row" key={`${s.createdAt}-${i}`}>
              <div><b style={{ color: 'var(--text)' }}>{t(PERIOD_LABEL[s.period] || s.period)}</b> · {t('daily')} {s.time} · {s.emails}</div>
              <button className="ack-btn" onClick={() => remove(i)}>{t('Remove')}</button>
            </div>
          ))}
        </div>
      </div>

      {createPortal(
        <div className="modal-overlay" id="schedule-modal" hidden={!modalOpen} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-box">
            <h3>{t('Schedule Report')}</h3>
            <div className="modal-field">
              <label>{t('Period')}</label>
              <select className="select" id="schedule-period" style={{ width: '100%' }} value={schedPeriod} onChange={(e) => setSchedPeriod(e.target.value as Period)}>
                <option value="shift">{t('Shift-wise')}</option>
                <option value="day">{t('Day-wise')}</option>
                <option value="month">{t('Month-wise')}</option>
              </select>
            </div>
            <div className="modal-field">
              <label>{t('Time (daily)')}</label>
              <input type="time" id="schedule-time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
            </div>
            <div className="modal-field">
              <label>{t('E-mail recipients')}</label>
              <input type="text" id="schedule-emails" placeholder="ops@mew.gov.kw, dept@mew.gov.kw" value={schedEmails} onChange={(e) => setSchedEmails(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn" id="schedule-modal-cancel" onClick={closeModal}>{t('Cancel')}</button>
              <button className="btn btn-primary" id="schedule-modal-save" onClick={save}>{t('Save Schedule')}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
