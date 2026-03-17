// ============================================================
//  GOOGLE APPS SCRIPT — Volunteer Dashboard Backend
//
//  SETUP STEPS:
//  1. Open your Google Sheet
//  2. Extensions → Apps Script
//  3. Delete everything, paste this whole file
//  4. Click Save
//  5. Run: setupSheet() once  (Run menu → Run function → setupSheet)
//  6. Deploy → New deployment → Web App
//     Execute as: Me  |  Who has access: Anyone
//  7. Copy the URL → paste into setup.sh
// ============================================================

const SHEET_NAME = 'DATABASE';

// ============================================================
//  RUN THIS ONCE — builds headers, validation, sample rows
// ============================================================
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const headers = [
    'מזהה','כותרת','תיאור','כתובת','אזור',
    'שם מבקש סיוע','טלפון','סטטוס','קישור למשימה',
    'אחראי משימה','הערות מתנדבים','הערות פנימיות',
    'הערות מערכת 1','הערות מערכת 2','תאריך יצירה','עדכון אחרון'
  ];

  // Headers
  const hr = sheet.getRange(1, 1, 1, headers.length);
  hr.setValues([headers])
    .setBackground('#1a1f2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('right');
  sheet.setFrozenRows(1);
  sheet.setRightToLeft(true);

  // Column widths
  [60,200,300,200,150,150,120,160,200,150,250,250,250,250,120,120]
    .forEach((w,i) => sheet.setColumnWidth(i+1, w));

  // Status dropdown validation
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['צריך מתנדבים דחוף','בטיפול','בבדיקה עם מתנדבים','טופל','לא רלוונטי'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 8, 1000, 1).setDataValidation(rule);

  // Conditional formatting by status
  const cfRange = sheet.getRange(2, 8, 1000, 1);
  const cfRules = [
    ['צריך מתנדבים דחוף','#fce8e8','#c0392b'],
    ['בטיפול','#e8f0fe','#1a73e8'],
    ['בבדיקה עם מתנדבים','#fef3e2','#e37400'],
    ['טופל','#e6f4ea','#137333'],
    ['לא רלוונטי','#f1f3f4','#5f6368'],
  ].map(([val,bg,fg]) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(val).setBackground(bg).setFontColor(fg)
      .setRanges([cfRange]).build()
  );
  sheet.setConditionalFormatRules(cfRules);

  // Sample rows
  const now = new Date().toLocaleDateString('he-IL');
  sheet.getRange(2,1,3,16).setValues([
    [1,'עזרה בקניות','קשישה לבד זקוקה לעזרה בקניות','הרצל 1, תל אביב','תל אביב','ישראל ישראלי','050-1234567','צריך מתנדבים דחוף','','','','','','',now,''],
    [2,'תיקון ברז','ברז דולף בשירותים','בן גוריון 5, חיפה','חיפה','שרה כהן','052-9876543','בטיפול','','דניאל מזרחי','בדרך אליו','','','',now,now],
    [3,'הסעה לרופא','טיפולים כימו פעמיים בשבוע','הנשיא 10, ירושלים','ירושלים','משה לוי','054-5556666','טופל','','נועה ברק','טופל','','','',now,now],
  ]);

  SpreadsheetApp.getUi().alert('✅ הגיליון הוכן!\n\nעכשיו:\nDeploy → New deployment → Web App\nExecute as: Me | Access: Anyone\nהעתק את ה-URL לתוך setup.sh');
}

// ============================================================
//  HTTP API
// ============================================================
function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  try {
    const p = e.postData ? JSON.parse(e.postData.contents) : (e.parameter || {});
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(p.sheet || SHEET_NAME);
    if (!sheet) return out({ error: 'Sheet not found' });

    if (p.action === 'read') {
      return out({ rows: sheet.getDataRange().getValues() });
    }

    if (p.action === 'update') {
      const row = parseInt(p.row);
      if (row < 2) return out({ error: 'Invalid row' });
      const ALLOWED = [8, 10, 11, 16]; // status, responsible, vol notes, last update
      for (const [col, val] of Object.entries(p.data)) {
        if (!ALLOWED.includes(+col)) return out({ error: 'Col '+col+' is read-only' });
        sheet.getRange(row, +col).setValue(val || '');
      }
      return out({ success: true });
    }

    return out({ error: 'Unknown action' });
  } catch(err) {
    return out({ error: err.toString() });
  }
}

function out(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
