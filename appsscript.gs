// ── Bukmuk Short Story Writing Competition 2026 — Google Apps Script ──
//
// Deploy as: Web App → Execute as: Me → Who has access: Anyone
//
// FIRST-TIME SETUP, in this order:
//   1. Run resetEntriesSheet()  — writes the 18-column header (destructive, see note)
//   2. Run authorizeAll()       — grants Drive + Gmail scopes so the web app can use them
//   3. Run installTriggers()    — schedules the intent reminder + admin digest
//   4. Deploy → New deployment → copy the /exec URL into script.js SCRIPT_URL

var SECRET_TOKEN  = 'BUKMUK_STORYCOMP_2026';
var ADMIN_EMAILS  = 'abhinav.girotra@gmail.com,shefali.malhotra@gmail.com';
var COMP_URL      = 'https://competition.bukmuk.com/';
var FOLDER_NAME   = 'Bukmuk Short Story Competition 2026 — Submissions';
var SHEET_NAME    = 'Entries';
var DEADLINE_TEXT = '31st October 2026';
var ENTRY_FEE     = 490;

// Wait this long after an abandoned checkout before nudging the parent.
var REMINDER_DELAY_MINUTES = 60;

var HEADERS = [
  'Timestamp', 'Status', 'Payment ID', 'Amount (₹)',
  'Child Name', 'Child Age', 'Story Category', 'Story Title',
  'Parent Name', 'Email', 'Mobile', 'Instagram', 'Delivery Address',
  'Originality Declared', 'Publishing Consent',
  'Story File (Drive Link)', 'Submission ID', 'Reminder Sent'
];

// 1-based column positions, derived from HEADERS.
var COL = {
  timestamp: 1, status: 2, paymentId: 3, amount: 4,
  childName: 5, childAge: 6, theme: 7, storyTitle: 8,
  parentName: 9, email: 10, mobile: 11, instagram: 12, address: 13,
  consentOriginal: 14, consentPublish: 15,
  driveUrl: 16, submissionId: 17, reminderSent: 18
};

// ─────────────────────────────────────────────────────────────
// WEB APP ENTRY POINTS
// ─────────────────────────────────────────────────────────────

function doGet() {
  // Health check — lets you confirm a deployment is live from a browser.
  return ContentService.createTextOutput('OK — Bukmuk competition endpoint live');
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return reply('ERROR Bad JSON');
  }

  if (data.token !== SECRET_TOKEN) {
    return reply('Unauthorized');
  }

  // Serialise writes so two concurrent submissions cannot both append or both
  // decide a submissionId is new.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return reply('ERROR Busy, retry');
  }

  try {
    return reply(recordEntry(data));
  } catch (err) {
    // Surface the failure to the client so it can retry rather than showing
    // the parent a false success.
    notifyAdminOfFailure(data, err);
    return reply('ERROR ' + err);
  } finally {
    lock.releaseLock();
  }
}

function reply(text) {
  return ContentService.createTextOutput(text);
}

// ─────────────────────────────────────────────────────────────
// CORE WRITE PATH
// ─────────────────────────────────────────────────────────────

