// ============================================================
//  GOOGLE APPS SCRIPT — Volunteer Dashboard
//
//  SETUP:
//  1. Extensions → Apps Script → paste this → Save
//  2. Run → setupSheet (once only, builds headers + sample data)
//  3. Deploy → New deployment → Web App
//     Execute as: Me | Who has access: Anyone
//  4. Copy the URL → already in your app.js
//
//  REDEPLOY after any code change:
//  Deploy → Manage deployments → pencil → New version → Deploy
// ============================================================

const SHEET_NAME = 'DATABASE';

// ---- RUN ONCE: builds the sheet ----
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

  const hr = sheet.getRange(1, 1, 1, headers.length);
  hr.setValues([headers])
    .setBackground('#1a1f2e').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('right');
  sheet.setFrozenRows(1);
  sheet.setRightToLeft(true);
  [60,200,300,200,150,150,120,160,200,150,250,250,250,250,120,120]
    .forEach((w,i) => sheet.setColumnWidth(i+1, w));

  // Status dropdown
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['','צריך מתנדבים דחוף','בטיפול','בבדיקה עם מתנדבים','טופל','לא רלוונטי'], true)
    .setAllowInvalid(true).build();
  sheet.getRange(2, 8, 1000, 1).setDataValidation(rule);

  // Conditional formatting
  const cfRange = sheet.getRange(2, 8, 1000, 1);
  sheet.setConditionalFormatRules([
    ['צריך מתנדבים דחוף','#fce8e8','#c0392b'],
    ['בטיפול','#e8f0fe','#1a73e8'],
    ['בבדיקה עם מתנדבים','#fef3e2','#e37400'],
    ['טופל','#e6f4ea','#137333'],
    ['לא רלוונטי','#f1f3f4','#5f6368'],
  ].map(([val,bg,fg]) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(val).setBackground(bg).setFontColor(fg)
      .setRanges([cfRange]).build()
  ));

  // Sample data
  const now = new Date().toLocaleDateString('he-IL');
  sheet.getRange(2,1,3,16).setValues([
    [1,'עזרה בקניות','קשישה לבד','הרצל 1, תל אביב','תל אביב','ישראל ישראלי','050-1234567','צריך מתנדבים דחוף','','','','','','',now,''],
    [2,'תיקון ברז','ברז דולף','בן גוריון 5, חיפה','חיפה','שרה כהן','052-9876543','בטיפול','','דניאל מזרחי','בדרך','','','',now,now],
    [3,'הסעה לרופא','טיפולים שבועיים','הנשיא 10, ירושלים','ירושלים','משה לוי','054-5556666','טופל','','נועה ברק','טופל','','','',now,now],
  ]);

  SpreadsheetApp.getUi().alert('✅ הגיליון הוכן!\n\nעכשיו:\nDeploy → New deployment → Web App\nExecute as: Me | Access: Anyone\nהעתק את ה-URL');
}

// ============================================================
//  HTTP HANDLER
// ============================================================
function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  // Build CORS-friendly response
  try {
    // Parse params — GET only (avoids CORS preflight from POST)
    const p = e.parameter || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(p.sheet || SHEET_NAME);
    if (!sheet) return out({ error: 'Sheet not found: ' + (p.sheet || SHEET_NAME) });

    // ---- READ ----
    if (p.action === 'read') {
      const data = sheet.getDataRange().getValues();
      return out({ rows: data, count: Math.max(0, data.length - 1) });
    }

    // ---- UPDATE (status, responsible, vol notes, last update) ----
    if (p.action === 'update') {
      const row = parseInt(p.row);
      if (!row || row < 2) return out({ error: 'Invalid row' });

      // p.s = status, p.r = responsible, p.n = notes, p.t = timestamp
      if (p.s !== undefined) sheet.getRange(row, 8).setValue(p.s);   // סטטוס
      if (p.r !== undefined) sheet.getRange(row, 10).setValue(p.r);  // אחראי
      if (p.n !== undefined) sheet.getRange(row, 11).setValue(p.n);  // הערות מתנדבים
      sheet.getRange(row, 16).setValue(p.t || new Date().toLocaleString('he-IL')); // עדכון אחרון

      return out({ success: true });
    }

    // ---- IMPORT (batch append new rows) ----
    if (p.action === 'import') {
      const rows = JSON.parse(p.rows); // array of arrays, 16 columns each
      if (!Array.isArray(rows) || rows.length === 0) return out({ error: 'No rows' });

      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, 16).setValues(rows);

      return out({ success: true, imported: rows.length });
    }

    return out({ error: 'Unknown action: ' + p.action });

  } catch (err) {
    return out({ error: err.toString() });
  }
}

function out(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
