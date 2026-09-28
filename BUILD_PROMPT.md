# ValueSkins - Build Prompt (Complete)

**Last Updated:** Sep 23, 2026  
**Status:** Ready to Build

---

## TECH STACK

Frontend: Vercel (Next.js, React)
Backend: Render (Node.js, Express/Hono)
Database: PostgreSQL (on Render)
Real-time: Socket.io (WebSockets)
Payments: Razorpay (3 transactions per deal)
Auth: Instagram OAuth only
File Storage: None (Google Drive links only)
External Services: None (no AWS, no Supabase, no nothing)

---

## CORE CONSTRAINTS

1. **1 creator per deal** - No multi-creator, no creator-creator collabs
2. **1 brand per deal** - Brands post, creators apply, 1 confirmed
3. **Real-time deals** - WebSocket broadcast (creators see new deals instantly, no refresh)
4. **No niches** - All deals visible to all creators
5. **No negotiation** - Deal amount is final, non-negotiable
6. **No chat** - Only "suggest changes" feedback (text only)
7. **No escrow** - No holding money, direct payments to creator
8. **Instagram type is final** - Auto-detected (followers, indicators), immutable
9. **Instagram = profile** - Auto-fetch from Instagram, user's responsibility to keep current
10. **Bank details once** - Entered once, Razorpay stores (user must agree to this)
11. **Email required** - Must provide email before entering marketplace (invoices/ADP sent here)
12. **Virtual resume visible everywhere** - Hover over any profile
13. **Plain black UI** - No gradients, no emojis, no em dashes, no AI language
14. **All deals visible** - No filtering by niche/category/level
15. **Everyone equal** - No tiers, no levels, no special treatment
16. **No budget/description limits** - Brands can write as much as needed
17. **Email communication only** - All deal communication via email (visible to both, no hidden chat)
18. **No phone numbers** - Only Instagram + email
19. **Web app only** - No mobile app
20. **No refunds after commission** - Deal cancelled after commission paid = no refund
21. **No cancellation after advance** - UI physically blocks cancellation after 30% paid

---

## EMAIL FLOW (REQUIRED)

### User Signup/Onboarding

1. Creator/Brand logs in with Instagram
2. Instagram data auto-fetched: username, followers, bio, profile pic, engagement rate
3. System asks for email (REQUIRED, cannot proceed without)
4. User enters email
5. Confirmation email sent: "Confirm your email address"
6. User clicks confirmation link
7. User prompted for bank details (one-time)
8. User enters bank account
9. Ready to use marketplace

Email stored in DB, used for:
- All invoices (commission, advance, final)
- ADP PDF delivery
- Deal notifications
- Communication from ValueSkins

### Email Templates & Triggers

Email 1: Deal Created (Brand)
- Sent to: Brand's email
- When: Brand creates deal
- Content: Deal title, description, budget, deadline, link to view deal

Email 2: New Application (Brand)
- Sent to: Brand's email
- When: Creator applies to brand's deal
- Content: Creator name, link to creator's profile, link to approve/reject

Email 3: Application Approved (Creator)
- Sent to: Creator's email
- When: Brand confirms creator
- Content: Deal details, brand name, budget, next steps

Email 4: Commission Payment Confirmed (Both)
- Sent to: Both creator & brand
- When: Commission payment webhook received
- Content: Payment ID, amount (885), Razorpay invoice attached

Email 5: Advance Payment Confirmed (Creator)
- Sent to: Creator's email
- When: Advance payment webhook received
- Content: Payment ID, amount (30% advance), expected in bank in 1-2 days

Email 6: Content Uploaded (Brand)
- Sent to: Brand's email
- When: Creator uploads Google Drive link
- Content: Deal title, link to review content

Email 7: Revision Requested (Creator)
- Sent to: Creator's email
- When: Brand sends feedback
- Content: Feedback text, link to re-upload

Email 8: Final Approval (Creator)
- Sent to: Creator's email
- When: Brand clicks final approval
- Content: Final payment pending, expected in account within 2 days

Email 9: Final Payment Confirmed (Both)
- Sent to: Both creator & brand
- When: Final payment webhook received
- Content: Payment ID, amount (70% final), Razorpay invoice attached

Email 10: ADP Generated (Both)
- Sent to: Both creator & brand
- When: Deal completed
- Content: Deal report PDF attached (all invoices included)

