export {};

interface Curso {
  id: number;
  titulo: string;
  precio: number;
  imagen_url: string;
  instructor: string;
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarHeader();
  iniciarCheckout();
});

async function iniciarCheckout() {
  const token = localStorage.getItem('academy_token');
  const userJson = localStorage.getItem('academy_user');

  if (!token || !userJson) {
    sessionStorage.setItem('redirect_to_checkout', window.location.href);
    window.location.href = '/login';
    return;
  }

  let user;
  try {
    user = JSON.parse(userJson);
    if (user.rol !== 'estudiante') {
      alert('Los profesores no pueden comprar cursos.');
      window.location.href = '/';
      return;
    }
  } catch (e) {
    localStorage.clear();
    window.location.href = '/login';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const cursoId = urlParams.get('cursoId');

  if (!cursoId || isNaN(Number(cursoId))) {
    window.location.href = '/';
    return;
  }

  // Pre-rellenar datos del estudiante logueado
  const inputNombre = document.getElementById('nombreCliente') as HTMLInputElement;
  const inputEmail = document.getElementById('emailCliente') as HTMLInputElement;
  if (inputNombre) {
    inputNombre.value = user.nombre;
    inputNombre.disabled = true;
    
    // Disparar evento de input para que el tarjetero preview cargue el nombre
    const previewName = document.getElementById('previewName');
    if (previewName) previewName.textContent = user.nombre.toUpperCase();
  }
  if (inputEmail) {
    inputEmail.value = user.email;
    inputEmail.disabled = true;
  }

  // Cargar resumen de compra
  await cargarResumenPedido(Number(cursoId));

  // Configurar listeners de la tarjeta de crédito en vivo (Live UI Updates)
  configurarTarjeteroEnVivo();

  // Escuchar envío del formulario
  const form = document.getElementById('checkoutForm') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', (e) => procesarPagoSimulado(e, Number(cursoId)));
  }
}

/**
 * Carga el resumen de la compra en la barra lateral.
 */
async function cargarResumenPedido(cursoId: number) {
  const summarySpinner = document.getElementById('summarySpinner');
  const summaryContent = document.getElementById('summaryContent');

  const titleElem = document.getElementById('summaryCourseTitle');
  const instructorElem = document.getElementById('summaryCourseInstructor');
  const subtotalElem = document.getElementById('summaryCoursePriceSub');
  const totalElem = document.getElementById('summaryCoursePriceTotal');
  const imgElem = document.getElementById('summaryCourseImg') as HTMLImageElement;

  try {
    const response = await fetch(`/api/courses/${cursoId}`);
    
    if (!response.ok) {
      throw new Error('No se pudo recuperar el resumen del curso.');
    }

    const curso: Curso = await response.json();

    if (titleElem) titleElem.textContent = curso.titulo;
    if (instructorElem) instructorElem.textContent = curso.instructor;
    if (subtotalElem) subtotalElem.textContent = `$${curso.precio.toFixed(2)}`;
    if (totalElem) totalElem.textContent = `$${curso.precio.toFixed(2)}`;
    
    if (imgElem) {
      imgElem.src = curso.imagen_url;
      imgElem.alt = curso.titulo;
    }

    if (summarySpinner) summarySpinner.style.display = 'none';
    if (summaryContent) summaryContent.style.display = 'block';

  } catch (error) {
    console.error('Error al cargar resumen del pedido:', error);
    const wrapper = document.getElementById('orderSummaryWrapper');
    if (wrapper) {
      wrapper.innerHTML = `
        <div style="background-color: #fee2e2; border: 1px solid #fca5a5; padding: 1.5rem; border-radius: var(--radius-md); color: #b91c1c; font-size: 0.9rem;">
          <strong>Error al cargar el resumen del curso.</strong><br>
          Por favor, reintenta regresar a la landing y volver a clickear en comprar.
        </div>
      `;
    }
  }
}

/**
 * Agrega eventos a los inputs del formulario para actualizar el diseño de la tarjeta de crédito en tiempo real.
 */
