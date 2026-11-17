<script setup>
import { ref } from 'vue';
import { cerrarSesion } from '../../services/api';
import DashboardView from '../dashboard/DashboardView.vue';
import InicioView from './InicioView.vue';
import MainLayout from './MainLayout.vue';
import Pronto from './Pronto.vue';
import SolicitarPrestamoView from './SolicitarPrestamoView.vue';
import TransferenciasView from './TransferenciasView.vue';
import TransaccionesView from '../movimientos/TransaccionesView.vue';
import PagarPrestamoView from '../prestamos/PagarPrestamoView.vue';

// Área del cliente (después de iniciar sesión).
// Las páginas heredan de MainLayout; aquí solo se decide cuál mostrar.
const props = defineProps({
  sesion: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['sesion-cerrada', 'cuenta-cancelada']);

const SECCIONES = {
  transacciones: 'Gestionar transacciones',
  transferencias: 'Realizar transferencias',
  'prestamo-solicitar': 'Solicitar préstamo',
  'prestamo-pagar': 'Pagar préstamo',
};

const seccion = ref('inicio'); // 'inicio' | 'perfil' | clave de SECCIONES
const cerrando = ref(false);

const handleLogout = async () => {
  cerrando.value = true;
  try {
    await cerrarSesion();
  } finally {
    cerrando.value = false;
    emit('sesion-cerrada');
  }
};
</script>

<template>
  <MainLayout :etiqueta="`Cliente #${props.sesion.usuario.id}`">
    <template #acciones>
      <button v-if="seccion !== 'inicio'" type="button" class="cl-nav-action" @click="seccion = 'inicio'">
        <span class="cl-nav-action-mark" aria-hidden="true"></span>
        Inicio
      </button>
      <button v-if="seccion !== 'perfil'" type="button" class="cl-nav-action" @click="seccion = 'perfil'">
        <span class="cl-nav-action-mark" aria-hidden="true"></span>
        Ver Perfil
      </button>
      <button type="button" class="cl-nav-action cl-nav-action--danger" :disabled="cerrando" @click="handleLogout">
        <span class="cl-nav-action-mark" aria-hidden="true"></span>
        {{ cerrando ? 'Cerrando...' : 'Cerrar Sesión' }}
      </button>
    </template>

    <InicioView
      v-if="seccion === 'inicio'"
      :sesion="sesion"
      @navegar="seccion = $event"
      @sesion-cerrada="emit('sesion-cerrada')"
    />
    <!-- Vista previa del proyecto (KYC + seguridad de sesión), sin modificar -->
    <DashboardView v-else-if="seccion === 'perfil'" :sesion="sesion" @cuenta-cancelada="emit('cuenta-cancelada')" />
    <TransferenciasView v-else-if="seccion === 'transferencias'" @volver="seccion = 'inicio'" @transferencia-realizada="seccion = 'inicio'" />
    <TransaccionesView v-else-if="seccion === 'transacciones'" @volver="seccion = 'inicio'" @sesion-cerrada="emit('sesion-cerrada')" />
    <SolicitarPrestamoView v-else-if="seccion === 'prestamo-solicitar'" @volver="seccion = 'inicio'" />
    <PagarPrestamoView v-else-if="seccion === 'prestamo-pagar'" @volver="seccion = 'inicio'" @sesion-cerrada="emit('sesion-cerrada')" />
    <Pronto v-else :titulo="SECCIONES[seccion]" @volver="seccion = 'inicio'" />
  </MainLayout>
</template>
