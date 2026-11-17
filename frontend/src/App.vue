<script setup>
import { onMounted, ref } from 'vue';
import BrandShowcase from './components/auth/BrandShowcase.vue';
import RegistroForm from './components/auth/RegistroForm.vue';
import LoginView from './components/auth/LoginView.vue';
import AdminPanelView from './components/admin/AdminPanelView.vue';
import ClienteApp from './components/cliente/ClienteApp.vue';
import CancelacionFinalView from './components/cliente/CancelacionFinalView.vue';
import { obtenerPerfilSesion } from './services/api';

const vista = ref('login');
const emailRecienCreado = ref('');
const logoNoEncontrado = ref(false);
const sesionActiva = ref(null);
const verificandoSesion = ref(true);
const cuentaCancelada = ref(false);

onMounted(async () => {
  try {
    const perfil = await obtenerPerfilSesion();
    if (perfil?.usuario) {
      sesionActiva.value = perfil;
    }
  } finally {
    verificandoSesion.value = false;
  }
});

const irALoginConCorreo = (email) => {
  emailRecienCreado.value = email;
  vista.value = 'login';
};

const manejarLoginExitoso = (datosSesion) => {
  sesionActiva.value = datosSesion;
};

const manejarCancelacionCuenta = () => { sesionActiva.value = null; cuentaCancelada.value = true; };

const manejarLogout = () => {
  sesionActiva.value = null;
  vista.value = 'login';
};
</script>

<template>
  <div>
    <header class="top-navbar">
      <div class="navbar-inner">
        <div class="brand-lockup">
          <img
            v-if="!logoNoEncontrado"
            src="/logo.png"
            alt="Logo CervantesBank"
            class="brand-logo-img"
            @error="logoNoEncontrado = true"
          />
          <div v-else class="brand-logo-fallback">CB</div>
          <span class="brand-name">CervantesBank</span>
        </div>

        <span class="security-tag">● Conexión cifrada · Banca Digital</span>
      </div>
    </header>

    <div v-if="verificandoSesion" class="loading-shell">
      Verificando sesión segura...
    </div>

    <AdminPanelView
      v-else-if="sesionActiva && Number(sesionActiva.usuario?.isAdmin) === 1"
      :sesion="sesionActiva"
      @sesion-cerrada="manejarLogout"
    />

    <ClienteApp
      v-else-if="sesionActiva"
      :sesion="sesionActiva"
      @sesion-cerrada="manejarLogout"
      @cuenta-cancelada="manejarCancelacionCuenta"
    />

    <CancelacionFinalView v-else-if="cuentaCancelada" />

    <main v-else class="landing-grid">
      <BrandShowcase />

      <div>
        <nav class="auth-tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: vista === 'login' }"
            @click="vista = 'login'"
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: vista === 'registro' }"
            @click="vista = 'registro'"
          >
            Abrir Cuenta
          </button>
        </nav>

        <RegistroForm
          v-if="vista === 'registro'"
          @ir-a-login="irALoginConCorreo"
        />
        <LoginView
          v-else
          :email-precargado="emailRecienCreado"
          @cambiar-a-registro="vista = 'registro'"
          @login-exitoso="manejarLoginExitoso"
        />
      </div>
    </main>
  </div>
</template>