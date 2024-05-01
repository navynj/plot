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

  const date = new Date(dateStr);

  try {
    const data = await prisma.todo.findMany({
      where: {
        userId: session.user.id,
        NOT: { excludeDates: { has: date } },
        OR: [
          { date },
          { repeatingDays: { has: date.getDay() } },
          { repeatingDates: { has: date.getDate() } },
          {
            AND: [
              { isRepeating: true },
              {
                OR: [
                  {
                    AND: [{ repeatingStart: undefined }, { repeatingEnd: undefined }],
                  },
                  {
                    AND: [
                      { repeatingStart: { gte: date } },
                      { repeatingEnd: { lte: date } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      include: {
        subject: true,
      },
      orderBy: { rank: 'asc' },
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    console.log(error);
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

  const { title } = await req.json();
  try {
    const data = await prisma.todo.create({
      data: {
        title,
        userId: session.user.id,
      },
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    return new Response('Failed to create todo', { status: 500 });
  }
}
