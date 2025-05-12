// server.js (Node.js with Express)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Datto API endpoints
const DATTO_BASE_URL = 'https://api.datto.com/v1';
const ACRONIS_BASE_URL = 'https://api.acronis.com/v2';

// Fetch Datto backups
app.get('/api/datto/backups', async (req, res) => {
    try {
        const response = await axios.get(`${DATTO_BASE_URL}/backups`, {
            headers: {
                'Authorization': `Bearer ${process.env.DATTO_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Transform Datto data to match your dashboard format
        const transformedData = response.data.map(backup => ({
            Status: mapDattoStatus(backup.status),
            "Computer Name": backup.deviceName,
            Source: "Datto",
            "Backup Start Time": formatDate(backup.startTime),
            "Files backed up now": backup.filesBackedUp,
            "Files failed to backup": backup.filesFailed,
            "Files considered for backup": backup.filesConsidered
        }));
        
        res.json(transformedData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch Acronis backups
app.get('/api/acronis/backups', async (req, res) => {
    try {
        const response = await axios.get(`${ACRONIS_BASE_URL}/backups`, {
            headers: {
                'Authorization': `Bearer ${process.env.ACRONIS_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Transform Acronis data to match your dashboard format
        const transformedData = response.data.map(backup => ({
            Status: mapAcronisStatus(backup.status),
            "Computer Name": backup.machineName,
            Source: "Acronis",
            "Backup Start Time": formatDate(backup.startedAt),
            "Files backed up now": backup.protectedFiles,
            "Files failed to backup": backup.failedFiles,
            "Files considered for backup": backup.totalFiles
        }));
        
        res.json(transformedData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));