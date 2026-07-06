import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import router from './routes';
import { getDatabase } from './database';

dotenv.config();

const app = express();

// Puerto dedicado para el rol de ESTUDIANTE
const PORT = process.env.PORT_ESTUDIANTE || 3001;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../../frontend')));
app.use(router);

async function startServer() {
  try {
    await getDatabase();
    app.listen(PORT, () => {
      console.log(`==========================================`);
      console.log(` 🎓 PORTAL ESTUDIANTE`);
      console.log(` URL: http://localhost:${PORT}/estudiante`);
      console.log(` Login con: estudiante@antigravity.academy`);
      console.log(`==========================================`);
    });
  } catch (error) {
    console.error('Error al iniciar servidor estudiante:', error);
    process.exit(1);
  }
}

startServer();
