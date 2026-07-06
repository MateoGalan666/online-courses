export {};

interface Curso {
  id: number;
  titulo: string;
  descripcion: string;
  precio: number;
  imagen_url: string;
  temario: string;
  instructor: string;
  codigo_html?: string;
  instructor_avatar?: string;
  instructor_bio?: string;
  precio_original?: number;
  estudiantes_inscritos?: number;
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarHeader();
  cargarDetalleCurso();
});

/**
 * Procesa HTML personalizado para evitar que los estilos rompan la página.
 * Extrae solo el contenido del body y neutraliza estilos destructivos.
 */
function procesarHtmlPersonalizado(htmlString: string): string {
  // Crear un parser temporal
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  // Buscar estilos en la cabecera
  const styles = doc.querySelectorAll('style');
  let cssContent = '';
  styles.forEach(style => {
    cssContent += style.textContent || '';
  });
  
  // Extraer contenido del body
  const body = doc.body;
  let bodyContent = body.innerHTML;
  
  // Si el HTML es muy simple (sin html/body tags), usar el contenido tal cual
  if (!htmlString.includes('<html') && !htmlString.includes('<body')) {
    return htmlString;
  }
  
  // Procesar CSS para neutralizar estilos que rompen el layout
  let processedCss = cssContent
    .replace(/body\s*\{[^}]*\}/gi, '') // Eliminar estilos body
    .replace(/html\s*\{[^}]*\}/gi, '') // Eliminar estilos html
    .replace(/\*\s*\{[^}]*\}/gi, '');  // Eliminar selectores universales
  
  // Construir HTML final
  let result = '';
  
  // Agregar estilos procesados si hay
  if (processedCss.trim()) {
    result += `<style>${processedCss}</style>`;
  }
  
  // Agregar contenido del body
  result += bodyContent;
  
  // Asegurar que si tiene accordion en HTML, funcione o se adapte
  return result;
}

/**
 * Obtiene el ID desde la ruta de la URL y consulta la API del servidor.
 */
