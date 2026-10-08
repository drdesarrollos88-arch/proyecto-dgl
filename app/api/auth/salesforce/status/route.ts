import { NextResponse } from 'next/server';
import { getSalesforceStatus } from '@/lib/salesforce/salesforce-client';

export async function GET() {
  try {
    const status = await getSalesforceStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err?.message }, { status: 500 });
  }
}

