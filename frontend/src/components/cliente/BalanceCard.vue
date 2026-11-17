<script setup>
import { computed, ref, toRef } from 'vue';
import AppIcon from './AppIcon.vue';
import AppLogo from './AppLogo.vue';
import useCountUp from './useCountUp';

const props = defineProps({
  saldo: { type: Number, default: 0 },
  moneda: { type: String, default: 'MXN' },
  clabeInterbancaria: { type: String, default: '' },
  titular: { type: String, default: '' },
  hidden: { type: Boolean, default: false },
});
defineEmits(['toggle-hidden']);

const formato = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const saldoAnimado = useCountUp(toRef(props, 'saldo'));
const saldoTexto = computed(() => formato.format(saldoAnimado.value));
const clabeEnmascarada = computed(() =>
  props.clabeInterbancaria ? `•••• •••• •••• ${props.clabeInterbancaria.slice(-4)}` : '•••• •••• •••• ••••'
);

// Inclinación 3D suave siguiendo el cursor
const tarjeta = ref(null);
const alMover = (e) => {
  const el = tarjeta.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
};
const alSalir = () => {
  if (tarjeta.value) tarjeta.value.style.transform = '';
};
</script>

<template>
  <section
    ref="tarjeta"
    class="cl-balance"
    aria-label="Saldo disponible"
    @mousemove="alMover"
    @mouseleave="alSalir"
  >
    <div class="cl-balance-glow" aria-hidden="true"></div>
    <div class="cl-balance-sheen" aria-hidden="true"><span></span></div>

    <div class="cl-balance-top">
      <div class="cl-balance-id">
        <AppLogo size="2.5rem" />
        <div>
          <p class="cl-balance-brand">CervantesBank</p>
          <div class="cl-balance-label">
            <p>Saldo disponible</p>
            <button
              type="button"
              class="cl-eye"
              :aria-pressed="hidden"
              :aria-label="hidden ? 'Mostrar saldo' : 'Ocultar saldo'"
              :title="hidden ? 'Mostrar saldo' : 'Ocultar saldo'"
              @click="$emit('toggle-hidden')"
            >
              <span :key="String(hidden)" class="cl-pop" style="display: flex">
                <AppIcon :name="hidden ? 'eyeOff' : 'eye'" />
              </span>
            </button>
          </div>
        </div>
      </div>
      <div class="cl-chip" aria-hidden="true"></div>
    </div>

    <div class="cl-balance-amount">
      <p class="cl-amount">
        <span :key="String(hidden)" class="cl-pop">
          <span class="cl-sign">$</span>
          <span v-if="hidden" class="cl-dots" role="img" aria-label="Saldo oculto">
            <i v-for="n in 6" :key="n" :style="{ animationDelay: `${(n - 1) * 40}ms` }"></i>
          </span>
          <template v-else>{{ saldoTexto }}</template>
        </span>
      </p>
      <p class="cl-currency">{{ moneda }}</p>
    </div>

    <div class="cl-balance-bottom">
      <span class="cl-clabe">{{ clabeEnmascarada }}</span>
      <span class="cl-titular">{{ titular }}</span>
    </div>
  </section>
</template>
