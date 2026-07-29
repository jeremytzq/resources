/**
 * Backend for the Resource Dashboard, deployed as a Google Apps Script Web App
 * bound to a Google Sheet. See README.md for full setup steps.
 *
 * Setup:
 *   1. Create a Google Sheet.
 *   2. Extensions > Apps Script, replace the default code with this file.
 *   3. (Optional) Run seedSampleData once from the editor to populate sample rows.
 *   4. Deploy > New deployment > Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *   5. Copy the deployed /exec URL into the dashboard's Settings panel.
 */

var SHEET_NAME = 'Contacts';
var HEADERS = ['id', 'category', 'company', 'logoUrl', 'bankerType', 'name', 'role', 'rating', 'review', 'phone', 'notes'];

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

/**
 * Reads the sheet's actual header row and appends any HEADERS fields it's
 * missing (e.g. rating/review added to the schema after the sheet was
 * first created), without touching existing columns or data. Every
 * function below looks up a field's column position from this returned
 * array rather than assuming the HEADERS constant's order matches the
 * physical sheet — those two can drift on a sheet created before a schema
 * change, which previously caused writes to land in the wrong column.
 */
function ensureHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  var existing = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var missing = HEADERS.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length > 0) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    existing = existing.concat(missing);
  }
  return existing;
}

function readContacts(sheet) {
  var headers = ensureHeaders(sheet);
  var data = sheet.getDataRange().getValues();
  data.shift(); // drop header row
  return data
    .filter(function (row) { return row[0] !== '' && row[0] !== null; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var sheet = getSheet();
  return jsonResponse({ contacts: readContacts(sheet) });
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var sheet = getSheet();

  if (payload.action === 'create' || payload.action === 'update') {
    upsertContact(sheet, payload.contact);
  } else if (payload.action === 'delete') {
    deleteContact(sheet, payload.id);
  } else if (payload.action === 'rate') {
    updateRating(sheet, payload.id, payload.rating, payload.review);
  }

  return jsonResponse({ contacts: readContacts(sheet) });
}

/**
 * Updates only the rating/review columns for an existing row, leaving
 * every other field untouched. This is the one write action the dashboard
 * allows without its passcode, so it deliberately can't touch anything
 * else about a contact.
 */
function updateRating(sheet, id, rating, review) {
  var headers = ensureHeaders(sheet);
  var idCol = headers.indexOf('id');
  var ratingCol = headers.indexOf('rating');
  var reviewCol = headers.indexOf('review');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      if (ratingCol !== -1) sheet.getRange(i + 1, ratingCol + 1).setValue(rating || '');
      if (reviewCol !== -1 && review !== undefined && review !== null) {
        sheet.getRange(i + 1, reviewCol + 1).setValue(review);
      }
      break;
    }
  }
}

function upsertContact(sheet, contact) {
  var headers = ensureHeaders(sheet);
  var idCol = headers.indexOf('id');
  var data = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(contact.id)) {
      targetRow = i + 1;
      break;
    }
  }
  if (targetRow === -1) {
    targetRow = sheet.getLastRow() + 1;
  }

  var row = headers.map(function (h) {
    return contact[h] !== undefined && contact[h] !== null ? contact[h] : '';
  });

  // Force the phone cell to plain-text format before writing — Sheets
  // otherwise treats a leading "+" the same as "=" and evaluates the
  // number as a formula, silently dropping the "+" and changing its type.
  var phoneCol = headers.indexOf('phone');
  if (phoneCol !== -1) {
    sheet.getRange(targetRow, phoneCol + 1).setNumberFormat('@');
  }

  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
}

