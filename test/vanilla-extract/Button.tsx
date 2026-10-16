import { root, icon, sizeVariants } from './button.css';

interface ButtonProps {
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

export function Button({ size = 'medium', children }: ButtonProps) {
  return (
    <button className={`${root} ${sizeVariants[size]}`}>
      <span className={icon}>→</span>
      {children}
    </button>
  );
}
// 'orphaned' is never imported — should be flagged
