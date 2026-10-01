/* MEW Pay driver app — self-contained EN/AR dictionary (ported from legacy/mobile.js AR_STRINGS plus the
   English text that lived in mobile.html as data-i18n content). Deliberately NOT the desktop dictionary.
   Numbers / plates / account ids / PO ids stay untranslated, same as legacy. */

export type Lang = 'en' | 'ar';

export const EN = {
  wallet: 'Wallet', pay: 'Pay', orders: 'Orders', fleet: 'Fleet', more: 'More',
  pushBanner: 'Proceed to Bay 14 — hatch guidance active · ETA 2 min',
  walletBalanceLabel: 'Water Wallet Balance', topup: 'Top-up', qrPay: 'QR Pay',
  recentActivity: 'Recent Activity', topupTitle: 'Top-up Water Wallet', payWithKnet: 'Pay with K-net',
  demoOnlyPayment: 'Demo only — no real payment is processed.',
  showAtBay: 'Show this at the bay',
  qrScanHint: 'Scan at any Al Dhaher bay kiosk to start a prepaid fill — no cash needed. Balance debits automatically on completion.',
  enterPinToAuthorize: 'Enter PIN to authorize', enterPin: 'Enter your PIN',
  pinSub: 'Bay 14 · Al Dhaher LFS · matches the same PIN used at the kiosk keypad.',
  pinClear: 'Clear',
  // the component bolds the "0000" token in English (legacy EN markup had <b>0000</b>; the AR string had no bold)
  pinDemoHint: 'Demo tip: any 4 digits authorize the fill — try 0000 to see the 3-attempt lockout & owner alert.',
  fillingTitle: 'Filling in Progress', dispensed: 'Dispensed', flowRate: 'Instantaneous flow',
  valveState: 'Control valve', valveOpen: 'Open · modulating', fillMode: 'Mode', fillModeVal: 'Auto · fine-fill top-up',
  siaFillingGuidance: 'S!a live guidance: Hatch alignment confirmed. Filling nominal — no surge on valve open. Receipt will auto-send by SMS & email on completion.',
  purchaseOrders: 'Purchase Orders', raisePo: 'Raise PO', autoKdRate: 'Auto KD @ 0.0025 KD/IG',
  submit: 'Submit', myTrucks: 'My Trucks', driversTitle: 'Drivers', requestAccessCard: 'Request access card',
  lastReceipt: 'Last Fill Receipt', bay: 'Bay', volume: 'Volume', amount: 'Amount', meter: 'Meter',
  knetRef: 'K-net ref', timestamp: 'Timestamp', sentSms: 'Sent by SMS', sentEmail: 'Sent by e-mail',
  share: 'Share', stationsTitle: 'MEW Water Filling Stations', stationsSub: '26 locations across Kuwait · 52 bays · sorted by distance',
  stationSearchPh: 'Search by area or governorate…', txnHistory: 'Transaction History',
  accountTitle: 'Account', verified: 'Verified', registeredSince: 'Registered since', civilId: 'Civil ID',
  crNumber: 'CR No.', kycStatus: 'KYC documents', kycComplete: '3/3 verified',
  languageTitle: 'Language', registerNewTitle: 'Registration', registerNewTanker: 'Register a new tanker & driver',
  topupWallet: 'Top-up Wallet', stations: 'Stations', homeStation: 'Home station', bays: 'bays',
  statusOpen: 'Open', statusSoon: 'Coming online', noStationsMatch: 'No stations match your search.',
  noNotifications: 'No notifications.', notifications: 'Notifications',
  toastEnterQty: 'Enter a quantity to raise a PO', toastRaisedDraft: 'raised as Draft',
  toastCardRequested: 'Access card requested', toastCardPrinted: 'Access card printed', toastCardActivated: 'Access card activated',
  pinWrong: 'Wrong PIN.', attemptLeft: 'attempt left', attemptsLeft: 'attempts left',
  pinLocked: 'Account locked after 3 wrong attempts. Owner alerted by SMS.',
  toastAccountLocked: 'Account locked — owner alerted (demo)',
  toastFillComplete: 'Fill complete — receipt sent by SMS & e-mail',
  valveFineFill: 'Fine-fill top-up',
  toastEnterAmount: 'Enter an amount to top up', toastToppedUp: 'Topped up', toastShared: 'Receipt shared',
} as const;

export type MKey = keyof typeof EN;

