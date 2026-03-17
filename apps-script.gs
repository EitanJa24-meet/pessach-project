// ============================================================
//  GOOGLE APPS SCRIPT — Volunteer Dashboard
//  IMPORTANT: After pasting, go to:
//  Deploy → New deployment → Web App
//  Execute as: Me | Who has access: Anyone
//  Copy the new URL into app.js HARDCODED_SCRIPT_URL
// ============================================================

const SHEET_NAME = 'DATABASE';

function doGet(e)  { return handle(e, e.parameter); }
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch(x) {}
  return handle(e, body);
}

function handle(e, p) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(p.sheet || SHEET_NAME);
  if (!sheet) return out({ error: 'Sheet not found: ' + (p.sheet || SHEET_NAME) });

  try {
    // ── READ ──
    if (p.action === 'read') {
      return out({ rows: sheet.getDataRange().getValues() });
    }

    // ── UPDATE (status / responsible / notes) ──
    if (p.action === 'update') {
      const row = parseInt(p.row);
      if (!row || row < 2) return out({ error: 'Invalid row' });
      if (p.s !== undefined) sheet.getRange(row, 8).setValue(p.s);
      if (p.r !== undefined) sheet.getRange(row, 10).setValue(p.r);
      if (p.n !== undefined) sheet.getRange(row, 11).setValue(p.n);
      sheet.getRange(row, 16).setValue(p.t || new Date().toLocaleString('he-IL'));
      return out({ success: true });
    }

    // ── IMPORT (POST body: { action, sheet, rows: [[...],[...]] }) ──
    if (p.action === 'import') {
      const rows = typeof p.rows === 'string' ? JSON.parse(p.rows) : p.rows;
      if (!Array.isArray(rows) || rows.length === 0) return out({ success: true, imported: 0 });
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, 16).setValues(rows);
      return out({ success: true, imported: rows.length });
    }

    return out({ error: 'Unknown action: ' + p.action });
  } catch(err) {
    return out({ error: err.toString() });
  }
}

function out(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── RUN ONCE to build headers ──
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const headers = ['מזהה','כותרת','תיאור','כתובת','אזור','שם מבקש סיוע','טלפון','סטטוס','קישור למשימה','אחראי משימה','הערות מתנדבים','הערות פנימיות','הערות מערכת 1','הערות מערכת 2','תאריך יצירה','עדכון אחרון'];
  const hr = sheet.getRange(1,1,1,headers.length);
  hr.setValues([headers]).setBackground('#3d6b4a').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('right');
  sheet.setFrozenRows(1);
  sheet.setRightToLeft(true);
  [60,200,300,200,150,150,120,160,200,150,250,250,250,250,120,120].forEach((w,i)=>sheet.setColumnWidth(i+1,w));

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['','צריך מתנדבים דחוף','בטיפול','בבדיקה עם מתנדבים','טופל','לא רלוונטי'],true)
    .setAllowInvalid(true).build();
  sheet.getRange(2,8,1000,1).setDataValidation(rule);

  const cfRange = sheet.getRange(2,8,1000,1);
  sheet.setConditionalFormatRules([
    ['צריך מתנדבים דחוף','#fdeaea','#b83232'],
    ['בטיפול','#e8f0fb','#2563a8'],
    ['בבדיקה עם מתנדבים','#fdf0e6','#c4621a'],
    ['טופל','#e8f2eb','#4a7c59'],
    ['לא רלוונטי','#eeebe5','#7a7468'],
  ].map(([val,bg,fg])=>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(val).setBackground(bg).setFontColor(fg)
      .setRanges([cfRange]).build()
  ));

  SpreadsheetApp.getUi().alert('✅ הגיליון הוכן!\nDeploy → New deployment → Web App\nExecute as: Me | Access: Anyone');
}
