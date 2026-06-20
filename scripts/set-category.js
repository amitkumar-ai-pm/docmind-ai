const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.document.updateMany({ data: { category: 'data-science' } })
  .then((r) => { console.log('updated', r.count); })
  .finally(() => p.$disconnect());
