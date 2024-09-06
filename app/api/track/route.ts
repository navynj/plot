import { auth } from '@/lib/auth';
import { prisma } from '@/prisma/client';
import { getDashDate } from '@/util/date';
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
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!date && !(startDate && endDate)) {
    return new Response('Date query is empty', {
      status: 400,
    });
  }

  try {
    const data = await prisma.track.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { date: date || '' },
          {
            AND: [
              {
                date: {
                  gte: (startDate && new Date(startDate).toISOString()) || undefined,
                },
              },
              {
                date: { lte: (endDate && new Date(endDate).toISOString()) || undefined },
              },
            ],
          },
        ],
      },
      include: {
        profile: true,
        album: true,
        scheduleStart: {
          select: {
            id: true,
            time: true,
            startTrack: true,
            endTrack: true,
            rank: true,
          },
        },
        scheduleEnd: {
          select: {
            id: true,
            time: true,
            startTrack: true,
            endTrack: true,
            rank: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Failed to fetch tracks', { status: 500 });
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
    const data = await prisma.track.create({
      data: {
        ...reqData,
        userId: session.user.id,
      },
    });

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    console.error(error);
    return new Response('Failed to create track', { status: 500 });
  }
}
