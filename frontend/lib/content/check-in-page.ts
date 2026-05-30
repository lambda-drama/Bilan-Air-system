import type { Locale } from "@/lib/i18n/types";

export type CheckInPageContent = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; body: string };
  steps: [string, string, string];
  find: {
    title: string;
    body: string;
    pnr: string;
    lastName: string;
    submit: string;
    notFound: string;
  };
  confirm: {
    title: string;
    body: string;
    flight: string;
    passengers: string;
    baggageTitle: string;
    carryOn: string;
    checkedBag: string;
    complete: string;
    paymentRequired: string;
    windowClosed: string;
    alreadyCheckedIn: string;
  };
  complete: {
    title: string;
    body: string;
    print: string;
    trackFlight: string;
    important: string;
    arriveEarly: string;
    gateClose: string;
  };
};

const en: CheckInPageContent = {
  meta: {
    title: "Online Check-in — Bilan Air",
    description:
      "Check in online from 24 hours up to 2 hours before your flight and get your boarding pass instantly.",
  },
  hero: {
    eyebrow: "Online Check-in",
    title: "Check in from anywhere.",
    body: "Check in online from 24 hours up to 2 hours before your flight. Get your boarding pass instantly.",
  },
  steps: ["Find Booking", "Confirm Details", "Boarding Pass"],
  find: {
    title: "Find your booking",
    body: "Enter your booking reference and last name to begin check-in",
    pnr: "Booking Reference",
    lastName: "Lead Passenger Last Name",
    submit: "Find My Booking",
    notFound: "Booking not found. Please check your reference and last name.",
  },
  confirm: {
    title: "Confirm passenger details",
    body: "Please verify your information before checking in",
    flight: "Flight",
    passengers: "Passengers",
    baggageTitle: "Your baggage allowance",
    carryOn: "carry-on bag",
    checkedBag: "checked bag",
    complete: "Complete Check-in",
    paymentRequired: "Payment must be completed before you can check in.",
    windowClosed:
      "Online check-in opens 24 hours before departure and closes 2 hours before departure.",
    alreadyCheckedIn: "You are already checked in. Your boarding pass is below.",
  },
  complete: {
    title: "Check-in Complete!",
    body: "Your boarding pass is ready. Please arrive at the gate at least 45 minutes before departure.",
    print: "Print Boarding Pass",
    trackFlight: "Track Flight",
    important: "Important",
    arriveEarly: "Please arrive at the airport at least 2 hours before departure.",
    gateClose: "Gates close 30 minutes before departure time.",
  },
};

const ar: CheckInPageContent = {
  meta: {
    title: "تسجيل الوصول عبر الإنترنت — Bilan Air",
    description: "سجّل وصولك من 24 ساعة حتى ساعتين قبل الرحلة واحصل على بطاقة الصعود.",
  },
  hero: {
    eyebrow: "تسجيل الوصول",
    title: "سجّل وصولك من أي مكان.",
    body: "تسجيل الوصول متاح من 24 ساعة حتى ساعتين قبل المغادرة. احصل على بطاقة الصعود فوراً.",
  },
  steps: ["البحث عن الحجز", "تأكيد البيانات", "بطاقة الصعود"],
  find: {
    title: "ابحث عن حجزك",
    body: "أدخل مرجع الحجز واسم العائلة لبدء تسجيل الوصول",
    pnr: "مرجع الحجز",
    lastName: "اسم عائلة المسافر الرئيسي",
    submit: "البحث عن حجزي",
    notFound: "لم يتم العثور على الحجز. تحقق من المرجع واسم العائلة.",
  },
  confirm: {
    title: "تأكيد بيانات المسافر",
    body: "يرجى التحقق من معلوماتك قبل تسجيل الوصول",
    flight: "الرحلة",
    passengers: "المسافرون",
    baggageTitle: "بدل الأمتعة",
    carryOn: "حقيبة يد",
    checkedBag: "حقيبة مسجلة",
    complete: "إتمام تسجيل الوصول",
    paymentRequired: "يجب إتمام الدفع قبل تسجيل الوصول.",
    windowClosed: "يفتح تسجيل الوصول قبل 24 ساعة ويغلق قبل ساعتين من المغادرة.",
    alreadyCheckedIn: "تم تسجيل وصولك بالفعل. بطاقة الصعود أدناه.",
  },
  complete: {
    title: "تم تسجيل الوصول!",
    body: "بطاقة الصعود جاهزة. يرجى الوصول إلى البوابة قبل 45 دقيقة على الأقل من المغادرة.",
    print: "طباعة بطاقة الصعود",
    trackFlight: "تتبع الرحلة",
    important: "مهم",
    arriveEarly: "يرجى الوصول إلى المطار قبل ساعتين على الأقل من المغادرة.",
    gateClose: "تُغلق البوابات قبل 30 دقيقة من موعد المغادرة.",
  },
};

export function getCheckInPageContent(locale: Locale): CheckInPageContent {
  return locale === "ar" ? ar : en;
}

export function formatClock(time: string) {
  if (!time) return "—";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}
