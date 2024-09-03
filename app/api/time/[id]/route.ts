import { prisma } from '@/prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const GET = async (req: NextRequest, { params }: { params: { id: string } }) => {
  const id = params.id;

  const post = await prisma.track.findUnique({
    where: {
      id,
    },
  });

  return NextResponse.json({ post });
};

export async function PATCH(
  req: NextRequest,
  { params: { id } }: { params: { id: string } }
) {
  const data = await req.json();

  await prisma.time.update({
    where: {
      id 
    },
    data,
  });

  const result = await prisma.time.findUnique({
    where: { 
      id 
    }
  });

  return NextResponse.json(JSON.stringify(result), { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  await prisma.time.delete({
    where: {
      id: id,
    },
  });
  return NextResponse.json({ message: 'Time Deleted: ' + id }, { status: 200 });
}
