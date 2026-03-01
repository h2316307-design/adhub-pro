import { Client, LocalAuth } from 'whatsapp-web.js';
import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let client: Client | null = null;
let qrCodeData: string | null = null;
let isReady = false;

// Initialize WhatsApp client
function initializeClient() {
  if (client) return;

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', async (qr) => {
    console.log('🔄 QR Code received');
    try {
      qrCodeData = await qrcode.toDataURL(qr);
      isReady = false;
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp client is ready!');
    isReady = true;
    qrCodeData = null;
  });

  client.on('authenticated', () => {
    console.log('✅ Client authenticated');
    isReady = true;
  });

  client.on('auth_failure', () => {
    console.error('❌ Authentication failed');
    isReady = false;
  });

  client.on('disconnected', (reason) => {
    console.log('❌ Client disconnected:', reason);
    isReady = false;
    qrCodeData = null;
  });

  client.initialize().catch(err => {
    console.error('Failed to initialize client:', err);
  });
}

// API Routes

// Get connection status
app.get('/status', (req, res) => {
  res.json({
    connected: isReady,
    hasQR: !!qrCodeData,
    timestamp: new Date().toISOString()
  });
});

// Start connection (returns QR if needed)
app.post('/start', async (req, res) => {
  try {
    if (!client) {
      initializeClient();
    }

    // Wait a bit for QR generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (isReady) {
      return res.json({
        connected: true,
        message: 'Already connected'
      });
    }

    if (qrCodeData) {
      return res.json({
        connected: false,
        qrCode: qrCodeData,
        message: 'Scan QR code with WhatsApp'
      });
    }

    res.json({
      connected: false,
      message: 'Initializing... Please try again in a few seconds'
    });
  } catch (error) {
    console.error('Error starting connection:', error);
    res.status(500).json({
      error: 'Failed to start connection',
      message: (error as Error).message
    });
  }
});

// Disconnect
app.post('/disconnect', async (req, res) => {
  try {
    if (client) {
      await client.destroy();
      client = null;
      isReady = false;
      qrCodeData = null;
    }
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({
      error: 'Failed to disconnect',
      message: (error as Error).message
    });
  }
});

// Send message
app.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body as { phone?: string; message?: string };

    if (!phone || !message) {
      return res.status(400).json({
        error: 'missing_fields',
        message: 'phone and message are required'
      });
    }

    if (!client || !isReady) {
      return res.status(503).json({
        error: 'not_connected',
        message: 'Please connect WhatsApp first'
      });
    }

    // Normalize phone: strip non-digits and leading +, keep country code
    let cleanPhone = phone.replace(/\+/g, '').replace(/[^\d]/g, '');

    // Validate number exists on WhatsApp first (prevents wwebjs internal errors)
    const numberInfo = await client.getNumberId(cleanPhone);
    if (!numberInfo) {
      return res.status(400).json({
        error: 'invalid_number',
        message: 'الرقم غير مسجل على واتساب أو غير صحيح'
      });
    }

    const chatId = numberInfo._serialized; // e.g., 2189xxxxxxxxx@c.us
    console.log(`Sending to: ${chatId}`);

    await client.sendMessage(chatId, message);

    res.json({
      success: true,
      message: 'Message sent successfully',
      to: chatId
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      error: 'send_failed',
      message: (error as Error).message
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'WhatsApp Web.js API',
    status: 'running',
    version: '1.0.0',
    connected: isReady
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   WhatsApp Web.js API Server        ║
║   Running on: http://localhost:${PORT} ║
╚══════════════════════════════════════╝
  `);
  console.log('📱 Initializing WhatsApp client...\n');
  initializeClient();
});