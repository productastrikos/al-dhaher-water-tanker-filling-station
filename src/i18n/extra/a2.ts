/** WP A2 (CCTV / Billing / Reports / S!a / floating assistant) — additions to the EN -> AR dictionary.
 *  Only keys that the legacy dictionary did not already have. Live values (plates, accounts, owners, bay numbers) stay untranslated. */
const extra: Record<string, string> = {
  // CCTV lightbox
  'Live feed · Al Dhaher → Salmiya Control Centre · 60-day NVR retention': 'بث مباشر · الظاهر ← مركز التحكم في السالمية · الاحتفاظ بالتسجيلات 60 يومًا',
  'Close (Esc)': 'إغلاق (Esc)',
  'Entry': 'دخول',
  'Exit': 'خروج',
  // Reports
  'No scheduled reports yet — click "Schedule Report" to add one.': 'لا توجد تقارير مجدولة بعد — اضغط «جدولة تقرير» لإضافة واحد.',
  'daily': 'يوميًا',
  'Remove': 'إزالة',
  'Shift': 'الوردية',
  'Date': 'التاريخ',
  'Month': 'الشهر',
  'Bays Active': 'الأحواض العاملة',
  'Bays Active (avg)': 'الأحواض العاملة (متوسط)',
  'Volume (Imp.gal)': 'الكمية (جالون إمبراطوري)',
  'Revenue (KD)': 'الإيرادات (د.ك)',
  'Tankers': 'الصهاريج',
  'Avg Fill (min)': 'متوسط التعبئة (دقيقة)',
  'Uptime %': 'نسبة التشغيل %',
  'Water Loss %': 'فاقد المياه %',
  // Billing ledger
  'Fill (debit)': 'تعبئة (خصم)',
  'Voucher gen': 'إصدار قسيمة',
  'K-net': 'كي-نت',
  'MEW Pay app': 'تطبيق MEW Pay',
  'Web portal': 'البوابة الإلكترونية',
  'Posted': 'مرحّل',
  'Cleared': 'مُسوّى',
  'Settling': 'قيد التسوية',
  'Buffered': 'مخزّن مؤقتًا',
  // Floating assistant
  'Ask S!a': 'اسأل S!a',
};
export default extra;
