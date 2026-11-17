<script setup>
import { computed } from 'vue';

// Tarjeta de un préstamo activo. Se reutiliza en Inicio, Solicitar préstamo y Pagar préstamo.
const props = defineProps({
  prestamo: { type: Object, required: true }, // { id, montoOtorgado, saldoPendiente, tasaInteresMensual, fechaVencimiento, diasAtraso }
  hidden: { type: Boolean, default: false },
  seleccionable: { type: Boolean, default: false },
  activo: { type: Boolean, default: false },
});
defineEmits(['seleccionar']);

const moneda = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mostrar = (n) => (props.hidden ? '••••' : `$${moneda(n)}`);

const progreso = computed(() => {
  const total = Number(props.prestamo.montoOtorgado) || 0;
  if (!total) return 0;
  const pagado = total - Number(props.prestamo.saldoPendiente);
  return Math.max(0, Math.min(100, Math.round((pagado / total) * 100)));
});
const atrasado = computed(() => Number(props.prestamo.diasAtraso) > 0);
const vence = computed(() => new Date(props.prestamo.fechaVencimiento).toLocaleDateString('es-MX'));
</script>

<template>
  <component
    :is="seleccionable ? 'button' : 'article'"
    :type="seleccionable ? 'button' : undefined"
    class="pm-card"
    :class="{ 'is-active': activo, 'is-late': atrasado, 'is-selectable': seleccionable }"
    :aria-pressed="seleccionable ? activo : undefined"
    @click="seleccionable && $emit('seleccionar', prestamo)"
  >
    <span class="pm-card-bar" aria-hidden="true"></span>

    <div class="pm-card-top">
      <span class="pm-card-id">PRÉSTAMO #{{ prestamo.id }}</span>
      <span class="status-pill" :class="atrasado ? 'danger' : 'ready'">
        {{ atrasado ? `${prestamo.diasAtraso} día(s) de atraso` : 'Al corriente' }}
      </span>
    </div>

    <div class="pm-card-balance">
      <small>SALDO PENDIENTE</small>
      <strong>{{ mostrar(prestamo.saldoPendiente) }} <span>MXN</span></strong>
    </div>

    <div class="pm-card-progress" role="progressbar" :aria-valuenow="progreso" aria-valuemin="0" aria-valuemax="100">
      <span :style="{ width: `${progreso}%` }"></span>
    </div>

    <dl class="pm-card-meta">
      <div><dt>Otorgado</dt><dd>{{ mostrar(prestamo.montoOtorgado) }}</dd></div>
      <div><dt>Pagado</dt><dd>{{ progreso }}%</dd></div>
      <div><dt>Tasa</dt><dd>{{ Number(prestamo.tasaInteresMensual) }}% mensual</dd></div>
      <div><dt>Vence</dt><dd>{{ vence }}</dd></div>
    </dl>
  </component>
</template>
