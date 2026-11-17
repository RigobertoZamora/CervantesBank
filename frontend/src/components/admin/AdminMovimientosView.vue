<script setup>
import { computed, onMounted, ref } from 'vue';
import { obtenerDetalleMovimientoAdmin, obtenerMovimientosAdmin } from '../../services/api';
import ActionButton from '../cliente/ActionButton.vue';
import Panel from '../cliente/Panel.vue';

// Segunda capa de "Gestionar Cuentas": movimientos de UNA cuenta, con opción de ver los de TODAS.
const props = defineProps({
  usuarioId: { type: Number, default: null }, // null = movimientos generales
  nombre: { type: String, default: '' },
});
const emit = defineEmits(['volver']);

const alcance = ref(props.usuarioId ? 'CUENTA' : 'TODAS'); // CUENTA | TODAS
const tipo = ref('');
const movimientos = ref([]);
const cliente = ref(null);
const pagina = ref(1);
const hayMas = ref(false);
const total = ref(0);
const cargando = ref(true);
const cargandoMas = ref(false);
const error = ref('');
const abiertaId = ref(null);
const detalles = ref({});

const TIPOS = [
  { id: '', label: 'Todos' },
  { id: 'TRANSFERENCIA', label: 'Transferencias' },
  { id: 'INGRESO_PRESTAMO', label: 'Ingresos de préstamo' },
  { id: 'PAGO_PRESTAMO', label: 'Pagos de préstamo' },
];