Email 11: Deal Cancelled (Both)
- Sent to: Both creator & brand (if deal cancelled before advance)
- When: Deal cancelled
- Content: Reason, refund status (if applicable)

Disputes:
- Any party can email valueskinsfounder@gmail.com with dispute details
- All dispute emails CC'd to both parties

---

## DEAL DESCRIPTION GUIDELINES FOR BRANDS

Since no chat exists, brands must specify EVERYTHING upfront.

Required fields in description:
1. Content specifications (posts, reels, stories, etc.)
2. Shooting location required? (on-location, studio, home, etc.)
3. Travel allowance provided? (yes/no/amount)
4. Timeline/schedule (shooting dates, posting dates, timing)
5. Content approval process (1 round, unlimited rounds, timeline)
6. Rights to content (usage duration, exclusivity, etc.)
7. Deliverables checklist (exact format, resolution, captions, etc.)
8. Any restrictions (no competitors, no explicit content, etc.)
9. Contact information for delivery (email, address, etc.)

Brand sees example template when creating deal:
```
DEAL TEMPLATE (Fill in all):

Content Type: [3 Instagram Posts + 1 Reel]
Shooting: [On-location required, studio address: XYZ]
Travel: [Travel allowance: 2000 INR]
Timeline: [Shooting: Oct 1-3, posting: Oct 5-7, 1 post per day]
Approval: [1 round of revisions, brand has 2 days to approve]
Rights: [Post content for 6 months from posting date]
Deliverables: [1080x1350 JPG, captions in English + Hindi]
Restrictions: [No competitor brands, no explicit/adult content]
Delivery: [Send all files to: contact@brand.com]

[Additional notes]
```

No character limit on description - brands can write as much as needed.

---

## INSTAGRAM AUTO-FETCH ON SIGNUP

When user logs in with Instagram OAuth:
- Auto-fetch: username, followers, following, bio, profile picture URL, engagement rate
- Store in DB: users table
- Auto-populate: Virtual resume
- Ask user to fill: Email, bank details
- Ask: "Verify this looks correct?" (show fetched data)
- User can proceed without editing (Instagram is their profile)

Data refreshed:
- On every login (followers count might change)
- Once per day (background cron job)

---

## EMAIL COMMUNICATION AUDIT TRAIL

All deal communication via email becomes audit trail:

Visible to both parties:
- All emails sent (searchable history in deal page)
- Who sent what and when
- Attachments (invoices, ADP)

Example:
```
Deal: Launch Summer Collection

Communication:
- Sep 15, 18:30: Brand email "Deal created"
- Sep 16, 09:00: Creator email "You've been approved for this deal"
- Sep 16, 10:15: Brand email "Commission payment confirmed (885 INR)"
- Sep 16, 11:00: Creator email "Advance payment confirmed (2,734.50 INR)"
- Sep 20, 14:30: Creator email "Content uploaded, review on Google Drive"
- Sep 21, 08:00: Brand email "Revision requested - make colors brighter"
- Sep 22, 16:00: Creator email "Updated content uploaded"
- Sep 22, 17:00: Brand email "Final approval given"
- Sep 22, 18:00: Both email "Final payment confirmed (6,380.50 INR)"
- Sep 23, 10:00: Both email "ADP report attached (download PDF)"
```

---

## DEAL DRAFT/SCRIPTING FOR BRANDS

While creating a deal, brands can save draft:
- Auto-save every 30 seconds (browser localStorage)
- Or manual "Save Draft" button
- Draft stored in DB: deals table (status: DRAFT)
- Brand can edit draft anytime before publishing
- Once published (status: OPEN), becomes immutable (no edit, only cancel)

Optional scripting feature:
- Brand can upload script/storyboard as text/attachment in deal description
- Example: "Here's the script for the Reel (write it yourself or use this)"
- Stored as part of deal description

---

## DEAL CANCELLATION RULES

State machine for cancellation:

```
OPEN - Cancellable (brand can cancel anytime, no cost)
  ↓ (creator applies, brand confirms)
CONFIRMED - Cancellable (brand can cancel, no cost)
  ↓ (brand pays commission)
COMMISSION_PAID - NOT cancellable (no refund)
  ↓ (brand pays advance)
ADVANCE_PAID - PHYSICALLY CANNOT CANCEL (UI button hidden)
  ↓ (creator uploads content)
CONTENT_UPLOADED - Cancellable only if brand clicks "Reject Deal"
  ↓ (brand approves)
APPROVED_FOR_FINAL_PAYMENT - NOT cancellable
  ↓ (brand pays final)
COMPLETED - Archived (no cancellation)
```

