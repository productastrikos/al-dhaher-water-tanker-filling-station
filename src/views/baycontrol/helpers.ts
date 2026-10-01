import type { Bay } from '../../sim/data';

/** Deterministic per-account "pre-fill" wallet balance (ported from legacy accountBalanceSeed). KD 80.00 – 250.00 */
export function accountBalanceSeed(account: string): number {
  let h = 0;
  for (let i = 0; i < account.length; i++) h = (h * 31 + account.charCodeAt(i)) >>> 0;
  return 80 + (h % 17000) / 100;
}

/** Which of the 5 flow-track steps is active for a bay (ported from legacy bayFlowStepIndex). */
export function bayFlowStepIndex(bay: Bay): number {
  if (bay.status === 'idle') return 0;
  if (bay.status === 'fault' || bay.status === 'offline') return 1;
  if (bay.status === 'filling') return bay.dispensed < bay.target * 0.15 ? 2 : 3;
  if (bay.status === 'done') return 4;
  return 2;
}

/** Deterministic-ish live jitter so readings move every tick without being random noise. */
export function twinJitter(seed: number, amplitude: number): number {
  return Math.sin(Date.now() / 4000 + seed) * amplitude;
}
