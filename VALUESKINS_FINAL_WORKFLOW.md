# ValueSkins Complete Workflow — FINAL (Revised)

**Date:** 2026-09-23  
**Stack:** Vercel (frontend) + Render (Node.js + PostgreSQL)  
**Payment:** Razorpay (3 transactions per deal)  
**Philosophy:** Instagram is the profile. No negotiation. No escrow. No complexity.

---

## **CORE PRINCIPLES**

1. **Instagram profile = ValueSkins profile**
   - No custom profile fields
   - No bio editing, no niche selection, no rate card entry
   - Instagram data (followers, profile pic, bio) auto-fetches and stays as-is
   - Better Instagram = better ValueSkins profile (user's responsibility)

2. **Creator/Brand type is determined by Instagram and FINAL**
   - Automatic detection from Instagram account (followers, indicators)
   - Non-editable once assigned
   - Example: 50K+ followers + brand-like bio = likely Brand

3. **Zero negotiation**
   - Deal amount is fixed (brand sets it, creator accepts or rejects)
   - No chat boxes, no negotiation medium
   - Creator sees: deal amount, deliverables, deadline → Yes or No
   - If brand wants different amount, create new deal

4. **Virtual resume visible everywhere**
   - Hover over any profile → see virtual resume
   - Shown in deal listings, applications, everywhere
   - Aggregate of Instagram stats + past deals on ValueSkins

5. **No escrow**
   - We never hold money
   - Razorpay handles all payments directly to creator/us
   - No refunds, no disputes (creator's responsibility to deliver)

6. **Everyone equal**
   - No tiers, no levels, no special treatment
   - Same workflow for all creators and brands

7. **Bank details entered once**
   - Creator/Brand enters bank account on first deal
   - Razorpay stores this, not us
   - We store encrypted reference only (for Razorpay API calls)
   - Clear messaging: "Razorpay secures your bank details"

---

## **DEAL FLOW: START TO FINISH**

### **Phase 1: Brand Posts Campaign**

```
Brand clicks "Create Deal"
  
Form (minimal):
  - Title: "Launch Summer Collection"
  - Description: "3 Instagram posts + 1 Reel"
  - Budget (fixed): ₹10,000
  - Deadline: "2026-10-15"
  - Content specifications (text)
  - Target audience (text description, no filter)

→ POST /api/deals
→ Saved to DB: deals table
  {
    id: UUID,
    brand_id: UUID,
    title: "...",
    description: "...",
    budget: 10000,
    deadline: "2026-10-15",
    status: "OPEN",
    created_at: TIMESTAMP
  }

→ Deal goes LIVE on ValueSkins
→ Visible to all creators (no niche/category filtering)
```

---

### **Phase 2: Creators Browse & Apply**

```
Creator sees deal:
  [Deal Card]
  Brand name + Instagram profile (hover → virtual resume)
  "Launch Summer Collection" | ₹10,000 | 3 posts + 1 Reel | Due: Oct 15
  [APPLY BUTTON]

Creator clicks APPLY:
  → POST /api/applications
     {
       deal_id: UUID,
       creator_id: UUID,
       status: "APPLIED"
     }
  
  → DB: applications table
  → Brand sees: "N creators applied"
```

---

### **Phase 3: Brand Reviews & Confirms Creator**

```
Brand opens deal → sees applications list

For each application:
  Creator name + Instagram profile (hover → virtual resume showing past deals)
  
Brand clicks "Confirm" on one creator:
  → PATCH /api/applications/{id}
     {
       status: "CONFIRMED"
     }
  
  → DB: applications.status = CONFIRMED
  → DB: deals.status = "CONFIRMED" (with creator_id assigned)
  → All other applications for this deal: auto-rejected
  
⚠️ AT THIS POINT: Deal is LOCKED. No more applications accepted.
```

---

### **Phase 4: RAZORPAY #1 — Brand Pays Our Commission (₹885 inc GST)**

```
Brand clicks "Proceed to Payment"

System calculates:
  ┌─────────────────────────────────┐
  │ Commission Calculation          │
  ├─────────────────────────────────┤
  │ Commission (Base):      ₹750    │
  │ GST (18%):              ₹135    │
  │ Total Commission:       ₹885    │
  └─────────────────────────────────┘

→ POST /api/deals/{id}/pay-commission
   {
     deal_id: UUID,
     amount: 885
   }

→ Render calls Razorpay API:
   {
     "amount": 88500,  // paise
     "currency": "INR",
     "customer_id": "brand_xxx",
     "description": "ValueSkins Commission",
     "notes": {
       "deal_id": "...",
       "type": "COMMISSION"
     }
   }

→ Razorpay returns: order_id

→ Frontend opens Razorpay checkout modal
  Brand enters card/UPI/bank details
  Payment completed

→ Razorpay webhook: POST /api/webhooks/razorpay
   {
     "event": "payment.captured",
     "payload": {
       "payment": {
         "id": "pay_xxx",
         "status": "captured",
         "amount": 88500,
         "notes": {
           "deal_id": "...",
           "type": "COMMISSION"
         }
       }
     }
   }

→ Render verifies webhook signature ✓
→ DB: payments table
   {
     deal_id: UUID,
     type: "COMMISSION",
     razorpay_payment_id: "pay_xxx",
     amount: 885,
     status: "CONFIRMED",
     created_at: TIMESTAMP
   }

→ DB: deals.status = "COMMISSION_PAID"

✅ Razorpay generates GST-based invoice automatically (via its invoice API)
   This invoice is sent to brand's email
   It will be included in final ADP
```

**RAZORPAY GST INVOICE GENERATION:**
```javascript
// Render backend calls Razorpay Invoice API
await razorpay.invoices.create({
  customer_id: brand.razorpay_customer_id,
  type: "invoice",
  description: "ValueSkins Commission - Deal #123",
  amount: 88500,  // paise
  currency: "INR",
  customer_details: {
    name: brand.name,
    email: brand.email,
    gstin: brand.gstin  // Brand must have provided GSTIN on signup
  },
  line_items: [
    {
      item_name: "Commission",
      description: "ValueSkins Platform Commission (750 + 18% GST)",
      amount: 88500,
      tax_rate: 1800  // 18% GST
    }
  ]
});

// Razorpay auto-generates invoice, sends to brand
// We store invoice_id in DB for later retrieval
```

---

### **Phase 5: RAZORPAY #2 — Brand Pays Creator 30% Advance**

```
System auto-calculates after commission is confirmed:
  ┌──────────────────────────────────────────┐
  │ Advance Calculation                      │
  ├──────────────────────────────────────────┤
  │ Deal Budget:              ₹10,000         │
  │ Less Our Commission:      -₹885           │
  │ Creator Deal Amount:      ₹9,115          │
  │                                          │
  │ 30% Advance:              ₹2,734.50      │
  │ Remaining (70%):          ₹6,380.50      │
  └──────────────────────────────────────────┘

Brand sees:
  "Advance (30%): ₹2,734.50 — Pay Now"
  "Remaining (70%): ₹6,380.50 — Pay after approval"

Brand clicks "Pay Advance":
  → POST /api/deals/{id}/pay-advance
     {
       deal_id: UUID,
       amount: 2734.50
     }

→ Render calls Razorpay API:
   {
     "amount": 273450,  // paise
     "currency": "INR",
     "customer_id": "brand_xxx",
     "receipt": "advance_deal_123_creator_456",
     "description": "Deal Advance (30%) - Launch Summer Collection",
     "notes": {
       "deal_id": "123",
       "type": "ADVANCE",
       "creator_id": "456"
     }
   }

→ Frontend: Razorpay modal opens
  Brand completes payment

→ Razorpay webhook confirms
  
→ DB: payouts table
   {
     deal_id: UUID,
     creator_id: UUID,
     type: "ADVANCE_30%",
     amount: 2734.50,
     razorpay_payment_id: "pay_yyy",
     status: "CONFIRMED",
     created_at: TIMESTAMP
   }

→ DB: deals.status = "ADVANCE_PAID"

⚠️ IMPORTANT: No invoice here (advance is not a separate billing line)
   This payment is recorded in payout ledger for final ADP
```

**NO MANUAL VERIFICATION:**
```
We cannot check if brand "actually paid" the advance.
Razorpay webhook confirms payment reached our account = payment confirmed.
Once webhook fires, deal advances.

If brand doesn't pay advance → deal stays in COMMISSION_PAID state
Creator can see: "Waiting for brand to pay advance..."
```

---

### **Phase 6: Creator Creates Content & Uploads Link**

```
Creator goes to deal page:
  [Status Bar: COMMISSION_PAID → ADVANCE_PAID → WAITING FOR CONTENT]
  
  Content Upload Section:
    "Upload your content (Google Drive link)"
    [Text input for link]
    "Once uploaded, brand will review and approve."
    
  Creator pastes Google Drive link:
    https://drive.google.com/file/d/1abc123.../view
    
  → POST /api/deals/{id}/upload-content
     {
       content_link: "https://drive.google.com/...",
       content_description: "All 3 posts + 1 Reel (locked until brand approval)"
     }

→ DB: deals table
   {
     ...existing fields...,
     content_link: "https://...",
     content_uploaded_at: TIMESTAMP,
     status: "CONTENT_UPLOADED"
   }

→ Brand sees: "Content Uploaded - Review Now"
```

**No chat, no back-and-forth messaging.**

---

### **Phase 7: Brand Reviews Content → Suggests Changes OR Final Approval**

```
Brand opens deal → sees Google Drive link
Brand reviews content on Google Drive (external)

Option A: "Suggest Changes"
  Modal appears:
    "Feedback for creator (optional):"
    [Text area]
    [SEND FEEDBACK]
  
  → POST /api/deals/{id}/suggest-changes
     {
       feedback: "Can you make the first post more vibrant?"
     }
  
  → DB: deals table
     {
       feedback: "Can you make...",
       status: "REVISION_REQUESTED",
       revision_count: 1
     }
  
  → Creator sees: "Brand suggested changes"
  → Creator goes back to Phase 6, uploads new link
  → Repeat until brand is happy

Option B: "Final Approval"
  Brand clicks [FINAL APPROVAL - PROCEED TO PAYMENT]
  
  → DB: deals.status = "APPROVED_FOR_FINAL_PAYMENT"
  → Creator sees: "Brand approved! Payment coming..."
```

**No limit on revisions** (but tracking revision_count for analytics)

---

### **Phase 8: RAZORPAY #3 — Brand Pays Creator Remaining 70%**

```
Once brand clicks FINAL APPROVAL:

System auto-calculates:
  Remaining (70%): ₹6,380.50

Brand clicks "Pay Remaining Amount":
  → POST /api/deals/{id}/pay-remaining
     {
       deal_id: UUID,
       amount: 6380.50
     }

→ Render calls Razorpay API:
   {
     "amount": 638050,  // paise
     "currency": "INR",
     "customer_id": "brand_xxx",
     "receipt": "final_deal_123_creator_456",
     "description": "Deal Final Payment (70%) - Launch Summer Collection",
     "notes": {
       "deal_id": "123",
       "type": "FINAL_PAYMENT",
       "creator_id": "456"
     }
   }

→ Frontend: Razorpay modal
  Brand completes payment

→ Razorpay webhook confirms

→ DB: payouts table
   {
     deal_id: UUID,
     creator_id: UUID,
     type: "FINAL_70%",
     amount: 6380.50,
     razorpay_payment_id: "pay_zzz",
     status: "CONFIRMED",
     created_at: TIMESTAMP
   }

→ DB: deals.status = "COMPLETED"

✅ DEAL IS NOW COMPLETE
```

---

### **Phase 9: ADP Generation (Automatically Downloaded PDF)**

```
Once deal.status = "COMPLETED":

Trigger: Scheduled job OR on-demand via /api/deals/{id}/generate-adp

System generates PDF with:

┌────────────────────────────────────────────────┐
│           DEAL REPORT & INVOICES               │
├────────────────────────────────────────────────┤
│                                                │
│ Deal Summary                                   │
│ ─────────────────────────────────────────────  │
│ Deal Title:        Launch Summer Collection   │
│ Brand:             @brand_instagram           │
│ Creator:           @creator_instagram         │
│ Period:            Sep 15 - Sep 30, 2026      │
│ Status:            COMPLETED                  │
│                                                │
│ Financial Summary                              │
│ ─────────────────────────────────────────────  │
│ Original Budget:                    ₹10,000    │
│ ValueSkins Commission:              ₹885      │
│ Creator Deal Amount:                ₹9,115    │
│                                                │
│ Payments Made                                  │
│ ─────────────────────────────────────────────  │
│ Commission (30% advance paid):      ₹885      │
│ Advance Payment (30%):              ₹2,734.50 │
│ Final Payment (70%):                ₹6,380.50 │
│ TOTAL PAID TO CREATOR:              ₹9,115    │
│                                                │
│ ─────────────────────────────────────────────  │
│ RAZORPAY FEES (Absorbed by us)      ₹XXX      │
│                                                │
├────────────────────────────────────────────────┤
│                                                │
│ INVOICE #1: VALUESKINS COMMISSION              │
│ ──────────────────────────────────────────────  │
│ [Razorpay-generated GST invoice]              │
│ Amount:                             ₹885      │
│ GST Rate:                           18%       │
│ Payment Date:                       Sep 15    │
│ Razorpay Invoice ID:                xxxx      │
│ [Embedded as PDF/image]                       │
│                                                │
│ INVOICE #2: CREATOR ADVANCE PAYMENT            │
│ ──────────────────────────────────────────────  │
│ Creator:           @creator_instagram         │
│ Amount:            ₹2,734.50                  │
│ Description:       30% Advance Payment        │
│ Date:              Sep 20                     │
│ Razorpay Payment ID: pay_yyy                  │
│ [Non-GST invoice - text format]               │
│                                                │
│ INVOICE #3: CREATOR FINAL PAYMENT              │
│ ──────────────────────────────────────────────  │
│ Creator:           @creator_instagram         │
│ Amount:            ₹6,380.50                  │
│ Description:       70% Final Payment          │
│ Date:              Sep 30                     │
│ Razorpay Payment ID: pay_zzz                  │
│ [Non-GST invoice - text format]               │
│                                                │
│ DELIVERY PROOF                                 │
│ ──────────────────────────────────────────────  │
│ Content Link:      https://drive.google...    │
│ Content Type:      3 Instagram Posts + 1 Reel│
│ Uploaded Date:     Sep 25                     │
│ Revisions:         1                          │
│ Final Approval:    Sep 30                     │
│                                                │
└────────────────────────────────────────────────┘

→ Render generates PDF using PDFKit or similar library
→ Stored URL: /api/deals/{id}/download-adp
→ Both creator & brand can download
→ Also sent via email to both parties
```

**GST Invoice Details:**
```
Razorpay invoices system auto-generates GST invoices for our commission.
For creator invoices (advance + final), we generate simple text-based invoices
because creators are presumed to NOT have GST registration (V1).

All three invoices embedded in final ADP PDF.
```

---

## **DATABASE SCHEMA (POSTGRES ON RENDER)**

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
  type ENUM ('CREATOR', 'BRAND') NOT NULL,  -- Auto-determined from Instagram, IMMUTABLE
  email VARCHAR,
  phone VARCHAR,
  
  -- Bank details (entered once)
  bank_account_encrypted VARCHAR,  -- Encrypted hash only, Razorpay stores actual
  razorpay_customer_id VARCHAR,  -- Reference to Razorpay customer
  
  -- GST (Brands only)
  gstin VARCHAR,  -- For invoices
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Deals (formerly Campaigns)
CREATE TABLE deals (
  id UUID PRIMARY KEY,
  brand_id UUID REFERENCES users(id) NOT NULL,
  creator_id UUID REFERENCES users(id),  -- NULL until confirmed
  
  title VARCHAR NOT NULL,
  description TEXT NOT NULL,
  budget INT NOT NULL,  -- Final, non-negotiable amount
  deadline DATE NOT NULL,
  
  content_link VARCHAR,  -- Google Drive link
  content_uploaded_at TIMESTAMP,
  feedback TEXT,  -- Brand's suggestions for revision
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

-- Payments (Commission, Advance, Final)
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) NOT NULL,
  
  type ENUM ('COMMISSION', 'ADVANCE', 'FINAL') NOT NULL,
  amount INT NOT NULL,  -- In rupees
  razorpay_payment_id VARCHAR,
  razorpay_order_id VARCHAR,
  razorpay_invoice_id VARCHAR,  -- For commission invoice
  
  status ENUM ('PENDING', 'CONFIRMED', 'FAILED') DEFAULT 'PENDING',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payouts (Track what creator received)
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

-- ADP Cache (Store generated PDFs for download)
CREATE TABLE adp_reports (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) UNIQUE NOT NULL,
  
  pdf_url VARCHAR,  -- URL to download generated PDF
  generated_at TIMESTAMP DEFAULT NOW()
);
```

---

## **API ENDPOINTS**

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/auth/instagram` | POST | Instagram OAuth callback | Public |
| `/api/me` | GET | Current user profile | Required |
| `/api/users/:username` | GET | View user (for hover virtual resume) | Public |
| `/api/deals` | GET | List all open deals | Required |
| `/api/deals` | POST | Create new deal (brand only) | Brand |
| `/api/deals/:id` | GET | View deal details | Required |
| `/api/applications` | POST | Apply to deal | Creator |
| `/api/applications/:id` | PATCH | Confirm/reject creator | Brand |
| `/api/deals/:id/pay-commission` | POST | Initiate commission payment | Brand |
| `/api/deals/:id/pay-advance` | POST | Initiate advance payment | Brand |
| `/api/deals/:id/upload-content` | POST | Upload content link | Creator |
| `/api/deals/:id/suggest-changes` | POST | Send feedback | Brand |
| `/api/deals/:id/pay-remaining` | POST | Initiate final payment | Brand |
| `/api/deals/:id/generate-adp` | POST | Generate ADP PDF | System (Cron) |
| `/api/deals/:id/download-adp` | GET | Download ADP PDF | Required |
| `/api/webhooks/razorpay` | POST | Razorpay payment webhook | Razorpay |
| `/api/admin/payments` | GET | View all payments (admin only) | Admin |

---

## **PAYMENT FLOW SUMMARY**

```
Deal Amount: ₹10,000
Our Cut (750 + 18% GST): ₹885
Creator Gets (total): ₹9,115

┌──────────────────────────────────────────────┐
│ Payment 1: Commission                        │
├──────────────────────────────────────────────┤
│ Brand pays us:              ₹885             │
│ Status: CONFIRMED by Razorpay webhook       │
│ Invoice: Auto-generated by Razorpay (GST)   │
└──────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────┐
│ Payment 2: 30% Advance                       │
├──────────────────────────────────────────────┤
│ Brand pays creator:         ₹2,734.50       │
│ Status: CONFIRMED by Razorpay webhook       │
│ Invoice: Simple text (non-GST)              │
└──────────────────────────────────────────────┘
         ↓
    Creator uploads content
         ↓
    Brand reviews & approves
         ↓
┌──────────────────────────────────────────────┐
│ Payment 3: 70% Final                         │
├──────────────────────────────────────────────┤
│ Brand pays creator:         ₹6,380.50       │
│ Status: CONFIRMED by Razorpay webhook       │
│ Invoice: Simple text (non-GST)              │
└──────────────────────────────────────────────┘
         ↓
    ADP PDF Generated (all invoices included)
         ↓
    Deal COMPLETED
```

---

## **KEY CONSTRAINTS**

1. ✅ **No escrow**: Money flows directly to creator via Razorpay
2. ✅ **No negotiation**: Deal amount is final (brand sets, creator accepts/rejects)
3. ✅ **No chat**: Only feedback mechanism is "suggest changes" (text only)
4. ✅ **No niche/category**: All deals visible to all creators
5. ✅ **No levels**: Everyone treated equally
6. ✅ **Bank details once**: Stored by Razorpay, reference kept encrypted
7. ✅ **Virtual resume everywhere**: Hover over any profile to see past deals
8. ✅ **Razorpay fees absorbed**: ValueSkins pays, not passed to parties
9. ✅ **30% advance fixed**: Always 30%, never negotiable
10. ✅ **Instagram = profile**: No custom profile fields

---

## **EDGE CASES & HANDLING**

### **Creator doesn't upload content**
```
Cron job (daily at 2 AM UTC):
SELECT * FROM deals WHERE status = 'ADVANCE_PAID' AND deadline < NOW() - 7 days

For each:
  Send email to creator: "Content overdue. Deal in limbo."
  Send email to brand: "Creator hasn't uploaded. Waiting on them."
  
  Deal stays in ADVANCE_PAID state (no auto-refund, no auto-release)
```

### **Brand doesn't pay commission**
```
Creator sees: "Waiting for brand to pay commission..."
Deal stays in CONFIRMED state
After 7 days, auto-email reminders sent
No automatic action (manual intervention needed if escalation)
```

### **Brand pays commission but not advance**
```
Same as above - deal waits until advance is paid
```

### **Creator uploads then deletes Google Drive link**
```
Brand can still see it in deal history (we cached it)
But brand cannot open it
Creator must re-upload new link
Brand clicks suggest changes to notify creator
```

### **Brand rejects content multiple times**
```
No limit on revisions
Each revision creates feedback record
After >5 revisions, system suggests both parties: "Consider closing this deal"
Manual intervention available for disputes
```

---

## **VIRTUAL RESUME (VISIBLE EVERYWHERE)**

Triggered on: Hover over creator/brand profile

```
┌─────────────────────────────────────────┐
│ @creator_instagram                      │
│ 125K followers | 8.5% engagement        │
├─────────────────────────────────────────┤
│                                         │
│ Past Deals on ValueSkins                │
│ ─────────────────────────────────────── │
│                                         │
│ 1. "Summer Collection 2026"             │
│    Brand: @brand1 | Amount: ₹8,000      │
│    Deliverables: 3 posts + 1 Reel       │
│    Status: COMPLETED | Jun 2026         │
│                                         │
│ 2. "Monsoon Campaign"                   │
│    Brand: @brand2 | Amount: ₹5,500      │
│    Deliverables: 2 posts                │
│    Status: COMPLETED | May 2026         │
│                                         │
│ 3. "Fashion Week Collab"                │
│    Brand: @brand3 | Amount: ₹12,000     │
│    Deliverables: 1 Reel + Stories       │
│    Status: CONTENT_UPLOADED (pending)   │
│                                         │
└─────────────────────────────────────────┘
```

Shows:
- Instagram stats (followers, engagement)
- Past 10 deals (most recent first)
- Deal amount, deliverables, status
- Completion date

---

## **GST INVOICING CLARIFICATION**

### **Commission Invoice (GST-based)**
```
Razorpay Invoice API generates this automatically.
Amount: ₹750 base + ₹135 GST = ₹885
Tax Type: 18% GST
Recipient: Brand (has GSTIN)
Razorpay sends to brand's email
Marked as: "Tax Invoice"
```

### **Creator Invoices (Non-GST)**
```
Simple text invoices generated by us (not Razorpay)
Advance Payment: ₹2,734.50
Final Payment: ₹6,380.50
No GST line (creators presumed non-GST in V1)
Format: PDF text (simple, no fancy formatting)
```

### **All Three in ADP**
```
Final ADP PDF includes:
1. Commission invoice (Razorpay-generated, GST)
2. Advance invoice (ValueSkins-generated, non-GST)
3. Final payment invoice (ValueSkins-generated, non-GST)

Plus: Deal summary, payment details, delivery proof
```

---

## **RAZORPAY FEES (ABSORBED BY US)**

```
Commission Payment (₹885):
  Razorpay fee (~2%): ₹17.70
  We pay this, not deducted from brand's payment

Advance Payment (₹2,734.50):
  Razorpay fee (~2%): ₹54.69
  We pay this, not deducted from brand's payment

Final Payment (₹6,380.50):
  Razorpay fee (~2%): ₹127.61
  We pay this, not deducted from brand's payment

Total Razorpay fees: ~₹200 per deal
ValueSkins absorbs this cost.

In our DB, we track:
  commission_razorpay_fee: 17.70
  advance_razorpay_fee: 54.69
  final_razorpay_fee: 127.61
  
For accounting/analytics.
```

---

## **DEAL LIFECYCLE STATE MACHINE**

```
OPEN
  ↓ (Brand confirms creator)
CONFIRMED
  ↓ (Commission paid by brand)
COMMISSION_PAID
  ↓ (Advance paid by brand)
ADVANCE_PAID
  ↓ (Creator uploads content)
CONTENT_UPLOADED
  ↓ (Brand suggests changes)
REVISION_REQUESTED  ←─ (Creator re-uploads, goes back to CONTENT_UPLOADED)
  ↓ (Brand approves)
APPROVED_FOR_FINAL_PAYMENT
  ↓ (Final payment made)
COMPLETED
  ↓ (ADP generated)
[Archive]
```

---

## **SUMMARY: 3 RAZORPAY TRANSACTIONS**

| # | What | Who Pays | Amount | When | Invoice Type |
|---|------|----------|--------|------|--------------|
| 1 | Commission | Brand → Us | ₹885 | After confirmation | GST (Razorpay auto) |
| 2 | Advance (30%) | Brand → Creator | ₹2,734.50 | After commission | Non-GST (us) |
| 3 | Final (70%) | Brand → Creator | ₹6,380.50 | After approval | Non-GST (us) |

**No escrow. Money flows directly to creator.**

---

## **IMPLEMENTATION CHECKLIST**

- [ ] Instagram OAuth auto-detects creator/brand type
- [ ] Bank details form (with Razorpay notice: "Razorpay secures this")
- [ ] Deal creation form (minimal: title, description, budget, deadline)
- [ ] Application system (apply → confirm)
- [ ] Commission payment flow (Razorpay + GST invoice)
- [ ] Advance payment flow (Razorpay, no invoice generation yet)
- [ ] Content upload (Google Drive link only)
- [ ] Revision feedback system
- [ ] Final payment flow (Razorpay)
- [ ] ADP PDF generation (all invoices + payment summary)
- [ ] Virtual resume (hover, shows past deals)
- [ ] Razorpay webhook handler (all 3 payment types)
- [ ] Cron jobs (daily checks for overdue content, email reminders)
- [ ] Admin dashboard (view all payments, disputes)

---

**This is the complete ValueSkins workflow, rebuilt from ground zero.**  
**No file storage, no complex features, no negotiation.**  
**Instagram = Profile. Razorpay = Payments. ADP = Proof.**
