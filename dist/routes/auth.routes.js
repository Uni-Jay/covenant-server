"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, gender, departments } = req.body;
        // Check if user exists
        const [existingUser] = await database_1.default.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Prepare departments JSON
        const departmentsJson = departments && departments.length > 0 ? JSON.stringify(departments) : null;
        // Insert user
        const [result] = await database_1.default.execute('INSERT INTO users (email, password, first_name, last_name, phone, gender, departments) VALUES (?, ?, ?, ?, ?, ?, ?)', [email, hashedPassword, firstName, lastName, phone, gender || null, departmentsJson]);
        // Generate token
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const token = jsonwebtoken_1.default.sign({ id: result.insertId, email, role: 'member' }, jwtSecret, { expiresIn: '7d' });
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: result.insertId,
                email,
                firstName,
                lastName,
                fullName: `${firstName} ${lastName}`,
                phone,
                gender,
                departments: departments || [],
                role: 'member'
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Registration failed' });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user
        const [users] = await database_1.default.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = users[0];
        // Check password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Generate token
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '7d' });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                fullName: `${user.first_name} ${user.last_name}`,
                phone: user.phone,
                address: user.address,
                gender: user.gender,
                role: user.role,
                department: user.department,
                departments: user.departments ? JSON.parse(user.departments) : []
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Login failed' });
    }
});
// Get current user
router.get('/me', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const [users] = await database_1.default.execute('SELECT id, email, first_name, last_name, phone, address, gender, role, department, departments FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = users[0];
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            address: user.address,
            gender: user.gender,
            role: user.role,
            department: user.department,
            departments: user.departments ? JSON.parse(user.departments) : []
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch user' });
    }
});
// Update profile
router.put('/profile', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { firstName, lastName, phone, address, gender, departments } = req.body;
        const userId = req.user.id;
        // Prepare departments JSON
        const departmentsJson = departments && departments.length > 0 ? JSON.stringify(departments) : null;
        // Update user
        await database_1.default.execute('UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ?, gender = ?, departments = ? WHERE id = ?', [firstName, lastName, phone || null, address || null, gender || null, departmentsJson, userId]);
        // Fetch updated user
        const [users] = await database_1.default.execute('SELECT id, email, first_name, last_name, phone, address, gender, role, department, departments FROM users WHERE id = ?', [userId]);
        const user = users[0];
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                fullName: `${user.first_name} ${user.last_name}`,
                phone: user.phone,
                address: user.address,
                gender: user.gender,
                role: user.role,
                department: user.department,
                departments: user.departments ? JSON.parse(user.departments) : []
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
});
exports.default = router;
