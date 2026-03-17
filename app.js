// =============================================
//  VOLUNTEER DASHBOARD — app.js
// =============================================

// ---- CONFIG ----
const HARDCODED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyr1T1jHOTis8BTTuC0bdYw58Ed-BZQ5qBfyLJ87BOUTSofl4wx0ajv8cALtKeuvkJs/exec';
const HARDCODED_SHEET      = 'DATABASE';
const CFG_KEY = 'vdash_cfg';
let cfg = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
if (HARDCODED_SCRIPT_URL) { cfg.url = HARDCODED_SCRIPT_URL; cfg.sheet = HARDCODED_SHEET; }
const LIVE = !!cfg.url;

// ---- STATE ----
let allRows = [], filteredRows = [], currentRow = null;
let currentView = 'table', mapObj = null, mapMarkers = [];

const C = { id:0,title:1,desc:2,address:3,area:4,name:5,phone:6,status:7,link:8,responsible:9,volNotes:10,internalNotes:11,sys1:12,sys2:13,created:14,updated:15 };

const STATUS_BADGE = {
  'צריך מתנדבים דחוף':'badge-urgent','בטיפול':'badge-inprogress',
  'בבדיקה עם מתנדבים':'badge-checking','טופל':'badge-done',
  'לא רלוונטי':'badge-none','':'badge-none'
};
window.STATUS_BADGE = STATUS_BADGE;
const STATUS_COLOR = {
  'צריך מתנדבים דחוף':'#b83232','בטיפול':'#2563a8',
  'בבדיקה עם מתנדבים':'#c4621a','טופל':'#4a7c59','לא רלוונטי':'#7a7468',''  :'#7a7468'
};

function badgeHTML(s) {
  return `<span class="badge ${STATUS_BADGE[s]||'badge-none'}">${s||'ללא סטטוס'}</span>`;
}

// =============================================
//  AREA CLASSIFIER — comprehensive Israeli cities
// =============================================
// =============================================
//  AREA CLASSIFIER — extracts city from address,
//  handles merged cells, normalizes Hebrew text
// =============================================

