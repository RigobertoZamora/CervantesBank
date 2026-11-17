<script setup>
defineProps({
  title: { type: String, required: true },
  empty: { type: String, default: '' },
  vacio: { type: Boolean, default: true }, // true -> muestra el mensaje de "sin datos"
  delay: { type: Number, default: 0 },
});
</script>

<template>
  <section class="cl-panel cl-fade-up" :style="{ animationDelay: `${delay}ms` }">
    <span class="cl-bar" aria-hidden="true"></span>
    <h2 class="cl-panel-title">{{ title }}</h2>

    <div class="cl-panel-body">
      <div v-if="vacio" class="cl-panel-empty">
        <i aria-hidden="true"></i>
        <span>{{ empty }}</span>
      </div>
      <slot v-else />
    </div>

    <div v-if="$slots.footer" class="cl-panel-footer">
      <slot name="footer" />
    </div>
  </section>
</template>
