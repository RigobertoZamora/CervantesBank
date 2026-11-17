<script setup>
// Plantilla base del área del cliente (después de iniciar sesión).
// Cada página se inyecta en <slot /> y hereda el fondo animado, el encabezado y el pie.
// (Equivale al <Outlet /> del MainLayout de la plantilla en React.)
// La barra superior con el logo sigue siendo la de App.vue.
defineProps({
  etiqueta: { type: String, default: 'Mi banca' },
});
</script>

<template>
  <div class="cliente-app">
    <div class="cl-bg" aria-hidden="true">
      <span class="cl-blob cl-blob-a"></span>
      <span class="cl-blob cl-blob-b"></span>
    </div>

    <div class="cl-shell">
      <header class="cl-header cl-fade-up">
        <span class="hero-eyebrow">{{ etiqueta }}</span>
        <div class="cl-header-actions">
          <slot name="acciones" />
        </div>
      </header>

      <main class="cl-main">
        <slot />
      </main>

      <footer class="cl-footer">© {{ new Date().getFullYear() }} CervantesBank</footer>
    </div>
  </div>
</template>
