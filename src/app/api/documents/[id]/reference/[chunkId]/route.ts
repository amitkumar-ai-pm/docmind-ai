import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { buildReferenceLines } from '@/lib/text-offsets';
import { recordCitationClick } from '@/lib/observability';

export async function GET(
  _request: Request,
  { params }: { params: { id: string; chunkId: string } }
) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const chunk = await prisma.documentChunk.findFirst({
    where: {
      id: params.chunkId,
      documentId: params.id,
      document: { userId: user.id },
    },
    select: {
      id: true,
      content: true,
      sectionTitle: true,
      startOffset: true,
      endOffset: true,
      lineStart: true,
      lineEnd: true,
      document: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          extractedText: true,
        },
      },
    },
  });

  if (!chunk) {
    return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
  }

  recordCitationClick(params.id, params.chunkId);

  const fullText = chunk.document.extractedText.replace(/\r\n/g, '\n').replace(/\f/g, '\n\n').trim();
  const lines = buildReferenceLines(
    fullText,
    chunk.startOffset,
    chunk.endOffset,
    30
  );

  const searchSnippet = chunk.content
    .replace(/^\[[^\]]+\]\n/, '')
    .trim()
    .slice(0, 80)
    .replace(/\s+/g, ' ');

  const fileUrl = `/api/documents/${chunk.document.id}/file`;
  const fileUrlWithSearch =
    chunk.document.mimeType === 'application/pdf' && searchSnippet
      ? `${fileUrl}?search=${encodeURIComponent(searchSnippet)}`
      : fileUrl;

  return NextResponse.json({
    document: {
      id: chunk.document.id,
      originalName: chunk.document.originalName,
      mimeType: chunk.document.mimeType,
    },
    chunk: {
      id: chunk.id,
      content: chunk.content,
      sectionTitle: chunk.sectionTitle,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
    },
    lines,
    fileUrl,
    fileUrlWithSearch,
    searchSnippet,
  });
}
