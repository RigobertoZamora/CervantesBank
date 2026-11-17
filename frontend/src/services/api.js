const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const registrarUsuario = async (datosUsuario) => {
  const response = await fetch(`${API_URL}/usuarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(datosUsuario),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'No se pudo completar el registro.');
  }

  return data;
};