function recordEntry(data) {
  var sheet   = getEntriesSheet();
  var status  = data.status || '';
  var subId   = data.submissionId || '';
  var existing = subId ? findRowBySubmissionId(sheet, subId) : 0;

  // Already recorded at this status — a retry of a request that did land.
  if (existing) {
    var currentStatus = sheet.getRange(existing, COL.status).getValue();
    if (currentStatus === status) return 'DUPLICATE';
  }

  // Upload the story file if one came with this request.
  var driveUrl = '';
  if (data.fileBase64 && data.fileName) {
    driveUrl = saveStoryFile(data); // throws on failure — caller retries
  }

  var row = buildRowValues(data, driveUrl);

  if (existing) {
    // Same submission moving INTENT → PAID: upgrade the row in place rather
    // than leaving a stale abandoned-cart row behind it.
    var keepDriveUrl = driveUrl || sheet.getRange(existing, COL.driveUrl).getValue();
    var keepReminder = sheet.getRange(existing, COL.reminderSent).getValue();
    row[COL.driveUrl - 1]     = keepDriveUrl;
    row[COL.reminderSent - 1] = keepReminder;
    sheet.getRange(existing, 1, 1, HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  SpreadsheetApp.flush();

  // Emails are best-effort: the entry is already saved, so a mail failure must
  // not make the client think the submission failed.
  try {
    if (status === 'PAID') {
      sendAdminPaidAlert(data, driveUrl);
      if (data.email) sendParentConfirmation(data, driveUrl);
    }
    // INTENT sends nothing now — sendIntentReminders() handles it later, so
    // parents don't get an "you left something behind" email mid-checkout.
  } catch (mailErr) {
    // swallowed on purpose
  }

  return 'OK';
}

function buildRowValues(data, driveUrl) {
  var row = new Array(HEADERS.length).fill('');
  row[COL.timestamp - 1]       = data.timestamp || new Date().toISOString();
  row[COL.status - 1]          = data.status || '';
  row[COL.paymentId - 1]       = data.paymentId || '';
  row[COL.amount - 1]          = data.amount || '';
  row[COL.childName - 1]       = data.childName || '';
  row[COL.childAge - 1]        = data.childAge || '';
  row[COL.theme - 1]           = data.theme || '';
  row[COL.storyTitle - 1]      = data.storyTitle || '';
  row[COL.parentName - 1]      = data.parentName || '';
  row[COL.email - 1]           = data.email || '';
  row[COL.mobile - 1]          = data.mobile || '';
  row[COL.instagram - 1]       = data.instagram || '';
  row[COL.address - 1]         = data.address || '';
  row[COL.consentOriginal - 1] = data.consentOriginal || '';
  row[COL.consentPublish - 1]  = data.consentPublish || '';
  row[COL.driveUrl - 1]        = driveUrl || '';
  row[COL.submissionId - 1]    = data.submissionId || '';
  row[COL.reminderSent - 1]    = '';
  return row;
}

// Returns the 1-based row number for a submission ID, or 0 if not present.
function findRowBySubmissionId(sheet, subId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var ids = sheet.getRange(2, COL.submissionId, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] && String(ids[i][0]) === String(subId)) return i + 2;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
// DRIVE
// ─────────────────────────────────────────────────────────────

function saveStoryFile(data) {
  var folder    = getOrCreateFolder(FOLDER_NAME);
  var ext       = data.fileName.substring(data.fileName.lastIndexOf('.'));
  var safeName  = sanitise(data.childName || 'unknown') + '_'
                + sanitise(data.storyTitle || 'story') + '_'
                + sanitise(data.paymentId || '') + ext;
  var fileBytes = Utilities.base64Decode(data.fileBase64);
  var blob      = Utilities.newBlob(fileBytes, data.fileMimeType || 'application/octet-stream', safeName);
  var file      = folder.createFile(blob);

  // Deliberately NOT shared publicly — these are minors' stories with their
  // names attached. Share the folder directly with jury members instead.
  return file.getUrl();
}

function sanitise(text) {
  return String(text).replace(/[\/\\?%*:|"<>]/g, '-').trim().substring(0, 60);
}

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

// ─────────────────────────────────────────────────────────────
// SHEET SETUP
// ─────────────────────────────────────────────────────────────

function getEntriesSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) writeHeaders(sheet);

  return sheet;
}

function writeHeaders(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// One-time migration. The old sheet had 14 columns in a different order, so
// appending 18-value rows to it would misalign every column. This clears the
// sheet and writes the new header.
//
// WARNING: destructive. Export a copy first if the sheet holds real entries.
function resetEntriesSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.clear();
  writeHeaders(sheet);
  Logger.log('Entries sheet reset with ' + HEADERS.length + ' columns.');
}

// ─────────────────────────────────────────────────────────────
// DELAYED INTENT REMINDER (time-driven trigger, hourly)
// ─────────────────────────────────────────────────────────────

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'sendIntentReminders' || fn === 'sendDailyIntentDigest') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('sendIntentReminders').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('sendDailyIntentDigest').timeBased().everyDays(1).atHour(10).create();

  Logger.log('Triggers installed.');
}

function sendIntentReminders() {
  var sheet   = getEntriesSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var values  = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var cutoff  = Date.now() - REMINDER_DELAY_MINUTES * 60 * 1000;
  var paidEmails = collectPaidEmails(values);
  var sent    = 0;

  for (var i = 0; i < values.length && sent < 50; i++) {
    var row = values[i];

    if (row[COL.status - 1] !== 'INTENT') continue;
    if (row[COL.reminderSent - 1]) continue;

    var email = String(row[COL.email - 1] || '').trim();
    if (!email) continue;

    // They came back and paid under a different submission — don't nag.
    if (paidEmails[email.toLowerCase()]) continue;

    var ts = new Date(row[COL.timestamp - 1]).getTime();
    if (!ts || ts > cutoff) continue;

    try {
      GmailApp.sendEmail(email, intentSubject(), intentBody(row));
      sheet.getRange(i + 2, COL.reminderSent).setValue(new Date().toISOString());
      sent++;
    } catch (mailErr) {
      sheet.getRange(i + 2, COL.reminderSent).setValue('FAILED: ' + mailErr);
    }
  }

  if (sent) Logger.log('Sent ' + sent + ' intent reminders.');
}