function deleteContact(sheet, id) {
  var headers = ensureHeaders(sheet);
  var idCol = headers.indexOf('id');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

/**
 * Optional one-time helper: run this once from the Apps Script editor
 * (Run > seedSampleData) to populate the sheet with the same sample
 * contacts that ship with the dashboard's local mode.
 */
function seedSampleData() {
  var sheet = getSheet();
  var existing = readContacts(sheet);
  if (existing.length > 0) {
    throw new Error('Sheet already has data — clear it first if you want to reseed.');
  }

  var samples = [
    { id: 'seed-1', category: 'banker', company: 'DBS Bank', logoUrl: 'https://logo.clearbit.com/dbs.com', bankerType: 'Residential', name: 'Alicia Tan', role: 'Mortgage Relationship Manager', rating: 5, review: 'Very responsive, secured a great rate and closed fast.', phone: '+6591234567', notes: 'Handles residential home loan packages.' },
    { id: 'seed-2', category: 'banker', company: 'DBS Bank', logoUrl: 'https://logo.clearbit.com/dbs.com', bankerType: 'Commercial', name: 'Marcus Lim', role: 'Commercial Banking Manager', rating: 4, review: 'Solid for commercial loans, slightly slower turnaround.', phone: '+6591234568', notes: 'Handles commercial and industrial property loans.' },
    { id: 'seed-3', category: 'banker', company: 'OCBC Bank', logoUrl: 'https://logo.clearbit.com/ocbc.com', bankerType: 'Residential', name: 'Rachel Koh', role: 'Home Loan Specialist', rating: 4, review: 'Good rates, communicates clearly.', phone: '+6591234569', notes: '' },
    { id: 'seed-4', category: 'banker', company: 'UOB', logoUrl: 'https://logo.clearbit.com/uob.com', bankerType: 'Commercial', name: 'Daniel Ng', role: 'SME Banking Manager', rating: 3, review: 'Decent but paperwork-heavy process.', phone: '+6591234570', notes: '' },
    { id: 'seed-5', category: 'law_firm', company: 'Rajah & Tann Singapore LLP', logoUrl: 'https://logo.clearbit.com/rajahtannasia.com', name: 'Priya Sharma', role: 'Conveyancing Lawyer', rating: 5, review: 'Meticulous and fast on conveyancing, highly recommend.', phone: '+6591234571', notes: 'Property conveyancing and title transfers.' },
    { id: 'seed-6', category: 'law_firm', company: 'Allen & Gledhill LLP', logoUrl: 'https://logo.clearbit.com/allenandgledhill.com', name: 'Wei Jie Chua', role: 'Partner, Corporate Law', rating: 4, review: 'Strong on corporate matters, premium pricing.', phone: '+6591234572', notes: '' },
    { id: 'seed-7', category: 'corporate_secretary', company: 'Corp Sec Partners Pte Ltd', name: 'Michelle Wong', role: 'Corporate Secretary', rating: 4, review: 'Reliable for annual filings, good reminders before deadlines.', phone: '+6591234573', notes: 'Handles company incorporation and annual filings.' },
    { id: 'seed-8', category: 'accounting', company: 'Tan & Associates Accounting', name: 'Kevin Teo', role: 'Chartered Accountant', rating: 3, review: 'Fine for straightforward bookkeeping, slower during tax season.', phone: '+6591234574', notes: 'Bookkeeping and tax filing for SMEs.' },
    { id: 'seed-9', category: 'accounting', company: 'Grant Thornton Singapore', logoUrl: 'https://logo.clearbit.com/grantthornton.sg', name: 'Serene Goh', role: 'Audit Associate', rating: 5, review: 'Thorough and well organised for audits.', phone: '+6591234575', notes: '' },
    { id: 'seed-10', category: 'property_partner', company: 'PropNex Realty', logoUrl: 'https://logo.clearbit.com/propnex.com', name: 'Farhan Ismail', role: 'Property Agent', rating: 5, review: 'Excellent negotiator, sold above asking twice.', phone: '+6591234576', notes: 'Residential resale and rental specialist.' },
    { id: 'seed-11', category: 'property_partner', company: 'Knight Frank Singapore', logoUrl: 'https://logo.clearbit.com/knightfrank.com.sg', name: 'Josephine Lee', role: 'Commercial Property Consultant', rating: 4, review: 'Strong commercial network, good market insight.', phone: '+6591234577', notes: '' },
    { id: 'seed-12', category: 'interior_designer', company: 'Design Atelier', name: 'Bryan Ho', role: 'Principal Interior Designer', rating: 2, review: 'Nice concepts but consistently behind schedule.', phone: '+6591234578', notes: 'Residential renovation and space planning.' },
    { id: 'seed-13', category: 'mortgage_broker', company: 'Loan Advisor SG', name: 'Nurul Aini', role: 'Mortgage Broker', rating: 5, review: 'Compares packages honestly, saved us a lot on refinancing.', phone: '+6591234579', notes: 'Compares packages across multiple banks.' }
  ];

  samples.forEach(function (contact) { upsertContact(sheet, contact); });
}
