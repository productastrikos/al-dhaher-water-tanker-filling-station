import { useMemo } from 'react';
import { Chart, Doughnut } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import type { ViewProps } from '../../shell/types';
import { Icon } from '../../lib/Icon';
import { useSiap } from '../../sim/store';
import { HOURLY, pad } from '../../sim/data';
import { showView } from '../../shell/ui';
import { statusLabel, timeAgo, useT } from '../../i18n';
import { GAUGE_MAX, chartBaseOptions, gaugeColor, verticalGradient } from './charts';
import ArchDiagram from './ArchDiagram';
import MimicDiagram from './MimicDiagram';

const SEV_CLASS = { crit: 'crit', warn: 'warn', amber2: 'warn', info: 'info' } as const;

/* ---- hourly volume & revenue chart (legacy renderHourlyChart) ---- */
const hourlyData = {
  labels: HOURLY.labels,
  datasets: [
    {
      type: 'bar',
      label: 'Volume (k Imp.gal)',
      data: HOURLY.volume,
      backgroundColor: (c: any) => {
        const { chart } = c;
        if (!chart.chartArea) return 'rgba(34,211,238,0.55)';
        return verticalGradient(chart.ctx, chart.chartArea, 'rgba(34,211,238,0.75)', 'rgba(34,211,238,0.12)');
      },
      hoverBackgroundColor: 'rgba(34,211,238,0.9)',
      borderRadius: 5,
      borderSkipped: false,
      barPercentage: 0.62,
      yAxisID: 'y',
      order: 2,
    },
    {
      type: 'line',
      label: 'Revenue (KD)',
      data: HOURLY.revenue,
      borderColor: '#34d399',
      borderWidth: 2.5,
      backgroundColor: (c: any) => {
        const { chart } = c;
        if (!chart.chartArea) return 'rgba(52,211,153,0.15)';
        return verticalGradient(chart.ctx, chart.chartArea, 'rgba(52,211,153,0.32)', 'rgba(52,211,153,0.0)');
      },
      fill: true,
      tension: 0.4,
      yAxisID: 'y1',
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#34d399',
      pointHoverBorderColor: '#04241a',
      pointHoverBorderWidth: 2,
      order: 1,
    },
  ],
} as unknown as ChartData<'bar'>;
const hourlyOptions = chartBaseOptions(true, { y: (v) => `${v}k`, y1: (v) => `KD ${v}` });

/* ---- inlet flow gauge (legacy renderGauge) ---- */
const gaugeOptions = {
  cutout: '78%',
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400, easing: 'easeOutQuart' },
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
} as const;

function KpiRow() {
  const { t } = useT();
  const k = useSiap((s) => s.kpis);
  const alarms = useSiap((s) => s.alarms);
  const open = alarms.filter((a) => !a.ack).length;
  const critOpen = alarms.filter((a) => !a.ack && a.sev === 'crit').length;
  const alarmDelta =
    critOpen > 0 ? { cls: 'kpi-delta warn', text: `${critOpen} ${t('critical')}` }
      : open > 0 ? { cls: 'kpi-delta', text: t('no critical') }
        : { cls: 'kpi-delta up', text: t('all clear') };

  return (
    <div className="kpi-row">
      <div className="kpi-card">
        <div className="kpi-top"><div className="kpi-icon"><Icon name="gauge" /></div><div className="kpi-label">{t('Active Filling Bays')}</div></div>
        <div className="kpi-value" id="kpi-active">{k.activeBays}<span className="kpi-unit">/42</span></div>
        <div className="kpi-delta up" id="kpi-active-delta">▲ live</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-top"><div className="kpi-icon blue"><Icon name="droplets" /></div><div className="kpi-label">{t('Water Dispensed Today')}</div></div>
        <div className="kpi-value" id="kpi-volume">{k.volumeToday.toFixed(2)}<span className="kpi-unit">M Imp.gal</span></div>
        <div className="kpi-delta up">▲ 4.2% vs yday</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-top"><div className="kpi-icon green"><Icon name="banknote" /></div><div className="kpi-label">{t('Revenue Collected')}</div></div>
        <div className="kpi-value" id="kpi-revenue">KD {Math.round(k.revenueToday).toLocaleString()}</div>
        <div className="kpi-delta up">▲ 3.1%</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-top"><div className="kpi-icon"><Icon name="truck" /></div><div className="kpi-label">{t('Tankers Served')}</div></div>
        <div className="kpi-value" id="kpi-tankers">{k.tankersServed.toLocaleString()}</div>
        <div className="kpi-delta up">▲ in queue: 4</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-top"><div className="kpi-icon red"><Icon name="siren" /></div><div className="kpi-label">{t('Open Alarms')}</div></div>
        <div className="kpi-value" id="kpi-alarms">{open}</div>
        <div className={alarmDelta.cls}>{alarmDelta.text}</div>
      </div>
    </div>
  );
}

function BayGrid() {
  const { lang } = useT();
  const bays = useSiap((s) => s.bays);
  const selectBay = useSiap((s) => s.selectBay);
  const open = (id: number) => { selectBay(id); showView('baycontrol'); };

  return (
    <div className="bay-grid" id="bay-grid">
      {bays.map((b) => (
        <div
          key={b.id}
          className={`bay-tile ${b.status}`}
          data-bay={b.id}
          tabIndex={0}
          role="button"
          aria-label={`Bay ${pad(b.id)} — ${statusLabel(b.status, lang)}`}
          onClick={() => open(b.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(b.id); } }}
        >
          <div className="bay-id">BAY {pad(b.id)}</div>
          <div className="bay-status"><span className="bay-dot" />{statusLabel(b.status, lang)}</div>
        </div>
      ))}
    </div>
  );
}

