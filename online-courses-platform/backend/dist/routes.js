"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const auth_1 = require("./auth");
const router = (0, express_1.Router)();
// Middleware de autenticación global
function authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Sesión no iniciada. Cabecera Authorization ausente.' });
    }
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    const decoded = (0, auth_1.verifyToken)(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' });
    }
    req.user = decoded; // Contiene: { id, nombre, email, rol }
    return next();
}
function requireRole(rol) {
    return (req, res, next) => {
        const user = req.user;
        if (!user || user.rol !== rol) {
            return res.status(403).json({ error: `Acceso denegado. Se requiere rol de ${rol}.` });
        }
        return next();
    };
}
function requireAnyRole(roles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.rol)) {
            return res.status(403).json({ error: 'Acceso denegado para este rol.' });
        }
        return next();
    };
}
/* ==========================================
   RUTAS DE AUTENTICACIÓN
   ========================================== */
// Registro de estudiantes
router.post('/api/auth/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        // Verificar duplicado
        const exists = await db.get('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (exists) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }
        const hashedPassword = (0, auth_1.hashPassword)(password);
        const result = await db.run(`INSERT INTO usuarios (nombre, email, password, rol)
       VALUES (?, ?, ?, 'estudiante')`, [nombre, email, hashedPassword]);
        const userPayload = { id: result.lastID, nombre, email, rol: 'estudiante' };
        const token = (0, auth_1.generateToken)(userPayload);
        return res.status(201).json({ success: true, token, user: userPayload });
    }
    catch (error) {
        console.error('Error al registrar estudiante:', error);
        return res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});
// Inicio de sesión (Multiusuario: Estudiante/Profesor)
router.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const user = await db.get('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'El correo o la contraseña son incorrectos.' });
        }
        const hashedPassword = (0, auth_1.hashPassword)(password);
        if (user.password !== hashedPassword) {
            return res.status(401).json({ error: 'El correo o la contraseña son incorrectos.' });
        }
        const userPayload = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
        const token = (0, auth_1.generateToken)(userPayload);
        return res.json({ success: true, token, user: userPayload });
    }
    catch (error) {
        console.error('Error en el login:', error);
        return res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});
