import { computed, onBeforeUnmount, ref } from 'vue';

// Permite probar cada franja con ?hora=0..23 en la URL (ej. /?usuario=1&hora=22).
const horaForzada = () => {
  const h = Number(new URLSearchParams(window.location.search).get('hora'));
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
};

export function periodoDe(hora) {
  if (hora >= 5 && hora < 12) return { id: 'manana', saludo: 'Buenos días', icono: 'sunrise' };
  if (hora >= 12 && hora < 15) return { id: 'mediodia', saludo: 'Buen mediodía', icono: 'noon' };
  if (hora >= 15 && hora < 18) return { id: 'tarde', saludo: 'Buenas tardes', icono: 'noon' };
  return { id: 'noche', saludo: 'Buenas noches', icono: 'moon' };
}

// Devuelve la fecha actual y la franja del día; se actualiza cada minuto.
export default function useDayPeriod() {
  const ahora = ref(new Date());
  const timer = setInterval(() => (ahora.value = new Date()), 60_000);
  onBeforeUnmount(() => clearInterval(timer));

  return computed(() => {
    const forzada = horaForzada();
    const date = new Date(ahora.value);
    if (forzada !== null) date.setHours(forzada, 0, 0, 0);
    return { date, periodo: periodoDe(date.getHours()) };
  });
}
