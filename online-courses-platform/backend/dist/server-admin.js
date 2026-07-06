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
// Puerto dedicado para el rol de ADMIN
const PORT = process.env.PORT_ADMIN || 3003;
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(express_1.default.static(path_1.default.join(__dirname, '../../frontend')));
app.use(routes_1.default);
async function startServer() {
    try {
        await (0, database_1.getDatabase)();
        app.listen(PORT, () => {
            console.log(`==========================================`);
            console.log(` 🔐 PORTAL ADMINISTRADOR`);
            console.log(` URL: http://localhost:${PORT}/admin`);
            console.log(` Login con: admin@antigravity.academy`);
            console.log(`==========================================`);
        });
    }
    catch (error) {
        console.error('Error al iniciar servidor admin:', error);
        process.exit(1);
    }
}
startServer();
