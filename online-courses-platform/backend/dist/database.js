"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
let db = null;
/**
 * Abre y retorna la conexión a la base de datos SQLite.
 * Inicializa las tablas y los datos de prueba si no existen.
 */
async function getDatabase() {
    if (db)
        return db;
    // Almacenar la base de datos en la raíz del directorio backend o en /tmp si es Vercel
    const bundledDbPath = path_1.default.join(__dirname, '../courses.db');
    const dbPath = process.env.VERCEL === '1'
        ? path_1.default.join(os_1.default.tmpdir(), 'courses.db')
        : bundledDbPath;
    if (process.env.VERCEL === '1' && !fs_1.default.existsSync(dbPath) && fs_1.default.existsSync(bundledDbPath)) {
        fs_1.default.copyFileSync(bundledDbPath, dbPath);
    }
    db = await (0, sqlite_1.open)({
        filename: dbPath,
        driver: sqlite3_1.default.Database
    });
    await initDatabase(db);
    return db;
}
/**
 * Inicializa las tablas de cursos y pedidos, y siembra datos iniciales.
 */
async function initDatabase(db) {
    // Habilitar claves foráneas
    await db.run('PRAGMA foreign_keys = ON;');
    // Crear tabla de asignación profesor-curso
    await db.exec(`
    CREATE TABLE IF NOT EXISTS curso_profesor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER NOT NULL,
      profesor_id INTEGER NOT NULL,
      FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE,
      FOREIGN KEY (profesor_id) REFERENCES usuarios (id) ON DELETE CASCADE,
      UNIQUE(curso_id, profesor_id)
    );
  `);
    // Crear tabla de cursos
    await db.exec(`
    CREATE TABLE IF NOT EXISTS cursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      precio REAL NOT NULL,
      imagen_url TEXT NOT NULL,
      temario TEXT NOT NULL,
      instructor TEXT NOT NULL,
      instructor_avatar TEXT DEFAULT '',
      instructor_bio TEXT DEFAULT '',
      precio_original REAL DEFAULT 0,
      codigo_html TEXT DEFAULT '',
      clave_acceso TEXT DEFAULT 'acceso123',
      fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
    // Verificar si la columna 'codigo_html' y los nuevos campos existen en una base de datos antigua
    const tableInfo = await db.all("PRAGMA table_info(cursos);");
    const colNames = tableInfo.map((col) => col.name);
    if (!colNames.includes('codigo_html')) {
        console.log("Migrando base de datos: Agregando columna 'codigo_html'...");
        await db.run("ALTER TABLE cursos ADD COLUMN codigo_html TEXT DEFAULT ''");
    }
    if (!colNames.includes('instructor_avatar')) {
        console.log("Migrando base de datos: Agregando columna 'instructor_avatar'...");
        await db.run("ALTER TABLE cursos ADD COLUMN instructor_avatar TEXT DEFAULT ''");
    }
    if (!colNames.includes('precio_original')) {
        console.log("Migrando base de datos: Agregando columna 'precio_original'...");
        await db.run("ALTER TABLE cursos ADD COLUMN precio_original REAL DEFAULT 0");
    }
    if (!colNames.includes('instructor_bio')) {
        console.log("Migrando base de datos: Agregando columna 'instructor_bio'...");
        await db.run("ALTER TABLE cursos ADD COLUMN instructor_bio TEXT DEFAULT ''");
    }
    if (!colNames.includes('clave_acceso')) {
        console.log("Migrando base de datos: Agregando columna 'clave_acceso'...");
        await db.run("ALTER TABLE cursos ADD COLUMN clave_acceso TEXT DEFAULT 'acceso123'");
    }
    // Crear tabla de pedidos
    await db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER,
      nombre_cliente TEXT NOT NULL,
      email_cliente TEXT NOT NULL,
      fecha TEXT DEFAULT CURRENT_TIMESTAMP,
      estado TEXT DEFAULT 'completado',
      FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE
    );
  `);
    // Crear tabla de usuarios
    await db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('estudiante', 'profesor', 'admin')),
      fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
    const usersSchema = await db.get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'");
    if (usersSchema?.sql && !usersSchema.sql.includes("'admin'")) {
        console.log("Migrando base de datos: habilitando rol 'admin'...");
        await db.exec(`
      CREATE TABLE usuarios_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        rol TEXT NOT NULL CHECK(rol IN ('estudiante', 'profesor', 'admin')),
        fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO usuarios_new (id, nombre, email, password, rol, fecha_creacion)
      SELECT id, nombre, email, password, rol, fecha_creacion FROM usuarios;
      DROP TABLE usuarios;
      ALTER TABLE usuarios_new RENAME TO usuarios;
    `);
    }
    // Crear tabla de lecciones (videos)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS lecciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      video_url TEXT DEFAULT '',
      orden INTEGER DEFAULT 0,
      dia INTEGER DEFAULT 1,
      archivo_nombre TEXT DEFAULT '',
      archivo_tipo TEXT DEFAULT '',
      archivo_data TEXT DEFAULT '',
      contenido_html TEXT DEFAULT '',
      FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE
    );
  `);
    // Crear tabla de preguntas de lección
    await db.exec(`
    CREATE TABLE IF NOT EXISTS preguntas_leccion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leccion_id INTEGER NOT NULL,
      pregunta TEXT NOT NULL,
      opciones TEXT NOT NULL, -- Guardado como JSON string ["A", "B", "C"]
      respuesta_correcta INTEGER NOT NULL, -- Índice de la opción correcta (0, 1, 2...)
      FOREIGN KEY (leccion_id) REFERENCES lecciones (id) ON DELETE CASCADE
    );
  `);
    // Crear tabla de deberes
    await db.exec(`
    CREATE TABLE IF NOT EXISTS deberes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      fecha_limite TEXT DEFAULT '',
      FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE
    );
  `);
    // Crear tabla de inscripciones/matrículas
    await db.exec(`
    CREATE TABLE IF NOT EXISTS inscripciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      curso_id INTEGER NOT NULL,
      fecha_inscripcion TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (estudiante_id) REFERENCES usuarios (id) ON DELETE CASCADE,
      FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE,
      UNIQUE(estudiante_id, curso_id)
    );
  `);
    // Crear tabla de entregas de deberes
    await db.exec(`
    CREATE TABLE IF NOT EXISTS entregas_deberes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deber_id INTEGER NOT NULL,
      estudiante_id INTEGER NOT NULL,
      contenido_respuesta TEXT NOT NULL,
      archivo_nombre TEXT DEFAULT '',
      archivo_tipo TEXT DEFAULT '',
      archivo_data TEXT DEFAULT '',
      fecha_entrega TEXT DEFAULT CURRENT_TIMESTAMP,
      calificacion TEXT DEFAULT NULL,
      FOREIGN KEY (deber_id) REFERENCES deberes (id) ON DELETE CASCADE,
      FOREIGN KEY (estudiante_id) REFERENCES usuarios (id) ON DELETE CASCADE,
      UNIQUE(deber_id, estudiante_id)
    );
  `);
    // Sembrar credenciales locales por defecto
    const userCount = await db.get('SELECT COUNT(*) as count FROM usuarios');
    if (userCount && userCount.count === 0) {
        console.log('Sembrando usuarios por defecto...');
        const hash = crypto_1.default.createHash('sha256').update('admin123').digest('hex');
        await db.run(`INSERT INTO usuarios (nombre, email, password, rol)
       VALUES (?, ?, ?, ?)`, ['Administrador Antigravity', 'admin@antigravity.academy', hash, 'admin']);
        await db.run(`INSERT INTO usuarios (nombre, email, password, rol)
       VALUES (?, ?, ?, ?)`, ['Profesor Antigravity', 'profesor@antigravity.academy', hash, 'profesor']);
        await db.run(`INSERT INTO usuarios (nombre, email, password, rol)
       VALUES (?, ?, ?, ?)`, ['Estudiante Antigravity', 'estudiante@antigravity.academy', hash, 'estudiante']);
        console.log('Usuarios creados: admin/profesor/estudiante @antigravity.academy / admin123');
    }
    else {
        const hash = crypto_1.default.createHash('sha256').update('admin123').digest('hex');
        const adminExists = await db.get('SELECT id FROM usuarios WHERE email = ?', ['admin@antigravity.academy']);
        if (!adminExists) {
            await db.run(`INSERT INTO usuarios (nombre, email, password, rol)
         VALUES (?, ?, ?, ?)`, ['Administrador Antigravity', 'admin@antigravity.academy', hash, 'admin']);
        }
    }
    // Verificar si hay cursos registrados, si no, sembrar datos de prueba
    const count = await db.get('SELECT COUNT(*) as count FROM cursos');
    if (count && count.count === 0) {
        console.log('Sembrando base de datos con cursos iniciales...');
        const initialCourses = [
            {
                titulo: 'Máster en TypeScript Profesional',
                descripcion: 'Domina TypeScript desde las bases hasta patrones avanzados, genéricos, decoradores y arquitectura limpia en aplicaciones backend y frontend modernas.',
                precio: 49.99,
                imagen_url: '/images/typescript.png',
                temario: '1. Introducción a TypeScript y Tipado Estático\n2. Tipos de Datos Avanzados y Uniones\n3. Interfaces, Clases y Programación Orientada a Objetos\n4. Genéricos Avanzados y Tipos Mapeados\n5. Decoradores y Metadatos en TS\n6. Configuración de Proyectos y Monorepos en TS\n7. Integración con Express, Node y frontend vanilla',
                instructor: 'Dr. Alejandro Ruiz'
            },
            {
                titulo: 'CSS & Layouts Modernos: Flexbox, Grid y Animaciones',
                descripcion: 'Aprende a maquetar interfaces web espectaculares que enamoren a tus usuarios. Domina el modelo de cajas, CSS Grid, Flexbox, metodologías BEM y micro-interacciones interactivas.',
                precio: 29.99,
                imagen_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
                temario: '1. Fundamentos del Renderizado y CSS Moderno\n2. Flexbox Profundo: Distribución Flexible y Alineaciones\n3. CSS Grid Layout: Grillas Bidimensionales Complejas\n4. Variables CSS, Temas de Diseño y Custom Properties\n5. Transiciones, Animaciones con @keyframes y Efectos de Carga\n6. Metodología BEM (Block, Element, Modifier) y Arquitectura Limpia\n7. Responsive Web Design Moderno y Estrategia Mobile-First',
                instructor: 'Ing. Sofía Castro'
            },
            {
                titulo: 'Desarrollo Backend Completo con Node.js, Express y SQLite',
                descripcion: 'Construye APIs REST rápidas, escalables y seguras desde cero. Aprende routing, middlewares de Express, autenticación de administradores, SQLite local y despliegue.',
                precio: 39.99,
                imagen_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
                temario: '1. Arquitectura de Node.js y Event Loop\n2. Creación del Servidor y Manejo de Rutas con Express\n3. Ciclo de Vida del Request y Middlewares Personalizados\n4. Base de Datos Relacional y Consultas Asíncronas con SQLite\n5. Seguridad de APIs, Manejo de Cabeceras y Errores\n6. Simulación de Pasarela Stripe e Integración de Checkout\n7. Panel de Administración Seguro y CRUD Completo',
                instructor: 'MSc. Mateo Fernández'
            }
        ];
        for (const course of initialCourses) {
            await db.run(`INSERT INTO cursos (titulo, descripcion, precio, imagen_url, temario, instructor)
         VALUES (?, ?, ?, ?, ?, ?)`, [course.titulo, course.descripcion, course.precio, course.imagen_url, course.temario, course.instructor]);
        }
        console.log('Base de datos sembrada correctamente con 3 cursos profesionales.');
    }
}
