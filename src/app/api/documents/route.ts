import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  const where =
    category && category !== 'all'
      ? { userId: user.id, category }
      : { userId: user.id };

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      category: true,
      createdAt: true,
    },
  });

  const counts = await prisma.document.groupBy({
    by: ['category'],
    where: { userId: user.id },
    _count: { id: true },
  });

  return NextResponse.json({ documents, counts });
}
