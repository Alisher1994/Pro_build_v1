const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Fixing staff integrity...');

    const employees = await prisma.employee.findMany({
        include: {
            position: true
        }
    });

    let fixedCount = 0;

    for (const e of employees) {
        if (e.position && e.departmentId !== e.position.departmentId) {
            console.log(`Fixing Emp: ${e.lastName} (Current Dept: ${e.departmentId} -> New Dept: ${e.position.departmentId})`);

            await prisma.employee.update({
                where: { id: e.id },
                data: {
                    departmentId: e.position.departmentId
                }
            });
            fixedCount++;
        }
    }

    console.log(`Fixed ${fixedCount} employees.`);
}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
