import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { askAboutDocuments, generateConversationTitle } from '@/lib/ai';
import { createTimer } from '@/lib/observability';
import { MAX_CONVERSATIONS } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const chatTimer = createTimer('chat_api');

  try {
    const { question, conversationId, documentId, category } = await request.json();

    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), { status: 400 });
    }

    let scopedCategory: string | null = category ?? null;

    if (documentId) {
      const doc = await prisma.document.findFirst({
        where: { id: documentId, userId: user.id },
      });
      if (!doc) {
        return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404 });
      }
      scopedCategory = doc.category;
    }

    const documentCount = await prisma.document.count({ where: { userId: user.id } });
    if (documentCount === 0) {
      return new Response(
        JSON.stringify({ error: 'Please upload at least one document before asking questions' }),
        { status: 400 }
      );
    }

    let conversation;

    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: { role: true, content: true },
          },
        },
      });

      if (!conversation) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: generateConversationTitle(question),
          documentId: documentId || null,
        },
        include: { messages: true },
      });

      pruneOldConversations(user.id).catch(console.error);
    }

    const history = conversation.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const scopedDocId = documentId || conversation.documentId;

    const { answer, citations } = await askAboutDocuments(
      user.id,
      question,
      history,
      scopedDocId,
      scopedCategory
    );

    await prisma.$transaction([
      prisma.message.create({
        data: { conversationId: conversation.id, role: 'user', content: question },
      }),
      prisma.message.create({
        data: { conversationId: conversation.id, role: 'assistant', content: answer },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    chatTimer.end({
      conversationId: conversation.id,
      documentScoped: Boolean(scopedDocId),
      citationCount: citations.length,
    });

    return new Response(
      JSON.stringify({ conversationId: conversation.id, answer, citations }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chat error:', error);
    chatTimer.end({ error: true });
    const message = error instanceof Error ? error.message : 'Failed to process question';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

async function pruneOldConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  if (conversations.length > MAX_CONVERSATIONS) {
    const toDelete = conversations.slice(MAX_CONVERSATIONS).map((c) => c.id);
    await prisma.conversation.deleteMany({ where: { id: { in: toDelete } } });
  }
}
