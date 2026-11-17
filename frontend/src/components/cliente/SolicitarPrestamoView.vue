<script setup>
import { computed, onMounted, ref } from 'vue';
import { apelarPrestamo, obtenerEvaluacionPrestamos, solicitarPrestamo } from '../../services/api';
import ActionButton from './ActionButton.vue';
import Panel from './Panel.vue';
import PrestamoCard from '../prestamos/PrestamoCard.vue';

const emit = defineEmits(['volver', 'saldo-actualizado']);

const PLAZOS = [3, 6, 12, 18, 24];
const MONTO_MINIMO = 500;

const cargando = ref(true);
const errorCarga = ref('');
const evaluacion = ref(null);
const prestamosOtorgados = ref([]);
const bitacora = ref([]);

const form = ref({ monto: '', plazoMeses: 12, motivo: '' });
const enviando = ref(false);
const error = ref('');
const resultado = ref(null); // respuesta de POST /prestamos/solicitar

// Apelación (tanto para el resultado recién rechazado como para el historial)
const apelacionAbiertaId = ref(null);
const textoApelacion = ref('');
const enviandoApelacion = ref(false);
const feedbackApelacion = ref({ tipo: '', texto: '' });

const moneda = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (d) => new Date(d).toLocaleDateString('es-MX');

const cargar = async () => {
  cargando.value = true;
  errorCarga.value = '';
  try {
    const data = await obtenerEvaluacionPrestamos();
    evaluacion.value = data.evaluacion;
    prestamosOtorgados.value = (data.prestamosOtorgados || []).filter(
      (p) => Number(p.estatus) === 1 && Number(p.saldoPendiente) > 0
    );
    bitacora.value = data.bitacoraSolicitudes || [];
  } catch (e) {
    errorCarga.value = e.message;
  } finally {
    cargando.value = false;
  }
};
onMounted(cargar);

const maximo = computed(() => Number(evaluacion.value?.montoMaximoPermitido || 0));
const montoNumero = computed(() => Number(form.value.monto));
const montoValido = computed(() => Number.isFinite(montoNumero.value) && montoNumero.value >= MONTO_MINIMO);
const fueraDeRango = computed(
  () => montoValido.value && (!evaluacion.value?.elegibleAutomatico || montoNumero.value > maximo.value)
);

// ---- Cantidades sugeridas, acotadas por la línea de crédito asignada ----
const redondear = (n) => (n >= 5000 ? Math.floor(n / 500) * 500 : Math.floor(n / 100) * 100);

const usoSugerido = (monto) => {
  if (monto <= 1500) return 'Imprevistos y gastos del mes';
  if (monto <= 4000) return 'Reparaciones o electrodomésticos';
  if (monto <= 10000) return 'Estudios, salud o mejoras del hogar';
  if (monto <= 25000) return 'Remodelación o equipo para tu negocio';
  return 'Capital de trabajo o consolidar deudas';
};

const sugerencias = computed(() => {
  if (!evaluacion.value?.elegibleAutomatico || maximo.value < MONTO_MINIMO) return [];
  const vistos = new Set();
  return [0.2, 0.4, 0.7, 1]
    .map((f) => Math.min(maximo.value, Math.max(MONTO_MINIMO, redondear(maximo.value * f))))
    .filter((m) => (vistos.has(m) ? false : vistos.add(m)))
    .map((monto) => ({ monto, uso: usoSugerido(monto), esMaximo: monto === maximo.value }));
});

const liquidados = computed(
  () =>
    (evaluacion.value?.prestamosConMora || []).filter(
      (p) => Number(p.saldoPendiente) === 0 || Number(p.estatus) === 2
    ).length
);

