<script setup>
import { computed, onMounted, ref } from 'vue';
import { obtenerPrestamosPagables, pagarPrestamo } from '../../services/api';
import ActionButton from '../cliente/ActionButton.vue';
import PrestamoCard from './PrestamoCard.vue';

const emit = defineEmits(['volver', 'sesion-cerrada']);

const cargando = ref(true);
const errorCarga = ref('');
const saldoCuenta = ref(0);
const prestamos = ref([]);
const seleccionadoId = ref(null);
const monto = ref('');
const enviando = ref(false);
const error = ref('');
const resultado = ref(null);

const moneda = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const seleccionado = computed(() => prestamos.value.find((p) => p.id === seleccionadoId.value) || null);
// Tope: nunca más que el saldo de la cuenta ni que lo que se debe del préstamo
const maximoPagable = computed(() =>
  seleccionado.value ? Math.floor(Math.min(saldoCuenta.value, seleccionado.value.saldoPendiente) * 100) / 100 : 0
);
const montoNumero = computed(() => Number(monto.value));
const superaSaldo = computed(() => montoNumero.value > saldoCuenta.value);
const superaDeuda = computed(() => seleccionado.value && montoNumero.value > seleccionado.value.saldoPendiente);
const montoValido = computed(
  () => Number.isFinite(montoNumero.value) && montoNumero.value > 0 && !superaSaldo.value && !superaDeuda.value
);

const cargar = async () => {
  cargando.value = true;
  errorCarga.value = '';
  try {
    const data = await obtenerPrestamosPagables();
    saldoCuenta.value = data.saldoCuenta;
    prestamos.value = data.prestamos;
    if (!prestamos.value.some((p) => p.id === seleccionadoId.value)) {
      seleccionadoId.value = prestamos.value.length === 1 ? prestamos.value[0].id : null;
    }
  } catch (e) {
    errorCarga.value = e.message;
    if (e.status === 401) emit('sesion-cerrada');
  } finally {
    cargando.value = false;
  }
};
onMounted(cargar);

const seleccionar = (p) => {
  seleccionadoId.value = p.id;
  error.value = '';
};
const ajustar = (delta) => {
  monto.value = String(Math.max(0, Math.round(((Number(monto.value) || 0) + delta) * 100) / 100));
};
const pagarMaximo = () => {
  monto.value = String(maximoPagable.value);
};

const enviar = async () => {
  error.value = '';
  if (!seleccionado.value) {
    error.value = 'Selecciona el préstamo que deseas pagar.';
    return;
  }
  if (!(montoNumero.value > 0)) {
    error.value = 'Ingresa un monto mayor que cero.';
    return;
  }
  if (superaSaldo.value) {
    error.value = `El monto supera tu saldo disponible ($${moneda(saldoCuenta.value)} MXN).`;
    return;
  }
  if (superaDeuda.value) {
    error.value = `El monto supera lo que debes en este préstamo ($${moneda(seleccionado.value.saldoPendiente)} MXN).`;
    return;
  }
  enviando.value = true;
  try {
    resultado.value = await pagarPrestamo({ idPrestamo: seleccionado.value.id, monto: montoNumero.value });
    saldoCuenta.value = resultado.value.nuevoSaldoCuenta;
    monto.value = '';
    await cargar();
  } catch (e) {
    error.value = e.message;
    if (e.status === 401) emit('sesion-cerrada');
  } finally {
    enviando.value = false;
  }
};

const otroPago = () => {
  resultado.value = null;
  error.value = '';
};
</script>

