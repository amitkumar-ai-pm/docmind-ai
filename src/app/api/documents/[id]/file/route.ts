import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { readStoredFile } from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const document = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      originalName: true,
      mimeType: true,
      storagePath: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (!document.storagePath) {
    return NextResponse.json({ error: 'Original file not available' }, { status: 404 });
  }

  try {
    const buffer = await readStoredFile(document.storagePath);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const headers: Record<string, string> = {
      'Content-Type': document.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.originalName)}"`,
      'Cache-Control': 'private, max-age=3600',
    };

    if (search && document.mimeType === 'application/pdf') {
      headers['Content-Disposition'] =
        `inline; filename="${encodeURIComponent(document.originalName)}"`;
    }

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error('File read failed:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
