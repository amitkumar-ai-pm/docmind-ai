const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function chunkText(text) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunkSize = normalized.length > 500_000 ? 4000 : normalized.length > 100_000 ? 2000 : 1000;
  const overlap = 200;
  const maxChunks = 300;
  const chunks = [];
  let start = 0;

  while (start < normalized.length && chunks.length < maxChunks) {
    let end = Math.min(start + chunkSize, normalized.length);
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '));
      if (breakAt > chunkSize * 0.5) end = start + breakAt + 1;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

(async () => {
  const docs = await p.document.findMany({
    select: { id: true, originalName: true, extractedText: true, _count: { select: { chunks: true } } },
  });

  for (const doc of docs) {
    if (!doc.extractedText.trim()) continue;
    const chunks = chunkText(doc.extractedText);
    await p.documentChunk.deleteMany({ where: { documentId: doc.id } });
    await p.documentChunk.createMany({
      data: chunks.map((content, index) => ({
        documentId: doc.id,
        chunkIndex: index,
        content,
        embedding: '[]',
      })),
    });
    console.log(`Indexed ${chunks.length} chunks for ${doc.originalName}`);
  }

  await p.$disconnect();
})();
