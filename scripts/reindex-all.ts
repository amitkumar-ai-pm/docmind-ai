/**
 * Reindex all documents using the app's RAG pipeline (chunk v5 + embeddings).
 * Usage: npx tsx scripts/reindex-all.ts
 */
import { PrismaClient } from '@prisma/client';
import { CURRENT_CHUNK_VERSION } from '../src/lib/chunking';
import { indexDocument } from '../src/lib/rag';

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany({
    select: { id: true, originalName: true, extractedText: true },
  });

  if (docs.length === 0) {
    console.log('No documents found.');
    await prisma.$disconnect();
    return;
  }

  let reindexed = 0;
  let totalChunks = 0;

  for (const doc of docs) {
    if (!doc.extractedText.trim()) {
      console.log(`Skipped (empty text): ${doc.originalName}`);
      continue;
    }

    await indexDocument(doc.id, doc.extractedText);
    const count = await prisma.documentChunk.count({ where: { documentId: doc.id } });
    const version = await prisma.document.findUnique({
      where: { id: doc.id },
      select: { chunkVersion: true },
    });

    reindexed++;
    totalChunks += count;
    console.log(
      `Reindexed ${count} chunks (v${version?.chunkVersion ?? CURRENT_CHUNK_VERSION}): ${doc.originalName}`
    );
  }

  console.log(`\nDone: ${reindexed}/${docs.length} documents, ${totalChunks} total chunks`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Reindex failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
