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

// --- MÓDULO DE PRÉSTAMOS Y APELACIONES (CLIENTE) ---

export const obtenerEvaluacionPrestamos = async () => {
  const response = await fetch(`${API_URL}/prestamos/evaluacion`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo obtener la evaluación crediticia.');
  }
  return data;
};

export const solicitarPrestamo = async ({ montoSolicitado, plazoMeses, motivoSolicitud }) => {
  const response = await fetch(`${API_URL}/prestamos/solicitar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ montoSolicitado, plazoMeses, motivoSolicitud }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al procesar la solicitud de préstamo.');
  }
  return data;
};

export const apelarPrestamo = async (auditoriaId, motivoApelacion) => {
  const response = await fetch(`${API_URL}/prestamos/${auditoriaId}/apelar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ motivoApelacion }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo enviar la apelación.');
  }
  return data;
};

// --- PANEL UNIFICADO DE ADMINISTRADOR ---

export const obtenerResumenAdmin = async () => {
  const response = await fetch(`${API_URL}/admin/resumen-poliglota`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo cargar el resumen administrativo.');
  }
  return data;
};

export const dictaminarKycAdmin = async (usuarioId, { estatusValidacion, observacionesAdmin }) => {
  const response = await fetch(`${API_URL}/admin/kyc/${usuarioId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ estatusValidacion, observacionesAdmin }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al dictaminar expediente KYC.');
  }
  return data;
};

export const gestionarCuentaAdmin = async (usuarioId, accion) => {
  const response = await fetch(`${API_URL}/admin/cuentas/${usuarioId}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accion }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al actualizar estado de cuenta.');
  }
  return data;
};

export const resolverApelacionAdmin = async (
  auditoriaId,
  { decision, montoAprobado, observacionesAdmin }
) => {
  const response = await fetch(`${API_URL}/admin/apelaciones/${auditoriaId}/resolver`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ decision, montoAprobado, observacionesAdmin }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al resolver la apelación.');
  }
  return data;
};