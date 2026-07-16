import { NextResponse } from 'next/server';

import { countNodes } from '@/repository/health';

export async function GET(): Promise<NextResponse> {
  try {
    const nodeCount = await countNodes();
    return NextResponse.json({ ok: true, nodeCount });
  } catch (error) {
    console.error('health check failed', error);
    return NextResponse.json({ ok: false, error: 'database unreachable' }, { status: 500 });
  }
}
