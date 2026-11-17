<script setup>
import { onMounted, ref } from 'vue';
import { obtenerEvaluacionPrestamos, apelarPrestamo } from '../../services/api';

const cargando = ref(true);
const evaluacion = ref(null);
const prestamosOtorgados = ref([]);
const bitacoraSolicitudes = ref([]);

const feedback = ref({ tipo: '', texto: '' });
const apelacionAbiertaId = ref(null);
const textoApelacion = ref('');
const enviandoApelacion = ref(false);

const cargarDatos = async () => {
  cargando.value = true;
  try {
    const data = await obtenerEvaluacionPrestamos();
    evaluacion.value = data.evaluacion;
    prestamosOtorgados.value = data.prestamosOtorgados || [];
    bitacoraSolicitudes.value = data.bitacoraSolicitudes || [];
  } catch (err) {
    feedback.value = { tipo: 'error', texto: err.message };
  } finally {
    cargando.value = false;
  }
};

onMounted(cargarDatos);

const abrirFormularioApelacion = (docId) => {
  apelacionAbiertaId.value = docId;
  textoApelacion.value = '';
};

const handleEnviarApelacion = async (auditoriaId) => {
  if (textoApelacion.value.trim().length < 10) {
    feedback.value = {
      tipo: 'error',
      texto: 'Escribe al menos 10 caracteres explicando tu apelación.',
    };
    return;
  }

  enviandoApelacion.value = true;
  try {
    const res = await apelarPrestamo(auditoriaId, textoApelacion.value);
    feedback.value = { tipo: 'ok', texto: res.mensaje };
    apelacionAbiertaId.value = null;
    textoApelacion.value = '';
    await cargarDatos();
  } catch (err) {
    feedback.value = { tipo: 'error', texto: err.message };
  } finally {
    enviandoApelacion.value = false;
  }
};
</script>

<template>
  <div class="loans-wrapper">
    <div class="section-divider" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 700">Consulta de Línea de Crédito y Préstamos</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem">
          Estado de capacidad crediticia (SQL), préstamos activos y seguimiento de apelaciones (MongoDB).
        </p>
      </div>
      <button type="button" class="btn-secondary" @click="cargarDatos">
        Actualizar consulta
      </button>
    </div>

    <div
      v-if="feedback.texto"
      :class="feedback.tipo === 'ok' ? 'alert-success' : 'alert-error'"
      style="margin-bottom: 1.25rem"
    >
      {{ feedback.texto }}
    </div>

    <div class="dashboard-grid">
      <!-- Columna 1: Diagnóstico Crediticio y Préstamos Otorgados (PostgreSQL) -->
      <div class="form-grid">
        <div class="bank-card">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600">
              CAPACIDAD CREDITICIA ACTUAL
            </span>
            <span
              class="status-pill"
              :class="evaluacion?.elegibleAutomatico ? 'ready' : 'pending'"
            >
              Score {{ evaluacion?.score ?? 500 }} / 1000
            </span>
          </div>

          <div class="digital-card-preview" style="margin-top: 0.85rem; margin-bottom: 0">
            <div style="font-size: 0.74rem; color: var(--text-secondary)">
              LÍMITE MÁXIMO CALCULADO
            </div>
            <div style="font-size: 1.85rem; font-weight: 700; color: var(--accent-orange)">
              ${{ Number(evaluacion?.montoMaximoPermitido || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
              <span style="font-size: 0.85rem; color: var(--text-secondary)">MXN</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem">
              {{ evaluacion?.motivoRegla || 'Evaluando parámetros financieros...' }}
            </p>
          </div>
        </div>

        <div class="bank-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem">
            <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600">
              PRÉSTAMOS VIGENTES (POSTGRESQL)
            </span>
            <span class="status-pill ready">{{ prestamosOtorgados.length }} activo(s)</span>
          </div>

          <p v-if="!prestamosOtorgados.length" style="color: var(--text-secondary); font-size: 0.84rem">
            No tienes préstamos activos registrados en tu cuenta.
          </p>

          <div v-else class="stack-list">
            <div v-for="p in prestamosOtorgados" :key="p.idPrestamo" class="info-subcard">
              <div style="display: flex; justify-content: space-between; align-items: center">
                <strong>Préstamo #{{ p.idPrestamo }} · ${{ Number(p.montoOtorgado).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}</strong>
                <span
                  class="status-pill"
                  :class="p.diasAtrasoCalculados > 0 ? 'danger' : 'ready'"
                >
                  {{ p.diasAtrasoCalculados > 0 ? `${p.diasAtrasoCalculados} días atraso` : 'Al corriente' }}
                </span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem">
                Saldo pendiente: <strong>${{ Number(p.saldoPendiente).toFixed(2) }} MXN</strong> ·
                Tasa: {{ Number(p.tasaInteresMensual) }}% mensual ·
                Vence: {{ new Date(p.fechaVencimiento).toLocaleDateString('es-MX') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Columna 2: Bitácora de Solicitudes y Apelaciones (MongoDB) -->
      <div class="bank-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem">
          <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600">
            HISTORIAL DE SOLICITUDES Y APELACIONES (MONGODB)
          </span>
        </div>

        <p v-if="!bitacoraSolicitudes.length" style="color: var(--text-secondary); font-size: 0.84rem">
          Aún no existen solicitudes registradas en auditoría para tu cuenta.
        </p>

        <div v-else class="stack-list">
          <div v-for="doc in bitacoraSolicitudes" :key="doc._id" class="info-subcard">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem">
              <strong>${{ Number(doc.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }} MXN</strong>
              <span
                class="status-pill"
                :class="
                  doc.estatus === 'EXITOSA'
                    ? 'ready'
                    : doc.estatus === 'EN_APELACION'
                      ? 'pending'
                      : 'danger'
                "
              >
                {{ doc.estatus }}
              </span>
            </div>

            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem">
              {{
                doc.payloadCompleto?.resolucionAdmin?.observacionesAdmin ||
                doc.payloadCompleto?.motivoRechazo ||
                'Préstamo aprobado e ingresado a cuenta.'
              }}
            </p>

            <div
              v-if="doc.estatus === 'RECHAZADA' && !doc.payloadCompleto?.resolucionAdmin"
              style="margin-top: 0.65rem"
            >
              <button
                v-if="apelacionAbiertaId !== doc._id"
                type="button"
                class="btn-chip"
                @click="abrirFormularioApelacion(doc._id)"
              >
                Apelar decisión al Administrador
              </button>

              <div v-else class="form-grid" style="margin-top: 0.5rem">
                <textarea
                  v-model="textoApelacion"
                  rows="2"
                  class="field-input"
                  placeholder="Explica los motivos para solicitar la revisión manual..."
                />
                <div style="display: flex; gap: 0.5rem">
                  <button
                    type="button"
                    class="btn-primary"
                    style="padding: 0.5rem 0.9rem; font-size: 0.82rem"
                    :disabled="enviandoApelacion"
                    @click="handleEnviarApelacion(doc._id)"
                  >
                    {{ enviandoApelacion ? 'Enviando...' : 'Enviar Apelación Prioritaria' }}
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    style="padding: 0.5rem 0.9rem; font-size: 0.82rem"
                    @click="apelacionAbiertaId = null"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>