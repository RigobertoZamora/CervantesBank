<script setup>
import { ref } from 'vue';
import BrandShowcase from './components/auth/BrandShowcase.vue';
import RegistroForm from './components/auth/RegistroForm.vue';
import LoginView from './components/auth/LoginView.vue';

const vista = ref('registro');
const emailRecienCreado = ref('');
const logoNoEncontrado = ref(false);

const irALoginConCorreo = (email) => {
  emailRecienCreado.value = email;
  vista.value = 'login';
};
</script>

<template>
  <div>
    <!-- Barra superior con espacio reservado para frontend/public/logo.png -->
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
          <div v-else class="brand-logo-fallback" title="Coloca tu imagen en frontend/public/logo.png">
            CB
          </div>
          <span class="brand-name">CervantesBank</span>
        </div>

        <span class="security-tag">● Conexión cifrada · Banca Digital Mexicana</span>
      </div>
    </header>

    <!-- Landing Page de dos columnas -->
    <main class="landing-grid">
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
        />
      </div>
    </main>
  </div>
</template>