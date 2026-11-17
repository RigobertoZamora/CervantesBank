<script setup>
import { onMounted, reactive, ref } from 'vue';
import MainLayout from '../cliente/MainLayout.vue';
import {
  cerrarSesion,
  obtenerResumenAdmin,
  dictaminarKycAdmin,
  gestionarCuentaAdmin,
  resolverApelacionAdmin,
} from '../../services/api';

const props = defineProps({
  sesion: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['sesion-cerrada']);

const cargando = ref(true);
const cerrando = ref(false);
const mensaje = ref({ tipo: '', texto: '' });

const resumen = ref({
  kpis: {
    totalClientes: 0,
    kycPendientes: 0,
    apelacionesPendientes: 0,
    totalMejoresRendimiento: 0,
    totalPeoresMorosos: 0,
  },
  apelacionesPrioritarias: [],
  clientes: [],
  mejoresRendimiento: [],
  peoresMorosos: [],
});

const notasKyc = reactive({});
const notasApelacion = reactive({});
const montosApelacion = reactive({});

const cargarPanel = async () => {
  cargando.value = true;
  try {
    const data = await obtenerResumenAdmin();
    resumen.value = data;

    for (const ap of data.apelacionesPrioritarias || []) {
      if (montosApelacion[ap._id] === undefined) {
        montosApelacion[ap._id] = Number(ap.monto);
      }
    }
  } catch (err) {
    mensaje.value = { tipo: 'error', texto: err.message };
  } finally {
    cargando.value = false;
  }
};

onMounted(cargarPanel);

const handleDictamenKyc = async (usuarioId, estatusValidacion) => {
  try {
    const res = await dictaminarKycAdmin(usuarioId, {
      estatusValidacion,
      observacionesAdmin: notasKyc[usuarioId] || '',
    });
    mensaje.value = { tipo: 'ok', texto: res.mensaje };
    await cargarPanel();
  } catch (err) {
    mensaje.value = { tipo: 'error', texto: err.message };
  }
};

const handleGestionCuenta = async (usuarioId, accion) => {
  try {
    const res = await gestionarCuentaAdmin(usuarioId, accion);
    mensaje.value = { tipo: 'ok', texto: res.mensaje };
    await cargarPanel();
  } catch (err) {
    mensaje.value = { tipo: 'error', texto: err.message };
  }
};

const handleResolverApelacion = async (auditoriaId, decision) => {
  try {
    const res = await resolverApelacionAdmin(auditoriaId, {
      decision,
      montoAprobado: Number(montosApelacion[auditoriaId]),
      observacionesAdmin: notasApelacion[auditoriaId] || '',
    });
    mensaje.value = { tipo: 'ok', texto: res.mensaje };
    await cargarPanel();
  } catch (err) {
    mensaje.value = { tipo: 'error', texto: err.message };
  }
};

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
  <MainLayout etiqueta="Administrador">
    <template #acciones>
      <button type="button" class="cl-nav-action" @click="cargarPanel">
        <span class="cl-nav-action-mark" aria-hidden="true"></span>
        Actualizar datos
      </button>
      <button type="button" class="cl-nav-action cl-nav-action--danger" :disabled="cerrando" @click="handleLogout">
        <span class="cl-nav-action-mark" aria-hidden="true"></span>
        {{ cerrando ? 'Saliendo...' : 'Cerrar Sesión' }}
      </button>
    </template>

  <section class="dashboard-shell profile-view">
    <!-- Encabezado de Administrador Único -->
    <div class="dashboard-header profile-heading cl-fade-up">
      <div>
        <span class="hero-eyebrow" style="margin-bottom: 0.45rem">
          Administrador Único · Sin creación de perfiles admin adicionales
        </span>
        <h1 style="font-size: 1.65rem; font-weight: 700; letter-spacing: -0.02em">
          Consola Central de Supervisión Políglota
        </h1>
        <p style="color: var(--text-secondary); font-size: 0.88rem">
          Sesión administrativa: {{ sesion.usuario.nombre }} ({{ sesion.usuario.email }})
        </p>
      </div>
    </div>

    <div
      v-if="mensaje.texto"
      :class="mensaje.tipo === 'ok' ? 'alert-success' : 'alert-error'"
      style="margin-bottom: 1.25rem"
    >
      {{ mensaje.texto }}
    </div>

    <!-- Barra de KPIs consolidados (SQL + MongoDB + Redis) -->
    <div class="kpi-row">
      <div class="bank-card profile-card cl-fade-up kpi-box">
        <span class="telemetry-label">Clientes Registrados</span>
        <div class="kpi-number">{{ resumen.kpis.totalClientes }}</div>
      </div>
      <div class="bank-card profile-card cl-fade-up kpi-box">
        <span class="telemetry-label">KYC Pendientes (Mongo)</span>
        <div class="kpi-number" style="color: var(--status-warning)">
          {{ resumen.kpis.kycPendientes }}
        </div>
      </div>
      <div class="bank-card profile-card cl-fade-up kpi-box">
        <span class="telemetry-label">Apelaciones Prioritarias</span>
        <div class="kpi-number" style="color: var(--accent-orange)">
          {{ resumen.kpis.apelacionesPendientes }}
        </div>
      </div>
      <div class="bank-card profile-card cl-fade-up kpi-box">
        <span class="telemetry-label">Mejor Rendimiento</span>
        <div class="kpi-number" style="color: var(--status-success)">
          {{ resumen.kpis.totalMejoresRendimiento }}
        </div>
      </div>
      <div class="bank-card profile-card cl-fade-up kpi-box">
        <span class="telemetry-label">Peores Morosos</span>
        <div class="kpi-number" style="color: var(--status-danger)">
          {{ resumen.kpis.totalPeoresMorosos }}
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- APARTADO 1 (MISMA CAPA): GESTIONAR LÍNEAS DE CRÉDITO Y PRÉSTAMOS      -->
    <!-- ===================================================================== -->
    <div class="bank-card profile-card cl-fade-up admin-section">
      <div class="admin-section-header">
        <div>
          <span class="hero-eyebrow" style="margin-bottom: 0.35rem">Apartado 1 · PostgreSQL + MongoDB + Redis</span>
          <h2 style="font-size: 1.2rem; font-weight: 700">Gestionar Líneas de Crédito (Préstamos y Morosidad)</h2>
        </div>
      </div>

      <!-- Cola Prioritaria de Apelaciones desde MongoDB -->
      <div class="priority-zone">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem">
          <strong style="color: var(--accent-orange)">
            ⚡ Bandeja Prioritaria: Apelaciones de Préstamo Pendientes ({{ resumen.apelacionesPrioritarias.length }})
          </strong>
          <span style="font-size: 0.76rem; color: var(--text-secondary)">
            Origen: AuditoriaTransaccion (estatus = EN_APELACION)
          </span>
        </div>

        <p v-if="!resumen.apelacionesPrioritarias.length" style="font-size: 0.84rem; color: var(--text-secondary)">
          No hay apelaciones pendientes de resolución en este momento.
        </p>

        <div v-else class="stack-list">
          <div v-for="ap in resumen.apelacionesPrioritarias" :key="ap._id" class="info-subcard">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem">
              <div>
                <strong>{{ ap.clienteNombre }}</strong> · Solicita
                <span style="color: var(--accent-orange); font-weight: 700">
                  ${{ Number(ap.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }} MXN
                </span>
                ({{ ap.payloadCompleto?.plazoMeses || 12 }} meses)
              </div>
              <span class="status-pill pending">PRIORIDAD ALTA</span>
            </div>

            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.4rem">
              <strong>Motivo del cliente:</strong> "{{ ap.payloadCompleto?.apelacion?.motivoCliente }}"
            </p>
            <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem">
              Rango automático previo: ${{ Number(ap.payloadCompleto?.rangoMaximoCalculado || 0).toFixed(2) }} MXN
            </p>

            <div class="admin-inline-controls">
              <input
                v-model.number="montosApelacion[ap._id]"
                type="number"
                min="500"
                step="100"
                class="field-input"
                style="max-width: 170px"
                placeholder="Monto a aprobar"
              />
              <input
                v-model="notasApelacion[ap._id]"
                class="field-input"
                placeholder="Dictamen u observación del administrador..."
              />
              <button
                type="button"
                class="btn-chip-success"
                @click="handleResolverApelacion(ap._id, 'APROBAR')"
              >
                Aprobar y Abonar
              </button>
              <button
                type="button"
                class="btn-chip-danger"
                @click="handleResolverApelacion(ap._id, 'RECHAZAR')"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Análisis Automático: Mejores Rendimientos vs Peores Morosos -->
      <div class="dashboard-grid" style="margin-top: 1.25rem">
        <div class="info-subcard">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem">
            <strong style="color: var(--status-success)">▲ Clientes con Mejor Rendimiento</strong>
            <span class="status-pill ready">Score ≥ 680 · 0 días atraso</span>
          </div>

          <p v-if="!resumen.mejoresRendimiento.length" style="font-size: 0.82rem; color: var(--text-secondary)">
            Aún no hay clientes que alcancen el umbral de mejor rendimiento.
          </p>

          <div v-else class="stack-list">
            <div v-for="c in resumen.mejoresRendimiento" :key="c.usuario.id" class="ranking-item">
              <div>
                <strong>{{ c.usuario.nombre }} {{ c.usuario.apellidoUno }}</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary)">
                  Saldo débito: ${{ c.cuenta?.saldo.toFixed(2) }} · Rango préstamo: ${{ c.analisisCredito.montoMaximoPermitido.toFixed(2) }}
                </div>
              </div>
              <span class="status-pill ready">{{ c.analisisCredito.score }} pts</span>
            </div>
          </div>
        </div>

        <div class="info-subcard">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem">
            <strong style="color: var(--status-danger)">▼ Peores Morosos / Riesgo Crítico</strong>
            <span class="status-pill danger">Atraso &gt; 0 días o Score &lt; 450</span>
          </div>

          <p v-if="!resumen.peoresMorosos.length" style="font-size: 0.82rem; color: var(--text-secondary)">
            Sin clientes morosos o en riesgo crítico actualmente.
          </p>

          <div v-else class="stack-list">
            <div v-for="c in resumen.peoresMorosos" :key="c.usuario.id" class="ranking-item">
              <div>
                <strong>{{ c.usuario.nombre }} {{ c.usuario.apellidoUno }}</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary)">
                  Atraso máx: {{ c.analisisCredito.maxDiasAtraso }} día(s) · {{ c.analisisCredito.motivoRegla }}
                </div>
              </div>
              <span class="status-pill danger">{{ c.analisisCredito.score }} pts</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Explicación conceptual visible para sustentación técnica -->
      <div class="info-subcard" style="margin-top: 1rem">
        <strong style="font-size: 0.83rem">Metodología de Clasificación y Cálculo de Mora (creditoService.js):</strong>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem">
          Partiendo de una base de <strong>500 puntos</strong>, el motor suma liquidez en PostgreSQL (+1 pt por cada $100 MXN, máx. +200),
          cumplimiento KYC en MongoDB (+120 si está APROBADO, -150 si RECHAZADO) y préstamos liquidados a tiempo (+80 c/u).
          Los <strong>días de atraso</strong> se calculan dinámicamente comparando la fecha actual contra <code>fechaVencimiento</code> cuando
          <code>saldoPendiente &gt; 0</code>, penalizando -20 pts por día vencido y -200 pts si Redis reporta bloqueo antifraude.
        </p>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- APARTADO 2 y 3 (MISMA CAPA): VALIDACIÓN KYC Y GESTIONAR CUENTAS       -->
    <!-- ===================================================================== -->
    <div class="dashboard-grid" style="margin-top: 1.5rem">
      <!-- Apartado 2: Validación de Documentación KYC (MongoDB) -->
      <div class="bank-card profile-card cl-fade-up">
        <span class="hero-eyebrow" style="margin-bottom: 0.35rem">Apartado 2 · MongoDB</span>
        <h2 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.85rem">
          Validación de Documentación KYC
        </h2>

        <div class="stack-list">
          <div v-for="c in resumen.clientes" :key="`kyc-${c.usuario.id}`" class="info-subcard">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem">
              <div>
                <strong>#{{ c.usuario.id }} · {{ c.usuario.nombre }} {{ c.usuario.apellidoUno }}</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary)">
                  {{ c.kyc.tipoDocumento }}: <code>{{ c.kyc.numeroDocumento }}</code> · RFC: {{ c.usuario.rfc }}
                </div>
              </div>
              <span
                class="status-pill"
                :class="
                  c.kyc.estatusValidacion === 'APROBADO'
                    ? 'ready'
                    : c.kyc.estatusValidacion === 'RECHAZADO'
                      ? 'danger'
                      : 'pending'
                "
              >
                {{ c.kyc.estatusValidacion }}
              </span>
            </div>

            <div class="admin-inline-controls">
              <input
                v-model="notasKyc[c.usuario.id]"
                class="field-input"
                :placeholder="c.kyc.observacionesAdmin || 'Observación de validación...'"
              />
              <button
                type="button"
                class="btn-chip-success"
                @click="handleDictamenKyc(c.usuario.id, 'APROBADO')"
              >
                Aprobar
              </button>
              <button
                type="button"
                class="btn-chip-danger"
                @click="handleDictamenKyc(c.usuario.id, 'RECHAZADO')"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Apartado 3: Gestionar Cuentas (PostgreSQL + Redis) -->
      <div class="bank-card profile-card cl-fade-up">
        <span class="hero-eyebrow" style="margin-bottom: 0.35rem">Apartado 3 · PostgreSQL + Redis</span>
        <h2 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.85rem">
          Gestionar Cuentas y Desbloqueo Antifraude
        </h2>

        <div class="stack-list">
          <div v-for="c in resumen.clientes" :key="`cta-${c.usuario.id}`" class="info-subcard">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem">
              <div>
                <strong>{{ c.usuario.nombre }} {{ c.usuario.apellidoUno }}</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary)">
                  CLABE: {{ c.cuenta?.clabeInterbancaria || 'N/A' }} ·
                  Saldo: <strong>${{ Number(c.cuenta?.saldo || 0).toFixed(2) }}</strong>
                </div>
              </div>
              <span
                class="status-pill"
                :class="c.usuario.estatus === 1 ? 'ready' : 'danger'"
              >
                {{ c.usuario.estatus === 1 ? 'Activa' : 'Suspendida' }}
              </span>
            </div>

            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.35rem">
              Redis Antifraude:
              <strong :style="{ color: c.antifraude.bloqueado ? 'var(--status-danger)' : 'var(--text-primary)' }">
                {{ c.antifraude.bloqueado ? 'BLOQUEADA' : 'Normal' }}
              </strong>
              ({{ c.antifraude.intentosFallidos }} / 3 intentos)
            </div>

            <div class="admin-inline-controls">
              <button
                v-if="c.usuario.estatus === 1"
                type="button"
                class="btn-chip-danger"
                @click="handleGestionCuenta(c.usuario.id, 'SUSPENDER')"
              >
                Suspender Cuenta
              </button>
              <button
                v-else
                type="button"
                class="btn-chip-success"
                @click="handleGestionCuenta(c.usuario.id, 'ACTIVAR')"
              >
                Reactivar Cuenta
              </button>

              <button
                v-if="c.antifraude.bloqueado || c.antifraude.intentosFallidos > 0"
                type="button"
                class="btn-chip"
                @click="handleGestionCuenta(c.usuario.id, 'DESBLOQUEAR_REDIS')"
              >
                Desbloquear Redis
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  </MainLayout>
</template>
