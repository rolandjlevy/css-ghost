import { style, styleVariants } from '@vanilla-extract/css';

export const root = style({
  padding: '8px 16px',
  borderRadius: '4px',
  cursor: 'pointer',
});

export const icon = style({
  marginRight: '6px',
  flexShrink: 0,
});

export const orphaned = style({
  display: 'none', // never imported anywhere
});

export const sizeVariants = styleVariants({
  small: { fontSize: '12px', padding: '4px 8px' },
  medium: { fontSize: '14px', padding: '8px 16px' },
  large: { fontSize: '16px', padding: '12px 24px' },
});