Cancellation rules:
- Before commission: Brand can cancel, no cost, no refund needed
- After commission but before advance: Brand can cancel, no refund (commission kept by ValueSkins)
- After advance: NO CANCELLATION POSSIBLE (UI blocks it, deal must proceed to completion)
- Creator cannot cancel at any stage
- If deal is cancelled: Creator gets refund if payment already made (only before commission)

---

## ANALYTICS DASHBOARD

URL: /admin/analytics (admin access only)
Real-time fetched from database every 30 seconds

Metrics displayed:

Total Overview:
- Total deals created (all-time)
- Total deals completed (all-time)
- Total creators (active)
- Total brands (active)
- Total value transacted (₹)

This Week:
- Deals created
- Deals completed
- Average deal value
- Average time to completion

This Month:
- Deals created
- Deals completed
- Total revenue (commission from us)
- Creator payouts
- Completion rate (%)

Charts:
- Deals by status (pie chart: OPEN, CONFIRMED, COMMISSION_PAID, ADVANCE_PAID, COMPLETED)
- Daily deals created (line chart, last 30 days)
- Revenue trend (line chart, last 30 days)
- Average payout time (histogram)
- Creator tier breakdown (if we add levels later)

Table:
- Recent deals (title, brand, creator, amount, status, created_at)
- Recent payouts (deal_id, creator, amount, type, status, date)
- Recent disputes (email from valueskinsfounder@gmail.com, summary, status)

All data: Click to drill down into specific deal or creator

---

## RATE LIMITING

Per-user rate limits:

Create deal: 10 deals per 24 hours (per brand)
Apply to deal: 20 applications per 24 hours (per creator)
Upload content: 5 uploads per deal (across all phases)
API requests: 100 requests per minute per user
Razorpay retries: 3 attempts per payment (exponential backoff)

Per-IP rate limits:
Signup: 5 new users per hour per IP
Login attempts: 20 per hour per IP (after 20, 15-min lockout)

Response: 429 Too Many Requests (with Retry-After header)

---

## CORS CONFIGURATION

Frontend (Vercel): https://valueskins.vercel.app (or custom domain)
Backend (Render): https://api.valueskins.render.com (or similar)

CORS allowed:
- Origins: https://valueskins.vercel.app
- Methods: GET, POST, PATCH, DELETE
- Headers: Content-Type, Authorization
- Credentials: true (for cookies/auth)

---

## RAZORPAY INTEGRATION (PRODUCTION ONLY)

No test mode - use provided production keys:
- RAZORPAY_KEY_ID: [provided by user]
- RAZORPAY_KEY_SECRET: [provided by user]

Webhook setup:
- Endpoint: https://api.valueskins.render.com/api/webhooks/razorpay
- Events: payment.authorized, payment.failed
- Signature verification: MANDATORY

Payout setup:
- Enable payouts to creator bank accounts
- Payout mode: NEFT (standard transfer)
- Settlement timing: Next business day

Invoice generation:
- For commission only (GST-based)
- Razorpay invoice API called automatically
- Invoices sent to brand email by Razorpay

---

## DISPUTE HANDLING

Disputes sent to: valueskinsfounder@gmail.com

Process:
1. User sends email to valueskinsfounder@gmail.com
2. Subject: "Dispute: Deal [ID] - [Brief description]"
3. Email auto-CC'd to both parties
4. Manual review by founder/admin
5. Resolution: Refund, force completion, cancellation, etc.
6. Both parties notified via email

No automated dispute resolution (manual intervention required)

---



### Phase 1: Brand Posts Deal
Brand clicks "Create Deal"
Form: Title, Description, Budget (fixed), Application Deadline, Content Upload Deadline, Deal Deadline
Posted to ValueSkins, goes LIVE (status: OPEN)
Broadcast via WebSocket to all creators

Deadlines explained:
- Application Deadline: When creators can no longer apply (e.g., 7 days from now)
- Content Upload Deadline: When creator must upload content by (e.g., 14 days from now)
- Deal Deadline: Overall timeline reference (e.g., 21 days from now, posting date)

