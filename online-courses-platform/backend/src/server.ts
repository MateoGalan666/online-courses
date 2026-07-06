import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import router from './routes';
import { getDatabase } from './database';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para decodificar JSON y URL Encoded en las peticiones
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos del frontend (imágenes, CSS, JS compilados)
// Usamos process.cwd() para asegurar que funcione correctamente en Vercel
app.use(express.static(path.join(process.cwd(), 'frontend')));

// Registrar las rutas de la API y del enrutamiento de vistas
app.use(router);

// Función para arrancar la base de datos y el servidor
async function startServer() {
  try {
    console.log('Iniciando base de datos SQLite...');
    await getDatabase();
    
    if (process.env.VERCEL !== '1') {
      app.listen(PORT, () => {
        console.log(`=================================================`);
        console.log(` Antigravity Academy - Servidor Activo `);
        console.log(` Servidor corriendo en: http://localhost:${PORT} `);
        console.log(`=================================================`);
      });
    }
  } catch (error) {
    console.error('Error crítico al iniciar el servidor:', error);
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
  }
}

startServer();

export default app;
