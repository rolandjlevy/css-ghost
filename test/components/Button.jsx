import styles from '../styles/Button.module.css';

export function Button({ children, variant = 'primary', fullWidth = false }) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''}`}
    >
      {children}
    </button>
  );
}
