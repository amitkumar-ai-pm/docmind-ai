import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { MAX_CONVERSATIONS } from '@/lib/constants';

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: MAX_CONVERSATIONS,
    select: {
      id: true,
      title: true,
      documentId: true,
      createdAt: true,
      updatedAt: true,
      document: { select: { originalName: true } },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title } = await request.json();

  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: title || 'New conversation',
    },
  });

  await pruneOldConversations(user.id);

  return NextResponse.json({ conversation }, { status: 201 });
}

async function pruneOldConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  if (conversations.length > MAX_CONVERSATIONS) {
    const toDelete = conversations.slice(MAX_CONVERSATIONS).map((c) => c.id);
    await prisma.conversation.deleteMany({
      where: { id: { in: toDelete } },
    });
  }
}
