# ValueSkins Build Specification - FINAL

Date: 2026-09-23
Stack: Vercel (Next.js) + Render (Node.js + PostgreSQL)
Payment: Razorpay (3 transactions per deal)

---

## CORE RULES

1. **1 creator per deal** - No multi-creator deals, no creator-creator collabs
2. **Real-time deals via WebSockets** - Creators see new deals instantly without refresh
3. **ADP includes**: Instagram IDs, agreed terms, all 3 invoices, delivery proof
4. **No niche/category filtering** - All deals visible to all creators
5. **Plain black UI** - No gradients, no complexity, no emojis, no AI language
6. **Instagram = profile** - No custom fields, user's responsibility
7. **No negotiation** - Deal amount is final
8. **No escrow** - Direct payments to creator
9. **No chat** - Only "suggest changes" feedback mechanism
10. **No em dashes** - Use regular hyphens only

---

## TECHNOLOGY: WEBSOCKETS FOR REAL-TIME DEALS

Creators should never refresh to see new deals.

### WebSocket Implementation (Socket.io on Render)

```javascript
// Render backend (server)
const io = require('socket.io')(server, {
  cors: { origin: 'https://valueskins.vercel.app', credentials: true }
});

io.on('connection', (socket) => {
  console.log('Creator connected:', socket.id);
  
  // Creator joins a "deals" room on login
  socket.on('join-deals', (creator_id) => {
    socket.join('deals');
    console.log('Creator', creator_id, 'joined deals room');
  });
  
  socket.on('disconnect', () => {
    socket.leave('deals');
  });
});

// When brand creates a deal
app.post('/api/deals', async (req, res) => {
  const deal = await db.query(
    'INSERT INTO deals (...) VALUES (...) RETURNING *',
    [...]
  );
  
  // Broadcast to all connected creators in real-time
  io.to('deals').emit('new-deal', {
    id: deal.id,
    title: deal.title,
    brand: deal.brand_id,
    budget: deal.budget,
    description: deal.description
  });
  
  res.json(deal);
});
```

### Frontend (Vercel - Next.js)

```javascript
// /app/deals/page.tsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const socket = io(process.env.NEXT_PUBLIC_API_URL);
  
  useEffect(() => {
    // Connect to WebSocket
    socket.emit('join-deals', user.id);
    
    // Fetch existing deals on load
    fetch('/api/deals')
      .then(r => r.json())
      .then(data => setDeals(data));
    
    // Listen for new deals in real-time
    socket.on('new-deal', (newDeal) => {
      setDeals(prev => [newDeal, ...prev]);
    });
    
    return () => socket.disconnect();
  }, []);
  
  return (
    <div>
      {deals.map(deal => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  );
}
```

---

## ADP (AUTOMATICALLY DOWNLOADED PDF) - FINAL SPEC

Generated after deal completion. Includes Instagram IDs, all terms, all 3 invoices.

### Contents

```
VALUESKINS DEAL REPORT (ADP)

Generated Date: Sep 30, 2026
Generated Time: 18:30 IST

DEAL IDENTIFIERS
- Brand Instagram ID: ig_brand_12345
- Creator Instagram ID: ig_creator_67890
- Deal ID: deal_123456789

DEAL TERMS AGREED UPON
- Deal Title: Launch Summer Collection
- Brand: @brand_instagram
- Creator: @creator_instagram
- Description: 3 Instagram Posts + 1 Reel
- Deliverables: 3 posts, 1 reel, high-quality content
- Deal Amount: 10,000 INR
- Deal Start Date: Sep 15, 2026
- Deal Deadline: Oct 15, 2026
- Deal Completion Date: Sep 30, 2026

FINANCIAL BREAKDOWN
- Original Budget: 10,000 INR
- ValueSkins Commission (750 + 18% GST): 885 INR
- Creator Deal Amount: 9,115 INR
- Advance (30%): 2,734.50 INR
- Final (70%): 6,380.50 INR

INVOICE 1: VALUESKINS COMMISSION (GST)
- Invoice ID: inv_valueskins_001
- Amount (Base): 750 INR
- GST (18%): 135 INR
- Total: 885 INR
- Payment Date: Sep 15, 2026
- Razorpay Payment ID: pay_abc123
- Status: Confirmed
- Razorpay Invoice Reference: [Full invoice details]

INVOICE 2: CREATOR ADVANCE PAYMENT
- Invoice ID: inv_creator_advance_001
- Creator: @creator_instagram
- Description: 30% Advance Payment
- Amount: 2,734.50 INR
- Payment Date: Sep 20, 2026
- Razorpay Payment ID: pay_def456
- Status: Confirmed

INVOICE 3: CREATOR FINAL PAYMENT
- Invoice ID: inv_creator_final_001
- Creator: @creator_instagram
- Description: 70% Final Payment
- Amount: 6,380.50 INR
- Payment Date: Sep 30, 2026
- Razorpay Payment ID: pay_ghi789
- Status: Confirmed

DELIVERY PROOF
- Content Link: https://drive.google.com/file/d/abc123/view
- Content Type: 3 Instagram Posts + 1 Reel
- Uploaded Date: Sep 25, 2026
- Revisions Requested: 1
- Final Approval Date: Sep 30, 2026

RAZORPAY FEES (Paid by ValueSkins)
- Commission Fee (2%): 17.70 INR
- Advance Fee (2%): 54.69 INR
- Final Fee (2%): 127.61 INR
- Total Fees: 200 INR
```