// Map every city/town/village in Israel → area
// Keyed by normalized Hebrew name (no nikud, trimmed)
const CITY_TO_AREA = {
  // ירושלים
  'ירושלים':'ירושלים','בית הכרם':'ירושלים','מלחה':'ירושלים','גילה':'ירושלים',
  'רמות':'ירושלים','פסגת זאב':'ירושלים','הר נוף':'ירושלים','קטמון':'ירושלים',
  'בקעה':'ירושלים','טלביה':'ירושלים','רחביה':'ירושלים','עין כרם':'ירושלים',
  'ארנונה':'ירושלים','קריית יובל':'ירושלים','מוצא':'ירושלים','בית זית':'ירושלים',
  'אבו גוש':'ירושלים','קריית ענבים':'ירושלים','מעלה החמישה':'ירושלים',
  'הר אדר':'ירושלים','גבעת זאב':'ירושלים','גבעון':'ירושלים','ביתר עילית':'ירושלים',
  'צור הדסה':'ירושלים','עמינדב':'ירושלים','כסלון':'ירושלים','בית מאיר':'ירושלים',
  // עמק יזרעאל
  'עפולה':'עמק יזרעאל','מגדל העמק':'עמק יזרעאל','נוף הגליל':'עמק יזרעאל',
  'נצרת עילית':'עמק יזרעאל','כפר יהושע':'עמק יזרעאל','מרחביה':'עמק יזרעאל',
  'עין חרוד':'עמק יזרעאל','גדעונה':'עמק יזרעאל','תל יוסף':'עמק יזרעאל',
  'עין דור':'עמק יזרעאל','נהלל':'עמק יזרעאל','כפר ברוך':'עמק יזרעאל',
  'יפעת':'עמק יזרעאל','גניגר':'עמק יזרעאל','דבורייה':'עמק יזרעאל',
  'בית שאן':'עמק יזרעאל','בית לחם הגלילית':'עמק יזרעאל',
  // גבעת שמואל + פתח תקווה
  'גבעת שמואל':'גבעת שמואל + פתח תקווה','פתח תקווה':'גבעת שמואל + פתח תקווה',
  'כפר סבא':'גבעת שמואל + פתח תקווה','הוד השרון':'גבעת שמואל + פתח תקווה',
  'ראש העין':'גבעת שמואל + פתח תקווה','קלנסווה':'גבעת שמואל + פתח תקווה',
  'טייבה':'גבעת שמואל + פתח תקווה','טירה':'גבעת שמואל + פתח תקווה',
  // גבעתיים ורמת גן
  'גבעתיים':'גבעתיים ורמת גן','רמת גן':'גבעתיים ורמת גן',
  'בני ברק':'גבעתיים ורמת גן','קריית אונו':'גבעתיים ורמת גן',
  'אור יהודה':'גבעתיים ורמת גן','גני תקווה':'גבעתיים ורמת גן',
  'בת ים':'גבעתיים ורמת גן','חולון':'גבעתיים ורמת גן',
  // זכרון והסביבה
  'זכרון יעקב':'זכרון והסביבה','בנימינה':'זכרון והסביבה',
  'פרדס חנה':'זכרון והסביבה','כרכור':'זכרון והסביבה',
  'גבעת עדה':'זכרון והסביבה','עמיקם':'זכרון והסביבה',
  'רמת הנדיב':'זכרון והסביבה','עין כרמל':'זכרון והסביבה',
  'פרדסייה':'זכרון והסביבה','גבעת נילי':'זכרון והסביבה',
  // ראשון לציון
  'ראשון לציון':'ראשון לציון','נס ציונה':'ראשון לציון',
  'יבנה':'ראשון לציון','גן יבנה':'ראשון לציון','באר יעקב':'ראשון לציון',
  'צריפין':'ראשון לציון',
  // תל אביב
  'תל אביב':'תל אביב','יפו':'תל אביב','נווה צדק':'תל אביב',
  'פלורנטין':'תל אביב','רמת אביב':'תל אביב','צהלה':'תל אביב',
  // רעננה
  'רעננה':'רעננה','הרצליה':'רעננה','כפר שמריהו':'רעננה',
  'כפר נטר':'רעננה','אבן יהודה':'רעננה','צור יגאל':'רעננה','תל מונד':'רעננה',
  // שפלה
  'לוד':'שפלה','רמלה':'שפלה','קריית גת':'שפלה','קריית מלאכי':'שפלה',
  'גדרה':'שפלה','רחובות':'שפלה','מזכרת בתיה':'שפלה','פדיה':'שפלה',
  'חולדה':'שפלה','עקרון':'שפלה','בית דגן':'שפלה','נחם':'שפלה',
  // לב השרון עמק חפר
  'נתניה':'לב השרון עמק חפר והסביבה','חדרה':'לב השרון עמק חפר והסביבה',
  'קיסריה':'לב השרון עמק חפר והסביבה','קדימה':'לב השרון עמק חפר והסביבה',
  'צורן':'לב השרון עמק חפר והסביבה','מכמורת':'לב השרון עמק חפר והסביבה',
  'בית יצחק':'לב השרון עמק חפר והסביבה','אלישמע':'לב השרון עמק חפר והסביבה',
  'עין ורד':'לב השרון עמק חפר והסביבה','גבעת חיים':'לב השרון עמק חפר והסביבה',
  'משמר השרון':'לב השרון עמק חפר והסביבה','תל יצחק':'לב השרון עמק חפר והסביבה',
  'כפר ויתקין':'לב השרון עמק חפר והסביבה','בית חנניה':'לב השרון עמק חפר והסביבה',
  'אלוני יצחק':'לב השרון עמק חפר והסביבה','מעברות':'לב השרון עמק חפר והסביבה',
  'ניצני עוז':'לב השרון עמק חפר והסביבה','אבני חפץ':'לב השרון עמק חפר והסביבה',
  'כפר חיים':'לב השרון עמק חפר והסביבה','עין שריג':'לב השרון עמק חפר והסביבה',
  // משגב והסביבה
  'כרמיאל':'משגב והסביבה','עכו':'משגב והסביבה','נהריה':'משגב והסביבה',
  'שלומי':'משגב והסביבה','מעלות תרשיחא':'משגב והסביבה','מעלות':'משגב והסביבה',
  'כפר מנדא':'משגב והסביבה','עילבון':'משגב והסביבה','סחנין':'משגב והסביבה',
  'טמרה':'משגב והסביבה','מגאר':'משגב והסביבה','דיר חנא':'משגב והסביבה',
  'ראמה':'משגב והסביבה','בועינה':'משגב והסביבה','חורפיש':'משגב והסביבה',
  'פסוטה':'משגב והסביבה','כפר כנא':'משגב והסביבה','עצמון שגב':'משגב והסביבה',
  'כפר זיתים':'משגב והסביבה','אלון הגליל':'משגב והסביבה','ביר אלמכסור':'משגב והסביבה',
  // שומרון
  'אריאל':'שומרון','עלי':'שומרון','אלפי מנשה':'שומרון','קרני שומרון':'שומרון',
  'ברקן':'שומרון','עופרה':'שומרון','בית אל':'שומרון','שילה':'שומרון',
  'נופים':'שומרון','קדומים':'שומרון','כוכב יעקב':'שומרון','אלון מורה':'שומרון',
  'רחלים':'שומרון','איתמר':'שומרון','ברכה':'שומרון','עמנואל':'שומרון',
  'מתתיהו':'שומרון','נחליאל':'שומרון','כפר תפוח':'שומרון','גבע בנימין':'שומרון',
  'חיננית':'שומרון','מבוא שומרון':'שומרון','מעלה שומרון':'שומרון',
  'כפר אדומים':'שומרון','נוקדים':'שומרון','מעלה אדומים':'שומרון',
  'אלון':'שומרון','מצפה יריחו':'שומרון','גבעת אסף':'שומרון',
  // מודיעין
  'מודיעין':'מודיעין','מכבים':'מודיעין','רעות':'מודיעין','שוהם':'מודיעין',
  'מודיעין עילית':'מודיעין','לטרון':'מודיעין','כפר רות':'מודיעין',
  // חיפה
  'חיפה':'חיפה','טירת כרמל':'חיפה','נשר':'חיפה','קריית אתא':'חיפה',
  'קריית ביאליק':'חיפה','קריית מוצקין':'חיפה','קריית ים':'חיפה',
  'קריית חיים':'חיפה','עוספייה':'חיפה','דלית אל כרמל':'חיפה','עין הוד':'חיפה',
  // מועצה איזורית גזר
  'חשמונאים':'מועצה איזורית גזר','כפר מעש':'מועצה איזורית גזר',
  'בן שמן':'מועצה איזורית גזר','גינתון':'מועצה איזורית גזר',
  'נטעים':'מועצה איזורית גזר','מזור':'מועצה איזורית גזר',
  'כפר דניאל':'מועצה איזורית גזר','בית עריף':'מועצה איזורית גזר',
  // גוש עציון
  'אפרת':'גוש עציון','אלעזר':'גוש עציון','כפר עציון':'גוש עציון',
  'נווה דניאל':'גוש עציון','אלון שבות':'גוש עציון','תקוע':'גוש עציון',
  'קריית ארבע':'גוש עציון','הר גילה':'גוש עציון','מגדל עוז':'גוש עציון',
  'ראש צורים':'גוש עציון','פני הבר':'גוש עציון',
  // אשקלון
  'אשקלון':'אשקלון','שדרות':'אשקלון','נתיבות':'אשקלון','אופקים':'אשקלון',
  'מגן':'אשקלון','ניר עם':'אשקלון','תקומה':'אשקלון','ברור חיל':'אשקלון',
  'רעים':'אשקלון','בארי':'אשקלון','כפר עזה':'אשקלון','נחל עוז':'אשקלון',
  'עלומים':'אשקלון','צאלים':'אשקלון','גבעתי':'אשקלון',
  // באר שבע
  'באר שבע':'באר שבע','דימונה':'באר שבע','ירוחם':'באר שבע',
  'מצפה רמון':'באר שבע','ערד':'באר שבע','להבים':'באר שבע','עומר':'באר שבע',
  'מיתר':'באר שבע','תל שבע':'באר שבע','ראהט':'באר שבע','לקיה':'באר שבע',
  'חורה':'באר שבע','שגב שלום':'באר שבע','כסייפה':'באר שבע','שדה בוקר':'באר שבע',
  'נבטים':'באר שבע','כרמים':'באר שבע',
  // בית שמש
  'בית שמש':'בית שמש','צרעה':'בית שמש','זנוח':'בית שמש','עגור':'בית שמש',
  'הר טוב':'בית שמש','אמציה':'בית שמש','לכיש':'בית שמש',
  'כפר מנחם':'בית שמש','שריגים':'בית שמש',
};