export const AR: Partial<Record<MKey, string>> = {
  wallet: 'المحفظة', pay: 'الدفع', orders: 'الطلبات', fleet: 'الأسطول', more: 'المزيد',
  pushBanner: 'التوجه إلى الحوض 14 — إرشادات فتحة التعبئة نشطة · الوصول خلال دقيقتين',
  walletBalanceLabel: 'رصيد محفظة المياه', topup: 'شحن الرصيد', qrPay: 'الدفع بالرمز',
  recentActivity: 'النشاط الأخير', topupTitle: 'شحن محفظة المياه', payWithKnet: 'الدفع عبر K-net',
  demoOnlyPayment: 'للعرض فقط — لا تتم أي عملية دفع حقيقية.',
  showAtBay: 'اعرض هذا عند الحوض',
  qrScanHint: 'امسح عند أي كشك حوض في الظاهر لبدء تعبئة مدفوعة مسبقًا — بدون نقود. يُخصم الرصيد تلقائيًا عند الانتهاء.',
  enterPinToAuthorize: 'أدخل الرقم السري للتفويض', enterPin: 'أدخل الرقم السري',
  pinSub: 'الحوض 14 · محطة الظاهر · نفس الرقم السري المستخدم عند الكشك.',
  pinClear: 'مسح', pinDemoHint: 'نصيحة للعرض: أي 4 أرقام تفوض التعبئة — جرّب 0000 لرؤية إيقاف الحساب بعد 3 محاولات.',
  fillingTitle: 'جارٍ التعبئة', dispensed: 'الكمية المصروفة', flowRate: 'معدل التدفق',
  valveState: 'الصمام', valveOpen: 'مفتوح · تعديل تلقائي', fillMode: 'الوضع', fillModeVal: 'تلقائي · تعبئة دقيقة',
  siaFillingGuidance: 'إرشاد S!a المباشر: تم تأكيد محاذاة الفتحة. التعبئة تسير بشكل طبيعي — سيُرسل الإيصال تلقائيًا عبر الرسائل والبريد عند الانتهاء.',
  purchaseOrders: 'أوامر الشراء', raisePo: 'إنشاء أمر شراء', autoKdRate: 'حساب تلقائي 0.0025 د.ك/غالون',
  submit: 'إرسال', myTrucks: 'شاحناتي', driversTitle: 'السائقون', requestAccessCard: 'طلب بطاقة دخول',
  lastReceipt: 'إيصال آخر تعبئة', bay: 'الحوض', volume: 'الكمية', amount: 'المبلغ', meter: 'العداد',
  knetRef: 'مرجع K-net', timestamp: 'الوقت', sentSms: 'أُرسل عبر الرسائل', sentEmail: 'أُرسل عبر البريد',
  share: 'مشاركة', stationsTitle: 'محطات تعبئة المياه', stationsSub: '26 موقعًا في الكويت · 52 حوضًا · مرتبة حسب المسافة',
  stationSearchPh: 'ابحث بالمنطقة أو المحافظة…', txnHistory: 'سجل المعاملات',
  accountTitle: 'الحساب', verified: 'موثّق', registeredSince: 'مسجل منذ', civilId: 'البطاقة المدنية',
  crNumber: 'رقم السجل التجاري', kycStatus: 'مستندات التحقق', kycComplete: '3/3 موثّقة',
  languageTitle: 'اللغة', registerNewTitle: 'التسجيل', registerNewTanker: 'تسجيل صهريج وسائق جديد',
  topupWallet: 'شحن المحفظة', homeStation: 'المحطة الرئيسية', bays: 'حوض',
  statusOpen: 'مفتوحة', statusSoon: 'قريبًا', noStationsMatch: 'لا توجد محطات مطابقة.',
  noNotifications: 'لا توجد إشعارات.', notifications: 'الإشعارات',
  toastEnterQty: 'أدخل كمية لإنشاء أمر شراء', toastRaisedDraft: 'تم إنشاؤه كمسودة',
  toastCardRequested: 'تم طلب بطاقة الدخول', toastCardPrinted: 'تمت طباعة بطاقة الدخول',
  toastCardActivated: 'تم تفعيل بطاقة الدخول', pinWrong: 'رقم سري خاطئ.',
  attemptLeft: 'محاولة متبقية', attemptsLeft: 'محاولات متبقية',
  pinLocked: 'تم قفل الحساب بعد 3 محاولات خاطئة. تم تنبيه المالك عبر الرسائل.',
  toastAccountLocked: 'تم قفل الحساب — تم تنبيه المالك (عرض توضيحي)',
  toastFillComplete: 'اكتملت التعبئة — أُرسل الإيصال عبر الرسائل والبريد',
  valveFineFill: 'تعبئة دقيقة',
  toastEnterAmount: 'أدخل مبلغًا للشحن', toastToppedUp: 'تم شحن',
  // not in the legacy dictionary (the "Stations" row on the More screen stayed English in AR) — added
  stations: 'المحطات',
};

/** Translate outside React (store toasts): same fallback rule as legacy t(). */
export function tr(lang: Lang, key: MKey): string {
  return (lang === 'ar' && AR[key]) || EN[key];
}
