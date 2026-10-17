import styles from './forms.sass';

export function Form({ children, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <div className={styles.formGroup}>
        <label className={styles.label}>Email</label>
        <input className={styles.input} type="email" />
      </div>
    </form>
  );
}
