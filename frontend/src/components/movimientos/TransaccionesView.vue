<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  obtenerDetalleTransaccion,
  obtenerResumenCuenta,
  obtenerTransacciones,
} from '../../services/api';
import ActionButton from '../cliente/ActionButton.vue';
import BalanceCard from '../cliente/BalanceCard.vue';
import Panel from '../cliente/Panel.vue';

const emit = defineEmits(['volver', 'sesion-cerrada']);

// Depende de "Consultar Saldo": primero se carga el resumen de la cuenta (saldo + titular)
const cuenta = ref(null);
const transacciones = ref([]);
const pagina = ref(1);
const hayMas = ref(false);
const total = ref(0);
const cargando = ref(true);
const cargandoMas = ref(false);
const error = ref('');
const filtro = ref('TODAS'); // TODAS | ENTRADA | SALIDA

const abiertaId = ref(null);
const detalles = ref({}); // id -> { cargando, error, data }

const FILTROS = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'ENTRADA', label: 'Entradas' },
  { id: 'SALIDA', label: 'Salidas' },
];

const moneda = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fechaHora = (d) =>
  d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const visibles = computed(() =>
  filtro.value === 'TODAS' ? transacciones.value : transacciones.value.filter((t) => t.direccion === filtro.value)
);

const cargar = async () => {
  cargando.value = true;
  error.value = '';
  try {
    cuenta.value = (await obtenerResumenCuenta()).cuenta;
    const data = await obtenerTransacciones({ pagina: 1 });
    transacciones.value = data.transacciones;
    pagina.value = 1;
    hayMas.value = data.hayMas;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
    if (e.status === 401) emit('sesion-cerrada');
  } finally {
    cargando.value = false;
  }
};
onMounted(cargar);

const cargarMas = async () => {
  cargandoMas.value = true;
  try {
    const data = await obtenerTransacciones({ pagina: pagina.value + 1 });
    transacciones.value = [...transacciones.value, ...data.transacciones];
    pagina.value += 1;
    hayMas.value = data.hayMas;
  } catch (e) {
    error.value = e.message;
  } finally {
    cargandoMas.value = false;
  }
};

const alternarDetalle = async (t) => {
  if (abiertaId.value === t.id) {
    abiertaId.value = null;
    return;
  }
  abiertaId.value = t.id;
  if (detalles.value[t.id]?.data) return;
  detalles.value = { ...detalles.value, [t.id]: { cargando: true, error: '', data: null } };
  try {
    const { transaccion } = await obtenerDetalleTransaccion(t.id);
    detalles.value = { ...detalles.value, [t.id]: { cargando: false, error: '', data: transaccion } };
  } catch (e) {
    detalles.value = { ...detalles.value, [t.id]: { cargando: false, error: e.message, data: null } };
  }
};

// Etiquetas legibles para los campos del documento de AuditoriaTransacciones
const ETIQUETAS_CAMPO = {
  concepto: 'Concepto',
  nombreDestinatario: 'Beneficiario',
  clabeDestino: 'CLABE destino',
  usuarioOrigenId: 'Usuario origen',
  usuarioId: 'Usuario',
  cuentaOrigenId: 'Cuenta origen (id)',
  cuentaDestinoId: 'Cuenta destino (id)',
  motivoSolicitud: 'Motivo',
  plazoMeses: 'Plazo (meses)',
  tasaInteresMensual: 'Tasa mensual (%)',
  rangoMaximoCalculado: 'Rango máximo calculado',
  origenAprobacion: 'Origen de aprobación',
  idPrestamoSQL: 'Préstamo (id)',
};
const etiquetaCampo = (k) => ETIQUETAS_CAMPO[k] || k;
const valorCampo = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};
const camposPayload = (doc) => Object.entries(doc.payloadCompleto || {});
</script>

