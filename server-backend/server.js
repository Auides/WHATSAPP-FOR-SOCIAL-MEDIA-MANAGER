const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

const MAX_FILE_MB = Number.parseInt(process.env.MAX_FILE_MB || '16', 10);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MAX_FILES = Number.parseInt(process.env.MAX_FILES || '15', 10);
const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];

function loadConfig() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        return {};
    }
}

function saveConfig(config) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

const config = loadConfig();
let appPassword = config.managerPassword || process.env.APP_PASSWORD || '';

// Middleware
app.use(express.static(path.join(__dirname, 'public'))); // Serves the website
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload({
    limits: { fileSize: MAX_FILE_BYTES },
    abortOnLimit: true
}));

// Initialize WhatsApp Client
// LocalAuth stores your session so you do not have to scan QR code every time
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true, // Runs in background
        args: ['--no-sandbox']
    }
});

let isReady = false;
let currentQr = '';

// 1. Generate QR Code for YOU to scan (Terminal + App UI)
client.on('qr', (qr) => {
    currentQr = qr;
    console.log('\nScan this QR Code with your WhatsApp to login:');
    qrcodeTerminal.generate(qr, { small: true });
});

// 2. Log when connected
client.on('ready', () => {
    isReady = true;
    currentQr = '';
    console.log('\nWhatsApp is connected! You can now let your manager access the portal.');
});

function normalizeFiles(fileField) {
    if (!fileField) return [];
    return Array.isArray(fileField) ? fileField : [fileField];
}

function normalizeCaptions(captionsField) {
    if (!captionsField) return [];
    return Array.isArray(captionsField) ? captionsField : [captionsField];
}

function isAllowedMime(file) {
    return ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
}

app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

app.get('/api/qr', async (req, res) => {
    if (currentQr) {
        try {
            const dataUrl = await qrcode.toDataURL(currentQr, { margin: 1, scale: 6 });
            return res.json({ ready: false, qrDataUrl: dataUrl });
        } catch (error) {
            return res.status(500).json({ ready: false, error: 'QR generation failed' });
        }
    }
    return res.json({ ready: isReady, qrDataUrl: '' });
});

app.post('/api/setup', (req, res) => {
    const password = (req.body.password || '').toString().trim();
    const currentPassword = (req.body.currentPassword || '').toString().trim();

    if (!isReady) {
        return res.status(409).json({ ok: false, message: 'Scan the QR code first.' });
    }

    if (appPassword && currentPassword !== appPassword) {
        return res.status(401).json({ ok: false, message: 'Current password is incorrect.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ ok: false, message: 'Password must be at least 6 characters.' });
    }

    appPassword = password;
    saveConfig({ managerPassword: appPassword });
    return res.json({ ok: true });
});

// 3. Handle the Status Upload
app.post('/upload', async (req, res) => {
    if (!isReady) {
        return res.status(503).send('<h1>WhatsApp not connected</h1><p>Please scan the QR code first.</p><a href="/setup">Go to Setup</a>');
    }

    if (!appPassword) {
        return res.status(403).send('<h1>Setup required</h1><p>Please set a manager password first.</p><a href="/setup">Go to Setup</a>');
    }

    // Basic security check
    if (req.body.password !== appPassword) {
        return res.status(401).send('<h1>Wrong Password</h1><a href="/">Try Again</a>');
    }

    const files = normalizeFiles(req.files && req.files.mediaFile);
    const captions = normalizeCaptions(req.body.captions || req.body.caption);
    const textStatus = (req.body.textStatus || '').trim();

    if (files.length === 0 && !textStatus) {
        return res.status(400).send('No text or media provided.');
    }

    if (files.length > MAX_FILES) {
        return res.status(413).send(`Too many files. Max is ${MAX_FILES}.`);
    }

    try {
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];

            if (!isAllowedMime(file)) {
                return res.status(400).send('Unsupported file type. Please upload an image or video.');
            }

            if (file.size > MAX_FILE_BYTES) {
                return res.status(413).send(`File too large. Max size is ${MAX_FILE_MB}MB.`);
            }

            // Convert file to WhatsApp format
            const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
            const caption = captions[i] ? String(captions[i]).trim() : '';
            const options = caption ? { caption } : undefined;

            // Send to Status (status@broadcast is the hidden ID for Status updates)
            await client.sendMessage('status@broadcast', media, options);
        }

        if (textStatus) {
            await client.sendMessage('status@broadcast', textStatus);
        }

        res.send('<h1>Status Posted Successfully!</h1><a href="/">Post Another</a>');
    } catch (error) {
        console.error(error);
        res.status(500).send('<h1>Error Posting Status</h1><p>' + error + '</p>');
    }
});

// Start the server
client.initialize();
app.listen(PORT, () => {
    if (!appPassword) {
        console.warn('[WARN] Manager password is not set. Complete setup in /setup.');
    }
    console.log(`\nServer running. Open http://localhost:${PORT}/setup in your browser.`);
});
