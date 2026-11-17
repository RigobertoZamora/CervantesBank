<script setup>
import { computed, ref, watch } from 'vue';
import { cerrarSesion } from '../../services/api';
import PrestamosClienteSection from './PrestamosClienteSection.vue';

const props = defineProps({
  sesion: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['sesion-cerrada']);

const copiando = ref(false);
const cerrando = ref(false);
const saldoActual = ref(Number(props.sesion.cuenta?.saldo || 0));

watch(
  () => props.sesion.cuenta?.saldo,
  (nuevo) => {
    saldoActual.value = Number(nuevo || 0);
  }
);

const actualizarSaldo = (nuevoSaldo) => {
  saldoActual.value = Number(nuevoSaldo);
};

const nombreCompleto = computed(() => {
  const u = props.sesion.usuario;
  return [u.nombre, u.apellidoUno, u.apellidoDos].filter(Boolean).join(' ');
});

const estatusKyc = computed(() => props.sesion.expedienteKYC?.estatusValidacion || 'PENDIENTE');

const copiarClabe = async () => {
  const clabe = props.sesion.cuenta?.clabeInterbancaria;
  if (!clabe) return;
  await navigator.clipboard.writeText(clabe);
  copiando.value = true;
  setTimeout(() => {
    copiando.value = false;
  }, 2000);
};

const handleLogout = async () => {
  cerrando.value = true;
  try {
    await cerrarSesion();
  } catch {
    // Limpiamos la vista local incluso si el backend ya había invalidado la cookie
  } finally {
    cerrando.value = false;
    emit('sesion-cerrada');
  }
};
</script>

<template>
  <section class="dashboard-shell">
    <div class="dashboard-header">
      <div>
        <span class="hero-eyebrow" style="margin-bottom: 0.45rem">
          Cliente #{{ sesion.usuario.id }} · RFC {{ sesion.usuario.rfc }}
        </span>
        <h1 style="font-size: 1.65rem; font-weight: 700; letter-spacing: -0.02em">
          Hola, {{ nombreCompleto }}
        </h1>
        <p style="color: var(--text-secondary); font-size: 0.88rem">
          {{ sesion.usuario.email }}
        </p>
      </div>

      <button
        type="button"
        class="btn-secondary"
        :disabled="cerrando"
        @click="handleLogout"
      >
        {{ cerrando ? 'Cerrando...' : 'Cerrar Sesión' }}
      </button>
    </div>

    <div class="dashboard-grid">
      <div class="bank-card">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600">
            CUENTA DIGITAL EN PESOS
          </span>
          <span class="status-pill ready">● Activa</span>
        </div>

        <div style="margin: 1.15rem 0">
          <div style="font-size: 0.78rem; color: var(--text-secondary)">SALDO DISPONIBLE</div>
          <div style="font-size: 2.15rem; font-weight: 700; letter-spacing: -0.03em">
            ${{ saldoActual.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
            <span style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 500">MXN</span>
          </div>
        </div>

        <div class="digital-card-preview" style="margin-bottom: 0">
          <div style="font-size: 0.72rem; color: var(--text-secondary)">CLABE INTERBANCARIA</div>
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 0.75rem;
              flex-wrap: wrap;
              margin-top: 0.3rem;
            "
          >
            <span class="clabe-box" style="margin: 0">
              {{ sesion.cuenta?.clabeInterbancaria || 'Sin cuenta asignada' }}
            </span>
            <button type="button" class="btn-chip" @click="copiarClabe">
              {{ copiando ? '¡Copiada!' : 'Copiar CLABE' }}
            </button>
          </div>
        </div>
      </div>

      <div class="form-grid">
        <div class="bank-card">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600">
              VERIFICACIÓN DE IDENTIDAD (KYC)
            </span>
            <span
              class="status-pill"
              :class="estatusKyc === 'APROBADO' ? 'ready' : 'pending'"
            >
              {{ estatusKyc }}
            </span>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.84rem; margin-top: 0.65rem">
            {{
              sesion.expedienteKYC?.observacionesAdmin ||
              'Tu documentación oficial está en revisión por el área de cumplimiento.'
            }}
          </p>
        </div>

        <div class="bank-card">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600">
              SEGURIDAD DE SESIÓN ACTIVA
            </span>
            <span class="status-pill ready">● Protegida</span>
          </div>

          <div class="telemetry-grid">
            <div>
              <span class="telemetry-label">Último evento</span>
              <div class="telemetry-value">
                {{ sesion.sesionAntifraude?.accion || 'LOGIN_EXITOSO' }}
              </div>
            </div>
            <div>
              <span class="telemetry-label">Intentos fallidos</span>
              <div class="telemetry-value">
                {{ sesion.sesionAntifraude?.intentosFallidos ?? 0 }} / 3
              </div>
            </div>
            <div>
              <span class="telemetry-label">IP registrada</span>
              <div class="telemetry-value">
                {{ sesion.sesionAntifraude?.ipSospechosa || '127.0.0.1' }}
              </div>
            </div>
            <div>
              <span class="telemetry-label">Fecha de acceso</span>
              <div class="telemetry-value">
                {{
                  sesion.sesionAntifraude?.fechaEvento
                    ? new Date(sesion.sesionAntifraude.fechaEvento).toLocaleString('es-MX')
                    : 'Sesión vigente'
                }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Módulo integrado de Solicitud de Préstamos y Apelaciones -->
    <PrestamosClienteSection @saldo-actualizado="actualizarSaldo" />
  </section>
</template>