import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Utilisateur de démo pour tester le domaine Accounts manuellement tant que
// le domaine auth (JWT, création de compte) n'existe pas.
async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@finza.test' },
    update: {},
    create: { email: 'demo@finza.test', fullName: 'Utilisateur démo' },
  });

  console.log(`Utilisateur démo prêt : ${user.id} (${user.email})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
