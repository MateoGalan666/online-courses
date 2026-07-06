const s = require('sqlite3');
const { open } = require('sqlite');
(async () => {
  const db = await open({ filename: 'backend/courses.db', driver: s.Database });

  // Add clave_acceso column
  const cols = await db.all("PRAGMA table_info(cursos)");
  const names = cols.map(c => c.name);
  if (!names.includes('clave_acceso')) {
    await db.run("ALTER TABLE cursos ADD COLUMN clave_acceso TEXT DEFAULT 'acceso123'");
    console.log('Columna clave_acceso agregada');
  }

  await db.close();
})();