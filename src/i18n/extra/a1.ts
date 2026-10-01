// Extra Arabic strings for the dashboard + bay-control screens (WP A1). The legacy app left these dynamic bits in English;
// they fall back to English wherever no entry exists.
const extra: Record<string, string> = {
  'critical': 'حرج',
  'no critical': 'لا يوجد حرج',
  'all clear': 'لا إنذارات',
  'Ack': 'إقرار',
  'Acked': 'مُقَرّ',
  'Live Transaction': 'العملية المباشرة',
  'Tanker Detected (LPR)': 'اكتشاف الصهريج (LPR)',
  'Scan QR / Enter PIN': 'مسح QR / إدخال PIN',
  'Account Validated': 'التحقق من الحساب',
  'Filling In Progress': 'التعبئة جارية',
  'Debit & SMS Receipt': 'الخصم وإيصال SMS',
  'Open · modulating': 'مفتوح · تنظيم',
  'Closed · complete': 'مغلق · مكتمل',
  'Fault · locked': 'عطل · مقفل',
  'Closed': 'مغلق',
  'Auto · fine-fill top-up': 'تلقائي · إتمام دقيق',
};
export default extra;
