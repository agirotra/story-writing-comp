// ── Bukmuk Storywriting Competition 2026 — Google Apps Script ──
// Deploy as: Web App → Execute as: Me → Who has access: Anyone
// Paste the deployment URL into script.js → SCRIPT_URL

var SECRET_TOKEN = 'BUKMUK2026SC';
var SHEET_NAME   = 'Entries';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.token !== SECRET_TOKEN) {
      return respond({ status: 'error', message: 'Unauthorized' });
    }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // Create sheet + header row on first run
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Timestamp',
        'Status',
        'Payment ID',
        'Amount (₹)',
        'Child Name',
        'Child Age',
        'Story Category',
        'Story Title',
        'Parent Name',
        'Email',
        'Mobile',
        'Instagram',
        'Delivery Address',
      ]);
      // Bold + freeze the header row
      sheet.getRange(1, 1, 1, 13).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      data.timestamp  || new Date().toISOString(),
      data.status     || '',
      data.paymentId  || '',
      data.amount     || '',
      data.childName  || '',
      data.childAge   || '',
      data.theme      || '',
      data.storyTitle || '',
      data.parentName || '',
      data.email      || '',
      data.mobile     || '',
      data.instagram  || '',
      data.address    || '',
    ]);

    return respond({ status: 'ok' });

  } catch (err) {
    return respond({ status: 'error', message: err.toString() });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
