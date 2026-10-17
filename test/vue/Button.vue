<template>
  <button :class="[styles.button, variant === 'primary' ? styles.primary : styles.secondary]">
    <slot />
  </button>
</template>

<script setup>
import styles from './button.module.css';
const props = defineProps({ variant: { default: 'primary' } });
</script>
