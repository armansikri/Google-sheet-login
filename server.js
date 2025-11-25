// server.js - Batch/Badge/Roll Login + Highlight + History Log
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(bodyParser.json());

//  Serve "public" folder (VERY IMPORTANT)
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Google Sheets config
const SHEET_ID = process.env.SHEET_ID;

const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  // ⭐ Render does NOT support credentials.json — using env vars
  credentials: {
    type: process.env.TYPE,
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    token_uri: process.env.TOKEN_URI
  }
});

let sheetsClient = null;
async function getSheets() {
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: "v4", auth: await auth.getClient() });
  }
  return sheetsClient;
}

async function getAllValues() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "A:ZZ"
  });
  return res.data.values || [];
}

function findIdColumn(headers) {
  const keys = ["badge", "batch", "roll"];
  for (let i = 0; i < headers.length; i++) {
    if (keys.some(k => (headers[i] || "").toLowerCase().includes(k))) return i;
  }
  return -1;
}

/* ---------- LOGIN ---------- */
app.post("/api/login", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "ID Required" });

  try {
    const values = await getAllValues();
    const headers = values[0];
    const idCol = findIdColumn(headers);
    if (idCol === -1) return res.status(500).json({ error: "No Batch/Badge/column found" });

    let row = null, index = null;
    for (let i = 1; i < values.length; i++) {
      if ((values[i][idCol] || "") == userId) {
        row = values[i];
        index = i + 1;
        break;
      }
    }
    if (!row) return res.status(404).json({ error: "Record not found" });

    const data = {};
    headers.forEach((h, i) => data[h] = row[i] || "");

    res.json({ rowIndex: index, headers, data, idColumnIndex: idCol });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- UPDATE + HIGHLIGHT + LOG ---------- */
app.post("/api/update", async (req, res) => {
  const { rowIndex, updates, userId } = req.body;
  if (!rowIndex) return res.status(400).json({ error: "rowIndex required" });

  try {
    const sheets = await getSheets();
    const values = await getAllValues();
    const headers = values[0];

    const last = headers.length - 1;
    const lastCol =
      last < 26 ? String.fromCharCode(65 + last)
      : String.fromCharCode(65 + Math.floor(last / 26) - 1) + String.fromCharCode(65 + last % 26);

    const range = `A${rowIndex}:${lastCol}${rowIndex}`;
    const read = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const current = read.data.values[0] || [];
    const newRow = [...current];
    const changed = [];
    const logRows = [];

    for (let key in updates) {
      const col = headers.indexOf(key);
      if (col >= 0) {
        const oldVal = current[col] || "";
        const newVal = updates[key];
        if (oldVal != newVal) {
          newRow[col] = newVal;
          changed.push(col);

          logRows.push([
            new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            userId, key, oldVal, newVal, rowIndex
          ]);
        }
      }
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [newRow] }
    });

    if (logRows.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "History_Log!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: logRows }
      });
    }

    if (changed.length) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const sheetId = meta.data.sheets[0].properties.sheetId;

      const requests = changed.map(c => ({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: rowIndex - 1,
            endRowIndex: rowIndex,
            startColumnIndex: c,
            endColumnIndex: c + 1
          },
          cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 0.6 } } },
          fields: "userEnteredFormat(backgroundColor)"
        }
      }));

      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
    }

    res.json({ message: "Updated + Logged + Highlighted", changed });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server running on ${PORT}`));
