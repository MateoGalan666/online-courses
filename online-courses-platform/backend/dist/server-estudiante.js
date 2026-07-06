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
dotenv_1.default.config();
const app = (0, express_1.default)();
// Puerto dedicado para el rol de ESTUDIANTE
const PORT = process.env.PORT_ESTUDIANTE || 3001;
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(express_1.default.static(path_1.default.join(__dirname, '../../frontend')));
app.use(routes_1.default);
async function startServer() {
    try {
        await (0, database_1.getDatabase)();
        app.listen(PORT, () => {
            console.log(`==========================================`);
            console.log(` 🎓 PORTAL ESTUDIANTE`);
            console.log(` URL: http://localhost:${PORT}/estudiante`);
            console.log(` Login con: estudiante@antigravity.academy`);
            console.log(`==========================================`);
        });
    }
    catch (error) {
        console.error('Error al iniciar servidor estudiante:', error);
        process.exit(1);
    }
}
startServer();
