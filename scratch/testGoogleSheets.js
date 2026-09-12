require('dotenv').config();
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

async function testSheets() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  console.log('Testing Google Sheets connection...');
  console.log('Spreadsheet ID:', spreadsheetId);
  console.log('Client Email:', clientEmail);
  console.log('Private key length:', rawPrivateKey?.length);

  try {
    let privateKey = (rawPrivateKey || '').trim().replace(/^["'`]+|["'`]+$/g, '');
    privateKey = privateKey.replace(/\\n/g, '\n');
    const auth = new JWT({
      email: clientEmail.trim().replace(/^["'`]+|["'`]+$/g, ''),
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('✅ Google Sheets Connection SUCCESSFUL!');
    console.log('Spreadsheet Title:', meta.data.properties.title);
    console.log('Existing Sheets Tabs:', meta.data.sheets.map(s => s.properties.title));
  } catch (err) {
    console.error('❌ Google Sheets Connection FAILED:');
    console.error('Error Code:', err.code);
    console.error('Error Message:', err.message);
    if (err.errors) console.error('Details:', err.errors);
  }
}

testSheets();
