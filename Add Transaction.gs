const YNAB_API_TOKEN = '7lK5-';
const YNAB_BUDGET_ID = 'f3ab5e1f-b7d9-4bf5-acdb-';

// Payee mapping dictionary: key is payee name, value is array of addresses
let PAYEE_DICT = {};

// Account ID mapping dictionary: key is Account name, value is account ID
const ACCOUNT_ID_DICT = {
  "HDFC": "73ffd024-fe7d-4d99-a3e7-",
  "IndusInd": "7c3b23bf-7899-4051-a3c0-",
  "SBI Cashback": "bf69c77c-78ab-42f7-9ffb-",
  "HDFC Moneyback": "dd666387-5d70-43d9-b233-"
};

function processTransactionEmails() {

  //updatePayeeDict();

  PAYEE_DICT = readPayeeDictFromSheet()

  // const threads = GmailApp.search('label:Transactions is:unread');
  const threads = GmailApp.search('label:Transactions is:unread newer_than:2d');
  console.info(`Found ${threads.length} threads in 'Transactions' label`);

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      if (!message.isUnread()) return;

      const sender = message.getFrom();
      const body = message.getPlainBody().replace(/[\r\n]+/g, ''); // Removes all newline characters;
      const messageDate = message.getDate();
      const date = getISODate(messageDate);  // Convert to ISO format
      
      let transactionDetails, accountName, amount, flow, payeeAddress;
      
      console.info(`Processing email from: ${sender}`);
      //console.info(`Email body: ${body}`);

      // Rule-based extraction for different banks
      if (sender.includes("SBI Card Transaction Alert")) {
        transactionDetails = getSBICashbackDetails(body, accountName, amount, flow, payeeAddress);
      } else if (sender.includes("HDFC Bank InstaAlerts")) {
        if (body.includes("9361")) {
          transactionDetails = getHdfcMoneybackDetails(body, accountName, amount, flow, payeeAddress);
        } else if (body.includes("9262")) {
          transactionDetails = getHdfcDetails(body, accountName, amount, flow, payeeAddress);
        } else if (body.includes("7912")) {
          transactionDetails = getHdfcDebitDetails(body, accountName, amount, flow, payeeAddress);
        } else {
          console.warn("\t Skipping email: No matching account number in body.");
          message.markRead();
          return;
        }
      } else {
        console.warn("\t Skipping email: Sender does not match specified banks.");
        message.markRead();
        return;
      }

      console.log(`\t Extracted data - Account: ${transactionDetails.accountName}, Amount: ${transactionDetails.amount}, Flow: ${transactionDetails.flow}, Payee Address: ${transactionDetails.payeeAddress}, Date: ${date}`);

      // Identify payee name based on payee address
      const payeeName = findPayeeName(transactionDetails.payeeAddress) || "AssignManually";
      console.info(`\t Identified Payee Name: ${payeeName}`);

      // Send transaction to YNAB
      try {
        postTransactionToYNAB(transactionDetails.accountName, transactionDetails.amount, transactionDetails.flow, date, payeeName, transactionDetails.payeeAddress);
        console.info(`\t Transaction posted successfully to YNAB for ${transactionDetails.accountName}`);
      } catch (error) {
        console.error("\t Error posting transaction to YNAB:", error);
      }

      // Mark email as read
      message.markRead();
    });
  });
}

function getSBICashbackDetails(body, accountName, amount, flow, payeeAddress){
  accountName = "SBI Cashback";
  let amountStr = extractMatch(body, /Rs\.\s?([\d,]+\.\d{2})/);
  if (amountStr) {
  // Remove commas and parse as a floating-point number
  amount = parseFloat(amountStr.replace(/,/g, ''));
}
  payeeAddress = extractMatch(body, /at ([\w\s-@.]+) on/);
  flow = -1;
  return {accountName, amount, flow, payeeAddress}
}

function getHdfcMoneybackDetails(body, accountName, amount, flow, payeeAddress){
  accountName = "HDFC Moneyback";
  amount = extractMatch(body, /Rs (\d+\.\d{2})/);
  payeeAddress = extractMatch(body, /at ([\w\s-@.]+) on/);
  flow = -1;
  return {accountName, amount, flow, payeeAddress}
}

function getHdfcDebitDetails(body, accountName, amount, flow, payeeAddress){
  accountName = "HDFC";
  amount = extractMatch(body, /Rs (\d+\.\d{2})/);
  payeeAddress = extractMatch(body, /at ([\w\s-@.]+) on/);
  flow = -1;
  return {accountName, amount, flow, payeeAddress}
}

function getHdfcDetails(body, accountName, amount, flow, payeeAddress){
  accountName = "HDFC";
  amount = extractMatch(body, /Rs\. (\d+\.\d{2})/);
  if (!amount) {
    amount = extractMatch(body, /Rs\.(\d+\.\d{2})/);
  }
  payeeAddress = extractMatch(body, /to VPA ([\w-@.]+)/);
  if (!payeeAddress) {
    payeeAddress = extractMatch(body, /by VPA ([\w-@.]+)/);
    flow = 1;
  } else {
    flow = -1;
  }
  return {accountName, amount, flow, payeeAddress}
}

// Utility to match regex patterns
function extractMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[1] : null;
}

// Utility to convert Date object to ISO format YYYY-MM-DD
function getISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Identify payee name from PAYEE_DICT based on payee address
function findPayeeName(payeeAddress) {
  if (payeeAddress in PAYEE_DICT)
    return PAYEE_DICT[payeeAddress];
  return null;
}

// POST request to YNAB API to log a transaction
function postTransactionToYNAB(accountName, amount, flow, date, payeeName, payeeAddress) {
  const transaction = {
    transaction: {
      account_id: ACCOUNT_ID_DICT[accountName],
      date: date,
      amount: Math.round(amount * 1000) * flow,  // Convert to milliunits for YNAB
      payee_name: payeeName,
      memo: `${payeeAddress}`,
      cleared: "cleared"
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": `Bearer ${YNAB_API_TOKEN}` },
    payload: JSON.stringify(transaction)
  };

  const url = `https://api.ynab.com/v1/budgets/${YNAB_BUDGET_ID}/transactions`;
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 201) {
    console.log("\t Transaction added successfully.");
  } else {
    console.error(`\t Failed to add transaction: ${response.getContentText()}`);
  }
}
