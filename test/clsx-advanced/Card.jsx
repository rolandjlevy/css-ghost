import clsx from 'clsx';
import classnames from 'classnames';

// Tests cx/clsx/classnames with strings, objects and arrays

export function Card({ elevated, highlighted, size }) {
  return (
    <div className={clsx(
      'card',
      'card-base',
      // object syntax — keys treated as class names
      {
        elevated: elevated,
        highlighted: highlighted,
        'card-sm': size === 'sm',
        'card-lg': size === 'lg',
      },
      // array syntax
      ['rounded', size === 'sm' && 'compact']
    )}>
      Content
    </div>
  );
}

export function Tag({ type }) {
  return (
    // classnames() alias
    <span className={classnames('tag', `tag-${type}`, { 'tag-active': true })}>
      {type}
    </span>
  );
}
