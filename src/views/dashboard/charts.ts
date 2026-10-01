import { Chart as ChartJS, registerables } from 'chart.js';
import type { ChartArea, ChartOptions } from 'chart.js';

ChartJS.register(...registerables);

/** Ported from legacy/app.js verticalGradient / chartBaseOptions / gaugeColor — same colours, same options. */
export function verticalGradient(ctx: CanvasRenderingContext2D, chartArea: ChartArea, colorTop: string, colorBottom: string) {
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, colorTop);
  g.addColorStop(1, colorBottom);
  return g;
}

export function chartBaseOptions(
  dualAxis: boolean,
  fmt: { y?: (v: number | string) => string; y1?: (v: number | string) => string } = {},
): ChartOptions<'bar'> {
  const grid = { color: 'rgba(148,178,216,0.07)', drawTicks: false };
  const ticks = { color: '#8fa3c2', font: { size: 10.5 } };
  const scales: Record<string, any> = {
    x: { grid: { display: false }, border: { color: 'rgba(148,178,216,0.15)' }, ticks },
    y: {
      grid, border: { display: false }, ticks: { ...ticks, callback: fmt.y ? (v: number | string) => fmt.y!(v) : undefined },
      title: dualAxis ? { display: true, text: 'Volume', color: '#5f7292', font: { size: 9.5, weight: 600 } } : undefined,
    },
  };
  if (dualAxis) {
    scales.y1 = {
      position: 'right', grid: { display: false }, border: { display: false },
      ticks: { ...ticks, callback: fmt.y1 ? (v: number | string) => fmt.y1!(v) : undefined },
      title: { display: true, text: 'Revenue', color: '#5f7292', font: { size: 9.5, weight: 600 } },
    };
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 500, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: '#c3d3ec', boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle',
          font: { size: 10.5, weight: 600 }, padding: 14,
        },
      },
      tooltip: {
        backgroundColor: '#0d1a30', borderColor: 'rgba(148,178,216,0.25)', borderWidth: 1,
        padding: 10, titleColor: '#e7edf7', bodyColor: '#c3d3ec', boxPadding: 4,
        titleFont: { size: 11.5, weight: 700 }, bodyFont: { size: 11 }, cornerRadius: 8,
        displayColors: true, boxWidth: 8, boxHeight: 8, usePointStyle: true,
      },
    },
    scales,
  };
}

export const GAUGE_MAX = 1000;

export function gaugeColor(val: number) {
  if (val > 900) return '#fbbf24';
  if (val < 350) return '#f87171';
  return '#22d3ee';
}