const mensajeHistorial = computed(() => {
  if (!evaluacion.value) return '';
  if (evaluacion.value.maxDiasAtraso > 0) {
    return 'Regulariza tu préstamo vencido para volver a acceder a una línea automática.';
  }
  if (liquidados.value > 0) {
    return `Has liquidado ${liquidados.value} préstamo(s): tu historial amplió tu línea. Cada préstamo pagado a tiempo la hace crecer.`;
  }
  return 'Aún no tienes préstamos liquidados. Pagar a tiempo tu primer préstamo amplía tu línea futura.';
});

const fechaVencimientoEstimada = computed(() => {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(form.value.plazoMeses));
  return d.toLocaleDateString('es-MX');
});

const elegirSugerencia = (monto) => {
  form.value.monto = String(monto);
  error.value = '';
};

const ajustarMonto = (delta) => {
  const actual = Number(form.value.monto) || 0;
  form.value.monto = String(Math.max(0, actual + delta));
};

const enviar = async () => {
  error.value = '';
  if (!montoValido.value) {
    error.value = `El monto mínimo de solicitud es de $${moneda(MONTO_MINIMO)} MXN.`;
    return;
  }
  if (form.value.motivo.trim().length < 5) {
    error.value = 'Cuéntanos para qué usarás el préstamo (mínimo 5 caracteres).';
    return;
  }
  enviando.value = true;
  try {
    const data = await solicitarPrestamo({
      montoSolicitado: montoNumero.value,
      plazoMeses: Number(form.value.plazoMeses),
      motivoSolicitud: form.value.motivo.trim(),
    });
    resultado.value = data;
    apelacionAbiertaId.value = null;
    feedbackApelacion.value = { tipo: '', texto: '' };
    if (data.aprobadoAutomaticamente) emit('saldo-actualizado', data.nuevoSaldoCuenta);
    await cargar();
  } catch (e) {
    error.value = e.message;
  } finally {
    enviando.value = false;
  }
};

const nuevaSolicitud = () => {
  resultado.value = null;
  form.value = { monto: '', plazoMeses: 12, motivo: '' };
  apelacionAbiertaId.value = null;
  feedbackApelacion.value = { tipo: '', texto: '' };
};

const abrirApelacion = (id) => {
  apelacionAbiertaId.value = id;
  textoApelacion.value = '';
  feedbackApelacion.value = { tipo: '', texto: '' };
};

const enviarApelacion = async (id) => {
  if (textoApelacion.value.trim().length < 10) {
    feedbackApelacion.value = {
      tipo: 'error',
      texto: 'Escribe al menos 10 caracteres explicando tu apelación.',
    };
    return;
  }
  enviandoApelacion.value = true;
  try {
    const res = await apelarPrestamo(id, textoApelacion.value.trim());
    feedbackApelacion.value = { tipo: 'ok', texto: res.mensaje };
    apelacionAbiertaId.value = null;
    textoApelacion.value = '';
    if (resultado.value?.auditoria?._id === id) {
      resultado.value = { ...resultado.value, apelada: true };
    }
    await cargar();
  } catch (e) {
    feedbackApelacion.value = { tipo: 'error', texto: e.message };
  } finally {
    enviandoApelacion.value = false;
  }
};

const aTarjeta = (p) => ({
  id: p.idPrestamo,
  montoOtorgado: Number(p.montoOtorgado),
  saldoPendiente: Number(p.saldoPendiente),
  tasaInteresMensual: Number(p.tasaInteresMensual),
  fechaVencimiento: p.fechaVencimiento,
  diasAtraso: p.diasAtrasoCalculados,
});

const claseEstatus = (e) => (e === 'EXITOSA' ? 'ready' : e === 'EN_APELACION' ? 'pending' : 'danger');
const etiquetaEstatus = (e) =>
  ({ EXITOSA: 'Aprobada', EN_APELACION: 'En apelación', RECHAZADA: 'Rechazada' })[e] || e;
const apelable = (doc) =>
  doc.tipoMovimiento === 'SOLICITUD_PRESTAMO' &&
  doc.estatus === 'RECHAZADA' &&
  !doc.payloadCompleto?.resolucionAdmin;
