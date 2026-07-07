const express = require('express');
const path = require('path');

// En Vercel, __dirname es /var/task/api/, entonces subimos un nivel para llegar a la raíz
const appRoot = path.resolve(__dirname, '..');
const frontendPath = path.join(appRoot, 'frontend');

// Cargar la app del backend
const backendApp = require(path.join(appRoot, 'backend', 'dist', 'server.js')).default;

// Crear una nueva app de Express para Vercel
const app = express();

// Servir archivos estáticos del frontend
app.use(express.static(frontendPath));

// Pasar todas las rutas al backend
app.use(backendApp);

// Exportar para Vercel
module.exports = app;