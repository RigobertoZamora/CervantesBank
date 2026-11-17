<script setup>
import { ref } from 'vue';
import { realizarTransferencia } from '../../services/api';
import ActionButton from '../cliente/ActionButton.vue';

const emit = defineEmits(['volver', 'transferencia-exitosa']);
const monto = ref('');
const clabeInterbancaria = ref('');
const nombreDestinatario = ref('');
const concepto = ref('');
const enviando = ref(false);
const mensaje = ref('');
const error = ref('');

const enviar = async () => {
  mensaje.value = '';
  error.value = '';
  if (!Number.isFinite(Number(monto.value)) || Number(monto.value) <= 0) {
    error.value = 'El monto debe ser mayor que cero.';
    return;
  }
  if (!/^\d{18}$/.test(clabeInterbancaria.value)) {
    error.value = 'La CLABE debe contener exactamente 18 dígitos.';
    return;
  }
  enviando.value = true;
  try {
    const data = await realizarTransferencia({
      monto: Number(monto.value), clabeInterbancaria: clabeInterbancaria.value,
      nombreDestinatario: nombreDestinatario.value.trim(), concepto: concepto.value.trim(),
    });
    mensaje.value = data.mensaje;
    monto.value = ''; clabeInterbancaria.value = ''; nombreDestinatario.value = ''; concepto.value = '';
    emit('transferencia-exitosa');
  } catch (err) {
    error.value = err.message;
  } finally {
    enviando.value = false;
  }
};
</script>

<template>
  <section class="cl-transferencia cl-fade-up">
    <header class="cl-transferencia-heading">
      <div><p class="cl-transferencia-kicker">OPERACIÓN BANCARIA</p><h1>Realizar transferencia</h1>
        <p>Envía dinero a otra cuenta CervantesBank.</p></div>
    </header>
    <form class="cl-transferencia-form" @submit.prevent="enviar">
      <label class="cl-transferencia-field">Monto (MXN)
        <input v-model="monto" class="field-input" type="number" min="0.01" step="0.01" placeholder="0.00" required />
      </label>
      <label class="cl-transferencia-field">CLABE interbancaria
        <input v-model="clabeInterbancaria" class="field-input" inputmode="numeric" maxlength="18" minlength="18" pattern="[0-9]{18}" placeholder="18 dígitos" required />
      </label>
      <label class="cl-transferencia-field">Nombre del destinatario
        <input v-model="nombreDestinatario" class="field-input" maxlength="150" autocomplete="name" placeholder="Nombre completo del titular" required />
      </label>
      <label class="cl-transferencia-field">Concepto
        <input v-model="concepto" class="field-input" maxlength="120" placeholder="¿Por qué realizas la transferencia?" required />
      </label>
      <p v-if="error" class="cl-transferencia-message is-error" role="alert">{{ error }}</p>
      <p v-if="mensaje" class="cl-transferencia-message is-success" role="status">{{ mensaje }}</p>
      <div class="cl-transferencia-actions">
        <ActionButton label="Volver" icon="back" variant="outline" @click="emit('volver')" />
        <button class="cl-transferencia-submit" type="submit" :disabled="enviando">{{ enviando ? 'Procesando…' : 'Transferir' }}</button>
      </div>
    </form>
  </section>
</template>
