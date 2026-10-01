/* MEW Pay driver app — own small zustand store (the app is self-contained; it does not use the desktop simulator,
   same as legacy/mobile.js). All timers live here, not in components. */
import { create } from 'zustand';
import {
  CARD_STEPS, INITIAL_ACTIVITY, INITIAL_BALANCE, INITIAL_NOTIFICATIONS, INITIAL_POS, PO_RATE_PER_IG, fmtInt,
  type Activity, type Notification, type PurchaseOrder,
} from './data';
import { tr, type Lang } from './i18n';

export type Screen = 'wallet' | 'topup' | 'qr' | 'filling' | 'orders' | 'fleet' | 'receipt' | 'stations' | 'history' | 'account' | 'more';
export const SCREENS: Screen[] = ['wallet', 'topup', 'qr', 'filling', 'orders', 'fleet', 'receipt', 'stations', 'history', 'account', 'more'];

const LANG_KEY = 'siap.lang';
const FILL_TARGET = 5000;
const FILL_BAY = 14;
const FILL_STEP_MS = 200;

export type PinError = { kind: 'wrong'; remaining: number } | { kind: 'locked' } | null;

interface Fill { active: boolean; dispensed: number; target: number; bay: number }
interface Receipt { bay: string; volume: string; amount: number; time: string }

interface MobileState {
  lang: Lang;
  screen: Screen;
  balance: number;
  activity: Activity[];
  purchaseOrders: PurchaseOrder[];
  notifications: Notification[];
  notifOpen: boolean;
  pushBannerHidden: boolean;
  qrStep: 'scan' | 'pin';
  pinDigits: string;
  pinAttempts: number;
  pinError: PinError;
  fill: Fill;
  receipt: Receipt;
  cardTimeline: { cardId: string; step: number } | null;
  toast: { msg: string; show: boolean };

