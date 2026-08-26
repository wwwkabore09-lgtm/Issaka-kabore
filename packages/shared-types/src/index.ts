// Types et DTOs partagés entre apps/api et apps/web.
// Un fichier par domaine métier (accounts.ts, transactions.ts, ...) est ajouté
// au fur et à mesure de l'implémentation de chaque module, jamais tous en une fois.

export * from './accounts';
export * from './budgets';
export * from './categories';
export * from './debts';
export * from './families';
export * from './goals';
export * from './reports';
export * from './subscriptions';
export * from './transactions';
