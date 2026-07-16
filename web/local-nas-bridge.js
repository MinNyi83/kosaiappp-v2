const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3010;

// CONFIGURATION: Set the local path to your mounted NAS SMB folder
// Windows Example: 'Z:\\dispatch-photos' or '\\\\192.168.1.100\\dispatch-photos'
// Linux Example: '/mnt/nas/dispatch-photos'
const NAS_MOUNT_PATH = process.env.NAS_MOUNT_PATH || '\\\\192.168.1.100\\dispatch-photos';

// Configure storage destination
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure destination folder exists
        if (!fs.existsSync(NAS_MOUNT_PATH)) {
            fs.mkdirSync(NAS_MOUNT_PATH, { recursive: true });
        }
        cb(null, NAS_MOUNT_PATH);
    },
    filename: function (req, file, cb) {
        // Retain original filename structure or timestamp it
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use(express.json());

// Status check endpoint
app.get('/status', (req, res) => {
    const nasAccessible = fs.existsSync(NAS_MOUNT_PATH);
    res.json({
        status: 'online',
        nas_path: NAS_MOUNT_PATH,
        nas_accessible: nasAccessible
    });
});

// File upload endpoint
app.post('/upload-to-nas', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    console.log(`Saved file to NAS: ${req.file.path}`);
    res.json({
        success: true,
        file_path: req.file.path,
        filename: req.file.filename
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Local NAS Bridge Service running on port ${PORT}`);
    console.log(`📁 Target SMB Path: ${NAS_MOUNT_PATH}`);
});
