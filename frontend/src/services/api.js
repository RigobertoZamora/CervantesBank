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

// --- CUENTA Y TRANSFERENCIAS (CLIENTE) ---

export const obtenerResumenCuenta = async () => {
  const response = await fetch(`${API_URL}/cuentas/resumen`, {
    method: 'GET',
    credentials: 'include', // Envía la cookie HttpOnly cb_token al servidor
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo consultar el saldo.');
    error.status = response.status;
    throw error;
  }
  return data;
};

export const realizarTransferencia = async (datos) => {
  const response = await fetch(`${API_URL}/transferencias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(datos),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo realizar la transferencia.');
    error.status = response.status;
    throw error;
  }
  return data;
};

export const consultarBeneficiario = async (clabe) => {
  const response = await fetch(`${API_URL}/transferencias/beneficiario?clabe=${encodeURIComponent(clabe)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || data.mensaje || 'No se pudo validar la CLABE.');
    error.status = response.status;
    throw error;
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

// --- TRANSACCIONES (CLIENTE): historial y detalle desde AuditoriaTransacciones ---

export const obtenerTransacciones = async ({ pagina = 1, limite = 20 } = {}) => {
  const response = await fetch(`${API_URL}/transacciones?pagina=${pagina}&limite=${limite}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo consultar el historial de transacciones.');
    error.status = response.status;
    throw error;
  }
  return data;
};

export const obtenerDetalleTransaccion = async (id) => {
  const response = await fetch(`${API_URL}/transacciones/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo consultar el detalle de la transacción.');
  }
  return data;
};

// --- HISTORIAL DE ACTIVIDAD DE LA CUENTA (accesos, solicitudes, KYC; no son transacciones) ---

export const obtenerActividad = async ({ limite = 30 } = {}) => {
  const response = await fetch(`${API_URL}/actividad?limite=${limite}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo consultar el historial de actividad.');
    error.status = response.status;
    throw error;
  }
  return data;
};

// --- PAGO DE PRÉSTAMOS (CLIENTE) ---

export const obtenerPrestamosPagables = async () => {
  const response = await fetch(`${API_URL}/pagos-prestamo`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudieron consultar tus préstamos.');
    error.status = response.status;
    throw error;
  }
  return data;
};

export const pagarPrestamo = async ({ idPrestamo, monto }) => {
  const response = await fetch(`${API_URL}/pagos-prestamo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idPrestamo, monto }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo realizar el pago.');
    error.status = response.status;
    throw error;
  }
  return data;
};

// --- ADMIN: MOVIMIENTOS (segunda capa de "Gestionar Cuentas") ---

export const obtenerMovimientosAdmin = async ({ usuarioId, tipo, pagina = 1, limite = 20 } = {}) => {
  const params = new URLSearchParams({ pagina, limite });
  if (usuarioId) params.set('usuarioId', usuarioId);
  if (tipo) params.set('tipo', tipo);
  const response = await fetch(`${API_URL}/admin-movimientos?${params}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron consultar los movimientos.');
  }
  return data;
};

export const obtenerDetalleMovimientoAdmin = async (id) => {
  const response = await fetch(`${API_URL}/admin-movimientos/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo consultar el detalle del movimiento.');
  }
  return data;
};
