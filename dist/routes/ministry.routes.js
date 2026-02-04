"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const [ministries] = await database_1.default.execute('SELECT * FROM ministries ORDER BY name');
        res.json(ministries);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch ministries' });
    }
});
exports.default = router;
