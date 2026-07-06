const TOKEN_KEY = 'academy_token';
const USER_KEY = 'academy_user';
// Estado de edición de lección
let editingLessonId = null;
let currentLessonCourseId = null;
document.addEventListener('DOMContentLoaded', () => {
    inicializarHeader();
    verificarAccesoProfesor();
    const token = localStorage.getItem(TOKEN_KEY) || '';
    // Cargar datos del panel
    cargarCursosAdmin(token);
    cargarPedidosAdmin(token);
    // Navegación por pestañas del panel
    const tabCourses = document.getElementById('tabCourses');
    const tabOrders = document.getElementById('tabOrders');
    const adminCoursesSection = document.getElementById('adminCoursesSection');
    const adminOrdersSection = document.getElementById('adminOrdersSection');
    tabCourses?.addEventListener('click', () => {
        tabCourses.classList.add('admin-tab--active');
        tabOrders?.classList.remove('admin-tab--active');
        if (adminCoursesSection)
            adminCoursesSection.style.display = 'block';
        if (adminOrdersSection)
            adminOrdersSection.style.display = 'none';
    });
    tabOrders?.addEventListener('click', () => {
        tabOrders.classList.add('admin-tab--active');
        tabCourses?.classList.remove('admin-tab--active');
        if (adminOrdersSection)
            adminOrdersSection.style.display = 'block';
        if (adminCoursesSection)
            adminCoursesSection.style.display = 'none';
    });
    // Listener para logout
    document.getElementById('btnAdminLogout')?.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/';
    });
    // Modal Curso (Nuevo/Editar)
    document.getElementById('btnCreateCourse')?.addEventListener('click', () => abrirModalCurso());
    document.getElementById('btnModalClose')?.addEventListener('click', cerrarModalCurso);
    document.getElementById('btnModalCancel')?.addEventListener('click', cerrarModalCurso);
    const courseForm = document.getElementById('courseForm');
    courseForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        guardarCursoForm(token);
    });
    // Formulario Lección
    const lessonForm = document.getElementById('lessonForm');
    lessonForm?.addEventListener('submit', guardarLeccion);
    // Botón cancelar edición de lección
    document.getElementById('btnCancelLessonEdit')?.addEventListener('click', cancelarEdicionLeccion);
});
/**
 * Redirige si el usuario no tiene permisos de profesor o admin.
 */
function verificarAccesoProfesor() {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (!token || !userJson) {
        window.location.href = '/login';
        return;
    }
    try {
        const user = JSON.parse(userJson);
        // Permitir acceso a 'profesor' y 'admin'
        if (user.rol !== 'profesor' && user.rol !== 'admin') {
            window.location.href = '/';
        }
        // Mostrar elementos solo de admin si aplica
        if (user.rol === 'admin') {
            document.querySelectorAll('.role-only-admin').forEach(el => {
                el.style.display = '';
            });
        }
        else {
            // Si es profesor, cambiar el título del dashboard
            const title = document.getElementById('dashboardTitle');
            const subtitle = document.getElementById('dashboardSubtitle');
            const navLink = document.getElementById('navPanelLink');
            if (title)
                title.textContent = 'Panel del Profesor';
            if (subtitle)
                subtitle.textContent = 'Gestiona las lecciones y el contenido de tus cursos asignados.';
            if (navLink)
                navLink.textContent = 'Panel Profesor';
        }
    }
    catch (e) {
        localStorage.clear();
        window.location.href = '/login';
    }
}
/* ==========================================
   CURSOS (CREAR, LEER, EDITAR, ELIMINAR)
   ========================================== */
/**
 * Carga todos los cursos en la tabla de administración.
 */
