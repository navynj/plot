import { prisma } from '@/prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const GET = async (req: NextRequest, { params }: { params: { id: string } }) => {
  const id = params.id;

  const post = await prisma.subject.findUnique({
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

  await prisma.subject.update({
    where: {
      id: id,
    },
    data,
  });
  return NextResponse.json({ message: 'Subject updated: ' + id }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  await prisma.subject.delete({
    where: {
      id: id,
    },
  });
  return NextResponse.json({ message: 'Subject Deleted: ' + id }, { status: 200 });
}
