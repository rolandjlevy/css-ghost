import styles from './nav.module.css';

export function Nav({ links, activeHref }) {
  return (
    // hyphenated class accessed via bracket string literal
    <nav className={styles['nav-bar']}>
      {links.map(link => (
        <a
          key={link.href}
          href={link.href}
          className={
            link.href === activeHref
              ? styles['nav-link--active']  // bracket string — hyphenated
              : styles['nav-link']           // bracket string — hyphenated
          }
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
