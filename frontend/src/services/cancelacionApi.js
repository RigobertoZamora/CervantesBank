const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Servicio aislado para la operación de cancelación de cuenta.
export const cancelarCuenta = async ({ motivo, detalle, confirmarIrreversible }) => {
  const response = await fetch(`${API_URL}/cuentas/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ motivo, detalle, confirmarIrreversible }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo cancelar la cuenta.');
    error.status = response.status;
    throw error;
  }

  return data;
};
