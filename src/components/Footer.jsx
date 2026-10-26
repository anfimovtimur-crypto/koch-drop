import "./Footer.css";

const footerLinks = [
  {
    label: "Сайт",
    href: "/",
  },
  {
    label: "Наш чат",
    href: "https://t.me/+_S0nYmgMsMVmMTky",
  },
  {
    label: "Админ",
    href: "#admin",
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <a className="footer-logo" href="/" aria-label="Koch Drop">
          <span className="footer-logo-koch">KOCH</span>
          <span className="footer-logo-drop">DROP</span>
          <span className="footer-logo-dot">.</span>
        </a>

        <nav className="footer-nav" aria-label="Ссылки в футере">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              className="footer-link"
              href={link.href}
              target={
                link.href.startsWith("https://") ? "_blank" : undefined
              }
              rel={
                link.href.startsWith("https://")
                  ? "noopener noreferrer"
                  : undefined
              }
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="footer-copy">
          <span className="footer-copy-dot" />
          <span>KOCH DROP</span>
          <span className="footer-copy-year">
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}