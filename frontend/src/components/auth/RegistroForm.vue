<script setup>
import { reactive, ref } from 'vue';
import { registrarUsuario } from '../../services/api';

const emit = defineEmits(['ir-a-login']);

const form = reactive({
  nombre: '',
  apellidoUno: '',
  apellidoDos: '',
  rfc: '',
  email: '',
  password: '',
  tipoDocumento: 'INE',
  numeroDocumento: '',
});

const cargando = ref(false);
const error = ref('');
const resultado = ref(null);

const handleSubmit = async () => {
  error.value = '';
  cargando.value = true;

  try {
    const payload = {
      nombre: form.nombre.trim(),
      apellidoUno: form.apellidoUno.trim(),
      apellidoDos: form.apellidoDos.trim() || null,
      rfc: form.rfc.trim().toUpperCase(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      metadatosIdentificacion: {
        tipoDocumento: form.tipoDocumento,
        numeroDocumento: form.numeroDocumento.trim() || 'PENDIENTE_FOLIO',
      },
    };

    resultado.value = await registrarUsuario(payload);
  } catch (err) {
    error.value = err.message;
  } finally {
    cargando.value = false;
  }
};
</script>

<template>
  <div v-if="resultado" class="bank-card">
    <span class="status-pill ready">● Cuenta activa lista para operar</span>
    <h2 style="margin-top: 0.75rem; font-size: 1.3rem">
      ¡Bienvenido a CervantesBank, {{ resultado.usuario.nombre }}!
    </h2>
    <p style="color: var(--text-secondary); font-size: 0.88rem; margin-top: 0.25rem">
      Ya puedes iniciar sesión con tu correo o RFC mientras nuestro equipo concluye la verificación de tu identidad.
    </p>

    <div class="digital-card-preview">
      <div style="font-size: 0.74rem; color: var(--text-secondary)">
        CLABE INTERBANCARIA ASIGNADA
      </div>
      <div class="clabe-box">{{ resultado.cuentaInicial.clabeInterbancaria }}</div>

      <div style="display: flex; justify-content: space-between; align-items: center">
        <div>
          <div style="font-size: 0.72rem; color: var(--text-secondary)">SALDO INICIAL</div>
          <div style="font-size: 1.25rem; font-weight: 700">
            ${{ Number(resultado.cuentaInicial.saldo).toFixed(2) }} MXN
          </div>
        </div>
        <div style="text-align: right">
          <div style="font-size: 0.72rem; color: var(--text-secondary)">NÚMERO DE CLIENTE</div>
          <div style="font-weight: 600">#{{ resultado.usuario.id }}</div>
        </div>
      </div>
    </div>

    <div class="info-subcard">
      <span class="status-pill pending">Verificación de identidad en curso</span>
      <p style="color: var(--text-secondary); margin-top: 0.45rem; font-size: 0.82rem">
        Tu expediente fue enviado al área de validación ({{ resultado.notificacionAdminKYC.estatusValidacion }}). No bloquea tu acceso.
      </p>
    </div>

    <button
      type="button"
      class="btn-primary"
      @click="emit('ir-a-login', resultado.usuario.email)"
    >
      Ir a Iniciar Sesión
    </button>
  </div>

  <form v-else class="bank-card form-grid" @submit.prevent="handleSubmit">
    <div style="margin-bottom: 0.25rem">
      <h2 style="font-size: 1.2rem; font-weight: 700">Abre tu cuenta digital</h2>
      <p style="font-size: 0.83rem; color: var(--text-secondary)">
        Completa tus datos oficiales para generar tu CLABE al instante.
      </p>
    </div>

    <div v-if="error" class="alert-error">{{ error }}</div>

    <div class="field-group">
      <label class="field-label">Nombre(s) *</label>
      <input
        v-model="form.nombre"
        class="field-input"
        placeholder="Ej. Rigoberto"
        required
      />
    </div>

    <div class="form-row-2">
      <div class="field-group">
        <label class="field-label">Primer Apellido *</label>
        <input
          v-model="form.apellidoUno"
          class="field-input"
          placeholder="Ej. Zamora"
          required
        />
      </div>

      <div class="field-group">
        <label class="field-label">Segundo Apellido</label>
        <input
          v-model="form.apellidoDos"
          class="field-input"
          placeholder="Opcional"
        />
      </div>
    </div>

    <div class="form-row-2">
      <div class="field-group">
        <label class="field-label">RFC *</label>
        <input
          v-model="form.rfc"
          class="field-input"
          maxlength="14"
          placeholder="ZASR060101ABC"
          required
        />
      </div>

      <div class="field-group">
        <label class="field-label">Identificación Oficial</label>
        <select v-model="form.tipoDocumento" class="field-input">
          <option value="INE">INE / IFE</option>
          <option value="PASAPORTE">Pasaporte</option>
        </select>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">Correo Electrónico *</label>
      <input
        v-model="form.email"
        class="field-input"
        type="email"
        placeholder="nombre@correo.com"
        required
      />
    </div>

    <div class="field-group">
      <label class="field-label">Contraseña de acceso * (mínimo 8 caracteres)</label>
      <input
        v-model="form.password"
        class="field-input"
        type="password"
        minlength="8"
        placeholder="Crea una contraseña segura"
        required
      />
    </div>

    <div class="field-group">
      <label class="field-label">Folio o Clave de Identificación</label>
      <input
        v-model="form.numeroDocumento"
        class="field-input"
        :placeholder="form.tipoDocumento === 'INE' ? 'Clave de Elector (18 caracteres)' : 'Número de Pasaporte (ej. G12345678)'"
      />
    </div>

    <button type="submit" class="btn-primary" :disabled="cargando">
      {{ cargando ? 'Abriendo tu cuenta...' : 'Abrir cuenta ahora' }}
    </button>
  </form>
</template>