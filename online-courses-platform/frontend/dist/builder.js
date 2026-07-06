"use strict";
const TOKEN_KEY = 'academy_token';
const USER_KEY = 'academy_user';
let cursoId = null;
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const idStr = params.get('curso');
    if (!idStr) {
        alert('No se especificó curso.');
        window.location.href = '/admin';
        return;
    }
    cursoId = parseInt(idStr, 10);
    verificarAccesoProfesor();
    cargarDatosCurso();
    // Tabs
    document.querySelectorAll('.builder-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.builder-tab').forEach(t => t.classList.remove('builder-tab--active'));
            document.querySelectorAll('.builder-content').forEach(c => c.classList.remove('builder-content--active'));
            tab.classList.add('builder-tab--active');
            const targetId = `tab-${tab.dataset.tab}`;
            const targetPanel = document.getElementById(targetId);
            if (targetPanel)
                targetPanel.classList.add('builder-content--active');
        });
    });
    // Buttons Lesons
    document.getElementById('btnNewLesson')?.addEventListener('click', nuevaLeccion);
    document.getElementById('btnDeleteLesson')?.addEventListener('click', () => {
        const idField = document.getElementById('lessonIdField');
        if (idField.value)
            borrarLeccion(parseInt(idField.value));
    });
    document.getElementById('lessonForm')?.addEventListener('submit', guardarLeccion);
    document.getElementById('btnNewQuestion')?.addEventListener('click', abrirModalPregunta);
    document.getElementById('btnQuestionModalClose')?.addEventListener('click', cerrarModalPregunta);
    document.getElementById('questionForm')?.addEventListener('submit', guardarPregunta);
    document.getElementById('btnNewAssignment')?.addEventListener('click', abrirModalDeber);
    document.getElementById('btnAssignmentModalClose')?.addEventListener('click', cerrarModalDeber);
    document.getElementById('assignmentForm')?.addEventListener('submit', guardarDeber);
});
function verificarAccesoProfesor() {
    const userJson = localStorage.getItem(USER_KEY);
    if (!userJson) {
        window.location.href = '/login';
        return;
    }
    const user = JSON.parse(userJson);
    if (user.rol !== 'profesor' && user.rol !== 'admin') {
        window.location.href = '/';
    }
}
async function cargarDatosCurso() {
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        const res = await fetch(`/api/courses/${cursoId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok)
            throw new Error('Error al cargar curso');
        const curso = await res.json();
        const titleEl = document.getElementById('courseTitle');
        if (titleEl)
            titleEl.textContent = `Constructor: ${curso.titulo}`;
        await Promise.all([
            cargarLecciones(),
            cargarDeberes()
        ]);
    }
    catch (e) {
        alert('Error al cargar datos del curso.');
    }
}
/* ==========================================
   LECCIONES
   ========================================== */
let leccionesCargadas = [];
async function cargarLecciones() {
    const token = localStorage.getItem(TOKEN_KEY);
    const list = document.getElementById('lessonsList');
    if (!list)
        return;
    try {
        const res = await fetch(`/api/courses/${cursoId}/lessons`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const lecciones = await res.json();
        leccionesCargadas = lecciones;
        // Update select in Questions modal
        const sel = document.getElementById('questionLessonId');
        if (sel) {
            sel.innerHTML = lecciones.map((l) => `<option value="${l.id}">${l.dia}. ${l.titulo}</option>`).join('');
            if (lecciones.length > 0)
                cargarPreguntas();
        }
        if (lecciones.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted); padding: 1rem 0;">No hay clases aún. Crea la primera.</p>';
            return;
        }
        list.innerHTML = '';
        // Group lessons by day
        const leccionesPorDia = lecciones.reduce((acc, l) => {
            acc[l.dia] = acc[l.dia] || [];
            acc[l.dia].push(l);
            return acc;
        }, {});
        Object.keys(leccionesPorDia).sort((a, b) => parseInt(a) - parseInt(b)).forEach(dia => {
            const header = document.createElement('div');
            header.className = 'lesson-day-header';
            header.textContent = `Día ${dia}`;
            list.appendChild(header);
            leccionesPorDia[dia].forEach((l) => {
                const item = document.createElement('div');
                item.className = 'lesson-tab-item';
                item.id = `lesson-tab-${l.id}`;
                item.innerHTML = `
          <div style="display:flex; align-items:center; gap: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            ${escapeHTML(l.titulo)}
          </div>
        `;
                item.addEventListener('click', () => editarLeccion(l.id));
                list.appendChild(item);
            });
        });
        // Check if we were editing a lesson to keep it highlighted
        const idField = document.getElementById('lessonIdField');
        if (idField.value) {
            const activeTab = document.getElementById(`lesson-tab-${idField.value}`);
            if (activeTab)
                activeTab.classList.add('lesson-tab-item--active');
        }
    }
    catch (e) { }
}
function mostrarEditor() {
    const container = document.getElementById('lessonEditorContainer');
    const emptyState = document.getElementById('lessonEmptyState');
    if (container)
        container.style.display = 'block';
    if (emptyState)
        emptyState.style.display = 'none';
}
function ocultarEditor() {
    const container = document.getElementById('lessonEditorContainer');
    const emptyState = document.getElementById('lessonEmptyState');
    if (container)
        container.style.display = 'none';
    if (emptyState)
        emptyState.style.display = 'block';
    document.querySelectorAll('.lesson-tab-item').forEach(t => t.classList.remove('lesson-tab-item--active'));
}
function nuevaLeccion() {
    const form = document.getElementById('lessonForm');
    form.reset();
    document.getElementById('lessonIdField').value = '';
    document.getElementById('lessonEditorTitle').textContent = 'Nueva Clase';
    const contentField = document.getElementById('lessonContentField');
    const editorVisual = document.getElementById('editorVisual');
    contentField.value = '';
    if (editorVisual)
        editorVisual.innerHTML = '';
    document.getElementById('btnDeleteLesson').style.display = 'none';
    document.querySelectorAll('.lesson-tab-item').forEach(t => t.classList.remove('lesson-tab-item--active'));
    mostrarEditor();
}
window.editarLeccion = function (id) {
    const l = leccionesCargadas.find(x => x.id === id);
    if (!l)
        return;
    document.querySelectorAll('.lesson-tab-item').forEach(t => t.classList.remove('lesson-tab-item--active'));
    document.getElementById(`lesson-tab-${id}`)?.classList.add('lesson-tab-item--active');
    document.getElementById('lessonEditorTitle').textContent = 'Editando Clase';
    document.getElementById('btnDeleteLesson').style.display = 'block';
    document.getElementById('lessonIdField').value = l.id;
    document.getElementById('lessonTitleField').value = l.titulo;
    document.getElementById('lessonDayField').value = l.dia;
    document.getElementById('lessonOrderField').value = l.orden || 0;
    document.getElementById('lessonVideoField').value = l.video_url || '';
    const contentField = document.getElementById('lessonContentField');
    const editorVisual = document.getElementById('editorVisual');
    contentField.value = l.contenido_html || '';
    if (editorVisual)
        editorVisual.innerHTML = l.contenido_html || '';
    mostrarEditor();
};
window.borrarLeccion = async function (id) {
    if (!confirm('¿Borrar esta lección? Esta acción no se puede deshacer.'))
        return;
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        await fetch(`/api/lessons/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        ocultarEditor();
        cargarLecciones();
    }
    catch (e) {
        alert('Error al borrar');
    }
};
async function guardarLeccion(e) {
    e.preventDefault();
    // Sync editor content before saving
    const editorMode = window.editorMode || 'visual';
    if (editorMode === 'visual') {
        const editorVisual = document.getElementById('editorVisual');
        const contentField = document.getElementById('lessonContentField');
        if (editorVisual && contentField) {
            contentField.value = editorVisual.innerHTML;
        }
    }
    const id = document.getElementById('lessonIdField').value;
    const payload = {
        titulo: document.getElementById('lessonTitleField').value,
        dia: parseInt(document.getElementById('lessonDayField').value) || 1,
        orden: parseInt(document.getElementById('lessonOrderField').value) || 0,
        video_url: document.getElementById('lessonVideoField').value,
        contenido_html: document.getElementById('lessonContentField').value
    };
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        let res;
        if (id) {
            res = await fetch(`/api/lessons/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
        }
        else {
            res = await fetch(`/api/courses/${cursoId}/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
        }
        if (res.ok) {
            if (!id) {
                // if creating new, hide editor to reset view or we could just keep editing.
                const resJson = await res.json();
                document.getElementById('lessonIdField').value = resJson.id || resJson.insertId;
            }
            cargarLecciones();
            // show visual feedback
            const btn = e.submitter;
            const originalText = btn.textContent;
            btn.textContent = '¡Guardado!';
            btn.style.background = '#10b981';
            btn.style.borderColor = '#10b981';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '#147b71';
                btn.style.borderColor = '#147b71';
            }, 2000);
        }
        else {
            alert('Error al guardar la lección');
        }
    }
    catch (e) {
        alert('Error de conexión');
    }
}
/* ==========================================
   PREGUNTAS
   ========================================== */
