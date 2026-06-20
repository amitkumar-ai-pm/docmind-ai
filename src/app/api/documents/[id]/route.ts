import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { deleteStoredFile } from '@/lib/storage';
import { UPLOAD_CATEGORIES } from '@/lib/constants';

const VALID_CATEGORIES = new Set(UPLOAD_CATEGORIES.map((c) => c.id));

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = await request.json();

  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const updated = await prisma.document.update({
    where: { id: params.id },
    data: { category },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      category: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ document: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const document = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await deleteStoredFile(document.storagePath);
  await prisma.document.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
