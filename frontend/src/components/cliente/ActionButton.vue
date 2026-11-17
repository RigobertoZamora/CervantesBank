<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: 'plus' },
  variant: { type: String, default: 'solid' }, // 'solid' | 'outline'
});
</script>

<template>
  <button type="button" class="cl-action" :class="variant">
    <span class="cl-action-sheen" aria-hidden="true"></span>
    <AppIcon :name="icon" />
    <span class="cl-action-label">{{ label }}</span>
  </button>
</template>
