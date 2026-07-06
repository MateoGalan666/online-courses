const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
(async () => {
  const db = await open({ filename: 'backend/courses.db', driver: sqlite3.Database });
  const cols = await db.all("PRAGMA table_info(lecciones)");
  const names = cols.map(c => c.name);
  if (!names.includes('contenido_html')) {
    await db.run("ALTER TABLE lecciones ADD COLUMN contenido_html TEXT DEFAULT ''");
    console.log('Columna contenido_html agregada');
  } else {
    console.log('Columna ya existe');
  }
  await db.close();
})();