// Obtener perfil actual
router.get('/api/auth/me', authenticateUser, async (req, res) => {
    return res.json(req.user);
});
// Gestionar usuarios y credenciales (solo Admin)
router.get('/api/admin/users', authenticateUser, requireRole('admin'), async (req, res) => {
    try {
        const db = await (0, database_1.getDatabase)();
        const users = await db.all('SELECT id, nombre, email, rol, fecha_creacion FROM usuarios ORDER BY id DESC');
        return res.json(users);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al cargar usuarios.' });
    }
});
router.post('/api/admin/users', authenticateUser, requireRole('admin'), async (req, res) => {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !['estudiante', 'profesor', 'admin'].includes(rol)) {
        return res.status(400).json({ error: 'Nombre, email, contrasena y rol valido son obligatorios.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const exists = await db.get('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (exists) {
            return res.status(400).json({ error: 'El correo ya esta registrado.' });
        }
        const result = await db.run(`INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`, [nombre, email, (0, auth_1.hashPassword)(password), rol]);
        const user = await db.get('SELECT id, nombre, email, rol, fecha_creacion FROM usuarios WHERE id = ?', [result.lastID]);
        return res.status(201).json(user);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al crear usuario.' });
    }
});
router.put('/api/admin/users/:id', authenticateUser, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !['estudiante', 'profesor', 'admin'].includes(rol)) {
        return res.status(400).json({ error: 'Nombre, email y rol valido son obligatorios.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const exists = await db.get('SELECT id FROM usuarios WHERE id = ?', [id]);
        if (!exists) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        if (password) {
            await db.run('UPDATE usuarios SET nombre = ?, email = ?, password = ?, rol = ? WHERE id = ?', [nombre, email, (0, auth_1.hashPassword)(password), rol, id]);
        }
        else {
            await db.run('UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?', [nombre, email, rol, id]);
        }
        const user = await db.get('SELECT id, nombre, email, rol, fecha_creacion FROM usuarios WHERE id = ?', [id]);
        return res.json(user);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al actualizar usuario.' });
    }
});
router.delete('/api/admin/users/:id', authenticateUser, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    if (parseInt(id) === currentUser.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        await db.run('DELETE FROM usuarios WHERE id = ?', [id]);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
});
/* ==========================================
   RUTAS DE LA API (CURSOS)
   ========================================== */
// 1. Obtener todos los cursos (Vista libre)
router.get('/api/courses', async (req, res) => {
    try {
        const db = await (0, database_1.getDatabase)();
        const courses = await db.all('SELECT *, (SELECT COUNT(*) FROM inscripciones WHERE curso_id = cursos.id) as estudiantes_inscritos FROM cursos ORDER BY id DESC');
        return res.json(courses);
    }
    catch (error) {
        console.error('Error al obtener cursos:', error);
        return res.status(500).json({ error: 'Error al recuperar catálogo.' });
    }
});
// IMPORTANTE: Esta ruta debe ir ANTES de /api/courses/:id para evitar que
// Express interprete 'my-learning' como un parámetro :id
// 7. Cargar cursos matriculados por el Estudiante activo
router.get('/api/courses/my-learning', authenticateUser, requireRole('estudiante'), async (req, res) => {
    const user = req.user;
    try {
        const db = await (0, database_1.getDatabase)();
        const courses = await db.all(`
      SELECT c.* 
      FROM inscripciones i
      JOIN cursos c ON i.curso_id = c.id
      WHERE i.estudiante_id = ?
      ORDER BY i.fecha_inscripcion DESC
    `, [user.id]);
        return res.json(courses);
    }
    catch (error) {
        console.error('Error al cargar mis cursos:', error);
        return res.status(500).json({ error: 'Error al recuperar tus clases.' });
    }
});
// 2. Obtener un curso específico
router.get('/api/courses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, database_1.getDatabase)();
        const course = await db.get('SELECT *, (SELECT COUNT(*) FROM inscripciones WHERE curso_id = cursos.id) as estudiantes_inscritos FROM cursos WHERE id = ?', [id]);
        if (!course) {
            return res.status(404).json({ error: 'Curso no encontrado.' });
        }
        return res.json(course);
    }
    catch (error) {
        console.error(`Error al obtener curso ${id}:`, error);
        return res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});
