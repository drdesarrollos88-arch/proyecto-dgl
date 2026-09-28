import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import {
  getReglasAprendidas,
  saveReglaAprendida,
  incrementarReglaAprendida,
  toggleEstadoReglaAprendida,
  deleteReglaAprendida,
} from '@/lib/db';
import { getCasosHistoricosRAG } from '@/lib/rag-service';
import { EstadoReglaAprendida, TipoReglaAprendida, OrigenReglaAprendida } from '@/lib/types';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado') as EstadoReglaAprendida | null;
    const tipo = searchParams.get('tipo') as TipoReglaAprendida | null;

    const reglas = getReglasAprendidas({
      estado: estado || undefined,
      tipo: tipo || undefined,
    });

    const todas = getReglasAprendidas();
    const casosRAG = getCasosHistoricosRAG();

    const stats = {
      total: todas.length,
      activas: todas.filter((r) => r.estado === 'activo').length,
      pendientes: todas.filter((r) => r.estado === 'pendiente_revision').length,
      descartadas: todas.filter((r) => r.estado === 'descartado').length,
      totalConfirmaciones: todas.reduce((acc, r) => acc + (r.conteoConfirmaciones || 0), 0),
      totalCasosRAG: casosRAG.length,
    };

    return NextResponse.json({
      success: true,
      reglas,
      stats,
    });
  } catch (err) {
    console.error('Error al obtener feedback/reglas aprendidas:', err);
    return NextResponse.json(
      { error: 'Error interno al consultar las reglas aprendidas.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { terminoUsuario, codigoEnsayo, origen, observacionSugerida } = body;

    if (!terminoUsuario || typeof terminoUsuario !== 'string' || !terminoUsuario.trim()) {
      return NextResponse.json(
        { error: 'El término del usuario es obligatorio.' },
        { status: 400 }
      );
    }

    const regla = incrementarReglaAprendida(
      terminoUsuario.trim(),
      codigoEnsayo ? String(codigoEnsayo).trim() : undefined,
      (origen as OrigenReglaAprendida) || 'buscador_ensayos',
      observacionSugerida ? String(observacionSugerida).trim() : undefined
    );

    return NextResponse.json({
      success: true,
      regla,
    });
  } catch (err) {
    console.error('Error al registrar feedback/regla aprendida:', err);
    return NextResponse.json(
      { error: 'Error al registrar el aprendizaje en el sistema.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Verificar permiso de administración
  const canAdmin = hasPermission(user, 'configuracion.formato') || user.role === 'admin';
  if (!canAdmin) {
    return NextResponse.json(
      { error: 'No tienes permisos para modificar reglas de aprendizaje.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, estado, terminoUsuario, codigoEnsayo, observacionSugerida } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de regla requerido.' },
        { status: 400 }
      );
    }

    if (estado) {
      const updated = toggleEstadoReglaAprendida(id, estado as EstadoReglaAprendida);
      if (!updated) {
        return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ success: true, regla: updated });
    }

    // Actualización completa
    const saved = saveReglaAprendida({
      id,
      terminoUsuario: terminoUsuario || '',
      codigoEnsayo,
      observacionSugerida,
    });

    return NextResponse.json({ success: true, regla: saved });
  } catch (err) {
    console.error('Error al actualizar regla aprendida:', err);
    return NextResponse.json(
      { error: 'Error al actualizar la regla.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const canAdmin = hasPermission(user, 'configuracion.formato') || user.role === 'admin';
  if (!canAdmin) {
    return NextResponse.json(
      { error: 'No tienes permisos para eliminar reglas de aprendizaje.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de regla no proporcionado.' }, { status: 400 });
    }

    const deleted = deleteReglaAprendida(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Regla eliminada exitosamente.' });
  } catch (err) {
    console.error('Error al eliminar regla aprendida:', err);
    return NextResponse.json(
      { error: 'Error al eliminar la regla.' },
      { status: 500 }
    );
  }
}
