const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const registrarUsuario = async (datosUsuario) => {
  const response = await fetch(`${API_URL}/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datosUsuario),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo completar el registro.');
  }
  return data;
};

export const loginUsuario = async ({ identificador, password }) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Permite guardar la cookie HttpOnly cb_token
    body: JSON.stringify({ identificador, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Error al iniciar sesión.');
    error.status = response.status;
    error.antifraude = data.antifraude || null;
    throw error;
  }
  return data;
};

export const obtenerPerfilSesion = async () => {
  const response = await fetch(`${API_URL}/auth/me`, {
    method: 'GET',
    credentials: 'include', // Envía la cookie HttpOnly cb_token al servidor
  });

  if (!response.ok) {
    return null;
  }
  return await response.json();
};

export const cerrarSesion = async () => {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo cerrar la sesión.');
  }
  return data;
};