// Normalize Hebrew: remove extra spaces, handle merged words
function normalizeHebrew(s) {
  return String(s||'').trim()
    .replace(/\s+/g,' ')
    .replace(/[׳']/g,"'");
}

// Split merged Hebrew text into candidate words
// e.g. "אלוןכפר אדומים" → ["אלון","כפר אדומים","אלוןכפר","אדומים"]
function splitMerged(text) {
  const candidates = [text];
  // Try splitting at every possible position
  for (let i=2; i<text.length-1; i++) {
    const a = text.slice(0,i).trim();
    const b = text.slice(i).trim();
    if (a.length>1) candidates.push(a);
    if (b.length>1) candidates.push(b);
  }
  return candidates;
}

function classifyArea(rawAddress) {
  if (!rawAddress) return '';
  const address = normalizeHebrew(rawAddress);

  // Strategy 1: last token after comma = city name (most reliable for "רחוב 5, עיר")
  const parts = address.split(',').map(s=>s.trim()).filter(Boolean);
  for (let i = parts.length-1; i >= 0; i--) {
    const city = parts[i].trim();
    // Try exact match
    if (CITY_TO_AREA[city]) return CITY_TO_AREA[city];
    // Try removing street number: "הדסים 17" → check each word
    for (const word of city.split(' ')) {
      if (word.length>2 && CITY_TO_AREA[word]) return CITY_TO_AREA[word];
    }
  }

  // Strategy 2: scan every word in the full address (longest first)
  const words = address.split(/[\s,]+/).filter(w=>w.length>1);
  const sortedCities = Object.keys(CITY_TO_AREA).sort((a,b)=>b.length-a.length);
  for (const city of sortedCities) {
    if (address.includes(city)) return CITY_TO_AREA[city];
  }

  // Strategy 3: handle merged cells — try splitting merged text
  const noSpaces = address.replace(/\s/g,'').replace(/,/g,'');
  for (const city of sortedCities) {
    const cityNoSpace = city.replace(/\s/g,'');
    if (noSpaces.includes(cityNoSpace)) return CITY_TO_AREA[city];
  }

  return '';
}

// Keep AREAS for the filter dropdown (unused in classifier now)
const AREAS = { "ירושלים":
['ירושלים','jerusalem','בית הכרם','מלחה','גילה','רמות','פסגת זאב','הר נוף',
    'קטמון','בקעה','טלביה','רחביה','עין כרם','ארנונה','גוננים','קריית יובל',
    'שעריים','מוצא','בית זית','מטה יהודה','אבו גוש','בית מאיר','בית נקופה',
    'קריית ענבים','מעלה החמישה','עמינדב','צור הדסה','הר אדר','גבעת זאב','גבעון',
    'נבי שמואל','ביתר עילית'
  ],
  'עמק יזרעאל': [
    'עמק יזרעאל','עפולה','מגדל העמק','נוף הגליל','נצרת עילית','כפר יהושע',
    'מרחביה','גבע','עין חרוד','יזרעאל','גדעונה','תל יוסף','עין דור','נהלל',
    'כפר ברוך','שדה יעקב','גינגר','בית שאן','קיבוץ גן שמואל','גבעת אלונים',
    'יפעת','גניגר','כפר גדעון','בית לחם הגלילית','דבורייה'
  ],
  'גבעת שמואל + פתח תקווה': [
    'גבעת שמואל','פתח תקווה','פ"ת','כפר סבא','הוד השרון','קלנסווה',
    'טייבה','טירה','רמת השרון','כפר מל"ל','נחלת יהודה','ראש העין',
    'פתח-תקווה','פתח תקוה'
  ],
  'גבעתיים ורמת גן': [
    'גבעתיים','רמת גן','בני ברק','קריית אונו','אור יהודה','בת ים','חולון',
    'רמת עם','גני תקווה'
  ],
  'זכרון והסביבה': [
    'זכרון','זכרון יעקב','בנימינה','פרדס חנה','כרכור','גבעת עדה','עמיקם',
    'רמת הנדיב','עין כרמל','דור','נחשולים','גבעת נילי','אם חיפה','פרדסייה'
  ],
  'ראשון לציון': [
    'ראשון לציון','ראשל"צ','ראשון','נס ציונה','גן יבנה','יבנה','באר יעקב',
    'צריפין','ראשון לצион'
  ],
  'תל אביב': [
    'תל אביב','ת"א','יפו','נווה צדק','פלורנטין','הצפון הישן','לב תל אביב',
    'רמת אביב','הכרם','נחלת בנימין','מונטיפיורי','רמת החייל','צהלה',
    'אפקה','גן העיר','נורדיה','גבעת שרת','רמת ישי','כרם התימנים',
    'שכונת התקווה','עזרא','שפירא','נווה שרת','שכונת המשתלה'
  ],
  'רעננה': [
    'רעננה','הרצליה','כפר שמריהו','נורדיה','כפר נטר','אבן יהודה',
    'צור יגאל','תל מונד','עמק חרוד'
  ],
  'שפלה': [
    'שפלה','לוד','רמלה','קריית גת','קריית מלאכי','גדרה','רחובות',
    'נס ציונה','מזכרת בתיה','גן יבנה','קיבוץ גלויות','פדיה','חולדה',
    'עקרון','ירוחם רגב','בית דגן','סגולה','מושב שפיר','מושב נחם'
  ],
  'לב השרון עמק חפר והסביבה': [
    'עמק חפר','לב השרון','נתניה','חדרה','קיסריה','קדימה','צורן','מכמורת',
    'בית יצחק','שרון','אלישמע','עין שריג','קדימה צורן','ניצני עוז',
    'כפר חיים','מעברות','עין ורד','גבעת חיים','משמר השרון','תל יצחק',
    'גן חיים','כפר ויתקין','גבעת שפירא','בית חנניה','עין חמד','פרדס חנה',
    'זיכרון','אלוני יצחק','בית זייד','גן שמואל','חפר','עמק'
  ],
  'משגב והסביבה': [
    'משגב','כרמיאל','עכו','נהריה','שלומי','מעלות','מעלות תרשיחא',
    'כפר מנדא','עילבון','סח\'נין','ערב','טמרה','יוטבת','מגאר',
    'דיר חנא','ראמה','בועינה','כאוכב','ביר אלמכסור','עצמון שגב',
    'כמון','חורפיש','פסוטה','מגדל','כפר כנא'
  ],
  'שומרון': [
    'שומרון','אריאל','עלי','אלפי מנשה','קרני שומרון','ברקן','עופרה',
    'בית אל','שילה','מעלה לבונה','תפוח','נופים','קדומים','ימין אורד',
    'חרמש','כוכב יעקב','אלון מורה','גבע בנימין','גבעות עולם',
    'כפר תפוח','מעלה שומרון','רחלים','איתמר','ברכה','חווארה',
    'יצהר','מגדל שמס','חיננית','מבוא שומרון','עמנואל','מתתיהו',
    'נחליאל','בית חורון','גבעון החדשה','נעלה','כפר חורש'
  ],
  'מודיעין': [
    'מודיעין','מכבים','רעות','שוהם','מודיעין עילית','לטרון',
    'שלת','מחסיה','כסלון','בית מאיר','כפר רות'
  ],
  'חיפה': [
    'חיפה','טירת כרמל','נשר','קריית אתא','קריית ביאליק','קריית מוצקין',
    'קריית ים','קריית חיים','חוף הכרמל','עוספייה','דלית אל כרמל',
    'עין הוד','בת גלים','הדר הכרמל','נווה שאנן','רמת שפרינצק',
    'רמות רמז','הכרמל','כרמל','קריית שפרינצק','גב ים','רמת ויצמן'
  ],
  'מועצה איזורית גזר': [
    'גזר','חשמונאים','כפר מעש','בן שמן','גינתון','אחיסמך','נטעים',
    'מזור','כפר דניאל','בית עריף','בית נחמיה','שדה וורבורג','ניר צבי',
    'כפר שילוח','אחיסמך','אחיטוב','כפר בן נון'
  ],
  'גוש עציון': [
    'גוש עציון','אפרת','אלעזר','כפר עציון','נווה דניאל','אלון שבות',
    'תקוע','בית לחם','קריית ארבע','הר גילה','רש צורים','פני הבר',
    'מגדל עוז','שדמות','גבעת עוז','ביתר עילית','בית שמש','בית מאיר',
    'צור הדסה','מאלה אדומים','מעלה אדומים','בית ג\'לה'
  ],
  'אשקלון': [
    'אשקלון','שדרות','נתיבות','אופקים','קריית גת','מגן','ניר עם',
    'ניר עוז','עין הבשור','תקומה','ברור חיל','רעים','בארי','כפר עזה',
    'נחל עוז','עלומים','גבים','ישראל','אבשלום','מפלסים','משמר הנגב',
    'גן יבנה','גבעתי','צאלים'
  ],
  'באר שבע': [
    'באר שבע','דימונה','ירוחם','מצפה רמון','ערד','להבים','עומר',
    'כרמים','מיתר','הר הנגב','תל שבע','ראהט','שגב שלום','כסייפה',
    'ביר הדאג\'','לקיה','חורה','אבו תלול','אשחר','גבעות בר',
    'כרמים','נבטים','שדה בוקר','מצפה רמון'
  ],
  'בית שמש': [
    'בית שמש','צרעה','זנוח','עגור','נחם','הר טוב','מחסיה',
    'אמציה','לכיש','כפר מנחם','גת','שריגים','גן הדרום'
  ],
};



// ---- PHONE ----
function normPhone(p) {
  if (!p) return '';
  let s = String(p).replace(/\D/g,'');
  if (s.startsWith('0')) s = '972'+s.slice(1);
  if (!s.startsWith('972')) s = '972'+s;
  return s;
}

// ---- API — GET only, small payloads ----
// GET for small calls (read/update), POST for large payloads (import)
async function api(params, usePost) {
  let res;
  if (usePost) {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // text/plain avoids CORS preflight
      body: JSON.stringify(params),
      redirect: 'follow',
    });
  } else {
    res = await fetch(cfg.url + '?' + new URLSearchParams(params).toString(), { redirect: 'follow' });
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { throw new Error('Bad response: ' + text.slice(0,100)); }
}

// ---- LOAD DATA ----
const CACHE_KEY = 'vdash_rows';
const CACHE_TS  = 'vdash_ts';

async function loadData(silent) {
  if (!LIVE) { allRows = demoData(); applyFilters(); updateCount(); return; }

  // Show cached data instantly
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      allRows = JSON.parse(cached);
      applyFilters();
      updateCount(true);
    } catch(e) { localStorage.removeItem(CACHE_KEY); }
  } else {
    // No cache — show skeleton
    renderTable();
    document.getElementById('countLabel').textContent = 'טוען...';
  }

  // Fetch fresh
  try {
    const j = await api({ action:'read', sheet: cfg.sheet||'DATABASE' });
    if (j.rows) {
      allRows = j.rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
      localStorage.setItem(CACHE_KEY, JSON.stringify(allRows));
      localStorage.setItem(CACHE_TS,  Date.now().toString());
      applyFilters();
      updateCount(false);
    } else {
      showToast('שגיאה: ' + (j.error||'תשובה לא תקינה'));
      document.getElementById('countLabel').textContent = 'שגיאה';
    }
  } catch(e) {
    console.error('loadData error:', e);
    document.getElementById('countLabel').textContent = cached ? 'cache בלבד' : 'שגיאת חיבור';
    if (!cached) showToast('לא ניתן להתחבר לגיליון — בדוק ⚙️');
  }
}

