"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = __importDefault(require("./routes"));
const database_1 = require("./database");
// Cargar variables de entorno desde el archivo .env
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware para decodificar JSON y URL Encoded en las peticiones
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Servir archivos estáticos del frontend (imágenes, CSS, JS compilados)
// Usamos process.cwd() para asegurar que funcione correctamente en Vercel
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'frontend')));
// Registrar las rutas de la API y del enrutamiento de vistas
app.use(routes_1.default);
// Función para arrancar la base de datos y el servidor
async function startServer() {
    try {
        console.log('Iniciando base de datos SQLite...');
        await (0, database_1.getDatabase)();
        if (process.env.VERCEL !== '1') {
            app.listen(PORT, () => {
                console.log(`=================================================`);
                console.log(` Antigravity Academy - Servidor Activo `);
                console.log(` Servidor corriendo en: http://localhost:${PORT} `);
                console.log(`=================================================`);
            });
        }
    }
    catch (error) {
        console.error('Error crítico al iniciar el servidor:', error);
        if (process.env.VERCEL !== '1') {
            process.exit(1);
        }
    }
}
startServer();
exports.default = app;
