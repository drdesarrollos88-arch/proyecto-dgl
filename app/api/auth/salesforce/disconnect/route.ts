import { NextResponse } from 'next/server';
import { disconnectSalesforce } from '@/lib/salesforce/salesforce-client';

export async function POST() {
  try {
    await disconnectSalesforce();
    return NextResponse.json({ success: true, message: 'Sesión de Salesforce desconectada.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error desconectando' }, { status: 500 });
  }
}

