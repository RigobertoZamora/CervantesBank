<script setup>
import { computed } from 'vue';
import DayIcon from './DayIcon.vue';
import useDayPeriod from './useDayPeriod';

const props = defineProps({ nombre: { type: String, default: '' } });

const dia = useDayPeriod();
const primerNombre = computed(() => props.nombre.trim().split(' ')[0]);

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fecha = computed(() =>
  capitalizar(
    new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(dia.value.date)
  )
);
</script>

<template>
  <section class="cl-greeting cl-fade-up" style="animation-delay: 60ms" aria-label="Bienvenida">
    <span class="cl-bar" aria-hidden="true"></span>
    <span class="cl-greeting-glow" aria-hidden="true"></span>

    <!-- `key` reinicia las animaciones cuando cambia la franja del día -->
    <div :key="dia.periodo.id" class="cl-greeting-row">
      <div class="cl-pop"><DayIcon :tipo="dia.periodo.icono" /></div>
      <div class="cl-greeting-text">
        <h2 class="cl-slide-in">
          {{ dia.periodo.saludo }}<span v-if="primerNombre">, {{ primerNombre }}</span>
        </h2>
        <p class="cl-slide-in">{{ fecha }} · Bienvenido a tu billetera</p>
      </div>
    </div>
  </section>
</template>
