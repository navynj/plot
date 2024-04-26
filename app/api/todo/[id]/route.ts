import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/client';

export const GET = async (req: NextRequest, { params }: { params: { id: string } }) => {
  const id = params.id;

  const post = await prisma.todo.findUnique({
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
  const { isDone } = await req.json();

  await prisma.todo.update({
    where: {
      id: id,
    },
    data: {
      isDone,
    },
  });
  return NextResponse.json({ message: 'Updated' }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  await prisma.todo.delete({
    where: {
      id: id,
    },
  });
  return NextResponse.json({ message: 'Deleted Item' }, { status: 200 });
}
