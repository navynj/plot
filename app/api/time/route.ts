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
  const dateStr = searchParams.get('date');

  if (!dateStr) {
    return new Response('Date query is empty', {
      status: 400,
    });
  }

  try {
    const data = await prisma.time.findMany({
      where: {
        userId: session.user.id,
        date: dateStr,
      },
      include: {
        startTodo: {
          select: { id: true, icon: true, title: true, isDone: true, subject: true },
        },
        endTodo: {
          select: { id: true, icon: true, title: true, isDone: true, subject: true },
        },
      },
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
    });

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Failed to fetch times', { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session) {
    return new Response('Session not found', {
      status: 401,
    });
  }

  const reqData = await req.json();
  try {
    const data = await prisma.time.create({
      data: {
        ...reqData,
        userId: session.user.id,
      },
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    console.error(error);
    return new Response('Failed to create time', { status: 500 });
  }
}
