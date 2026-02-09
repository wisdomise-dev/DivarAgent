# DivarAgent

ربات هوش مصنوعی برای استعلام قیمت خودکار در چت دیوار.

## راه‌اندازی

```bash
npm install
```

فایل `.env` بسازید و کلید AvalAI را قرار دهید:

```
GEMINI_API_KEY=your-avalai-api-key
```

## اجرا

```bash
# دشبورد وب (پیشنهادی)
npm run dashboard

# یا CLI
npm start
```

دشبورد: `http://localhost:3344`

## دیپلوی روی Dokploy

1. در Dokploy یک **Application** جدید بسازید.
2. منبع را **GitHub** و ریپو `wisdomise-dev/DivarAgent` انتخاب کنید.
3. متغیرهای محیطی را تنظیم کنید:
   - `GEMINI_API_KEY`: کلید AvalAI
   - `HEADLESS`: `true` (برای Docker)
4. دیپلوی کنید.

Dokploy به‌صورت خودکار از `Dockerfile` پروژه استفاده می‌کند.