function collectPaidEmails(values) {
  var map = {};
  for (var i = 0; i < values.length; i++) {
    if (values[i][COL.status - 1] === 'PAID') {
      var e = String(values[i][COL.email - 1] || '').trim().toLowerCase();
      if (e) map[e] = true;
    }
  }
  return map;
}

// Daily list of unconverted registrations, for phone follow-up.
function sendDailyIntentDigest() {
  var sheet   = getEntriesSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var values     = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var paidEmails = collectPaidEmails(values);
  var lines      = [];
  var paidCount  = 0;

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[COL.status - 1] === 'PAID') { paidCount++; continue; }
    if (row[COL.status - 1] !== 'INTENT') continue;

    var email = String(row[COL.email - 1] || '').trim();
    if (email && paidEmails[email.toLowerCase()]) continue;

    lines.push('· ' + (row[COL.childName - 1] || '?')
      + ' (age ' + (row[COL.childAge - 1] || '?') + ')'
      + ' — ' + (row[COL.parentName - 1] || '?')
      + ' — ' + (row[COL.mobile - 1] || 'no number')
      + ' — ' + (email || 'no email')
      + ' — ' + (row[COL.timestamp - 1] || ''));
  }

  if (!lines.length) return;

  GmailApp.sendEmail(
    ADMIN_EMAILS,
    'Bukmuk Competition — ' + lines.length + ' incomplete registration(s) to follow up',
    'Confirmed paid entries so far: ' + paidCount + '\n\n'
      + 'These people started registering but have not paid:\n\n'
      + lines.join('\n')
      + '\n\nDeadline: ' + DEADLINE_TEXT + '\n'
      + 'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  );
}

// ─────────────────────────────────────────────────────────────
// EMAILS
// ─────────────────────────────────────────────────────────────

function sendAdminPaidAlert(data, driveUrl) {
  GmailApp.sendEmail(
    ADMIN_EMAILS,
    '✅ PAID — Bukmuk Short Story Writing Competition 2026',
    '── Child Details ──\n'
    + 'Name: '           + (data.childName  || '') + '\n'
    + 'Age: '            + (data.childAge   || '') + '\n'
    + 'Story Category: ' + (data.theme      || '') + '\n'
    + 'Story Title: '    + (data.storyTitle || '') + '\n\n'
    + '── Parent / Contact ──\n'
    + 'Parent: '    + (data.parentName || '') + '\n'
    + 'Email: '     + (data.email      || '') + '\n'
    + 'Mobile: '    + (data.mobile     || '') + '\n'
    + 'Instagram: ' + (data.instagram  || 'N/A') + '\n\n'
    + '── Declarations ──\n'
    + 'Original work, no AI: ' + (data.consentOriginal || 'NOT GIVEN') + '\n'
    + 'Publishing consent: '   + (data.consentPublish  || 'NOT GIVEN') + '\n\n'
    + '── Delivery ──\n'
    + 'Address: ' + (data.address || '') + '\n\n'
    + '── Payment ──\n'
    + 'Amount: ₹'    + (data.amount    || '') + '\n'
    + 'Payment ID: ' + (data.paymentId || '') + '\n'
    + 'Reference: '  + (data.submissionId || '') + '\n\n'
    + '── Story File ──\n'
    + (driveUrl ? driveUrl : 'NO FILE — ask the parent to email it')
  );
}

function sendParentConfirmation(data, driveUrl) {
  GmailApp.sendEmail(
    data.email,
    '🎉 Registration Confirmed — Bukmuk Short Story Writing Competition 2026',
    'Hi ' + (data.parentName || '') + ',\n\n'
    + 'Registration for the Bukmuk Short Story Writing Competition 2026 is confirmed! 🎉\n\n'
    + '── Your Entry Details ──\n'
    + 'Child\'s Name: '  + (data.childName  || '') + '\n'
    + 'Age: '            + (data.childAge   || '') + '\n'
    + 'Story Category: ' + (data.theme      || '') + '\n'
    + 'Story Title: '    + (data.storyTitle || '') + '\n'
    + 'Amount Paid: ₹'   + (data.amount     || '') + '\n'
    + 'Payment ID: '     + (data.paymentId  || '') + '\n\n'
    + (driveUrl
        ? 'Your story file has been received.\n\n'
        : 'We could not attach your story file — please reply to this email with it attached.\n\n')
    + '── What Happens Next ──\n'
    + 'Our jury will read every entry. The ten best stories in each age group\n'
    + 'will be printed in that age group\'s own anthology, three books in all,\n'
    + 'sold in India and internationally.\n\n'
    + 'Follow us on Instagram for results: @bukmuklibrary\n\n'
    + 'For any questions:\n'
    + 'Email: helpdesk@bukmuk.com\n'
    + 'Call / WhatsApp Shefali: +91 81302 86286\n\n'
    + 'Happy writing! ✍️\n'
    + 'Team Bukmuk\n'
    + 'www.bukmuk.com | bukmukpublishing.com'
  );
}

