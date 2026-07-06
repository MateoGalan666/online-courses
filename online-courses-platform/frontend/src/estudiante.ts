export {};

const TOKEN_KEY = 'academy_token';
const USER_KEY  = 'academy_user';

// ──────────────── INTERFACES ────────────────
interface Curso {
  id: number;
  titulo: string;
  descripcion: string;
  precio: number;
  imagen_url: string;
  instructor: string;
}

interface Leccion {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string;
  video_url: string;
  orden: number;
  dia?: number;
  contenido_html?: string;
}

interface Deber {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string;
  fecha_limite: string;
  contenido_respuesta?: string;
  fecha_entrega?: string;
  calificacion?: string | null;
}

// ──────────────── ESTADO GLOBAL ────────────────
let cursoActivoId: number | null = null;
let leccionesActivas: Leccion[] = [];
let deberesActivos:  Deber[]   = [];
let usuarioRol: string = '';
let editingLessonId: number | null = null;
let editingAssignmentId: number | null = null;
let currentLeccionId: number | null = null;

// ──────────────── INIT ────────────────
document.addEventListener('DOMContentLoaded', () => {
  const userJson = localStorage.getItem(USER_KEY);
  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      usuarioRol = user.rol;
      if (user.rol === 'profesor' || user.rol === 'admin') {
        document.querySelectorAll('.role-teacher-only').forEach(el => {
          (el as HTMLElement).style.display = '';
        });
        // mostrar sección de herramientas de deberes
        const teacherTools = document.getElementById('teacherAssignmentTools');
        if (teacherTools) teacherTools.style.display = 'flex';
      }
    } catch (e) {}
  }

  inicializarHeader();
  verificarAcceso();
  cargarMisCursos().then(() => {
    const params = new URLSearchParams(window.location.search);
    const cursoId = params.get('curso');
    if (cursoId) {
      const item = document.querySelector(`.student-course-item[data-curso-id="${cursoId}"]`) as HTMLElement;
      if (item) item.click();
    }
  });

  // Tabs del aula
  const tabLessons     = document.getElementById('tabLessons');
  const tabAssignments = document.getElementById('tabAssignments');
  const panelLessons     = document.getElementById('panelLessons');
  const panelAssignments = document.getElementById('panelAssignments');

  tabLessons?.addEventListener('click', () => {
    tabLessons.classList.add('course-tab--active');
    tabAssignments?.classList.remove('course-tab--active');
    panelLessons?.classList.add('tab-content--active');
    panelAssignments?.classList.remove('tab-content--active');
  });
  tabAssignments?.addEventListener('click', () => {
    tabAssignments.classList.add('course-tab--active');
    tabLessons?.classList.remove('course-tab--active');
    panelAssignments?.classList.add('tab-content--active');
    panelLessons?.classList.remove('tab-content--active');
  });

  // Botones modal clase
  document.getElementById('btnAddLessonTab')?.addEventListener('click', () => abrirModalClase());
  document.getElementById('btnLessonModalClose')?.addEventListener('click', cerrarModalClase);
  document.getElementById('btnCancelLessonEdit')?.addEventListener('click', cerrarModalClase);
  document.getElementById('lessonForm')?.addEventListener('submit', guardarClase);

  // Botones modal deber
  document.getElementById('btnAddAssignment')?.addEventListener('click', () => abrirModalDeber());
  document.getElementById('btnAssignmentModalClose')?.addEventListener('click', cerrarModalDeber);
  document.getElementById('btnCancelAssignment')?.addEventListener('click', cerrarModalDeber);
  document.getElementById('assignmentForm')?.addEventListener('submit', guardarDeber);

  // Botones modal pregunta
  document.getElementById('btnAddQuestion')?.addEventListener('click', abrirModalPregunta);
  document.getElementById('btnQuestionModalClose')?.addEventListener('click', cerrarModalPregunta);
  document.getElementById('btnCancelQuestion')?.addEventListener('click', cerrarModalPregunta);
  document.getElementById('questionForm')?.addEventListener('submit', guardarPregunta);

  // Modal entrega deber
  document.getElementById('btnDeliveryModalClose')?.addEventListener('click', cerrarModalEntrega);
  document.getElementById('btnDeliveryCancel')?.addEventListener('click', cerrarModalEntrega);
  document.getElementById('deliveryForm')?.addEventListener('submit', enviarEntrega);

  // Sincronizar editor HTML → Visual
  const htmlArea = document.getElementById('lessonContentField') as HTMLTextAreaElement;
  htmlArea?.addEventListener('input', () => {
    // nada extra; al guardar leemos el textarea
  });
});

// ──────────────── AUTH ────────────────
function verificarAcceso() {
  const token   = localStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  if (!token || !userJson) { window.location.href = '/login'; return; }
  try {
    const user = JSON.parse(userJson);
    if (!['estudiante','profesor','admin'].includes(user.rol)) window.location.href = '/';
  } catch (e) {
    localStorage.clear();
    window.location.href = '/login';
  }
}

