/* Canned S!a answers about ERP data (ported from legacy erpWireSiaAndTick) — computed at ask time from the live ERP + ledger state. */
import { useErp } from './store';
import { useSiap } from '../sim/store';

export function erpSiaAnswer(question: string): string | null {
  const q = question.trim().toLowerCase();
  const erp = useErp.getState();

  if (q === 'how many pos are awaiting approval?') {
    const n = erp.purchaseOrders.filter((p) => p.status === 'Submitted' || p.status === 'Approved').length;
    return `${n} purchase order${n === 1 ? ' is' : 's are'} awaiting approval (Submitted or Approved, not yet invoiced).\n\nOpen Enterprise & ERP → Purchase Orders to review and approve, or run the Order-to-Cash Tracker to see one move through the full approve → invoice → pay lifecycle live.\n\nConfidence: 96% · source: ERP.purchaseOrders (S!aP ERP module).`;
  }

  if (q === 'which trucks have calibration expiring this month?') {
    const in30 = Date.now() + 30 * 86400000;
    const expiring = erp.trucks.filter((t) => t.calibExpiry <= in30);
    return expiring.length
      ? `${expiring.length} truck${expiring.length === 1 ? '' : 's'} have a custody-meter calibration certificate expiring within 30 days: ${expiring.slice(0, 5).map((t) => `${t.plate} (${t.id})`).join(', ')}${expiring.length > 5 ? '…' : ''}.\n\nRecommend scheduling recalibration via a Work Order before the expiry date — see Enterprise & ERP → Fleet & Drivers for badges, or → Tariffs · Work Orders · Audit to raise a CMMS ticket.\n\nConfidence: 93% · source: ERP.trucks calibration expiry.`
      : 'No trucks currently have a calibration certificate expiring within 30 days.\n\nConfidence: 90% · source: ERP.trucks calibration expiry.';
  }

  if (q === 'show me the receipt for the last fill at bay 14') {
    const last = useSiap.getState().ledger.find((r) => r.type === 'Fill (debit)' && r.channel === 'Bay 14');
    return last
      ? `Last fill at Bay 14 — ${last.volume} IG dispensed, ${last.amount} debited, account ${last.account}, status ${last.status}.\n\nOpen Enterprise & ERP → Order-to-Cash Tracker and press Run to generate a fresh SMS + e-mail receipt for a live fill, including meter serial and K-net reference.\n\nConfidence: 95% · source: state.ledger.`
      : 'No fill has completed at Bay 14 yet in this session. Open Enterprise & ERP → Order-to-Cash Tracker and press Run — the receipt (SMS + e-mail, with meter serial and K-net reference) appears automatically once the fill and exact-volume debit complete.\n\nConfidence: 92%.';
  }
  return null;
}
