import styles from '../styles/demo.module.css';
export function Demo() {
  return <button className={styles.button}>
    <span className={styles.primary}>Click me</span>
  </button>;
}
