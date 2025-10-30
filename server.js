// At the top of server.js
const sql = require('mssql');
const dbConfig = {
    user: 'mgnregaadmin',
    password: 'MgNrega@2025!Secure',
    server: 'mgnrega-sql-server.database.windows.net',
    database: 'mgnrega-dashboard-db',
    options: {
        encrypt: true
    }
};

// ... keep other imports (express, cors, etc.) below this

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Store data in memory
let mgnregaData = [];

// Load CSV data
function loadData() {
    const csvPath = path.join(__dirname, '../data/andhra_pradesh_mgnrega.csv');
    mgnregaData = [];
    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            mgnregaData.push(row);
        })
        .on('end', () => {
            console.log(`✅ CSV loaded successfully! Total records: ${mgnregaData.length}`);
        })
        .on('error', (error) => {
            console.error('❌ Error loading CSV:', error);
        });
}
// Load data initially
loadData();

// API: List all districts
app.get('/api/districts', (req, res) => {
    const districts = [...new Set(mgnregaData.map(row => row.district_name).filter(Boolean))].sort();
    res.json({ success: true, districts });
});

app.get('/api/stats/:districtName', async (req, res) => {
    try {
        await sql.connect(dbConfig);

        const result = await sql.query`
            SELECT TOP 1 *
            FROM MGNREGA
            WHERE district_name = ${req.params.districtName}
            ORDER BY fin_year DESC, month DESC
        `;

        if (!result.recordset.length) {
            return res.status(404).json({ success: false, message: 'District not found' });
        }

        const row = result.recordset[0];
        res.json({
            success: true,
            district: row.district_name,
            stats: {
                totalJobCards: row.Total_No_of_JobCards_issued || 0,
                activeWorkers: row.Total_No_of_Workers || 0,
                workCompleted: row.Number_of_Completed_Works || 0,
                expenditure: row.Total_Exp || 0,
                persondaysGenerated: row.Persondays_of_Central_Liability_so_far || 0,
                lastUpdated: `${row.fin_year} ${row.month}`
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});



app.get('/api/trend/:districtName', (req, res) => {
  try {
    const districtName = req.params.districtName.toUpperCase();
    // Month names for ordering
    const monthOrderArr = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const monthOrder = {};
    monthOrderArr.forEach((mon, idx) => { monthOrder[mon] = idx; });

    // Filter only for district
    let districtRows = mgnregaData.filter(row => 
      row.district_name && row.district_name.toUpperCase() === districtName
    );

    // Sort (oldest first): by year, then month order
    districtRows.sort((a, b) => {
      if (a.fin_year !== b.fin_year) return a.fin_year.localeCompare(b.fin_year);
      return monthOrder[a.month] - monthOrder[b.month];
    });

    // Pick last 6 unique months (from latest to oldest)
    let uniqueTrend = [];
    let addedSet = new Set();
    for (let i = districtRows.length - 1; i >= 0 && uniqueTrend.length < 6; i--) {
      const key = `${districtRows[i].fin_year}-${districtRows[i].month}`;
      if (!addedSet.has(key)) {
        uniqueTrend.push({
          label: `${districtRows[i].month} ${districtRows[i].fin_year}`,
          jobCards: parseInt(districtRows[i]["Total_No_of_JobCards_issued"] || districtRows[i].TotalNoofJobCardsissued || 0)
        });
        addedSet.add(key);
      }
    }

    // Now uniqueTrend[] is newest to oldest, reverse for oldest to newest for chart
    res.json({ success: true, trend: uniqueTrend.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});




// API: District vs State Average for latest month (job cards)
app.get('/api/compare/:districtName', (req, res) => {
    try {
        const districtName = req.params.districtName.toUpperCase();
        let districtRows = mgnregaData.filter(
            row => row.district_name && row.district_name.toUpperCase() === districtName
        );
        districtRows.sort((a, b) => {
            if (a.fin_year === b.fin_year) return a.month.localeCompare(b.month);
            return a.fin_year.localeCompare(b.fin_year);
        });
        const dLatest = districtRows[districtRows.length - 1];
        if (!dLatest) return res.status(404).json({ success: false, error: "No data for district" });

        const latestMonth = dLatest.month;
        const latestYear = dLatest.fin_year;

        // All districts for the latest month and year
        let monthRows = mgnregaData.filter(
            row => row.month === latestMonth && row.fin_year === latestYear
        );

        const allJobCards = monthRows.map(r => parseInt(r["Total_No_of_JobCards_issued"] || 0)).filter(x => !isNaN(x));
        const stateAverage = allJobCards.length ? Math.round(allJobCards.reduce((a,b)=>a+b,0)/allJobCards.length) : 0;

        res.json({
            success: true,
            district: {
                name: districtName,
                value: parseInt(dLatest["Total_No_of_JobCards_issued"] || 0)
            },
            state: {
                year: latestYear,
                month: latestMonth,
                average: stateAverage
            }
        });
    } catch (error) {
        res.status(500).json({ success:false, error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
