import { LegalPageShell, type LegalSection } from '../components/legal/legal-page-shell'

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    heading: 'Acceptance of terms',
    content: (
      <p>
        By creating a BIGTIME POS account or using the BIGTIME POS dashboard or point-of-
        sale terminal app, you agree to these Terms of Service. If you're agreeing on
        behalf of a business, you confirm you're authorized to do so.
      </p>
    ),
  },
  {
    id: 'the-service',
    heading: 'Description of the service',
    content: (
      <p>
        BIGTIME POS is back-office and point-of-sale software for retail and food &amp;
        beverage businesses in the Philippines: a web dashboard for managing branches,
        catalog, inventory, employees, and reports, and a terminal app for taking sales.
        BIGTIME POS is under active development, and features may be added, changed, or
        adjusted over time.
      </p>
    ),
  },
  {
    id: 'free-trial',
    heading: 'Free trial',
    content: (
      <>
        <p>
          New accounts include a 30-day free trial with full access to every feature.
          No payment method is required to start a trial.
        </p>
        <p>
          When your trial period ends, access to your workspace is paused until a paid
          plan is available and selected. Paid plans and pricing have not been announced
          yet &mdash; we'll contact trial accounts directly when they are.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    heading: 'Your account',
    content: (
      <ul>
        <li>You're responsible for the accuracy of the information you provide at signup.</li>
        <li>
          You're responsible for keeping employee codes and PINs within your business
          confidential, and for the activity that happens under your account.
        </li>
        <li>One signup represents one business. Please don't share login credentials across unrelated businesses.</li>
      </ul>
    ),
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable use',
    content: (
      <ul>
        <li>Don't use BIGTIME POS for any unlawful purpose.</li>
        <li>Don't attempt to access another business's branch, account, or data.</li>
        <li>Don't attempt to reverse engineer, decompile, or resell access to the service.</li>
        <li>Don't attempt to disrupt or overload the service (for example, automated abuse of the sign-up endpoint).</li>
      </ul>
    ),
  },
  {
    id: 'fees',
    heading: 'Fees',
    content: (
      <p>
        There are no fees during your free trial. Fees for continued use after a trial
        ends have not been set yet and will be communicated before you're asked to pay
        anything.
      </p>
    ),
  },
  {
    id: 'data-and-privacy',
    heading: 'Data and privacy',
    content: (
      <p>
        Our{' '}
        <a className="legal-inline-link" href="/privacy">
          Privacy Policy
        </a>{' '}
        explains what information we collect and how we use it, and forms part of these
        Terms.
      </p>
    ),
  },
  {
    id: 'availability',
    heading: 'Availability and changes to the service',
    content: (
      <p>
        BIGTIME POS is provided on an "as available" basis. As an actively developed
        product, we don't currently guarantee a specific uptime level, and features,
        pricing structures, and this document may change as the product matures. We'll
        try to give notice of material changes where practical.
      </p>
    ),
  },
  {
    id: 'intellectual-property',
    heading: 'Intellectual property',
    content: (
      <p>
        The BIGTIME POS name, software, and branding belong to their owner. You retain
        ownership of the business data you enter into BIGTIME POS &mdash; your catalog,
        sales, inventory, and employee records remain yours.
      </p>
    ),
  },
  {
    id: 'termination',
    heading: 'Termination',
    content: (
      <p>
        You may stop using BIGTIME POS at any time. We may suspend or terminate an
        account that violates these Terms, or &mdash; once paid plans exist &mdash; for
        non-payment, after reasonable notice where practical.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    heading: 'Disclaimers and limitation of liability',
    content: (
      <p>
        BIGTIME POS is provided "as is" during this stage of development, without
        warranties of any kind, express or implied, including uninterrupted or
        error-free operation. To the fullest extent permitted by law, BIGTIME POS is not
        liable for indirect, incidental, or consequential damages arising from use of the
        service.
      </p>
    ),
  },
  {
    id: 'governing-law',
    heading: 'Governing law',
    content: <p>These Terms are governed by the laws of the Republic of the Philippines.</p>,
  },
  {
    id: 'changes-to-terms',
    heading: 'Changes to these terms',
    content: (
      <p>
        We may update these Terms as BIGTIME POS evolves. We'll update the "Last updated"
        date above when we do, and material changes will be communicated to account
        owners where practical.
      </p>
    ),
  },
  {
    id: 'contact',
    heading: 'Contact us',
    content: (
      <p>
        Questions about these Terms can be sent to{' '}
        <a className="legal-inline-link" href="mailto:support@bigtimepos.ph">
          support@bigtimepos.ph
        </a>
        .
      </p>
    ),
  },
]

export function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      lastUpdated="July 23, 2026"
      intro={
        <p className="legal-callout">
          <strong>In short:</strong> your 30-day trial is free and full-featured with no
          card required; after that, access pauses until pricing is available; your
          business data stays yours. The full terms are below.
        </p>
      }
      sections={sections}
    />
  )
}
