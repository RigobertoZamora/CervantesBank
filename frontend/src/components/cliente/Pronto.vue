<script setup>
import ActionButton from './ActionButton.vue';
import AppLogo from './AppLogo.vue';

// Página provisional para las secciones aún sin implementar.
// El encabezado, el fondo y el pie vienen de MainLayout.
defineProps({ titulo: { type: String, required: true } });
defineEmits(['volver']);
</script>

<template>
  <section class="cl-pronto">
    <div class="cl-fade-up"><AppLogo size="6.5rem" /></div>
    <h1 class="cl-fade-up">{{ titulo }}</h1>
    <p class="cl-fade-up">Esta sección estará disponible próximamente.</p>
    <div class="cl-pronto-back cl-fade-up">
      <ActionButton label="Volver al inicio" icon="back" variant="outline" @click="$emit('volver')" />
    </div>
  </section>
</template>
