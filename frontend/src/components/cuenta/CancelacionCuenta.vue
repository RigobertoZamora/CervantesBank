<script setup>
import { ref } from 'vue';
import { cancelarCuenta } from '../../services/cancelacionApi';

const emit = defineEmits(['cuenta-cancelada']);

const mostrarCancelacion = ref(false);
const motivoCancelacion = ref('');
const detalleCancelacion = ref('');
const confirmarIrreversible = ref(false);
const cancelando = ref(false);
const errorCancelacion = ref('');

const motivosCancelacion = [
  'Ya no necesito la cuenta',
  'Comisiones o costos',
  'Problemas con el servicio',
  'Abrí una cuenta en otra institución',
  'Otro motivo',
];

const enviarCancelacion = async () => {
  errorCancelacion.value = '';

  if (!motivoCancelacion.value || !detalleCancelacion.value.trim() || !confirmarIrreversible.value) {
    errorCancelacion.value = 'Completa el motivo, la explicación y la confirmación para continuar.';
    return;
  }

  cancelando.value = true;
  try {
    await cancelarCuenta({
      motivo: motivoCancelacion.value,
      detalle: detalleCancelacion.value.trim(),
      confirmarIrreversible: confirmarIrreversible.value,
    });
    emit('cuenta-cancelada');
  } catch (error) {
    errorCancelacion.value = error.message || 'No se pudo cancelar la cuenta.';
  } finally {
    cancelando.value = false;
  }
};
</script>

<template>
  <div class="bank-card profile-card cancellation-card cl-fade-up">
    <div>
      <span class="cancellation-kicker">GESTIÓN DE CUENTA</span>
      <h2>Cancelar cuenta</h2>
      <p>Solicita el cierre permanente de tu cuenta CervantesBank.</p>
    </div>
    <button
      type="button"
      class="cl-nav-action cl-nav-action--cancel"
      @click="mostrarCancelacion = true"
    >
      <span class="cl-nav-action-mark" aria-hidden="true"></span>
      Cancelar cuenta
    </button>
  </div>

  <div v-if="mostrarCancelacion" class="cancel-overlay" @click.self="mostrarCancelacion = false">
    <section class="cancel-dialog bank-card" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
      <span class="cancellation-kicker">SOLICITUD DEFINITIVA</span>
      <h2 id="cancel-title">¿Deseas cancelar tu cuenta?</h2>
      <p class="cancel-warning">
        Esta decisión es permanente e irreversible. Después de confirmar, tu cuenta quedará inactiva y no podrás volver a iniciar sesión.
      </p>
      <p class="cancel-policy">
        Antes de continuar, consulta la política institucional de manejo de datos para conocer cómo se tratará y conservará tu información después de finalizar la relación contractual.
      </p>

      <form class="cancel-form" @submit.prevent="enviarCancelacion">
        <label class="field-label" for="motivo-cancelacion">Motivo de cancelación</label>
        <select id="motivo-cancelacion" v-model="motivoCancelacion" class="field-input" required>
          <option value="" disabled>Selecciona una opción</option>
          <option v-for="motivo in motivosCancelacion" :key="motivo" :value="motivo">{{ motivo }}</option>
        </select>

        <label class="field-label" for="detalle-cancelacion">Cuéntanos un poco más</label>
        <textarea
          id="detalle-cancelacion"
          v-model="detalleCancelacion"
          class="field-input cancel-textarea"
          maxlength="500"
          placeholder="Escribe el motivo de tu decisión..."
          required
        ></textarea>

        <label class="cancel-confirm">
          <input v-model="confirmarIrreversible" type="checkbox" required />
          <span>Entiendo que la cancelación es permanente e irreversible.</span>
        </label>

        <p v-if="errorCancelacion" class="alert-error">{{ errorCancelacion }}</p>

        <div class="cancel-actions">
          <button
            type="button"
            class="btn-secondary cancel-back"
            :disabled="cancelando"
            @click="mostrarCancelacion = false"
          >Volver</button>
          <button
            type="submit"
            class="cl-nav-action cl-nav-action--cancel"
            :disabled="cancelando"
          >
            <span class="cl-nav-action-mark" aria-hidden="true"></span>
            {{ cancelando ? 'Procesando...' : 'Confirmar cancelación' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
