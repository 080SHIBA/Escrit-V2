import { Link } from 'react-router-dom';
import { FileText, HelpCircle, Info, Mail, ShieldCheck, ShoppingBag, Store, Workflow } from 'lucide-react';
import Reveal from '../Reveal.jsx';

const FOOTER_LINKS = [
  [
    ['About', '/#about', Info],
    ['How it works', '/#how-escrow-works', Workflow],
    ['Help centre', '/#faq', HelpCircle],
    ['Contact', '/#faq', Mail],
  ],
  [
    ['Buyer guidance', '/#buyer-guidance', ShoppingBag],
    ['Seller guidance', '/#sell', Store],
    ['Terms', '/#terms', FileText],
    ['Privacy', '/#privacy', ShieldCheck],
  ],
];

const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn'];

function SocialLogo({ platform }) {
  const common = { 'aria-hidden': true, viewBox: '0 0 24 24', fill: 'none', className: 'landing-social-logo' };

  if (platform === 'Instagram') {
    return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.5" cy="6.8" r="1" fill="currentColor" /></svg>;
  }
  if (platform === 'Facebook') {
    return <svg {...common}><path d="M14.2 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H8v3.1h2.8v8h3.4Z" fill="currentColor" /></svg>;
  }
  if (platform === 'TikTok') {
    return <svg {...common}><path d="M15.1 3h3c.2 2.1 1.4 3.5 3.4 3.7v3a8.1 8.1 0 0 1-3.4-1v6.1a6.2 6.2 0 1 1-6.2-6.2c.5 0 1 .1 1.4.2v3.2a3.1 3.1 0 1 0 1.8 2.8V3Z" fill="currentColor" /></svg>;
  }
  return <svg {...common}><path d="M5.2 8.5H2.1V22h3.1V8.5ZM3.7 2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM22 14.3c0-4.1-2.2-6-5.1-6a4.4 4.4 0 0 0-4 2.2V8.5H9.8V22h3.1v-6.7c0-1.8.3-3.6 2.6-3.6s2.4 2.1 2.4 3.7V22H22v-7.7Z" fill="currentColor" /></svg>;
}

function FooterLink({ label, href, Icon }) {
  const content = <><Icon aria-hidden="true" size={16} strokeWidth={1.8} /><span>{label}</span></>;
  if (href.startsWith('/#')) {
    return <Link to={href} className="landing-footer-link">{content}</Link>;
  }
  return <a href={href} className="landing-footer-link">{content}</a>;
}

export default function LandingFooter({ className = '' }) {
  return (
    <Reveal as="footer" id="contact" className={`landing-footer landing-footer-reveal ${className}`}>
      <div className="landing-container">
        <div className="landing-footer-main">
          <div className="landing-footer-brand">
            <Link to="/" className="landing-brand">
              <img src="/logo-icon.png" alt="" width={34} height={34} />
              <span><strong>Escrit</strong><small>Marketplace · Escrow</small></span>
            </Link>
            <p>A marketplace and escrow service for Nigeria.</p>
          </div>
          {FOOTER_LINKS.map((column, index) => (
            <nav key={index} aria-label={index === 0 ? 'Escrit information' : 'Guidance and policies'}>
              <ul>
                {column.map(([label, href, Icon]) => (
                  <li key={label}><FooterLink label={label} href={href} Icon={Icon} /></li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="landing-social" aria-label="Escrit social media profiles">
            <h2>Follow Escrit</h2>
            <ul>
              {SOCIAL_PLATFORMS.map((platform) => (
                <li key={platform}>
                  <span className="landing-social-name"><SocialLogo platform={platform} />{platform}</span>
                  <small>Coming soon</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} Escrit</span>
          <span>Payments in Nigerian Naira</span>
        </div>
      </div>
    </Reveal>
  );
}
