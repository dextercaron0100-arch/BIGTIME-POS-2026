import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Download,
  FileCheck2,
  Headset,
  Lock,
  Minus,
  PackageSearch,
  Plus,
  ReceiptText,
  Rocket,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './welcome-page.css'

const proofPoints = [
  {
    icon: Clock3,
    title: 'Live branch visibility',
    description: 'Sales and shift status in one view',
  },
  {
    icon: ShieldCheck,
    title: 'BIR-ready workflows',
    description: 'SI/OR records, X/Z readings, and audit trails',
  },
  {
    icon: Users,
    title: 'Role-based control',
    description: 'Give every team member the right access',
  },
]

const operations = ['Sales', 'Inventory', 'Employees', 'Receipts', 'Reports']

const packagePlans = [
  {
    name: 'Solo',
    audience: 'For single-owner shops with one till.',
    features: ['Core POS & sales tracking', 'Basic inventory', 'Standard reports'],
  },
  {
    name: 'Starter',
    audience: 'For small shops with one branch.',
    features: ['Everything in Solo', 'Multiple terminals', 'Employee accounts'],
  },
  {
    name: 'Growth',
    audience: 'For growing businesses opening new branches.',
    features: ['Everything in Starter', 'Multi-branch management', 'Branch comparison reports'],
  },
  {
    name: 'Multi-Branch',
    audience: 'For operators running several locations.',
    features: ['Everything in Growth', 'Centralized inventory', 'Audit trail across branches'],
  },
  {
    name: 'Franchise',
    audience: 'For franchise and multi-owner setups.',
    features: ['Everything in Multi-Branch', 'Role-based access controls', 'Consolidated reporting'],
  },
  {
    name: 'Enterprise',
    audience: 'For large retail and F&B operations.',
    features: ['Everything in Franchise', 'Full BIR compliance suite', 'Priority support'],
  },
  {
    name: 'Custom',
    audience: 'For businesses with specific needs.',
    features: ['Everything in Enterprise', 'Custom onboarding', 'Dedicated account support'],
  },
]

const gettingStartedSteps = [
  {
    icon: UserPlus,
    title: 'Create your account',
    description: 'Tell us your business name and set an admin code and PIN. Takes a couple of minutes.',
  },
  {
    icon: Building2,
    title: 'We set up your first branch',
    description: 'Your branch and admin login are created automatically — no manual setup on our end.',
  },
  {
    icon: Download,
    title: 'Install the POS app',
    description: 'Run BIGTIME POS on a Windows PC or Android device at the counter.',
  },
  {
    icon: Rocket,
    title: 'Start selling',
    description: 'Full access to every feature for 30 days. No card required to begin.',
  },
]

