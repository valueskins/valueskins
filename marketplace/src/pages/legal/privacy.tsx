'use client';
import Link from 'next/link';
const C = { bg: '#0A0A0A', text: '#F5F5F0', textSecondary: '#B8B4AC', primary: '#C8B89A' };
export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Privacy Policy</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>Last updated: October 8, 2026</p>
        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>1. Introduction</h2>
          <p>Valueskins Pvt. Ltd. ("Company," "we," "us," or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, website, and related services (collectively, the "Platform").</p>
          <p>This Policy is written to meet the Information Technology Act, 2000; the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011; and the Digital Personal Data Protection Act, 2023 (DPDP Act). The Platform is offered in India.</p>
          <p>Please read this Policy carefully. By using the Platform, you consent to the practices described in this Policy. If you do not agree with this Policy, please do not use the Platform.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>2. Information We Collect</h2>
          <p><strong>Account and Profile Information:</strong> Your email address, and the profile details you enter in Settings. For a Creator these are full name, age, gender, city, and Instagram follower count. For a Brand these are brand name, website (optional), city, and Instagram follower count. You may also write a short description of yourself or your brand. We store your age as the age you gave and the date you gave it, so that it can advance each year; we do not ask for your date of birth. We do not collect a password or a phone number: you sign in with Instagram.</p>
          <p><strong>Tax Information:</strong> We do not currently collect Permanent Account Numbers or GST numbers from users. If the law requires us to collect them in future, we will ask you for them and tell you why.</p>
          <p><strong>Payout Details (Creators):</strong> The UPI ID you want to be paid on and the name on that account. We do not verify them. We do not accept or store bank account numbers.</p>
          <p><strong>Deal Data:</strong> The Deals you post or apply to, including the description, amount, dates, applications, the links to content that a Creator shares, a Brand's written feedback, the dates of each step, the UPI payment references a Brand records, and a Creator's confirmations that a payment arrived. For our own fee we keep the payment record from our payment processor. Card and bank details used to pay our fee are handled by Razorpay and are not stored by us. We do not keep a copy of the content itself, and we do not measure how it performs.</p>
          <p><strong>Communication Data:</strong> We keep a log of the emails the Platform sends you (recipient, subject, and time), and of any email you send us. There is no chat or messaging feature on the Platform.</p>
          <p><strong>Instagram Account Data (Meta):</strong> You sign in to ValueSkins with an Instagram professional (Business or Creator) account. With your authorization through Meta's Instagram Login, we receive basic profile information only: your Instagram user ID, your username, and your account type. We use it to sign you in and to show your Instagram username to other Users. We do not read your follower count, media, messages, insights, or analytics from Instagram, and we do not post, comment, message, or act on your behalf. The follower count shown on your ValueSkins profile is the number you enter yourself.</p>
          <p><strong>Usage Data:</strong> Our servers record the requests made to the Platform, such as the page or action requested and the time, for security and troubleshooting.</p>
          <p><strong>Device & Technical Data:</strong> IP address, browser type and version, operating system, device type, unique device identifiers, and other technical information.</p>
          <p><strong>Cookies:</strong> We use the cookies needed to keep you signed in and to remember your cookie choice. See Section 10 for details.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>3. How We Collect Your Information</h2>
          <p><strong>Direct Collection:</strong> You provide information directly when you create an account, complete your profile, create Deals, send messages, submit support requests, or otherwise use the Platform.</p>
          <p><strong>Automatic Collection:</strong> We automatically collect usage and device data when you interact with the Platform through cookies, server logs, and analytics tools.</p>
          <p><strong>Third-Party Sources:</strong> We receive information from Meta when you sign in with Instagram, as described below. We may also receive information from our payment processor (Razorpay) limited to transaction status and identifiers (not full payment details).</p>
          <p><strong>Meta / Instagram:</strong> When you sign in with Instagram, we receive the data described in Section 2 under the single permission <strong>instagram_business_basic</strong>, which you grant on Instagram's consent screen. We do not read any data from an Instagram account other than the one you sign in with.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>4. How We Use Your Information</h2>
          <p>We use your information for the following purposes:</p>
          <p><strong>To Provide Services:</strong> Operate and maintain the Platform's features, including your account, posting and applying to Deals, showing a confirmed Brand where to pay a Creator, recording payments, sending notices by email, and reviewing disputes.</p>
          <p><strong>Sign-in and your profile:</strong> Your Instagram login identifies your account, and your Instagram username is shown on your ValueSkins profile, together with the profile details you entered, so that the other party in a Deal can see who they are working with.</p>
          <p><strong>To Improve the Platform:</strong> Understand how the Platform is used and fix problems. We do not use your personal data for advertising.</p>
          <p><strong>To Communicate with You:</strong> Send administrative messages (account verification, password resets, deal updates), service announcements, technical notices, and support responses.</p>
          <p><strong>To Ensure Safety & Security:</strong> Detect, prevent, and respond to fraud, abuse, security incidents, and violations of our Terms of Service.</p>
          <p><strong>To Comply with Legal Obligations:</strong> Fulfill legal requirements, respond to lawful requests from authorities, and enforce our rights.</p>
          <p><strong>With Your Consent:</strong> For any other purpose disclosed to you at the time of collection, with your consent.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>5. Legal Basis for Processing (GDPR)</h2>
          <p>For users in the European Economic Area (EEA), we process your personal data under the following legal bases:</p>
          <p><strong>Contractual Necessity:</strong> Processing necessary to perform our contract with you (e.g., account management, Deal execution).</p>
          <p><strong>Legitimate Interests:</strong> Processing for our legitimate interests (e.g., improving the Platform, fraud prevention, security) that do not override your fundamental rights.</p>
          <p><strong>Consent:</strong> Processing based on your explicit consent (e.g., marketing communications, non-essential cookies). You may withdraw consent at any time.</p>
          <p><strong>Legal Obligation:</strong> Processing necessary to comply with legal obligations.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>6. Data Sharing & Disclosure</h2>
          <p><strong>Service Providers:</strong> We share data with trusted third-party service providers who help us operate the Platform, subject to contractual obligations to protect your data:</p>
          <p>• <strong>Payment Processing:</strong> Razorpay (INR payments), transaction data necessary to process payments</p>
          <p>• <strong>Hosting & Infrastructure:</strong> Vercel and Render, which host the website and the database</p>
          <p>• <strong>Authentication:</strong> Meta (Instagram Login), to verify your identity when you sign in</p>
          <p>• <strong>Analytics:</strong> We do not use third-party behavioral advertising trackers. Where analytics are used, we process de-identified usage data ourselves or through a processor bound by this Policy, only with your consent where required by law.</p>
          <p>• <strong>Instagram / Meta:</strong> We interact with Meta Platforms solely to sign you in and retrieve the basic Instagram profile data described in Section 2, subject to Meta's Platform Terms. We do not otherwise share your Instagram data with any third party.</p>
          <p>• <strong>Communications:</strong> Zoho Mail, which sends our transactional emails</p>
          <p><strong>Other Users:</strong> Your Instagram username, your profile details, your description, and a summary of your completed Deals are visible to other signed-in Users. Your email address is shown only to Users with whom you share a Deal: the Brand that posted a Deal you applied to or were confirmed on, or a Creator who applied to or was confirmed on your Deal. If you are a Creator, your UPI ID and the name on that account are shown only to a Brand that has confirmed you on a Deal, so that it can pay you. A Brand's written feedback on content is visible to the Creator on that Deal.</p>
          <p><strong>Legal Requirements:</strong> We may disclose your information if required to do so by law, legal process, or governmental request, or if we believe disclosure is necessary to protect our rights, property, or safety, or the rights, property, or safety of others.</p>
          <p><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity. You will be notified of any such change.</p>
          <p><strong>We do not sell your personal information</strong> to third parties for marketing or advertising purposes.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>7. Data Retention</h2>
          <p><strong>Active Accounts:</strong> We retain your information for as long as your account is active and as needed to provide you with services.</p>
          <p><strong>Deleted Accounts:</strong> When you request account deletion, a 30-day grace period begins during which you may cancel the deletion. After 30 days, your personal data is permanently deleted by our automated deletion system. Deal messages are retained for 90 days after deletion for dispute resolution purposes, then permanently deleted. Instagram profile data is retained only while your account is active and is removed upon account deletion.</p>
          <p><strong>Deal Records and Tax Documents:</strong> Deal records, transaction history, invoices, payment status, and associated audit logs are retained for a minimum of seven years as required by Indian tax law, accounting standards, and legal obligations. This is because a deal is a binding agreement between two parties and one party cannot erase the shared record of it.</p>
          <p><strong>Logs:</strong> Server logs containing IP addresses and technical data are retained for 30 days.</p>
          <p><strong>Anonymized Data:</strong> Aggregated, anonymized data that cannot identify you may be retained indefinitely for analytics and platform improvement.</p>
          <p><strong>Legal Holds:</strong> Data may be retained longer if required by applicable law, regulatory obligations, or legal proceedings.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>8. Your Rights & Choices</h2>
          <p><strong>Under the DPDP Act (India):</strong></p>
          <p>• <strong>Right to Access:</strong> Request a summary of your personal data held by us</p>
          <p>• <strong>Right to Correction:</strong> Request correction of inaccurate or incomplete data. Profile details cannot be edited on the Platform after they are saved, apart from your follower count, so to correct a detail entered in error please email us and we will correct it after reasonable verification</p>
          <p>• <strong>Right to Erasure:</strong> Request deletion of your personal data (subject to legal exceptions)</p>
          <p>• <strong>Right to Grievance Redressal:</strong> Lodge complaints regarding data processing</p>
          <p>• <strong>Right to Nominate:</strong> Nominate a person to exercise your rights after your death</p>
          <p><strong>Under the GDPR (EEA Users):</strong></p>
          <p>• <strong>Right to Access:</strong> Obtain confirmation of whether we process your data and request a copy</p>
          <p>• <strong>Right to Rectification:</strong> Correct inaccurate data</p>
          <p>• <strong>Right to Erasure (Right to be Forgotten):</strong> Request deletion of your data</p>
          <p>• <strong>Right to Restrict Processing:</strong> Limit how we use your data</p>
          <p>• <strong>Right to Data Portability:</strong> Receive your data in a structured, commonly used format</p>
          <p>• <strong>Right to Object:</strong> Object to processing based on legitimate interests or direct marketing</p>
          <p>• <strong>Right to Withdraw Consent:</strong> Withdraw consent at any time without affecting lawfulness of prior processing</p>
          <p><strong>Under the CCPA (California Users):</strong></p>
          <p>• <strong>Right to Know:</strong> Request disclosure of data categories collected, sources, purposes, and third parties</p>
          <p>• <strong>Right to Delete:</strong> Request deletion of your personal information</p>
          <p>• <strong>Right to Opt-Out:</strong> Opt out of the sale of your personal information (we do not sell data)</p>
          <p>• <strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising these rights</p>
          <p><strong>To Exercise Your Rights:</strong> Contact us at <a href="mailto:founder@valueskins.com" style={{color: C.primary}}>founder@valueskins.com</a>. We will respond to your request within the timeframes required by applicable law (generally 30 days). We may need to verify your identity before processing your request.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>9. Data Security</h2>
          <p>We take reasonable steps to protect your data:</p>
          <p>• <strong>Encryption in Transit:</strong> Data sent between your browser and the Platform is encrypted using TLS</p>
          <p>• <strong>No Passwords:</strong> We do not hold a password for your account. Sign-in is through Instagram, and your session is kept in a cookie that scripts on the page cannot read</p>
          <p>• <strong>Payment Details:</strong> Card and bank details used to pay our fee are handled by Razorpay and never reach our servers</p>
          <p>• <strong>Limited Access:</strong> Access to the database is restricted to the people who need it to run the Platform</p>
          <p>• <strong>Records of Change:</strong> A change to a Creator's UPI ID is recorded and notified to the account's email address</p>
          <p>Despite these measures, no method of transmission or storage is 100% secure. We cannot guarantee absolute security.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>10. Cookie Policy and Analytics</h2>
          <p>We use cookies and similar technologies to enhance your experience. Here is what we use:</p>
          <p><strong>Essential Cookies:</strong> Required for the Platform to function (session management, CSRF protection, authentication). No consent required. These cannot be disabled.</p>
          <p><strong>Analytics Cookies:</strong> We do not currently use analytics or advertising cookies. If we introduce analytics in future, they will be set only with your consent and this Policy will be updated first.</p>
          <p><strong>Preference Cookies:</strong> Remember your settings and preferences.</p>
          <p><strong>Managing Cookies:</strong> You can control cookies through your browser settings. Disabling essential cookies may affect Platform functionality. You can also use our cookie consent banner to manage your preferences.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>11. International Data Transfers</h2>
          <p>Your data may be transferred to and processed in countries other than your own. Our hosting and service providers operate globally, including in India, the United States, and the European Union.</p>
          <p><strong>GDPR Adequacy:</strong> For EEA users, we ensure appropriate safeguards for data transfers through Standard Contractual Clauses (SCCs) or adequacy decisions as required under applicable law.</p>
          <p><strong>DPDP Act:</strong> For Indian users, data is primarily stored within India. Where data is transferred outside India, we ensure equivalent levels of protection as required under the DPDP Act.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>12. Children's Privacy</h2>
          <p>The Platform is for adults. You must be at least 18 years old to use it, and we do not knowingly collect personal data from anyone under 18. If you believe a person under 18 has given us personal data, please contact us and we will delete it.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>13. Deal Records</h2>
          <p>For each Deal we keep a record of its terms, the dates of each step, the content links shared, the feedback given, and the payments recorded and confirmed. Both parties to the Deal can see and download this record. It is kept so that either party can show what was agreed and what happened.</p>
          <p><strong>Retention:</strong> Deal records are retained as described in Section 7.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>14. Data Deletion</h2>
          <p>To delete your account and data, sign in, open <Link href="/account/data" style={{color: C.primary}}>My Data</Link>, and choose <strong>Delete Account</strong>, or email <a href="mailto:founder@valueskins.com" style={{color: C.primary}}>founder@valueskins.com</a> from the address on your account. You can also remove ValueSkins from your Instagram account at any time under Instagram Settings → Website permissions → Apps and websites. When you request account deletion, the following happens:</p>
          <p>• A 30-day grace period begins during which you may cancel the deletion</p>
          <p>• After 30 days, your personal data is permanently deleted by our automated deletion system</p>
          <p>• Deal messages are deleted as part of this process (retained for 90 days for dispute resolution)</p>
          <p>• Anonymized audit log entries may be retained for legal compliance</p>
          <p>• Backup copies are purged within 90 days</p>
          <p>• Instagram profile data is deleted as part of account deletion</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>15. Grievance Officer (India)</h2>
          <p>In compliance with the Information Technology Act, 2000 and the DPDP Act, 2023, we have appointed a Grievance Officer to address your concerns regarding data processing and privacy:</p>
          <p><strong>Grievance Officer:</strong> Saketh Velamuri<br/>
          <strong>Company:</strong> Valueskins Pvt. Ltd.<br/>
          <strong>Email:</strong> <a href="mailto:founder@valueskins.com" style={{color: C.primary}}>founder@valueskins.com</a></p>
          <p>We will acknowledge your complaint within 24 hours and resolve it within 15 days of receiving it.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>17A. Payment Processing</h2>
          <p><strong>Our fee:</strong> Our fee is paid through our payment processor (currently Razorpay). We do not store, process, or have access to the card or bank details used. <strong>Payments to Creators:</strong> A Brand pays a Creator directly by UPI, outside the Platform. We do not process these payments. We store the Creator's UPI ID and the name on that account, show them to a Brand that has confirmed that Creator, and store the payment reference the Brand records. We do not verify UPI IDs.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>16. Accessibility and Data Processing for Persons with Disabilities</h2>
          <p>Valueskins is committed to ensuring that our Platform is accessible to all users, including persons with disabilities. We process personal data for persons with disabilities in accordance with applicable accessibility laws and standards:</p>
          <p><strong>Accessibility Commitments:</strong></p>
          <p>• We strive to comply with Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards</p>
          <p>• The Platform supports assistive technologies including screen readers, keyboard navigation, and text scaling</p>
          <p>• All images include descriptive alt text for users relying on screen readers</p>
          <p>• Color contrast ratios meet accessibility standards to support users with visual impairments</p>
          <p>• We provide captions or transcripts where relevant for multimedia content</p>
          <p>• Keyboard navigation is fully supported as an alternative to mouse-based interaction</p>
          <p><strong>Data Processing for Accessibility:</strong> We may process additional data related to accessibility features you use (e.g., screen reader detection, accessibility preferences, assistive technology information) solely to enhance your experience and ensure the Platform functions correctly with your accessibility tools. This data is never shared with third parties for marketing or profiling purposes.</p>
          <p><strong>Accessibility Feedback:</strong> If you encounter accessibility barriers or have suggestions for improvement, please contact us at <a href="mailto:founder@valueskins.com" style={{color: C.primary}}>founder@valueskins.com</a>. We welcome your feedback and will respond promptly.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>17. Data Protection Officer (GDPR)</h2>
          <p>          For users in the European Economic Area, you may contact our Data Protection Officer at <a href="mailto:founder@valueskins.com" style={{color: C.primary}}>founder@valueskins.com</a>. You also have the right to lodge a complaint with your local data protection supervisory authority.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>17B. What We Do Not Collect or Do</h2>
          <p>So that you know the limits of what we hold and check:</p>
          <p>• We do not read your follower count, posts, messages, or insights from Instagram. Follower counts are entered by Users and are not verified by us</p>
          <p>• We do not verify identity, age, gender, city, or UPI IDs. We confirm only that a User controls the Instagram account they sign in with</p>
          <p>• We do not store the content a Creator delivers, only the link to it, and we do not track how content performs</p>
          <p>• We do not collect a phone number, a password, a date of birth, a precise location, or a bank account number</p>
          <p>• We do not sell personal data, and we do not use it for advertising</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>18. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or through a prominent notice on the Platform. The "Last updated" date at the top of this Policy indicates when it was last revised. Your continued use of the Platform after the changes take effect constitutes your acceptance of the updated Policy.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>19. Contact Us</h2>
          <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
          <p><strong>Registered Entity:</strong> Valueskins Pvt. Ltd.</p>
          <p><strong>Email:</strong> <a href="mailto:founder@valueskins.com" style={{color: C.primary}}>founder@valueskins.com</a></p>
          
          <p><strong>Support:</strong> <a href="mailto:founder@valueskins.com" style={{color: C.primary}}>founder@valueskins.com</a></p>
          

        </div>
      </div>
    </div>
  );
}
