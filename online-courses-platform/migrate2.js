const s = require('sqlite3');
const { open } = require('sqlite');
(async () => {
  const db = await open({ filename: 'backend/courses.db', driver: s.Database });
  
  // Create curso_profesor table
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
  
  // Assign profesor@antigravity.academy (id=2) to curso "Github Git" (id=4)
  const prof = await db.get("SELECT id FROM usuarios WHERE email = 'profesor@antigravity.academy'");
  if (prof) {
    await db.run("INSERT OR IGNORE INTO curso_profesor (curso_id, profesor_id) VALUES (4, ?)", [prof.id]);
    console.log('Profesor asignado al curso GitHub');
  }
  
  console.log('Migración completada');
  await db.close();
})();