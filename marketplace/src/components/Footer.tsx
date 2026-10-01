'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{
      background: C.surface,
      borderTop: `1px solid ${C.border}`,
      padding: '40px 20px',
      marginTop: '60px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
          marginBottom: '40px',
        }}>
          {/* Brand */}
          <div>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: C.text,
              letterSpacing: '0.18em',
              fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
              marginBottom: '8px',
            }}>
              VALUESKINS
            </h3>
            <div style={{
              fontSize: '9px',
              fontWeight: 500,
              letterSpacing: '0.34em',
              color: C.textSecondary,
              marginBottom: '16px',
            }}>
              TRUST <span style={{ color: C.accent }}>·</span> EARNED <span style={{ color: C.accent }}>·</span> SERIOUS
            </div>
            <p style={{
              fontSize: '13px',
              color: C.textSecondary,
              lineHeight: '1.6',
              marginBottom: '12px',
            }}>
              The marketplace for creators and brands. Fixed prices, paid in stages.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{
              fontSize: '13px',
              fontWeight: 600,
              color: C.text,
              marginBottom: '12px',
              textTransform: 'uppercase',
            }}>
              Legal
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/legal/about" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                About Us
              </Link>
              <Link href="/legal/terms" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Terms of Service
              </Link>
              <Link href="/legal/privacy" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Privacy Policy
              </Link>
              <Link href="/legal/refund" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Refund & Cancellation
              </Link>
              <Link href="/legal/cookies" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Cookie Policy
              </Link>
            </div>
          </div>

          {/* Compliance */}
          <div>
            <h4 style={{
              fontSize: '13px',
              fontWeight: 600,
              color: C.text,
              marginBottom: '12px',
              textTransform: 'uppercase',
            }}>
              Data & Privacy
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/legal/data-request" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Data Access (GDPR/CCPA)
              </Link>
              <Link href="/account/settings" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Delete My Account
              </Link>
              <Link href="/legal/grievance" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Grievance Officer
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{
              fontSize: '13px',
              fontWeight: 600,
              color: C.text,
              marginBottom: '12px',
              textTransform: 'uppercase',
            }}>
              Contact
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/legal/contact" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Contact Us
              </Link>
              <a href="mailto:valueskinsfounder@gmail.com" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                valueskinsfounder@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}>
          <p style={{
            fontSize: '12px',
            color: C.textSecondary,
            margin: 0,
          }}>
            © {currentYear} Valueskins Pvt. Ltd. All rights reserved.
          </p>
          <div style={{
            fontSize: '12px',
            color: C.textSecondary,
          }}>
            Made with care for creators & brands
          </div>
        </div>
      </div>
    </footer>
  );
}
