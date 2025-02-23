const SHEET_ID_2 = '1v7Z3zBzygYiHIvHqHNDEomfwmhy6seC4xSs5HzUF';

function reformatPayeeData() {
  // Open the active spreadsheet
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get the sheet with the original data (rename as needed)
  const originalSheet = SpreadsheetApp.openById(SHEET_ID_2);
  
  // Get the data from the sheet
  const data = originalSheet.getDataRange().getValues();
  
  // Create a new sheet for the reformatted data
  let newSheet = spreadsheet.getSheetByName("ReformattedData");
  console.log(newSheet);
  if (!newSheet) {
    newSheet = spreadsheet.insertSheet("ReformattedData");
  } else {
    newSheet.clear(); // Clear existing data if the sheet already exists
  }
  
  // Add headers
  newSheet.appendRow(["Payee_id", "Payee"]);
  
  // Process the data
  for (let i = 1; i < data.length; i++) { // Skip headers
    const payee = data[i][0]; // Payee
    const payeeIds = data[i][1]; // Payee IDs (newline-separated)
    
    if (payee && payeeIds) {
      const idsArray = payeeIds.split('\n'); // Split by newline
      
      idsArray.forEach(payeeId => {
        newSheet.appendRow([payeeId, payee]); // Append to the new sheet
      });
    }
  }
  
  // Autofit columns
  newSheet.autoResizeColumns(1, 2);
}

