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

  const dateObj = new Date(date);

  try {
    const data = await prisma.todo.findMany({
      where: {
        userId: session.user.id,
        NOT: { excludeDates: { has: dateObj } },
        OR: [
          { date },
          { repeatingDays: { has: dateObj.getDay() } },
          { repeatingDates: { has: dateObj.getDate() } },
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
                      { repeatingStart: { gte: dateObj } },
                      { repeatingEnd: { lte: dateObj } },
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
        scheduleStart: {
          select: {
            id: true,
            time: true,
            startTodo: true,
            endTodo: true,
            rank: true,
          },
        },
        scheduleEnd: {
          select: {
            id: true,
            time: true,
            startTodo: true,
            endTodo: true,
            rank: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Failed to fetch todos', { status: 500 });
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
    const data = await prisma.todo.create({
      data: {
        ...reqData,
        userId: session.user.id,
      },
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    console.error(error);
    return new Response('Failed to create todo', { status: 500 });
  }
}
