const SHEET_ID = '1v7Z3zBzygYiHIvHqHNDEomfwmhy6seC4xSs5HzU';
const PAYEE_DICT_SHEET_NAME = 'YNAB_PAYEES'; // Name of the sheet to store PAYEE_DICT

// Entry function to fetch transactions and update PAYEE_DICT
function updatePayeeDict() {
  console.log("Updating PAYEE_DICT");
  
  // Step 1: Load existing PAYEE_DICT from the sheet
  const existingPayeeDict = readPayeeDictFromSheet();

  // Step 2: Fetch recent transactions
  const transactions = fetchRecentTransactions();

  // Step 3: Update PAYEE_DICT with recent transactions and log new entries
  transactions.forEach(transaction => {
    const payee = transaction.payee_name;
    const memo = transaction.memo;
    if (payee && memo) {
      if (!existingPayeeDict.hasOwnProperty(memo) || existingPayeeDict[memo] == "AssignManually") {
        existingPayeeDict[memo] = [payee];
        writeNewRowToSheet(memo, payee);
        console.log(`New entry: PAYEE_ID "${memo}" with PAYEE "${payee}"`);
      }
    }
  });
}

// Read PAYEE_DICT from Google Sheets
function readPayeeDictFromSheet() {
  const sheet = getOrCreateSheet(PAYEE_DICT_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const payeeDict = {}; // payeeId : payee

  data.slice(1).forEach(row => { // Skip header row
    const payeeId = row[0];
    const payee = row[1];
    payeeDict[payeeId] = payee;
  });
  return payeeDict;
}

const transactionsSince = new Date();
transactionsSince.setDate(transactionsSince.getDate() - 2);

// Fetch transactions from YNAB API
function fetchRecentTransactions() {
  const url = `https://api.ynab.com/v1/budgets/${YNAB_BUDGET_ID}/transactions?since_date=${transactionsSince}`;
  const headers = {
    "Authorization": `Bearer ${YNAB_API_TOKEN}`
  };
  const response = UrlFetchApp.fetch(url, { headers });
  const data = JSON.parse(response.getContentText()).data.transactions;
  return data.filter(transaction => transaction.cleared === "cleared");
}

// Write PAYEE_DICT to Google Sheets
function writeNewRowToSheet(memo, payee) {
  const sheet = getOrCreateSheet(PAYEE_DICT_SHEET_NAME);
  sheet.appendRow([memo, payee]);
}

// Utility function to get or create the sheet
function getOrCreateSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(sheetName);
  return sheet;
}