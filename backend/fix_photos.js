const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPhotosAndGender() {
    console.log('Starting photo and gender fix...');
    const employees = await prisma.employee.findMany();
    let updatedCount = 0;

    for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];

        // Simple gender detection logic
        // We check if lastName ends with 'а' (typical for female surnames in RU)
        // or if the name ends with 'а' / 'я' (though some male names do too, like Nikita, but we don't have those in the list)
        // Looking at the list: Алишер, Ахмад, Мурат, Иван, Михаил - all male.

        let isMale = true;
        const lastName = (emp.lastName || '').toLowerCase();
        const firstName = (emp.firstName || '').toLowerCase();

        if (lastName.endsWith('ва') || lastName.endsWith('ова') || lastName.endsWith('ева') || lastName.endsWith('ина')) {
            isMale = false;
        }

        // Overrides for common names if needed
        if (firstName.endsWith('а') && !['илья', 'никита', 'данила', 'савва', 'ахмад'].includes(firstName)) {
            // but wait, 'Ахмад' is male. 'Александр' is male.
            // Let's stick mostly to lastName for RU names or specific check.
        }

        const gender = isMale ? 'Мужской' : 'Женский';
        const num = (i % 99);
        const newPhoto = isMale
            ? `https://randomuser.me/api/portraits/men/${num}.jpg`
            : `https://randomuser.me/api/portraits/women/${num}.jpg`;

        await prisma.employee.update({
            where: { id: emp.id },
            data: {
                gender: gender,
                photo: newPhoto
            }
        });

        updatedCount++;
        console.log(`Updated ${emp.firstName} ${emp.lastName} -> ${gender}`);
    }

    console.log(`Successfully updated ${updatedCount} employees.`);
    process.exit(0);
}

fixPhotosAndGender().catch(err => {
    console.error(err);
    process.exit(1);
});