const faqItems = [
  {
    question: 'What happens when my 30-day trial ends?',
    answer:
      'Access to your workspace is paused until a paid plan is available and selected. We have not announced pricing yet, and we’ll reach out to trial accounts directly when we do.',
  },
  {
    question: 'Do I need a credit card to start?',
    answer: 'No. Signing up only requires your business details, an admin code, and a PIN.',
  },
  {
    question: 'Is BIGTIME POS BIR accredited?',
    answer:
      'BIGTIME POS is built for BIR compliance — sequential SI/OR numbering, X/Z readings, and audit trails are core to the product. Formal BIR accreditation is still in progress, not yet finalized.',
  },
  {
    question: 'Does it work if my internet goes down?',
    answer:
      'The POS terminal app can keep taking sales offline and syncs everything back to your back office once it reconnects.',
  },
  {
    question: 'What hardware do I need?',
    answer:
      'Any Windows PC or Android device that can run the BIGTIME POS app. There’s no proprietary hardware to buy.',
  },
  {
    question: 'Can I manage more than one branch?',
    answer: 'Yes — branches, terminals, and employees can all be managed from a single back office login.',
  },
  {
    question: 'Is my data shared with other businesses on BIGTIME POS?',
    answer:
      'No. Every business’s branches, sales, inventory, and employee data are isolated from every other business on the platform.',
  },
]

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="welcome-faq-list">
      {faqItems.map((item, index) => {
        const isOpen = openIndex === index
        const panelId = `faq-panel-${index}`
        const buttonId = `faq-button-${index}`

        return (
          <div className={`welcome-faq-item${isOpen ? ' is-open' : ''}`} key={item.question}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                {item.question}
                <span aria-hidden="true">{isOpen ? <Minus /> : <Plus />}</span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="welcome-faq-answer"
              hidden={!isOpen}
            >
              <p>{item.answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const backOfficeFeatures = [
  {
    title: 'Reports & Analytics',
    description:
      'Real-time sales, transaction, and shift performance insights to help you make smarter decisions.',
  },
  {
    title: 'Multi-Branch Setup',
    description:
      'Manage every branch under one system with centralized control and unified reporting.',
  },
  {
    title: 'Inventory Management',
    description:
      'Track stock levels, transfers, and low-stock alerts to avoid shortages and overstocking.',
  },
  {
    title: 'Product Mix Insights',
    description: 'See which items and categories sell best so you can optimize what you offer.',
  },
  {
    title: 'Audit Trail',
    description:
      'Every branch, user, and inventory action logged for transparency and accountability.',
  },
]

const trustPoints = [
  {
    icon: ShieldCheck,
    title: 'BIR-ready from day one',
    description:
      'Sequential SI/OR numbering, X/Z readings, and audit trails are built in, not bolted on.',
  },
  {
    icon: Lock,
    title: 'Your data stays yours',
    description:
      'Sales, inventory, and employee records live in your own workspace — never shared across businesses.',
  },
  {
    icon: Building2,
    title: 'Multi-branch, one login',
    description: 'Run every branch and terminal from a single back office.',
  },
  {
    icon: Headset,
    title: 'Real support, not bots',
    description: 'Questions get answered by people who understand the product.',
  },
  {
    icon: CircleCheck,
    title: 'No lock-in surprises',
    description: 'Full access during your 30-day trial. No card required to start.',
  },
  {
    icon: Users,
    title: 'Built for how teams work',
    description:
      'Role-based access keeps cashiers, supervisors, and admins each seeing exactly what they need.',
  },
]

function PackagesCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) {
      return
    }

    const handleScroll = () => {
      const cards = Array.from(track.children) as HTMLElement[]
      const trackCenter = track.scrollLeft + track.clientWidth / 2
      let closest = 0
      let closestDistance = Infinity
      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2
        const distance = Math.abs(cardCenter - trackCenter)
        if (distance < closestDistance) {
          closestDistance = distance
          closest = index
        }
      })
      setActiveIndex(closest)
    }

    handleScroll()
    track.addEventListener('scroll', handleScroll, { passive: true })
    return () => track.removeEventListener('scroll', handleScroll)
  }, [])

  function scrollToIndex(index: number) {
    const track = trackRef.current
    const card = track?.children[index] as HTMLElement | undefined
    if (!track || !card) {
      return
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({
      left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }

  const lastIndex = packagePlans.length - 1

  return (
    <div className="welcome-packages-carousel">
      <button
        type="button"
        className="welcome-carousel-arrow is-prev"
        onClick={() => scrollToIndex(Math.max(activeIndex - 1, 0))}
        disabled={activeIndex === 0}
        aria-label="Previous plan"
      >
        <ChevronLeft aria-hidden="true" />
      </button>

      <div className="welcome-packages-grid" ref={trackRef}>
        {packagePlans.map((plan) => (
          <article className="welcome-package-card" key={plan.name}>
            <h3 className="welcome-package-name">{plan.name}</h3>
            <p className="welcome-package-audience">{plan.audience}</p>
            <ul className="welcome-package-list">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span className="welcome-package-check" aria-hidden="true">
                    <Check />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <span className="welcome-package-status">Pricing to be announced</span>
          </article>
        ))}
      </div>

      <button
        type="button"
        className="welcome-carousel-arrow is-next"
        onClick={() => scrollToIndex(Math.min(activeIndex + 1, lastIndex))}
        disabled={activeIndex === lastIndex}
        aria-label="Next plan"
      >
        <ChevronRight aria-hidden="true" />
      </button>

      <div className="welcome-carousel-dots" role="tablist" aria-label="Select a plan">
        {packagePlans.map((plan, index) => (
          <button
            key={plan.name}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Go to ${plan.name} plan`}
            className={`welcome-carousel-dot${index === activeIndex ? ' is-active' : ''}`}
            onClick={() => scrollToIndex(index)}
          />
        ))}
      </div>
    </div>
  )
}

const workflowCards = [
  {
    number: '01',
    icon: BarChart3,
    eyebrow: 'See clearly',
    title: 'Know today’s sales at a glance',
    description:
      'Follow revenue, transactions, payment mix, and shift activity without waiting for end-of-day spreadsheets.',
    items: ['Live branch comparison', 'Payment and receipt history', 'Shift performance tracking'],
  },
  {
    number: '02',
    icon: PackageSearch,
    eyebrow: 'Stay in control',
    title: 'Keep every stockroom in sync',
    description:
      'See what is on hand, what is moving, and what needs attention across branches and warehouses.',
    items: ['Stock and transfer visibility', 'Supplier and purchase orders', 'Catalog and pricing controls'],
  },
  {
    number: '03',
    icon: FileCheck2,
    eyebrow: 'Close confidently',
    title: 'Prepare reports with less rework',
    description:
      'Bring cash balancing, VAT details, discounts, X/Z readings, and eSales preparation into one workflow.',
    items: ['VAT and discount breakdowns', 'X/Z reading records', 'Audit-ready exports'],
  },
]

function scrollToWorkflows() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById('welcome-workflows')?.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  })
}

export function WelcomePage() {
  return (
    <div className="welcome-page">
      <a className="welcome-skip-link" href="#welcome-main">
        Skip to content
      </a>

      <header className="welcome-nav">
        <div className="welcome-nav-inner">
          <Link to="/welcome" className="welcome-brand" aria-label="BIGTIME POS home">
            <span className="welcome-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </span>
            <span>
              BIGTIME <em>POS</em>
            </span>
          </Link>

          <nav className="welcome-nav-links" aria-label="Primary">
            <button type="button" onClick={scrollToWorkflows}>
              Platform
            </button>
            <button type="button" onClick={scrollToWorkflows}>
              How it works
            </button>
          </nav>

          <div className="welcome-nav-actions">
            <Link to="/login" className="welcome-login-link">
              Log in
            </Link>
            <Link to="/signup" className="welcome-cta-btn welcome-nav-cta">
              Start free
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="welcome-main">
        <section className="welcome-hero" aria-labelledby="welcome-hero-title">
          <div className="welcome-hero-glow is-left" aria-hidden="true" />
          <div className="welcome-hero-glow is-right" aria-hidden="true" />

          <div className="welcome-hero-grid">
            <div className="welcome-hero-content">
              <p className="welcome-eyebrow">
                <Store aria-hidden="true" />
                Back-office control for Philippine retail
              </p>

              <h1 className="welcome-hero-title" id="welcome-hero-title">
                One back office. <span>Every branch in rhythm.</span>
              </h1>

              <p className="welcome-hero-copy">
                See live sales, inventory, staff access, and BIR-ready records in one
                calm operating view—built for the pace of Philippine retail.
              </p>

              <div className="welcome-hero-actions">
                <Link to="/signup" className="welcome-cta-btn welcome-hero-cta">
                  Start your free 30-day trial
                  <ArrowRight aria-hidden="true" />
                </Link>
                <button type="button" onClick={scrollToWorkflows} className="welcome-text-btn">
                  See the workflow
                  <ChevronDown aria-hidden="true" />
                </button>
              </div>

              <p className="welcome-trial-note">
                <CircleCheck aria-hidden="true" />
                Full access. No card required to start.
              </p>

              <div className="welcome-hero-footnote" aria-label="Included in your workspace">
                <span>Multi-branch ready</span>
                <span>VAT &amp; discounts</span>
                <span>X/Z readings</span>
              </div>
            </div>

            <div className="welcome-hero-visual">
              <div
                className="welcome-dashboard-preview"
                role="img"
                aria-label="Sample BIGTIME POS back-office dashboard showing sales and branch status"
              >
                <div className="welcome-preview-topbar">
                  <div className="welcome-preview-product">
                    <span aria-hidden="true">B</span>
                    <strong>BIGTIME</strong>
                  </div>
                  <div className="welcome-preview-controls">
                    <span className="welcome-preview-label">Today · All branches</span>
                    <span className="welcome-live-pill"><i aria-hidden="true" /> Live</span>
                    <Bell aria-hidden="true" />
                    <span className="welcome-preview-avatar" aria-hidden="true">AM</span>
                  </div>
                </div>

                <div className="welcome-preview-body">
                  <aside className="welcome-preview-sidebar" aria-hidden="true">
                    <span className="is-active"><BarChart3 /></span>
                    <span><ReceiptText /></span>
                    <span><Boxes /></span>
                    <span><Building2 /></span>
                  </aside>

                  <div className="welcome-preview-content">
                    <div className="welcome-preview-heading">
                      <div>
                        <span>Operations overview</span>
                        <strong>Good morning, Ana</strong>
                      </div>
                      <span className="welcome-preview-date">Wed, 22 July</span>
                    </div>

                    <div className="welcome-preview-stats">
                      <div className="welcome-preview-stat is-primary">
                        <span>Net sales</span>
                        <strong>₱184,250</strong>
                        <small><ArrowUpRight aria-hidden="true" /> 12.4% vs yesterday</small>
                      </div>
                      <div className="welcome-preview-stat">
                        <span>Transactions</span>
                        <strong>312</strong>
                        <small>₱590 average sale</small>
                      </div>
                      <div className="welcome-preview-stat">
                        <span>Open shifts</span>
                        <strong>6</strong>
                        <small>Across 3 branches</small>
                      </div>
                    </div>

                    <div className="welcome-preview-lower">
                      <div className="welcome-preview-chart">
                        <div className="welcome-preview-panel-title">
                          <div>
                            <span>Sales today</span>
                            <strong>₱184,250</strong>
                          </div>
                          <small><TrendingUp aria-hidden="true" /> On track</small>
                        </div>
                        <div className="welcome-chart-area" aria-hidden="true">
                          <svg viewBox="0 0 320 112" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="welcome-chart-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#14a399" stopOpacity=".32" />
                                <stop offset="100%" stopColor="#14a399" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <path className="welcome-chart-fill" d="M0 96 C30 94 39 82 65 84 S102 70 125 72 S154 51 180 58 S222 42 244 48 S278 24 320 28 L320 112 L0 112 Z" />
                            <path className="welcome-chart-line" d="M0 96 C30 94 39 82 65 84 S102 70 125 72 S154 51 180 58 S222 42 244 48 S278 24 320 28" />
                            <circle cx="244" cy="48" r="4" />
                          </svg>
                          <div className="welcome-chart-labels"><span>9 AM</span><span>12 PM</span><span>3 PM</span><span>6 PM</span></div>
                        </div>
                      </div>

                      <div className="welcome-preview-branches">
                        <div className="welcome-preview-panel-title">
                          <span>Branches</span>
                          <small>3 online</small>
                        </div>
                        {[
                          ['Makati', '₱78.4k'],
                          ['Cebu', '₱61.8k'],
                          ['Quezon City', '₱44.1k'],
                        ].map(([branch, sales]) => (
                          <div className="welcome-branch-row" key={branch}>
                            <span><i aria-hidden="true" />{branch}</span>
                            <strong>{sales}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="welcome-floating-card is-alert">
                <Boxes aria-hidden="true" />
                <span><strong>12 low-stock items</strong>Ready for review</span>
              </div>
              <div className="welcome-floating-card is-sync">
                <CircleCheck aria-hidden="true" />
                <span><strong>All branches synced</strong>Updated just now</span>
              </div>
            </div>
          </div>
        </section>

        <section className="welcome-proof" aria-label="Platform highlights">
          <div className="welcome-proof-inner">
            {proofPoints.map((item) => (
              <article className="welcome-proof-item" key={item.title}>
                <span className="welcome-proof-icon" aria-hidden="true">
                  <item.icon />
                </span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="welcome-steps" aria-labelledby="steps-title">
          <div className="welcome-section-heading">
            <p className="welcome-section-kicker">Getting started</p>
            <h2 id="steps-title">From signup to your first sale.</h2>
            <p>No sales calls, no setup fees. Here's the whole process.</p>
          </div>

          <div className="welcome-steps-grid">
            {gettingStartedSteps.map((step, index) => (
              <article className="welcome-step-card" key={step.title}>
                <span className="welcome-step-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="welcome-step-icon" aria-hidden="true">
                  <step.icon />
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="welcome-backoffice" aria-labelledby="backoffice-title">
          <div className="welcome-backoffice-grid">
            <div className="welcome-backoffice-content">
              <p className="welcome-section-kicker">Why BIGTIME POS?</p>
              <h2 id="backoffice-title">Back Office</h2>

              <ul className="welcome-backoffice-list">
                {backOfficeFeatures.map((feature) => (
                  <li key={feature.title}>
                    <span className="welcome-backoffice-check" aria-hidden="true">
                      <CircleCheck />
                    </span>
                    <div>
                      <strong>{feature.title}</strong>
                      <p>{feature.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="welcome-backoffice-visual">
              <div
                className="welcome-backoffice-panel"
                role="img"
                aria-label="Sample back-office reports view showing sales, chart, and payment breakdown"
              >
                <div className="welcome-backoffice-panel-top">
                  <strong>Reports</strong>
                  <span>This week</span>
                </div>

                <div className="welcome-backoffice-panel-body">
                  <div className="welcome-backoffice-stats">
                    <div className="welcome-backoffice-stat">
                      <span>Net sales</span>
                      <strong>₱184,250</strong>
                    </div>
                    <div className="welcome-backoffice-stat">
                      <span>Transactions</span>
                      <strong>312</strong>
                    </div>
                    <div className="welcome-backoffice-stat">
                      <span>Discounts</span>
                      <strong>₱4,920</strong>
                    </div>
                    <div className="welcome-backoffice-stat">
                      <span>Refunds</span>
                      <strong>₱780</strong>
                    </div>
                  </div>

                  <div className="welcome-backoffice-lower">
                    <div className="welcome-backoffice-chart">
                      <div className="welcome-backoffice-chart-label">Sales by day</div>
                      <div className="welcome-backoffice-bars" aria-hidden="true">
                        {[38, 52, 44, 61, 48, 70, 58].map((height, index) => (
                          <span key={index} style={{ height: `${height}%` }} />
                        ))}
                      </div>
                    </div>

                    <div className="welcome-backoffice-payments">
                      <div className="welcome-backoffice-chart-label">Payment types</div>
                      {[
                        ['Cash', '₱93,178'],
                        ['GCash', '₱67,049'],
                        ['Maya', '₱12,500'],
                        ['Card', '₱11,523'],
                      ].map(([method, amount]) => (
                        <div className="welcome-backoffice-payment-row" key={method}>
                          <span>{method}</span>
                          <strong>{amount}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="welcome-mini-card is-tl">
                <div
                  className="welcome-donut"
                  aria-hidden="true"
                  style={{
                    background:
                      'conic-gradient(#0b8178 0% 45%, #3fb6ab 45% 70%, #ad5b14 70% 100%)',
                  }}
                />
                <div>
                  <strong>Sales by category</strong>
                  <span>This week</span>
                </div>
              </div>

              <div className="welcome-mini-card is-br">
                <div
                  className="welcome-donut"
                  aria-hidden="true"
                  style={{
                    background:
                      'conic-gradient(#075f59 0% 38%, #0b8178 38% 66%, #e1b382 66% 100%)',
                  }}
                />
                <div>
                  <strong>Top branch</strong>
                  <span>Makati · ₱78.4k</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="welcome-online" aria-labelledby="online-title">
          <div className="welcome-online-grid">
            <div className="welcome-online-content">
              <p className="welcome-section-kicker">Why BIGTIME POS?</p>
              <h2 id="online-title">Online Ordering Website</h2>
              <span className="welcome-coming-soon-badge">
                <Clock3 aria-hidden="true" />
                Coming soon
              </span>
              <p className="welcome-online-copy">
                Let customers browse your menu and place orders from their phone, synced
                straight into your POS queue. We&apos;re building this next — it isn&apos;t
                available in your workspace yet.
              </p>
              <p className="welcome-online-note">
                Sign up now and we&apos;ll let you know the moment it&apos;s ready.
              </p>
            </div>

            <div className="welcome-online-visual">
              <div
                className="welcome-online-desktop"
                role="img"
                aria-label="Preview of the upcoming online ordering website"
              >
                <div className="welcome-browser-bar">
                  <span className="welcome-browser-dot" />
                  <span className="welcome-browser-dot" />
                  <span className="welcome-browser-dot" />
                  <span className="welcome-browser-url">yourbusiness.example.com</span>
                </div>
                <div className="welcome-online-desktop-body">
                  <div className="welcome-online-store-name">Your Business Name</div>
                  <div className="welcome-online-menu-grid" aria-hidden="true">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div className="welcome-online-menu-card" key={index}>
                        <span>Item {index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="welcome-online-phones" aria-hidden="true">
                <div className="welcome-phone is-back">
                  <div className="welcome-phone-bar">
                    <span>Menu</span>
                    <ShoppingCart aria-hidden="true" />
                  </div>
                  <div className="welcome-phone-body">
                    {[1, 2, 3].map((row) => (
                      <div className="welcome-phone-item" key={row}>
                        <span className="welcome-phone-thumb" />
                        <span>Item {row}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="welcome-phone">
                  <div className="welcome-phone-bar">
                    <span>My Cart</span>
                    <ShoppingCart aria-hidden="true" />
                  </div>
                  <div className="welcome-phone-body">
                    {[1, 2].map((row) => (
                      <div className="welcome-phone-item" key={row}>
                        <span className="welcome-phone-thumb" />
                        <span>Item {row}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="welcome-packages" aria-labelledby="packages-title">
          <span className="welcome-packages-badge">
            <Clock3 aria-hidden="true" />
            Coming soon
          </span>
          <h2 className="welcome-packages-heading" id="packages-title">
            We&apos;ll have a <span className="accent-gold">plan</span> for every business
          </h2>
          <p className="welcome-packages-subheading">
            Every 30-day trial includes <strong>full access to every feature</strong> today,
            regardless of plan. These are the paid plans we&apos;re building for afterward —
            pricing has not been set yet.
          </p>

          <PackagesCarousel />

          <div className="welcome-packages-cta">
            <Link to="/signup" className="welcome-cta-btn welcome-hero-cta">
              Start your free trial
              <ArrowRight aria-hidden="true" />
            </Link>
            <p>No card required. Full access during your trial, on any plan.</p>
          </div>
        </section>

        <section className="welcome-trust-section" aria-labelledby="trust-title">
          <div className="welcome-section-heading">
            <p className="welcome-section-kicker">Why BIGTIME POS?</p>
            <h2 id="trust-title">Here&apos;s what you&apos;re actually getting</h2>
            <p>
              We&apos;re new, so instead of customer reviews, here&apos;s exactly what the
              product does for your business today.
            </p>
          </div>

          <div className="welcome-trust-grid">
            {trustPoints.map((point) => (
              <article className="welcome-trust-card" key={point.title}>
                <span className="welcome-trust-card-icon" aria-hidden="true">
                  <point.icon />
                </span>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="welcome-workflows" id="welcome-workflows" aria-labelledby="workflow-title">
          <div className="welcome-section-heading">
            <p className="welcome-section-kicker">One connected workspace</p>
            <h2 id="workflow-title">Built for the way Philippine retail runs.</h2>
            <p>
              From the first sale to the final Z reading, keep every operational detail
              connected and ready when you need it.
            </p>
          </div>

          <div className="welcome-operation-list" aria-label="Connected back-office areas">
            {operations.map((operation) => (
              <span key={operation}>{operation}</span>
            ))}
          </div>

          <div className="welcome-workflow-grid">
            {workflowCards.map((workflow) => (
              <article className="welcome-workflow-card" key={workflow.number}>
                <div className="welcome-workflow-card-top">
                  <span className="welcome-workflow-icon" aria-hidden="true">
                    <workflow.icon />
                  </span>
                  <span className="welcome-workflow-number">{workflow.number}</span>
                </div>
                <p className="welcome-workflow-eyebrow">{workflow.eyebrow}</p>
                <h3>{workflow.title}</h3>
                <p className="welcome-workflow-description">{workflow.description}</p>
                <ul>
                  {workflow.items.map((item) => (
                    <li key={item}>
                      <Check aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="welcome-faq" aria-labelledby="faq-title">
          <div className="welcome-section-heading">
            <p className="welcome-section-kicker">Questions</p>
            <h2 id="faq-title">Frequently asked questions</h2>
          </div>

          <FaqAccordion />
        </section>

        <section className="welcome-final-cta" aria-labelledby="welcome-final-title">
          <div className="welcome-final-copy">
            <p className="welcome-section-kicker">Your back office, ready for business</p>
            <h2 id="welcome-final-title">Put every branch on the same page.</h2>
            <p>Give your team one reliable place to run the day and understand the business.</p>
          </div>
          <div className="welcome-final-action">
            <Link to="/signup" className="welcome-cta-btn welcome-cta-light">
              Start your free trial
              <ArrowRight aria-hidden="true" />
            </Link>
            <span>No card required</span>
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <Link to="/welcome" className="welcome-brand welcome-footer-brand">
          <span className="welcome-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </span>
          <span>BIGTIME <em>POS</em></span>
        </Link>
        <p>One clear view for every branch, stockroom, and shift.</p>
        <nav className="welcome-footer-links" aria-label="Legal">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
        </nav>
        <span>© {new Date().getFullYear()} BIGTIME POS. All rights reserved.</span>
      </footer>
    </div>
  )
}
