import type { Locale } from "@/lib/i18n/types";

export type AboutPageContent = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; titleLine2: string; body: string };
  fleet: {
    eyebrow: string;
    title: string;
    subtitle: string;
    badge: string;
    stats: { label: string; value: string }[];
  };
  liveRoutes: { eyebrow: string; title: string; subtitle: string };
  liveStats: {
    eyebrow: string;
    title: string;
    items: { label: string }[];
  };
  network: {
    eyebrow: string;
    title: string;
    body: string;
    mapLabel: string;
  };
  story: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    stats: { value: string; label: string }[];
  };
  values: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: { num: string; title: string; body: string }[];
  };
  leadership: {
    eyebrow: string;
    title: string;
    subtitle: string;
    comingSoon: string;
    announcedSoon: string;
    roles: { title: string }[];
  };
  journey: {
    eyebrow: string;
    title: string;
    milestones: { year: string; title: string; body: string }[];
  };
  cta: { title: string; body: string; button: string };
};

const ROUTES = [
  { from: "NBO", to: "MGQ", fromCity: "Nairobi", toCity: "Mogadishu" },
  { from: "NBO", to: "JIB", fromCity: "Nairobi", toCity: "Djibouti" },
  { from: "NBO", to: "ADD", fromCity: "Nairobi", toCity: "Addis Ababa" },
  { from: "NBO", to: "DAR", fromCity: "Nairobi", toCity: "Dar es Salaam" },
  { from: "JIB", to: "MGQ", fromCity: "Djibouti", toCity: "Mogadishu" },
];

const CITIES = [
  { code: "NBO", name: "Nairobi", x: 28, y: 62 },
  { code: "MGQ", name: "Mogadishu", x: 58, y: 48 },
  { code: "JIB", name: "Djibouti", x: 62, y: 38 },
  { code: "ADD", name: "Addis Ababa", x: 52, y: 42 },
  { code: "DAR", name: "Dar es Salaam", x: 48, y: 72 },
];

const en: AboutPageContent = {
  meta: {
    title: "About Bilan Air — A Somali Aviation Brand Built for Africa",
    description:
      "Learn how Bilan Air connects East Africa with Somali pride — our fleet, values, network, and journey from Nairobi to the region.",
  },
  hero: {
    eyebrow: "Our Story",
    title: "Built on pride.",
    titleLine2: "Driven by purpose.",
    body: "Bilan Air was born from a belief that Somalia deserves a world-class airline — one that carries its people, its culture, and its ambitions to every corner of East Africa and beyond.",
  },
  fleet: {
    eyebrow: "Our Fleet",
    title: "Boeing 737-700",
    subtitle: "Our planned aircraft — reliable, efficient and perfect for East African routes",
    badge: "Acquisition in progress",
    stats: [
      { label: "Registration", value: "TBC" },
      { label: "Planned Seats", value: "119" },
      { label: "Range", value: "6,230 km" },
      { label: "Cruise Speed", value: "842 km/h" },
    ],
  },
  liveRoutes: {
    eyebrow: "Live Routes",
    title: "Watch our flights in motion",
    subtitle: "Animated representation of Bilan Air's route network across East Africa",
  },
  liveStats: {
    eyebrow: "Live Stats",
    title: "Bilan Air by the numbers",
    items: [
      { label: "Active Flights" },
      { label: "Routes" },
      { label: "Total Seats" },
      { label: "On Time Today" },
    ],
  },
  network: {
    eyebrow: "Our Network",
    title: "East Africa connected",
    body: "Bilan Air connects the region's key cities with safe, reliable and affordable flights.",
    mapLabel: "BILAN AIR NETWORK",
  },
  story: {
    eyebrow: "A Somali aviation brand built for the world.",
    title: "A Somali aviation brand built for the world.",
    paragraphs: [
      "Bilan Air is a Somali aviation brand built to deliver safe, reliable, and high-quality air travel across Africa and beyond. We combine international aviation standards with a strong Somali identity to create a trusted and respected brand.",
      "We believe that great aviation is about more than getting from A to B. It's about the experience, the people, and the story. Every flight we operate carries Somali pride, and every passenger we serve is treated as family.",
      "From our dedicated ground teams to our carefully trained cabin crew, every person at Bilan Air is united by one vision: to make Somali aviation something the world looks up to.",
    ],
    stats: [
      { value: "12+", label: "Active Routes" },
      { value: "98%", label: "On-Time Rate" },
      { value: "50K+", label: "Passengers Flown" },
      { value: "6", label: "Countries Served" },
    ],
  },
  values: {
    eyebrow: "What We Stand For",
    title: "Our values",
    subtitle:
      "Five principles guide every decision we make — from the cockpit to the customer desk.",
    items: [
      {
        num: "01",
        title: "Safety First",
        body: "No compromise, ever. We follow international aviation safety standards to the letter and invest continuously in crew training and aircraft maintenance.",
      },
      {
        num: "02",
        title: "Reliability Always",
        body: "We know your time matters. We work hard to keep our schedules, our systems, and our promises — every single day.",
      },
      {
        num: "03",
        title: "Respect for All",
        body: "Every passenger, every crew member, every partner deserves dignity and respect. This is the foundation of how we work.",
      },
      {
        num: "04",
        title: "Somali Identity",
        body: "We are proud of where we come from. Our identity is our strength — we bring Somali hospitality and culture to every flight we operate.",
      },
      {
        num: "05",
        title: "Clear Communication",
        body: "No jargon, no runaround. We believe in being honest, direct, and transparent with our passengers and our partners at all times.",
      },
      {
        num: "06",
        title: "Continuous Growth",
        body: "We are always learning, always improving. Every flight is an opportunity to be better — for our people and for our passengers.",
      },
    ],
  },
  leadership: {
    eyebrow: "Leadership",
    title: "The team behind Bilan Air",
    subtitle: "Experienced operators, proud Somalis, and passionate aviation professionals.",
    comingSoon: "Coming Soon",
    announcedSoon: "Profile will be announced soon.",
    roles: [
      { title: "Chief Executive Officer" },
      { title: "Chief Operations Officer" },
      { title: "Head of Safety & Compliance" },
      { title: "Head of Customer Experience" },
      { title: "Chief Commercial Officer" },
      { title: "Head of Finance" },
    ],
  },
  journey: {
    eyebrow: "Our Journey",
    title: "From idea to airline",
    milestones: [
      {
        year: "2021",
        title: "Founded in Nairobi",
        body: "Bilan Air is incorporated by a team of Somali aviation professionals with a shared vision: a world-class airline representing Somalia.",
      },
      {
        year: "2022",
        title: "First Route: Nairobi – Mogadishu",
        body: "We launch our inaugural route, operating daily scheduled services between Wilson Airport and Aden Adde International Airport.",
      },
      {
        year: "2023",
        title: "Fleet Expansion & Cargo Launch",
        body: "Second aircraft joins the fleet. Bilan Air launches dedicated cargo services supporting East African trade corridors.",
      },
      {
        year: "2024",
        title: "50,000 Passengers Milestone",
        body: "We reach 50,000 passengers carried — a proud moment for our team and a testament to the trust placed in us by the Somali community.",
      },
      {
        year: "2025",
        title: "Regional Expansion: 6 Countries",
        body: "New routes to Djibouti, Addis Ababa, and Dar es Salaam. Bilan Air now serves 6 countries across East Africa.",
      },
      {
        year: "2026",
        title: "Beyond East Africa",
        body: "Long-haul planning underway. Bilan Air sets its sights on connecting the Somali diaspora in Europe and the Gulf with direct routes.",
      },
    ],
  },
  cta: {
    title: "Ready to fly with us?",
    body: "We'd love to take you somewhere. Whether it's a quick hop to Mogadishu or a regional journey across East Africa, Bilan Air is ready to get you there safely, comfortably, and on time.",
    button: "Book a Flight",
  },
};