### PDF Generation

```javascript
// /api/deals/:id/generate-adp
const PDFDocument = require('pdfkit');
const fs = require('fs');

app.post('/api/deals/:id/generate-adp', async (req, res) => {
  const deal = await db.query(
    'SELECT * FROM deals WHERE id = $1',
    [req.params.id]
  );
  
  const creator = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [deal.creator_id]
  );
  
  const brand = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [deal.brand_id]
  );
  
  const payments = await db.query(
    'SELECT * FROM payments WHERE deal_id = $1',
    [req.params.id]
  );
  
  const doc = new PDFDocument();
  const filename = `ADP_Deal_${deal.id}.pdf`;
  
  // Title
  doc.fontSize(16).text('ValueSkins Deal Report (ADP)', { align: 'center' });
  doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
  
  // Identifiers
  doc.fontSize(12).text('Deal Identifiers', { underline: true });
  doc.fontSize(10).text(`Brand Instagram ID: ${brand.instagram_id}`);
  doc.text(`Creator Instagram ID: ${creator.instagram_id}`);
  doc.text(`Deal ID: ${deal.id}`);
  
  // Terms
  doc.fontSize(12).text('Deal Terms Agreed Upon', { underline: true });
  doc.fontSize(10).text(`Title: ${deal.title}`);
  doc.text(`Description: ${deal.description}`);
  doc.text(`Amount: ${deal.budget} INR`);
  doc.text(`Deadline: ${deal.deadline}`);
  
  // Invoices
  doc.fontSize(12).text('Invoices', { underline: true });
  payments.forEach((payment, idx) => {
    doc.fontSize(10).text(`Invoice ${idx + 1}: ${payment.type}`);
    doc.text(`Amount: ${payment.amount} INR`);
    doc.text(`ID: ${payment.razorpay_payment_id}`);
  });
  
  doc.pipe(fs.createWriteStream(filename));
  doc.end();
  
  // Save URL to DB
  const pdfUrl = `/downloads/${filename}`;
  await db.query(
    'INSERT INTO adp_reports (deal_id, pdf_url) VALUES ($1, $2)',
    [deal.id, pdfUrl]
  );
  
  res.json({ url: pdfUrl });
});
```

---

## UI/MESSAGING GUIDELINES

### What We Are (Homepage)

Keep it simple. No fluff, no AI language, no emojis.

```
ValueSkins

Where creators and brands connect to collaborate.

Creators: Browse deals from brands. Accept or decline.
Brands: Post campaigns. Select creators. Pay and track.

No negotiation. No complexity. Direct deals.

[Log in with Instagram]
```

### Color Scheme

