// ── Bukmuk Storywriting Competition 2026 — Google Apps Script ──
// Deploy as: Web App → Execute as: Me → Who has access: Anyone

var SECRET_TOKEN   = 'BUKMUK_STORYCOMP_2026';
var ADMIN_EMAILS   = 'abhinav.girotra@gmail.com,shefali.malhotra@gmail.com';
var COMP_URL       = 'https://agirotra.github.io/story-writing-comp/';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.token !== SECRET_TOKEN) {
      return ContentService.createTextOutput('Unauthorized');
    }

    // ── LOG TO SHEET ──
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Write header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp', 'Status', 'Payment ID', 'Amount (₹)',
        'Child Name', 'Child Age', 'Story Category', 'Story Title',
        'Parent Name', 'Email', 'Mobile', 'Instagram', 'Delivery Address'
      ]);
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
      data.address    || ''
    ]);

    var statusLabel = data.status === 'PAID' ? '✅ PAID' : '⚠️ INTENT — Not Paid';

    // ── ADMIN EMAIL ──
    var adminSubject = statusLabel + ' — Bukmuk Storywriting Competition 2026';
    var adminBody = 'Status: ' + statusLabel + '\n\n'
      + '── Child Details ──\n'
      + 'Name: '           + (data.childName  || '') + '\n'
      + 'Age: '            + (data.childAge   || '') + '\n'
      + 'Story Category: ' + (data.theme      || '') + '\n'
      + 'Story Title: '    + (data.storyTitle || '') + '\n\n'
      + '── Parent / Contact ──\n'
      + 'Parent: '    + (data.parentName || '') + '\n'
      + 'Email: '     + (data.email      || '') + '\n'
      + 'Mobile: '    + (data.mobile     || '') + '\n'
      + 'Instagram: ' + (data.instagram  || 'N/A') + '\n\n'
      + '── Delivery ──\n'
      + 'Address: ' + (data.address || '') + '\n\n'
      + '── Payment ──\n'
      + 'Amount: ₹'    + (data.amount    || '') + '\n'
      + 'Payment ID: ' + (data.paymentId || '');

    GmailApp.sendEmail(ADMIN_EMAILS, adminSubject, adminBody);

    // ── PARENT CONFIRMATION EMAIL (PAID only) ──
    if (data.email && data.status === 'PAID') {
      var parentSubject = '🎉 Registration Confirmed — Bukmuk Storywriting Competition 2026';
      var parentBody = 'Hi ' + (data.parentName || '') + ',\n\n'
        + 'Registration for the Bukmuk Storywriting Competition 2026 is confirmed! 🎉\n\n'
        + '── Your Entry Details ──\n'
        + 'Child\'s Name: '    + (data.childName  || '') + '\n'
        + 'Age: '              + (data.childAge   || '') + '\n'
        + 'Story Category: '   + (data.theme      || '') + '\n'
        + 'Story Title: '      + (data.storyTitle || '') + '\n'
        + 'Amount Paid: ₹'     + (data.amount     || '') + '\n'
        + 'Payment ID: '       + (data.paymentId  || '') + '\n\n'
        + '── Next Step — Submit Your Story ──\n'
        + 'Please email your story file (.docx or PDF) to:\n'
        + 'helpdesk@bukmuk.com\n\n'
        + 'Use this subject line:\n'
        + (data.childName || '') + ' — ' + (data.storyTitle || '') + ' — ' + (data.paymentId || '') + '\n\n'
        + 'Last date to submit: 30th April 2026\n\n'
        + '── What Happens Next ──\n'
        + 'Our literary jury will evaluate all entries. The top 9 stories in each\n'
        + 'category will be published in the Bukmuk Anthology — in India and internationally.\n\n'
        + 'Follow us on Instagram for updates: @bukmuklibrary\n\n'
        + 'For any questions:\n'
        + 'Email: helpdesk@bukmuk.com\n'
        + 'Call / WhatsApp Shefali: +91 81302 86286\n\n'
        + 'Happy writing! ✍️\n'
        + 'Team Bukmuk\n'
        + 'www.bukmuk.com | bukmukpublishing.com';

      GmailApp.sendEmail(data.email, parentSubject, parentBody);
    }

    // ── INTENT REMINDER EMAIL ──
    if (data.email && data.status === 'INTENT') {
      var intentSubject = 'You left something behind — Bukmuk Storywriting Competition 2026';
      var intentBody = 'Hi ' + (data.parentName || '') + ',\n\n'
        + 'We noticed you started registering for the Bukmuk Storywriting Competition 2026\n'
        + 'but didn\'t complete the payment.\n\n'
        + 'Your entry is not confirmed yet — the deadline is 30th April 2026.\n\n'
        + 'Complete your registration here:\n'
        + COMP_URL + '\n\n'
        + 'Entry fee: ₹490 · Secure payment via Razorpay\n\n'
        + 'The top 9 stories in each category will be published in an international anthology.\n'
        + 'Don\'t miss this chance for ' + (data.childName || 'your child') + ' to become a published author!\n\n'
        + 'For help call / WhatsApp Shefali: +91 81302 86286\n\n'
        + 'Team Bukmuk\n'
        + 'www.bukmuk.com';

      GmailApp.sendEmail(data.email, intentSubject, intentBody);
    }

    return ContentService.createTextOutput('OK');

  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.toString());
  }
}
