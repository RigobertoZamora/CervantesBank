<script setup>
import { computed, ref, watch } from 'vue';
import { consultarBeneficiario, realizarTransferencia } from '../../services/api';

const emit = defineEmits(['volver', 'transferencia-realizada']);
const form = ref({ clabeDestino: '', nombreBeneficiario: '', monto: '', concepto: '' });
const enviando = ref(false);
const error = ref('');
const exito = ref('');
const estadoClabe = ref('idle'); // idle | checking | found | missing | invalid
const nombreEncontrado = ref('');
let consultaActual = 0;

const montoFormateado = computed(() => {
  const n = Number(form.value.monto);
  return Number.isFinite(n) && n > 0
    ? n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
});

const ajustarMonto = (delta) => {
  const actual = Number(form.value.monto) || 0;
  form.value.monto = Math.max(0, actual + delta).toFixed(2);
};

watch(() => form.value.clabeDestino, async (valor) => {
  const clabe = String(valor || '').replace(/\D/g, '').slice(0, 18);
  if (clabe !== valor) form.value.clabeDestino = clabe;
  const id = ++consultaActual;
  nombreEncontrado.value = '';
  if (!clabe) { estadoClabe.value = 'idle'; return; }
  if (clabe.length !== 18) { estadoClabe.value = 'idle'; return; }
  estadoClabe.value = 'checking';
  await new Promise(resolve => setTimeout(resolve, 350));
  if (id !== consultaActual) return;
  try {
    const data = await consultarBeneficiario(clabe);
    if (id !== consultaActual) return;
    estadoClabe.value = data.encontrado ? 'found' : 'missing';
    nombreEncontrado.value = data.beneficiario?.nombre || '';
    if (data.encontrado && !form.value.nombreBeneficiario.trim()) {
      form.value.nombreBeneficiario = nombreEncontrado.value;
    }
  } catch (e) {
    if (id !== consultaActual) return;
    estadoClabe.value = e.status === 404 ? 'missing' : 'invalid';
  }
});

const enviar = async () => {
  error.value = '';
  exito.value = '';
  if (!Number.isFinite(Number(form.value.monto)) || Number(form.value.monto) <= 0) {
    error.value = 'Ingresa un monto mayor que cero.';
    return;
  }
  if (!/^\d{18}$/.test(form.value.clabeDestino)) {
    error.value = 'La CLABE debe contener exactamente 18 dígitos.';
    return;
  }
  if (estadoClabe.value !== 'found') {
    error.value = 'Primero verifica que la CLABE corresponda a una cuenta activa.';
    return;
  }
  if (!form.value.concepto.trim()) {
    error.value = 'Escribe el concepto de la transferencia.';
    return;
  }
  enviando.value = true;
  try {
    const data = await realizarTransferencia({
      clabeInterbancaria: form.value.clabeDestino,
      nombreDestinatario: form.value.nombreBeneficiario.trim(),
      monto: Number(form.value.monto),
      concepto: form.value.concepto.trim(),
    });
    exito.value = data.mensaje || 'Transferencia realizada correctamente.';
    form.value = { clabeDestino: '', nombreBeneficiario: '', monto: '', concepto: '' };
    estadoClabe.value = 'idle';
    nombreEncontrado.value = '';
    emit('transferencia-realizada', data);
  } catch (e) {
    error.value = e.message;
  } finally {
    enviando.value = false;
  }
};
</script>

<template>
  <section class="transfer-view cl-fade-up">
    <form class="transfer-panel transfer-panel-elegant" @submit.prevent="enviar">
      <header class="transfer-heading">
        <p class="transfer-eyebrow">MOVIMIENTOS</p>
        <h1>Realizar transferencia</h1>
        <p>Envía dinero de forma sencilla y segura.</p>
      </header>

      <section class="transfer-amount transfer-amount-elegant" aria-label="Monto de la transferencia">
        <label for="transfer-amount-input">MONTO A TRANSFERIR · MXN</label>
        <div class="transfer-amount-display">
          <span class="transfer-currency">$</span>
          <input id="transfer-amount-input" v-model="form.monto" type="number" min="0.01" step="0.01" placeholder="0.00" required />
        </div>
        <p class="transfer-amount-preview">${{ montoFormateado }} MXN</p>
        <div class="transfer-stepper" aria-label="Ajustar monto">
          <button type="button" aria-label="Restar 100 pesos" @click="ajustarMonto(-100)">− $100</button>
          <button type="button" aria-label="Sumar 100 pesos" @click="ajustarMonto(100)">+ $100</button>
          <button type="button" aria-label="Sumar 500 pesos" @click="ajustarMonto(500)">+ $500</button>
        </div>
      </section>

      <div class="transfer-fields transfer-fields-elegant">
        <label class="transfer-field">
          <span>CLABE interbancaria</span>
          <input v-model="form.clabeDestino" inputmode="numeric" maxlength="18" minlength="18" pattern="[0-9]{18}" placeholder="Escribe los 18 dígitos" required />
          <small v-if="estadoClabe === 'checking'" class="transfer-recipient-status is-checking">Verificando cuenta…</small>
          <small v-else-if="estadoClabe === 'found'" class="transfer-recipient-status is-found">✓ Cuenta encontrada{{ nombreEncontrado ? ` · ${nombreEncontrado}` : '' }}</small>
          <small v-else-if="estadoClabe === 'missing'" class="transfer-recipient-status is-missing">✕ No encontramos una cuenta activa con esta CLABE</small>
          <small v-else-if="estadoClabe === 'invalid'" class="transfer-recipient-status is-missing">No fue posible validar la CLABE. Inténtalo de nuevo.</small>
          
        </label>

        <label class="transfer-field">
          <span>Nombre del beneficiario <em></em></span>
          <input v-model.trim="form.nombreBeneficiario" maxlength="150" autocomplete="off" placeholder="Nombre de referencia (no requiere coincidencia exacta)" />
          
        </label>

        <label class="transfer-field">
          <span>Concepto</span>
          <input v-model.trim="form.concepto" maxlength="120" placeholder="Ej. Pago de servicio" required />
        </label>
      </div>

      <p v-if="error" class="transfer-feedback is-error" role="alert">{{ error }}</p>
      <div v-if="exito" class="transfer-confirmation" role="status" aria-live="polite">
        <span class="transfer-confirmation-mark" aria-hidden="true">✓</span>
        <div><strong>Transferencia confirmada</strong><p>{{ exito }}</p></div>
        <button type="button" @click="emit('volver')">Finalizar</button>
      </div>

      <footer class="transfer-actions">
        <button class="cl-nav-action cl-nav-action--danger transfer-cancel" type="button" @click="emit('volver')"><span class="cl-nav-action-mark" aria-hidden="true"></span>Cancelar</button>
        <button class="cl-nav-action transfer-submit" type="submit" :disabled="enviando || Boolean(exito) || estadoClabe !== 'found'"><span class="cl-nav-action-mark" aria-hidden="true"></span>{{ enviando ? 'Procesando...' : 'Confirmar transferencia' }}</button>
      </footer>
    </form>
  </section>
</template>
