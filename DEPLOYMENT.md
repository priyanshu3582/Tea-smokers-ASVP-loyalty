# Tea Smokers Loyalty — Production Deployment

## 1. Install
Node.js 18+ recommended.

npm install

## 2. Configure
Copy `.env.example` to `.env` and set:
- JWT_SECRET: long random secret
- ADMIN_USER / ADMIN_PASSWORD: staff credentials
- BASE_URL: your HTTPS domain

## 3. Run
npm start

## 4. WhatsApp automation
Create a Meta WhatsApp Business Platform/Cloud API setup, then fill:
WHATSAPP_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_GRAPH_VERSION

The app sends simple text notifications when the API is configured. For production WhatsApp messaging, Meta template/message-policy requirements may apply depending on the message and timing.

## 5. QR flow
Cafe master QR -> customer joins -> customer gets unique QR -> staff scans -> bill amount -> server calculates floor(bill/150) stamps -> customer is notified -> every 10 stamps unlocks a ₹150 reward -> the stamp counter rolls over and the reward is stored in the reward wallet -> staff redeems the wallet reward.

## 6. Important production hardening
- Use HTTPS.
- Keep `.env` private.
- Change default admin credentials.
- Back up `tea-smokers.db`.
- Add separate staff accounts/roles before giving access to multiple employees.
- Consider Postgres/Supabase for a larger multi-branch deployment.
- Add an audit trail and redemption PIN/OTP for fraud prevention.
