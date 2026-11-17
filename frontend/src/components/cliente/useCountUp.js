import { onBeforeUnmount, ref, watch } from 'vue';

// Anima un número desde su valor anterior hasta el valor actual de `target` (un ref).
export default function useCountUp(target, duration = 1100) {
  const value = ref(0);
  let raf = null;

  const animar = (destino) => {
    cancelAnimationFrame(raf);

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      value.value = destino;
      return;
    }

    const inicio = value.value;
    const t0 = performance.now();

    const tick = (ahora) => {
      const t = Math.min((ahora - t0) / duration, 1);
      const suavizado = 1 - Math.pow(1 - t, 3);
      value.value = inicio + (destino - inicio) * suavizado;
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  };

  watch(target, animar, { immediate: true });
  onBeforeUnmount(() => cancelAnimationFrame(raf));

  return value;
}
