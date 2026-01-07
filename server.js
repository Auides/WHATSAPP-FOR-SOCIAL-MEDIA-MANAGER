const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fileUpload = require('express-fileupload');

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

// SECURITY: Change this password!
const APP_PASSWORD = process.env.APP_PASSWORD || '12345';
const MAX_FILE_MB = Number.parseInt(process.env.MAX_FILE_MB || '16', 10);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MAX_FILES = Number.parseInt(process.env.MAX_FILES || '15', 10);
const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];

// Middleware
app.use(express.static('public')); // Serves the website
app.use(express.urlencoded({ extended: true }));
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

// 1. Generate QR Code for YOU to scan (Terminal)
client.on('qr', (qr) => {
    console.log('\nScan this QR Code with your WhatsApp to login:');
    qrcode.generate(qr, { small: true });
});

// 2. Log when connected
client.on('ready', () => {
    isReady = true;
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

// 3. Handle the Status Upload
app.post('/upload', async (req, res) => {
    if (!isReady) {
        return res.status(503).send('<h1>WhatsApp not connected</h1><p>Please scan the QR code in the server terminal first.</p><a href="/">Try Again</a>');
    }

    // Basic security check
    if (req.body.password !== APP_PASSWORD) {
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
    if (APP_PASSWORD === '12345') {
        console.warn('[WARN] APP_PASSWORD is using the default value. Set APP_PASSWORD in your environment.');
    }
    console.log(`\nServer running. Open http://localhost:${PORT} in your browser.`);
});