function updateCount(stale) {
  const el = document.getElementById('countLabel');
  el.textContent = `${allRows.length} בקשות`;
  if (stale) {
    const ts = localStorage.getItem(CACHE_TS);
    if (ts) {
      const mins = Math.round((Date.now() - parseInt(ts)) / 60000);
      el.textContent += ` · עודכן לפני ${mins < 1 ? 'פחות מדקה' : mins + ' דק'}`;
    }
  }
}

// ---- FILTERS ----
function applyFilters() {
  const area   = document.getElementById('filterArea').value;
  const status = document.getElementById('filterStatus').value;
  const search = document.getElementById('filterSearch').value.toLowerCase().trim();
  filteredRows = allRows.filter(row => {
    if (area   && row[C.area]   !== area)   return false;
    if (status && row[C.status] !== status) return false;
    if (search) {
      const hay = [row[C.title],row[C.address],row[C.name],row[C.area]].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
  const fc = document.getElementById('filterCount');
  fc.textContent = filteredRows.length === allRows.length
    ? `${allRows.length} בקשות`
    : `${filteredRows.length} מתוך ${allRows.length}`;
  if (currentView==='table') renderTable();
  if (currentView==='map')   renderPins();
}

// ---- TABLE ----
function renderTable() {
  const tbody = document.getElementById('tableBody');

  // Still loading (no cache, no data yet)
  if (!allRows.length) {
    tbody.innerHTML = Array(7).fill(0).map(()=>`
      <tr class="skeleton-row">
        <td><span class="skel skel-lg"></span></td>
        <td><span class="skel skel-md"></span></td>
        <td><span class="skel skel-sm"></span></td>
        <td><span class="skel skel-md"></span></td>
        <td><span class="skel skel-sm"></span></td>
        <td><span class="skel skel-md"></span></td>
        <td><span class="skel skel-sm"></span></td>
        <td></td>
      </tr>`).join('');
    return;
  }

  if (!filteredRows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:60px;color:#8a8278">לא נמצאו בקשות</td></tr>';
    return;
  }
  tbody.innerHTML = filteredRows.map((row, i) => {
    const ph   = String(row[C.phone]   || '');
    const link = String(row[C.link]    || '');
    const np   = normPhone(ph);
    const addr = encodeURIComponent(String(row[C.address]||''));
    const safeLink = link.replace(/'/g, "\\'");
    const safePh   = ph.replace(/'/g, "\\'");
    return `<tr id="row-${i}">
      <td><span class="cell-text"><strong>${esc(row[C.title])}</strong></span></td>
      <td><span class="cell-text" style="color:#5a5248">${esc(row[C.address])}</span></td>
      <td><span class="cell-text" style="color:#5a5248">${esc(row[C.area])}</span></td>
      <td><span class="cell-text">${esc(row[C.name])}</span></td>
      <td><span class="cell-text" style="direction:ltr;text-align:right;color:#5a5248">${esc(ph)}</span></td>
      <td>
        <select class="inline-select status-select status-${(STATUS_BADGE[row[C.status]]||'badge-none').replace('badge-','')}" onchange="inlineSave(${i},'status',this.value);this.className='inline-select status-select status-'+(window.STATUS_BADGE[this.value]||'badge-none').replace('badge-','')">
          <option value="" ${!row[C.status]?'selected':''}>— ללא —</option>
          ${['צריך מתנדבים דחוף','בטיפול','בבדיקה עם מתנדבים','טופל','לא רלוונטי']
            .map(s=>`<option value="${s}" ${row[C.status]===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <input class="inline-input" value="${esc(row[C.responsible]||'')}" placeholder="אחראי..."
          onblur="inlineSave(${i},'responsible',this.value)"
          onkeydown="if(event.key==='Enter'){this.blur()}">
      </td>
      <td class="actions-cell">
        ${link?`<button class="tbl-btn tbl-link" onclick="copyText('${safeLink}','קישור הועתק')" title="העתק קישור רישום">🔗</button>`:''}
        ${ph?`<button class="tbl-btn" onclick="copyText('${safePh}','טלפון הועתק')" title="העתק טלפון">📋</button>`:''}
        ${np?`<button class="tbl-btn" onclick="window.open('https://wa.me/${np}','_blank')" title="WhatsApp">💬</button>`:''}
        ${row[C.address]?`<button class="tbl-btn" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${addr}','_blank')" title="ניווט">🧭</button>`:''}
        <button class="tbl-btn tbl-open" onclick="openModal(${i})" title="פתח">✎</button>
      </td>
    </tr>`;
  }).join('');
}

// ---- INLINE SAVE ----
async function inlineSave(idx, field, value) {
  const row = filteredRows[idx];
  if (!row) return;
  const prev = field==='status' ? row[C.status] : row[C.responsible];
  if (String(value) === String(prev||'')) return;

  if (field==='status')      row[C.status]      = value;
  if (field==='responsible') row[C.responsible] = value;

  if (!LIVE) { flashRow(idx); return; }

  const rowIndex = allRows.indexOf(row) + 2;
  try {
    const params = { action:'update', sheet:cfg.sheet||'DATABASE', row:rowIndex, t:new Date().toLocaleString('he-IL') };
    if (field==='status')      params.s = value;
    if (field==='responsible') params.r = value;
    const j = await api(params);
    if (j.success) { flashRow(idx); }
    else { showToast('שגיאה: '+(j.error||'')); row[C.status]=prev; row[C.responsible]=prev; renderTable(); }
  } catch(e) { showToast('שגיאת חיבור'); }
}
function flashRow(idx) {
  const el = document.getElementById('row-'+idx);
  if (el) { el.classList.remove('row-saved'); void el.offsetWidth; el.classList.add('row-saved'); }
}

// ---- MODAL ----
function openModal(idx) {
  const row = filteredRows[idx];
  if (!row) return;
  currentRow = { row, idx };

  setText('modalTitle', row[C.title]);
  setText('d-desc',    row[C.desc]);
  setText('d-address', row[C.address]);
  setText('d-area',    row[C.area]);
  setText('d-name',    row[C.name]);
  setText('d-phone',   row[C.phone]);
  setText('d-created', row[C.created]);
  setText('d-internal',row[C.internalNotes]);

  const badge = document.getElementById('modalStatusBadge');
  badge.className = 'badge '+(STATUS_BADGE[row[C.status]]||'badge-none');
  badge.textContent = row[C.status]||'ללא סטטוס';

  const linkEl = document.getElementById('d-link');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  if (row[C.link]) {
    linkEl.innerHTML = `<a href="${esc(row[C.link])}" target="_blank" style="color:var(--green)">${esc(row[C.link]).slice(0,45)}${row[C.link].length>45?'…':''}</a>`;
    copyLinkBtn.style.display='inline-flex';
    copyLinkBtn.onclick = ()=>copyText(row[C.link],'קישור הועתק');
  } else { linkEl.textContent='—'; copyLinkBtn.style.display='none'; }

  const np = normPhone(row[C.phone]);
  document.getElementById('d-wa').onclick   = () => np ? window.open('https://wa.me/'+np,'_blank') : showToast('אין טלפון');
  document.getElementById('d-nav').onclick  = () => row[C.address] ? window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(row[C.address]),'_blank') : showToast('אין כתובת');
  document.getElementById('d-copy').onclick = () => copyText(row[C.phone],'טלפון הועתק');

  document.getElementById('e-status').value      = row[C.status]||'';
  document.getElementById('e-responsible').value = row[C.responsible]||'';
  document.getElementById('e-notes').value        = row[C.volNotes]||'';
  document.getElementById('saveMsg').textContent  = '';

  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- MODAL SAVE ----
async function saveChanges() {
  if (!currentRow) return;
  const { row, idx } = currentRow;
  const btn = document.getElementById('saveBtn');
  const msg = document.getElementById('saveMsg');
  const ns  = document.getElementById('e-status').value;
  const nr  = document.getElementById('e-responsible').value;
  const nn  = document.getElementById('e-notes').value;

  btn.disabled=true; btn.textContent='שומר...';
  msg.textContent=''; msg.className='save-msg';

  if (!LIVE) {
    row[C.status]=ns; row[C.responsible]=nr; row[C.volNotes]=nn;
    await sleep(300); renderTable();
    btn.disabled=false; btn.textContent='💾 שמור שינויים';
    msg.textContent='✓ נשמר (הדגמה)'; msg.className='save-msg save-ok'; return;
  }

  try {
    const rowIndex = allRows.indexOf(row) + 2;
    const t = new Date().toLocaleString('he-IL');
    const j = await api({ action:'update', sheet:cfg.sheet||'DATABASE', row:rowIndex, s:ns, r:nr, n:nn, t });
    if (j.success) {
      row[C.status]=ns; row[C.responsible]=nr; row[C.volNotes]=nn; row[C.updated]=t;
      document.getElementById('modalStatusBadge').className='badge '+(STATUS_BADGE[ns]||'badge-none');
      document.getElementById('modalStatusBadge').textContent=ns||'ללא סטטוס';
      renderTable(); flashRow(idx);
      msg.textContent='✓ נשמר בהצלחה'; msg.className='save-msg save-ok';
    } else throw new Error(j.error||'שגיאה');
  } catch(e) { msg.textContent='✗ '+e.message; msg.className='save-msg save-err'; }
  btn.disabled=false; btn.textContent='💾 שמור שינויים';
}

// ---- IMPORT ----
function openImport() {
  document.getElementById('importOverlay').classList.remove('hidden');
  document.getElementById('importMsg').innerHTML = '';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('doImportBtn').style.display = 'none';
  document.getElementById('fileDropLabel').textContent = 'לחץ או גרור קובץ Excel לכאן';
  document.getElementById('importFile').value = '';
  window._importRows = null;
  document.body.style.overflow = 'hidden';
}
function closeImport() {
  document.getElementById('importOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function processFile(file) {
  if (!file) return;
  document.getElementById('fileDropLabel').textContent = '⏳ קורא...';
  document.getElementById('importMsg').innerHTML = '';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('doImportBtn').style.display = 'none';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      if (typeof XLSX === 'undefined') { showToast('SheetJS לא נטען, רענן את הדף'); return; }
      const wb  = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      if (raw.length < 2) { document.getElementById('importMsg').textContent='הקובץ ריק'; return; }
      parseAndPreview(raw);
    } catch(err) {
      document.getElementById('importMsg').innerHTML = `<span style="color:#b83232">שגיאה בקריאה: ${err.message}</span>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseAndPreview(raw) {
  const headers = raw[0].map(h => String(h||'').trim());
  const dataRows = raw.slice(1).filter(r => r.some(c => String(c).trim() !== ''));

  function col(...names) {
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  }

  const CI = {
    title:   col('כותרת'),
    desc:    col('תיאור'),
    loc:     col('מיקום'),
    notes:   col('הערות'),
    contact: col('פרטי איש קשר','פרטי מבקש'),
    link:    col('קישור למשימה'),
  };

  const mapped = dataRows.map(r => {
    const contactRaw = CI.contact >= 0 ? String(r[CI.contact]||'') : '';
    const parts = contactRaw.split(',').map(s=>s.trim());
    let phone = (parts[1]||'').replace(/[\s\-\+]/g,'');
    if (phone.startsWith('972')) phone = '0'+phone.slice(3);
    const address = CI.loc >= 0 ? String(r[CI.loc]||'') : '';
    return {
      id:    'IMP-'+Date.now()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),
      title: CI.title>=0 ? String(r[CI.title]||'') : '',
      desc:  CI.desc>=0  ? String(r[CI.desc]||'')  : '',
      address,
      area:  classifyArea(address),
      contactName: parts[0]||'',
      phone,
      status:'', link: CI.link>=0 ? String(r[CI.link]||'') : '',
      responsible:'', volNotes: CI.notes>=0 ? String(r[CI.notes]||'') : '',
      internalNotes:'', sys1:'', sys2:'',
      created: new Date().toLocaleDateString('he-IL'), updated:'',
    };
  });

  // Dedup
  const existLinks = new Set(allRows.map(r=>r[C.link]).filter(Boolean));
  const existKeys  = new Set(allRows.map(r=>(String(r[C.title])+'|'+String(r[C.address])).toLowerCase().trim()));
  const newRows = mapped.filter(r => {
    if (r.link && existLinks.has(r.link)) return false;
    if (existKeys.has((r.title+'|'+r.address).toLowerCase().trim())) return false;
    return !!r.title;
  });

  window._importRows = newRows;
  const dup    = mapped.length - newRows.length;
  const noArea = newRows.filter(r=>!r.area).length;

  document.getElementById('fileDropLabel').textContent = `✓ ${mapped.length} שורות`;
  document.getElementById('importMsg').innerHTML =
    `<span style="color:#4a7c59">✓ ${mapped.length} שורות בקובץ</span> &nbsp;·&nbsp; `+
    `<strong style="color:#4a7c59">${newRows.length} חדשות לייבוא</strong> &nbsp;·&nbsp; `+
    `<span style="color:#8a8278">${dup} כפולות</span>`+
    (noArea ? ` &nbsp;·&nbsp; <span style="color:#c4621a">${noArea} ללא אזור</span>` : '');

  if (!newRows.length) {
    document.getElementById('importPreview').innerHTML = '<p style="text-align:center;padding:20px;color:#4a7c59">✓ אין בקשות חדשות</p>';
    return;
  }

  document.getElementById('importPreview').innerHTML =
    `<table class="requests-table" style="font-size:12px">
      <thead><tr><th>כותרת</th><th>כתובת</th><th>אזור</th><th>שם</th><th>טלפון</th></tr></thead>
      <tbody>${newRows.slice(0,10).map(r=>`<tr>
        <td><span class="cell-text">${esc(r.title)}</span></td>
        <td><span class="cell-text">${esc(r.address)}</span></td>
        <td><span class="cell-text">${r.area?`<span style="color:#4a7c59">${esc(r.area)}</span>`:`<span style="color:#c4621a">לא סווג</span>`}</span></td>
        <td><span class="cell-text">${esc(r.contactName)}</span></td>
        <td><span class="cell-text" style="direction:ltr">${esc(r.phone)}</span></td>
      </tr>`).join('')}</tbody>
    </table>`+
    (newRows.length>10?`<p style="font-size:12px;color:#8a8278;padding:8px 12px">...ועוד ${newRows.length-10}</p>`:'');

  const btn = document.getElementById('doImportBtn');
  btn.style.display = 'block';
  btn.textContent   = `📥 ייבא ${newRows.length} בקשות חדשות`;
}

// ---- DO IMPORT — uses POST to handle large payloads ----
async function doImport() {
  const rows = window._importRows;
  if (!rows||!rows.length) return;
  const btn = document.getElementById('doImportBtn');
  const msg = document.getElementById('importMsg');
  btn.disabled = true;

  if (!LIVE) {
    rows.forEach(r => allRows.push([r.id,r.title,r.desc,r.address,r.area,r.contactName,r.phone,r.status,r.link,r.responsible,r.volNotes,r.internalNotes,r.sys1,r.sys2,r.created,r.updated]));
    applyFilters(); updateCount();
    msg.innerHTML = `<span style="color:#4a7c59">✓ יובאו ${rows.length} בקשות (הדגמה)</span>`;
    btn.style.display='none'; return;
  }

  // POST in batches of 50 rows — no URL length limit
  const BATCH = 50;
  let done = 0;
  try {
    for (let i = 0; i < rows.length; i += BATCH) {
      btn.textContent = `מייבא... ${done}/${rows.length}`;
      const batch = rows.slice(i, i+BATCH).map(r =>
        [r.id,r.title,r.desc,r.address,r.area,r.contactName,r.phone,r.status,
         r.link,r.responsible,r.volNotes,r.internalNotes,r.sys1,r.sys2,r.created,r.updated]
      );
      const j = await api(
        { action:'import', sheet: cfg.sheet||'DATABASE', rows: batch },
        true // usePost
      );
      if (!j.success) throw new Error(j.error||'שגיאה');
      done += batch.length;
    }
    msg.innerHTML = `<span style="color:#4a7c59">✓ יובאו ${done} בקשות בהצלחה! 🎉</span>`;
    btn.style.display = 'none';
    loadData();
  } catch(e) {
    msg.innerHTML = `<span style="color:#b83232">✗ ${e.message}</span>`;
    btn.disabled=false; btn.textContent='נסה שוב';
  }
}

// ---- MAP ----
function setView(v) {
  currentView = v;
  document.getElementById('tableView').classList.toggle('hidden', v!=='table');
  document.getElementById('mapView').classList.toggle('hidden',  v!=='map');
  document.getElementById('btnTable').classList.toggle('active', v==='table');
  document.getElementById('btnMap').classList.toggle('active',   v==='map');
  if (v==='map') initMap();
}
function initMap() {
  const go = () => {
    if (!mapObj) { mapObj=L.map('map',{center:[31.8,35.0],zoom:8}); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapObj); }
    renderPins();
  };
  if (typeof L!=='undefined') { go(); return; }
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css);
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=go;document.head.appendChild(s);
}
async function renderPins() {
  if (!mapObj) return;
  mapMarkers.forEach(m=>m.remove()); mapMarkers=[];
  for (const row of filteredRows) {
    if (!row[C.address]) continue;
    try {
      const g=await geocode(row[C.address]); if(!g)continue;
      const color=STATUS_COLOR[row[C.status]]||'#7a7468';
      const icon=L.divIcon({className:'',html:`<div style="width:13px;height:13px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,.3)"></div>`,iconSize:[13,13],iconAnchor:[6,6]});
      const m=L.marker([g.lat,g.lon],{icon}).addTo(mapObj);
      const ri=filteredRows.indexOf(row); m.on('click',()=>openModal(ri)); mapMarkers.push(m);
    } catch(e){}
  }
}
const gcCache={};
async function geocode(address) {
  if (gcCache[address]) return gcCache[address];
  const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address+', Israel')}&format=json&limit=1`);
  const d=await r.json(); if(d&&d[0]){gcCache[address]={lat:+d[0].lat,lon:+d[0].lon};return gcCache[address];} return null;
}

// ---- CONFIG ----
function openConfig() { document.getElementById('cfg-url').value=cfg.url||''; document.getElementById('cfg-sheet').value=cfg.sheet||'DATABASE'; document.getElementById('configOverlay').classList.remove('hidden'); }
function closeConfig() { document.getElementById('configOverlay').classList.add('hidden'); }
function saveConfig() {
  cfg.url=document.getElementById('cfg-url').value.trim(); cfg.sheet=document.getElementById('cfg-sheet').value.trim()||'DATABASE';
  localStorage.setItem(CFG_KEY,JSON.stringify(cfg)); closeConfig(); showToast('נשמר, מרענן...'); setTimeout(()=>location.reload(),600);
}

// ---- UTILS ----
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v||'—';}
function copyText(text,msg){if(!text){showToast('אין מה להעתיק');return;}navigator.clipboard.writeText(String(text)).then(()=>showToast(msg||'הועתק'));}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ---- DEMO DATA ----
function demoData(){return[
  [1,'עזרה בקניות','קשישה לבד','הרצל 14, רעננה','רעננה','רחל כהן','052-1234567','צריך מתנדבים דחוף','https://example.com/1','','','','','','12/03/2024',''],
  [2,'תיקון ברז','ברז דולף','אלנבי 8, תל אביב','תל אביב','משה לוי','053-7654321','בטיפול','https://example.com/2','דניאל כהן','בדרך','','','','11/03/2024','12/03/2024'],
  [3,'הסעה לרופא','הסעה לקופ"ח','הנשיא 22, חיפה','חיפה','שרה גולד','054-1111222','בבדיקה עם מתנדבים','','','','','','','10/03/2024',''],
  [4,'תרופות דחופות','חולה','בן גוריון 5, ירושלים','ירושלים','יוסף אביב','050-9876543','צריך מתנדבים דחוף','','','','','','','13/03/2024',''],
  [5,'ניקיון בית','עזרה בניקיון','הדקל 15, נופים','שומרון','מיכל בר','052-3334455','','','','','','','','09/03/2024',''],
];}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  // Import button
  document.getElementById('importBtn').addEventListener('click', openImport);

  // File drop zone
  const drop  = document.getElementById('fileDrop');
  const input = document.getElementById('importFile');
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if(input.files[0]) processFile(input.files[0]); });
  drop.addEventListener('dragover',  e=>{e.preventDefault();drop.classList.add('drag-over');});
  drop.addEventListener('dragleave', ()=>drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e=>{e.preventDefault();drop.classList.remove('drag-over');if(e.dataTransfer.files[0])processFile(e.dataTransfer.files[0]);});

  // Close buttons
  document.getElementById('modalCloseBtn').addEventListener('click',  closeModal);
  document.getElementById('importCloseBtn').addEventListener('click', closeImport);
  document.getElementById('configCloseBtn').addEventListener('click', closeConfig);

  // Overlay background click
  document.getElementById('modalOverlay').addEventListener('click',  e=>{if(e.target===e.currentTarget)closeModal();});
  document.getElementById('importOverlay').addEventListener('click', e=>{if(e.target===e.currentTarget)closeImport();});
  document.getElementById('configOverlay').addEventListener('click', e=>{if(e.target===e.currentTarget)closeConfig();});

  // ESC
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){closeModal();closeImport();closeConfig();document.body.style.overflow='';}
  });

  loadData();
  setInterval(loadData, 60000);
  if (!LIVE) showToast('מצב הדגמה — לחץ ⚙️ לחיבור');
});
