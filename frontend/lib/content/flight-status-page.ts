import type { Locale } from "@/lib/i18n/types";

export type FlightStatusPageContent = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; titleLine2: string; body: string };
  search: {
    title: string;
    tabFlight: string;
    tabRoute: string;
    tabBooking: string;
    flightNumber: string;
    date: string;
    origin: string;
    destination: string;
    bookingRef: string;
    searchBtn: string;
    clearBtn: string;
  };
  schedule: {
    title: string;
    subtitle: string;
    liveUpdates: string;
    lastUpdated: string;
    allFlights: string;
    noFlights: string;
    columns: {
      flight: string;
      route: string;
      departure: string;
      arrival: string;
      terminal: string;
      status: string;
    };
  };
  detail: {
    departure: string;
    arrival: string;
    flightInfo: string;
    progress: string;
    aircraft: string;
    close: string;
  };
  info: {
    delays: { title: string; body: string };
    baggage: { title: string; body: string };
    disruptions: { title: string; body: string };
  };
  statusLabels: Record<string, string>;
};

const en: FlightStatusPageContent = {
  meta: {
    title: "Flight Status — Live Updates | Bilan Air",
    description:
      "Track Bilan Air flights by number, route, or booking reference. View today's schedule and live status updates.",
  },
  hero: {
    eyebrow: "Flight Status",
    title: "Real-time",
    titleLine2: "flight information.",
    body: "Track any Bilan Air flight by number, route, or date. Updated live every 2 minutes from our operations centre.",
  },
  search: {
    title: "Search Flights",
    tabFlight: "By Flight Number",
    tabRoute: "By Route",
    tabBooking: "By Booking Ref",
    flightNumber: "Flight Number",
    date: "Date",
    origin: "From",
    destination: "To",
    bookingRef: "Booking Reference (PNR)",
    searchBtn: "Search",
    clearBtn: "Show today",
  },
  schedule: {
    title: "Today's Schedule",
    subtitle: "All flights",
    liveUpdates: "Live Updates",
    lastUpdated: "Last updated",
    allFlights: "All flights",
    noFlights: "No flights match your search for this date.",
    columns: {
      flight: "Flight",
      route: "Route",
      departure: "Departure",
      arrival: "Arrival",
      terminal: "Terminal / Gate",
      status: "Status",
    },
  },
  detail: {
    departure: "Departure",
    arrival: "Arrival",
    flightInfo: "Flight Info",
    progress: "Flight Progress",
    aircraft: "Aircraft",
    close: "Close",
  },
  info: {
    delays: {
      title: "Flight delays",
      body: "If your flight is delayed by more than 3 hours, you are entitled to a meal voucher and complimentary refreshments at the gate. Contact our ground team for assistance.",
    },
    baggage: {
      title: "Checked baggage",
      body: "Bags are typically available at the carousel within 20–30 minutes of landing. If your bag has not arrived after 45 minutes, please visit the Bilan Air baggage desk.",
    },
    disruptions: {
      title: "Flight disruptions",
      body: "For cancellations or major disruptions, our customer care team is reachable 24/7 on +254 700 245 100 or via WhatsApp at the same number.",
    },
  },
  statusLabels: {
    Scheduled: "Scheduled",
    Delayed: "Delayed",
    Cancelled: "Cancelled",
    Departed: "Departed",
    Arrived: "Arrived",
  },
};

const ar: FlightStatusPageContent = {
  meta: {
    title: "حالة الرحلة — تحديثات مباشرة | Bilan Air",
    description: "تتبع رحلات بيلان إير برقم الرحلة أو المسار أو مرجع الحجز.",
  },
  hero: {
    eyebrow: "حالة الرحلة",
    title: "معلومات",
    titleLine2: "رحلات في الوقت الفعلي.",
    body: "تتبع أي رحلة بيلان إير برقم الرحلة أو المسار أو التاريخ. يتم التحديث كل دقيقتين من مركز العمليات.",
  },
  search: {
    title: "البحث عن رحلات",
    tabFlight: "برقم الرحلة",
    tabRoute: "حسب المسار",
    tabBooking: "برقم الحجز",
    flightNumber: "رقم الرحلة",
    date: "التاريخ",
    origin: "من",
    destination: "إلى",
    bookingRef: "مرجع الحجز (PNR)",
    searchBtn: "بحث",
    clearBtn: "عرض اليوم",
  },
  schedule: {
    title: "جدول اليوم",
    subtitle: "جميع الرحلات",
    liveUpdates: "تحديثات مباشرة",
    lastUpdated: "آخر تحديث",
    allFlights: "جميع الرحلات",
    noFlights: "لا توجد رحلات مطابقة لهذا التاريخ.",
    columns: {
      flight: "الرحلة",
      route: "المسار",
      departure: "المغادرة",
      arrival: "الوصول",
      terminal: "الصالة / البوابة",
      status: "الحالة",
    },
  },
  detail: {
    departure: "المغادرة",
    arrival: "الوصول",
    flightInfo: "معلومات الرحلة",
    progress: "تقدم الرحلة",
    aircraft: "الطائرة",
    close: "إغلاق",
  },
  info: {
    delays: {
      title: "تأخير الرحلات",
      body: "إذا تأخرت رحلتك أكثر من 3 ساعات، يحق لك الحصول على قسيمة وجبة ومرطبات مجانية عند البوابة.",
    },
    baggage: {
      title: "الأمتعة المسجلة",
      body: "عادة ما تكون الحقائب متاحة على السير خلال 20–30 دقيقة من الهبوط.",
    },
    disruptions: {
      title: "اضطرابات الرحلات",
      body: "للإلغاءات أو الاضطرابات الكبرى، فريق خدمة العملاء متاح على مدار الساعة على +254 700 245 100.",
    },
  },
  statusLabels: {
    Scheduled: "مجدولة",
    Delayed: "متأخرة",
    Cancelled: "ملغاة",
    Departed: "غادرت",
    Arrived: "وصلت",
  },
};

export function getFlightStatusPageContent(locale: Locale): FlightStatusPageContent {
  return locale === "ar" ? ar : en;
}

export function statusProgress(status: string): number {
  switch (status) {
    case "Arrived":
      return 100;
    case "Departed":
      return 65;
    case "Delayed":
      return 20;
    case "Cancelled":
      return 0;
    default:
      return 10;
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "Scheduled":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Delayed":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "Cancelled":
      return "bg-red-100 text-red-800 border-red-200";
    case "Departed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Arrived":
      return "bg-navy/10 text-navy border-navy/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}
