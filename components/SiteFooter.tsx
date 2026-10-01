import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <span>
          © {new Date().getFullYear()} Sentinel Grid · evacuate.today ·{' '}
          <span style={{ whiteSpace: 'nowrap' }}>
            Prepared by <strong>KA Wiley</strong>
          </span>
        </span>
        <span>
          <Link href="/demo">Live demo</Link> · Plans support, not replace, your code official and fire engineer.
        </span>
      </div>
    </footer>
  );
}
