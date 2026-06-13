import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

let wppClient: any = null;
let qrCodeData: string | null = null;
let isReady = false;
let isInitializing = false;

// Initialize WPPConnect client
async function initializeClient() {
  if (isInitializing || isReady) return;
  isInitializing = true;

  try {
    // Dynamic import for WPPConnect
    const wppconnect = await import('@wppconnect-team/wppconnect');

    wppClient = await wppconnect.create({
      session: 'billboard-system',
      catchQR: async (base64Qr: string, asciiQR: string, attempts: number) => {
        console.log('🔄 QR Code received, attempt:', attempts);
        qrCodeData = base64Qr;
        isReady = false;
      },
      statusFind: (statusSession: string, session: string) => {
        console.log('📱 Status:', statusSession);
        if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess') {
          isReady = true;
          qrCodeData = null;
        }
        if (statusSession === 'desconnectedMobile' || statusSession === 'deleteToken') {
          isReady = false;
          qrCodeData = null;
        }
      },
      headless: true,
      devtools: false,
      useChrome: false,
      debug: false,
      logQR: false,
      browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      autoClose: 0,
      createPathFileToken: true,
      folderNameToken: './tokens',
    });

    isReady = true;
    qrCodeData = null;
    isInitializing = false;
    console.log('✅ WPPConnect client is ready!');

    // Listen for disconnect
    wppClient.onStateChange((state: string) => {
      console.log('📱 State changed:', state);
      if (state === 'CONFLICT' || state === 'UNPAIRED' || state === 'UNLAUNCHED') {
        isReady = false;
      }
    });
  } catch (err) {
    console.error('❌ Failed to initialize WPPConnect:', err);
    isInitializing = false;
    isReady = false;
  }
}

// API Routes

// Get connection status
app.get('/status', (req, res) => {
  res.json({
    connected: isReady,
    hasQR: !!qrCodeData,
    provider: 'wppconnect',
    timestamp: new Date().toISOString()
  });
});

// Start connection (returns QR if needed)
app.post('/start', async (req, res) => {
  try {
    if (isReady) {
      return res.json({
        connected: true,
        message: 'Already connected'
      });
    }

    if (!isInitializing) {
      initializeClient();
    }

    // Wait for QR generation
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (isReady) {
      return res.json({
        connected: true,
        message: 'Connected successfully'
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
    if (wppClient) {
      await wppClient.close();
      wppClient = null;
      isReady = false;
      qrCodeData = null;
      isInitializing = false;
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

    if (!wppClient || !isReady) {
      return res.status(503).json({
        error: 'not_connected',
        message: 'Please connect WhatsApp first'
      });
    }

    // Normalize phone: strip non-digits and leading +
    let cleanPhone = phone.replace(/\+/g, '').replace(/[^\d]/g, '');
    const chatId = `${cleanPhone}@c.us`;

    console.log(`📤 Sending to: ${chatId}`);

    // Check if number exists on WhatsApp
    const profile = await wppClient.checkNumberStatus(chatId);
    if (!profile || !profile.numberExists) {
      return res.status(400).json({
        error: 'invalid_number',
        message: 'الرقم غير مسجل على واتساب أو غير صحيح'
      });
    }

    await wppClient.sendText(chatId, message);

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
    service: 'WPPConnect API Bridge',
    status: 'running',
    version: '1.0.0',
    provider: 'wppconnect',
    connected: isReady
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   WPPConnect API Bridge Server       ║
║   Running on: http://localhost:${PORT} ║
╚══════════════════════════════════════╝
  `);
  console.log('📱 Initializing WPPConnect client...\n');
  initializeClient();
});