// 3. Crear un nuevo curso (Protegido - Solo Admin)
router.post('/api/courses', authenticateUser, requireRole('admin'), async (req, res) => {
    const { titulo, descripcion, precio, imagen_url, temario, instructor, codigo_html, instructor_avatar, instructor_bio, precio_original } = req.body;
    if (!titulo || precio === undefined) {
        return res.status(400).json({ error: 'El título y precio son obligatorios.' });
    }
    const isHtmlOnly = codigo_html && codigo_html.trim() !== '';
    if (!isHtmlOnly && !imagen_url) {
        return res.status(400).json({ error: 'La imagen de portada es obligatoria cuando no usas HTML personalizado.' });
    }
    if (!isHtmlOnly) {
        if (!descripcion || !temario || !instructor) {
            return res.status(400).json({ error: 'Debes proporcionar descripción, temario e instructor, o bien un código HTML personalizado.' });
        }
    }
    const finalDescripcion = descripcion || '';
    const finalTemario = temario || '';
    const finalInstructor = instructor || 'Varios';
    const finalImagenUrl = imagen_url || 'https://images.unsplash.com/photo-1516116211223-5c359a36298a?auto=format&fit=crop&w=800&q=80';
    const finalInstructorAvatar = instructor_avatar || '';
    const finalInstructorBio = instructor_bio || '';
    const finalPrecioOriginal = precio_original ? parseFloat(precio_original) : 0;
    try {
        const db = await (0, database_1.getDatabase)();
        const result = await db.run(`INSERT INTO cursos (titulo, descripcion, precio, imagen_url, temario, instructor, codigo_html, instructor_avatar, instructor_bio, precio_original)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [titulo, finalDescripcion, parseFloat(precio), finalImagenUrl, finalTemario, finalInstructor, (codigo_html || ''), finalInstructorAvatar, finalInstructorBio, finalPrecioOriginal]);
        const newCourse = await db.get('SELECT * FROM cursos WHERE id = ?', [result.lastID]);
        return res.status(201).json(newCourse);
    }
    catch (error) {
        console.error('Error al crear curso:', error);
        return res.status(500).json({ error: 'Error al registrar el curso.' });
    }
});
// 4. Editar un curso existente (Protegido - Admin o Profesor)
router.put('/api/courses/:id', authenticateUser, requireAnyRole(['admin', 'profesor']), async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion, precio, imagen_url, temario, instructor, codigo_html, instructor_avatar, instructor_bio, precio_original } = req.body;
    if (!titulo || precio === undefined) {
        return res.status(400).json({ error: 'El título y precio son obligatorios.' });
    }
    const isHtmlOnly = codigo_html && codigo_html.trim() !== '';
    if (!isHtmlOnly && !imagen_url) {
        return res.status(400).json({ error: 'La imagen de portada es obligatoria cuando no usas HTML personalizado.' });
    }
    if (!isHtmlOnly) {
        if (!descripcion || !temario || !instructor) {
            return res.status(400).json({ error: 'Debes proporcionar descripción, temario e instructor, o bien un código HTML personalizado.' });
        }
    }
    const finalDescripcion = descripcion || '';
    const finalTemario = temario || '';
    const finalInstructor = instructor || 'Varios';
    const finalImagenUrl = imagen_url || 'https://images.unsplash.com/photo-1516116211223-5c359a36298a?auto=format&fit=crop&w=800&q=80';
    const finalInstructorAvatar = instructor_avatar || '';
    const finalInstructorBio = instructor_bio || '';
    const finalPrecioOriginal = precio_original ? parseFloat(precio_original) : 0;
    try {
        const db = await (0, database_1.getDatabase)();
        const courseExists = await db.get('SELECT id FROM cursos WHERE id = ?', [id]);
        if (!courseExists) {
            return res.status(404).json({ error: 'El curso a editar no existe.' });
        }
        await db.run(`UPDATE cursos 
       SET titulo = ?, descripcion = ?, precio = ?, imagen_url = ?, temario = ?, instructor = ?, codigo_html = ?, instructor_avatar = ?, instructor_bio = ?, precio_original = ?
       WHERE id = ?`, [titulo, finalDescripcion, parseFloat(precio), finalImagenUrl, finalTemario, finalInstructor, (codigo_html || ''), finalInstructorAvatar, finalInstructorBio, finalPrecioOriginal, id]);
        const updatedCourse = await db.get('SELECT * FROM cursos WHERE id = ?', [id]);
        return res.json(updatedCourse);
    }
    catch (error) {
        console.error(`Error al editar curso ${id}:`, error);
        return res.status(500).json({ error: 'Error al actualizar el curso.' });
    }
});
// 5. Eliminar un curso (Protegido - Solo Admin)
router.delete('/api/courses/:id', authenticateUser, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, database_1.getDatabase)();
        const courseExists = await db.get('SELECT id FROM cursos WHERE id = ?', [id]);
        if (!courseExists) {
            return res.status(404).json({ error: 'El curso a eliminar no existe.' });
        }
        await db.run('DELETE FROM cursos WHERE id = ?', [id]);
        return res.json({ message: 'Curso eliminado exitosamente.', id: parseInt(id) });
    }
    catch (error) {
        console.error(`Error al eliminar curso ${id}:`, error);
        return res.status(500).json({ error: 'Error al eliminar el curso.' });
    }
});
/* ==========================================
   RUTAS DE LA API (CHECKOUT Y MATRÍCULAS)
   ========================================== */
// Obtener cursos asignados a un profesor
router.get('/api/profesor/courses', authenticateUser, requireRole('profesor'), async (req, res) => {
    const user = req.user;
    try {
        const db = await (0, database_1.getDatabase)();
        const courses = await db.all(`
      SELECT c.*, (SELECT COUNT(*) FROM inscripciones WHERE curso_id = c.id) as estudiantes_inscritos
      FROM cursos c
      JOIN curso_profesor cp ON c.id = cp.curso_id
      WHERE cp.profesor_id = ?
      ORDER BY c.id DESC
    `, [user.id]);
        return res.json(courses);
    }
    catch (error) {
        console.error('Error al cargar cursos del profesor:', error);
        return res.status(500).json({ error: 'Error al cargar cursos.' });
    }
});
// Asignar profesor a un curso (solo admin)
router.post('/api/admin/profesor-courses', authenticateUser, requireRole('admin'), async (req, res) => {
    const { profesor_id, curso_id } = req.body;
    if (!profesor_id || !curso_id) {
        return res.status(400).json({ error: 'profesor_id y curso_id son obligatorios.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        await db.run('INSERT OR IGNORE INTO curso_profesor (curso_id, profesor_id) VALUES (?, ?)', [curso_id, profesor_id]);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al asignar profesor.' });
    }
});
// Inscribir profesor en un curso automáticamente (sin pago)
router.post('/api/courses/:id/enroll-profesor', authenticateUser, requireRole('profesor'), async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const db = await (0, database_1.getDatabase)();
        await db.run('INSERT OR IGNORE INTO inscripciones (estudiante_id, curso_id) VALUES (?, ?)', [user.id, id]);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al inscribir profesor.' });
    }
});
// Verificar clave de acceso a un curso (para profesor/admin)
router.post('/api/courses/:id/verify-key', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { clave } = req.body;
    if (!clave) {
        return res.status(400).json({ error: 'La clave de acceso es obligatoria.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const course = await db.get('SELECT id, titulo, clave_acceso FROM cursos WHERE id = ?', [id]);
        if (!course) {
            return res.status(404).json({ error: 'Curso no encontrado.' });
        }
        if (course.clave_acceso !== clave) {
            return res.status(403).json({ error: 'Clave de acceso incorrecta.' });
        }
        return res.json({ success: true, curso_id: course.id, titulo: course.titulo });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al verificar clave.' });
    }
});
// 6. Registrar matrícula y simular checkout de compra
router.post('/api/checkout', authenticateUser, async (req, res) => {
    const { curso_id, numero_tarjeta } = req.body;
    const user = req.user;
    if (!curso_id || !numero_tarjeta) {
        return res.status(400).json({ error: 'Faltan datos requeridos para procesar la transacción.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const course = await db.get('SELECT id, titulo, precio FROM cursos WHERE id = ?', [curso_id]);
        if (!course) {
            return res.status(404).json({ error: 'El curso seleccionado no existe.' });
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
        // Registrar matrícula en 'inscripciones' si no existiera
        const enrolled = await db.get('SELECT id FROM inscripciones WHERE estudiante_id = ? AND curso_id = ?', [user.id, curso_id]);
        if (!enrolled) {
            await db.run(`INSERT INTO inscripciones (estudiante_id, curso_id) VALUES (?, ?)`, [user.id, curso_id]);
        }
        // Registrar el pedido para histórico
        const result = await db.run(`INSERT INTO pedidos (curso_id, nombre_cliente, email_cliente, estado)
       VALUES (?, ?, ?, 'completado')`, [curso_id, user.nombre, user.email]);
        return res.status(201).json({
            success: true,
            message: 'Matrícula procesada y pago simulado correctamente.',
            orderId: result.lastID,
            courseTitle: course.titulo,
            amountPaid: course.precio,
            clientName: user.nombre,
            clientEmail: user.email
        });
    }
    catch (error) {
        console.error('Error al procesar el checkout:', error);
        return res.status(500).json({ error: 'Error interno en la simulación de cobro.' });
    }
});
// 8. Estado de matrícula del estudiante activo para un curso específico
router.get('/api/courses/:id/enrollment-status', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const db = await (0, database_1.getDatabase)();
        const enrolled = await db.get('SELECT id FROM inscripciones WHERE estudiante_id = ? AND curso_id = ?', [user.id, id]);
        return res.json({ enrolled: !!enrolled });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al consultar estado.' });
    }
});
// 9. Ver lista de alumnos matriculados en un curso (Profesor)
router.get('/api/courses/:id/students', authenticateUser, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, database_1.getDatabase)();
        const students = await db.all(`
      SELECT u.id, u.nombre, u.email, i.fecha_inscripcion
      FROM inscripciones i
      JOIN usuarios u ON i.estudiante_id = u.id
      WHERE i.curso_id = ?
      ORDER BY u.nombre ASC
    `, [id]);
        return res.json(students);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al cargar los estudiantes.' });
    }
});
// 10. Obtener historial general de pedidos (Protegido - Profesor)
router.get('/api/admin/orders', authenticateUser, requireRole('admin'), async (req, res) => {
    try {
        const db = await (0, database_1.getDatabase)();
        const orders = await db.all(`
      SELECT p.*, c.titulo as curso_titulo, c.precio as curso_precio
      FROM pedidos p
      LEFT JOIN cursos c ON p.curso_id = c.id
      ORDER BY p.id DESC
    `);
        return res.json(orders);
    }
    catch (error) {
        console.error('Error al obtener pedidos:', error);
        return res.status(500).json({ error: 'Error al cargar los pedidos.' });
    }
});
/* ==========================================
   RUTAS DE LA API (LECCIONES / VÍDEOS)
   ========================================== */
// 11. Listar lecciones de un curso
router.get('/api/courses/:id/lessons', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const db = await (0, database_1.getDatabase)();
        // Si es estudiante, verificar que está matriculado
        if (user.rol === 'estudiante') {
            const enrolled = await db.get('SELECT id FROM inscripciones WHERE estudiante_id = ? AND curso_id = ?', [user.id, id]);
            if (!enrolled) {
                return res.status(403).json({ error: 'Debes comprar este curso para ver las lecciones.' });
            }
        }
        const lessons = await db.all('SELECT * FROM lecciones WHERE curso_id = ? ORDER BY orden ASC', [id]);
        return res.json(lessons);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al cargar las lecciones.' });
    }
});
// 12. Crear lección en un curso (Profesor)
router.post('/api/courses/:id/lessons', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion, video_url, orden, dia, archivo_nombre, archivo_tipo, archivo_data, contenido_html } = req.body;
    if (!titulo) {
        return res.status(400).json({ error: 'El título de la lección es obligatorio.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const result = await db.run(`INSERT INTO lecciones (curso_id, titulo, descripcion, video_url, orden, dia, archivo_nombre, archivo_tipo, archivo_data, contenido_html)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, titulo, descripcion || '', video_url || '', orden || 0, dia || 1, archivo_nombre || '', archivo_tipo || '', archivo_data || '', contenido_html || '']);
        const newLesson = await db.get('SELECT * FROM lecciones WHERE id = ?', [result.lastID]);
        return res.status(201).json(newLesson);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al registrar la lección.' });
    }
});
// 13. Editar leccion (Profesor)
router.put('/api/lessons/:id', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion, video_url, orden, dia, archivo_nombre, archivo_tipo, archivo_data, contenido_html } = req.body;
    if (!titulo) {
        return res.status(400).json({ error: 'El titulo de la leccion es obligatorio.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const lessonExists = await db.get('SELECT id FROM lecciones WHERE id = ?', [id]);
        if (!lessonExists) {
            return res.status(404).json({ error: 'La leccion a editar no existe.' });
        }
        await db.run(`UPDATE lecciones
       SET titulo = ?, descripcion = ?, video_url = ?, orden = ?, dia = ?, archivo_nombre = ?, archivo_tipo = ?, archivo_data = ?, contenido_html = ?
       WHERE id = ?`, [titulo, descripcion || '', video_url || '', orden || 0, dia || 1, archivo_nombre || '', archivo_tipo || '', archivo_data || '', contenido_html || '', id]);
        const updatedLesson = await db.get('SELECT * FROM lecciones WHERE id = ?', [id]);
        return res.json(updatedLesson);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al actualizar la leccion.' });
    }
});
// 14. Eliminar leccion (Profesor)
router.delete('/api/lessons/:id', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, database_1.getDatabase)();
        await db.run('DELETE FROM lecciones WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Lección eliminada.' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al eliminar lección.' });
    }
});
/* ==========================================
   RUTAS DE LA API (DEBERES Y ENTREGAS)
   ========================================== */
