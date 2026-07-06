import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import router from './routes';
import { getDatabase } from './database';

dotenv.config();

const app = express();

// Puerto dedicado para el rol de PROFESOR
const PORT = process.env.PORT_PROFESOR || 3002;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../../frontend')));
app.use(router);

async function startServer() {
  try {
    await getDatabase();
    app.listen(PORT, () => {
      console.log(`==========================================`);
      console.log(` 👨‍🏫 PORTAL PROFESOR`);
      console.log(` URL: http://localhost:${PORT}/Profesor`);
      console.log(` Login con: profesor@antigravity.academy`);
      console.log(`==========================================`);
    });
  } catch (error) {
    console.error('Error al iniciar servidor profesor:', error);
    process.exit(1);
  }
}

startServer();
