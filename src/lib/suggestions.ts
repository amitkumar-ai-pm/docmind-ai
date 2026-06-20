import { prisma } from './prisma';

interface SuggestionInput {
  documents: { id: string; originalName: string; category: string }[];
  conversations: { title: string }[];
}

export function generateSuggestions(input: SuggestionInput): string[] {
  const suggestions: string[] = [];
  const { documents, conversations } = input;

  if (documents.length > 0) {
    const latest = documents[0];
    const shortName = latest.originalName.replace(/\.[^.]+$/, '').slice(0, 40);
    suggestions.push(`What are the main topics in "${shortName}"?`);
    suggestions.push(`Summarize "${shortName}" in 3 bullet points`);

    if (latest.category === 'data-science') {
      suggestions.push('What libraries or tools are mentioned?');
    } else if (latest.category === 'novel') {
      suggestions.push('Who are the main characters?');
    } else if (latest.category === 'news') {
      suggestions.push('What are the key headlines or events?');
    }
  }

  if (conversations.length > 0) {
    const recent = conversations[0].title;
    if (!suggestions.includes(recent)) {
      suggestions.push(`Follow up on: ${recent.slice(0, 50)}`);
    }
  }

  if (documents.length > 1) {
    suggestions.push('Compare themes across my uploaded documents');
  }

  const defaults = [
    'What is this document about?',
    'List the most important points',
    'Are there any action items or recommendations?',
  ];

  for (const d of defaults) {
    if (suggestions.length >= 6) break;
    if (!suggestions.includes(d)) suggestions.push(d);
  }

  return suggestions.slice(0, 6);
}

export async function getSuggestionsForUser(userId: string): Promise<string[]> {
  const [documents, conversations] = await Promise.all([
    prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, originalName: true, category: true },
    }),
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { title: true },
    }),
  ]);

  return generateSuggestions({ documents, conversations });
}