const detalleDoc = (doc) =>
  doc.payloadCompleto?.resolucionAdmin?.observacionesAdmin ||
  doc.payloadCompleto?.motivoRechazo ||
  (doc.tipoMovimiento === 'INGRESO_PRESTAMO' ? 'Préstamo aprobado y depositado en tu cuenta.' : '');
</script>

<template>
  <section class="transfer-view loan-view">
    <div v-if="cargando && !evaluacion" class="loading-shell">Evaluando tu línea de crédito...</div>

    <div v-else-if="errorCarga" class="cl-error cl-fade-up">
      <div class="alert-error">{{ errorCarga }}</div>
      <button type="button" class="btn-secondary" @click="cargar">Reintentar</button>
    </div>

    <template v-else>
      <!-- ========== Resultado de la solicitud ========== -->
      <div v-if="resultado" class="transfer-panel transfer-panel-elegant">
        <header class="transfer-heading">
          <p class="transfer-eyebrow">PRÉSTAMOS</p>
          <h1>{{ resultado.aprobadoAutomaticamente ? 'Préstamo aprobado' : 'Solicitud fuera de tu línea' }}</h1>
        </header>

        <div v-if="resultado.aprobadoAutomaticamente" class="transfer-confirmation" role="status">
          <span class="transfer-confirmation-mark" aria-hidden="true">✓</span>
          <div>
            <strong>${{ moneda(resultado.prestamo?.montoOtorgado) }} MXN depositados</strong>
            <p>{{ resultado.mensaje }}</p>
          </div>
        </div>

        <template v-else>
          <p class="transfer-feedback is-error" role="alert">{{ resultado.mensaje }}</p>

          <div v-if="resultado.apelada || feedbackApelacion.tipo === 'ok'" class="transfer-confirmation" role="status">
            <span class="transfer-confirmation-mark" aria-hidden="true">✓</span>
            <div>
              <strong>Apelación enviada</strong>
              <p>{{ feedbackApelacion.texto || 'Tu caso fue turnado como prioridad al administrador.' }}</p>
            </div>
          </div>

          <div v-else class="loan-appeal">
            <p class="loan-appeal-title">¿Crees que mereces este monto? Apela al banco</p>
            <p class="transfer-field-hint">
              Un administrador revisará manualmente tu caso. Explica tu situación y por qué puedes pagar.
            </p>
            <textarea
              v-model="textoApelacion"
              rows="3"
              class="field-input loan-textarea"
              maxlength="480"
              placeholder="Ej. Tengo ingresos fijos y pagaré puntualmente porque..."
            />
            <p v-if="feedbackApelacion.tipo === 'error'" class="transfer-feedback is-error" role="alert">
              {{ feedbackApelacion.texto }}
            </p>
            <div class="transfer-actions">
              <button
                type="button"
                class="cl-nav-action transfer-submit"
                :disabled="enviandoApelacion"
                @click="enviarApelacion(resultado.auditoria._id)"
              >
                <span class="cl-nav-action-mark" aria-hidden="true"></span>
                {{ enviandoApelacion ? 'Enviando...' : 'Enviar apelación prioritaria' }}
              </button>
            </div>
          </div>
        </template>

        <footer class="transfer-actions">
          <button type="button" class="cl-nav-action" @click="nuevaSolicitud">
            <span class="cl-nav-action-mark" aria-hidden="true"></span>Nueva solicitud
          </button>
          <button type="button" class="cl-nav-action" @click="emit('volver')">
            <span class="cl-nav-action-mark" aria-hidden="true"></span>Volver al inicio
          </button>
        </footer>
      </div>

      <!-- ========== Formulario de solicitud ========== -->
      <form v-else class="transfer-panel transfer-panel-elegant" @submit.prevent="enviar">
        <header class="transfer-heading">
          <p class="transfer-eyebrow">PRÉSTAMOS</p>
          <h1>Solicitar préstamo</h1>
          <p>Elige una cantidad sugerida o indica el monto que necesitas, y cuéntanos para qué lo usarás.</p>
        </header>

        <!-- Línea de crédito asignada -->
        <section class="loan-line" aria-label="Tu línea de crédito">
          <div>
            <span class="loan-line-label">TU LÍNEA DISPONIBLE</span>
            <div class="loan-line-amount">
              ${{ moneda(maximo) }} <small>MXN</small>
            </div>
            <p class="loan-line-note">{{ evaluacion?.motivoRegla }}</p>
          </div>
          <dl class="loan-line-stats">
            <div>
              <dt>Score</dt>
              <dd>{{ evaluacion?.score ?? 500 }} / 1000</dd>
            </div>
            <div>
              <dt>Deuda activa</dt>
              <dd>${{ moneda(evaluacion?.deudaActiva) }}</dd>
            </div>
          </dl>
        </section>
        <p class="loan-history-hint">{{ mensajeHistorial }}</p>

        <!-- Cantidades sugeridas -->
        <section v-if="sugerencias.length" aria-label="Cantidades sugeridas">
          <p class="loan-section-label">CANTIDADES SUGERIDAS PARA TI</p>
          <div class="loan-suggest-grid">
            <button
              v-for="s in sugerencias"
              :key="s.monto"
              type="button"
              class="loan-suggest"
              :class="{ 'is-active': montoNumero === s.monto }"
              @click="elegirSugerencia(s.monto)"
            >
              <span class="loan-suggest-amount">${{ moneda(s.monto).replace(/\.00$/, '') }}</span>
              <span class="loan-suggest-use">{{ s.uso }}</span>
              <span v-if="s.esMaximo" class="loan-suggest-tag">Tu máximo</span>
            </button>
          </div>
        </section>
        <p v-else class="transfer-feedback is-error">
          Por ahora no tienes una línea automática disponible, pero puedes solicitar un monto y apelar al banco.
        </p>

        <!-- Monto libre -->
        <section class="transfer-amount transfer-amount-elegant" aria-label="Monto solicitado">
          <label for="loan-monto">O INGRESA EL MONTO QUE NECESITAS · MXN</label>
          <div class="transfer-amount-display">
            <span class="transfer-currency">$</span>
            <input
              id="loan-monto"
              v-model="form.monto"
              type="number"
              :min="MONTO_MINIMO"
              step="100"
              placeholder="0.00"
              required
            />
          </div>
          <p class="transfer-amount-preview">
            {{ montoValido ? `$${moneda(montoNumero)} MXN` : `Mínimo $${moneda(MONTO_MINIMO)} MXN` }}
          </p>
          <div class="transfer-stepper" aria-label="Ajustar monto">
            <button type="button" @click="ajustarMonto(-500)">− $500</button>
            <button type="button" @click="ajustarMonto(500)">+ $500</button>
            <button type="button" @click="ajustarMonto(1000)">+ $1,000</button>
          </div>
        </section>

        <p v-if="fueraDeRango" class="loan-warning" role="status">
          Este monto excede tu línea actual (${{ moneda(maximo) }}). Podrás enviarlo y, si es rechazado,
          <strong>apelar al banco</strong> para una revisión manual.
        </p>

        <div class="transfer-fields transfer-fields-elegant loan-fields">
          <div class="transfer-field">
            <span>Plazo</span>
            <div class="loan-plazos" role="radiogroup" aria-label="Plazo en meses">
              <button
                v-for="p in PLAZOS"
                :key="p"
                type="button"
                role="radio"
                :aria-checked="form.plazoMeses === p"
                class="loan-plazo"
                :class="{ 'is-active': form.plazoMeses === p }"
                @click="form.plazoMeses = p"
              >
                {{ p }} meses
              </button>
            </div>
            <small class="transfer-field-hint">
              Tasa 2.5% mensual · vencimiento estimado {{ fechaVencimientoEstimada }}
            </small>
          </div>

          <label class="transfer-field loan-field-wide">
            <span>Motivo del préstamo <em>Obligatorio</em></span>
            <textarea
              v-model="form.motivo"
              rows="2"
              maxlength="250"
              class="field-input loan-textarea"
              placeholder="Ej. Reparación del auto para ir al trabajo"
              required
            />
          </label>
        </div>

        <p v-if="error" class="transfer-feedback is-error" role="alert">{{ error }}</p>

        <footer class="transfer-actions">
          <button type="button" class="cl-nav-action cl-nav-action--danger transfer-cancel" @click="emit('volver')">
            <span class="cl-nav-action-mark" aria-hidden="true"></span>Cancelar
          </button>
          <button type="submit" class="cl-nav-action transfer-submit" :disabled="enviando">
            <span class="cl-nav-action-mark" aria-hidden="true"></span>
            {{ enviando ? 'Procesando...' : fueraDeRango ? 'Enviar solicitud' : 'Solicitar préstamo' }}
          </button>
        </footer>
      </form>

      <!-- ========== Préstamos vigentes ========== -->
      <Panel
        title="Préstamos vigentes"
        :delay="120"
        :vacio="prestamosOtorgados.length === 0"
        empty="No tienes préstamos activos."
      >
        <div class="pm-stack">
          <PrestamoCard v-for="p in prestamosOtorgados" :key="p.idPrestamo" :prestamo="aTarjeta(p)" />
        </div>
      </Panel>

      <!-- ========== Historial de solicitudes y apelaciones ========== -->
      <Panel
        title="Mis solicitudes y apelaciones"
        :delay="200"
        :vacio="bitacora.length === 0"
        empty="Aquí verás tus solicitudes y su estatus."
      >
        <p
          v-if="feedbackApelacion.texto && !resultado"
          :class="feedbackApelacion.tipo === 'ok' ? 'alert-success' : 'alert-error'"
          style="margin-bottom: 0.75rem"
        >
          {{ feedbackApelacion.texto }}
        </p>
        <ul class="cl-list loan-history">
          <li v-for="doc in bitacora" :key="doc._id">
            <div class="loan-history-row">
              <div>
                <strong>${{ moneda(doc.monto) }} MXN</strong>
                <span class="status-pill" :class="claseEstatus(doc.estatus)">{{ etiquetaEstatus(doc.estatus) }}</span>
                <p class="loan-history-note">
                  {{ doc.payloadCompleto?.motivoSolicitud }}
                  <template v-if="detalleDoc(doc)"> — {{ detalleDoc(doc) }}</template>
                </p>
              </div>

              <button
                v-if="apelable(doc) && apelacionAbiertaId !== doc._id"
                type="button"
                class="btn-chip"
                @click="abrirApelacion(doc._id)"
              >
                Apelar al banco
              </button>
            </div>

            <div v-if="apelacionAbiertaId === doc._id" class="loan-appeal">
              <textarea
                v-model="textoApelacion"
                rows="2"
                class="field-input loan-textarea"
                maxlength="480"
                placeholder="Explica por qué solicitas una revisión manual..."
              />
              <div class="transfer-actions">
                <button type="button" class="cl-nav-action cl-nav-action--danger" @click="apelacionAbiertaId = null">
                  <span class="cl-nav-action-mark" aria-hidden="true"></span>Cancelar
                </button>
                <button
                  type="button"
                  class="cl-nav-action"
                  :disabled="enviandoApelacion"
                  @click="enviarApelacion(doc._id)"
                >
                  <span class="cl-nav-action-mark" aria-hidden="true"></span>
                  {{ enviandoApelacion ? 'Enviando...' : 'Enviar apelación' }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </Panel>

      <div class="loan-back">
        <ActionButton label="Volver al inicio" icon="back" variant="outline" @click="emit('volver')" />
      </div>
    </template>
  </section>
</template>