<template>
  <section class="transfer-view loan-view">
    <div v-if="cargando && !prestamos.length && !resultado" class="loading-shell">Consultando tus préstamos...</div>

    <div v-else-if="errorCarga" class="cl-error cl-fade-up">
      <div class="alert-error">{{ errorCarga }}</div>
      <button type="button" class="btn-secondary" @click="cargar">Reintentar</button>
    </div>

    <div v-else class="transfer-panel transfer-panel-elegant">
      <header class="transfer-heading">
        <p class="transfer-eyebrow">PRÉSTAMOS</p>
        <h1>Pagar préstamo</h1>
        <p>Elige el préstamo activo e indica cuánto quieres abonar. El monto se descuenta de tu cuenta.</p>
      </header>

      <!-- Confirmación del pago -->
      <div v-if="resultado" class="transfer-confirmation" role="status" aria-live="polite">
        <span class="transfer-confirmation-mark" aria-hidden="true">✓</span>
        <div>
          <strong>{{ resultado.liquidado ? 'Préstamo liquidado' : 'Pago aplicado' }}</strong>
          <p>{{ resultado.mensaje }} Nuevo saldo en cuenta: ${{ moneda(resultado.nuevoSaldoCuenta) }} MXN.</p>
        </div>
        <button v-if="prestamos.length" type="button" @click="otroPago">Otro pago</button>
      </div>

      <!-- Sin préstamos activos -->
      <div v-if="!prestamos.length" class="cl-panel-empty">
        <i aria-hidden="true"></i>
        <span>{{ resultado ? 'Ya no tienes préstamos activos.' : 'No tienes préstamos activos por pagar.' }}</span>
      </div>

      <template v-else-if="!resultado">
        <section aria-label="Préstamos activos">
          <p class="loan-section-label">1 · SELECCIONA EL PRÉSTAMO</p>
          <div class="pm-grid">
            <PrestamoCard
              v-for="p in prestamos"
              :key="p.id"
              :prestamo="p"
              seleccionable
              :activo="p.id === seleccionadoId"
              @seleccionar="seleccionar"
            />
          </div>
        </section>

        <section class="transfer-amount transfer-amount-elegant" aria-label="Monto a pagar">
          <label for="pago-monto">2 · MONTO A PAGAR · MXN</label>
          <div class="transfer-amount-display">
            <span class="transfer-currency">$</span>
            <input
              id="pago-monto"
              v-model="monto"
              type="number"
              min="0.01"
              step="0.01"
              :max="maximoPagable || undefined"
              placeholder="0.00"
              :disabled="!seleccionado"
            />
          </div>
          <p class="transfer-amount-preview">
            Saldo disponible en tu cuenta: ${{ moneda(saldoCuenta) }} MXN
            <template v-if="seleccionado"> · Máximo a pagar: ${{ moneda(maximoPagable) }}</template>
          </p>
          <div class="transfer-stepper" aria-label="Ajustar monto">
            <button type="button" :disabled="!seleccionado" @click="ajustar(-100)">− $100</button>
            <button type="button" :disabled="!seleccionado" @click="ajustar(100)">+ $100</button>
            <button type="button" :disabled="!seleccionado" @click="ajustar(500)">+ $500</button>
            <button type="button" :disabled="!seleccionado" @click="pagarMaximo">Pagar máximo</button>
          </div>
        </section>

        <p v-if="superaSaldo" class="loan-warning" role="status">
          El monto supera tu saldo disponible (${{ moneda(saldoCuenta) }}). Ingresa una cantidad menor o realiza un depósito.
        </p>
        <p v-else-if="superaDeuda" class="loan-warning" role="status">
          El monto supera lo que debes en este préstamo (${{ moneda(seleccionado.saldoPendiente) }}).
        </p>
        <p v-if="error" class="transfer-feedback is-error" role="alert">{{ error }}</p>
      </template>

      <footer class="transfer-actions">
        <button type="button" class="cl-nav-action cl-nav-action--danger transfer-cancel" @click="emit('volver')">
          <span class="cl-nav-action-mark" aria-hidden="true"></span>{{ resultado ? 'Volver al inicio' : 'Cancelar' }}
        </button>
        <button
          v-if="prestamos.length && !resultado"
          type="button"
          class="cl-nav-action transfer-submit"
          :disabled="enviando || !seleccionado || !montoValido"
          @click="enviar"
        >
          <span class="cl-nav-action-mark" aria-hidden="true"></span>
          {{ enviando ? 'Procesando...' : 'Confirmar pago' }}
        </button>
      </footer>
    </div>
  </section>
</template>