async function cargarDetalleCurso() {
  const titleElem = document.getElementById('courseTitle');
  const instructorElem = document.getElementById('courseInstructor');
  const avatarElem = document.getElementById('courseInstructorAvatar') as HTMLImageElement;
  const studentsCountElem = document.getElementById('courseStudentsCount');
  const descElem = document.getElementById('courseDescription');
  const syllabusListElem = document.getElementById('syllabusList');
  const sidebarImageElem = document.getElementById('courseSidebarImage') as HTMLImageElement;
  
  const discountContainer = document.getElementById('discountContainer');
  const discountPercentVal = document.getElementById('discountPercentVal');
  const coursePriceOriginal = document.getElementById('coursePriceOriginal');
  const priceElem = document.getElementById('coursePrice');
  const btnBuyNow = document.getElementById('btnBuyNow') as HTMLAnchorElement;
  
  const spinner = document.getElementById('detailSpinner');
  const contentWrapper = document.getElementById('detailContent');

  // Obtener el ID del curso de la ruta /curso/:id
  const pathParts = window.location.pathname.split('/');
  const courseId = pathParts[pathParts.length - 1];

  if (!courseId || isNaN(Number(courseId))) {
    mostrarError('Ruta del curso inválida. Regresa a la página principal.');
    return;
  }

  try {
    const response = await fetch(`/api/courses/${courseId}`);
    
    if (response.status === 404) {
      mostrarError('El curso que buscas no existe o ha sido retirado.');
      return;
    }
    
    if (!response.ok) {
      throw new Error('No se pudo obtener la información desde el servidor.');
    }

    const curso: Curso = await response.json();

    // Actualizar metadatos y textos
    document.title = `${curso.titulo} | Antigravity Academy`;
    if (titleElem) titleElem.textContent = curso.titulo;
    if (instructorElem) {
      if (curso.instructor && curso.instructor.trim() !== '' && curso.instructor !== 'Varios' && !curso.instructor.includes('Opcional')) {
        instructorElem.textContent = curso.instructor;
        const parentMeta = instructorElem.closest('.course-detail__meta-item');
        if (parentMeta) (parentMeta as HTMLElement).style.display = 'inline-flex';
      } else {
        const parentMeta = instructorElem.closest('.course-detail__meta-item');
        if (parentMeta) (parentMeta as HTMLElement).style.display = 'none';
      }
    }
    
    // Inyectar foto del instructor si existe
    if (avatarElem) {
      if (curso.instructor_avatar && curso.instructor_avatar.trim() !== '') {
        avatarElem.src = curso.instructor_avatar;
        avatarElem.style.display = 'block';
      } else {
        avatarElem.style.display = 'none';
      }
    }

    // Inyectar cantidad de alumnos (Inscripciones + 2450)
    if (studentsCountElem) {
      const totalStudents = (curso.estudiantes_inscritos || 0) + 2450;
      studentsCountElem.textContent = totalStudents.toLocaleString('es-ES');
    }

    if (descElem) descElem.textContent = curso.descripcion || 'Descripción no disponible';
    if (priceElem) priceElem.textContent = curso.precio.toFixed(2);
    
    // Inyectar Descuento y Precio Anterior
    if (curso.precio_original && curso.precio_original > curso.precio) {
      if (discountContainer) discountContainer.style.display = 'flex';
      if (coursePriceOriginal) coursePriceOriginal.textContent = `$${curso.precio_original.toFixed(2)}`;
      if (discountPercentVal) {
        const pct = Math.round(((curso.precio_original - curso.precio) / curso.precio_original) * 100);
        discountPercentVal.textContent = `${pct}% Dto.`;
      }
    } else {
      if (discountContainer) discountContainer.style.display = 'none';
    }
    
    if (sidebarImageElem) {
      sidebarImageElem.src = curso.imagen_url;
      sidebarImageElem.alt = curso.titulo;
    }

    // Inyectar sección del instructor si hay nombre o bio
    const instructorSection = document.getElementById('instructorSection');
    const instructorSectionAvatar = document.getElementById('instructorSectionAvatar') as HTMLImageElement;
    const instructorSectionName = document.getElementById('instructorSectionName');
    const instructorSectionBio = document.getElementById('instructorSectionBio');
    const instructorAvatarWrapper = document.getElementById('instructorAvatarWrapper');

    const hasInstructorInfo = (curso.instructor && curso.instructor.trim() !== '' && curso.instructor !== 'Varios') ||
                              (curso.instructor_bio && curso.instructor_bio.trim() !== '');

    if (instructorSection && hasInstructorInfo) {
      instructorSection.style.display = 'block';
      if (instructorSectionName) instructorSectionName.textContent = curso.instructor || '';
      if (instructorSectionBio) instructorSectionBio.textContent = curso.instructor_bio || '';

      if (instructorSectionAvatar && curso.instructor_avatar && curso.instructor_avatar.trim() !== '') {
        instructorSectionAvatar.src = curso.instructor_avatar;
        if (instructorAvatarWrapper) instructorAvatarWrapper.style.display = 'block';
      } else {
        if (instructorAvatarWrapper) instructorAvatarWrapper.style.display = 'none';
      }
    } else if (instructorSection) {
      instructorSection.style.display = 'none';
    }

    // Verificar matrícula si está logueado
    const token = localStorage.getItem('academy_token');
    const userJson = localStorage.getItem('academy_user');
    let enrolled = false;

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.rol === 'estudiante') {
          const enrollRes = await fetch(`/api/courses/${curso.id}/enrollment-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (enrollRes.ok) {
            const enrollData = await enrollRes.json();
            enrolled = enrollData.enrolled;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (btnBuyNow) {
      if (enrolled) {
        btnBuyNow.textContent = 'Ir al Aula Virtual';
        btnBuyNow.href = '/estudiante';
      } else {
        btnBuyNow.textContent = 'Comprar Ahora';
        btnBuyNow.href = `/checkout?cursoId=${curso.id}`;
      }
    }

    const hasCustomHtml = curso.codigo_html && curso.codigo_html.trim() !== '';
    const standardContainer = document.getElementById('standardCourseContent');
    const customHtmlContainer = document.getElementById('customHtmlContainer');

    if (hasCustomHtml) {
      if (standardContainer) standardContainer.style.display = 'none';
      if (customHtmlContainer) {
        // Procesar el HTML para evitar que los estilos rompan la página
        const processedHtml = procesarHtmlPersonalizado(curso.codigo_html!);
        customHtmlContainer.innerHTML = processedHtml;
        customHtmlContainer.style.display = 'block';
      }
    } else {
      if (standardContainer) standardContainer.style.display = 'block';
      if (customHtmlContainer) {
        customHtmlContainer.innerHTML = '';
        customHtmlContainer.style.display = 'none';
      }

      // Renderizar temario estándar interactivo (Acordeón)
      if (syllabusListElem) {
        syllabusListElem.innerHTML = '';
        const temarioText = (curso.temario || '').trim();
        
        if (temarioText === '') {
          const emptyLi = document.createElement('li');
          emptyLi.className = 'syllabus-item';
          emptyLi.style.color = 'var(--text-light)';
          emptyLi.style.padding = '1rem 1.5rem';
          emptyLi.textContent = 'Temario no disponible';
          syllabusListElem.appendChild(emptyLi);
        } else {
          const capitulos = temarioText.split('\n');
          let itemCount = 0;
          
          capitulos.forEach((capitulo) => {
            if (capitulo.trim() === '') return;
            
            itemCount++;
            const li = document.createElement('li');
            li.className = 'syllabus-item';
            
            // Dividir por "|" para separar título de descripción
            const parts = capitulo.split('|');
            const title = parts[0].trim();
            const desc = parts[1] ? parts[1].trim() : 'En esta sección se revisarán los fundamentos teóricos, prácticos y ejercicios de este tema de estudio.';
            
            li.innerHTML = `
              <div class="syllabus-item__header">
                <div class="syllabus-item__title-wrapper">
                  <div class="syllabus-item__number">${itemCount}</div>
                  <div>${escapeHTML(title)}</div>
                </div>
                <svg class="syllabus-item__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div class="syllabus-item__body">
                ${escapeHTML(desc)}
              </div>
            `;
            
            const header = li.querySelector('.syllabus-item__header');
            header?.addEventListener('click', () => {
              const isOpen = li.classList.contains('syllabus-item--open');
              
              // Cerrar los demás acordeones para un efecto de acordeón exclusivo
              const siblings = syllabusListElem.querySelectorAll('.syllabus-item');
              siblings.forEach(sibling => {
                sibling.classList.remove('syllabus-item--open');
              });
              
              if (!isOpen) {
                li.classList.add('syllabus-item--open');
              }
            });
            
            syllabusListElem.appendChild(li);
          });
        }
      }
    }

    // Alternar visibilidad de carga a contenido
    if (spinner) spinner.style.display = 'none';
    if (contentWrapper) contentWrapper.style.display = 'block';

  } catch (error) {
    console.error('Error al cargar detalle:', error);
    mostrarError(`Ocurrió un error al cargar la información del curso: ${(error as Error).message}`);
  }
}

/**
 * Muestra una tarjeta estilizada de error en la página.
 */
function mostrarError(mensaje: string) {
  const mainWrapper = document.getElementById('courseDetailMain');
  if (mainWrapper) {
    mainWrapper.innerHTML = `
      <div style="background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: var(--radius-md); padding: 2rem; color: #b91c1c; text-align: center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem;"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        <h3 style="font-family: var(--font-heading); font-weight: 700; margin-bottom: 0.5rem;">Error al Cargar Detalle</h3>
        <p>${escapeHTML(mensaje)}</p>
        <a href="/" class="btn btn--navy" style="margin-top: 1.5rem; display: inline-flex;">Volver a Cursos</a>
      </div>
    `;
  }
}

/**
 * Utilidad simple para escapar HTML y prevenir XSS.
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
        html += `<a href="/admin" class="nav__link">Panel Admin</a>`;
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
