<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { obtenerResumenCuenta } from '../../services/api';
import ActionButton from './ActionButton.vue';
import BalanceCard from './BalanceCard.vue';
import DayGreeting from './DayGreeting.vue';
import HistorialActividad from '../actividad/HistorialActividad.vue';
import PrestamoCard from '../prestamos/PrestamoCard.vue';
import Panel from './Panel.vue';

const props = defineProps({
  sesion: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['navegar', 'sesion-cerrada']);

const HIDE_KEY = 'cb-hide-balance';
const leerOculto = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
};

const oculto = ref(leerOculto());
watch(oculto, (valor) => {
  try {
    localStorage.setItem(HIDE_KEY, valor ? '1' : '0');
  } catch {
    /* sin almacenamiento disponible */
  }
});

// Respuesta de GET /api/cuentas/resumen -> { cuenta, historial, prestamos }
const resumen = ref(null);
const cargando = ref(true);
const error = ref('');

const nombre = computed(() => props.sesion.usuario.nombre);

const cargarResumen = async () => {
  cargando.value = true;
  error.value = '';
  try {
    resumen.value = await obtenerResumenCuenta();
  } catch (err) {
    resumen.value = null;
    error.value = err.message;
    // Sesión revocada o expirada: regresa al login
    if (err.status === 401) emit('sesion-cerrada');
  } finally {
    cargando.value = false;
  }
};

onMounted(cargarResumen);
</script>

<template>
  <DayGreeting :nombre="nombre" />

  <div v-if="cargando" class="loading-shell">Consultando tu saldo...</div>

  <div v-else-if="error" class="cl-error cl-fade-up">
    <div class="alert-error">{{ error }}</div>
    <button type="button" class="btn-secondary" @click="cargarResumen">Reintentar</button>
  </div>

  <template v-else>
    <!-- Saldo + acciones laterales: en móvil el saldo va arriba y los botones debajo -->
    <div class="cl-dash-grid">
      <div class="cl-dash-balance cl-fade-up" style="animation-delay: 100ms">
        <BalanceCard
          :saldo="resumen.cuenta.saldo"
          :moneda="resumen.cuenta.moneda"
          :clabe-interbancaria="resumen.cuenta.clabeInterbancaria"
          :titular="resumen.cuenta.titular"
          :hidden="oculto"
          @toggle-hidden="oculto = !oculto"
        />
      </div>
      <div class="cl-dash-left cl-fade-up" style="animation-delay: 220ms">
        <ActionButton
          label="Gestionar transacciones"
          icon="list"
          variant="outline"
          @click="emit('navegar', 'transacciones')"
        />
      </div>
      <div class="cl-dash-right cl-fade-up" style="animation-delay: 300ms">
        <ActionButton label="Realizar transferencias" icon="swap" @click="emit('navegar', 'transferencias')" />
      </div>
    </div>

    <!-- Historial de uso de la cuenta (accesos, solicitudes, KYC); requiere el resumen de Consultar Saldo -->
    <HistorialActividad @sesion-cerrada="emit('sesion-cerrada')" />

    <!-- Préstamos activos (SQL). Aquí también vivirá el caso de uso "Consultar Préstamos" -->
    <Panel
      title="Préstamos"
      :delay="480"
      :vacio="resumen.prestamos.length === 0"
      empty="Aquí se mostrarán tus préstamos activos."
    >
      <div class="pm-stack">
        <PrestamoCard v-for="p in resumen.prestamos" :key="p.id" :prestamo="p" :hidden="oculto" />
      </div>
      <template #footer>
        <ActionButton
          label="Solicitar préstamo"
          icon="plus"
          variant="outline"
          @click="emit('navegar', 'prestamo-solicitar')"
        />
        <ActionButton label="Pagar préstamo" icon="check" @click="emit('navegar', 'prestamo-pagar')" />
      </template>
    </Panel>
  </template>
</template>
