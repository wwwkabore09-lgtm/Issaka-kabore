import { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES, LAUNCH_COUNTRY } from '@finza/config';

const prisma = new PrismaClient();

// Utilisateur de démo pour tester les domaines Accounts/Transactions manuellement tant que
// le domaine auth (JWT, création de compte) n'existe pas.
async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@finza.test' },
    update: {},
    create: { email: 'demo@finza.test', fullName: 'Utilisateur démo' },
  });

  console.log(`Utilisateur démo prêt : ${user.id} (${user.email})`);

  // Catégories système (userId null), partagées par tous les utilisateurs, seedées depuis
  // packages/config pour le pays de lancement. L'utilisateur peut créer les siennes en plus.
  // Un index unique (userId, key) ne peut pas servir de sélecteur `where` pour upsert quand
  // userId est null (contrainte Prisma sur les clés composées nullables) : on fait donc un
  // findFirst + create/update explicite.
  for (const category of DEFAULT_CATEGORIES[LAUNCH_COUNTRY]) {
    const existing = await prisma.category.findFirst({
      where: { userId: null, key: category.key },
    });

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { label: category.label, kind: category.kind },
      });
    } else {
      await prisma.category.create({
        data: { userId: null, key: category.key, label: category.label, kind: category.kind },
      });
    }
  }

  console.log(`${DEFAULT_CATEGORIES[LAUNCH_COUNTRY].length} catégories système seedées pour ${LAUNCH_COUNTRY}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
