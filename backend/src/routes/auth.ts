import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-probim';

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const loginInput = email; // Frontend sends 'email' field, but it can be phone now

        if (!loginInput || !password) {
            return res.status(400).json({ error: 'Введите Email/Телефон и пароль' });
        }

        const employee = await prisma.employee.findFirst({
            where: {
                OR: [
                    { email: loginInput.toLowerCase().trim() },
                    { phone: loginInput.trim() },
                    // Try matching formatted phone just in case (e.g. if spaces/formatting differ)
                    { phone: loginInput.replace(/[^\d+]/g, '') }
                ]
            },
            include: {
                position: true,
                department: true,
                project: true
            }
        });

        if (!employee) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const isMatch = await bcrypt.compare(password, employee.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: employee.id,
                email: employee.email,
                role: employee.position.name,
                isHead: employee.isHead
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Remove password from local object
        const { password: _, ...employeeData } = employee;

        res.json({
            token,
            user: employeeData
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/login-subcontractor', async (req, res) => {
    try {
        const { inn, password } = req.body;

        if (!inn || !password) {
            return res.status(400).json({ error: 'Введите ИНН и пароль' });
        }

        const subcontractor = await prisma.subcontractor.findUnique({
            where: { inn: inn.trim() }
        });

        if (!subcontractor) {
            return res.status(401).json({ error: 'Неверный ИНН или пароль' });
        }

        const isMatch = await bcrypt.compare(password, subcontractor.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неверный ИНН или пароль' });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: subcontractor.id,
                inn: subcontractor.inn,
                role: 'subcontractor'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Remove password from local object
        const { password: _, ...subData } = subcontractor;

        res.json({
            token,
            user: { ...subData, role: 'subcontractor' }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Verify token route
router.get('/verify', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);

        if (decoded.role === 'subcontractor') {
            const subcontractor = await prisma.subcontractor.findUnique({
                where: { id: decoded.id }
            });
            if (!subcontractor) return res.status(401).json({ error: 'User not found' });
            const { password: _, ...subData } = subcontractor;
            return res.json({ user: { ...subData, role: 'subcontractor' } });
        } else {
            const employee = await prisma.employee.findUnique({
                where: { id: decoded.id },
                include: {
                    position: true,
                    department: true,
                    project: true
                }
            });

            if (!employee) return res.status(401).json({ error: 'User not found' });

            const { password: _, ...employeeData } = employee;
            res.json({ user: employeeData });
        }
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;
