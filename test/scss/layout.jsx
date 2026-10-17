import styles from './layout.scss';

export function Layout({ children }) {
  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        <a className={styles.navLink} href="/">Home</a>
        <a className={styles.navLink} href="/about">About</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
