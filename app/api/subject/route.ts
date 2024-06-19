import { auth } from '@/lib/auth';
import { prisma } from '@/prisma/client';

export async function GET(req: Request) {
  const session = await auth();

  if (!session) {
    return new Response('Session not found', {
      status: 401,
    });
  }

  try {
    const data = await prisma.subject.findMany({
      where: { userId: session.user.id },
      include: {
        category: true,
      },
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    return new Response('Failed to fetch', { status: 500 });
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
    const data = await prisma.subject.create({
      data: {
        ...reqData,
        userId: session.user.id,
      },
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    console.error(error);
    return new Response('Failed to create subject', { status: 500 });
  }
}
