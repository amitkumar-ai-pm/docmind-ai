const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const docs = await p.document.findMany({
    select: {
      originalName: true,
      size: true,
      extractedText: true,
      _count: { select: { chunks: true } },
    },
  });
  for (const d of docs) {
    console.log('---');
    console.log('name:', d.originalName);
    console.log('size:', d.size);
    console.log('textLen:', d.extractedText?.length ?? 0);
    console.log('chunks:', d._count.chunks);
    console.log('preview:', JSON.stringify(d.extractedText?.slice(0, 300)));
  }
  await p.$disconnect();
})();
