import { auth } from '@/lib/auth';
import { prisma } from '@/prisma/client';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return new Response('Session not found', {
      status: 401,
    });
  }

  const searchParams = req.nextUrl.searchParams;
  const date = searchParams.get('date');

  if (!date) {
    return new Response('Date query is empty', {
      status: 400,
    });
  }

  try {
    const data = await prisma.todo.findMany({
      where: { userId: session.user.id, date: new Date(date) },
      orderBy: { createdAt: 'asc' },
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    return new Response('Failed to fetch', { status: 500 });
  }
}
