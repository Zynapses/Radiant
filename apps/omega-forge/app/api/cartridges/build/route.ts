import { NextRequest, NextResponse } from 'next/server';
import { buildCartridge, CartridgeBuildRequest } from '@/lib/cartridge/builder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CartridgeBuildRequest;

    if (!body.name || !body.version || !body.targets?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: name, version, targets' },
        { status: 400 }
      );
    }

    const result = await buildCartridge(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Cartridge build failed:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