let preguntasCargadas = [];
async function cargarPreguntas() {
    const token = localStorage.getItem(TOKEN_KEY);
    const list = document.getElementById('questionsList');
    if (!list)
        return;
    try {
        list.innerHTML = '';
        preguntasCargadas = [];
        for (const l of leccionesCargadas) {
            const res = await fetch(`/api/lessons/${l.id}/questions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const qs = await res.json();
            if (qs.length > 0) {
                const header = document.createElement('h4');
                header.style.cssText = 'color: var(--primary); margin-top: 1.5rem;';
                header.textContent = `En: ${l.titulo}`;
                list.appendChild(header);
                qs.forEach((q) => {
                    preguntasCargadas.push(q);
                    const div = document.createElement('div');
                    div.className = 'list-item-card';
                    div.innerHTML = `
            <div class="list-item-info">
              <h4 style="font-size: 1rem;">${q.pregunta}</h4>
              <p>Opciones: ${q.opciones.join(', ')} | Respuesta Correcta: Opción ${q.respuesta_correcta + 1}</p>
            </div>
            <div class="list-item-actions">
              <button class="btn btn--danger" onclick="borrarPregunta(${q.id})" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">Borrar</button>
            </div>
          `;
                    list.appendChild(div);
                });
            }
        }
        if (preguntasCargadas.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);">No hay preguntas creadas.</p>';
        }
    }
    catch (e) { }
}
function abrirModalPregunta() {
    if (leccionesCargadas.length === 0) {
        alert('Primero debes crear al menos una lección para añadirle preguntas.');
        return;
    }
    const form = document.getElementById('questionForm');
    form.reset();
    document.getElementById('questionModal')?.classList.add('modal--open');
}
function cerrarModalPregunta() {
    document.getElementById('questionModal')?.classList.remove('modal--open');
}
window.borrarPregunta = async function (id) {
    if (!confirm('¿Borrar esta pregunta?'))
        return;
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        await fetch(`/api/questions/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        cargarPreguntas();
    }
    catch (e) {
        alert('Error al borrar');
    }
};
async function guardarPregunta(e) {
    e.preventDefault();
    const lId = document.getElementById('questionLessonId').value;
    const opciones = [
        document.getElementById('opt0').value,
        document.getElementById('opt1').value,
        document.getElementById('opt2').value,
        document.getElementById('opt3').value
    ].filter(o => o.trim() !== '');
    const payload = {
        pregunta: document.getElementById('questionTextField').value,
        opciones: opciones,
        respuesta_correcta: parseInt(document.getElementById('correctOption').value)
    };
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        const res = await fetch(`/api/lessons/${lId}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            cerrarModalPregunta();
            cargarPreguntas();
        }
        else {
            alert('Error al guardar la pregunta');
        }
    }
    catch (e) {
        alert('Error de conexión');
    }
}
/* ==========================================
   DEBERES
   ========================================== */
let deberesCargados = [];
async function cargarDeberes() {
    const token = localStorage.getItem(TOKEN_KEY);
    const list = document.getElementById('assignmentsList');
    if (!list)
        return;
    try {
        const res = await fetch(`/api/courses/${cursoId}/assignments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const deberes = await res.json();
        deberesCargados = deberes;
        if (deberes.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);">No hay deberes asignados.</p>';
            return;
        }
        list.innerHTML = '';
        deberes.forEach((d) => {
            const div = document.createElement('div');
            div.className = 'list-item-card';
            div.innerHTML = `
        <div class="list-item-info">
          <h4>${d.titulo}</h4>
          <p>Límite: ${d.fecha_limite || 'Sin límite'} | Entregas: Ver en Panel Admin</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn--outline" onclick="editarDeber(${d.id})" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">Editar</button>
          <button class="btn btn--danger" onclick="borrarDeber(${d.id})" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">Borrar</button>
        </div>
      `;
            list.appendChild(div);
        });
    }
    catch (e) { }
}
function abrirModalDeber() {
    const form = document.getElementById('assignmentForm');
    form.reset();
    document.getElementById('assignmentIdField').value = '';
    document.getElementById('assignmentModalTitle').textContent = 'Nuevo Deber';
    document.getElementById('assignmentModal')?.classList.add('modal--open');
}
function cerrarModalDeber() {
    document.getElementById('assignmentModal')?.classList.remove('modal--open');
}
window.editarDeber = function (id) {
    const d = deberesCargados.find(x => x.id === id);
    if (!d)
        return;
    document.getElementById('assignmentIdField').value = d.id;
    document.getElementById('assignmentTitleField').value = d.titulo;
    document.getElementById('assignmentDescField').value = d.descripcion;
    document.getElementById('assignmentDateField').value = d.fecha_limite || '';
    document.getElementById('assignmentModalTitle').textContent = 'Editar Deber';
    document.getElementById('assignmentModal')?.classList.add('modal--open');
};
window.borrarDeber = async function (id) {
    if (!confirm('¿Borrar este deber?'))
        return;
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        await fetch(`/api/assignments/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        cargarDeberes();
    }
    catch (e) {
        alert('Error al borrar');
    }
};
async function guardarDeber(e) {
    e.preventDefault();
    const id = document.getElementById('assignmentIdField').value;
    const payload = {
        titulo: document.getElementById('assignmentTitleField').value,
        descripcion: document.getElementById('assignmentDescField').value,
        fecha_limite: document.getElementById('assignmentDateField').value
    };
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        let res;
        if (id) {
            res = await fetch(`/api/assignments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
        }
        else {
            res = await fetch(`/api/courses/${cursoId}/assignments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
        }
        if (res.ok) {
            cerrarModalDeber();
            cargarDeberes();
        }
        else {
            alert('Error al guardar el deber');
        }
    }
    catch (e) {
        alert('Error de conexión');
    }
}
