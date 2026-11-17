<script setup>
import { ref, watch } from 'vue';
import { loginUsuario } from '../../services/api';

const props = defineProps({
  emailPrecargado: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['cambiar-a-registro', 'login-exitoso']);

const identificador = ref(props.emailPrecargado);
const password = ref('');
const cargando = ref(false);
const error = ref('');
const cuentaBloqueada = ref(false);

watch(
  () => props.emailPrecargado,
  (nuevoCorreo) => {
    identificador.value = nuevoCorreo;
  }
);

const handleSubmit = async () => {
  error.value = '';
  cuentaBloqueada.value = false;
  cargando.value = true;

  try {
    const sesion = await loginUsuario({
      identificador: identificador.value,
      password: password.value,
    });
    password.value = '';
    emit('login-exitoso', sesion);
  } catch (err) {
    error.value = err.message;
    if (err.status === 423) {
      cuentaBloqueada.value = true;
    }
  } finally {
    cargando.value = false;
  }
};
</script>

<template>
  <form class="bank-card form-grid" @submit.prevent="handleSubmit">
    <div style="margin-bottom: 0.25rem">
      <h2 style="font-size: 1.2rem; font-weight: 700">Bienvenido de vuelta</h2>
      <p style="font-size: 0.83rem; color: var(--text-secondary)">
        Ingresa tu correo electrónico o RFC para acceder a tu banca.
      </p>
    </div>

    <div v-if="error" :class="cuentaBloqueada ? 'alert-locked' : 'alert-error'">
      <strong>{{ cuentaBloqueada ? 'Protección Antifraude Activa: ' : '' }}</strong>{{ error }}
    </div>

    <div class="field-group">
      <label class="field-label">Correo Electrónico o RFC *</label>
      <input
        v-model="identificador"
        class="field-input"
        placeholder="nombre@correo.com o ZASR060101ABC"
        required
      />
    </div>

    <div class="field-group">
      <label class="field-label">Contraseña *</label>
      <input
        v-model="password"
        class="field-input"
        type="password"
        placeholder="••••••••"
        required
      />
    </div>

    <button type="submit" class="btn-primary" :disabled="cargando">
      {{ cargando ? 'Verificando credenciales...' : 'Iniciar Sesión' }}
    </button>

    <p style="text-align: center; font-size: 0.84rem; color: var(--text-secondary); margin-top: 0.4rem">
      ¿Aún no tienes cuenta?
      <span
        style="color: var(--accent-orange); font-weight: 600; cursor: pointer"
        @click="emit('cambiar-a-registro')"
      >
        Ábrela aquí
      </span>
    </p>
  </form>
</template>