const ar: AboutPageContent = {
  meta: {
    title: "عن بيلان إير — علامة طيران صومالية بُنيت لأفريقيا",
    description:
      "تعرّف على كيف تربط بيلان إير شرق أفريقيا بفخر صومالي — أسطولنا وقيمنا وشبكتنا ورحلتنا.",
  },
  hero: {
    eyebrow: "قصتنا",
    title: "بُنيت على الفخر.",
    titleLine2: "وتقودها الرؤية.",
    body: "وُلدت بيلان إير من إيمان بأن الصومال تستحق شركة طيران عالمية — تحمل شعبها وثقافتها وطموحاتها إلى كل ركن في شرق أفريقيا وما beyond.",
  },
  fleet: {
    eyebrow: "أسطولنا",
    title: "Boeing 737-700",
    subtitle: "طائراتنا المخططة — موثوقة وفعّالة وم ideal لمسارات شرق أفريقيا",
    badge: "الاستحواذ قيد التقدم",
    stats: [
      { label: "التسجيل", value: "قريباً" },
      { label: "المقاعد الم planned", value: "119" },
      { label: "المدى", value: "6,230 km" },
      { label: "سرعة الإبحار", value: "842 km/h" },
    ],
  },
  liveRoutes: {
    eyebrow: "المسارات المباشرة",
    title: "شاهد رحلاتنا في حركة",
    subtitle: "تمثيل متحرك لشبكة مسارات بيلان إير عبر شرق أفريقيا",
  },
  liveStats: {
    eyebrow: "إحصائيات مباشرة",
    title: "بيلان إير بالأرقام",
    items: [
      { label: "رحلات نشطة" },
      { label: "المسارات" },
      { label: "إجمالي المقاعد" },
      { label: "في الموعد اليوم" },
    ],
  },
  network: {
    eyebrow: "شبكتنا",
    title: "شرق أفريقيا متصلة",
    body: "بيلان إير تربط مدن المنطقة الرئيسية برحلات آمنة وموثوقة وبأسعار مناسبة.",
    mapLabel: "شبكة بيلان إير",
  },
  story: {
    eyebrow: "علامة طيران صومالية بُنيت للعالم.",
    title: "علامة طيران صومالية بُنيت للعالم.",
    paragraphs: [
      "بيلان إير علامة طيران صومالية تقدم سفراً جوياً آمناً وموثوقاً وعالي الجودة عبر أفريقيا وما beyond. نجمع معايير الطيران الدولية مع هوية صومالية قوية.",
      "نؤمن أن الطيران العظيم يتجاوز الانتقال من A إلى B. إنه التجربة والناس والقصة. كل رحلة تحمل فخراً صومالياً وكل راكب يُعامل كعائلة.",
      "من فرق الأرض إلى طاقم المقصورة، كل شخص في بيلان إير متحد برؤية واحدة: جعل الطيران الصومالي محط إعجاب العالم.",
    ],
    stats: [
      { value: "12+", label: "مسارات نشطة" },
      { value: "98%", label: "معدل الالتزام بالمواعيد" },
      { value: "50K+", label: "مسافرين" },
      { value: "6", label: "دول" },
    ],
  },
  values: {
    eyebrow: "ما نؤمن به",
    title: "قيمنا",
    subtitle: "مبادئ توجه كل قرار — من قمرة القيادة إلى مكتب خدمة العملاء.",
    items: [
      {
        num: "01",
        title: "السلامة أولاً",
        body: "لا مساومة أبداً. نلتزم بمعايير السلامة الدولية ونستثمر باستمرار في تدريب الطاقم وصيانة الطائرات.",
      },
      {
        num: "02",
        title: "الموثوقية دائماً",
        body: "وقتك مهم. نعمل بجد للحفاظ على جداولنا وأنظمتنا ووعودنا — كل يوم.",
      },
      {
        num: "03",
        title: "احترام الجميع",
        body: "كل راكب وكل عضو طاقم وكل شريك يستحق الكرامة والاحترام.",
      },
      {
        num: "04",
        title: "الهوية الصومية",
        body: "نفخر بأصولنا. هويتنا قوتنا — نجلب الضيافة والثقافة الصومية إلى كل رحلة.",
      },
      {
        num: "05",
        title: "تواصل واضح",
        body: "بدون مصطلحات معقدة. نؤمن بالصدق والوضوح مع الركاب والشركاء.",
      },
      {
        num: "06",
        title: "نمو مستمر",
        body: "نتعلم ونتحسن دائماً. كل رحلة فرصة لنكون أفضل — لموظفينا ولركابنا.",
      },
    ],
  },
  leadership: {
    eyebrow: "القيادة",
    title: "الفريق وراء بيلان إير",
    subtitle: "مشغلون ذوو خبرة، صوماليون فخورون، ومحترفون في الطيران.",
    comingSoon: "قريباً",
    announcedSoon: "سيُعلن عن الملف الشخصي قريباً.",
    roles: [
      { title: "الرئيس التنفيذي" },
      { title: "رئيس العمليات" },
      { title: "رئيس السلامة والامتثال" },
      { title: "رئيس تجربة العملاء" },
      { title: "الرئيس التجاري" },
      { title: "رئيس المالية" },
    ],
  },
  journey: {
    eyebrow: "رحلتنا",
    title: "من فكرة إلى شركة طيران",
    milestones: [
      {
        year: "2021",
        title: "التأسيس في نairobi",
        body: "تأسست بيلان إير على يد فريق من محترفي الطيران الصوماليين برؤية شركة طيران عالمية تمثل الصومال.",
      },
      {
        year: "2022",
        title: "أول مسار: Nairobi – Mogadishu",
        body: "إطلاق مسارنا الأول بخدمات يومية مجدولة.",
      },
      {
        year: "2023",
        title: "توسيع الأسطول وإطلاق الشحن",
        body: "انضمت طائرة ثانية. إطلاق خدمات الشحن الم dedicated.",
      },
      {
        year: "2024",
        title: "50,000 مسافر",
        body: "بلغنا 50,000 مسافر — لحظة فخر لفريقنا وثقة الم community الصومالي.",
      },
      {
        year: "2025",
        title: "توسع إقليمي: 6 دول",
        body: "مسارات جديدة إلى Djibouti وAddis Ababa وDar es Salaam.",
      },
      {
        year: "2026",
        title: "ما beyond شرق أفريقيا",
        body: "تخطيط للرحلات طويلة المدى لربط diaspora الصومالي في أوروبا والخليج.",
      },
    ],
  },
  cta: {
    title: "مستعد للطيران معنا؟",
    body: "نود أن نأخذك إلى وجهتك. سواء رحلة قصيرة إلى Mogadishu أو رحلة إقليمية عبر شرق أفريقيا، بيلان إير جاهزة لتوصيلك بأمان وراحة وفي الوقت.",
    button: "احجز رحلة",
  },
};

export function getAboutPageContent(locale: Locale): AboutPageContent {
  return locale === "ar" ? ar : en;
}

export { ROUTES, CITIES };
