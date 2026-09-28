'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { User, SessionUser, UserProfile, PermissionKey } from '@/lib/types';
import {
  PERMISSION_DEFINITIONS,
  PermissionDefinition,
  computeEffectivePermissions,
  hasPermission,
} from '@/lib/permissions';
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  CreditCard,
  User as UserIcon,
  CheckSquare,
  Square,
  Edit2,
  Plus,
  Layers,
  ChevronRight,
  Info,
  Sliders,
  HelpCircle,
  Save,
  Check,
  X,
  Search,
  Sparkles,
} from 'lucide-react';

function UsuariosContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Pestañas principales: 'configurar' | 'crear' | 'perfiles'
  const [activeTab, setActiveTab] = useState<'configurar' | 'crear' | 'perfiles'>('configurar');

  // Estados de datos
  const [users, setUsers] = useState<Omit<User, 'passwordHash'>[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados de filtros y búsqueda
  const [userSearch, setUserSearch] = useState('');

  // ==================== ESTADOS PARA CONFIGURACIÓN DE PERMISOS ====================
  // Usuario actualmente seleccionado para configurar sus permisos con checkboxes
  const [permConfigUser, setPermConfigUser] = useState<Omit<User, 'passwordHash'> | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // ==================== ESTADOS PARA EDITAR DATOS BÁSICOS ====================
  const [editingBasicUser, setEditingBasicUser] = useState<Omit<User, 'passwordHash'> | null>(null);
  const [editUserFormData, setEditUserFormData] = useState({
    name: '',
    email: '',
    role: 'comercial' as 'admin' | 'comercial',
    profileId: 'comercial_senior',
    password: '',
  });

  // ==================== ESTADOS PARA CREAR USUARIO ====================
  const [createUserData, setCreateUserData] = useState({
    rut: '',
    name: '',
    email: '',
    password: '',
    role: 'comercial' as 'admin' | 'comercial',
    profileId: 'comercial_senior',
  });
  const [createPermissions, setCreatePermissions] = useState<PermissionKey[]>([]);

  // ==================== ESTADOS PARA PERFILES ====================
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [profileFormData, setProfileFormData] = useState<{
    id?: string;
    name: string;
    description: string;
    permissions: PermissionKey[];
  }>({
    name: '',
    description: '',
    permissions: [],
  });

  // Notificaciones y loaders
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Cargar datos iniciales
  const loadData = async () => {
    setLoading(true);
    try {
      const [meRes, usersRes, profilesRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/users'),
        fetch('/api/profiles'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.user) setCurrentUser(meData.user);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData?.users) setUsers(usersData.users);
      }

      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        if (profilesData?.profiles) setProfiles(profilesData.profiles);
      }
    } catch (err) {
      console.error('Error al cargar datos de usuarios y perfiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Leer parámetros de URL para activar la pestaña correspondiente
  useEffect(() => {
    const tab = searchParams.get('tab');
    const action = searchParams.get('action');

    if (tab === 'crear' || action === 'new') {
      setActiveTab('crear');
    } else if (tab === 'perfiles') {
      setActiveTab('perfiles');
    } else if (tab === 'configurar') {
      setActiveTab('configurar');
    }
  }, [searchParams]);

  // Mapa de perfiles por ID para renderizado rápido
  const profileMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    profiles.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [profiles]);

  // Permisos agrupados por módulo
  const permissionsByModule = useMemo(() => {
    const map: Record<string, PermissionDefinition[]> = {};
    PERMISSION_DEFINITIONS.forEach((p) => {
      if (!map[p.module]) map[p.module] = [];
      map[p.module].push(p);
    });
    return map;
  }, []);

  // Inicializar permisos de creación según perfil base seleccionado
  useEffect(() => {
    if (profiles.length > 0) {
      const targetProf = profiles.find((p) => p.id === createUserData.profileId);
      if (targetProf && createPermissions.length === 0) {
        setCreatePermissions([...targetProf.permissions]);
      }
    }
  }, [profiles, createUserData.profileId]);

  // Filtrar lista de usuarios por búsqueda
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.rut.toLowerCase().includes(q) ||
        (profileMap[u.profileId || '']?.name || '').toLowerCase().includes(q)
    );
  }, [users, userSearch, profileMap]);

  // Conteo de usuarios por perfil
  const usersCountByProfile = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach((u) => {
      const pId = u.profileId || (u.role === 'admin' ? 'admin' : 'comercial_senior');
      map[pId] = (map[pId] || 0) + 1;
    });
    return map;
  }, [users]);

  // ==================== GESTIÓN DE CONFIGURACIÓN DE PERMISOS (CHECKBOXES) ====================

  // Abrir modal de configuración de permisos para un usuario específico
  const handleOpenConfigurePermissions = (user: Omit<User, 'passwordHash'>) => {
    setPermConfigUser(user);
    // Si tiene permisos personalizados explícitos, usar esos. Si no, calcular los permisos efectivos de su perfil.
    const effective = computeEffectivePermissions(user, profiles);
    setSelectedPermissions(
      user.customPermissions && user.customPermissions.length > 0
        ? [...user.customPermissions]
        : [...effective]
    );
    setError(null);
  };

  // Alternar una casilla de verificación individual
  const handleToggleUserPermission = (key: PermissionKey) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // Alternar todos los permisos de un módulo para el usuario
  const handleToggleModuleForUser = (moduleName: string, selectAll: boolean) => {
    const moduleKeys = (permissionsByModule[moduleName] || []).map((p) => p.key);
    setSelectedPermissions((prev) => {
      let updated = [...prev];
      if (selectAll) {
        moduleKeys.forEach((k) => {
          if (!updated.includes(k)) updated.push(k);
        });
      } else {
        updated = updated.filter((k) => !moduleKeys.includes(k));
      }
      return updated;
    });
  };

  // Cargar permisos desde una plantilla de perfil
  const handleLoadTemplateProfile = (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId);
    if (target) {
      setSelectedPermissions([...target.permissions]);
    }
  };

  // Guardar los permisos del usuario configurado
  const handleSaveUserPermissions = async () => {
    if (!permConfigUser) return;

    setSavingPermissions(true);
    setError(null);

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: permConfigUser.id,
          customPermissions: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar los permisos del usuario.');
      }

      setSuccess(`Permisos de "${permConfigUser.name}" actualizados exitosamente (${selectedPermissions.length} de ${PERMISSION_DEFINITIONS.length} activos).`);
      setPermConfigUser(null);
      loadData();
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorText);
    } finally {
      setSavingPermissions(false);
    }
  };

  // ==================== CREACIÓN DE USUARIO CON CHECKBOXES ====================

  const handleToggleCreatePermission = (key: PermissionKey) => {
    setCreatePermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleCreateModule = (moduleName: string, selectAll: boolean) => {
    const moduleKeys = (permissionsByModule[moduleName] || []).map((p) => p.key);
    setCreatePermissions((prev) => {
      let updated = [...prev];
      if (selectAll) {
        moduleKeys.forEach((k) => {
          if (!updated.includes(k)) updated.push(k);
        });
      } else {
        updated = updated.filter((k) => !moduleKeys.includes(k));
      }
      return updated;
    });
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createUserData,
          customPermissions: createPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar el usuario.');
      }

      setSuccess(`Usuario ${createUserData.name} creado exitosamente con sus permisos asignados.`);
      setCreateUserData({
        rut: '',
        name: '',
        email: '',
        password: '',
        role: 'comercial',
        profileId: 'comercial_senior',
      });
      setCreatePermissions([]);
      setActiveTab('configurar');
      loadData();
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorText);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== EDICIÓN BÁSICA DE USUARIO ====================

  const handleOpenEditBasicUser = (u: Omit<User, 'passwordHash'>) => {
    setEditingBasicUser(u);
    setEditUserFormData({
      name: u.name,
      email: u.email,
      role: u.role,
      profileId: u.profileId || (u.role === 'admin' ? 'admin' : 'comercial_senior'),
      password: '',
    });
    setError(null);
  };

  const handleSaveEditBasicUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBasicUser) return;
    setError(null);
    setSubmitting(true);

    try {
      const payload: Record<string, any> = {
        id: editingBasicUser.id,
        name: editUserFormData.name,
        email: editUserFormData.email,
        role: editUserFormData.role,
        profileId: editUserFormData.profileId,
      };

      if (editUserFormData.password && editUserFormData.password.trim().length >= 6) {
        payload.password = editUserFormData.password.trim();
      }

      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el usuario.');
      }

      setSuccess(`Datos de ${editUserFormData.name} actualizados exitosamente.`);
      setEditingBasicUser(null);
      loadData();
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorText);
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de revocar el acceso y eliminar permanentemente a ${name}?`)) return;

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Error al eliminar usuario.');
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
      setSuccess(`Usuario ${name} eliminado del sistema.`);
    } catch {
      alert('Error de conexión con el servidor.');
    }
  };

  // ==================== GESTIÓN DE PERFILES BASE ====================

  const handleOpenCreateProfile = () => {
    setEditingProfile(null);
    setProfileFormData({
      name: '',
      description: '',
      permissions: [
        'cotizador.ver',
        'cotizador.descargar_borrador',
        'tarifario.ver',
        'clientes.gestionar',
      ],
    });
    setError(null);
    setShowProfileModal(true);
  };

  const handleOpenEditProfile = (profile: UserProfile) => {
    setEditingProfile(profile);
    setProfileFormData({
      id: profile.id,
      name: profile.name,
      description: profile.description || '',
      permissions: [...profile.permissions],
    });
    setError(null);
    setShowProfileModal(true);
  };

  const toggleProfilePermission = (key: PermissionKey) => {
    setProfileFormData((prev) => {
      const exists = prev.permissions.includes(key);
      const updated = exists
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key];
      return { ...prev, permissions: updated };
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileFormData.name.trim()) {
      setError('El nombre del perfil es obligatorio.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileFormData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el perfil.');
      }

      setSuccess(
        editingProfile
          ? `Perfil "${profileFormData.name}" actualizado correctamente.`
          : `Nuevo perfil "${profileFormData.name}" creado con éxito.`
      );
      setShowProfileModal(false);
      loadData();
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorText);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProfile = async (profile: UserProfile) => {
    if (profile.isSystem) {
      alert('Los perfiles predeterminados del sistema no pueden ser eliminados.');
      return;
    }

    const assignedCount = usersCountByProfile[profile.id] || 0;
    if (assignedCount > 0) {
      alert(`No es posible eliminar este perfil porque está asignado a ${assignedCount} usuario(s). Reasigna los usuarios primero.`);
      return;
    }

    if (!confirm(`¿Está seguro de eliminar el perfil "${profile.name}"?`)) return;

    try {
      const res = await fetch(`/api/profiles?id=${profile.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al eliminar el perfil.');
        return;
      }
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      setSuccess(`Perfil "${profile.name}" eliminado del sistema.`);
    } catch {
      alert('Error de conexión con el servidor.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Header Principal */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Control de Usuarios y Permisos (RBAC)
              </h1>
              <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-200 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                Seguridad IDIEM
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Administración de personal, creación de cuentas y configuración de permisos mediante casillas de verificación.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('crear')}
              className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Nuevo Usuario</span>
            </button>
          </div>
        </div>

        {/* Notificaciones globales */}
        {success && (
          <div className="mb-6 p-4 rounded-xl flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{success}</span>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="text-xs text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl flex items-center justify-between bg-red-50 border border-red-200 text-red-800 text-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-700 hover:text-red-950 underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* BARRA DE PESTAÑAS: CONFIGURAR USUARIOS | CREAR USUARIOS | PERFILES */}
        {/* ======================================================== */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('configurar')}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'configurar'
                ? 'border-purple-700 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-600" />
            <span>Configurar Usuarios ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('crear')}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'crear'
                ? 'border-purple-700 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <UserPlus className="w-4 h-4 text-purple-600" />
            <span>Crear Usuarios</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('perfiles')}
            className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'perfiles'
                ? 'border-purple-700 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Perfiles Base ({profiles.length})</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* PESTAÑA 1: CONFIGURAR USUARIOS (LISTA CON CHECKBOXES) */}
        {/* ======================================================== */}
        {activeTab === 'configurar' && (
          <div className="space-y-4">
            {/* Buscador y Resumen */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, correo, RUT o perfil..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>
                  Mostrando <strong className="text-slate-800">{filteredUsers.length}</strong> usuarios
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-[11px] bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg font-medium">
                  Usa &quot;Configurar Permisos&quot; para asignar casillas por usuario
                </span>
              </div>
            </div>

            {/* Tabla de Usuarios */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-32">RUT</th>
                      <th className="py-3.5 px-4">Usuario</th>
                      <th className="py-3.5 px-4">Correo Electrónico</th>
                      <th className="py-3.5 px-4">Perfil Base</th>
                      <th className="py-3.5 px-4 w-48 text-center">Permisos Asignados</th>
                      <th className="py-3.5 px-4 w-28 text-center">Rol</th>
                      <th className="py-3.5 px-4 w-44 text-center">Configuración</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                            <span>Cargando usuarios y permisos...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                          No se encontraron usuarios que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelf = currentUser?.id === u.id;
                        const assignedProfile = profileMap[u.profileId || (u.role === 'admin' ? 'admin' : 'comercial_senior')];
                        const effectivePerms = computeEffectivePermissions(u, profiles);
                        const totalPerms = PERMISSION_DEFINITIONS.length;
                        const activePermsCount = effectivePerms.length;

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* RUT */}
                            <td className="py-3.5 px-4 font-mono font-medium text-xs text-slate-600">
                              {u.rut}
                            </td>

                            {/* Nombre */}
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{u.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                                    Tú
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Email */}
                            <td className="py-3.5 px-4 text-slate-600 text-xs font-mono">{u.email}</td>

                            {/* Perfil Base */}
                            <td className="py-3.5 px-4">
                              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {assignedProfile?.name || 'Comercial Estándar'}
                              </span>
                            </td>

                            {/* Permisos Asignados */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-bold text-xs text-purple-900 font-mono">
                                  {activePermsCount} de {totalPerms} permisos
                                </span>
                                <div className="w-28 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      activePermsCount === totalPerms
                                        ? 'bg-emerald-500'
                                        : activePermsCount > 5
                                        ? 'bg-purple-600'
                                        : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${(activePermsCount / totalPerms) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Rol */}
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  u.role === 'admin'
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {u.role === 'admin' ? 'Admin' : 'Comercial'}
                              </span>
                            </td>

                            {/* Acciones */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfigurePermissions(u)}
                                  title="Configurar casillas de verificación de permisos"
                                  className="flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Permisos</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditBasicUser(u)}
                                  title="Editar datos básicos (Nombre, Correo, Clave)"
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u.id, u.name)}
                                    title="Eliminar usuario"
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 2: CREAR USUARIOS (FORMULARIO CON CHECKBOXES) */}
        {/* ======================================================== */}
        {activeTab === 'crear' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-700" />
                <span>Registrar Nuevo Usuario y Asignar Permisos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Ingresa las credenciales institucionales y marca las casillas de verificación para autorizar sus permisos específicos.
              </p>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-6">
              {/* Datos de Acceso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    RUT del Usuario *
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="12.345.678-9"
                      value={createUserData.rut}
                      onChange={(e) => setCreateUserData({ ...createUserData, rut: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nombre Completo *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="ej. Carlos Muñoz Rodríguez"
                      value={createUserData.name}
                      onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Correo Electrónico Institucional *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="carlos.munoz@idiem.cl"
                      value={createUserData.email}
                      onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Contraseña Inicial *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={createUserData.password}
                      onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Rol Base *
                  </label>
                  <select
                    value={createUserData.role}
                    onChange={(e) =>
                      setCreateUserData({
                        ...createUserData,
                        role: e.target.value as 'admin' | 'comercial',
                      })
                    }
                    className="w-full p-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                  >
                    <option value="comercial">Comercial (Personal de Cotizaciones / Laboratorio)</option>
                    <option value="admin">Administrador (Control Total del Sistema)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Plantilla de Perfil Base
                  </label>
                  <select
                    value={createUserData.profileId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const targetProf = profiles.find((p) => p.id === selId);
                      setCreateUserData({ ...createUserData, profileId: selId });
                      if (targetProf) {
                        setCreatePermissions([...targetProf.permissions]);
                      }
                    }}
                    className="w-full p-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.permissions.length} permisos sugeridos)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sección de Casillas de Verificación para Asignar Permisos */}
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-purple-700" />
                      <span>Asignación de Permisos del Usuario</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Marca o desmarca las casillas de verificación según los módulos que este usuario podrá operar.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCreatePermissions(PERMISSION_DEFINITIONS.map((p) => p.key))
                      }
                      className="text-xs text-purple-700 hover:underline font-semibold cursor-pointer"
                    >
                      Marcar Todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setCreatePermissions([])}
                      className="text-xs text-slate-500 hover:underline font-semibold cursor-pointer"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                {/* Lista de Módulos con Checkboxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(permissionsByModule).map(([moduleName, perms]) => {
                    const allChecked = perms.every((p) => createPermissions.includes(p.key));

                    return (
                      <div
                        key={moduleName}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
                      >
                        <div className="bg-slate-100 px-3.5 py-2 flex items-center justify-between border-b border-slate-200">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            {moduleName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleCreateModule(moduleName, !allChecked)}
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                          >
                            {allChecked ? 'Desmarcar' : 'Marcar Todos'}
                          </button>
                        </div>

                        <div className="p-3 space-y-2.5 divide-y divide-slate-100">
                          {perms.map((p) => {
                            const checked = createPermissions.includes(p.key);

                            return (
                              <label
                                key={p.key}
                                className={`flex items-start gap-2.5 pt-2 first:pt-0 cursor-pointer select-none rounded-lg p-1.5 transition-colors ${
                                  checked ? 'bg-purple-50/70' : 'hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleCreatePermission(p.key)}
                                  className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                    <span>{p.label}</span>
                                    <span className="font-mono text-[9px] text-slate-400 font-normal">
                                      {p.key}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                    {p.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botones de Guardado */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('configurar')}
                  className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{submitting ? 'Registrando...' : 'Registrar Nuevo Usuario'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 3: PERFILES BASE (PLANTILLAS RBAC) */}
        {/* ======================================================== */}
        {activeTab === 'perfiles' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Perfiles Base del Sistema</h2>
                <p className="text-xs text-slate-500">
                  Plantillas predeterminadas de permisos para asignación rápida a nuevos usuarios.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateProfile}
                className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Perfil Plantilla</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((profile) => {
                const isSystem = profile.isSystem;
                const assignedCount = usersCountByProfile[profile.id] || 0;
                const totalPermsCount = PERMISSION_DEFINITIONS.length;
                const activePermsCount = profile.permissions.length;

                return (
                  <div
                    key={profile.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-purple-300 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-base text-slate-900 tracking-tight">
                          {profile.name}
                        </h3>
                        {isSystem ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            Sistema
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            Personalizado
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mb-4 min-h-[36px] leading-relaxed">
                        {profile.description || 'Sin descripción detallada.'}
                      </p>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4 space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-medium">Permisos Habilitados:</span>
                          <span className="font-bold text-slate-900 font-mono">
                            {activePermsCount} de {totalPermsCount}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              activePermsCount === totalPermsCount ? 'bg-emerald-500' : 'bg-purple-600'
                            }`}
                            style={{ width: `${(activePermsCount / totalPermsCount) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                          <span>Usuarios con esta plantilla:</span>
                          <span className="font-bold text-purple-700">
                            {assignedCount} {assignedCount === 1 ? 'usuario' : 'usuarios'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditProfile(profile)}
                        className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar Plantilla</span>
                      </button>

                      {!isSystem && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProfile(profile)}
                          className="text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Eliminar perfil personalizado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL PRINCIPAL: CONFIGURAR PERMISOS (CHECKBOXES) */}
      {/* ======================================================== */}
      {permConfigUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Header del Modal */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Configurar Permisos: {permConfigUser.name}</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded font-mono">
                      {permConfigUser.rut}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {permConfigUser.email} • Rol: {permConfigUser.role === 'admin' ? 'Administrador' : 'Comercial'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPermConfigUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Acciones Rápidas y Plantillas */}
            <div className="bg-purple-50/70 border-b border-purple-100 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-purple-900">Plantilla Base:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleLoadTemplateProfile(e.target.value);
                  }}
                  defaultValue=""
                  className="bg-white border border-purple-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 font-medium cursor-pointer"
                >
                  <option value="" disabled>
                    Copiar plantilla de perfil...
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.permissions.length} permisos)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-600 font-semibold">
                  <strong className="text-purple-900 font-mono text-sm">{selectedPermissions.length}</strong> de{' '}
                  {PERMISSION_DEFINITIONS.length} casillas activas
                </span>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedPermissions(PERMISSION_DEFINITIONS.map((p) => p.key))}
                  className="text-purple-700 hover:underline font-bold cursor-pointer"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPermissions([])}
                  className="text-slate-500 hover:underline font-medium cursor-pointer"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {/* Lista con Casillas de Verificación (Checkboxes) por Módulo */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {Object.entries(permissionsByModule).map(([moduleName, perms]) => {
                const allModuleChecked = perms.every((p) => selectedPermissions.includes(p.key));

                return (
                  <div
                    key={moduleName}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs"
                  >
                    {/* Header del Módulo */}
                    <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {moduleName}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded font-mono">
                          {perms.filter((p) => selectedPermissions.includes(p.key)).length} / {perms.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleModuleForUser(moduleName, !allModuleChecked)}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                      >
                        {allModuleChecked ? 'Desmarcar Módulo' : 'Marcar Todo'}
                      </button>
                    </div>

                    {/* Casillas de verificación del módulo */}
                    <div className="p-3 space-y-2 divide-y divide-slate-100">
                      {perms.map((p) => {
                        const checked = selectedPermissions.includes(p.key);

                        return (
                          <label
                            key={p.key}
                            className={`flex items-start gap-3 pt-2 first:pt-0 cursor-pointer select-none rounded-lg p-2 transition-colors ${
                              checked ? 'bg-purple-50/80 border border-purple-200/80' : 'hover:bg-slate-50 border border-transparent'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleUserPermission(p.key)}
                              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                                <span className={checked ? 'text-purple-950' : 'text-slate-800'}>
                                  {p.label}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 font-normal">
                                  {p.key}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                {p.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer de Acciones */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Los cambios aplican inmediatamente al rol y sesión del usuario.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPermConfigUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingPermissions}
                  onClick={handleSaveUserPermissions}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {savingPermissions ? 'Guardando...' : `Guardar Permisos (${selectedPermissions.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL EDICIÓN DE DATOS BÁSICOS */}
      {/* ======================================================== */}
      {editingBasicUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Editar Datos de Usuario</h3>
                <p className="text-xs text-slate-500 font-mono">{editingBasicUser.rut}</p>
              </div>
              <button
                onClick={() => setEditingBasicUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditBasicUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editUserFormData.name}
                  onChange={(e) => setEditUserFormData({ ...editUserFormData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={editUserFormData.email}
                  onChange={(e) => setEditUserFormData({ ...editUserFormData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Rol Base
                </label>
                <select
                  value={editUserFormData.role}
                  onChange={(e) =>
                    setEditUserFormData({
                      ...editUserFormData,
                      role: e.target.value as 'admin' | 'comercial',
                    })
                  }
                  className="w-full p-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                >
                  <option value="comercial">Comercial</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nueva Contraseña (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="Dejar en blanco para mantener la actual"
                  value={editUserFormData.password}
                  onChange={(e) => setEditUserFormData({ ...editUserFormData, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingBasicUser(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg text-sm shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL PERFIL PLANTILLA */}
      {/* ======================================================== */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProfile ? `Editar Perfil: ${editingProfile.name}` : 'Crear Nuevo Perfil Plantilla'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configura el nombre y los permisos predeterminados de esta plantilla.
                </p>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nombre del Perfil *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Comercial sin Descargas"
                    value={profileFormData.name}
                    onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Descripción / Propósito
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Permite cotizar pero sin descarga de tarifarios"
                    value={profileFormData.description}
                    onChange={(e) => setProfileFormData({ ...profileFormData, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {Object.entries(permissionsByModule).map(([moduleName, perms]) => (
                  <div key={moduleName} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 text-xs font-bold text-slate-800 uppercase">
                      {moduleName}
                    </div>
                    <div className="p-3 space-y-2">
                      {perms.map((p) => {
                        const isChecked = profileFormData.permissions.includes(p.key);
                        return (
                          <label key={p.key} className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleProfilePermission(p.key)}
                              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-800">{p.label}</div>
                              <p className="text-[11px] text-slate-500">{p.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg text-sm shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Guardando...' : editingProfile ? 'Actualizar Perfil' : 'Crear Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
          Cargando administración de usuarios y permisos...
        </div>
      }
    >
      <UsuariosContent />
    </Suspense>
  );
}
