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
var HEADERS = ['id', 'category', 'company', 'logoUrl', 'bankerType', 'name', 'role', 'phone', 'notes'];

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function readContacts(sheet) {
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
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
  }

  return jsonResponse({ contacts: readContacts(sheet) });
}

function upsertContact(sheet, contact) {
  var data = sheet.getDataRange().getValues();
  var idCol = HEADERS.indexOf('id');
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(contact.id)) {
      rowIndex = i + 1;
      break;
    }
  }

  var row = HEADERS.map(function (h) {
    return contact[h] !== undefined && contact[h] !== null ? contact[h] : '';
  });

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

function deleteContact(sheet, id) {
  var data = sheet.getDataRange().getValues();
  var idCol = HEADERS.indexOf('id');

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
    { id: 'seed-1', category: 'banker', company: 'DBS Bank', logoUrl: 'https://logo.clearbit.com/dbs.com', bankerType: 'Residential', name: 'Alicia Tan', role: 'Mortgage Relationship Manager', phone: '+6591234567', notes: 'Handles residential home loan packages.' },
    { id: 'seed-2', category: 'banker', company: 'DBS Bank', logoUrl: 'https://logo.clearbit.com/dbs.com', bankerType: 'Commercial', name: 'Marcus Lim', role: 'Commercial Banking Manager', phone: '+6591234568', notes: 'Handles commercial and industrial property loans.' },
    { id: 'seed-3', category: 'banker', company: 'OCBC Bank', logoUrl: 'https://logo.clearbit.com/ocbc.com', bankerType: 'Residential', name: 'Rachel Koh', role: 'Home Loan Specialist', phone: '+6591234569', notes: '' },
    { id: 'seed-4', category: 'banker', company: 'UOB', logoUrl: 'https://logo.clearbit.com/uob.com', bankerType: 'Commercial', name: 'Daniel Ng', role: 'SME Banking Manager', phone: '+6591234570', notes: '' },
    { id: 'seed-5', category: 'law_firm', company: 'Rajah & Tann Singapore LLP', logoUrl: 'https://logo.clearbit.com/rajahtannasia.com', name: 'Priya Sharma', role: 'Conveyancing Lawyer', phone: '+6591234571', notes: 'Property conveyancing and title transfers.' },
    { id: 'seed-6', category: 'law_firm', company: 'Allen & Gledhill LLP', logoUrl: 'https://logo.clearbit.com/allenandgledhill.com', name: 'Wei Jie Chua', role: 'Partner, Corporate Law', phone: '+6591234572', notes: '' },
    { id: 'seed-7', category: 'corporate_secretary', company: 'Corp Sec Partners Pte Ltd', name: 'Michelle Wong', role: 'Corporate Secretary', phone: '+6591234573', notes: 'Handles company incorporation and annual filings.' },
    { id: 'seed-8', category: 'accounting', company: 'Tan & Associates Accounting', name: 'Kevin Teo', role: 'Chartered Accountant', phone: '+6591234574', notes: 'Bookkeeping and tax filing for SMEs.' },
    { id: 'seed-9', category: 'accounting', company: 'Grant Thornton Singapore', logoUrl: 'https://logo.clearbit.com/grantthornton.sg', name: 'Serene Goh', role: 'Audit Associate', phone: '+6591234575', notes: '' },
    { id: 'seed-10', category: 'property_partner', company: 'PropNex Realty', logoUrl: 'https://logo.clearbit.com/propnex.com', name: 'Farhan Ismail', role: 'Property Agent', phone: '+6591234576', notes: 'Residential resale and rental specialist.' },
    { id: 'seed-11', category: 'property_partner', company: 'Knight Frank Singapore', logoUrl: 'https://logo.clearbit.com/knightfrank.com.sg', name: 'Josephine Lee', role: 'Commercial Property Consultant', phone: '+6591234577', notes: '' },
    { id: 'seed-12', category: 'interior_designer', company: 'Design Atelier', name: 'Bryan Ho', role: 'Principal Interior Designer', phone: '+6591234578', notes: 'Residential renovation and space planning.' },
    { id: 'seed-13', category: 'mortgage_broker', company: 'Loan Advisor SG', name: 'Nurul Aini', role: 'Mortgage Broker', phone: '+6591234579', notes: 'Compares packages across multiple banks.' }
  ];

  samples.forEach(function (contact) { upsertContact(sheet, contact); });
}
