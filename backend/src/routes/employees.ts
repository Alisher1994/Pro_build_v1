import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const list = await prisma.employee.findMany({
            include: {
                department: true,
                position: true,
                project: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(list);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const body = req.body;

        // Simple validation
        if (!body.lastName || !body.firstName || !body.phone || !body.positionId || !body.departmentId || !body.projectId || !body.password) {
            return res.status(400).json({ error: 'Заполните обязательные поля: Фамилия, Имя, Телефон, Пароль, Отдел, Должность, Объект' });
        }

        // Fetch position & project to validate
        const [position, project] = await Promise.all([
            prisma.position.findUnique({ where: { id: body.positionId } }),
            prisma.project.findUnique({ where: { id: body.projectId } })
        ]);

        if (!position) return res.status(400).json({ error: 'Должность не найдена' });
        if (!project) return res.status(400).json({ error: 'Объект не найден' });

        const isRP_ZRP = position.name === 'РП (Руководитель проекта)' || position.name === 'ЗРП (Зам. руководителя проекта)';

        // 1. Restriction: No RP/ZRP in "Главный офис"
        if (isRP_ZRP && project.name === 'Главный офис') {
            return res.status(400).json({ error: 'В Главный офис нельзя назначать РП или ЗРП' });
        }

        // 2. Logic check: Only 1 RP and 1 ZRP per site project
        if (isRP_ZRP) {
            const existing = await prisma.employee.findFirst({
                where: {
                    projectId: body.projectId,
                    positionId: body.positionId
                }
            });
            if (existing) {
                return res.status(400).json({ error: `На этом проекте уже назначен ${position.name}` });
            }
        }

        // 3. Logic check: Only 1 Head per Department per Project
        if (position.isHead && !isRP_ZRP) {
            const existingHead = await prisma.employee.findFirst({
                where: {
                    projectId: body.projectId,
                    departmentId: body.departmentId,
                    isHead: true,
                    // Exclude RP/ZRP from this check as they are "project heads" not "dept heads" usually, 
                    // but we check them separately above.
                    position: {
                        NOT: {
                            name: { in: ['РП (Руководитель проекта)', 'ЗРП (Зам. руководителя проекта)'] }
                        }
                    }
                }
            });
            if (existingHead) {
                return res.status(400).json({ error: 'В этом отделе на данном объекте уже есть руководитель' });
            }
        }

        const data: any = {
            lastName: body.lastName,
            firstName: body.firstName,
            middleName: body.middleName || null,
            photo: body.photo || null,
            phone: body.phone,
            corporatePhone: body.corporatePhone || null,
            password: await bcrypt.hash(body.password, 10),
            email: body.email || null,
            positionId: body.positionId,
            departmentId: body.departmentId,
            projectId: body.projectId,
            education: body.education || null,
            isHead: position.isHead,
            status: body.status || 'active',
            score: Number(body.score) || 0,
            gender: body.gender || null,
            pinfl: body.pinfl || null,
            passportSeries: body.passportSeries || null,
            passportNumber: body.passportNumber || null,
            passportIssuedBy: body.passportIssuedBy || null,
            nationality: body.nationality || null
        };

        if (body.hireDate) data.hireDate = new Date(body.hireDate);
        if (body.terminationDate) data.terminationDate = new Date(body.terminationDate);
        if (body.passportIssueDate) data.passportIssueDate = new Date(body.passportIssueDate);
        if (body.passportExpiryDate) data.passportExpiryDate = new Date(body.passportExpiryDate);

        const created = await prisma.employee.create({ data });
        res.status(201).json(created);
    } catch (error: any) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Email уже используется' });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;

        const data: any = {};
        const fields = [
            'lastName', 'firstName', 'middleName', 'photo', 'phone', 'corporatePhone',
            'password', 'email', 'positionId', 'departmentId', 'projectId',
            'status', 'score', 'gender', 'pinfl', 'passportSeries', 'passportNumber',
            'passportIssuedBy', 'nationality'
        ];

        const dateFields = ['hireDate', 'terminationDate', 'passportIssueDate', 'passportExpiryDate'];
        for (const f of dateFields) {
            if (body[f] !== undefined) {
                data[f] = body[f] ? new Date(body[f]) : null;
            }
        }

        for (const f of fields) {
            if (body[f] !== undefined) {
                if (f === 'score') {
                    data[f] = Number(body[f]);
                } else if (f === 'password' && body[f]) {
                    data[f] = await bcrypt.hash(body[f], 10);
                } else {
                    data[f] = body[f] === '' ? null : body[f];
                }
            }
        }

        // If positionId or projectId is changed, check RP/ZRP & Head uniqueness
        if (body.positionId || body.projectId) {
            const currentEmp = await prisma.employee.findUnique({
                where: { id },
                include: { project: true, position: true }
            });
            const targetPosId = body.positionId || currentEmp?.positionId;
            const targetProjId = body.projectId || currentEmp?.projectId;

            if (targetPosId && targetProjId) {
                const [targetPos, targetProj] = await Promise.all([
                    prisma.position.findUnique({ where: { id: targetPosId } }),
                    prisma.project.findUnique({ where: { id: targetProjId } })
                ]);

                if (targetPos && targetProj) {
                    const isRP_ZRP = targetPos.name === 'РП (Руководитель проекта)' || targetPos.name === 'ЗРП (Зам. руководителя проекта)';

                    // 1. Restriction: No RP/ZRP in "Главный офис"
                    if (isRP_ZRP && targetProj.name === 'Главный офис') {
                        return res.status(400).json({ error: 'В Главный офис нельзя назначать РП или ЗРП' });
                    }

                    // 2. Logic check: RP/ZRP uniqueness
                    if (isRP_ZRP) {
                        const existing = await prisma.employee.findFirst({
                            where: {
                                projectId: targetProjId,
                                positionId: targetPosId,
                                NOT: { id }
                            }
                        });
                        if (existing) {
                            return res.status(400).json({ error: `На этом проекте уже назначен ${targetPos.name}` });
                        }
                    }

                    // 3. Logic check: Dept Head uniqueness
                    if (targetPos.isHead && !isRP_ZRP) {
                        const targetDeptId = body.departmentId || currentEmp?.departmentId;
                        const existingHead = await prisma.employee.findFirst({
                            where: {
                                projectId: targetProjId,
                                departmentId: targetDeptId,
                                isHead: true,
                                NOT: [
                                    { id },
                                    { position: { name: { in: ['РП (Руководитель проекта)', 'ЗРП (Зам. руководителя проекта)'] } } }
                                ]
                            }
                        });
                        if (existingHead) {
                            return res.status(400).json({ error: 'В этом отделе на данном объекте уже есть руководитель' });
                        }
                    }

                    data.isHead = targetPos.isHead;
                }
            }
        }

        if (body.hireDate !== undefined) data.hireDate = body.hireDate ? new Date(body.hireDate) : null;
        if (body.terminationDate !== undefined) data.terminationDate = body.terminationDate ? new Date(body.terminationDate) : null;

        const updated = await prisma.employee.update({
            where: { id },
            data,
            include: { department: true, position: true, project: true }
        });
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.employee.delete({ where: { id } });
        res.json({ message: 'Deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
