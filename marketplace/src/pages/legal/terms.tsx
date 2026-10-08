'use client';
import Link from 'next/link';

const C = { bg: '#0A0A0A', text: '#F5F5F0', textSecondary: '#B8B4AC', primary: '#C8B89A' };

const EMAIL = 'founder@valueskins.com';

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>
      {children}
    </h2>
  );
}

function Mail() {
  return <a href={`mailto:${EMAIL}`} style={{ color: C.primary }}>{EMAIL}</a>;
}

export default function Terms() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Terms of Service</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>Last updated: October 8, 2026</p>
        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>

          <H>1. Agreement to Our Legal Terms</H>
          <p>We are Valueskins Pvt. Ltd. (Company, we, us, our), a private limited company incorporated in India.</p>
          <p>We operate the website https://www.valueskins.com (the Site), as well as any other related products and services that refer or link to these legal terms (the Legal Terms) (collectively, the Services or the Platform).</p>
          <p>You can contact us by email at <Mail />.</p>
          <p>These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity (you), and Valueskins Pvt. Ltd., concerning your access to and use of the Services. By accessing the Services, you confirm that you have read, understood, and agreed to be bound by these Legal Terms. If you do not agree with these Legal Terms, you must not use the Services.</p>
          <p>This document is an electronic record under the Information Technology Act, 2000 and the rules made under it. It is published in accordance with Rule 3(1) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and does not require a physical or digital signature.</p>
          <p>The Services are intended for users who are at least 18 years old. Persons under the age of 18 are not permitted to use or register for the Services.</p>
          <p>In these Legal Terms, a Brand is a user who posts a Deal, a Creator is a user who applies to a Deal, and a Deal is a piece of paid work posted by a Brand on the Platform.</p>

          <H>2. Our Services</H>
          <p>ValueSkins is an online platform where Brands post Deals and Creators apply for them. A Brand posts a Deal with a fixed amount. Creators apply. The Brand confirms one Creator. The Creator delivers the content, and the Brand approves it or asks for changes.</p>
          <p><strong>Platform Role:</strong> ValueSkins is an intermediary and a marketplace platform. We are not a party to any Deal. We are not an agent, employer, agency, or representative of any Brand or Creator. We do not employ, endorse, or supervise Creators, and we do not control the quality, safety, or legality of any content or service offered by a user.</p>
          <p><strong>What the Platform does not offer:</strong> The Platform does not offer escrow, does not hold money on behalf of any user, does not offer negotiation of the Deal amount, and does not offer a chat between users. Users communicate by email.</p>
          <p>The Services are offered to users in India. Those who access the Services from other locations do so on their own initiative and are responsible for compliance with local laws.</p>

          <H>3. Your Account and Profile</H>
          <p><strong>Sign in:</strong> You sign in to the Services using your Instagram account. You are responsible for all activity that takes place through your account and for keeping access to your Instagram account secure.</p>
          <p><strong>Email address:</strong> You must provide a working email address before you can use the marketplace. We use it to send confirmations, notices about your Deals, and service messages.</p>
          <p><strong>Profile details:</strong> You must enter true and accurate profile details. For a Creator these are full name, age, gender, city, and Instagram follower count. For a Brand these are brand name, website (optional), city, and Instagram follower count. Profile details are saved once and cannot be changed afterwards, except the follower count, which you must keep up to date.</p>
          <p><strong>What other users see:</strong> Your Instagram username, your profile details, your description, and a summary of your completed Deals are shown to other signed-in users. Your email address is shown to users with whom you share a Deal, meaning the Brand that posted a Deal you applied to or were confirmed on, or a Creator who applied to or was confirmed on your Deal. If you are a Creator, your UPI ID and the name on that account are shown to a Brand that has confirmed you on a Deal, so that it can pay you. By using the Services you consent to this sharing.</p>
          <p><strong>False information:</strong> If you provide information that is untrue, inaccurate, or misleading, we may suspend or terminate your account.</p>

          <H>4. User Representations</H>
          <p>By using the Services, you represent and warrant that: (1) all information you submit is true, accurate, current, and complete; (2) you are at least 18 years old and have the legal capacity to enter into a binding contract under the Indian Contract Act, 1872; (3) if you act on behalf of a business, you are authorised to bind that business; (4) you will not access the Services through automated or non-human means; (5) you will not use the Services for any illegal or unauthorised purpose; and (6) your use of the Services will not violate any applicable law or regulation.</p>

          <H>5. How a Deal Works</H>
          <p><strong>Posting:</strong> A Brand posts a Deal stating what it needs, the Deal amount, the last date to apply, and the date the content is due. The Deal amount is fixed by the Brand and is final. It cannot be negotiated on the Platform.</p>
          <p><strong>Applying:</strong> Any Creator may apply to an open Deal. Applying is an offer to carry out the Deal for the amount and on the terms stated in it.</p>
          <p><strong>Confirmation:</strong> The Brand confirms one Creator. On confirmation, a legally binding agreement is formed between that Brand and that Creator on the terms stated in the Deal, under the Indian Contract Act, 1872. ValueSkins is not a party to that agreement. Each Deal has exactly one Brand and one Creator.</p>
          <p><strong>Delivery:</strong> The Creator must share a link to the content on the Deal page by the due date.</p>
          <p><strong>Review:</strong> The Brand must review the content and either approve it or state in writing on the Deal page what should change. If changes are requested, the Creator shares a new link.</p>
          <p><strong>Record:</strong> The Platform keeps a record of each Deal, including its terms, the dates of each step, and the payments recorded against it. Both parties can download this record.</p>

          <H>6. Our Fee</H>
          <p>ValueSkins charges a flat fee of 750 rupees plus Goods and Services Tax at the applicable rate (currently 18%, making 885 rupees) for each Deal. The Brand pays the fee after confirming a Creator. The fee is deducted from the Deal amount, so the amount payable to the Creator is the Deal amount less the fee.</p>
          <p>There is no sign-up fee, no subscription, and no percentage commission. Browsing and applying are free.</p>
          <p>The fee is paid through our payment processor, currently Razorpay. Card, bank, and wallet details used to pay the fee are handled by the payment processor and are not stored by us. By paying the fee you also agree to the payment processor's terms.</p>
          <p>We may change the fee for future Deals. The fee that applies to a Deal is the fee in force when that Deal was posted.</p>

          <H>7. Payments Between Brand and Creator</H>
          <p><strong>Direct payment:</strong> The Brand pays the Creator directly by UPI, to the UPI ID the Creator has saved on the Platform. The Brand pays 30% of the amount payable to the Creator before work starts, and the remaining 70% after approving the content.</p>
          <p><strong>We do not handle this money:</strong> ValueSkins does not receive, hold, transfer, or control any payment made by a Brand to a Creator. ValueSkins is not a bank, a payment aggregator, a payment system operator, or an escrow agent, and does not provide any of those services. The obligation to pay the Creator rests solely with the Brand.</p>
          <p><strong>Recording a payment:</strong> After paying, the Brand records the UPI reference on the Deal page. The Creator confirms on the Deal page that the payment arrived. A Deal moves forward only when the Creator confirms. You must not record a payment that was not made, and you must not deny a payment that was received.</p>
          <p><strong>UPI IDs Are Not Verified:</strong> ValueSkins does not currently use any third-party service to verify UPI IDs. We do not check that a UPI ID entered on the Platform exists, is active, or belongs to the person who entered it. Each Creator is solely responsible for entering their UPI ID and the name on the account correctly, and for keeping them up to date. Each Brand is solely responsible for checking the payee name shown by their own UPI application before authorising a payment. A payment sent to an incorrect UPI ID cannot be recalled by ValueSkins, and ValueSkins is not liable for any loss arising from an incorrect, mistyped, or out-of-date UPI ID.</p>
          <p><strong>Storage:</strong> We store the Creator's UPI ID and the name on the account in order to show them to a Brand that has confirmed that Creator. We do not accept or store bank account numbers.</p>

          <H>8. Cancellation and Refunds</H>
          <p><strong>Before the fee is paid:</strong> A Brand may cancel a Deal at no cost at any time before it pays the fee.</p>
          <p><strong>After the fee is paid:</strong> Once the fee is paid, the Deal cannot be cancelled through the Platform, and the fee is not refundable, except as stated below.</p>
          <p><strong>Creators:</strong> A Creator cannot cancel a Deal through the Platform after being confirmed. A Creator who cannot carry out a Deal must tell the Brand and us by email without delay.</p>
          <p><strong>When we refund the fee:</strong> We will refund the fee where it was charged more than once for the same Deal, where it was charged because of a technical error on our side, or where a refund is required by applicable law. To ask for a refund, email <Mail /> with the Deal and the payment reference.</p>
          <p><strong>Money paid to a Creator:</strong> ValueSkins cannot refund, reverse, or recover any amount that a Brand has paid directly to a Creator, because that money never passes through us. Any return of such an amount is a matter between the Brand and the Creator.</p>
          <p>More detail is in our <Link href="/legal/refund" style={{ color: C.primary }}>Refund and Cancellation Policy</Link>, which forms part of these Legal Terms.</p>

          <H>9. Content and Usage Rights</H>
          <p><strong>As stated in the Deal:</strong> The rights a Brand receives in the content, including how, where, and for how long it may use it, are whatever the Deal states. ValueSkins sets no default. Brands should state the usage rights they need in the Deal before posting it, and Creators should read them before applying.</p>
          <p><strong>Ownership:</strong> Nothing in these Legal Terms transfers ownership of any content. Unless the Brand and the Creator agree otherwise in writing, the Creator remains the owner of the content they create. A Brand must not use content beyond what the Deal allows.</p>
          <p><strong>Hosting:</strong> Content is shared by link and is hosted outside the Platform. ValueSkins does not host, review, or approve the content, and is not responsible for it.</p>
          <p><strong>Creator warranties:</strong> A Creator warrants that the content they deliver is their own original work or that they hold all rights needed to deliver it, and that it does not infringe the rights of any other person.</p>

          <H>10. Advertising Law and Disclosure</H>
          <p>Creators are responsible for disclosing paid partnerships clearly, as required by the Consumer Protection Act, 2019, the Guidelines for Prevention of Misleading Advertisements and Endorsements for Misleading Advertisements, 2022, the guidelines of the Advertising Standards Council of India, and the rules of the platform on which the content is published. Brands are responsible for the truth and accuracy of any claim they ask a Creator to make. ValueSkins does not review content for compliance.</p>

          <H>11. Taxes</H>
          <p>Each user is solely responsible for all taxes arising from their use of the Services and from their Deals, including Goods and Services Tax, income tax, and any tax required to be deducted at source. A Brand is responsible for deducting and depositing any tax it is required by law to deduct from a payment to a Creator.</p>
          <p>We issue a tax invoice for our fee only. We do not issue invoices on behalf of Creators. Where the law requires us to collect tax details from you, or to deduct or collect tax in respect of a Deal, you agree to provide the details we ask for, such as your Permanent Account Number, and to our doing so.</p>
          <p>ValueSkins does not provide tax advice.</p>

          <H>12. Prohibited Activities</H>
          <p>You must not use the Services except for the purpose for which we make them available. In particular, you must not host, display, upload, publish, transmit, or share any information that:</p>
          <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
            <li>belongs to another person and to which you have no right;</li>
            <li>is obscene, pornographic, paedophilic, invasive of another's privacy including bodily privacy, insulting or harassing on the basis of gender, racially or ethnically objectionable, or relating to or encouraging money laundering or gambling;</li>
            <li>is harmful to a child;</li>
            <li>infringes any patent, trademark, copyright, or other proprietary right;</li>
            <li>deceives or misleads the recipient about the origin of the message, or knowingly communicates misinformation or information that is patently false;</li>
            <li>impersonates another person;</li>
            <li>threatens the unity, integrity, defence, security, or sovereignty of India, friendly relations with foreign States, or public order, or incites the commission of an offence;</li>
            <li>contains a software virus or any other code designed to interrupt, destroy, or limit the functionality of any computer resource; or</li>
            <li>violates any law for the time being in force.</li>
          </ul>
          <p>You must also not: create an account with false details or more than one account; post a Deal you do not intend to pay for; apply to a Deal you do not intend to carry out; record a payment that was not made or deny one that was received; inflate or misstate your follower count; use another user's email address or UPI ID for any purpose other than the Deal you share with them; attempt to gain unauthorised access to the Services; or scrape, copy, or collect data from the Services by automated means.</p>

          <H>13. Intellectual Property Rights</H>
          <p><strong>Our intellectual property:</strong> We are the owner or the licensee of all intellectual property rights in the Services, including the source code, databases, software, website designs, text, and graphics (the Content), and the trademarks, service marks, and logos contained in them (the Marks). The Content and Marks are protected by copyright and trademark laws.</p>
          <p>Subject to your compliance with these Legal Terms, we grant you a non-exclusive, non-transferable, revocable licence to access and use the Services for the purpose of posting, applying to, and carrying out Deals. No part of the Services, Content, or Marks may be copied, reproduced, republished, sold, licensed, or otherwise exploited for any commercial purpose without our prior written permission.</p>
          <p><strong>What you post:</strong> You keep ownership of what you post on the Platform, such as a Deal description or your profile text. You grant us a non-exclusive, royalty-free licence to store, display, and reproduce it for the purpose of operating the Services, for as long as we are required or permitted to keep it.</p>
          <p><strong>Feedback:</strong> If you send us a suggestion about the Services, we may use it without restriction or payment.</p>
          <p><strong>Copyright complaints:</strong> If you believe that anything on the Platform infringes a copyright you own or control, email <Mail /> with a description of the work, where it appears on the Platform, and your contact details. We will act on a valid complaint in accordance with the Copyright Act, 1957 and the rules made under it.</p>

          <H>14. Disputes Between Users</H>
          <p>A dispute about a Deal, including late delivery, non-delivery, the quality of content, non-payment, or a payment sent to the wrong UPI ID, is a dispute between the Brand and the Creator. ValueSkins is not a party to it and is not an arbitrator.</p>
          <p>Either party may email <Mail /> with the Deal and a description of the dispute. A person will review it and may share the Deal record with both parties and suggest a resolution. We do not guarantee any outcome, and we do not compensate either party. We may suspend an account while a dispute is reviewed, and we may mark a Deal as cancelled or completed where the record supports it.</p>
          <p>Nothing in this section prevents either party from pursuing any remedy available to them in law against the other.</p>

          <H>15. Suspension and Termination</H>
          <p>We may suspend or terminate your account, with or without notice, if you breach these Legal Terms, if we are required to do so by law, or if your use of the Services exposes us or other users to risk. Where it is reasonable to do so, we will tell you why.</p>
          <p>You may delete your account at any time from your account settings. Deleting your account does not release you from any Deal you have been confirmed on, or from any amount you owe under it.</p>

          <H>16. Disclaimer</H>
          <p>The Services are provided on an as-is and as-available basis. To the fullest extent permitted by law, we make no warranty that the Services will be uninterrupted or error-free, that any user is who they say they are, that any information a user provides is accurate, that a Creator will deliver, or that a Brand will pay. You use the Services, and deal with other users, at your own risk.</p>

          <H>17. Limitation of Liability</H>
          <p>To the fullest extent permitted by law, ValueSkins is not liable for any indirect, incidental, or consequential loss, any loss of profit, revenue, or data, or any loss arising from the acts or omissions of another user, including non-delivery, non-payment, or a payment sent to an incorrect UPI ID.</p>
          <p>To the fullest extent permitted by law, our total liability to you for any claim arising out of or relating to the Services is limited to the total fees you paid to us in the twelve months before the claim arose.</p>
          <p>Nothing in these Legal Terms limits or excludes any liability that cannot be limited or excluded under applicable law, including liability for fraud.</p>

          <H>18. Indemnity</H>
          <p>You agree to indemnify us against any claim, loss, or expense, including reasonable legal fees, arising out of your breach of these Legal Terms, your breach of any law, your Deals, or any content or information you provide.</p>

          <H>19. Data Protection and Retention</H>
          <p>We process your personal data in accordance with our <Link href="/legal/privacy" style={{ color: C.primary }}>Privacy Policy</Link> and the Digital Personal Data Protection Act, 2023.</p>
          <p>Deal records, including the terms, the dates of each step, the payments recorded, and our fee invoices, are retained for at least seven years, or longer where tax or company law requires. A Deal is an agreement between two parties, and one party cannot erase the shared record of it. Other personal data is retained only for as long as it is needed to provide the Services or as required by law.</p>

          <H>20. Grievance Officer</H>
          <p>In accordance with the Information Technology Act, 2000, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the Consumer Protection (E-Commerce) Rules, 2020, and the Digital Personal Data Protection Act, 2023, we have appointed a Grievance Officer:</p>
          <p><strong>Grievance Officer:</strong> Saketh Velamuri<br/>
          <strong>Company:</strong> Valueskins Pvt. Ltd.<br/>
          <strong>Email:</strong> <Mail /></p>
          <p>We will acknowledge your complaint within 24 hours and resolve it within 15 days of receiving it.</p>

          <H>21. Changes to These Terms</H>
          <p>We may amend these Legal Terms. When we do, we will update the date at the top of this page and tell you by email or by a notice on the Platform. We will also remind you of these Legal Terms at least once a year. Your continued use of the Services after a change takes effect means you accept it. The version that applies to a Deal is the one in force when that Deal was posted.</p>

          <H>22. Governing Law and Jurisdiction</H>
          <p>These Legal Terms are governed by the laws of India. Subject to any right you have under the Consumer Protection Act, 2019 to approach a consumer forum, the courts at Delhi have exclusive jurisdiction over any dispute between you and us.</p>

          <H>23. General</H>
          <p>If any part of these Legal Terms is found to be unenforceable, the rest remains in effect. Our failure to enforce a term is not a waiver of it. These Legal Terms, together with the Privacy Policy and the Refund and Cancellation Policy, are the entire agreement between you and us about the Services.</p>

        </div>
      </div>
    </div>
  );
}
