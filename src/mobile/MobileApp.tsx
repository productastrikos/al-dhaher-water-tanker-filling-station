/* MEW Pay driver app — port of legacy/mobile.html + mobile.js. Route: /mobile.
   Self-contained (own store, own EN/AR dictionary, mocked data — no backend). The DOM structure / class names / ids are
   the legacy ones so ../styles/mobile.css (copied verbatim) renders it pixel-identically. All screens stay mounted and
   are toggled with `.mscreen.active`, exactly like legacy, so inputs/scroll keep their state. */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { icons } from 'lucide-react';
import '../styles/mobile.css';
import { useTheme } from '../lib/theme';
import {
  CARD_STEPS, DRIVERS, PO_RATE_PER_IG, PO_STATUS_TAG, STATIONS_WITH_DISTANCE, TRUCKS,
  fmtInt, fmtKD, qrCells, type Activity,
} from './data';
import { AR, EN, type MKey } from './i18n';
import { tabFor, useMobile, type Screen } from './store';

/* lucide-react icon by kebab name. Legacy swapped <i data-lucide> for a 24px svg (its `i`-scoped CSS sizes never
   applied), so the default here is 24 to stay pixel-identical. */
const ALIAS: Record<string, string> = {
  'alert-triangle': 'triangle-alert', 'check-circle-2': 'circle-check', 'plus-circle': 'circle-plus',
  'user-circle': 'circle-user', 'more-horizontal': 'ellipsis',
};
const pascal = (k: string) => k.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
function Ic({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const C = (icons as Record<string, any>)[pascal(ALIAS[name] ?? name)];
  return C ? <C size={size} strokeWidth={2} className={className} aria-hidden="true" /> : null;
}

function useMT() {
  const lang = useMobile((s) => s.lang);
  return (key: MKey): string => (lang === 'ar' && AR[key]) || EN[key];
}

const RING_CIRC = 2 * Math.PI * 52;

/* ---------- small presentational pieces ---------- */
function ActivityRow({ a }: { a: Activity }) {
  return (
    <div className="m-activity-row">
      <div>
        <div className="m-activity-label">{a.label}</div>
        <div className="m-activity-time">{a.time}</div>
      </div>
      <div className={`m-activity-amt ${a.delta >= 0 ? 'pos' : 'neg'}`}>{a.delta >= 0 ? '+' : ''}{fmtKD(a.delta)}</div>
    </div>
  );
}

function QrBlock({ id, seed }: { id: string; seed: number }) {
  const cells = useMemo(() => qrCells(seed), [seed]);
  return (
    <div className="qr-block" id={id}>
      {cells.map((on, i) => <div key={i} className={`qr-cell ${on ? 'on' : ''}`} />)}
    </div>
  );
}

function Screen_({ id, active, children }: { id: Screen; active: boolean; children: ReactNode }) {
  return <section className={`mscreen${active ? ' active' : ''}`} id={`mscreen-${id}`}>{children}</section>;
}

export default function MobileApp() {
  const t = useMT();
  const lang = useMobile((s) => s.lang);
  const screen = useMobile((s) => s.screen);
  const goto = useMobile((s) => s.goto);
  const { theme, toggle: toggleTheme } = useTheme();
  const screensRef = useRef<HTMLElement>(null);

  // body.mobile-body is what the (verbatim) mobile.css hooks onto; page title as legacy.
  useLayoutEffect(() => {
    document.body.classList.add('mobile-body');
    const prevTitle = document.title;
    document.title = 'MEW Pay — Water Wallet';
    return () => { document.body.classList.remove('mobile-body'); document.title = prevTitle; };
  }, []);
  useEffect(() => () => useMobile.getState().disposeTimers(), []);
  useEffect(() => { if (screensRef.current) screensRef.current.scrollTop = 0; }, [screen]);

  const frameProps = { dir: lang === 'ar' ? 'rtl' : 'ltr', className: `phone-frame${lang === 'ar' ? ' lang-ar' : ''}` };

  return (
    <div {...frameProps} id="phone-frame">
      <div className="phone-status-bar">
        <span>9:41</span>
        <span className="phone-status-icons"><Ic name="signal" /><Ic name="wifi" /><Ic name="battery-full" /></span>
      </div>

      <Header theme={theme} toggleTheme={toggleTheme} />
      <NotificationPanel />

      <main className="mobile-screens" ref={screensRef}>
        <WalletScreen active={screen === 'wallet'} />
        <TopUpScreen active={screen === 'topup'} />
        <QrScreen active={screen === 'qr'} />
        <FillingScreen active={screen === 'filling'} />
        <OrdersScreen active={screen === 'orders'} />
        <FleetScreen active={screen === 'fleet'} />
        <ReceiptScreen active={screen === 'receipt'} />
        <StationsScreen active={screen === 'stations'} />
        <HistoryScreen active={screen === 'history'} />
        <AccountScreen active={screen === 'account'} />
        <MoreScreen active={screen === 'more'} />
      </main>

      <nav className="mobile-tabbar">
        {([
          ['wallet', 'wallet', 'wallet'], ['qr', 'qr-code', 'pay'], ['orders', 'file-text', 'orders'],
          ['fleet', 'truck', 'fleet'], ['more', 'more-horizontal', 'more'],
        ] as [Screen, string, MKey][]).map(([s, icon, key]) => (
          <button key={s} className={`mtab${tabFor(screen) === s ? ' active' : ''}`} data-screen={s} onClick={() => goto(s)}>
            <Ic name={icon} /><span>{t(key)}</span>
          </button>
        ))}
      </nav>

      <Toast />
    </div>
  );
}

/* ---------- header + notifications + toast ---------- */
function Header({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  const lang = useMobile((s) => s.lang);
  const setLang = useMobile((s) => s.setLang);
  const setNotifOpen = useMobile((s) => s.setNotifOpen);
  const notifOpen = useMobile((s) => s.notifOpen);
  return (
    <header className="mobile-header">
      <div className="mobile-header-brand"><div className="brand-mark" style={{ width: 28, height: 28, fontSize: 13 }}>S!</div> MEW Pay</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="mobile-lang-btn" id="lang-toggle" aria-label="Switch language" title="EN / AR" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
          <span id="lang-toggle-label">{lang === 'ar' ? 'EN' : 'AR'}</span>
        </button>
        <button className="mobile-icon-btn theme-toggle" aria-label="Toggle light or dark mode" aria-pressed={theme === 'light'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} onClick={toggleTheme}>
          <Ic name={theme === 'light' ? 'moon' : 'sun'} />
        </button>
        <button className="mobile-icon-btn" aria-label="Notifications" aria-expanded={notifOpen} onClick={() => setNotifOpen(!notifOpen)}>
          <Ic name="bell" />
        </button>
      </div>
    </header>
  );
}

function NotificationPanel() {
  const t = useMT();
  const open = useMobile((s) => s.notifOpen);
  const setOpen = useMobile((s) => s.setNotifOpen);
  const list = useMobile((s) => s.notifications);
  const dismiss = useMobile((s) => s.dismissNotification);
  return (
    <>
      <div className="notif-backdrop" id="notif-backdrop" hidden={!open} onClick={() => setOpen(false)} />
      <div className="notif-panel" id="notif-panel" hidden={!open}>
        <div className="notif-panel-header">
          <div>{t('notifications')}</div>
          <button className="notif-close" id="notif-close" aria-label="Close notifications" title="Close" onClick={() => setOpen(false)}><Ic name="x" /></button>
        </div>
        <div id="notif-list">
          {list.length === 0 && <div className="util-text" style={{ padding: 14 }}>{t('noNotifications')}</div>}
          {list.map((n, i) => (
            <div className="notif-row" key={n.title} data-idx={i}>
              <Ic name={n.icon} />
              <div className="notif-text">
                <div className="notif-title">{n.title}</div>
                <div className="notif-body">{n.body}</div>
                <div className="notif-time">{n.time}</div>
              </div>
              <button className="notif-dismiss" aria-label="Dismiss" onClick={() => dismiss(i)}><Ic name="x" /></button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Toast() {
  const toast = useMobile((s) => s.toast);
  return <div className={`m-toast${toast.show ? ' show' : ''}`} id="m-toast" role="status" aria-live="polite">{toast.msg}</div>;
}

/* ---------- screens ---------- */
function Back({ to, label }: { to: Screen; label: MKey }) {
  const t = useMT();
  const goto = useMobile((s) => s.goto);
  return <button className="mback" data-back={to} onClick={() => goto(to)}><Ic name="chevron-left" /> <span>{t(label)}</span></button>;
}

function WalletScreen({ active }: { active: boolean }) {
  const t = useMT();
  const goto = useMobile((s) => s.goto);
  const balance = useMobile((s) => s.balance);
  const activity = useMobile((s) => s.activity);
  const hidden = useMobile((s) => s.pushBannerHidden);
  const hide = useMobile((s) => s.hidePushBanner);
  return (
    <Screen_ id="wallet" active={active}>
      <div className="push-banner" id="push-banner" hidden={hidden}>
        <Ic name="navigation" />
        <div className="push-banner-text">{t('pushBanner')}</div>
        <button className="push-banner-close" id="push-banner-close" aria-label="Dismiss" onClick={hide}><Ic name="x" /></button>
      </div>
      <div className="wallet-hero">
        <div className="wallet-hero-label">{t('walletBalanceLabel')}</div>
        <div className="wallet-hero-balance" id="m-balance">{fmtKD(balance)}</div>
        <div className="wallet-hero-sub" id="m-wallet-owner">Al-Salem Transport &middot; Acct KWT-40216</div>
      </div>
      <div className="mobile-quick-actions">
        <button className="qa-btn" data-goto="topup" onClick={() => goto('topup')}><Ic name="plus-circle" /><span>{t('topup')}</span></button>
        <button className="qa-btn" data-goto="qr" onClick={() => goto('qr')}><Ic name="qr-code" /><span>{t('qrPay')}</span></button>
        <button className="qa-btn" data-goto="orders" onClick={() => goto('orders')}><Ic name="file-text" /><span>{t('orders')}</span></button>
        <button className="qa-btn" data-goto="fleet" onClick={() => goto('fleet')}><Ic name="truck" /><span>{t('fleet')}</span></button>
      </div>
      <div className="mobile-section-title">{t('recentActivity')}</div>
      <div id="m-activity">{activity.slice(0, 4).map((a, i) => <ActivityRow key={`${a.label}-${a.time}-${i}`} a={a} />)}</div>
    </Screen_>
  );
}

function TopUpScreen({ active }: { active: boolean }) {
  const t = useMT();
  const topUp = useMobile((s) => s.topUp);
  const showToast = useMobile((s) => s.showToast);
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const pay = () => {
    const amt = parseFloat(value);
    if (!amt || amt <= 0) { showToast(t('toastEnterAmount')); return; }
    topUp(amt);
    setValue('');
    setSelected(null);
  };
  return (
    <Screen_ id="topup" active={active}>
      <Back to="wallet" label="wallet" />
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('topupTitle')}</div>
      <div className="topup-amounts" id="topup-amounts">
        {[10, 25, 50, 100].map((a) => (
          <button key={a} className={`amt-chip${selected === a ? ' selected' : ''}`} data-amt={a}
            onClick={() => { setSelected(a); setValue(String(a)); }}>KD {a}</button>
        ))}
      </div>
      <div className="topup-custom"><span>KD</span>
        <input type="number" id="topup-custom-input" placeholder="Custom amount" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button className="btn btn-primary" id="topup-pay-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={pay}>
        <Ic name="credit-card" /> <span>{t('payWithKnet')}</span>
      </button>
      <div className="util-text" style={{ marginTop: 10 }}>{t('demoOnlyPayment')}</div>
    </Screen_>
  );
}

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

function QrScreen({ active }: { active: boolean }) {
  const t = useMT();
  const lang = useMobile((s) => s.lang);
  const step = useMobile((s) => s.qrStep);
  const digits = useMobile((s) => s.pinDigits);
  const err = useMobile((s) => s.pinError);
  const startPin = useMobile((s) => s.startPin);
  const pinKey = useMobile((s) => s.pinKey);
  const errText = !err ? '' : err.kind === 'locked'
    ? t('pinLocked')
    : `${t('pinWrong')} ${err.remaining} ${err.remaining === 1 ? t('attemptLeft') : t('attemptsLeft')}.`;
  // English hint bolds "0000"; the Arabic string was unbolded in legacy.
  const hint = t('pinDemoHint');
  const hintParts = lang === 'en' ? hint.split('0000') : [hint];
  return (
    <Screen_ id="qr" active={active}>
      <Back to="wallet" label="wallet" />

      <div id="qr-step-scan" hidden={step !== 'scan'}>
        <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('showAtBay')}</div>
        <div className="qr-card">
          <QrBlock id="qr-block" seed={40216} />
          <div className="qr-account">KWT-40216</div>
          <div className="qr-owner">Al-Salem Transport Co.</div>
        </div>
        <div className="util-text" style={{ marginTop: 12 }}>{t('qrScanHint')}</div>
        <button className="btn btn-primary" id="qr-continue-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={startPin}>
          <Ic name="lock" /> <span>{t('enterPinToAuthorize')}</span>
        </button>
      </div>

      <div id="qr-step-pin" hidden={step !== 'pin'}>
        <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('enterPin')}</div>
        <div className="util-text">{t('pinSub')}</div>
        <div className="pin-dots" id="pin-dots">
          {[0, 1, 2, 3].map((i) => <span key={i} className={`pin-dot${i < digits.length ? ' filled' : ''}`} />)}
        </div>
        <div className="pin-error" id="pin-error" hidden={!err}><Ic name="alert-triangle" /> <span id="pin-error-text">{errText}</span></div>
        <div className="pin-pad" id="pin-pad">
          {PIN_KEYS.map((k) => (
            <button key={k} data-key={k} className={k === 'clear' || k === 'back' ? 'pin-key-ghost' : undefined}
              aria-label={k === 'back' ? 'Backspace' : undefined} onClick={() => pinKey(k)}>
              {k === 'clear' ? t('pinClear') : k === 'back' ? <Ic name="delete" /> : k}
            </button>
          ))}
        </div>
        <div className="util-text" style={{ marginTop: 12, textAlign: 'center' }}>
          {hintParts.map((p, i) => <Fragment key={i}>{i > 0 && <b>0000</b>}{p}</Fragment>)}
        </div>
      </div>
    </Screen_>
  );
}

function FillingScreen({ active }: { active: boolean }) {
  const t = useMT();
  const fill = useMobile((s) => s.fill);
  const cancel = useMobile((s) => s.cancelFilling);
  const pct = fill.dispensed / fill.target;
  const fine = pct > 0.85;
  return (
    <Screen_ id="filling" active={active}>
      <button className="mback" id="filling-cancel-btn" onClick={cancel}><Ic name="chevron-left" /> <span>{t('pay')}</span></button>
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('fillingTitle')}</div>
      <div className="filling-card">
        <div className="filling-ring-wrap">
          <svg viewBox="0 0 120 120" className="filling-ring">
            <circle cx="60" cy="60" r="52" className="filling-ring-track" />
            <circle cx="60" cy="60" r="52" className="filling-ring-fill" id="filling-ring-fill"
              style={{ strokeDasharray: RING_CIRC, strokeDashoffset: RING_CIRC * (1 - pct) }} />
          </svg>
          <div className="filling-ring-center">
            <div className="filling-pct" id="filling-pct">{Math.round(pct * 100)}%</div>
            <div className="filling-pct-label">{t('dispensed')}</div>
          </div>
        </div>
        <div className="filling-figures">
          <div className="filling-figure"><span id="filling-volume">{fmtInt(Math.round(fill.dispensed))}</span> / <span id="filling-target">{fmtInt(fill.target)}</span> IG</div>
          <div className="filling-bay" id="filling-bay-label">{t('bay')} {fill.bay} &middot; Al Dhaher LFS</div>
        </div>
      </div>
      <div className="metric-line"><span className="k">{t('flowRate')}</span><span className="v" id="filling-flow">{fine ? '9.4' : '41.8'} m&sup3;/h</span></div>
      <div className="metric-line"><span className="k">{t('valveState')}</span><span className="v" id="filling-valve">{fine ? t('valveFineFill') : t('valveOpen')}</span></div>
      <div className="metric-line"><span className="k">{t('fillMode')}</span><span className="v">{t('fillModeVal')}</span></div>
      <div className="sia-guidance">
        <Ic name="sparkle" />
        <span>{t('siaFillingGuidance')}</span>
      </div>
    </Screen_>
  );
}

function OrdersScreen({ active }: { active: boolean }) {
  const t = useMT();
  const pos = useMobile((s) => s.purchaseOrders);
  const raisePo = useMobile((s) => s.raisePo);
  const showToast = useMobile((s) => s.showToast);
  const [qtyText, setQtyText] = useState('');
  const qty = parseFloat(qtyText) || 0;
  const submit = () => {
    const q = parseFloat(qtyText);
    if (!q || q <= 0) { showToast(t('toastEnterQty')); return; }
    raisePo(q);
    setQtyText('');
  };
  return (
    <Screen_ id="orders" active={active}>
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('purchaseOrders')}</div>
      <div id="m-po-list">
        {pos.map((po) => (
          <div className="po-row" key={po.id}>
            <div>
              <div className="po-id">{po.id}</div>
              <div className="po-sub">{fmtInt(po.qty)} IG &middot; KD {po.kd.toFixed(3)}</div>
            </div>
            <span className={`tag ${PO_STATUS_TAG[po.status] || 'gray'}`}>{po.status}</span>
          </div>
        ))}
      </div>
      <div className="mobile-section-title">{t('raisePo')}</div>
      <div className="po-form">
        <div className="topup-custom"><span>IG</span>
          <input type="number" id="po-qty-input" placeholder="Quantity (Imp. gal)" inputMode="numeric" value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
        </div>
        <div className="po-kd-row"><span>{t('autoKdRate')}</span> &middot; <b id="po-kd-preview">KD {(qty * PO_RATE_PER_IG).toFixed(3)}</b></div>
        <button className="btn btn-primary" id="po-submit-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={submit}>
          <Ic name="send" /> <span>{t('submit')}</span>
        </button>
      </div>
    </Screen_>
  );
}

function FleetScreen({ active }: { active: boolean }) {
  const t = useMT();
  const card = useMobile((s) => s.cardTimeline);
  const request = useMobile((s) => s.requestAccessCard);
  return (
    <Screen_ id="fleet" active={active}>
      <Back to="wallet" label="wallet" />
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('myTrucks')}</div>
      <div id="m-truck-list">
        {TRUCKS.map((tr) => (
          <div className="fleet-row" key={tr.plate}>
            <div>
              <div className="fleet-title mono">{tr.plate}</div>
              <div className="fleet-sub">{fmtInt(tr.capacity)} IG capacity</div>
            </div>
            <span className={`tag ${tr.calibStatus}`}>Calib {tr.calibExpiry}</span>
          </div>
        ))}
      </div>
      <div className="mobile-section-title">{t('driversTitle')}</div>
      <div id="m-driver-list">
        {DRIVERS.map((d) => (
          <div className="fleet-row" key={d.name}>
            <div>
              <div className="fleet-title">{d.name}</div>
              <div className="fleet-sub">{d.licence} &middot; {d.truck}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" id="request-card-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={request}>
        <Ic name="badge-check" /> <span>{t('requestAccessCard')}</span>
      </button>
      <div className="timeline-card" id="card-timeline" hidden={!card}>
        {card && (
          <>
            <div className="timeline-title">Access card {card.cardId}</div>
            {CARD_STEPS.map((label, i) => (
              <div key={label} className={`timeline-step ${i <= card.step ? 'active' : ''}`}>
                <Ic name={i < card.step ? 'check-circle-2' : i === card.step ? 'circle-dot' : 'circle'} /> {label}
              </div>
            ))}
          </>
        )}
      </div>
    </Screen_>
  );
}

function ReceiptScreen({ active }: { active: boolean }) {
  const t = useMT();
  const r = useMobile((s) => s.receipt);
  const showToast = useMobile((s) => s.showToast);
  return (
    <Screen_ id="receipt" active={active}>
      <Back to="more" label="more" />
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('lastReceipt')}</div>
      <div className="receipt-card">
        <div className="receipt-row"><span>{t('bay')}</span><b id="receipt-bay">{r.bay}</b></div>
        <div className="receipt-row"><span>{t('volume')}</span><b id="receipt-volume">{r.volume}</b></div>
        <div className="receipt-row"><span>{t('amount')}</span><b id="receipt-amount">{fmtKD(r.amount)}</b></div>
        <div className="receipt-row"><span>{t('meter')}</span><b className="mono">FT-14 &middot; SN 88213-A</b></div>
        <div className="receipt-row"><span>{t('knetRef')}</span><b className="mono">KNT-774213</b></div>
        <div className="receipt-row"><span>{t('timestamp')}</span><b id="receipt-time">{r.time}</b></div>
      </div>
      <div className="qr-card" style={{ marginTop: 14 }}>
        <QrBlock id="receipt-qr-block" seed={88213} />
        <div className="qr-account">Receipt #RCT-88213</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <span className="tag green">{t('sentSms')}</span>
        <span className="tag green">{t('sentEmail')}</span>
      </div>
      <button className="btn btn-primary" id="receipt-share-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => showToast(t('toastShared'))}>
        <Ic name="share-2" /> <span>{t('share')}</span>
      </button>
    </Screen_>
  );
}

function StationsScreen({ active }: { active: boolean }) {
  const t = useMT();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = STATIONS_WITH_DISTANCE.filter((s) => !term || s.name.toLowerCase().includes(term) || s.governorate.toLowerCase().includes(term));
  return (
    <Screen_ id="stations" active={active}>
      <Back to="more" label="more" />
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('stationsTitle')}</div>
      <div className="util-text" style={{ marginBottom: 10 }}>{t('stationsSub')}</div>
      <div className="station-search">
        <Ic name="search" />
        <input type="text" id="station-search-input" placeholder={t('stationSearchPh')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div id="m-station-list">
        {list.length === 0 && <div className="util-text">{t('noStationsMatch')}</div>}
        {list.map((s) => (
          <div key={s.name} className={`station-card${s.flagship ? ' station-card-home' : ''}`}>
            <Ic name={s.flagship ? 'star' : 'map-pin'} />
            <div>
              <div className="station-name">{s.name}{s.flagship ? <> &middot; {t('homeStation')}</> : null}</div>
              <div className="station-sub">{s.governorate} &middot; {s.flagship ? '42' : '2'} {t('bays')} &middot; {s.km.toFixed(1)} km</div>
            </div>
            <span className={`tag ${s.status === 'open' ? 'green' : 'gray'}`}>{s.status === 'open' ? t('statusOpen') : t('statusSoon')}</span>
          </div>
        ))}
      </div>
    </Screen_>
  );
}

function HistoryScreen({ active }: { active: boolean }) {
  const t = useMT();
  const activity = useMobile((s) => s.activity);
  return (
    <Screen_ id="history" active={active}>
      <Back to="more" label="more" />
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('txnHistory')}</div>
      <div id="m-history-list">{activity.map((a, i) => <ActivityRow key={`${a.label}-${a.time}-${i}`} a={a} />)}</div>
    </Screen_>
  );
}

function AccountScreen({ active }: { active: boolean }) {
  const t = useMT();
  const lang = useMobile((s) => s.lang);
  const setLang = useMobile((s) => s.setLang);
  const goto = useMobile((s) => s.goto);
  return (
    <Screen_ id="account" active={active}>
      <Back to="more" label="more" />
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('accountTitle')}</div>
      <div className="account-card">
        <div className="account-avatar">AS</div>
        <div>
          <div className="account-name">Al-Salem Transport Co.</div>
          <div className="account-sub mono">KWT-40216</div>
        </div>
        <span className="tag green" style={{ marginLeft: 'auto' }}>{t('verified')}</span>
      </div>
      <div className="metric-line"><span className="k">{t('registeredSince')}</span><span className="v">14 Feb 2023</span></div>
      <div className="metric-line"><span className="k">{t('civilId')}</span><span className="v mono">28xxxxxxxxxx</span></div>
      <div className="metric-line"><span className="k">{t('crNumber')}</span><span className="v mono">CR-119042</span></div>
      <div className="metric-line"><span className="k">{t('kycStatus')}</span><span className="v">{t('kycComplete')}</span></div>

      <div className="mobile-section-title">{t('languageTitle')}</div>
      <div className="lang-row">
        <button className={`lang-opt${lang === 'en' ? ' active' : ''}`} data-lang="en" onClick={() => setLang('en')}>English</button>
        <button className={`lang-opt${lang === 'ar' ? ' active' : ''}`} data-lang="ar" onClick={() => setLang('ar')}>العربية</button>
      </div>

      <div className="mobile-section-title">{t('registerNewTitle')}</div>
      <button className="more-row" id="register-truck-btn" onClick={() => goto('fleet')}>
        <Ic name="user-plus" /><span>{t('registerNewTanker')}</span><Ic name="chevron-right" className="chev" />
      </button>
    </Screen_>
  );
}

function MoreScreen({ active }: { active: boolean }) {
  const t = useMT();
  const goto = useMobile((s) => s.goto);
  const rows: [Screen, string, MKey][] = [
    ['account', 'user-circle', 'accountTitle'], ['stations', 'map-pin', 'stations'], ['history', 'history', 'txnHistory'],
    ['receipt', 'receipt', 'lastReceipt'], ['topup', 'plus-circle', 'topupWallet'],
  ];
  return (
    <Screen_ id="more" active={active}>
      <div className="mobile-section-title" style={{ marginTop: 0 }}>{t('more')}</div>
      {rows.map(([s, icon, key]) => (
        <button key={s} className="more-row" data-goto={s} onClick={() => goto(s)}>
          <Ic name={icon} /><span>{t(key)}</span><Ic name="chevron-right" className="chev" />
        </button>
      ))}
    </Screen_>
  );
}
