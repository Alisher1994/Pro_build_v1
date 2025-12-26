const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const fs = require('fs');
const logFile = 'integ_log.txt';
function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
}

async function main() {
    fs.writeFileSync(logFile, '');
    log('Checking staff integrity...');

    const employees = await prisma.employee.findMany({
        include: {
            position: true,
            department: true
        }
    });

    const positions = await prisma.position.findMany({
        include: {
            department: true,
            employees: true
        }
    });

    const departments = await prisma.department.findMany({
        include: {
            employees: true,
            positions: true
        }
    });

    log(`Total Employees: ${employees.length}`);
    log(`Total Positions: ${positions.length}`);
    log(`Total Departments: ${departments.length}`);

    log('\n--- Checking Employee Department vs Position Department Mismatch ---');
    let mismatches = 0;
    employees.forEach(e => {
        if (e.position && e.departmentId !== e.position.departmentId) {
            log(`[MISMATCH] Emp: ${e.lastName} (ID: ${e.id})`);
            log(`  - Linked Dept: ${e.department?.name} (ID: ${e.departmentId})`);
            log(`  - Position: ${e.position.name} (ID: ${e.positionId}) -> Belongs to Dept: ${e.position.department?.name} (ID: ${e.position.departmentId})`);
            mismatches++;
        }
    });

    if (mismatches === 0) {
        log('No mismatches found between Employee Department and Position Department.');
    } else {
        log(`Found ${mismatches} mismatches.`);
    }

    log('\n--- Department Counts Verification ---');
    departments.forEach(d => {
        const empCount = employees.filter(e => e.departmentId === d.id).length;
        const posEmpCount = positions.filter(p => p.departmentId === d.id).reduce((acc, p) => acc + p.employees.length, 0);

        log(`[DEPT] ${d.name} (ID: ${d.id})`);
        log(`  - Direct Employees (by departmentId): ${empCount}`);
        log(`  - Employees via Positions (by position.departmentId): ${posEmpCount}`);
        if (empCount !== posEmpCount) {
            log('  -> DISCREPANCY!');
        }
    });

    log('\n--- Position Counts Verification for OTiTB ---');
    const otitb = departments.find(d => d.name.includes('ОТиТБ'));
    if (otitb) {
        const titlePos = positions.filter(p => p.departmentId === otitb.id);
        titlePos.forEach(p => {
            log(`[POS] ${p.name} (ID: ${p.id}) HEAD: ${p.isHead} -> Count: ${p.employees.length}`);
        });
    }

}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