function Gauge() {
  const { t } = useT();
  const val = useSiap((s) => s.kpis.inletFlow);
  const pressure = useSiap((s) => s.kpis.inletPressure);
  const color = gaugeColor(val);

  const data = useMemo(() => ({
    datasets: [{
      data: [val, GAUGE_MAX - val],
      backgroundColor: (c: any) => {
        const { chart } = c;
        if (c.dataIndex !== 0 || !chart.chartArea) return 'rgba(255,255,255,0.06)';
        return verticalGradient(chart.ctx, chart.chartArea, '#67e8f9', color);
      },
      borderWidth: 0,
      borderRadius: 6,
      circumference: 180,
      rotation: 270,
    }],
  }), [val, color]);

  return (
    <div className="card">
      <div className="card-title">{t('S!aP Viz — Station Inlet Flow')}</div>
      <div className="gauge-wrap">
        <div className="gauge-canvas-box">
          <Doughnut data={data as any} options={gaugeOptions as any} />
          <div className="gauge-center">
            <div className="gauge-value" id="gauge-value" style={{ color }}>{val}</div>
            <div className="gauge-unit">m³/h</div>
          </div>
        </div>
        <div className="gauge-scale"><span>0</span><span>500</span><span>1000</span></div>
      </div>
      <div className="gauge-sub">
        <div><span>{t('Inlet press:')}</span> <b id="gauge-pressure">{pressure.toFixed(1)} bar</b></div>
        <div><span>{t('Water temp:')}</span> <b>26°C</b></div>
      </div>
      <div className="gauge-sub"><div><span>{t('Uptime:')}</span> <b>99.98%</b></div></div>
    </div>
  );
}

function AlarmList() {
  const { t, lang } = useT();
  const alarms = useSiap((s) => s.alarms);
  const ackAlarm = useSiap((s) => s.ackAlarm);
  useSiap((s) => s.tickCount); // keep the "Xm ago" labels honest on every simulation tick

  return (
    <div id="alarm-list">
      {alarms.slice(0, 8).map((a) => (
        <div key={a.id} className={`alarm-item ${a.ack ? 'acked' : ''}`}>
          <div className={`alarm-dot ${SEV_CLASS[a.sev]}`} />
          <div className="alarm-body">
            <div className="alarm-text">{a.text}</div>
            <div className="alarm-time">{timeAgo(a.ts, lang)}</div>
          </div>
          {a.ack
            ? <span className="ack-btn acked-label">{t('Acked')}</span>
            : <button className="ack-btn" data-ack={a.id} onClick={() => ackAlarm(a.id)}>{t('Ack')}</button>}
        </div>
      ))}
    </div>
  );
}

export default function View(_: ViewProps) {
  const { t, lang } = useT();

  return (
    <>
      <KpiRow />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><span>{t('S!aP System Architecture & Data Flow')}</span> <span className="hint">{t('Operators (Al Dhaher LCC) · Salmiya Central Control · Tanker Owners (MEW Pay) · MEW Management')}</span></div>
        <div id="arch-diagram"><ArchDiagram /></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><span>{t('ERP Integration — Enterprise & ERP')}</span> <span className="tag green">{t('Connected · SAP · Oracle · D365')}</span></div>
        <div className="util-text">{t('S!aP now runs a full order-to-cash ERP workflow — purchase orders, fleet & driver registration, access credentials, tariffs and a live connector sync log — not just monitoring.')}</div>
        <div className="util-text">
          {lang === 'ar'
            ? t('Open Enterprise & ERP in the sidebar, or jump straight to the connector tiles, object mapping and sync log.')
            : <>Open <b>Enterprise &amp; ERP</b> in the sidebar, or jump straight to the connector tiles, object mapping and sync log.</>}
        </div>
        <button className="btn btn-primary btn-sm" id="dash-erp-link" style={{ marginTop: 10 }} onClick={() => showView('erp-integration')}>
          <Icon name="plug-zap" /> <span>{t('Open ERP Integration')}</span>
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><span>{t('Station Process Mimic — Al Dhaher Manifolds')}</span> <span className="hint">{t('live P&ID overview · inlet header → 6 manifolds × 7 bays')}</span></div>
        <div id="mimic-diagram"><MimicDiagram /></div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-title"><span>{t('Live Bay Status — Al Dhaher LFS')}</span> <span className="hint">{t('click a bay to open its control view')}</span></div>
          <BayGrid />
          <div className="legend">
            <span><span className="bay-dot" style={{ background: 'var(--text-faint)' }} /> <span>{t('Idle')}</span></span>
            <span><span className="bay-dot" style={{ background: 'var(--accent)' }} /> <span>{t('Filling')}</span></span>
            <span><span className="bay-dot" style={{ background: 'var(--green)' }} /> <span>{t('Done')}</span></span>
            <span><span className="bay-dot" style={{ background: 'var(--red)' }} /> <span>{t('Fault')}</span></span>
          </div>
        </div>
        <Gauge />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">{t('Hourly Dispensed Volume & Revenue')}</div>
          <div className="chart-box" style={{ height: 260 }}>
            <Chart type="bar" data={hourlyData} options={hourlyOptions} />
          </div>
        </div>
        <div className="card">
          <div className="card-title">{t('Active Alarms')}</div>
          <AlarmList />
        </div>
      </div>
    </>
  );
}
