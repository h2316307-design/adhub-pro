# WhatsApp Web.js API Bridge

هذا خادم API محلي يربط بين نظام فارس ووتساب Web.js عبر Supabase Edge Functions.

## التثبيت والتشغيل

### 1. تثبيت التبعيات
```bash
cd WhatsApp
npm install
```

### 2. تشغيل الخادم
```bash
npm start
```

أو للتطوير مع إعادة التشغيل التلقائي:
```bash
npm run dev
```

الخادم سيعمل على: `http://localhost:3001`

### 3. إعداد Supabase Secret

أضف Secret في Supabase باسم `WHATSAPP_BRIDGE_URL`:

**للتطوير المحلي:**
- استخدم ngrok أو localtunnel لفتح نفق عام:
```bash
npx localtunnel --port 3001
```
- انسخ الرابط العام (مثل: `https://xxxx.loca.lt`)
- أضفه كـ Secret في Supabase: `WHATSAPP_BRIDGE_URL`

**للإنتاج:**
- ارفع الخادم على VPS أو Heroku أو Railway
- استخدم الرابط العام (مثل: `https://your-server.com`)

### 4. استخدام النظام

1. شغّل الخادم المحلي: `npm start`
2. افتح صفحة "إعدادات المراسلة" في النظام
3. انتقل إلى تبويب "واتساب Web"
4. اضغط "بدء الاتصال"
5. امسح QR Code بواتساب على هاتفك
6. ابدأ بإرسال الرسائل! 🎉

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | حالة الاتصال |
| `/start` | POST | بدء الاتصال + QR Code |
| `/disconnect` | POST | قطع الاتصال |
| `/send` | POST | إرسال رسالة |

## مثال على إرسال رسالة

```javascript
POST /send
{
  "phone": "218910000000",
  "message": "مرحباً من نظام فارس"
}
```

## ملاحظات مهمة

- الخادم يجب أن يكون قيد التشغيل طوال الوقت لإرسال الرسائل
- يتم حفظ الجلسة في مجلد `.wwebjs_auth`
- لا تحذف مجلد الجلسة وإلا ستحتاج إلى مسح QR مرة أخرى
- للإنتاج، استخدم PM2 أو مدير عمليات للحفاظ على عمل الخادم

## استكشاف الأخطاء

**مشكلة: "Failed to fetch"**
- تأكد من تشغيل الخادم: `npm start`
- تأكد من إضافة `WHATSAPP_BRIDGE_URL` في Supabase Secrets

**مشكلة: "CORS error"**
- الخادم يدعم CORS افتراضياً، لا يحتاج تعديل

**مشكلة: "Client not ready"**
- انتظر حتى يكتمل الاتصال (امسح QR Code)
- تحقق من logs الخادم

## التطوير

للتطوير المحلي، استخدم `localtunnel`:

```bash
# Terminal 1
npm start

# Terminal 2
npx localtunnel --port 3001
```

ثم أضف الرابط الناتج في Supabase Secrets.
