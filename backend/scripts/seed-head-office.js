const { PrismaClient } = require('../node_modules/@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const exists = await prisma.project.findFirst({ where: { name: 'Главный офис' } });
    if (!exists) {
      await prisma.project.create({
        data: {
          name: 'Главный офис',
          isDeletable: false,
          description: 'Центральный офис компании',
          status: 'active',
        },
      });
      console.log('Главный офис создан');
    } else {
      console.log('Главный офис уже существует');
    }
  } catch (err) {
    console.error('Ошибка при создании главного офиса:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
