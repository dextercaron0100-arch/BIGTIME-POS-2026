import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './legal-page-shell.css'

export type LegalSection = {
  id: string
  heading: string
  content: ReactNode
}

type LegalPageShellProps = {
  title: string
  lastUpdated: string
  intro?: ReactNode
  sections: LegalSection[]
}

export function LegalPageShell({ title, lastUpdated, intro, sections }: LegalPageShellProps) {
  return (
    <div className="legal-page">
      <header className="legal-nav">
        <Link to="/welcome" className="legal-brand" aria-label="BIGTIME POS home">
          <span className="legal-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </span>
          <span>
            BIGTIME <em>POS</em>
          </span>
        </Link>

        <div className="legal-nav-actions">
          <Link to="/login">Log in</Link>
          <Link to="/signup" className="legal-nav-cta">
            Start free trial
          </Link>
        </div>
      </header>

      <div className="legal-header">
        <h1>{title}</h1>
        <p>Last updated: {lastUpdated}</p>
      </div>

      <div className="legal-body">
        <aside className="legal-toc">
          <p className="legal-toc-label">On this page</p>
          <nav aria-label="Table of contents">
            {sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.heading}
              </a>
            ))}
          </nav>
        </aside>

        <div className="legal-content">
          {intro}
          {sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.heading}</h2>
              {section.content}
            </section>
          ))}
        </div>
      </div>

      <footer className="legal-footer">
        <Link to="/welcome">&larr; Back to BIGTIME POS</Link>
      </footer>
    </div>
  )
}
