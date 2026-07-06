import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import router from './routes';
import { getDatabase } from './database';

dotenv.config();

const app = express();

// Puerto dedicado para el rol de ADMIN
const PORT = process.env.PORT_ADMIN || 3003;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../../frontend')));
app.use(router);

async function startServer() {
  try {
    await getDatabase();
    app.listen(PORT, () => {
      console.log(`==========================================`);
      console.log(` 🔐 PORTAL ADMINISTRADOR`);
      console.log(` URL: http://localhost:${PORT}/admin`);
      console.log(` Login con: admin@antigravity.academy`);
      console.log(`==========================================`);
    });
  } catch (error) {
    console.error('Error al iniciar servidor admin:', error);
    process.exit(1);
  }
}

startServer();
