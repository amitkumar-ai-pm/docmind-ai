import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getSuggestionsForUser } from '@/lib/suggestions';

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const suggestions = await getSuggestionsForUser(user.id);
  return NextResponse.json({ suggestions });
}
