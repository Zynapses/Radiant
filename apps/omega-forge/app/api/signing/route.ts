import { NextRequest, NextResponse } from 'next/server';
import { describeSigningKey, getSigningPublicKeyPem } from '@/lib/kms/signer';

export async function GET() {
  try {
    const keyId = process.env.CARTRIDGE_SIGNING_KEY_ID;
    if (!keyId) {
      return NextResponse.json({ error: 'CARTRIDGE_SIGNING_KEY_ID not configured' }, { status: 500 });
    }

    const keyInfo = await describeSigningKey(keyId);
    const publicKeyPem = await getSigningPublicKeyPem(keyId);

    return NextResponse.json({
      key: keyInfo,
      publicKeyPem,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
