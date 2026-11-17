<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  emailPrecargado: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['cambiar-a-registro']);

const email = ref(props.emailPrecargado);
const rfc = ref('');
const mensaje = ref('');

watch(
  () => props.emailPrecargado,
  (nuevoCorreo) => {
    email.value = nuevoCorreo;
  }
);

const handleSubmit = () => {
  mensaje.value = `Credenciales listas para ${email.value}. En la Tarjeta 2 conectaremos este botón con el endpoint de validación SQL + Redis.`;
};
</script>

<template>
  <form class="bank-card form-grid" @submit.prevent="handleSubmit">
    <div class="field-group">
      <label class="field-label">Correo Electrónico</label>
      <input
        v-model="email"
        class="field-input"
        type="email"
        placeholder="cliente@cervantesbank.mx"
        required
      />
    </div>

    <div class="field-group">
      <label class="field-label">RFC (Clave de acceso)</label>
      <input
        v-model="rfc"
        class="field-input"
        placeholder="Ingresa tu RFC registrado"
        required
      />
    </div>

    <div
      v-if="mensaje"
      style="
        background: var(--accent-orange-soft);
        color: var(--accent-orange);
        padding: 0.75rem;
        border-radius: 12px;
        font-size: 0.84rem;
      "
    >
      {{ mensaje }}
    </div>

    <button type="submit" class="btn-primary">Iniciar Sesión</button>

    <p style="text-align: center; font-size: 0.84rem; color: var(--text-secondary); margin-top: 0.4rem">
      ¿Aún no tienes cuenta?
      <span
        style="color: var(--accent-orange); font-weight: 600; cursor: pointer"
        @click="emit('cambiar-a-registro')"
      >
        Regístrate aquí
      </span>
    </p>
  </form>
</template>