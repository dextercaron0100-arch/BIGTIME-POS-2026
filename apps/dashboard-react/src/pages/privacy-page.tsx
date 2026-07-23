import { LegalPageShell, type LegalSection } from '../components/legal/legal-page-shell'

const sections: LegalSection[] = [
  {
    id: 'overview',
    heading: 'Overview',
    content: (
      <p>
        This Privacy Policy explains how BIGTIME POS ("we," "our," "us") collects, uses,
        and protects information when a business signs up for and uses BIGTIME POS &mdash;
        the back-office dashboard and point-of-sale terminal software described at{' '}
        <a className="legal-inline-link" href="/welcome">
          bigtime-pos
        </a>
        . BIGTIME POS is operated from the Philippines and is built with the Philippine
        Data Privacy Act of 2012 (Republic Act No. 10173) in mind.
      </p>
    ),
  },
  {
    id: 'who-we-are',
    heading: 'Who we are',
    content: (
      <p>
        When you sign up your business, BIGTIME POS acts as the <strong>personal
        information controller</strong> for the account information you give us directly
        (like your name and email). For the data your own staff and customers generate
        while you use the product &mdash; sales records, employee accounts, receipt details
        &mdash; your business is the controller, and BIGTIME POS acts as a{' '}
        <strong>personal information processor</strong> on your behalf.
      </p>
    ),
  },
  {
    id: 'information-we-collect',
    heading: 'Information we collect',
    content: (
      <>
        <p>We collect three broad categories of information:</p>
        <ul>
          <li>
            <strong>Account information you give us at signup:</strong> business name,
            owner name, owner email, and the admin employee code and PIN you choose.
          </li>
          <li>
            <strong>Information you and your staff enter while using the product:</strong>{' '}
            catalog and inventory data, employee records, shift and transaction records,
            and &mdash; where your business chooses to capture it for a BIR receipt
            &mdash; a customer's name, TIN, and address.
          </li>
          <li>
            <strong>Session information:</strong> your login session (access token,
            refresh token, and basic profile details) is kept in your browser's session
            storage, not in a persistent cookie, and is cleared automatically when you
            close the browser tab. We do not use third-party advertising or tracking
            cookies on the dashboard.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-use-information',
    heading: 'How we use information',
    content: (
      <ul>
        <li>To create and operate your BIGTIME POS account and workspace.</li>
        <li>
          To generate BIR-oriented records your business needs &mdash; sequential SI/OR
          numbering, X/Z readings, and related reports.
        </li>
        <li>To provide support when you contact us.</li>
        <li>
          To maintain security and audit logs (for example, tracking who created or
          changed a branch, employee, or transaction record).
        </li>
        <li>To keep the trial and, later, billing status of your account accurate.</li>
      </ul>
    ),
  },
  {
    id: 'legal-bases',
    heading: 'Legal bases for processing',
    content: (
      <p>
        We process account information based on your <strong>consent</strong> when you
        sign up, and on the <strong>necessity of processing to deliver the service</strong>{' '}
        you asked for. Transaction and receipt data tied to BIR requirements is processed
        to meet a <strong>legal obligation</strong> around tax record-keeping.
      </p>
    ),
  },
  {
    id: 'where-data-is-stored',
    heading: 'Where your data is stored',
    content: (
      <p>
        BIGTIME POS is hosted on cloud infrastructure. As of this writing, there is no
        cloud region located inside the Philippines, so data is stored on servers in the
        nearest available region. We choose infrastructure providers that offer
        encryption at rest and in transit, and we do not use your data for any purpose
        other than operating BIGTIME POS for you.
      </p>
    ),
  },
  {
    id: 'data-sharing',
    heading: 'Data sharing',
    content: (
      <>
        <p>
          We do not sell personal information. We share data only with the infrastructure
          providers that host BIGTIME POS, strictly so the service can run.
        </p>
        <p>
          Your business's data is isolated from every other business using BIGTIME POS
          &mdash; staff and administrators at one company cannot see another company's
          branches, sales, inventory, or employee records.
        </p>
      </>
    ),
  },
  {
    id: 'data-retention',
    heading: 'Data retention',
    content: (
      <p>
        We retain your account and transaction data for as long as your account is
        active, plus a reasonable additional period to meet tax and audit
        record-keeping obligations. If you close your account, contact us and we will
        discuss deletion timelines with you, subject to any records we're legally
        required to keep.
      </p>
    ),
  },
  {
    id: 'your-rights',
    heading: 'Your rights under the Data Privacy Act',
    content: (
      <>
        <p>Under RA 10173, you have the right to:</p>
        <ul>
          <li>Be informed that your personal data is being processed.</li>
          <li>Access your personal data.</li>
          <li>Correct inaccurate or outdated personal data.</li>
          <li>
            Object to processing, and request the removal or blocking of your data.
          </li>
          <li>Data portability, where technically feasible.</li>
          <li>
            File a complaint with the{' '}
            <a
              className="legal-inline-link"
              href="https://www.privacy.gov.ph"
              target="_blank"
              rel="noreferrer"
            >
              National Privacy Commission
            </a>{' '}
            if you believe your rights have been violated.
          </li>
        </ul>
        <p>To exercise any of these rights, contact us using the details below.</p>
      </>
    ),
  },
  {
    id: 'security',
    heading: 'Security measures',
    content: (
      <p>
        PINs are hashed before storage and are never stored or logged in plain text.
        Access to data within your workspace is controlled by role (admin, supervisor,
        cashier, and so on), and requests to the API are authenticated and encrypted in
        transit. BIGTIME POS is an actively developed product, and we continue to
        strengthen these protections over time.
      </p>
    ),
  },
  {
    id: 'children',
    heading: "Children's privacy",
    content: (
      <p>
        BIGTIME POS is a business back-office tool and is not directed at children. We do
        not knowingly collect personal data from individuals under 18.
      </p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    content: (
      <p>
        We may update this policy as BIGTIME POS evolves. If we make material changes,
        we'll update the "Last updated" date above and, where appropriate, notify account
        owners directly.
      </p>
    ),
  },
  {
    id: 'contact',
    heading: 'Contact us',
    content: (
      <p>
        Questions about this policy or your data can be sent to{' '}
        <a className="legal-inline-link" href="mailto:privacy@bigtimepos.ph">
          privacy@bigtimepos.ph
        </a>
        .
      </p>
    ),
  },
]

export function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      lastUpdated="July 23, 2026"
      intro={
        <p className="legal-callout">
          <strong>In short:</strong> we collect what's needed to run your account and
          generate BIR-ready records, we don't sell your data, and your business's data
          is never visible to other businesses on BIGTIME POS. The full details are
          below.
        </p>
      }
      sections={sections}
    />
  )
}
