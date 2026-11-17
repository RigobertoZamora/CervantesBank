<script setup>
import { computed, ref } from 'vue';
import CancelacionCuenta from '../cuenta/CancelacionCuenta.vue';

const props = defineProps({
  sesion: {
    type: Object,
    required: true,
  },
});

const copiando = ref(false);
const emit = defineEmits(['cuenta-cancelada']);

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


</script>

<template>
  <section class="dashboard-shell profile-view">
    <!-- Encabezado del cliente -->
    <div class="dashboard-header profile-heading cl-fade-up">
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

    </div>

    <!-- Grid principal de 2 columnas -->
    <div class="dashboard-grid profile-grid">
      <!-- Tarjeta 1: Cuenta bancaria (PostgreSQL) -->
      <div class="bank-card profile-card cl-fade-up">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600">
            CUENTA DIGITAL EN PESOS
          </span>
          <span class="status-pill ready">● Activa</span>
        </div>

        <div style="margin: 1.15rem 0">
          <div style="font-size: 0.78rem; color: var(--text-secondary)">SALDO DISPONIBLE</div>
          <div style="font-size: 2.15rem; font-weight: 700; letter-spacing: -0.03em">
            ${{ Number(sesion.cuenta?.saldo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
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

      <!-- Tarjeta 2: Estatus KYC (MongoDB) + Sesión Antifraude (Redis) -->
      <div class="form-grid profile-side-grid">
        <div class="bank-card profile-card cl-fade-up">
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

        <div class="bank-card profile-card cl-fade-up">
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
      <CancelacionCuenta @cuenta-cancelada="emit('cuenta-cancelada')" />
    </div>
  </section>
</template>