<template>
  <section class="tx-view">
    <div v-if="cargando" class="loading-shell">Consultando tus transacciones...</div>

    <div v-else-if="error && !transacciones.length" class="cl-error cl-fade-up">
      <div class="alert-error">{{ error }}</div>
      <button type="button" class="btn-secondary" @click="cargar">Reintentar</button>
    </div>

    <template v-else>
      <header class="tx-heading cl-fade-up">
        <p class="transfer-eyebrow">MOVIMIENTOS</p>
        <h1>Gestionar transacciones</h1>
        <p>Todo el dinero que entró o salió de tu cuenta. Toca un movimiento para ver su detalle.</p>
      </header>

      <!-- Consultar Saldo (caso de uso previo) -->
      <div class="cl-fade-up" style="animation-delay: 80ms">
        <BalanceCard
          :saldo="cuenta.saldo"
          :moneda="cuenta.moneda"
          :clabe-interbancaria="cuenta.clabeInterbancaria"
          :titular="cuenta.titular"
        />
      </div>

      <Panel
        title="Historial de transacciones"
        :delay="160"
        :vacio="transacciones.length === 0"
        empty="Aún no tienes movimientos en tu cuenta."
      >
        <div class="tx-filters" role="tablist" aria-label="Filtrar transacciones">
          <button
            v-for="f in FILTROS"
            :key="f.id"
            type="button"
            role="tab"
            :aria-selected="filtro === f.id"
            class="loan-plazo"
            :class="{ 'is-active': filtro === f.id }"
            @click="filtro = f.id"
          >
            {{ f.label }}
          </button>
          <span class="tx-count">{{ total }} movimiento(s)</span>
        </div>

        <p v-if="error" class="alert-error" style="margin-bottom: 0.75rem">{{ error }}</p>
        <p v-if="!visibles.length" class="transfer-field-hint">No hay movimientos de este tipo en lo cargado.</p>

        <ul class="tx-list">
          <li v-for="t in visibles" :key="t.id" class="tx-item" :class="{ 'is-open': abiertaId === t.id }">
            <div class="tx-row">
              <span class="tx-arrow" :class="t.direccion === 'ENTRADA' ? 'is-in' : 'is-out'" aria-hidden="true">
                {{ t.direccion === 'ENTRADA' ? '↓' : '↑' }}
              </span>
              <span class="tx-main">
                <strong>{{ t.concepto }}</strong>
                <small>{{ t.etiquetaTipo }} · {{ fechaHora(t.fecha) }}</small>
              </span>
              <b class="tx-amount" :class="t.direccion === 'ENTRADA' ? 'is-in' : 'is-out'">
                {{ t.direccion === 'ENTRADA' ? '+' : '−' }}${{ moneda(t.monto) }}
              </b>
              <button
                type="button"
                class="btn-chip tx-more"
                :aria-expanded="abiertaId === t.id"
                @click="alternarDetalle(t)"
              >
                {{ abiertaId === t.id ? 'Ocultar detalles' : 'Ver más detalles' }}
              </button>
            </div>

            <div v-if="abiertaId === t.id" class="tx-detail cl-pop">
              <p v-if="detalles[t.id]?.cargando" class="transfer-field-hint">Cargando detalle...</p>
              <p v-else-if="detalles[t.id]?.error" class="transfer-feedback is-error">{{ detalles[t.id].error }}</p>
              <template v-else-if="detalles[t.id]?.data">
                <p class="tx-detail-title">DOCUMENTO DE AUDITORÍA</p>
                <dl class="tx-dl">
                  <div><dt>ID de transacción</dt><dd class="tx-mono">{{ detalles[t.id].data.documento._id }}</dd></div>
                  <div><dt>Tipo</dt><dd>{{ detalles[t.id].data.documento.tipoMovimiento }}</dd></div>
                  <div>
                    <dt>Estatus</dt>
                    <dd><span class="status-pill ready">{{ detalles[t.id].data.documento.estatus }}</span></dd>
                  </div>
                  <div><dt>Monto</dt><dd>${{ moneda(detalles[t.id].data.documento.monto) }} MXN</dd></div>
                  <div><dt>Cuenta origen</dt><dd>{{ valorCampo(detalles[t.id].data.documento.cuentaOrigenId) }}</dd></div>
                  <div><dt>Cuenta destino</dt><dd>{{ valorCampo(detalles[t.id].data.documento.cuentaDestinoId) }}</dd></div>
                  <div><dt>Creada</dt><dd>{{ fechaHora(detalles[t.id].data.documento.fechaCreacion) }}</dd></div>
                  <div><dt>Actualizada</dt><dd>{{ fechaHora(detalles[t.id].data.documento.fechaActualizacion) }}</dd></div>
                </dl>

                <p class="tx-detail-title">DATOS DEL MOVIMIENTO (payloadCompleto)</p>
                <dl class="tx-dl">
                  <div v-for="[k, v] in camposPayload(detalles[t.id].data.documento)" :key="k">
                    <dt>{{ etiquetaCampo(k) }}</dt>
                    <dd class="tx-pre">{{ valorCampo(v) }}</dd>
                  </div>
                </dl>
              </template>
            </div>
          </li>
        </ul>

        <template #footer>
          <ActionButton v-if="hayMas" :label="cargandoMas ? 'Cargando...' : 'Cargar más'" icon="plus" variant="outline" @click="cargarMas" />
        </template>
      </Panel>

      <div class="loan-back">
        <ActionButton label="Volver al inicio" icon="back" variant="outline" @click="emit('volver')" />
      </div>
    </template>
  </section>
</template>
