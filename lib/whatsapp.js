export async function sendWhatsappMessage({ to, message }) {
  if (!to || !message) return;
  try {
    // Integración placeholder: solo registramos en logs del servidor.
    console.log(`[whatsapp] Enviando a ${to}: ${message}`);
  } catch (err) {
    console.error('No se pudo despachar mensaje de WhatsApp', err);
  }
}
