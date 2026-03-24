import './LandingPage.css';
import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="landing">
      {/* Ambient background effects */}
      <div className="landing-bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-logo">
            <span className="text-gradient">Rent</span>Sure
          </div>
          <ul className="navbar-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><Link to="/login" className="btn-secondary" style={{ padding: '10px 24px' }}>Sign In</Link></li>
            <li><Link to="/register" className="btn-primary" style={{ padding: '10px 24px' }}>Get Started</Link></li>
          </ul>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge animate-fade-in-up">
              <span className="hero-badge-dot"></span>
              Revolutionizing Rental Security
            </div>
            <h1 className="hero-title animate-fade-in-up anim-delay-1">
              Ditch the Deposit.<br />
              <span className="text-gradient">Embrace Protection.</span>
            </h1>
            <p className="hero-subtitle animate-fade-in-up anim-delay-2">
              Rent-Sure replaces large upfront security deposits with an affordable monthly
              protection plan — giving tenants financial freedom and landlords guaranteed coverage.
            </p>
            <div className="hero-actions animate-fade-in-up anim-delay-3">
              <Link to="/register" className="btn-primary">
                Start Free Trial
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <a href="#how-it-works" className="btn-secondary">
                See How It Works
              </a>
            </div>
            <div className="hero-stats animate-fade-in-up anim-delay-4">
              <div className="hero-stat">
                <span className="hero-stat-value">₹0</span>
                <span className="hero-stat-label">Upfront Deposit</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-value">100%</span>
                <span className="hero-stat-label">Coverage Guarantee</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat">
                <span className="hero-stat-value">Instant</span>
                <span className="hero-stat-label">Claim Processing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header animate-fade-in-up">
            <h2 className="section-title">
              Why Choose <span className="text-gradient">Rent-Sure?</span>
            </h2>
            <p className="section-subtitle">
              A smarter way to handle rental security — for everyone.
            </p>
          </div>
          <div className="features-grid">
            <div className="glass-card feature-card animate-fade-in-up anim-delay-1">
              <div className="feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3>Guaranteed Protection</h3>
              <p>Landlords receive comprehensive coverage against damages and rent defaults — backed by our protection policies.</p>
            </div>
            <div className="glass-card feature-card animate-fade-in-up anim-delay-2">
              <div className="feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <h3>No Upfront Costs</h3>
              <p>Tenants pay a small monthly premium instead of locking up months of rent as a security deposit. Your cash stays yours.</p>
            </div>
            <div className="glass-card feature-card animate-fade-in-up anim-delay-3">
              <div className="feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <h3>Risk Intelligence</h3>
              <p>Our automated risk assessment engine evaluates tenants transparently, ensuring fair premiums and trusted coverage.</p>
            </div>
            <div className="glass-card feature-card animate-fade-in-up anim-delay-4">
              <div className="feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <h3>Seamless Claims</h3>
              <p>Landlords can file claims digitally with evidence uploads. Processed quickly through our streamlined review system.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-section">
        <div className="container">
          <div className="section-header animate-fade-in-up">
            <h2 className="section-title">
              How It <span className="text-gradient">Works</span>
            </h2>
            <p className="section-subtitle">
              Three simple steps to financial freedom.
            </p>
          </div>
          <div className="steps-grid">
            <div className="step-card animate-fade-in-up anim-delay-1">
              <div className="step-number">01</div>
              <h3>Sign Up & Verify</h3>
              <p>Create your account and complete a quick KYC verification to get started.</p>
            </div>
            <div className="step-connector">
              <svg width="40" height="2" viewBox="0 0 40 2"><line x1="0" y1="1" x2="40" y2="1" stroke="var(--accent-1)" strokeWidth="2" strokeDasharray="4 4"/></svg>
            </div>
            <div className="step-card animate-fade-in-up anim-delay-2">
              <div className="step-number">02</div>
              <h3>Choose a Property</h3>
              <p>Browse listed properties and purchase a protection policy with a small monthly premium.</p>
            </div>
            <div className="step-connector">
              <svg width="40" height="2" viewBox="0 0 40 2"><line x1="0" y1="1" x2="40" y2="1" stroke="var(--accent-2)" strokeWidth="2" strokeDasharray="4 4"/></svg>
            </div>
            <div className="step-card animate-fade-in-up anim-delay-3">
              <div className="step-number">03</div>
              <h3>Move In, Stay Protected</h3>
              <p>Enjoy your new home. Landlords are fully covered — tenants keep their savings.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-box glass-card animate-fade-in-up">
            <h2 className="cta-title">
              Ready to eliminate security deposits?
            </h2>
            <p className="cta-subtitle">
              Join thousands of tenants and landlords who have already made the switch to Rent-Sure.
            </p>
            <div className="cta-actions">
              <Link to="/register" className="btn-primary">
                Create Your Account
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <span className="text-gradient">Rent</span>Sure
            </div>
            <p className="footer-copy">© 2026 Rent-Sure. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