function intentSubject() {
  return 'You left something behind — Bukmuk Short Story Writing Competition 2026';
}

function intentBody(row) {
  var parentName = row[COL.parentName - 1] || '';
  var childName  = row[COL.childName - 1]  || 'your child';

  return 'Hi ' + parentName + ',\n\n'
    + 'We noticed you started registering for the Bukmuk Short Story Writing Competition 2026\n'
    + 'but didn\'t complete the payment.\n\n'
    + 'Your entry is not confirmed yet — the deadline is ' + DEADLINE_TEXT + '.\n\n'
    + 'Complete your registration here:\n'
    + COMP_URL + '\n\n'
    + 'Entry fee: ₹' + ENTRY_FEE + ' · Secure payment via Razorpay\n\n'
    + 'The ten best stories in each age group will be printed in that age group\'s own anthology.\n'
    + 'Don\'t miss this chance for ' + childName + ' to become a published author!\n\n'
    + 'For help call / WhatsApp Shefali: +91 81302 86286\n\n'
    + 'Team Bukmuk\n'
    + 'www.bukmuk.com';
}

function notifyAdminOfFailure(data, err) {
  try {
    GmailApp.sendEmail(
      ADMIN_EMAILS,
      '🚨 Submission FAILED — Bukmuk Competition 2026',
      'A submission could not be saved. The parent was shown a recovery screen.\n\n'
      + 'Error: ' + err + '\n\n'
      + 'Status: '     + (data.status     || '') + '\n'
      + 'Payment ID: ' + (data.paymentId  || '') + '\n'
      + 'Reference: '  + (data.submissionId || '') + '\n'
      + 'Child: '      + (data.childName  || '') + '\n'
      + 'Parent: '     + (data.parentName || '') + '\n'
      + 'Email: '      + (data.email      || '') + '\n'
      + 'Mobile: '     + (data.mobile     || '') + '\n'
      + 'Story: '      + (data.storyTitle || '') + '\n'
      + 'File: '       + (data.fileName   || 'none') + '\n'
    );
  } catch (e) { /* nothing left to do */ }
}

// ─────────────────────────────────────────────────────────────
// SETUP / TEST HELPERS — run these from the editor, not the web app
// ─────────────────────────────────────────────────────────────

// Grants every scope the web app needs. Run this BEFORE deploying, otherwise
// the deployed web app runs without Drive/Gmail permission.
function authorizeAll() {
  var folder = getOrCreateFolder(FOLDER_NAME);
  var probe  = folder.createFile(Utilities.newBlob('authorization probe', 'text/plain', '__authorize_probe.txt'));
  probe.setTrashed(true);

  GmailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    'Bukmuk competition script — authorization OK',
    'Drive and Gmail scopes are granted. You can deploy now.'
  );

  getEntriesSheet();
  Logger.log('All scopes authorized.');
}

// Simulates a PAID submission end to end. Leaves a test row — delete it after.
function testDoPost() {
  var res = doPost({
    postData: {
      contents: JSON.stringify({
        token:        SECRET_TOKEN,
        submissionId: 'sub_test_' + Date.now(),
        childName:    'Test Child',
        childAge:     '10',
        theme:        'Twisted Fairytales (Ages 9–11, 600–1000 words)',
        storyTitle:   'Test Story',
        parentName:   'Test Parent',
        email:        Session.getEffectiveUser().getEmail(),
        mobile:       '9999999999',
        address:      'Test address',
        instagram:    '',
        consentOriginal: 'YES',
        consentPublish:  'YES',
        amount:       ENTRY_FEE,
        paymentId:    'pay_test_' + Date.now(),
        status:       'PAID',
        timestamp:    new Date().toISOString()
      })
    }
  });
  Logger.log(res.getContent());
}
