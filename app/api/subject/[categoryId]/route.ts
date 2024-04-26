import { prisma } from '@/prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const GET = async (
  req: NextRequest,
  { params }: { params: { categoryId: string } }
) => {
  const categoryId = params.categoryId;

  const post = await prisma.subject.findMany({
    where: {
      categoryId,
    },
  });

  return NextResponse.json({ post });
};
