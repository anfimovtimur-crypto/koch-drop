
import "./Footer.css";

const links = [
  {
    label: "Сайт",
    href: "/",
  },
  {
    label: "Наш чат",
    href: "https://t.me/+_S0nYmgMsMVmMTky",
    external: true,
  },
  {
    label: "Админ",
    href: "#admin",
  },
];

export default function Footer() {
  return (
    <footer className="kd-footer">
      <div className="kd-footer__inner">
        <a
          className="kd-footer__logo"
          href="/"
          aria-label="Koch Drop"
        >
          <span>KOCH</span>
          <span className="kd-footer__logo-accent">DROP</span>
          <span className="kd-footer__dot">.</span>
        </a>

        <nav className="kd-footer__nav" aria-label="Навигация в футере">
          {links.map((link) => (
            <a
              key={link.label}
              className="kd-footer__link"
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="kd-footer__copyright">
          <span className="kd-footer__status" />
          <span>KOCH DROP</span>
          <span className="kd-footer__year">
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
