import styles from './alert.module.css';

// ⚠️  Dynamic class pattern — css-ghost should flag these as warnings
// rather than false-positive orphans.

export function Alert({ type, children }) {
  const variant = type === 'error' ? 'danger' : type;

  return (
    // styles[variable] — truly dynamic, can't be statically resolved
    <div className={styles[variant]}>
      {/* Template literal dynamic class */}
      <span className={`icon-${type}`}>{children}</span>
    </div>
  );
}

export function Badge({ status, children }) {
  // Another dynamic bracket access
  return <span className={styles[`${status}Badge`]}>{children}</span>;
}
