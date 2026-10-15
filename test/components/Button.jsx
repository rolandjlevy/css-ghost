import cx from 'clsx';
import styles from '../styles/Button.module.css';

export function Button({ children, variant = 'primary', fullWidth = false, isLoading = false }) {
  return (
    <button
      className={cx(
        styles.button,
        // object syntax — keys are statically analysed
        { [styles.fullWidth]: fullWidth },
        // ternary bracket — both branches extracted
        styles[isLoading ? 'loadingSpinner' : 'iconLeft'],
        // string args
        variant === 'primary' ? 'primary' : 'secondary',
      )}
    >
      {children}
    </button>
  );
}
