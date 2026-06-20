import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { extractTextFromFile } from '@/lib/document-parser';
import { indexDocument } from '@/lib/rag';
import { storeFile } from '@/lib/storage';
import { extractDocumentMetadata, serializeMetadata } from '@/lib/metadata';
import { createTimer, logMetric } from '@/lib/observability';
import {
  MAX_DOCUMENTS,
  MAX_FILE_SIZE_BYTES,
  isAllowedFile,
} from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uploadTimer = createTimer('upload_total');

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const existingCount = await prisma.document.count({
      where: { userId: user.id },
    });

    if (existingCount + files.length > MAX_DOCUMENTS) {
      return NextResponse.json(
        {
          error: `You can upload up to ${MAX_DOCUMENTS} documents. You currently have ${existingCount}.`,
        },
        { status: 400 }
      );
    }

    const category = (formData.get('category') as string) || 'other';
    const validCategories = ['data-science', 'novel', 'news', 'business', 'legal', 'other'];
    const docCategory = validCategories.includes(category) ? category : 'other';

    const created = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `"${file.name}" exceeds the 20MB size limit` },
          { status: 400 }
        );
      }

      if (!isAllowedFile(file.name, file.type)) {
        return NextResponse.json(
          { error: `"${file.name}" is not a supported file type (PDF, Word, Excel, CSV)` },
          { status: 400 }
        );
      }

      const parseTimer = createTimer('upload_parse', { filename: file.name });
      const buffer = Buffer.from(await file.arrayBuffer());
      const extractedText = await extractTextFromFile(buffer, file.name, file.type);
      parseTimer.end({ textLength: extractedText.length });

      if (!extractedText.trim()) {
        return NextResponse.json(
          { error: `Could not extract text from "${file.name}"` },
          { status: 400 }
        );
      }

      const metaTimer = createTimer('metadata_extract');
      const metadata = await extractDocumentMetadata(
        buffer,
        file.name,
        file.type,
        extractedText,
        docCategory
      );
      metaTimer.end({
        sectionCount: metadata.sectionHeaders.length,
        pageCount: metadata.pageCount,
      });

      const doc = await prisma.document.create({
        data: {
          userId: user.id,
          filename: file.name,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          category: docCategory,
          metadata: serializeMetadata(metadata),
          extractedText,
        },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          category: true,
          createdAt: true,
        },
      });

      try {
        const storagePath = await storeFile(user.id, doc.id, file.name, buffer);
        await prisma.document.update({
          where: { id: doc.id },
          data: { storagePath },
        });

        try {
          const indexTimer = createTimer('upload_index', { documentId: doc.id });
          await indexDocument(doc.id, extractedText);
          indexTimer.end();
        } catch (indexError) {
          console.error('Document indexing failed:', indexError);
          logMetric('upload_index_error', {
            documentId: doc.id,
            error: indexError instanceof Error ? indexError.message : 'unknown',
          });
        }
      } catch (storageError) {
        await prisma.document.delete({ where: { id: doc.id } });
        throw storageError;
      }

      created.push(doc);
    }

    uploadTimer.end({ fileCount: created.length });

    return NextResponse.json({ documents: created }, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    uploadTimer.end({ error: true });
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
