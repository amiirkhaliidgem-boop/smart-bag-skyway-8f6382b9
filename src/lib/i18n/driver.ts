// Driver Portal localization dictionaries (UI strings only).
//
// Values that come from the database — passenger names, addresses, phone
// numbers, delivery IDs, PIR numbers, bag tags — are NEVER keyed here. They are
// only interpolated as raw data.

export type DriverLang = "en" | "ar";

export interface DriverStrings {
  // Sign in
  signInTitle: string;
  driverLabel: string;
  pinLabel: string;
  pinPlaceholder: string;
  signInAction: string;
  invalidPin: string;
  welcome: (name: string) => string;
  // Header
  portalTitle: string;
  signedInAs: string;
  signOut: string;
  language: string;
  // KPIs
  stopsToday: string;
  outForDelivery: string;
  completed: string;
  // Route card
  todaysRoute: string;
  stopsCount: (n: number) => string;
  fromOrigin: (label: string) => string;
  originGps: string;
  originLastStop: string;
  originStation: string;
  originUnknown: string;
  gpsOn: string;
  gpsLocating: string;
  gpsDenied: string;
  gpsUnsupported: string;
  gpsError: string;
  gpsIdle: string;
  navigateFullRoute: string;
  noStops: string;
  noCompleted: string;
  // Delivery card
  currentStop: string;
  navigateToStop: string;
  accept: string;
  collectBag: string;
  startDelivery: string;
  completeWithOtp: string;
  deliveredBadge: string;
  priority: (p: string) => string;
  // Toasts
  acceptedToast: (id: string) => string;
  collectedToast: (id: string) => string;
  outForDeliveryToast: (id: string) => string;
  deliveredToast: string;
  invalidOtp: string;
  // OTP dialog
  verifyOtp: string;
  otpHint: string;
  otpPlaceholder: string;
  cancel: string;
  confirm: string;
}

const en: DriverStrings = {
  signInTitle: "Delivery Agent Sign In",
  driverLabel: "Delivery Agent",
  pinLabel: "PIN",
  pinPlaceholder: "Demo PIN: 1234",
  signInAction: "Sign In",
  invalidPin: "Invalid PIN — demo uses 1234",
  welcome: (name) => `Welcome, ${name}`,
  portalTitle: "Delivery Agent Portal",
  signedInAs: "Signed in as",
  signOut: "Sign Out",
  language: "Language",
  stopsToday: "Stops Today",
  outForDelivery: "Out for Delivery",
  completed: "Completed",
  todaysRoute: "Today's Route",
  stopsCount: (n) => `${n} ${n === 1 ? "stop" : "stops"}`,
  fromOrigin: (label) => `from ${label}`,
  originGps: "Live GPS",
  originLastStop: "Last completed stop",
  originStation: "Station (no GPS yet)",
  originUnknown: "—",
  gpsOn: "GPS on",
  gpsLocating: "Locating…",
  gpsDenied: "Location off",
  gpsUnsupported: "GPS unsupported",
  gpsError: "GPS error",
  gpsIdle: "GPS idle",
  navigateFullRoute: "Navigate Full Route",
  noStops: "No stops assigned. New deliveries will appear here automatically.",
  noCompleted: "No deliveries completed yet.",
  currentStop: "Current stop",
  navigateToStop: "Navigate to Stop",
  accept: "Accept",
  collectBag: "Collect Bag",
  startDelivery: "Start Delivery",
  completeWithOtp: "Complete with OTP",
  deliveredBadge: "Delivered",
  priority: (p) => p,
  acceptedToast: (id) => `${id} — Accepted`,
  collectedToast: (id) => `${id} — Bag Collected`,
  outForDeliveryToast: (id) => `${id} — Out for Delivery`,
  deliveredToast: "Delivered · OTP verified",
  invalidOtp: "Invalid OTP",
  verifyOtp: "Verify OTP",
  otpHint: "Ask the passenger for the OTP shown in their Passenger Portal.",
  otpPlaceholder: "4-digit code",
  cancel: "Cancel",
  confirm: "Confirm",
};

const AR_PRIORITY: Record<string, string> = {
  VIP: "كبار الشخصيات",
  High: "عالية",
  Normal: "عادية",
  Low: "منخفضة",
};

const ar: DriverStrings = {
  signInTitle: "تسجيل دخول مندوب التسليم",
  driverLabel: "مندوب التسليم",
  pinLabel: "الرمز السري",
  pinPlaceholder: "الرمز التجريبي: 1234",
  signInAction: "تسجيل الدخول",
  invalidPin: "رمز غير صحيح — الرمز التجريبي 1234",
  welcome: (name) => `أهلاً بك، ${name}`,
  portalTitle: "بوابة مندوب التسليم",
  signedInAs: "تم تسجيل الدخول باسم",
  signOut: "تسجيل الخروج",
  language: "اللغة",
  stopsToday: "محطات اليوم",
  outForDelivery: "قيد التوصيل",
  completed: "مكتملة",
  todaysRoute: "مسار اليوم",
  stopsCount: (n) => (n === 1 ? "محطة واحدة" : n === 2 ? "محطتان" : `${n} محطات`),
  fromOrigin: (label) => `من ${label}`,
  originGps: "تحديد الموقع المباشر",
  originLastStop: "آخر محطة مكتملة",
  originStation: "المحطة (لا يوجد تحديد موقع بعد)",
  originUnknown: "—",
  gpsOn: "الموقع مُفعّل",
  gpsLocating: "جارٍ تحديد الموقع…",
  gpsDenied: "الموقع مُعطّل",
  gpsUnsupported: "تحديد الموقع غير مدعوم",
  gpsError: "خطأ في تحديد الموقع",
  gpsIdle: "الموقع غير نشط",
  navigateFullRoute: "التوجيه للمسار الكامل",
  noStops: "لا توجد محطات مُسندة. ستظهر عمليات التوصيل الجديدة هنا تلقائياً.",
  noCompleted: "لم يتم إكمال أي عملية توصيل بعد.",
  currentStop: "المحطة الحالية",
  navigateToStop: "التوجيه إلى المحطة",
  accept: "قبول",
  collectBag: "استلام الحقيبة",
  startDelivery: "بدء التوصيل",
  completeWithOtp: "إتمام بكلمة المرور",
  deliveredBadge: "تم التسليم",
  priority: (p) => AR_PRIORITY[p] ?? p,
  acceptedToast: (id) => `${id} — تم القبول`,
  collectedToast: (id) => `${id} — تم استلام الحقيبة`,
  outForDeliveryToast: (id) => `${id} — قيد التوصيل`,
  deliveredToast: "تم التسليم · تم التحقق من كلمة المرور",
  invalidOtp: "كلمة مرور غير صحيحة",
  verifyOtp: "التحقق من كلمة المرور",
  otpHint: "اطلب من الراكب كلمة المرور الظاهرة في بوابة الركاب.",
  otpPlaceholder: "رمز من 4 أرقام",
  cancel: "إلغاء",
  confirm: "تأكيد",
};

export const DRIVER_STRINGS: Record<DriverLang, DriverStrings> = { en, ar };