// ──────────────── HEADER ────────────────
function inicializarHeader() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  const token   = localStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  let html = `<a href="/" class="nav__link">Inicio</a><a href="/#cursos" class="nav__link">Cursos</a>`;
  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      if (user.rol === 'admin') {
        html += `<a href="/admin" class="nav__link">Panel Admin</a>`;
        html += `<a href="/estudiante" class="nav__link nav__link--active">Mis Cursos</a>`;
      } else if (user.rol === 'profesor') {
        html += `<a href="/admin" class="nav__link">Panel Profesor</a>`;
        html += `<a href="/estudiante" class="nav__link nav__link--active">Mis Clases</a>`;
      } else {
        html += `<a href="/estudiante" class="nav__link nav__link--active">Mis Cursos</a>`;
      }
      html += `<a href="#" class="nav__link" id="btnLogout">Cerrar Sesión</a>`;
    } catch (e) {
      html += `<a href="/login" class="nav__link">Acceder</a>`;
    }
  } else {
    html += `<a href="/login" class="nav__link">Acceder</a>`;
  }
  nav.innerHTML = html;
  document.getElementById('btnLogout')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '/';
  });
}

// ──────────────── CURSOS ────────────────
async function cargarMisCursos() {
  const listElem = document.getElementById('studentCourseList');
  if (!listElem) return;
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    let url = '/api/courses/my-learning';
    if (usuarioRol === 'admin')    url = '/api/courses';
    if (usuarioRol === 'profesor') url = '/api/profesor/courses';
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    const cursos: Curso[] = await res.json();
    listElem.innerHTML = '';
    if (cursos.length === 0) {
      listElem.innerHTML = `<p style="text-align:center;color:var(--text-light);font-size:0.85rem;padding:1rem 0;">No hay cursos disponibles.</p>`;
      return;
    }
    cursos.forEach(curso => {
      const li = document.createElement('li');
      li.className = 'student-course-item';
      li.dataset.cursoId = curso.id.toString();
      li.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>${escapeHTML(curso.titulo)}</span>`;
      li.addEventListener('click', () => {
        listElem.querySelectorAll('.student-course-item').forEach(i => i.classList.remove('student-course-item--active'));
        li.classList.add('student-course-item--active');
        seleccionarCurso(curso);
      });
      listElem.appendChild(li);
    });
  } catch {
    listElem.innerHTML = `<p style="color:var(--danger);font-size:0.85rem;text-align:center;">Error al cargar cursos.</p>`;
  }
}

async function seleccionarCurso(curso: Curso) {
  cursoActivoId = curso.id;
  document.getElementById('lmsWelcomeScreen')!.style.display = 'none';
  document.getElementById('activeCourseContent')!.style.display = 'block';
  document.getElementById('activeCourseTitle')!.textContent = curso.titulo;
  document.getElementById('lessonViewArea')!.style.display = 'none';

  await Promise.all([cargarLecciones(curso.id), cargarDeberes(curso.id)]);
}

// ──────────────── LECCIONES ────────────────
async function cargarLecciones(cursoId: number, activarLessonId?: number) {
  const token = localStorage.getItem(TOKEN_KEY);
  const lessonsList = document.getElementById('lessonsList');
  if (lessonsList) lessonsList.innerHTML = '<div class="loading-spinner" style="margin:2rem auto;"></div>';

  try {
    const res = await fetch(`/api/courses/${cursoId}/lessons`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    leccionesActivas = await res.json();
    renderBrowserTabs(leccionesActivas, activarLessonId);
    renderTemario(leccionesActivas);
  } catch {
    if (lessonsList) lessonsList.innerHTML = `<div style="color:var(--danger);text-align:center;">Error al cargar lecciones.</div>`;
  }
}

function renderBrowserTabs(lecciones: Leccion[], activarLessonId?: number) {
  const bar       = document.getElementById('browserTabsBar');
  const container = document.getElementById('browserTabsContainer');
  if (!bar || !container) return;

  if (lecciones.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  container.innerHTML = '';

  const sorted = [...lecciones].sort((a, b) => ((a.dia||1)*1000 + (a.orden||0)) - ((b.dia||1)*1000 + (b.orden||0)));

  // Determinar qué lección activar
  let activeLeccion = sorted[0];
  if (activarLessonId) {
    const found = sorted.find(l => l.id === activarLessonId);
    if (found) activeLeccion = found;
  } else if (currentLeccionId) {
    const found = sorted.find(l => l.id === currentLeccionId);
    if (found) activeLeccion = found;
  }

  sorted.forEach((leccion) => {
    const tab = document.createElement('div');
    tab.className = 'browser-tab' + (activeLeccion && leccion.id === activeLeccion.id ? ' browser-tab--active' : '');
    tab.dataset.lessonId = leccion.id.toString();

    if (usuarioRol === 'profesor' || usuarioRol === 'admin') {
      const editBtn = document.createElement('button');
      editBtn.className = 'tab-icon-btn edit';
      editBtn.title = 'Editar';
      editBtn.textContent = '✏';
      editBtn.addEventListener('click', e => { e.stopPropagation(); abrirModalClase(leccion); });
      tab.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'tab-icon-btn';
      delBtn.title = 'Eliminar';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', e => { e.stopPropagation(); eliminarLeccion(leccion.id); });
      tab.appendChild(delBtn);
    }

    const label = document.createElement('span');
    label.textContent = `Día ${leccion.dia||1} · ${leccion.titulo}`;
    tab.appendChild(label);

    tab.addEventListener('click', () => {
      container.querySelectorAll('.browser-tab').forEach(t => t.classList.remove('browser-tab--active'));
      tab.classList.add('browser-tab--active');
      mostrarLeccion(leccion);
    });

    container.appendChild(tab);
  });

  if (activeLeccion) {
    mostrarLeccion(activeLeccion);
  }
}

function mostrarLeccion(leccion: Leccion) {
  currentLeccionId = leccion.id;
  const area = document.getElementById('lessonViewArea');
  if (area) area.style.display = 'block';

  const titleEl = document.getElementById('activeLessonTitle');
  const descEl  = document.getElementById('activeLessonDesc');
  if (titleEl) titleEl.textContent = leccion.titulo;
  if (descEl)  descEl.textContent  = leccion.descripcion || '';

  const wrapper = document.getElementById('lessonMediaContainer');
  if (!wrapper) return;

  const tieneVideo    = !!(leccion.video_url && leccion.video_url.trim());
  const tieneContenido = !!(leccion.contenido_html && leccion.contenido_html.trim());
  let mediaHTML = '';

  if (tieneVideo) {
    const ytMatch = leccion.video_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
    mediaHTML = ytMatch
      ? `<div class="video-player-wrapper"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen></iframe></div>`
      : `<div class="video-player-wrapper"><video src="${leccion.video_url}" controls></video></div>`;
  }

  if (tieneContenido) {
    mediaHTML += `<div class="lesson-rich-content">${leccion.contenido_html}</div>`;
  }

  if (!tieneVideo && !tieneContenido) {
    mediaHTML = `<div style="text-align:center;padding:2.5rem 1rem;color:var(--text-light);background:#f8f9fa;border-radius:var(--radius-md);border:1px solid var(--border-color);">
      <span style="font-size:2.5rem;display:block;margin-bottom:0.75rem;">📄</span>
      <p style="font-weight:600;">Esta clase aún no tiene contenido.</p>
      ${(usuarioRol === 'profesor' || usuarioRol === 'admin') ? '<p style="font-size:0.85rem;margin-top:0.3rem;">Haz clic en ✏ en la pestaña para agregar contenido.</p>' : ''}
    </div>`;
  }

  wrapper.innerHTML = mediaHTML;

  // Quiz
  if (usuarioRol === 'estudiante') {
    cargarQuizEstudiante(leccion.id);
    const teacherSection = document.getElementById('teacherQuizSection');
    if (teacherSection) teacherSection.style.display = 'none';
  } else {
    document.getElementById('lessonQuestionsContainer')!.style.display = 'none';
    const teacherSection = document.getElementById('teacherQuizSection');
    if (teacherSection) teacherSection.style.display = 'block';
    cargarPreguntasProfesor(leccion.id);
  }
}

function renderTemario(lecciones: Leccion[]) {
  const el = document.getElementById('lessonsList');
  if (!el) return;
  el.innerHTML = '';

  if (lecciones.length === 0) {
    el.innerHTML = `<div class="empty-state"><span class="empty-state__icon">📚</span><p>No hay clases registradas aún.</p>${(usuarioRol==='profesor'||usuarioRol==='admin') ? '<p style="font-size:0.85rem;margin-top:0.5rem;">Usa el botón <b>+ Clase</b> para crear la primera.</p>' : ''}</div>`;
    return;
  }

  // Agrupar por día
  const porDia: Record<number, Leccion[]> = {};
  lecciones.forEach(l => {
    const d = l.dia || 1;
    if (!porDia[d]) porDia[d] = [];
    porDia[d].push(l);
  });

  Object.keys(porDia).map(Number).sort((a,b) => a-b).forEach((dia, di) => {
    const lessons = porDia[dia];
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day-group' + (di === 0 ? ' day-group--open' : '');

    const header = document.createElement('div');
    header.className = 'day-group__header';
    header.innerHTML = `<span>📅 Día ${dia} — ${lessons.length} clase${lessons.length > 1 ? 's' : ''}</span><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`;
    header.addEventListener('click', () => {
      const open = dayDiv.classList.contains('day-group--open');
      document.querySelectorAll('.day-group').forEach(g => g.classList.remove('day-group--open'));
      if (!open) dayDiv.classList.add('day-group--open');
    });

    const ul = document.createElement('ul');
    ul.className = 'day-group__lessons';
    lessons.forEach(leccion => {
      const li = document.createElement('li');
      li.className = 'lesson-list-item';
      li.innerHTML = `<span>📖</span><span>${escapeHTML(leccion.titulo)}</span>`;
      li.addEventListener('click', () => {
        // activar tab
        document.querySelectorAll('.browser-tab').forEach(t => {
          const tab = t as HTMLElement;
          if (tab.dataset.lessonId === leccion.id.toString()) tab.classList.add('browser-tab--active');
          else tab.classList.remove('browser-tab--active');
        });
        mostrarLeccion(leccion);
      });
      ul.appendChild(li);
    });

    dayDiv.appendChild(header);
    dayDiv.appendChild(ul);
    el.appendChild(dayDiv);
  });
}

// ──────────────── MODAL CLASE ────────────────
function abrirModalClase(leccion?: Leccion) {
  editingLessonId = leccion?.id ?? null;

  const title     = document.getElementById('lessonModalTitle');
  const errorBox  = document.getElementById('lessonFormError');
  const btnCancel = document.getElementById('btnCancelLessonEdit');
  const btnSave   = document.getElementById('btnSaveLesson');
  if (errorBox) errorBox.style.display = 'none';

  if (leccion) {
    if (title)    title.textContent   = 'Editar Clase';
    if (btnCancel) btnCancel.style.display = 'block';
    if (btnSave)   btnSave.textContent = 'Guardar Cambios';

    (document.getElementById('lessonIdField') as HTMLInputElement).value = leccion.id.toString();
    (document.getElementById('lessonTitleField') as HTMLInputElement).value = leccion.titulo;
    (document.getElementById('lessonDayField') as HTMLInputElement).value   = (leccion.dia || 1).toString();
    (document.getElementById('lessonVideoField') as HTMLInputElement).value = leccion.video_url || '';

    const html = leccion.contenido_html || '';
    (document.getElementById('lessonContentField') as HTMLTextAreaElement).value = html;
    const visual = document.getElementById('editorVisual');
    if (visual) visual.innerHTML = html;
  } else {
    if (title)    title.textContent   = 'Nueva Clase';
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnSave)   btnSave.textContent = 'Crear Clase';

    (document.getElementById('lessonIdField') as HTMLInputElement).value    = '';
    (document.getElementById('lessonTitleField') as HTMLInputElement).value = '';
    (document.getElementById('lessonDayField') as HTMLInputElement).value   = '1';
    (document.getElementById('lessonVideoField') as HTMLInputElement).value = '';
    (document.getElementById('lessonContentField') as HTMLTextAreaElement).value = '';
    const visual = document.getElementById('editorVisual');
    if (visual) visual.innerHTML = '';
  }

  // Resetear al modo visual
  setEditorMode('visual');
  document.getElementById('lessonModal')?.classList.add('modal--open');
}

function cerrarModalClase() {
  document.getElementById('lessonModal')?.classList.remove('modal--open');
}

async function guardarClase(e: Event) {
  e.preventDefault();
  const errorBox = document.getElementById('lessonFormError');
  if (errorBox) errorBox.style.display = 'none';

  const titulo   = (document.getElementById('lessonTitleField') as HTMLInputElement).value.trim();
  const dia      = parseInt((document.getElementById('lessonDayField') as HTMLInputElement).value) || 1;
  const videoUrl = (document.getElementById('lessonVideoField') as HTMLInputElement).value.trim();
  const token    = localStorage.getItem(TOKEN_KEY);

  // Obtener contenido: si está en modo visual, leer innerHTML; si está en HTML, leer textarea
  const tabHtmlActive = document.getElementById('btnTabHtml')?.classList.contains('active');
  let contenido = '';
  if (tabHtmlActive) {
    contenido = (document.getElementById('lessonContentField') as HTMLTextAreaElement).value;
  } else {
    contenido = (document.getElementById('editorVisual') as HTMLDivElement).innerHTML || '';
    // Limpiar si solo hay placeholder vacío
    if (contenido === '<br>' || contenido.trim() === '') contenido = '';
  }

  if (!titulo) {
    showError(errorBox, 'El título es obligatorio.');
    return;
  }

  const payload = { titulo, descripcion: '', video_url: videoUrl, orden: 0, dia, contenido_html: contenido };

  try {
    let isEdit = editingLessonId !== null;

    // Si estamos editando pero se cambió el día, forzamos la creación de una nueva clase
    if (isEdit && editingLessonId !== null) {
      const originalLesson = leccionesActivas.find(l => l.id === editingLessonId);
      if (originalLesson && originalLesson.dia !== dia) {
        isEdit = false;
      }
    }

    const url    = isEdit ? `/api/lessons/${editingLessonId}` : `/api/courses/${cursoActivoId}/lessons`;
    const method = isEdit ? 'PUT' : 'POST';

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar la clase.');

    cerrarModalClase();
    if (cursoActivoId) await cargarLecciones(cursoActivoId, data.id);

  } catch (err) {
    showError(errorBox, (err as Error).message);
  }
}

async function eliminarLeccion(id: number) {
  if (!confirm('¿Eliminar esta clase?')) return;
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(`/api/lessons/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    if (cursoActivoId) {
      await cargarLecciones(cursoActivoId);
      document.getElementById('lessonViewArea')!.style.display = 'none';
    }
  } catch (err) { alert((err as Error).message); }
}

// ──────────────── EDITOR WYSIWYG ────────────────
(window as any).setEditorMode = setEditorMode;
function setEditorMode(mode: 'visual' | 'html') {
  const btnV   = document.getElementById('btnTabVisual')!;
  const btnH   = document.getElementById('btnTabHtml')!;
  const toolV  = document.getElementById('toolbarVisual')!;
  const toolH  = document.getElementById('toolbarHtml')!;
  const visual = document.getElementById('editorVisual')!;
  const html   = document.getElementById('lessonContentField') as HTMLTextAreaElement;

  if (mode === 'visual') {
    btnV.classList.add('active');    btnH.classList.remove('active');
    toolV.style.display = 'flex';   toolH.style.display = 'none';
    visual.style.display = 'block'; html.style.display = 'none';
    // sync: html → visual
    if (html.value.trim()) visual.innerHTML = html.value;
  } else {
    btnH.classList.add('active');   btnV.classList.remove('active');
    toolH.style.display = 'flex';  toolV.style.display = 'none';
    html.style.display = 'block';  visual.style.display = 'none';
    // sync: visual → html
    html.value = visual.innerHTML || '';
  }
}

(window as any).execFormatCmd = function(cmd: string) {
  document.execCommand(cmd, false);
  document.getElementById('editorVisual')?.focus();
};

(window as any).insertVisual = function(tag: string) {
  const editor = document.getElementById('editorVisual');
  if (!editor) return;
  editor.focus();
  let html = '';
  if (tag === 'h2') {
    html = `<h2>Escribe un título...</h2>`;
  } else if (tag === 'h3') {
    html = `<h3>Escribe un subtítulo...</h3>`;
  } else if (tag === 'img') {
    const url = prompt('🖼️ Pega la URL de la imagen:');
    if (!url) return;
    html = `<img src="${url}" alt="Imagen" style="max-width:100%;border-radius:8px;display:block;margin:0.5rem 0;">`;
  } else if (tag === 'video') {
    const url = prompt('🎬 Pega la URL del video (YouTube o MP4):');
    if (!url) return;
    const yt = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
    html = yt
      ? `<p><iframe width="100%" height="260" src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen style="border-radius:8px;"></iframe></p>`
      : `<p><video src="${url}" controls style="max-width:100%;border-radius:8px;"></video></p>`;
  } else if (tag === 'a') {
    const url  = prompt('🔗 URL del enlace:');
    if (!url) return;
    const text = prompt('Texto del enlace:') || url;
    html = `<a href="${url}" target="_blank" style="color:#147b71;font-weight:bold;">${text}</a>`;
  }
  if (html) document.execCommand('insertHTML', false, html);
};

(window as any).insertHtmlTag = function(tag: string) {
  const ta = document.getElementById('lessonContentField') as HTMLTextAreaElement;
  if (!ta) return;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.substring(start, end);
  let snippet = '';

  if (tag === 'img') {
    const url = prompt('🖼️ URL de la imagen:');
    if (!url) return;
    snippet = `<img src="${url}" alt="Imagen" style="max-width:100%;border-radius:8px;">`;
  } else if (tag === 'video') {
    const url = prompt('🎬 URL del video (MP4):');
    if (!url) return;
    snippet = `<video src="${url}" controls style="max-width:100%;border-radius:8px;"></video>`;
  } else if (tag === 'a') {
    const url  = prompt('🔗 URL:');
    if (!url) return;
    snippet = `<a href="${url}" target="_blank">${sel || 'Texto del enlace'}</a>`;
  } else if (tag === 'ul') {
    snippet = `<ul>\n  <li>Elemento 1</li>\n  <li>Elemento 2</li>\n</ul>`;
  } else if (tag === 'li') {
    snippet = `<li>${sel || 'Elemento'}</li>`;
  } else {
    snippet = `<${tag}>${sel || 'Texto...'}</${tag}>`;
  }

  ta.value = ta.value.substring(0, start) + snippet + ta.value.substring(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + snippet.length;
};

// ──────────────── DEBERES ────────────────
async function cargarDeberes(cursoId: number) {
  const el = document.getElementById('assignmentsList');
  if (!el) return;
  el.innerHTML = '<div class="loading-spinner" style="margin:2rem auto;"></div>';
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(`/api/courses/${cursoId}/assignments`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    deberesActivos = await res.json();
    el.innerHTML = '';
    if (deberesActivos.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="empty-state__icon">📋</span><p>No hay deberes asignados en este curso.</p></div>`;
      return;
    }
    deberesActivos.forEach(deber => {
      const card = document.createElement('div');
      card.className = 'assignment-card';
      const entregada = !!(deber.fecha_entrega);
      const badge = entregada
        ? `<span class="badge badge--success">Entregada ✓</span>`
        : `<span class="badge badge--accent">Pendiente</span>`;

      let footerHtml = '';
      const esProf = usuarioRol === 'profesor' || usuarioRol === 'admin';

      if (entregada) {
        const calif = deber.calificacion
          ? `<strong style="color:var(--success);">Nota: ${escapeHTML(deber.calificacion)}</strong>`
          : `<span style="color:var(--text-light);">Pendiente de calificación</span>`;
        footerHtml = `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;flex-wrap:wrap;gap:0.5rem;">
            <span style="color:var(--text-muted);">Entregada: ${new Date(deber.fecha_entrega!).toLocaleDateString()}</span>
            <div style="display:flex;gap:0.75rem;align-items:center;">
              ${calif}
              <button class="btn btn--outline" style="font-size:0.75rem;padding:0.35rem 0.7rem;" onclick="abrirModalEntrega(${deber.id})">Modificar</button>
            </div>
          </div>`;
      } else {
        footerHtml = `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
            <span style="color:var(--danger);font-size:0.85rem;">⏰ Límite: ${deber.fecha_limite ? escapeHTML(deber.fecha_limite) : 'Sin límite'}</span>
            <div style="display:flex;gap:0.5rem;">
              ${esProf ? `<button class="btn btn--outline" style="font-size:0.8rem;padding:0.4rem 0.8rem;" onclick="editarDeber(${deber.id})">✏️ Editar</button><button class="btn btn--danger" style="font-size:0.8rem;padding:0.4rem 0.8rem;" onclick="eliminarDeber(${deber.id})">Borrar</button>` : `<button class="btn btn--primary" style="font-size:0.8rem;padding:0.4rem 0.9rem;" onclick="abrirModalEntrega(${deber.id})">📤 Entregar</button>`}
            </div>
          </div>`;
      }

      card.innerHTML = `
        <div class="assignment-card__header">
          <h3 class="assignment-card__title">${escapeHTML(deber.titulo)}</h3>
          ${badge}
          ${esProf && !entregada ? '' : ''}
        </div>
        <p class="assignment-card__desc">${escapeHTML(deber.descripcion)}</p>
        <div class="assignment-card__footer">${footerHtml}</div>`;
      el.appendChild(card);
    });
  } catch {
    el.innerHTML = `<div style="color:var(--danger);text-align:center;">Error al cargar deberes.</div>`;
  }
}

// Exponer para onclick inline
(window as any).editarDeber = function(id: number) { abrirModalDeber(deberesActivos.find(d => d.id === id)); };
(window as any).eliminarDeber = async function(id: number) {
  if (!confirm('¿Eliminar este deber?')) return;
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    if (cursoActivoId) await cargarDeberes(cursoActivoId);
  } catch (err) { alert((err as Error).message); }
};

function abrirModalDeber(deber?: Deber) {
  editingAssignmentId = deber?.id ?? null;
  const title   = document.getElementById('assignmentModalTitle');
  const errBox  = document.getElementById('assignmentFormError');
  const btnSave = document.getElementById('btnSaveAssignment');
  if (errBox) errBox.style.display = 'none';

  if (deber) {
    if (title)   title.textContent = 'Editar Deber';
    if (btnSave) btnSave.textContent = 'Guardar Cambios';
    (document.getElementById('assignmentIdField') as HTMLInputElement).value    = deber.id.toString();
    (document.getElementById('assignmentTitleField') as HTMLInputElement).value = deber.titulo;
    (document.getElementById('assignmentDescField') as HTMLTextAreaElement).value = deber.descripcion;
    (document.getElementById('assignmentDeadlineField') as HTMLInputElement).value = deber.fecha_limite || '';
  } else {
    if (title)   title.textContent = 'Nuevo Deber';
    if (btnSave) btnSave.textContent = 'Crear Deber';
    (document.getElementById('assignmentIdField') as HTMLInputElement).value    = '';
    (document.getElementById('assignmentTitleField') as HTMLInputElement).value = '';
    (document.getElementById('assignmentDescField') as HTMLTextAreaElement).value = '';
    (document.getElementById('assignmentDeadlineField') as HTMLInputElement).value = '';
  }
  document.getElementById('assignmentModal')?.classList.add('modal--open');
}

function cerrarModalDeber() {
  document.getElementById('assignmentModal')?.classList.remove('modal--open');
}

async function guardarDeber(e: Event) {
  e.preventDefault();
  const errBox  = document.getElementById('assignmentFormError');
  if (errBox) errBox.style.display = 'none';
  const titulo    = (document.getElementById('assignmentTitleField') as HTMLInputElement).value.trim();
  const descripcion = (document.getElementById('assignmentDescField') as HTMLTextAreaElement).value.trim();
  const deadline  = (document.getElementById('assignmentDeadlineField') as HTMLInputElement).value;
  const token     = localStorage.getItem(TOKEN_KEY);

  if (!titulo || !descripcion) { showError(errBox, 'El título y la descripción son obligatorios.'); return; }

  const payload = { titulo, descripcion, fecha_limite: deadline || null };

  try {
    const isEdit = editingAssignmentId !== null;
    const url    = isEdit ? `/api/assignments/${editingAssignmentId}` : `/api/courses/${cursoActivoId}/assignments`;
    const method = isEdit ? 'PUT' : 'POST';
    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar.');
    cerrarModalDeber();
    if (cursoActivoId) await cargarDeberes(cursoActivoId);
  } catch (err) { showError(errBox, (err as Error).message); }
}

// ──────────────── ENTREGA DE DEBER (estudiante) ────────────────
(window as any).abrirModalEntrega = function(assignmentId: number) {
  const errBox   = document.getElementById('deliveryError');
  const idField  = document.getElementById('deliveryAssignmentId') as HTMLInputElement;
  const content  = document.getElementById('deliveryContentField') as HTMLTextAreaElement;
  if (errBox)  errBox.style.display = 'none';
  if (idField) idField.value = assignmentId.toString();
  const deber = deberesActivos.find(d => d.id === assignmentId);
  if (content) content.value = deber?.contenido_respuesta || '';
  document.getElementById('deliveryModal')?.classList.add('modal--open');
};

function cerrarModalEntrega() {
  document.getElementById('deliveryModal')?.classList.remove('modal--open');
}

async function enviarEntrega(e: Event) {
  e.preventDefault();
  const errBox = document.getElementById('deliveryError');
  if (errBox) errBox.style.display = 'none';
  const assignmentId = (document.getElementById('deliveryAssignmentId') as HTMLInputElement).value;
  const contenido    = (document.getElementById('deliveryContentField') as HTMLTextAreaElement).value.trim();
  const fileInput    = document.getElementById('deliveryFileField') as HTMLInputElement;
  const token        = localStorage.getItem(TOKEN_KEY);

  let archivo_nombre = '', archivo_tipo = '', archivo_data = '';
  if (fileInput?.files?.[0]) {
    const file = fileInput.files[0];
    archivo_nombre = file.name;
    archivo_tipo   = file.type;
    try { archivo_data = await fileToBase64(file); } catch {}
  }

  try {
    const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ contenido_respuesta: contenido, archivo_nombre, archivo_tipo, archivo_data })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar la entrega.');
    cerrarModalEntrega();
    if (cursoActivoId) await cargarDeberes(cursoActivoId);
  } catch (err) { showError(errBox, (err as Error).message); }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = err => reject(err);
  });
}

// ──────────────── QUIZ ESTUDIANTE ────────────────
async function cargarQuizEstudiante(leccionId: number) {
  const container = document.getElementById('lessonQuestionsContainer');
  const list      = document.getElementById('questionsListStudent');
  if (!container || !list) return;

  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(`/api/lessons/${leccionId}/questions`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    const preguntas = await res.json();

    if (preguntas.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    list.innerHTML = '';

    preguntas.forEach((q: any, i: number) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'quiz-question-card';
      const opts = q.opciones.map((opt: string, idx: number) => `
        <div class="quiz-option">
          <label>
            <input type="radio" name="q${q.id}" value="${idx}">
            <span>${escapeHTML(opt)}</span>
          </label>
        </div>`).join('');

      qDiv.innerHTML = `
        <p style="font-weight:700;margin-bottom:0.75rem;font-size:0.92rem;">${i+1}. ${escapeHTML(q.pregunta)}</p>
        ${opts}
        <button class="btn btn--outline" onclick="verificarRespuesta(this, ${q.respuesta_correcta})" style="font-size:0.8rem;padding:0.35rem 0.75rem;margin-top:0.75rem;">Comprobar</button>
        <div class="respuesta-feedback"></div>`;
      list.appendChild(qDiv);
    });
  } catch { container.style.display = 'none'; }
}

(window as any).verificarRespuesta = function(btn: HTMLElement, correcta: number) {
  const container = btn.parentElement!;
  const radios = container.querySelectorAll('input[type="radio"]');
  let seleccionada = -1;
  radios.forEach((r: any) => { if (r.checked) seleccionada = parseInt(r.value); });
  const feedback = container.querySelector('.respuesta-feedback') as HTMLElement;
  if (!feedback) return;
  feedback.style.display = 'block';
  if (seleccionada === -1) {
    feedback.textContent = 'Selecciona una opción.';
    feedback.className = 'respuesta-feedback';
  } else if (seleccionada === correcta) {
    feedback.textContent = '¡Correcto! ✅';
    feedback.className = 'respuesta-feedback feedback-correct';
  } else {
    feedback.textContent = 'Incorrecto ❌. Intenta de nuevo.';
    feedback.className = 'respuesta-feedback feedback-wrong';
  }
};

// ──────────────── QUIZ PROFESOR ────────────────
async function cargarPreguntasProfesor(leccionId: number) {
  const list  = document.getElementById('teacherQuestionsList');
  if (!list) return;
  list.innerHTML = '<div class="loading-spinner" style="margin:1rem auto;"></div>';
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(`/api/lessons/${leccionId}/questions`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    const preguntas = await res.json();
    list.innerHTML = '';
    if (preguntas.length === 0) {
      list.innerHTML = `<p style="color:var(--text-light);font-size:0.88rem;">No hay preguntas. Usa el botón para agregar.</p>`;
      return;
    }
    preguntas.forEach((q: any) => {
      const item = document.createElement('div');
      item.className = 'question-item';
      item.innerHTML = `
        <div>
          <div class="question-item__text">${escapeHTML(q.pregunta)}</div>
          <div class="question-item__meta">${q.opciones.map((o: string, i: number) => `${i===q.respuesta_correcta ? '✅ ' : ''}${escapeHTML(o)}`).join(' &nbsp;|&nbsp; ')}</div>
        </div>
        <button class="btn btn--danger btn-action-lms" onclick="eliminarPregunta(${q.id})" style="font-size:0.75rem;padding:0.35rem 0.7rem;flex-shrink:0;">Borrar</button>`;
      list.appendChild(item);
    });
  } catch { list.innerHTML = `<p style="color:var(--danger);font-size:0.85rem;">Error al cargar preguntas.</p>`; }
}

(window as any).eliminarPregunta = async function(id: number) {
  if (!confirm('¿Eliminar esta pregunta?')) return;
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(`/api/questions/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    if (currentLeccionId) cargarPreguntasProfesor(currentLeccionId);
  } catch (err) { alert((err as Error).message); }
};

function abrirModalPregunta() {
  const errBox = document.getElementById('questionFormError');
  if (errBox) errBox.style.display = 'none';
  (document.getElementById('questionTextField') as HTMLInputElement).value = '';
  ['opcion0','opcion1','opcion2','opcion3'].forEach(id => {
    (document.getElementById(id) as HTMLInputElement).value = '';
  });
  (document.querySelector('input[name="correctaRadio"][value="0"]') as HTMLInputElement).checked = true;
  document.getElementById('questionModal')?.classList.add('modal--open');
}

function cerrarModalPregunta() {
  document.getElementById('questionModal')?.classList.remove('modal--open');
}

async function guardarPregunta(e: Event) {
  e.preventDefault();
  const errBox = document.getElementById('questionFormError');
  if (errBox) errBox.style.display = 'none';

  const pregunta = (document.getElementById('questionTextField') as HTMLInputElement).value.trim();
  const opciones = ['opcion0','opcion1','opcion2','opcion3']
    .map(id => (document.getElementById(id) as HTMLInputElement).value.trim())
    .filter(o => o !== '');
  const correctaEl = document.querySelector('input[name="correctaRadio"]:checked') as HTMLInputElement;
  const respuesta_correcta = parseInt(correctaEl?.value ?? '0');

  if (!pregunta) { showError(errBox, 'La pregunta es obligatoria.'); return; }
  if (opciones.length < 2) { showError(errBox, 'Debes ingresar al menos 2 opciones.'); return; }
  if (respuesta_correcta >= opciones.length) { showError(errBox, 'La opción correcta seleccionada no existe.'); return; }

  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(`/api/lessons/${currentLeccionId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ pregunta, opciones, respuesta_correcta })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar pregunta.');
    cerrarModalPregunta();
    if (currentLeccionId) cargarPreguntasProfesor(currentLeccionId);
  } catch (err) { showError(errBox, (err as Error).message); }
}

// ──────────────── HELPERS ────────────────
function showError(el: HTMLElement | null, msg: string) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}