- Background: Pure black (#000000)
- Text: White (#FFFFFF)
- Accents: Single color (e.g., bright red #FF0000 for CTAs)
- No gradients
- No shadows
- No AI-style language (no "unlock", "seamlessly", "powered by")

### Language Rules

- No em dashes (--) use hyphens (-)
- No emojis anywhere
- No flowery descriptions
- Direct, plain English only
- Example bad: "Unlock seamless creator collaborations"
- Example good: "Post a deal. Select a creator. Pay. Done."

### Navigation Structure

```
Logged In (Creator):
- Home (deals feed, real-time via WebSocket)
- Applications (my applied deals)
- Deals (my active/completed deals)
- Profile (my Instagram profile, virtual resume)
- Settings (bank details one-time entry)

Logged In (Brand):
- Home (browse creators)
- Campaigns (my created deals)
- Profile (my Instagram profile)
- Settings (bank details one-time entry)

Not Logged In:
- Home (login prompt)
```

---

## DATABASE SCHEMA - UPDATED

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  instagram_id VARCHAR UNIQUE NOT NULL,
  username VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  instagram_profile_pic_url VARCHAR,
  instagram_bio TEXT,
  followers INT,
  type ENUM ('CREATOR', 'BRAND') NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  bank_account_encrypted VARCHAR,
  razorpay_customer_id VARCHAR,
  gstin VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Deals (1 creator per deal)
CREATE TABLE deals (
  id UUID PRIMARY KEY,
  brand_id UUID REFERENCES users(id) NOT NULL,
  creator_id UUID REFERENCES users(id),
  title VARCHAR NOT NULL,
  description TEXT NOT NULL,
  budget INT NOT NULL,
  deadline DATE NOT NULL,
  content_link VARCHAR,
  content_uploaded_at TIMESTAMP,
  feedback TEXT,
  revision_count INT DEFAULT 0,
  status ENUM (
    'OPEN',
    'CONFIRMED',
    'COMMISSION_PAID',
    'ADVANCE_PAID',
    'CONTENT_UPLOADED',
    'REVISION_REQUESTED',
    'APPROVED_FOR_FINAL_PAYMENT',
    'COMPLETED'
  ) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) NOT NULL,
  creator_id UUID REFERENCES users(id) NOT NULL,
  status ENUM ('APPLIED', 'CONFIRMED', 'REJECTED') DEFAULT 'APPLIED',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) NOT NULL,
  type ENUM ('COMMISSION', 'ADVANCE', 'FINAL') NOT NULL,
  amount INT NOT NULL,
  razorpay_payment_id VARCHAR,
  razorpay_order_id VARCHAR,
  razorpay_invoice_id VARCHAR,
  status ENUM ('PENDING', 'CONFIRMED', 'FAILED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payouts
CREATE TABLE payouts (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) NOT NULL,
  creator_id UUID REFERENCES users(id) NOT NULL,
  type ENUM ('ADVANCE_30%', 'FINAL_70%') NOT NULL,
  amount INT NOT NULL,
  razorpay_payment_id VARCHAR,
  status ENUM ('CONFIRMED', 'FAILED') DEFAULT 'CONFIRMED',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ADP Reports
CREATE TABLE adp_reports (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) UNIQUE NOT NULL,
  pdf_url VARCHAR,
  generated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API ENDPOINTS - WEBSOCKET ADDITION

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/instagram` | POST | Instagram OAuth callback |
| `/api/me` | GET | Current user profile |
| `/api/users/:username` | GET | View user (for hover) |
| `/api/deals` | GET | List all open deals |
| `/api/deals` | POST | Create new deal (brand) |
| `/api/deals/:id` | GET | View deal details |
| `/api/applications` | POST | Apply to deal |
| `/api/applications/:id` | PATCH | Confirm/reject creator |
| `/api/deals/:id/pay-commission` | POST | Commission payment |
| `/api/deals/:id/pay-advance` | POST | Advance payment |
| `/api/deals/:id/upload-content` | POST | Upload content link |
| `/api/deals/:id/suggest-changes` | POST | Send feedback |
| `/api/deals/:id/pay-remaining` | POST | Final payment |
| `/api/deals/:id/generate-adp` | POST | Generate ADP PDF |
| `/api/deals/:id/download-adp` | GET | Download ADP PDF |
| `/api/webhooks/razorpay` | POST | Payment webhook |
| `WS /socket.io` | WebSocket | Real-time deals feed |

---

## DEAL FLOW (NO CHANGES, JUST RECAP)

1. Brand posts deal
2. Creators apply (WebSocket broadcasts new deal)
3. Brand confirms creator
4. Brand pays commission (885 INR) - Razorpay
5. Brand pays advance (30%) - Razorpay
6. Creator uploads Google Drive link
7. Brand reviews: suggest changes OR final approval
8. Creator re-uploads if needed
9. Brand final approval
10. Brand pays final (70%) - Razorpay
11. ADP generated with all 3 invoices + Instagram IDs
12. Deal completed

---

## PAYMENT BREAKDOWN (RECAP)

Deal Budget: 10,000 INR
Our Commission: 885 INR (750 + 135 GST)
Creator Gets: 9,115 INR total

Payment 1 (Commission): 885 INR
Payment 2 (Advance 30%): 2,734.50 INR
Payment 3 (Final 70%): 6,380.50 INR

Razorpay Fees (absorbed by us): ~200 INR

---

## IMPLEMENTATION CHECKLIST

Backend (Render)
- [ ] Instagram OAuth auto-detect creator/brand type
- [ ] Bank details form (one-time entry)
- [ ] Deal creation endpoint
- [ ] Application system
- [ ] Commission payment flow
- [ ] Advance payment flow
- [ ] Content upload endpoint
- [ ] Revision feedback system
- [ ] Final payment flow
- [ ] ADP PDF generation (PDFKit)
- [ ] Razorpay webhook handler (all 3 payment types)
- [ ] WebSocket setup (Socket.io) for real-time deals
- [ ] Daily cron: overdue content checks
- [ ] Email notifications

Frontend (Vercel - Next.js)
- [ ] Instagram OAuth flow
- [ ] Creator login
- [ ] Brand login
- [ ] Deals feed (real-time via WebSocket)
- [ ] Apply to deal
- [ ] View applications (brand)
- [ ] Confirm creator
- [ ] Payment flows (Razorpay modal x3)
- [ ] Content upload interface
- [ ] Revision feedback display
- [ ] ADP download button
- [ ] Virtual resume hover (Instagram stats + past deals)
- [ ] Settings: bank details entry
- [ ] Simple black UI, no gradients

---

## NO FILE STORAGE

- No image uploads
- No video hosting
- No ADP PDF storage (generated on-demand)
- Google Drive links only (external, user-managed)
- Instagram URLs for profile pics

---

## NO NEGOTIATION

- Deal amount is final
- No message chat
- Only mechanism: brand can suggest changes to content
- Creator can re-upload
- Brand clicks final approval when satisfied
- That's it

---

## REAL-TIME (WEBSOCKET)

- Creator opens ValueSkins
- New deals appear instantly (no refresh)
- All creators see same deals simultaneously
- No polling, no lag

---

This is the complete spec for building ValueSkins from scratch.