function configurarTarjeteroEnVivo() {
  const inputNombre = document.getElementById('nombreCliente') as HTMLInputElement;
  const inputTarjeta = document.getElementById('numeroTarjeta') as HTMLInputElement;
  const inputExpiracion = document.getElementById('expiracionTarjeta') as HTMLInputElement;

  const previewName = document.getElementById('previewName');
  const previewNumber = document.getElementById('previewNumber');
  const previewExpiry = document.getElementById('previewExpiry');

  // Titular de Tarjeta
  inputNombre?.addEventListener('input', () => {
    if (previewName) {
      previewName.textContent = inputNombre.value.trim() !== '' ? inputNombre.value.toUpperCase() : 'NOMBRE APELLIDO';
    }
  });

  // Número de tarjeta con espaciado inteligente automático
  inputTarjeta?.addEventListener('input', () => {
    let value = inputTarjeta.value.replace(/\D/g, ''); // quitar todo excepto números
    
    // Formatear agrupando de a 4: 0000 0000 0000 0000
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += value[i];
    }
    
    inputTarjeta.value = formatted;

    if (previewNumber) {
      previewNumber.textContent = formatted.trim() !== '' ? formatted : '•••• •••• •••• ••••';
    }
  });

  // Expiración con auto barra diagonal (MM/AA)
  inputExpiracion?.addEventListener('input', () => {
    let value = inputExpiracion.value.replace(/\D/g, '');
    
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    
    inputExpiracion.value = value;

    if (previewExpiry) {
      previewExpiry.textContent = value.trim() !== '' ? value : 'MM/AA';
    }
  });
}

/**
 * Envía el formulario simulado de cobro al backend de Express.
 */
async function procesarPagoSimulado(e: Event, cursoId: number) {
  e.preventDefault();

  const nombreCliente = (document.getElementById('nombreCliente') as HTMLInputElement).value;
  const emailCliente = (document.getElementById('emailCliente') as HTMLInputElement).value;
  const numeroTarjeta = (document.getElementById('numeroTarjeta') as HTMLInputElement).value;
  const expiracionTarjeta = (document.getElementById('expiracionTarjeta') as HTMLInputElement).value;
  const cvvTarjeta = (document.getElementById('cvvTarjeta') as HTMLInputElement).value;

  const errorBox = document.getElementById('checkoutError');
  const btnSubmit = document.getElementById('btnSubmitCheckout') as HTMLButtonElement;
  const btnSubmitText = document.getElementById('btnSubmitText');
  const btnSubmitSpinner = document.getElementById('btnSubmitSpinner');

  if (errorBox) errorBox.style.display = 'none';

  // Validaciones básicas antes del envío
  const rawCard = numeroTarjeta.replace(/\s+/g, '');
  if (rawCard.length < 12) {
    mostrarError('El número de tarjeta debe tener al menos 12 dígitos.');
    return;
  }

  if (expiracionTarjeta.length < 5 || !expiracionTarjeta.includes('/')) {
    mostrarError('La fecha de expiración debe tener el formato MM/AA.');
    return;
  }

  if (cvvTarjeta.length < 3) {
    mostrarError('El código CVV debe tener al menos 3 dígitos.');
    return;
  }

  // Activar estado de carga del botón
  if (btnSubmit) btnSubmit.disabled = true;
  if (btnSubmitText) btnSubmitText.textContent = 'Procesando Pago con Pasarela de Stripe...';
  if (btnSubmitSpinner) btnSubmitSpinner.style.display = 'inline-block';

  try {
    const token = localStorage.getItem('academy_token');
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        curso_id: cursoId,
        numero_tarjeta: numeroTarjeta
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ocurrió un error inesperado al procesar la compra.');
    }

    // Redirigir a la pantalla de éxito pasando datos por query string para inyección inmediata
    window.location.href = `/success?orderId=${data.orderId}&courseTitle=${encodeURIComponent(data.courseTitle)}&clientName=${encodeURIComponent(data.clientName)}&clientEmail=${encodeURIComponent(data.clientEmail)}&amountPaid=${data.amountPaid}`;

  } catch (error) {
    console.error('Error durante checkout:', error);
    mostrarError((error as Error).message);
    
    // Restaurar estado del botón
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnSubmitText) btnSubmitText.textContent = 'Proceder con el Pago Simulado';
    if (btnSubmitSpinner) btnSubmitSpinner.style.display = 'none';
  }

  function mostrarError(mensaje: string) {
    if (errorBox) {
      errorBox.textContent = mensaje;
      errorBox.style.display = 'block';
    }
  }
}

/**
 * Inicializa el menú de cabecera con base en la sesión actual.
 */
function inicializarHeader() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const token = localStorage.getItem('academy_token');
  const userJson = localStorage.getItem('academy_user');

  let html = `<a href="/" class="nav__link">Inicio</a>`;
  html += `<a href="/#cursos" class="nav__link">Cursos</a>`;

  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      if (user.rol === 'profesor') {
        html += `<a href="/admin" class="nav__link">Panel Profesor</a>`;
      } else {
        html += `<a href="/estudiante" class="nav__link">Mis Cursos</a>`;
      }
      html += `<a href="#" class="nav__link" id="btnLogout">Cerrar Sesión</a>`;
    } catch (e) {
      localStorage.clear();
      html += `<a href="/login" class="nav__link">Acceder</a>`;
    }
  } else {
    html += `<a href="/login" class="nav__link">Acceder</a>`;
  }

  nav.innerHTML = html;

  const btnLogout = document.getElementById('btnLogout');
  btnLogout?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '/';
  });
}
