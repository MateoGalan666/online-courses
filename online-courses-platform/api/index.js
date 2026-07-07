const express = require('express');
const path = require('path');

// En Vercel Serverless: __dirname = /var/task/api/
// La raíz del proyecto está un nivel arriba
const projectRoot = path.resolve(__dirname, '..');

// 1) Importar la app del backend
const backendApp = require(path.join(projectRoot, 'backend', 'dist', 'server.js')).default;

// 2) Crear una app de Express para Vercel
const app = express();

// 3) Servir archivos estáticos desde la carpeta frontend
//    (HTML, CSS, imágenes, JS compilado en dist/)
const frontendDir = path.join(projectRoot, 'frontend');
app.use(express.static(frontendDir));

// 4) Pasar todas las demás rutas al backend (que tiene las rutas de la API
//    y también las rutas de las vistas HTML)
app.use(backendApp);

// 5) Fallback: si nada coincide, intentar servir el index.html
app.use((req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// 6) Exportar para Vercel
module.exports = app;