/* ==========================================================
   S!aP — Desktop dashboard i18n: EN / AR with RTL, mirroring the
   MEW Pay mobile app's own language switcher (mobile.js) -- same idea
   (data-i18n / data-i18n-placeholder, English captured at first sight,
   an AR dictionary, RTL flip, localStorage persistence) but CONTENT-
   KEYED rather than key-named: an element opts in with a bare
   `data-i18n` (no value) and the dictionary maps its exact English
   text straight to Arabic. Retrofitting hundreds of existing chrome
   strings across index.html and every SIAP.registerView() module's
   own template string, semantic key names per string would cost far
   more than they'd return here -- the English text itself already IS
   a stable, unique key for a UI this size.

   Coverage is pragmatic/demo-grade, same scope mobile.js chose: sidebar
   + topbar chrome, card titles/hints/tags, buttons, table headers and
   key sentences across the dashboard, bay control, CCTV, billing,
   reports, S!a and network-map views. Per-tick-regenerated rows (bay
   tiles, alarm/ledger/log tables, network-map station list/detail) are
   NOT individually marked up -- instead statusLabel()/timeAgo() in
   app.js are themselves localised, so every view that renders through
   them gets bilingual status words/relative-times for free, while
   live numbers, names, plates and accounts stay as-is in both
   languages, exactly like the mobile app already does. Extending
   coverage later is pure content work: add data-i18n to more markup
   and an entry to AR_STRINGS below -- no engineering changes needed.
   ========================================================== */
