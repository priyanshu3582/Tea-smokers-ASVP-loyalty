# Tea Smokers Loyalty Pro

Complete starter for Tea Smokers | ASVP Enterprises.

### Customer
QR enrollment, mobile/WhatsApp join, unique customer QR, 10-stamp card, reward status, QR download.

### Staff
Protected login, camera QR scanner (browser BarcodeDetector where supported), customer number fallback, bill entry, automatic stamp calculation, reward redemption.

### Admin
Basic sales/customer/reward stats.

### Business rules
₹150 spent = 1 stamp.
10 stamps = ₹150 OFF.
Example: ₹450 bill = 3 stamps. A customer at 8/10 becomes 1/10 after earning 3 because one 10-stamp reward is unlocked; the reward remains represented by the earned reward counter and can be redeemed when the customer reaches 10 stamps in the card. Rewards are stored as a separate earned/redeemed wallet so crossing 10 stamps creates a redeemable ₹150 reward even when the stamp counter rolls over.

This package is deployable starter software, not a hosted service. A real public deployment needs your domain/hosting and WhatsApp Business credentials.