  setLang(l: Lang): void;
  goto(s: Screen): void;
  showToast(msg: string): void;
  setNotifOpen(open: boolean): void;
  dismissNotification(i: number): void;
  hidePushBanner(): void;
  topUp(amt: number): void;
  raisePo(qty: number): void;
  requestAccessCard(): void;
  startPin(): void;
  pinKey(key: string): void;
  cancelFilling(): void;
  disposeTimers(): void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let fillTimer: ReturnType<typeof setInterval> | undefined;
let fillDoneTimer: ReturnType<typeof setTimeout> | undefined;
let pinTimer: ReturnType<typeof setTimeout> | undefined;
let lockTimer: ReturnType<typeof setTimeout> | undefined;
let cardTimer1: ReturnType<typeof setTimeout> | undefined;
let cardTimer2: ReturnType<typeof setTimeout> | undefined;

function readLang(): Lang {
  try { return localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
}

function initialScreen(): Screen {
  const q = new URLSearchParams(window.location.search).get('screen');
  return q && (SCREENS as string[]).includes(q) ? (q as Screen) : 'wallet';
}

export const useMobile = create<MobileState>((set, get) => {
  const t = (key: Parameters<typeof tr>[1]) => tr(get().lang, key);
  const resetPin = () => set({ pinDigits: '', pinAttempts: 0, pinError: null });

  function completeFilling() {
    const { fill } = get();
    const kd = fill.target * PO_RATE_PER_IG;
    const now = new Date();
    set((s) => ({
      balance: s.balance - kd,
      activity: [{ label: `Fill — Bay ${fill.bay}`, delta: -kd, time: 'just now' }, ...s.activity],
      receipt: {
        bay: String(fill.bay),
        volume: `${fmtInt(fill.target)} IG`,
        amount: kd,
        time: `Today ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      },
    }));
    get().showToast(t('toastFillComplete'));
    get().goto('receipt');
    resetPin();
    set({ qrStep: 'scan' });
  }

  function startFilling() {
    clearInterval(fillTimer);
    clearTimeout(fillDoneTimer);
    const ratePerSec = FILL_TARGET / 7; // ~7 s demo fill: fast enough to sit through, slow enough to read
    set({ fill: { active: true, dispensed: 0, target: FILL_TARGET, bay: FILL_BAY } });
    get().goto('filling');
    fillTimer = setInterval(() => {
      const f = get().fill;
      if (!f.active) return;
      const dispensed = Math.min(f.target, f.dispensed + ratePerSec * (FILL_STEP_MS / 1000));
      if (dispensed / f.target >= 1) {
        set({ fill: { ...f, dispensed, active: false } });
        clearInterval(fillTimer);
        fillDoneTimer = setTimeout(completeFilling, 500);
      } else {
        set({ fill: { ...f, dispensed } });
      }
    }, FILL_STEP_MS);
  }

  function submitPin() {
    const { pinDigits } = get();
    if (pinDigits === '0000') {
      const attempts = get().pinAttempts + 1;
      const remaining = 3 - attempts;
      if (remaining > 0) {
        set({ pinAttempts: attempts, pinError: { kind: 'wrong', remaining }, pinDigits: '' });
      } else {
        set({ pinAttempts: attempts, pinError: { kind: 'locked' } });
        get().showToast(t('toastAccountLocked'));
        lockTimer = setTimeout(() => { get().goto('wallet'); resetPin(); set({ qrStep: 'scan' }); }, 1800);
      }
      return;
    }
    set({ pinError: null });
    startFilling();
  }

  return {
    lang: readLang(),
    screen: initialScreen(),
    balance: INITIAL_BALANCE,
    activity: INITIAL_ACTIVITY,
    purchaseOrders: INITIAL_POS,
    notifications: INITIAL_NOTIFICATIONS,
    notifOpen: false,
    pushBannerHidden: false,
    qrStep: 'scan',
    pinDigits: '',
    pinAttempts: 0,
    pinError: null,
    fill: { active: false, dispensed: 0, target: FILL_TARGET, bay: FILL_BAY },
    receipt: { bay: '14', volume: '5,000 IG', amount: 12.5, time: 'Today 08:53' },
    cardTimeline: null,
    toast: { msg: '', show: false },

    setLang(lang) {
      try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
      set({ lang });
    },
    goto: (screen) => set({ screen }),
    showToast(msg) {
      set({ toast: { msg, show: true } });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set((s) => ({ toast: { ...s.toast, show: false } })), 2200);
    },
    setNotifOpen: (notifOpen) => set({ notifOpen }),
    dismissNotification: (i) => set((s) => ({ notifications: s.notifications.filter((_, j) => j !== i) })),
    hidePushBanner: () => set({ pushBannerHidden: true }),

    topUp(amt) {
      set((s) => ({
        balance: s.balance + amt,
        activity: [{ label: 'K-net Top-up', delta: amt, time: 'just now' }, ...s.activity],
      }));
      get().showToast(`${t('toastToppedUp')} KD ${amt.toFixed(3)}`);
      get().goto('wallet');
    },

    raisePo(qty) {
      const kd = qty * PO_RATE_PER_IG;
      const id = `PO-2026-0${190 + get().purchaseOrders.length}`;
      set((s) => ({ purchaseOrders: [{ id, qty, kd, status: 'Draft' }, ...s.purchaseOrders] }));
      get().showToast(`${id} ${t('toastRaisedDraft')}`);
    },

    requestAccessCard() {
      const cardId = `CARD-${10000 + Math.floor(Math.random() * 89999)}`;
      clearTimeout(cardTimer1);
      clearTimeout(cardTimer2);
      set({ cardTimeline: { cardId, step: 0 } });
      get().showToast(`${t('toastCardRequested')} ${cardId}`);
      cardTimer1 = setTimeout(() => {
        set({ cardTimeline: { cardId, step: 1 } });
        get().showToast(`${t('toastCardPrinted')} ${cardId}`);
      }, 1600);
      cardTimer2 = setTimeout(() => {
        set({ cardTimeline: { cardId, step: CARD_STEPS.length - 1 } });
        get().showToast(`${t('toastCardActivated')} ${cardId}`);
      }, 3400);
    },

    startPin() {
      resetPin();
      set({ qrStep: 'pin' });
    },

    pinKey(key) {
      if (key === 'clear') { set({ pinDigits: '', pinError: null }); return; }
      if (key === 'back') { set((s) => ({ pinDigits: s.pinDigits.slice(0, -1) })); return; }
      if (get().pinDigits.length >= 4) return;
      const pinDigits = get().pinDigits + key;
      set({ pinDigits });
      if (pinDigits.length === 4) {
        clearTimeout(pinTimer);
        pinTimer = setTimeout(submitPin, 180); // brief pause so the 4th dot is visible before it resolves
      }
    },

    cancelFilling() {
      clearInterval(fillTimer);
      clearTimeout(fillDoneTimer);
      set((s) => ({ fill: { ...s.fill, active: false } }));
      resetPin();
      set({ qrStep: 'scan' });
      get().goto('qr');
    },

    disposeTimers() {
      clearTimeout(toastTimer);
      clearInterval(fillTimer);
      clearTimeout(fillDoneTimer);
      clearTimeout(pinTimer);
      clearTimeout(lockTimer);
      clearTimeout(cardTimer1);
      clearTimeout(cardTimer2);
      set((s) => (s.fill.active ? { fill: { ...s.fill, active: false } } : {}));
    },
  };
});

/** Active bottom tab for a screen (same mapping as legacy goto()). */
export function tabFor(screen: Screen): Screen {
  if (['stations', 'history', 'receipt', 'account'].includes(screen)) return 'more';
  return screen === 'filling' ? 'qr' : screen;
}
