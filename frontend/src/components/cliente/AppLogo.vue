<script setup>
import { ref } from 'vue';

// Usa el mismo logo de la barra superior (frontend/public/logo.png).
defineProps({ size: { type: String, default: '2.5rem' } });

const logoNoEncontrado = ref(false);
</script>

<template>
  <span class="cl-logo">
    <img
      v-if="!logoNoEncontrado"
      src="/logo.png"
      alt="Logo CervantesBank"
      :style="{ width: size, height: size }"
      draggable="false"
      @error="logoNoEncontrado = true"
    />
    <span v-else class="brand-logo-fallback" :style="{ width: size, height: size }">CB</span>
  </span>
</template>
