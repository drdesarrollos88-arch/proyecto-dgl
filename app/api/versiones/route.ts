import { NextResponse } from 'next/server';
import { getHistorialVersiones, getVersionActual } from '@/lib/versiones';

export async function GET() {
  try {
    const versiones = getHistorialVersiones();
    const actual = getVersionActual();
    return NextResponse.json({
      versiones,
      actual,
    });
  } catch (error) {
    console.error('Error fetching version history:', error);
    return NextResponse.json(
      { error: 'Error al obtener el historial de versiones' },
      { status: 500 }
    );
  }
}

