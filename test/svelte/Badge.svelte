<script>
  import styles from './badge.module.css';
  export let type = 'info';
</script>

<span class={styles.badge} class:active={type === 'active'}>
  <slot />
</span>
