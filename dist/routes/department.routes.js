"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Get all departments
router.get('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const [departments] = await database_1.default.query(`
      SELECT DISTINCT department as name
      FROM user_departments
      WHERE department IS NOT NULL AND department != ''
      ORDER BY department ASC
    `);
        res.json({
            departments: departments.map((d) => ({ name: d.name }))
        });
    }
    catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ message: 'Failed to fetch departments', error: error.message });
    }
});
exports.default = router;