(function () {
  "use strict";

  const KEY = "siap.lang";

  const AR_STRINGS = {
    // ---- sidebar ----
    "MEW · Al Dhaher LFS": "وزارة الكهرباء والماء · محطة الظاهر",
    "Operations": "العمليات",
    "Command Dashboard": "لوحة القيادة",
    "Filling Bay Control": "التحكم في أحواض التعبئة",
    "CCTV & LPR Wall": "المراقبة وقراءة اللوحات",
    "Revenue & Customer": "الإيرادات والعملاء",
    "Billing & MEW Pay": "الفوترة و MEW Pay",
    "Reports": "التقارير",
    "Intelligence": "الذكاء الاصطناعي",
    "Enterprise & ERP": "المؤسسات وتخطيط الموارد",
    "S!a — Ask & Act": "S!a — اسأل ونفّذ",
    "Tanker Dept.": "قسم الصهاريج",
    "MEW · Operator": "وزارة الكهرباء والماء · مشغّل",

    // ---- topbar ----
    "LIVE": "مباشر",
    "Simulate WAN loss": "محاكاة انقطاع الشبكة",
    "Salmiya DC → DR South Surra": "مركز بيانات السالمية ← موقع التعافي جنوب سرة",

    // ---- dashboard ----
    "Active Filling Bays": "أحواض التعبئة النشطة",
    "Water Dispensed Today": "المياه المصروفة اليوم",
    "Revenue Collected": "الإيرادات المحصّلة",
    "Tankers Served": "الصهاريج المخدومة",
    "Open Alarms": "الإنذارات المفتوحة",
    "S!aP System Architecture & Data Flow": "معمارية نظام S!aP وتدفق البيانات",
    "Operators (Al Dhaher LCC) · Salmiya Central Control · Tanker Owners (MEW Pay) · MEW Management":
      "المشغّلون (مركز تحكم الظاهر) · التحكم المركزي بالسالمية · ملاك الصهاريج (MEW Pay) · إدارة الوزارة",
    "ERP Integration — Enterprise & ERP": "تكامل تخطيط الموارد — المؤسسات وتخطيط الموارد",
    "Connected · SAP · Oracle · D365": "متصل · SAP · Oracle · D365",
    "S!aP now runs a full order-to-cash ERP workflow — purchase orders, fleet & driver registration, access credentials, tariffs and a live connector sync log — not just monitoring.":
      "يدير S!aP الآن دورة كاملة من الطلب إلى التحصيل — أوامر الشراء، تسجيل الأسطول والسائقين، بيانات الدخول، التعرفات وسجل مزامنة موصلات مباشر — وليس مجرد مراقبة.",
    "Open Enterprise & ERP in the sidebar, or jump straight to the connector tiles, object mapping and sync log.":
      "افتح المؤسسات وتخطيط الموارد من القائمة الجانبية، أو انتقل مباشرة إلى بطاقات الموصلات وتخطيط الكائنات وسجل المزامنة.",
    "Open ERP Integration": "فتح تكامل تخطيط الموارد",
    "Station Process Mimic — Al Dhaher Manifolds": "محاكاة عمليات المحطة — مجمّعات الظاهر",
    "live P&ID overview · inlet header → 6 manifolds × 7 bays": "نظرة حية على مخطط العمليات · خط التغذية ← 6 مجمّعات × 7 أحواض",
    "Live Bay Status — Al Dhaher LFS": "حالة الأحواض المباشرة — محطة الظاهر",
    "click a bay to open its control view": "انقر على حوض لفتح شاشة التحكم الخاصة به",
    "Idle": "خامل",
    "Filling": "قيد التعبئة",
    "Done": "مكتمل",
    "Fault": "عطل",
    "S!aP Viz — Station Inlet Flow": "S!aP Viz — تدفق التغذية بالمحطة",
    "Inlet press:": "ضغط التغذية:",
    "Water temp:": "حرارة المياه:",
    "Uptime:": "نسبة التشغيل:",
    "Hourly Dispensed Volume & Revenue": "الكمية المصروفة والإيرادات بالساعة",
    "Active Alarms": "الإنذارات النشطة",

    // ---- bay control ----
    "Select Bay": "اختر الحوض",
    "ETA to full": "الوقت المتبقي للامتلاء",
    "Instantaneous flow": "معدل التدفق اللحظي",
    "Control valve position": "وضع صمام التحكم",
    "Meter accuracy (custody)": "دقة العداد (رسمية)",
    "Mode": "الوضع",
    "Authorize fill": "تفويض التعبئة",
    "Release & close": "تحرير وإغلاق",
    "View 3D Twin": "عرض التوأم الرقمي ثلاثي الأبعاد",
    "S!aP BPM authorises the transaction and releases the hold; the bay RTU executes valve control locally — the platform is read-only towards the control loop and continues on last-known balance if the WAN drops.":
      "يقوم محرك S!aP BPM بتفويض العملية وتحرير الحجز؛ وتنفّذ وحدة التحكم بالحوض عملية الصمام محليًا — المنصة للقراءة فقط تجاه حلقة التحكم وتستمر بآخر رصيد معروف عند انقطاع الشبكة.",
    "Transaction & Authorization": "العملية والتفويض",
    "AUTHORIZED": "مُفوّض",
    "Tanker owner": "مالك الصهريج",
    "Account #": "رقم الحساب",
    "Auth method": "طريقة التفويض",
    "License plate": "لوحة المركبة",
    "Date / Time": "التاريخ / الوقت",
    "Wallet balance (pre)": "رصيد المحفظة (قبل)",
    "Est. charge": "التكلفة التقديرية",
    "Balance on completion": "الرصيد عند الاكتمال",
    "S!a live guidance: Hatch alignment confirmed by arm-camera. Filling nominal — no surge on valve open. Receipt auto-sends to +965 ···6873 & email on completion.":
      "إرشاد S!a المباشر: تم تأكيد محاذاة الفتحة بكاميرا الذراع. التعبئة تسير بشكل طبيعي — لا اندفاع عند فتح الصمام. يُرسل الإيصال تلقائيًا إلى +965 ···6873 وبالبريد الإلكتروني عند الاكتمال.",

    // ---- CCTV ----
    "IP Video Surveillance — Al Dhaher → Salmiya Control Centre": "المراقبة عبر الشبكة — الظاهر ← مركز تحكم السالمية",
    "42 cameras · UHD · 60-day NVR · triplex live/playback/record": "42 كاميرا · دقة UHD · تسجيل 60 يومًا · بث مباشر وتشغيل وتسجيل معًا",
    "License Plate Recognition — Gate Log": "التعرف على اللوحات — سجل البوابة",
    "Time": "الوقت",
    "Plate": "اللوحة",
    "Tanker Owner": "مالك الصهريج",
    "Gate": "البوابة",
    "Status": "الحالة",
    "S!aP ML & AI — Video Analytics Events": "S!aP ML & AI — أحداث تحليل الفيديو",

    // ---- billing ----
    "Revenue — Month to Date": "الإيرادات — منذ بداية الشهر",
    "K-net Top-ups Today": "عمليات شحن K-net اليوم",
    "Active Wallets": "المحافظ النشطة",
    "Settlement to MEW": "التسوية مع الوزارة",
    "Reconciled": "مطابقة",
    "Recent Transactions — Prepaid Ledger": "العمليات الأخيرة — سجل الدفع المسبق",
    "S!aP BPM · immutable": "S!aP BPM · غير قابل للتعديل",
    "Account": "الحساب",
    "Type": "النوع",
    "Volume": "الكمية",
    "Amount": "المبلغ",
    "Channel": "القناة",
    "MEW Pay — Customer App": "MEW Pay — تطبيق العملاء",
    "fully interactive on your phone": "تفاعلي بالكامل على هاتفك",
    "Water Wallet Balance": "رصيد محفظة المياه",
    "Top-up": "شحن الرصيد",
    "QR Pay": "الدفع بالرمز",
    "Stations": "المحطات",
    "History": "السجل",
    "Receipt": "الإيصال",
    "Recent": "الأحدث",
    "Android & iOS · EN / AR · K-net": "أندرويد و iOS · عربي / إنجليزي · K-net",
    "Open the full MEW Pay companion on a phone": "افتح تطبيق MEW Pay الكامل على الهاتف",
    "Open on phone →": "فتح على الهاتف ←",

    // ---- reports ----
    "Reporting — Shift, Day & Month": "التقارير — وردية، يومي وشهري",
    "generated from the S!aP central historian · scheduled or on demand": "تُنشأ من سجل S!aP المركزي · مجدولة أو عند الطلب",
    "Shift-wise": "حسب الوردية",
    "Day-wise": "يومي",
    "Month-wise": "شهري",
    "Export PDF": "تصدير PDF",
    "Export CSV": "تصدير CSV",
    "Schedule Report": "جدولة تقرير",
    "Scheduled Reports": "التقارير المجدولة",
    "Period": "الفترة",
    "Time (daily)": "الوقت (يوميًا)",
    "E-mail recipients": "مستلمو البريد الإلكتروني",
    "Cancel": "إلغاء",
    "Save Schedule": "حفظ الجدولة",

    // ---- S!a ----
    "S!a — Ask it. Act on it.": "S!a — اسأل. ونفّذ.",
    "natural-language query over operations, revenue & assets": "استعلام بلغة طبيعية عن العمليات والإيرادات والأصول",
    "Ask": "اسأل",
    "Which bays are underperforming today?": "ما الأحواض ذات الأداء الأضعف اليوم؟",
    "Forecast tomorrow's peak demand": "توقّع ذروة الطلب غدًا",
    "Any accounts flagged for fraud?": "هل هناك حسابات مشتبه بها للاحتيال؟",
    "Background Agents": "الوكلاء الخلفيون",
    "Demand Forecaster": "متنبئ الطلب",
    "Revenue Reconciler": "مُسوّي الإيرادات",
    "Water-Loss Analyzer": "محلل فقد المياه",
    "Active": "نشط",
    "Governance": "الحوكمة",
    "Every S!a recommendation is explainable and traceable to its trigger. Actions run behind human-approval gates — MEW owns the data, logic and roadmap. Glass Box AI, no black-box lock-in.":
      "كل توصية من S!a قابلة للتفسير ويمكن تتبعها إلى سببها. تُنفَّذ الإجراءات خلف بوابات موافقة بشرية — والوزارة تملك البيانات والمنطق وخارطة الطريق. ذكاء اصطناعي شفاف بلا صندوق أسود.",
    "Underperforming bays?": "أحواض ضعيفة الأداء؟",
    "Forecast peak demand": "توقّع ذروة الطلب",
    "Fraud flags?": "بلاغات احتيال؟",
    "Ask S!a about operations, revenue, assets...": "اسأل S!a عن العمليات أو الإيرادات أو الأصول...",

    // ---- network map ----
    "Kuwait Network Map": "خريطة شبكة الكويت",
    "26 stations · flagship 3D twin at Al Dhaher": "26 محطة · التوأم الرقمي الرئيسي في الظاهر",
    "Scroll or drag to pan/zoom · click a pin, or use the list →": "مرّر أو اسحب للتحريك والتكبير · انقر على علامة أو استخدم القائمة ←",
    "Base map: TUBS, CC BY-SA 3.0, via Wikimedia Commons (governorate boundaries derived from NordNordWest's coastline data)":
      "الخريطة الأساسية: TUBS، رخصة CC BY-SA 3.0، عبر ويكيميديا كومنز (حدود المحافظات مستمدة من بيانات الساحل لـ NordNordWest)",
    "All Stations": "كل المحطات",
    "click any row to open it": "انقر على أي صف لفتحه",
    "Network Summary": "ملخص الشبكة",
    "Bays per station (network-wide)": "الأحواض لكل محطة (على مستوى الشبكة)",
    "Flagship site": "الموقع الرئيسي",
    "Al Dhaher · 42 bays · full 3D twin": "الظاهر · 42 حوضًا · توأم رقمي كامل",
    "Al Dhaher is a confirmed MEW/CAPT lorry-filling-station project (Ahmadi Governorate); the other 25 locations illustrate the country-wide network coverage.":
      "محطة الظاهر مشروع مؤكد لتعبئة الصهاريج تابع للوزارة/الهيئة العامة (محافظة الأحمدي)؛ أما المواقع الـ25 الأخرى فتوضّح التغطية على مستوى الشبكة الوطنية.",
    "Search by name or governorate…": "ابحث بالاسم أو المحافظة…",
    "26 stations · 52 bays across Kuwait": "26 محطة · 52 حوضًا في الكويت",

    // ---- other modules' sidebar entries + topbar title/sub (see SIAP.viewTitles handling
    // below -- title/sub for the currently active view translate generically for ANY
    // registered view as long as an entry exists here, no extra code needed per view) ----
    "Network Map": "خريطة الشبكة",
    "3D Digital Twin": "التوأم الرقمي ثلاثي الأبعاد",
    "Astriverse · station & bay · live from S!aP Connect": "Astriverse · المحطة والحوض · مباشر من S!aP Connect",
    "Tanker Loading HMI": "واجهة تحميل الصهاريج",
    "Bay faceplate · PCS 7 style · read-only mirror of the RTU": "لوحة الحوض · طراز PCS 7 · نسخة للقراءة فقط من وحدة التحكم",
    "Order-to-Cash Tracker": "متتبع الطلب إلى التحصيل",
    "Purchase Orders": "أوامر الشراء",
    "Customers & Accounts": "العملاء والحسابات",
    "Fleet & Drivers": "الأسطول والسائقون",
    "Access Credentials": "بيانات الدخول",
    "ERP Integration": "تكامل تخطيط الموارد",
    "Tariffs · WOs · Audit": "التعرفات · أوامر العمل · التدقيق",

    // ---- shared helpers (statusLabel / timeAgo in app.js) ----
    "Offline": "غير متصل",
    "just now": "الآن",
    "m ago": "د مضت",
    "h": "س",
  };

  let currentLang = "en";
  const EN_CACHE = new WeakMap();
  const PH_CACHE = new WeakMap();

  function captureNew() {
    // Sidebar nav-item labels are created dynamically (app.js's own SIAP.registerView mount()
    // for every module, whether that module's script ran before or after this file's own
    // DOMContentLoaded init -- script load order makes wrapRegisterView() below unreliable on
    // its own) with plain text and no data-i18n; tag any not seen yet before the sweep so they
    // get swept up like everything else.
    document.querySelectorAll(".nav-item .nav-label:not([data-i18n])").forEach((el) => {
      el.setAttribute("data-i18n", "");
    });
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      if (EN_CACHE.has(el)) return;
      const hasMarkup = el.children.length > 0;
      EN_CACHE.set(el, {
        key: el.textContent.trim(),
        raw: hasMarkup ? el.innerHTML : el.textContent,
        hasMarkup,
      });
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      if (PH_CACHE.has(el)) return;
      PH_CACHE.set(el, el.getAttribute("placeholder") || "");
    });
  }

  /** Looks up the Arabic translation for an exact English string, falling back to the
   *  English itself when nothing is translated yet (never shows a blank/missing string). */
  function tr(enText) {
    if (currentLang === "ar") {
      const hit = AR_STRINGS[enText] || AR_STRINGS[enText.trim()];
      if (hit) return hit;
    }
    return enText;
  }

  function applyLanguage(lang) {
    currentLang = lang;
    captureNew();
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const cache = EN_CACHE.get(el);
      if (!cache) return;
      if (lang === "ar") {
        const ar = AR_STRINGS[cache.key];
        el.innerHTML = ar || cache.raw;
      } else if (cache.hasMarkup) {
        el.innerHTML = cache.raw;
      } else {
        el.textContent = cache.raw;
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const en = PH_CACHE.get(el);
      if (en === undefined) return;
      el.setAttribute("placeholder", lang === "ar" ? (AR_STRINGS[en.trim()] || en) : en);
    });

    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.querySelectorAll(".lang-toggle-label").forEach((el) => { el.textContent = lang === "ar" ? "EN" : "AR"; });
    document.querySelectorAll(".lang-toggle").forEach((btn) => btn.setAttribute("aria-pressed", lang === "ar" ? "true" : "false"));

    // #view-title / #view-sub are set via textContent by app.js's own nav click handler
    // (VIEW_TITLES), not marked with data-i18n, since their value changes with the active
    // view -- translate whichever pair is currently showing.
    const activeItem = document.querySelector(".nav-item.active");
    const view = activeItem && activeItem.dataset.view;
    const pair = view && window.SIAP && SIAP.viewTitles && SIAP.viewTitles[view];
    if (pair) {
      const titleEl = document.getElementById("view-title");
      const subEl = document.getElementById("view-sub");
      if (titleEl) titleEl.textContent = tr(pair[0]);
      if (subEl) subEl.textContent = tr(pair[1]);
    }

    try { localStorage.setItem(KEY, lang); } catch (e) {}
    if (window.lucide) lucide.createIcons();
    document.dispatchEvent(new CustomEvent("siap:lang-change", { detail: { lang } }));
  }

  function savedLang() {
    try { return localStorage.getItem(KEY) || "en"; } catch (e) { return "en"; }
  }

  /** Wraps SIAP.registerView so every module's freshly-mounted section (network-map, hmi,
   *  twin3d, erp -- each registers itself well after this file has already run its first
   *  pass, twin3d.js later still since it's a deferred `type=module` script) gets its own
   *  data-i18n content translated the moment it mounts, regardless of load order. */
  function wrapRegisterView() {
    if (!window.SIAP || SIAP.__i18nWrapped) return;
    const orig = SIAP.registerView;
    SIAP.registerView = function (def) {
      const origMount = def.onMount;
      def.onMount = function (section) {
        if (origMount) origMount(section);
        applyLanguage(currentLang);
      };
      return orig.call(SIAP, def);
    };
    SIAP.__i18nWrapped = true;
  }

  window.I18N = {
    get lang() { return currentLang; },
    tr,
    apply: applyLanguage,
  };

  function init() {
    currentLang = savedLang();
    applyLanguage(currentLang);
    document.body.addEventListener("click", (e) => {
      if (e.target.closest(".lang-toggle")) applyLanguage(currentLang === "ar" ? "en" : "ar");
    });
    if (window.SIAP && SIAP.on) SIAP.on("view:show", () => applyLanguage(currentLang));
  }

  // Wrap SIAP.registerView() the instant this script runs (i18n.js loads right after app.js,
  // which defines SIAP) -- BEFORE erp.js/hmi.js/network-map.js/twin3d.js run their own
  // top-level SIAP.registerView(...) calls, so every one of them picks up the wrapped
  // version. Doing this inside init() instead (deferred to DOMContentLoaded) was the actual
  // bug: classic <script> tags after this one already call the ORIGINAL registerView
  // synchronously during parsing, long before any DOMContentLoaded listener fires, so
  // wrapping later would silently miss all of them.
  wrapRegisterView();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
