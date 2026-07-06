document.addEventListener('DOMContentLoaded', () => {
    inicializarHeader();
    actualizarHeroActions();
    cargarCursosDestacados();
});
/**
 * Inicializa el menú de cabecera con base en la sesión actual.
 */
function inicializarHeader() {
    const nav = document.querySelector('.nav');
    if (!nav)
        return;
    const token = localStorage.getItem('academy_token');
    const userJson = localStorage.getItem('academy_user');
    let html = `<a href="/" class="nav__link nav__link--active">Inicio</a>`;
    html += `<a href="#cursos" class="nav__link">Cursos</a>`;
    if (token && userJson) {
        try {
            const user = JSON.parse(userJson);
            if (user.rol === 'admin') {
                html += `<a href="/admin" class="nav__link">Panel Admin</a>`;
                html += `<a href="/estudiante" class="nav__link">Mis Cursos</a>`;
            }
            else if (user.rol === 'profesor') {
                html += `<a href="/admin" class="nav__link">Panel Profesor</a>`;
            }
            else {
                html += `<a href="/estudiante" class="nav__link">Mis Cursos</a>`;
            }
            html += `<a href="#" class="nav__link" id="btnLogout">Cerrar Sesión</a>`;
        }
        catch (e) {
            localStorage.clear();
            html += `<a href="/login" class="nav__link">Acceder</a>`;
        }
    }
    else {
        html += `<a href="/login" class="nav__link">Acceder</a>`;
    }
    nav.innerHTML = html;
    const btnLogout = document.getElementById('btnLogout');
    btnLogout?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.reload();
    });
}
/**
 * Actualiza el botón secundario del hero dependiendo de la sesión del usuario.
 */
function actualizarHeroActions() {
    const heroBtn = document.querySelector('.hero__actions .btn--outline');
    if (!heroBtn)
        return;
    const token = localStorage.getItem('academy_token');
    const userJson = localStorage.getItem('academy_user');
    if (token && userJson) {
        try {
            const user = JSON.parse(userJson);
            if (user.rol === 'admin') {
                heroBtn.textContent = 'Panel Admin';
                heroBtn.href = '/admin';
            }
            else if (user.rol === 'profesor') {
                heroBtn.textContent = 'Panel Profesor';
                heroBtn.href = '/admin';
            }
            else {
                heroBtn.textContent = 'Mis Cursos';
                heroBtn.href = '/estudiante';
            }
        }
        catch (e) {
            heroBtn.textContent = 'Acceder';
            heroBtn.href = '/login';
        }
    }
    else {
        heroBtn.textContent = 'Acceder';
        heroBtn.href = '/login';
    }
}
/**
 * Obtiene los cursos de la API y los renderiza en la grilla.
 */
async function cargarCursosDestacados() {
    const coursesGrid = document.getElementById('coursesGrid');
    if (!coursesGrid)
        return;
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error('No se pudo establecer conexión con el servidor.');
        }
        const cursos = await response.json();
        // Limpiar spinner
        coursesGrid.innerHTML = '';
        if (cursos.length === 0) {
            coursesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <p style="font-size: 1.1rem; font-weight: 500;">No hay cursos disponibles en este momento.</p>
          <p style="font-size: 0.9rem; margin-top: 0.5rem;">Intenta ingresar al panel de administración para registrar uno nuevo.</p>
        </div>
      `;
            return;
        }
        // Renderizar tarjetas
        cursos.forEach((curso) => {
            const card = crearTarjetaCurso(curso);
            coursesGrid.appendChild(card);
        });
    }
    catch (error) {
        console.error('Error al cargar cursos:', error);
        coursesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: var(--radius-md); color: #b91c1c;">
        <p style="font-weight: 600;">Error al cargar catálogo de cursos</p>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Verifica que el servidor esté activo. Detalle: ${error.message}</p>
      </div>
    `;
    }
}
/**
 * Crea el elemento HTML para una tarjeta de curso.
 */
function crearTarjetaCurso(curso) {
    const card = document.createElement('article');
    card.className = 'course-card';
    // Mostrar foto del instructor si existe
    const avatarHtml = curso.instructor_avatar && curso.instructor_avatar.trim() !== ''
        ? `<img class="instructor-avatar" src="${escapeHTML(curso.instructor_avatar)}" alt="${escapeHTML(curso.instructor)}" style="width: 24px; height: 24px; border: 1px solid white;">`
        : '';
    // Precio con descuento
    let priceHtml = '';
    if (curso.precio_original && curso.precio_original > curso.precio) {
        const pct = Math.round(((curso.precio_original - curso.precio) / curso.precio_original) * 100);
        priceHtml = `
      <div class="course-card__price-original-row">
        <span class="discount-badge" style="font-size: 0.65rem; padding: 1px 4px;">${pct}% Dto.</span>
        <span class="price-original" style="font-size: 0.8rem;">$${curso.precio_original.toFixed(2)}</span>
      </div>
      <span class="course-card__price">$${curso.precio.toFixed(2)}</span>
    `;
    }
    else {
        priceHtml = `<span class="course-card__price">$${curso.precio.toFixed(2)}</span>`;
    }
    // Estudiantes inscritos
    const totalStudents = (curso.estudiantes_inscritos || 0) + 2450;
    const studentsBadgeHtml = `
    <div class="student-enrollment-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      <span>${totalStudents.toLocaleString('es-ES')}</span>
    </div>
  `;
    card.innerHTML = `
    <div class="course-card__image-container">
      <img class="course-card__image" src="${escapeHTML(curso.imagen_url)}" alt="${escapeHTML(curso.titulo)}" loading="lazy">
    </div>
    <div class="course-card__content">
      <div class="course-card__meta" style="display: flex; align-items: center; gap: 0.5rem; justify-content: space-between; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.35rem;">
          ${avatarHtml}
          <span style="font-size: 0.8rem; color: var(--text-light); font-weight: 500;">Prof. ${escapeHTML(curso.instructor)}</span>
        </div>
        ${studentsBadgeHtml}
      </div>
      <h3 class="course-card__title" style="margin-top: 0.5rem;">${escapeHTML(curso.titulo)}</h3>
      <p class="course-card__description">${escapeHTML(curso.descripcion)}</p>
      <div class="course-card__footer" style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-end;">
        <div class="course-card__price-wrapper" style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.1rem;">
          <span class="course-card__price-label" style="margin-bottom: 0;">Precio</span>
          ${priceHtml}
        </div>
        <a href="/curso/${curso.id}" class="btn btn--navy btn--icon" title="Ver detalles de ${escapeHTML(curso.titulo)}" style="padding: 0.6rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  `;
    return card;
}
/**
 * Utilidad simple para escapar HTML y prevenir XSS.
 */
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
export {};
