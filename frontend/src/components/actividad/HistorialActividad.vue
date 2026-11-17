<script setup>
import { computed, onMounted, ref } from 'vue';
import { obtenerActividad } from '../../services/api';
import Panel from '../cliente/Panel.vue';

// Tarjeta "Historial" del inicio. Solo se monta cuando "Consultar Saldo" ya cargó la cuenta.
const emit = defineEmits(['sesion-cerrada']);

const VISIBLES_INICIAL = 6;
const actividad = ref([]);
const total = ref(0);
const cargando = ref(true);
const error = ref('');
const verTodo = ref(false);

const CATEGORIAS = {
  ACCESO: 'Acceso',
  PRESTAMO: 'Préstamo',
  KYC: 'Expediente',
  CUENTA: 'Cuenta',
};

const visibles = computed(() => (verTodo.value ? actividad.value : actividad.value.slice(0, VISIBLES_INICIAL)));

const fechaHora = (d) => new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

const cargar = async () => {
  cargando.value = true;
  error.value = '';
  try {
    const data = await obtenerActividad();
    actividad.value = data.actividad;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
    if (e.status === 401) emit('sesion-cerrada');
  } finally {
    cargando.value = false;
  }
};
onMounted(cargar);
</script>

<template>
  <Panel
    title="Historial de actividad"
    :delay="380"
    :vacio="!cargando && !error && actividad.length === 0"
    empty="Aquí se mostrará la actividad de tu cuenta."
  >
    <p v-if="cargando" class="transfer-field-hint">Cargando actividad...</p>
    <div v-else-if="error" class="cl-error">
      <div class="alert-error">{{ error }}</div>
      <button type="button" class="btn-secondary" @click="cargar">Reintentar</button>
    </div>

    <template v-else>
      <ul class="act-list">
        <li v-for="e in visibles" :key="e.id" class="act-item" :class="`is-${e.estado}`">
          <span class="act-dot" aria-hidden="true"></span>
          <div class="act-body">
            <div class="act-top">
              <strong>{{ e.titulo }}</strong>
              <span class="act-cat">{{ CATEGORIAS[e.categoria] || e.categoria }}</span>
            </div>
            <p v-if="e.detalle">{{ e.detalle }}</p>
            <small>{{ fechaHora(e.fecha) }}</small>
          </div>
        </li>
      </ul>
      <button v-if="actividad.length > VISIBLES_INICIAL" type="button" class="btn-chip act-more" @click="verTodo = !verTodo">
        {{ verTodo ? 'Ver menos' : `Ver toda la actividad (${actividad.length})` }}
      </button>
    </template>
  </Panel>
</template>
