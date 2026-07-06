document.addEventListener('DOMContentLoaded', () => {
    renderizarExitoCompra();
});
/**
 * Obtiene los detalles de la compra desde la URL y los inyecta en el recibo.
 */
function renderizarExitoCompra() {
    const orderIdVal = document.getElementById('orderIdVal');
    const courseTitleVal = document.getElementById('courseTitleVal');
    const clientNameVal = document.getElementById('clientNameVal');
    const clientEmailVal = document.getElementById('clientEmailVal');
    const amountPaidVal = document.getElementById('amountPaidVal');
    const spinner = document.getElementById('successSpinner');
    const content = document.getElementById('successDetailsContent');
    // Obtener parámetros de búsqueda de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const courseTitle = urlParams.get('courseTitle');
    const clientName = urlParams.get('clientName');
    const clientEmail = urlParams.get('clientEmail');
    const amountPaid = urlParams.get('amountPaid');
    // Si no hay información mínima, redirigir a inicio
    if (!orderId || !courseTitle) {
        window.location.href = '/';
        return;
    }
    // Inyectar valores en el DOM de forma segura
    if (orderIdVal)
        orderIdVal.textContent = `#${orderId}`;
    if (courseTitleVal)
        courseTitleVal.textContent = courseTitle;
    if (clientNameVal)
        clientNameVal.textContent = clientName || 'Estudiante Registrado';
    if (clientEmailVal)
        clientEmailVal.textContent = clientEmail || 'N/A';
    if (amountPaidVal) {
        const val = amountPaid ? parseFloat(amountPaid) : 0.00;
        amountPaidVal.textContent = `$${val.toFixed(2)}`;
    }
    // Quitar spinner y desplegar contenido
    if (spinner)
        spinner.style.display = 'none';
    if (content)
        content.style.display = 'block';
}
export {};