// 14. Listar deberes de un curso
router.get('/api/courses/:id/assignments', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const db = await (0, database_1.getDatabase)();
        // Verificar matrícula para estudiantes
        if (user.rol === 'estudiante') {
            const enrolled = await db.get('SELECT id FROM inscripciones WHERE estudiante_id = ? AND curso_id = ?', [user.id, id]);
            if (!enrolled) {
                return res.status(403).json({ error: 'Debes comprar el curso para acceder a las tareas.' });
            }
        }
        let assignments;
        if (user.rol === 'estudiante') {
            assignments = await db.all(`
        SELECT d.*, ed.contenido_respuesta, ed.fecha_entrega, ed.calificacion
        FROM deberes d
        LEFT JOIN entregas_deberes ed ON d.id = ed.deber_id AND ed.estudiante_id = ?
        WHERE d.curso_id = ?
        ORDER BY d.id DESC
      `, [user.id, id]);
        }
        else {
            assignments = await db.all('SELECT * FROM deberes WHERE curso_id = ? ORDER BY id DESC', [id]);
        }
        return res.json(assignments);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al cargar deberes.' });
    }
});
// 15. Crear deber (Profesor)
router.post('/api/courses/:id/assignments', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion, fecha_limite } = req.body;
    if (!titulo || !descripcion) {
        return res.status(400).json({ error: 'El título y descripción de la tarea son obligatorios.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const result = await db.run(`INSERT INTO deberes (curso_id, titulo, descripcion, fecha_limite)
       VALUES (?, ?, ?, ?)`, [id, titulo, descripcion, fecha_limite || '']);
        const newAssignment = await db.get('SELECT * FROM deberes WHERE id = ?', [result.lastID]);
        return res.status(201).json(newAssignment);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al registrar tarea.' });
    }
});
// 15b. Editar deber (Profesor)
router.put('/api/assignments/:id', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion, fecha_limite } = req.body;
    if (!titulo || !descripcion) {
        return res.status(400).json({ error: 'El título y descripción de la tarea son obligatorios.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        await db.run(`UPDATE deberes SET titulo = ?, descripcion = ?, fecha_limite = ? WHERE id = ?`, [titulo, descripcion, fecha_limite || '', id]);
        const updatedAssignment = await db.get('SELECT * FROM deberes WHERE id = ?', [id]);
        return res.json(updatedAssignment);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al actualizar tarea.' });
    }
});
// 15c. Eliminar deber (Profesor)
router.delete('/api/assignments/:id', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, database_1.getDatabase)();
        await db.run('DELETE FROM deberes WHERE id = ?', [id]);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al eliminar tarea.' });
    }
});
// 16. Enviar/Guardar entrega de un deber (Estudiante)
router.post('/api/assignments/:id/submit', authenticateUser, requireRole('estudiante'), async (req, res) => {
    const { id } = req.params;
    const { contenido_respuesta, archivo_nombre, archivo_tipo, archivo_data } = req.body;
    const user = req.user;
    if (!contenido_respuesta) {
        return res.status(400).json({ error: 'Debes ingresar una respuesta para tu entrega.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const assignment = await db.get('SELECT curso_id FROM deberes WHERE id = ?', [id]);
        if (!assignment) {
            return res.status(404).json({ error: 'La tarea seleccionada no existe.' });
        }
        const enrolled = await db.get('SELECT id FROM inscripciones WHERE estudiante_id = ? AND curso_id = ?', [user.id, assignment.curso_id]);
        if (!enrolled) {
            return res.status(403).json({ error: 'No estás inscrito en el curso correspondiente.' });
        }
        await db.run(`INSERT INTO entregas_deberes (deber_id, estudiante_id, contenido_respuesta, archivo_nombre, archivo_tipo, archivo_data)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(deber_id, estudiante_id) 
       DO UPDATE SET contenido_respuesta = excluded.contenido_respuesta,
                     archivo_nombre = excluded.archivo_nombre,
                     archivo_tipo = excluded.archivo_tipo,
                     archivo_data = excluded.archivo_data,
                     fecha_entrega = CURRENT_TIMESTAMP`, [id, user.id, contenido_respuesta, archivo_nombre || '', archivo_tipo || '', archivo_data || '']);
        return res.json({ success: true, message: 'Tarea entregada con éxito.' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al enviar tu entrega.' });
    }
});
// 17. Ver entregas de una tarea específica (Profesor)
router.get('/api/assignments/:id/submissions', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, database_1.getDatabase)();
        const submissions = await db.all(`
      SELECT ed.*, u.nombre as estudiante_nombre, u.email as estudiante_email
      FROM entregas_deberes ed
      JOIN usuarios u ON ed.estudiante_id = u.id
      WHERE ed.deber_id = ?
      ORDER BY ed.fecha_entrega DESC
    `, [id]);
        return res.json(submissions);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al recuperar entregas.' });
    }
});
// 18. Calificar entrega (Profesor)
router.post('/api/submissions/:id/grade', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { calificacion } = req.body;
    if (calificacion === undefined) {
        return res.status(400).json({ error: 'La calificación es obligatoria.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        await db.run('UPDATE entregas_deberes SET calificacion = ? WHERE id = ?', [calificacion, id]);
        return res.json({ success: true, message: 'Calificación guardada.' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al calificar tarea.' });
    }
});
/* ==========================================
   ENRUTAMIENTO DE LAS VISTAS FRONTEND (PÁGINAS)
   ========================================== */
const frontendPath = path_1.default.join(process.cwd(), 'frontend');
router.get('/', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'index.html'));
});
router.get('/curso/:id', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'curso.html'));
});
router.get('/checkout', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'checkout.html'));
});
router.get('/admin', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'admin.html'));
});
router.get('/login', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'login.html'));
});
router.get('/estudiante', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'estudiante.html'));
});
router.get('/success', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'success.html'));
});
/* ==========================================
   RUTAS DE LA API (PREGUNTAS DE LECCIÓN)
   ========================================== */
// 18. Obtener preguntas de una lección
router.get('/api/lessons/:id/questions', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, database_1.getDatabase)();
        const questions = await db.all('SELECT * FROM preguntas_leccion WHERE leccion_id = ?', [id]);
        // Parsear las opciones JSON para devolver array
        const parsedQuestions = questions.map(q => ({
            ...q,
            opciones: JSON.parse(q.opciones)
        }));
        return res.json(parsedQuestions);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al obtener preguntas.' });
    }
});
// 19. Añadir pregunta a una lección
router.post('/api/lessons/:id/questions', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { pregunta, opciones, respuesta_correcta } = req.body;
    if (!pregunta || !opciones || opciones.length < 2 || respuesta_correcta === undefined) {
        return res.status(400).json({ error: 'Datos de pregunta incompletos.' });
    }
    try {
        const db = await (0, database_1.getDatabase)();
        const result = await db.run(`INSERT INTO preguntas_leccion (leccion_id, pregunta, opciones, respuesta_correcta) VALUES (?, ?, ?, ?)`, [id, pregunta, JSON.stringify(opciones), respuesta_correcta]);
        const newQuestion = await db.get('SELECT * FROM preguntas_leccion WHERE id = ?', [result.lastID]);
        newQuestion.opciones = JSON.parse(newQuestion.opciones);
        return res.status(201).json(newQuestion);
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al guardar la pregunta.' });
    }
});
// 20. Eliminar pregunta
router.delete('/api/questions/:id', authenticateUser, requireAnyRole(['profesor', 'admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, database_1.getDatabase)();
        await db.run('DELETE FROM preguntas_leccion WHERE id = ?', [id]);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error al eliminar la pregunta.' });
    }
});
exports.default = router;
