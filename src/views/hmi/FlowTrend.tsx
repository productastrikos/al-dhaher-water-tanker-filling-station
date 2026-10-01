import { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, type ChartData, type ChartOptions } from 'chart.js';
import { useHmi, TREND_POINTS } from './hmiStore';
import { useT } from '../../i18n';

ChartJS.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler);

const EMPTY = new Array(TREND_POINTS).fill(0) as number[];

const OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  scales: {
    x: { display: false },
    y: { display: false, min: 0, suggestedMax: 60 },
  },
  elements: { line: { capBezierPoints: true } },
};

/** Rolling flow trend (last ~2 min) for one bay. Subscribes only to that bay's flow history. */
export function FlowTrend({ bayId, active }: { bayId: number; active: boolean }) {
  const { t } = useT();
  const h = useHmi((s) => s.flowHistory[bayId]) ?? EMPTY;
  const chartRef = useRef<ChartJS<'line'> | null>(null);

  // Chart.js sizes itself from its container; the view is display:none while inactive, so re-measure on show.
  useEffect(() => { if (active) chartRef.current?.resize(); }, [active]);

  const data: ChartData<'line'> = {
    labels: h.map((_, i) => i),
    datasets: [
      {
        label: 'Flow',
        data: h,
        borderColor: '#22d3ee',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: true,
        backgroundColor: (c) => {
          const { chart } = c;
          if (!chart.chartArea) return 'rgba(34,211,238,0.18)';
          const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
          g.addColorStop(0, 'rgba(34,211,238,0.35)');
          g.addColorStop(1, 'rgba(34,211,238,0.0)');
          return g;
        },
      },
      {
        label: 'Preset flow',
        data: h.map(() => 45),
        borderColor: 'rgba(148,178,216,0.55)',
        borderWidth: 1.4,
        borderDash: [5, 4],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  return (
    <div className="hmi-trend-wrap">
      <Line ref={chartRef} data={data} options={OPTIONS} />
      <div className="hmi-trend-idle" id="hmi-trend-idle" hidden={h.some((v) => v > 0.05)}>{t('No flow — bay idle')}</div>
    </div>
  );
}