async function cargarCursosAdmin(token) {
    const tbody = document.getElementById('adminCoursesTableBody');
    if (!tbody)
        return;
    tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 2rem;">
        <div class="loading-spinner"></div>
      </td>
    </tr>
  `;
    try {
        const response = await fetch('/api/courses');
        if (!response.ok)
            throw new Error('Error al conectar con la base de datos.');
        const cursos = await response.json();
        tbody.innerHTML = '';
        // Actualizar KPIs de Cursos y Estudiantes
        const statCourses = document.getElementById('statCoursesCount');
        const statStudents = document.getElementById('statStudentsCount');
        if (statCourses)
            statCourses.textContent = cursos.length.toString();
        if (statStudents) {
            const sum = cursos.reduce((acc, c) => acc + (c.estudiantes_inscritos || 0), 0);
            statStudents.textContent = sum.toString();
        }
        if (cursos.length === 0) {
            tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 3rem; color: var(--text-light);">
            No hay cursos creados en la plataforma. Comienza creando uno nuevo.
          </td>
        </tr>
      `;
            return;
        }
        // Verificar si el usuario es admin para mostrar botón Borrar
        const userJson = localStorage.getItem(USER_KEY);
        let esAdmin = false;
        if (userJson) {
            try {
                const user = JSON.parse(userJson);
                esAdmin = user.rol === 'admin';
            }
            catch (e) { }
        }
        cursos.forEach((curso) => {
            const tr = document.createElement('tr');
            const inscritos = curso.estudiantes_inscritos || 0;
            tr.innerHTML = `
        <td>
          <img src="${escapeHTML(curso.imagen_url)}" alt="${escapeHTML(curso.titulo)}" style="width: 60px; height: 40px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        </td>
        <td>
          <strong>${escapeHTML(curso.titulo)}</strong>
          <div style="font-size: 0.78rem; color: var(--text-light); margin-top: 0.2rem;">
            👥 ${inscritos} estudiante${inscritos !== 1 ? 's' : ''} inscritos
          </div>
        </td>
        <td>
          ${curso.instructor_avatar ? `<img src="${escapeHTML(curso.instructor_avatar)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:0.4rem;">` : ''}
          ${escapeHTML(curso.instructor || 'N/A')}
        </td>
        <td>
          <strong>$${curso.precio.toFixed(2)}</strong>
          ${curso.precio_original && curso.precio_original > curso.precio ? `<br><span style="text-decoration: line-through; color: var(--text-light); font-size: 0.8rem;">$${curso.precio_original.toFixed(2)}</span>` : ''}
        </td>
        <td>
          <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn--primary btn-action-lms" onclick="abrirConstructor(${curso.id})" title="Gestionar Clases por Días" style="background: var(--accent); border-color: var(--accent);">Crear Clases</button>
            <button class="btn btn--outline btn-action-lms" onclick="abrirModalCurso(${curso.id})" title="Configuración General del Curso">Configuración</button>
            ${esAdmin ? `<button class="btn btn--danger btn-action-lms" onclick="eliminarCurso(${curso.id})">Borrar</button>` : ''}
          </div>
        </td>
      `;
            tbody.appendChild(tr);
        });
    }
    catch (error) {
        console.error('Error al cargar cursos:', error);
        tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--danger); font-weight: 500;">
          Error al obtener los cursos de la base de datos.
        </td>
      </tr>
    `;
    }
}
/**
 * Abre el modal para crear o editar un curso.
 */
async function abrirModalCurso(id) {
    const modal = document.getElementById('courseModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('courseForm');
    const errorBox = document.getElementById('modalError');
    if (errorBox)
        errorBox.style.display = 'none';
    form.reset();
    const idField = document.getElementById('courseIdField');
    const titleField = document.getElementById('courseTitleField');
    const instructorField = document.getElementById('courseInstructorField');
    const instructorAvatarField = document.getElementById('courseInstructorAvatarField');
    const instructorBioField = document.getElementById('courseInstructorBioField');
    const priceField = document.getElementById('coursePriceField');
    const priceOriginalField = document.getElementById('coursePriceOriginalField');
    const imageField = document.getElementById('courseImageField');
    const descField = document.getElementById('courseDescField');
    const syllabusField = document.getElementById('courseSyllabusField');
    const htmlField = document.getElementById('courseHtmlField');
    if (id) {
        if (modalTitle)
            modalTitle.textContent = 'Editar Curso';
        if (idField)
            idField.value = id.toString();
        try {
            const response = await fetch(`/api/courses/${id}`);
            if (!response.ok)
                throw new Error('No se pudo recuperar los detalles del curso.');
            const curso = await response.json();
            if (titleField)
                titleField.value = curso.titulo;
            if (instructorField)
                instructorField.value = curso.instructor;
            if (instructorAvatarField)
                instructorAvatarField.value = curso.instructor_avatar || '';
            if (instructorBioField)
                instructorBioField.value = curso.instructor_bio || '';
            if (priceField)
                priceField.value = curso.precio.toString();
            if (priceOriginalField)
                priceOriginalField.value = curso.precio_original ? curso.precio_original.toString() : '';
            if (imageField)
                imageField.value = curso.imagen_url;
            if (descField)
                descField.value = curso.descripcion;
            if (syllabusField)
                syllabusField.value = curso.temario;
            if (htmlField)
                htmlField.value = curso.codigo_html || '';
        }
        catch (error) {
            console.error(error);
            alert('Error al recuperar información del curso.');
            return;
        }
    }
    else {
        if (modalTitle)
            modalTitle.textContent = 'Nuevo Curso';
        if (idField)
            idField.value = '';
    }
    modal?.classList.add('modal--open');
}
function cerrarModalCurso() {
    const modal = document.getElementById('courseModal');
    modal?.classList.remove('modal--open');
}
/**
 * Guarda (Crea o Edita) un curso.
 */
async function guardarCursoForm(token) {
    const idField = document.getElementById('courseIdField');
    const titleField = document.getElementById('courseTitleField');
    const instructorField = document.getElementById('courseInstructorField');
    const instructorAvatarField = document.getElementById('courseInstructorAvatarField');
    const instructorBioField = document.getElementById('courseInstructorBioField');
    const priceField = document.getElementById('coursePriceField');
    const priceOriginalField = document.getElementById('coursePriceOriginalField');
    const imageField = document.getElementById('courseImageField');
    const descField = document.getElementById('courseDescField');
    const syllabusField = document.getElementById('courseSyllabusField');
    const htmlField = document.getElementById('courseHtmlField');
    const errorBox = document.getElementById('modalError');
    if (errorBox)
        errorBox.style.display = 'none';
    const id = idField.value;
    const hasCustomHtml = htmlField.value.trim() !== '';
    // Validar campos obligatorios
    if (!titleField.value.trim()) {
        if (errorBox) {
            errorBox.textContent = 'El título del curso es obligatorio.';
            errorBox.style.display = 'block';
        }
        return;
    }
    if (!priceField.value || parseFloat(priceField.value) <= 0) {
        if (errorBox) {
            errorBox.textContent = 'El precio debe ser mayor a 0.';
            errorBox.style.display = 'block';
        }
        return;
    }
    if (!hasCustomHtml) {
        if (!imageField.value.trim()) {
            if (errorBox) {
                errorBox.textContent = 'La imagen de portada es requerida si no usas HTML personalizado.';
                errorBox.style.display = 'block';
            }
            return;
        }
        if (!descField.value.trim()) {
            if (errorBox) {
                errorBox.textContent = 'La descripción es requerida si no usas HTML personalizado.';
                errorBox.style.display = 'block';
            }
            return;
        }
        if (!syllabusField.value.trim()) {
            if (errorBox) {
                errorBox.textContent = 'El temario es requerido si no usas HTML personalizado.';
                errorBox.style.display = 'block';
            }
            return;
        }
        if (!instructorField.value.trim()) {
            if (errorBox) {
                errorBox.textContent = 'El nombre del instructor es requerido si no usas HTML personalizado.';
                errorBox.style.display = 'block';
            }
            return;
        }
    }
    const payload = {
        titulo: titleField.value,
        instructor: instructorField.value || '',
        instructor_avatar: instructorAvatarField.value || '',
        instructor_bio: instructorBioField ? instructorBioField.value || '' : '',
        precio: parseFloat(priceField.value),
        precio_original: priceOriginalField.value ? parseFloat(priceOriginalField.value) : 0,
        imagen_url: imageField.value || '',
        descripcion: descField.value || '',
        temario: syllabusField.value || '',
        codigo_html: htmlField.value
    };
    const isEdit = id.trim() !== '';
    const url = isEdit ? `/api/courses/${id}` : '/api/courses';
    const method = isEdit ? 'PUT' : 'POST';
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Error al guardar el curso.');
        }
        cerrarModalCurso();
        cargarCursosAdmin(token);
    }
    catch (error) {
        console.error(error);
        if (errorBox) {
            errorBox.textContent = error.message;
            errorBox.style.display = 'block';
        }
    }
}
/**
 * Elimina un curso.
 */
async function eliminarCurso(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este curso? Esta acción borrará todas sus lecciones de forma permanente.')) {
        return;
    }
    const token = localStorage.getItem(TOKEN_KEY) || '';
    try {
        const response = await fetch(`/api/courses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Ocurrió un error al intentar eliminar.');
        }
        cargarCursosAdmin(token);
    }
    catch (error) {
        console.error(error);
        alert(error.message);
    }
}
// Ir al contenido del curso (para profesor/admin)
window.solicitarClaveAcceso = async function (cursoId) {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (!userJson)
        return;
    const user = JSON.parse(userJson);
    // Si es profesor, auto-inscribirlo en el curso sin pagar
    if (user.rol === 'profesor') {
        try {
            await fetch(`/api/courses/${cursoId}/enroll-profesor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
        }
        catch (e) {
            // Ignorar error si ya está inscrito
        }
    }
    window.location.href = `/estudiante?curso=${cursoId}`;
};
// Exponer funciones de cursos al scope global para los onclick inline del HTML dinámico
window.abrirModalCurso = abrirModalCurso;
window.eliminarCurso = eliminarCurso;
window.abrirConstructor = function (cursoId) {
    window.location.href = `/estudiante?curso=${cursoId}`;
};
/* ==========================================
   GESTIÓN DE LECCIONES (VIDEOS DE CLASE) - MOVIDO AL BUILDER
   ========================================== */
window.gestionarLecciones = async function (cursoId, cursoTitulo) {
    const modal = document.getElementById('lessonsModal');
    const title = document.getElementById('lessonsModalTitle');
    const idField = document.getElementById('lessonCourseId');
    currentLessonCourseId = cursoId;
    if (title)
        title.textContent = `Gestionar Lecciones: ${cursoTitulo}`;
    if (idField)
        idField.value = cursoId.toString();
    // Reset formulario al abrir
    cancelarEdicionLeccion();
    const errorBox = document.getElementById('lessonError');
    if (errorBox)
        errorBox.style.display = 'none';
    await cargarLeccionesList(cursoId);
    modal?.classList.add('modal--open');
};
async function cargarLeccionesList(cursoId) {
    const list = document.getElementById('lessonsModalList');
    if (!list)
        return;
    list.innerHTML = '<div class="loading-spinner" style="margin: 1rem auto;"></div>';
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        const response = await fetch(`/api/courses/${cursoId}/lessons`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok)
            throw new Error();
        const lecciones = await response.json();
        list.innerHTML = '';
        if (lecciones.length === 0) {
            list.innerHTML = '<li class="lms-modal-list-item" style="color: var(--text-light);">No hay lecciones registradas en este curso.</li>';
            return;
        }
        // Agrupar por día
        const porDia = {};
        lecciones.forEach(l => {
            const d = l.dia || 1;
            if (!porDia[d])
                porDia[d] = [];
            porDia[d].push(l);
        });
        Object.keys(porDia).sort((a, b) => Number(a) - Number(b)).forEach(diaKey => {
            const dia = Number(diaKey);
            const lessons = porDia[dia];
            // Encabezado del día
            const dayHeader = document.createElement('li');
            dayHeader.className = 'lms-modal-list-item';
            dayHeader.style.cssText = 'background: var(--accent-light); color: var(--accent-hover); font-weight: 700; font-size: 0.8rem; letter-spacing: 0.05em; padding: 0.4rem 0.8rem; border-radius: var(--radius-sm);';
            dayHeader.innerHTML = `📅 DÍA ${dia} — ${lessons.length} clase${lessons.length > 1 ? 's' : ''}`;
            list.appendChild(dayHeader);
            lessons.forEach((leccion) => {
                const li = document.createElement('li');
                li.className = 'lms-modal-list-item';
                li.style.paddingLeft = '1.5rem';
                li.innerHTML = `
          <div style="flex: 1; min-width: 0;">
            <strong style="font-size: 0.88rem;">${escapeHTML(leccion.titulo)}</strong><br>
            <span style="font-size: 0.73rem; color: var(--text-light); word-break: break-all;">${leccion.video_url ? escapeHTML(leccion.video_url) : 'Sin enlace de video'}</span>
          </div>
          <div style="display: flex; gap: 0.4rem; flex-shrink: 0; margin-left: 0.75rem;">
            <button class="btn btn--outline btn-action-lms" onclick="editarLeccion(${leccion.id})">Editar</button>
            <button class="btn btn--danger btn-action-lms" onclick="eliminarLeccion(${leccion.id}, ${cursoId})">Borrar</button>
          </div>
        `;
                list.appendChild(li);
            });
        });
    }
    catch (e) {
        list.innerHTML = '<li style="color: var(--danger);">Error al recuperar lecciones.</li>';
    }
}
/**
 * Rellena el formulario con los datos de la lección para editarla.
 */
window.editarLeccion = async function (leccionId) {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        // Obtener las lecciones del curso activo para encontrar la que buscamos
        const cursoId = currentLessonCourseId;
        if (!cursoId)
            return;
        const response = await fetch(`/api/courses/${cursoId}/lessons`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok)
            throw new Error();
        const lecciones = await response.json();
        const leccion = lecciones.find(l => l.id === leccionId);
        if (!leccion) {
            alert('No se encontró la lección.');
            return;
        }
        // Rellenar formulario
        editingLessonId = leccionId;
        document.getElementById('lessonId').value = leccionId.toString();
        document.getElementById('lessonTitle').value = leccion.titulo;
        document.getElementById('lessonDesc').value = leccion.descripcion || '';
        document.getElementById('lessonDay').value = (leccion.dia || 1).toString();
        document.getElementById('lessonVideoUrl').value = leccion.video_url || '';
        document.getElementById('lessonOrder').value = (leccion.orden || 0).toString();
        // Actualizar UI del formulario para modo edición
        const formTitle = document.getElementById('lessonFormTitle');
        const btnSave = document.getElementById('btnSaveLesson');
        const btnCancel = document.getElementById('btnCancelLessonEdit');
        if (formTitle)
            formTitle.textContent = '✏️ Editando Lección';
        if (btnSave)
            btnSave.textContent = 'Guardar Cambios';
        if (btnCancel)
            btnCancel.style.display = 'block';
        // Scroll al formulario
        document.getElementById('lessonFormTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    catch (e) {
        alert('Error al cargar la lección para editar.');
    }
};
/**
 * Cancela la edición y regresa al modo "Agregar nueva lección".
 */
function cancelarEdicionLeccion() {
    editingLessonId = null;
    document.getElementById('lessonForm')?.reset();
    document.getElementById('lessonId').value = '';
    const formTitle = document.getElementById('lessonFormTitle');
    const btnSave = document.getElementById('btnSaveLesson');
    const btnCancel = document.getElementById('btnCancelLessonEdit');
    if (formTitle)
        formTitle.textContent = 'Agregar Nueva Lección';
    if (btnSave)
        btnSave.textContent = 'Agregar Lección';
    if (btnCancel)
        btnCancel.style.display = 'none';
    const errorBox = document.getElementById('lessonError');
    if (errorBox)
        errorBox.style.display = 'none';
    // Restablecer campo día a 1
    const dayField = document.getElementById('lessonDay');
    if (dayField)
        dayField.value = '1';
}
/**
 * Guarda o actualiza una lección (crea o edita según el estado).
 */
async function guardarLeccion(e) {
    e.preventDefault();
    const errorBox = document.getElementById('lessonError');
    if (errorBox)
        errorBox.style.display = 'none';
    const cursoId = document.getElementById('lessonCourseId').value;
    const titulo = document.getElementById('lessonTitle').value;
    const descripcion = document.getElementById('lessonDesc').value;
    const videoUrl = document.getElementById('lessonVideoUrl').value;
    const orden = document.getElementById('lessonOrder').value;
    const token = localStorage.getItem(TOKEN_KEY);
    // Auto-assign day only when creating a new lesson
    let diaValue = parseInt(document.getElementById('lessonDay').value) || 1;
    if (editingLessonId === null) {
        try {
            const resp = await fetch(`/api/courses/${cursoId}/lessons`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const existingLessons = await resp.json();
                const maxDia = existingLessons.reduce((max, l) => Math.max(max, l.dia || 1), 0);
                diaValue = maxDia + 1;
            }
        }
        catch {
            // fallback to day 1
        }
    }
    // Manejar archivo adjunto
    const fileInput = document.getElementById('lessonFile');
    let archivo_nombre = '';
    let archivo_tipo = '';
    let archivo_data = '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        archivo_nombre = file.name;
        archivo_tipo = file.type;
        try {
            archivo_data = await fileToBase64(file);
        }
        catch (err) {
            console.error('Error al convertir archivo:', err);
        }
    }
    const payload = {
        titulo,
        descripcion,
        video_url: videoUrl,
        orden: parseInt(orden) || 0,
        dia: diaValue,
        archivo_nombre,
        archivo_tipo,
        archivo_data
    };
    try {
        let response;
        if (editingLessonId !== null) {
            // Modo edición — PUT al endpoint de editar lección
            response = await fetch(`/api/lessons/${editingLessonId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        }
        else {
            // Modo creación — POST al endpoint de crear lección
            response = await fetch(`/api/courses/${cursoId}/lessons`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        }
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || 'Error al guardar la lección.');
        // Limpiar formulario, cancelar edición y refrescar lista
        cancelarEdicionLeccion();
        await cargarLeccionesList(parseInt(cursoId));
    }
    catch (error) {
        if (errorBox) {
            errorBox.textContent = error.message;
            errorBox.style.display = 'block';
        }
    }
}
window.eliminarLeccion = async function (leccionId, cursoId) {
    if (!confirm('¿Seguro que deseas eliminar esta lección?'))
        return;
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        const response = await fetch(`/api/lessons/${leccionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok)
            throw new Error('No se pudo eliminar la lección.');
        await cargarLeccionesList(cursoId);
    }
    catch (error) {
        alert(error.message);
    }
};
window.cerrarModalLecciones = function () {
    const modal = document.getElementById('lessonsModal');
    modal?.classList.remove('modal--open');
    cancelarEdicionLeccion();
};
/**
 * Convierte un archivo a Base64 para almacenamiento en SQLite.
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
    });
}
/* ==========================================
   HISTORIAL DE PEDIDOS (HISTORIAL DE VENTAS)
   ========================================== */
/**
 * Carga todo el historial de pedidos en el panel del profesor.
 */
async function cargarPedidosAdmin(token) {
    const tbody = document.getElementById('adminOrdersTableBody');
    if (!tbody)
        return;
    tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2rem;">
        <div class="loading-spinner"></div>
      </td>
    </tr>
  `;
    try {
        const response = await fetch('/api/admin/orders', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok)
            throw new Error('Error al cargar pedidos.');
        const pedidos = await response.json();
        tbody.innerHTML = '';
        // Actualizar KPI de ganancias/ventas
        const statEarnings = document.getElementById('statEarnings');
        if (statEarnings) {
            const total = pedidos.reduce((acc, p) => acc + (p.curso_precio || 0), 0);
            statEarnings.textContent = `$${total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (pedidos.length === 0) {
            tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-light);">
            No se han registrado transacciones simuladas de cobro en el sistema.
          </td>
        </tr>
      `;
            return;
        }
        pedidos.forEach((pedido) => {
            const fechaObj = new Date(pedido.fecha);
            const fechaFormateada = fechaObj.toLocaleString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td><strong>#${pedido.id}</strong></td>
        <td>${escapeHTML(pedido.nombre_cliente)}</td>
        <td><a href="mailto:${escapeHTML(pedido.email_cliente)}" style="color: var(--accent);">${escapeHTML(pedido.email_cliente)}</a></td>
        <td><strong>${escapeHTML(pedido.curso_titulo || 'Curso no disponible')}</strong></td>
        <td><strong>$${(pedido.curso_precio || 0.00).toFixed(2)}</strong></td>
        <td>${fechaFormateada}</td>
        <td>
          <span class="badge badge--success">${escapeHTML(pedido.estado)}</span>
        </td>
      `;
            tbody.appendChild(tr);
        });
    }
    catch (error) {
        console.error('Error al cargar pedidos:', error);
        tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger); font-weight: 500;">
          Error al cargar el historial de cobros.
        </td>
      </tr>
    `;
    }
}
/* ==========================================
   UTILIDADES COMUNES
   ========================================== */
function inicializarHeader() {
    const nav = document.querySelector('.nav');
    if (!nav)
        return;
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    let html = `<a href="/" class="nav__link">Inicio</a>`;
    html += `<a href="/#cursos" class="nav__link">Cursos</a>`;
    if (token && userJson) {
        try {
            const user = JSON.parse(userJson);
            if (user.rol === 'admin') {
                html += `<a href="/admin" class="nav__link nav__link--active">Panel Admin</a>`;
            }
            else if (user.rol === 'profesor') {
                html += `<a href="/admin" class="nav__link nav__link--active">Panel Profesor</a>`;
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
        window.location.href = '/';
    });
}
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
export {};