### Phase 2: Creators Browse & Apply (REAL-TIME VIA WEBSOCKET)
New deal broadcast to all connected creators instantly
Creators see: Brand name, Instagram hover (virtual resume), Deal amount, Deliverables, Application Deadline, Content Upload Deadline
Creator clicks APPLY (only before application deadline)
After application deadline: APPLY button disabled, message "Applications closed"
Status: OPEN -> N applications (until application deadline expires)

### Phase 3: Brand Confirms Creator
Brand opens deal, sees applications
Brand clicks "Confirm" on one creator
All other applications auto-rejected
Deal locked to this creator
Status: CONFIRMED

### Phase 4: RAZORPAY #1 - Commission Payment
System calculates commission: 750 + 135 GST = 885 INR
Brand sees "Pay Commission: 885 INR"
Brand clicks, Razorpay modal opens
Brand pays 885 INR
Razorpay webhook confirms payment
Razorpay auto-generates GST invoice (sent to brand's email)
Status: COMMISSION_PAID

### Phase 5: RAZORPAY #2 - Advance Payment (30%)
System auto-calculates: (Budget - 885) * 0.30 = Creator's 30% advance
Example: (10000 - 885) * 0.30 = 2,734.50 INR
Brand sees "Pay Advance: 2,734.50 INR"
Brand clicks, Razorpay modal opens
Brand pays 2,734.50 INR
Razorpay webhook confirms
Status: ADVANCE_PAID

### Phase 6: Creator Uploads Content
Creator goes to deal page
Sees: "Upload content by [content_upload_deadline]"
Content upload deadline countdown shown
If creator misses deadline: Email sent "Content overdue. Deal in limbo."
Creator pastes Google Drive link: https://drive.google.com/file/d/abc123/view
Clicks UPLOAD
Status: CONTENT_UPLOADED

### Phase 7: Brand Reviews Content
Brand opens deal, sees Google Drive link
Reviews content on Google Drive (external)

Option A: SUGGEST CHANGES
  Brand enters feedback (text only)
  Clicks SEND FEEDBACK
  Creator sees feedback
  Creator re-uploads new link (goes back to Phase 6)
  Loop until satisfied

Option B: FINAL APPROVAL
  Brand clicks FINAL APPROVAL
  Status: APPROVED_FOR_FINAL_PAYMENT

### Phase 8: RAZORPAY #3 - Final Payment (70%)
System auto-calculates: Creator deal amount - advance already paid
Example: 9,115 - 2,734.50 = 6,380.50 INR
Brand sees "Pay Final: 6,380.50 INR"
Brand clicks, Razorpay modal opens
Brand pays 6,380.50 INR
Razorpay webhook confirms
Status: COMPLETED

### Phase 9: ADP Generated (Automatically)
System generates PDF with:
- Brand Instagram ID
- Creator Instagram ID
- Deal ID
- All terms agreed upon (deliverables, amount, deadline, etc.)
- All 3 invoices (commission GST-based, advance non-GST, final non-GST)
- Delivery proof (Google Drive link, upload date, final approval date)
- Razorpay fees paid by ValueSkins
PDF downloadable by both parties
Email sent to both
Status: COMPLETED (deal archived)

---

## PAYMENT STRUCTURE

Deal Budget: 10,000 INR
Our Commission (750 + 18% GST): 885 INR
Creator Deal Amount: 9,115 INR

Breakdown:
- Payment 1 (Commission): 885 INR (Razorpay fees absorbed by us)
- Payment 2 (Advance 30%): 2,734.50 INR (Razorpay fees absorbed by us)
- Payment 3 (Final 70%): 6,380.50 INR (Razorpay fees absorbed by us)

Total Razorpay fees per deal: ~200 INR (ValueSkins pays, not passed to users)

Invoicing:
- Commission: GST-based (Razorpay auto-generates for brand)
- Advance: Non-GST simple invoice (creators presumed no GST in V1)
- Final: Non-GST simple invoice

All 3 invoices included in ADP PDF.

---

## DATABASE SCHEMA

Users
- id UUID PRIMARY KEY
- instagram_id VARCHAR UNIQUE NOT NULL
- username VARCHAR UNIQUE NOT NULL
- name VARCHAR NOT NULL
- followers INT
- type ENUM (CREATOR, BRAND) NOT NULL - auto-detected, immutable
- instagram_profile_pic_url VARCHAR
- instagram_bio TEXT
- email VARCHAR NOT NULL (required before marketplace access)
- email_verified BOOLEAN DEFAULT false
- bank_account_encrypted VARCHAR (Razorpay stores, we store reference only)
- razorpay_customer_id VARCHAR
- gstin VARCHAR (brands only)
- created_at TIMESTAMP
- updated_at TIMESTAMP
- instagram_last_synced TIMESTAMP (for auto-refresh)

Deals
- id UUID PRIMARY KEY
- brand_id UUID (references users) NOT NULL
- creator_id UUID (references users, NULL until confirmed)
- title VARCHAR NOT NULL
- description TEXT NOT NULL (no character limit, must include all specs)
- budget INT NOT NULL (final, non-negotiable)
- application_deadline DATE NOT NULL (when creators can no longer apply)
- content_upload_deadline DATE NOT NULL (when creator must upload content by)
- deal_deadline DATE NOT NULL (overall deal deadline, for reference)
- content_link VARCHAR (Google Drive URL)
- content_uploaded_at TIMESTAMP
- feedback TEXT (brand's suggestions for revision)
- revision_count INT DEFAULT 0
- status ENUM (DRAFT, OPEN, CONFIRMED, COMMISSION_PAID, ADVANCE_PAID, CONTENT_UPLOADED, REVISION_REQUESTED, APPROVED_FOR_FINAL_PAYMENT, COMPLETED) NOT NULL DEFAULT 'DRAFT'
- created_at TIMESTAMP
- published_at TIMESTAMP (when status changed from DRAFT to OPEN)
- cancelled_at TIMESTAMP (if cancelled)
- cancelled_by_id UUID (creator_id or brand_id, who cancelled)
- cancellation_reason VARCHAR (why was it cancelled?)
- updated_at TIMESTAMP

EmailCommunications
- id UUID PRIMARY KEY
- deal_id UUID (references deals) NOT NULL
- sender_id UUID (references users) NOT NULL
- recipient_id UUID (references users) NOT NULL
- email_type ENUM (DEAL_CREATED, APP_APPROVED, PAYMENT_CONFIRMED, REVISION_REQUESTED, ADP_READY, DEAL_CANCELLED)
- subject VARCHAR
- body TEXT
- attachments VARCHAR[] (file URLs if any, e.g., invoices, ADP)
- sent_at TIMESTAMP
- read_at TIMESTAMP (NULL if unread)
- created_at TIMESTAMP

Applications
- id UUID PRIMARY KEY
- deal_id UUID (references deals)
- creator_id UUID (references users)
- status ENUM (APPLIED, CONFIRMED, REJECTED)
- created_at TIMESTAMP

Payments
- id UUID PRIMARY KEY
- deal_id UUID (references deals)
- type ENUM (COMMISSION, ADVANCE, FINAL)
- amount INT
- razorpay_payment_id VARCHAR
- razorpay_order_id VARCHAR
- razorpay_invoice_id VARCHAR (for commission only)
- status ENUM (PENDING, CONFIRMED, FAILED)
- created_at TIMESTAMP

Payouts
- id UUID PRIMARY KEY
- deal_id UUID (references deals)
- creator_id UUID (references users)
- type ENUM (ADVANCE_30%, FINAL_70%)
- amount INT
- razorpay_payment_id VARCHAR
- status ENUM (CONFIRMED, FAILED)
- created_at TIMESTAMP

AdpReports
- id UUID PRIMARY KEY
- deal_id UUID (references deals, UNIQUE)
- pdf_url VARCHAR
- generated_at TIMESTAMP

---

## API ENDPOINTS

POST /api/auth/instagram - Instagram OAuth callback
GET /api/me - Current user profile
GET /api/users/:username - View user (hover virtual resume)
GET /api/deals - List all open deals (paginated)
POST /api/deals - Create new deal (brand only)
GET /api/deals/:id - View deal details
POST /api/applications - Apply to deal (creator only)
PATCH /api/applications/:id - Confirm/reject creator (brand only)
POST /api/deals/:id/pay-commission - Initiate commission payment
POST /api/deals/:id/pay-advance - Initiate advance payment
POST /api/deals/:id/upload-content - Upload content link (creator only)
POST /api/deals/:id/suggest-changes - Send feedback (brand only)
POST /api/deals/:id/pay-remaining - Initiate final payment
POST /api/deals/:id/generate-adp - Generate ADP PDF (system/cron)
GET /api/deals/:id/download-adp - Download ADP PDF
POST /api/webhooks/razorpay - Razorpay payment webhook (no auth)
WS /socket.io - WebSocket (deals broadcast)

---

## WEBSOCKET IMPLEMENTATION

On brand creates deal:
- io.to('deals').emit('new-deal', {id, title, brand, budget, description})

On creator joins:
- socket.emit('join-deals', creator_id)

On creator page load:
- Fetch existing deals
- Listen for 'new-deal' events
- New deals appear instantly, no refresh needed

---

## ADP PDF CONTENTS

Header: "ValueSkins Deal Report (ADP)"
Generated: [timestamp]

Section 1: Deal Identifiers
- Brand Instagram ID: [ig_id]
- Creator Instagram ID: [ig_id]
- Deal ID: [uuid]

Section 2: Deal Terms Agreed Upon
- Title, Description, Deliverables, Amount, Deadline, Dates

Section 3: Financial Breakdown
- Original budget, commission, creator amount, advance, final

Section 4: Invoice 1 (Commission - GST)
- Amount, GST, Total, Razorpay ID, Date, Status

Section 5: Invoice 2 (Advance - Non-GST)
- Creator name, Amount, Date, Razorpay ID, Status

Section 6: Invoice 3 (Final - Non-GST)
- Creator name, Amount, Date, Razorpay ID, Status

Section 7: Delivery Proof
- Google Drive link, Content type, Upload date, Revisions, Final approval date

Section 8: Razorpay Fees (Absorbed by us)
- Commission fee, Advance fee, Final fee, Total

---

## UI/MESSAGING GUIDELINES

Homepage: "ValueSkins - Where creators and brands connect to collaborate."
No description beyond: What creators do, what brands do.

Color Scheme:
- Background: Black (#000000)
- Text: White (#FFFFFF)
- CTAs: Single accent color (e.g., red #FF0000)
- No gradients, no shadows

Language:
- No em dashes, use hyphens
- No emojis anywhere
- No flowery language ("unlock", "seamlessly", "powered by")
- Direct, plain English

Example copy:
- "Post a deal. Select a creator. Pay. Done."
- "Browse deals. Apply. Agree on amount. Deliver. Get paid."
- Not: "Unlock seamless creator collaborations"

Navigation (Creator):
- Home (deals feed, WebSocket real-time)
- Applications (my applied deals)
- Deals (my active/completed)
- Profile (Instagram profile, virtual resume)
- Settings (bank details)

Navigation (Brand):
- Home (browse creators - TODO: v2)
- Campaigns (my created deals)
- Profile (Instagram profile)
- Settings (bank details)

---

## VIRTUAL RESUME (HOVER)

Triggered on: Hover over any creator/brand profile

Shows:
- Instagram username, followers, engagement rate
- Past 10 deals (most recent first)
- Each deal shows: Brand/Creator name, Amount, Deliverables, Status, Date

---

## IMPLEMENTATION CHECKLIST

Backend (Render Node.js):
- [ ] Instagram OAuth flow (auto-detect creator/brand, auto-fetch followers/bio/pic)
- [ ] Email collection (required before marketplace)
- [ ] Email verification flow (confirmation link)
- [ ] User creation/update with Instagram auto-sync
- [ ] Daily cron: refresh Instagram data (followers, bio, etc.)
- [ ] Deal CRUD operations (status: DRAFT -> OPEN)
- [ ] Deal draft auto-save (every 30 seconds or on demand)
- [ ] Application system
- [ ] Bank details form (one-time)
- [ ] 3x Razorpay payment flows (commission, advance, final)
- [ ] Razorpay webhook handler (payment.authorized, payment.failed)
- [ ] ADP PDF generation (PDFKit library, includes all 3 invoices + Instagram IDs)
- [ ] Virtual resume endpoint
- [ ] WebSocket setup (Socket.io)
- [ ] Real-time deal broadcast (new-deal event)
- [ ] Content upload endpoint
- [ ] Revision feedback system (email notification)
- [ ] Email service integration (11 email templates)
- [ ] Email communication audit trail (EmailCommunications table)
- [ ] Email notification triggers (all phases)
- [ ] Cron job: daily check for overdue content
- [ ] Deal cancellation logic (state machine: allow before advance, block after)
- [ ] Rate limiting middleware (per-user, per-IP)
- [ ] Analytics endpoints (deals count, revenue, creator count, etc.)
- [ ] Dispute handler (email to valueskinsfounder@gmail.com)
- [ ] CORS configuration (Vercel frontend ↔ Render backend)

Frontend (Vercel Next.js):
- [ ] Instagram OAuth redirect
- [ ] Email collection form (required before marketplace)
- [ ] Email verification page
- [ ] Creator login flow
- [ ] Brand login flow
- [ ] Auto-fetch and display Instagram data (followers, bio, pic)
- [ ] Deals feed (WebSocket connected, real-time)
- [ ] Deal card (hover virtual resume)
- [ ] Apply button
- [ ] Creator profile page
- [ ] Brand profile page
- [ ] Application management (brand)
- [ ] 3x Razorpay modal flows
- [ ] Content upload interface
- [ ] Revision feedback display
- [ ] ADP download button
- [ ] Settings: bank details one-time entry
- [ ] Deal creation form (with template guidelines)
- [ ] Deal draft auto-save UI
- [ ] Deal description template (with examples)
- [ ] Deal cancellation button (hidden after advance paid)
- [ ] Email communication history (visible in deal page)
- [ ] Analytics dashboard (/admin/analytics)
- [ ] Analytics charts (deals by status, revenue trend, etc.)
- [ ] Analytics table (recent deals, payouts)
- [ ] Simple black UI layout (no gradients, no emojis)
- [ ] Responsive design (web app, desktop + tablet)

---

## EDGE CASES

Creator misses content upload deadline:
- Cron job checks daily at 23:59 IST
- If content_uploaded_at is NULL and NOW() > content_upload_deadline:
  - Email to creator: "Content overdue by X days. Deal in limbo."
  - Email to brand: "Creator missed content deadline. Deal waiting."
  - Deal stays in ADVANCE_PAID (no auto-refund)
  - Manual intervention needed (reach valueskinsfounder@gmail.com)

Creator doesn't upload content at all:
- Same as above (checks upload deadline daily)
- No auto-refund, no auto-cancellation
- Manual intervention required

Brand doesn't pay commission:
- Creator sees "Waiting for brand payment"
- Deal stays in CONFIRMED
- Daily email reminders to brand
- No auto-cancellation

Creator uploads then deletes Google Drive link:
- Brand still sees it in history (we cached it)
- Brand cannot open (external)
- Brand suggests changes to notify creator to re-upload

No limit on revisions:
- Brand can request unlimited changes
- After 5+ revisions, system suggests both parties consider closing deal
- Manual dispute intervention available

Applications close after deadline:
- Cron job: When application_deadline passes, deal moves to CLOSED_FOR_APPLICATIONS (internal status)
- UI: APPLY button disabled, message "Applications closed"
- Existing applications still visible to brand for confirmation

---

## RAZORPAY SETUP

Integrate Razorpay API (Node.js SDK):
- Customer creation
- Order creation
- Payment capture
- Payout creation
- Invoice generation (for GST commission)
- Webhook handling

Each transaction:
- Verify webhook signature
- Update DB payment status
- Trigger next step in workflow

Fees: All absorbed by ValueSkins (~2% per transaction)

---

## NO FILE STORAGE MEANS

- No image uploads to our servers
- No video hosting
- No ADP PDF permanent storage (generated on-demand)
- Google Drive links only (external, user-managed)
- Instagram URLs for profile pics (linked, not hosted)
- Lean database, no blob/file columns

---

## THIS IS THE COMPLETE SPEC

Build exactly as described.
No changes, no additions, no "nice-to-haves."
Everything is foundational.

Start with: Instagram OAuth -> User table -> Deal creation
Then: Applications -> Brand confirmation
Then: Razorpay integration (3 flows)
Then: Content upload + revision
Then: ADP generation
Then: WebSocket real-time
Then: Email notifications
Then: Polish UI (plain black, no gradients)

---

**Build start date:** 2026-09-23
**Target deployment:** Vercel + Render
**Go-live when:** All 14 backend checklist items + 17 frontend checklist items complete

This is it. Everything needed to build ValueSkins from zero.
