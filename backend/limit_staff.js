const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function limitStaff() {
    console.log('Starting staff limitation (max 4 per department)...');

    const departments = await prisma.department.findMany({
        include: { employees: true }
    });

    let totalDeleted = 0;

    for (const dept of departments) {
        if (dept.employees.length > 4) {
            console.log(`Department "${dept.name}" has ${dept.employees.length} employees. Keeping only 4.`);

            // Sort to keep "heads" if possible, or just keep first 4
            const employeesToKeep = dept.employees
                .sort((a, b) => (b.isHead ? 1 : 0) - (a.isHead ? 1 : 0)) // Heads first
                .slice(0, 4);

            const keepIds = employeesToKeep.map(e => e.id);
            const excessEmployees = dept.employees.filter(e => !keepIds.includes(e.id));

            for (const emp of excessEmployees) {
                await prisma.employee.delete({ where: { id: emp.id } });
                totalDeleted++;
            }
            console.log(`Deleted ${excessEmployees.length} excess employees from "${dept.name}".`);
        } else {
            console.log(`Department "${dept.name}" has ${dept.employees.length} employees. No action needed.`);
        }
    }

    console.log(`Cleanup finished. Total deleted: ${totalDeleted} employees.`);
    process.exit(0);
}

limitStaff().catch(err => {
    console.error(err);
    process.exit(1);
});