const moneda = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fechaHora = (d) => (d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const parte = (c) => (c ? `${c.titular}${c.clabe ? ` · ••${c.clabe.slice(-4)}` : ''}` : '—');

const titulo = computed(() =>
  alcance.value === 'CUENTA' ? `Movimientos de ${props.nombre || 'la cuenta'}` : 'Movimientos generales de clientes'
);

const consulta = (p) => ({
  usuarioId: alcance.value === 'CUENTA' ? props.usuarioId : null,
  tipo: tipo.value,
  pagina: p,
});

const cargar = async () => {
  cargando.value = true;
  error.value = '';
  abiertaId.value = null;
  try {
    const data = await obtenerMovimientosAdmin(consulta(1));
    movimientos.value = data.movimientos;
    cliente.value = data.cliente;
    pagina.value = 1;
    hayMas.value = data.hayMas;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
};
onMounted(cargar);

const cambiarAlcance = (a) => {
  if (alcance.value === a) return;
  alcance.value = a;
  cargar();
};
const cambiarTipo = (t) => {
  if (tipo.value === t) return;
  tipo.value = t;
  cargar();
};

const cargarMas = async () => {
  cargandoMas.value = true;
  try {
    const data = await obtenerMovimientosAdmin(consulta(pagina.value + 1));
    movimientos.value = [...movimientos.value, ...data.movimientos];
    pagina.value += 1;
    hayMas.value = data.hayMas;
  } catch (e) {
    error.value = e.message;
  } finally {
    cargandoMas.value = false;
  }
};

const alternarDetalle = async (m) => {
  if (abiertaId.value === m.id) {
    abiertaId.value = null;
    return;
  }
  abiertaId.value = m.id;
  if (detalles.value[m.id]?.data) return;
  detalles.value = { ...detalles.value, [m.id]: { cargando: true, error: '', data: null } };
  try {
    const { movimiento } = await obtenerDetalleMovimientoAdmin(m.id);
    detalles.value = { ...detalles.value, [m.id]: { cargando: false, error: '', data: movimiento } };
  } catch (e) {
    detalles.value = { ...detalles.value, [m.id]: { cargando: false, error: e.message, data: null } };
  }
};

const valor = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
};
</script>

<template>
  <section class="tx-view admin-mov">
    <header class="tx-heading cl-fade-up">
      <p class="transfer-eyebrow">ADMINISTRACIÓN · GESTIONAR CUENTAS</p>
      <h1>{{ titulo }}</h1>
      <p v-if="cliente">CLABE {{ cliente.clabe }} · Saldo actual ${{ moneda(cliente.saldo) }} MXN</p>
      <p v-else>Transferencias, ingresos y pagos de préstamo confirmados en todas las cuentas.</p>
    </header>

    <Panel title="Movimientos" :delay="100" :vacio="!cargando && !error && movimientos.length === 0" empty="No hay movimientos con estos filtros.">
      <div class="tx-filters">
        <template v-if="usuarioId">
          <button type="button" class="loan-plazo" :class="{ 'is-active': alcance === 'CUENTA' }" @click="cambiarAlcance('CUENTA')">Esta cuenta</button>
          <button type="button" class="loan-plazo" :class="{ 'is-active': alcance === 'TODAS' }" @click="cambiarAlcance('TODAS')">Todas las cuentas</button>
          <span class="admin-mov-sep" aria-hidden="true"></span>
        </template>
        <button
          v-for="t in TIPOS"
          :key="t.id"
          type="button"
          class="loan-plazo"
          :class="{ 'is-active': tipo === t.id }"
          @click="cambiarTipo(t.id)"
        >
          {{ t.label }}
        </button>
        <span class="tx-count">{{ total }} movimiento(s)</span>
      </div>

      <p v-if="cargando" class="transfer-field-hint">Cargando movimientos...</p>
      <div v-else-if="error" class="cl-error">
        <div class="alert-error">{{ error }}</div>
        <button type="button" class="btn-secondary" @click="cargar">Reintentar</button>
      </div>

      <ul v-else class="tx-list">
        <li v-for="m in movimientos" :key="m.id" class="tx-item" :class="{ 'is-open': abiertaId === m.id }">
          <div class="tx-row">
            <span
              class="tx-arrow"
              :class="m.direccion === 'ENTRADA' ? 'is-in' : m.direccion === 'SALIDA' ? 'is-out' : 'is-neutral'"
              aria-hidden="true"
            >
              {{ m.direccion === 'ENTRADA' ? '↓' : m.direccion === 'SALIDA' ? '↑' : '⇄' }}
            </span>
            <span class="tx-main">
              <strong>{{ m.concepto }}</strong>
              <small>
                {{ m.etiquetaTipo }} · {{ fechaHora(m.fecha) }}
                <template v-if="!m.direccion"> · {{ m.origen?.titular }}<template v-if="m.destino && m.destino.idCuenta !== m.origen?.idCuenta"> → {{ m.destino.titular }}</template></template>
              </small>
            </span>
            <b class="tx-amount" :class="m.direccion === 'ENTRADA' ? 'is-in' : m.direccion === 'SALIDA' ? 'is-out' : ''">
              {{ m.direccion === 'ENTRADA' ? '+' : m.direccion === 'SALIDA' ? '−' : '' }}${{ moneda(m.monto) }}
            </b>
            <button type="button" class="btn-chip tx-more" :aria-expanded="abiertaId === m.id" @click="alternarDetalle(m)">
              {{ abiertaId === m.id ? 'Ocultar detalles' : 'Ver más detalles' }}
            </button>
          </div>

          <div v-if="abiertaId === m.id" class="tx-detail cl-pop">
            <p v-if="detalles[m.id]?.cargando" class="transfer-field-hint">Cargando detalle...</p>
            <p v-else-if="detalles[m.id]?.error" class="transfer-feedback is-error">{{ detalles[m.id].error }}</p>
            <template v-else-if="detalles[m.id]?.data">
              <p class="tx-detail-title">PARTICIPANTES</p>
              <dl class="tx-dl">
                <div><dt>Cuenta origen</dt><dd>{{ parte(detalles[m.id].data.origen) }}</dd></div>
                <div><dt>Cuenta destino</dt><dd>{{ parte(detalles[m.id].data.destino) }}</dd></div>
              </dl>
              <p class="tx-detail-title">DOCUMENTO DE AUDITORÍA</p>
              <dl class="tx-dl">
                <div><dt>ID de transacción</dt><dd class="tx-mono">{{ detalles[m.id].data.documento._id }}</dd></div>
                <div><dt>Tipo</dt><dd>{{ detalles[m.id].data.documento.tipoMovimiento }}</dd></div>
                <div><dt>Estatus</dt><dd><span class="status-pill ready">{{ detalles[m.id].data.documento.estatus }}</span></dd></div>
                <div><dt>Monto</dt><dd>${{ moneda(detalles[m.id].data.documento.monto) }} MXN</dd></div>
                <div><dt>Creada</dt><dd>{{ fechaHora(detalles[m.id].data.documento.fechaCreacion) }}</dd></div>
                <div><dt>Actualizada</dt><dd>{{ fechaHora(detalles[m.id].data.documento.fechaActualizacion) }}</dd></div>
              </dl>
              <p class="tx-detail-title">PAYLOAD COMPLETO</p>
              <dl class="tx-dl">
                <div v-for="(v, k) in detalles[m.id].data.documento.payloadCompleto" :key="k">
                  <dt>{{ k }}</dt>
                  <dd class="tx-pre">{{ valor(v) }}</dd>
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
      <ActionButton label="Volver al panel" icon="back" variant="outline" @click="emit('volver')" />
    </div>
  </section>
</template>
