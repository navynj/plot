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
    const data = await prisma.category.findMany({
      where: { userId: session.user.id },
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    return new Response('Failed to fetch', { status: 500 });
  }
}
