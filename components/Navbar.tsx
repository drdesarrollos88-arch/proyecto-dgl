'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { SessionUser, EconomicIndicators } from '@/lib/types';
import { isAdminRole } from '@/lib/permissions';
import ProfileModal from '@/components/ProfileModal';
import FormatoModal from '@/components/FormatoModal';
import {
  Calculator,
  TableProperties,
  FolderArchive,
  Users,
  LogOut,
  TrendingUp,
  ChevronDown,
  Download,
  Upload,
  PlusCircle,
  Eye,
  Building2,
  FileText,
  UserPlus,
  Edit2,
  Settings,
  FolderTree,
  Briefcase,
  UserCheck,
  Plus,
  Sparkles,
  Sliders,
  CheckSquare,
  Hash,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [indicators, setIndicators] = useState<EconomicIndicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFormatoModal, setShowFormatoModal] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch indicators
    fetch('/api/indicadores')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setIndicators(data);
      })
      .catch(() => {});

    // Click outside handler
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleMouseEnter = (menuKey: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setActiveDropdown(menuKey);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 160);
  };

  const handleDropdownClick = (menuKey: string) => {
    setActiveDropdown((prev) => (prev === menuKey ? null : menuKey));
  };

  const isCotizacionActive = pathname.startsWith('/cotizador') || pathname.startsWith('/cotizaciones');
  const isTarifarioActive = pathname.startsWith('/tarifario');
  const isClientesActive = pathname.startsWith('/clientes');
  const isConfigActive = pathname.startsWith('/usuarios') || pathname.startsWith('/configuracion') || showFormatoModal;

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40">
      {/* Top Banner strip */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            SISTEMA OFICIAL DGL
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-400 text-[11px]">
            Acreditación INN LE-304 & División Geotecnia Laboratorio
          </span>
        </div>

        {indicators && (
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-amber-300 font-medium">
              <TrendingUp className="w-3 h-3" />
              UF: ${indicators.uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="hidden md:inline text-slate-400">
              Dólar: ${indicators.dolar.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Brand Logo & Name -> Links to /cotizaciones (Dashboard Home) */}
          <div className="flex items-center gap-3">
            <Link href="/cotizaciones" title="Inicio / Resumen Comercial" className="flex items-center gap-3 group">
              <div className="relative h-10 flex items-center">
                <Image
                  src="/logo_125.png"
                  alt="IDIEM 125 Años"
                  width={130}
                  height={50}
                  priority
                  unoptimized
                  className="object-contain max-h-10 w-auto drop-shadow-xs group-hover:scale-102 transition-transform"
                />
              </div>
              <div className="h-7 w-[1px] bg-slate-200 hidden sm:block"></div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-sm leading-tight tracking-tight group-hover:text-red-700 transition-colors">
                  Laboratorio Geotécnico DGL
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Tarifario & Cotizaciones Oficiales
                </span>
              </div>
            </Link>
          </div>

          {/* Nav Menus (Hover & Click Dropdowns) */}
          <nav className="hidden md:flex items-center space-x-1">
            {/* 1. Cotización Menu */}
            <div
              className="relative nav-dropdown-container"
              onMouseEnter={() => handleMouseEnter('cotizacion')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => handleDropdownClick('cotizacion')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isCotizacionActive
                    ? 'bg-red-50 text-red-700 border border-red-100 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Cotización</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-150 ${
                    activeDropdown === 'cotizacion' ? 'rotate-180 text-red-700' : 'text-slate-400'
                  }`}
                />
              </button>

              {activeDropdown === 'cotizacion' && (
                <div
                  className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 divide-y divide-slate-100"
                  onMouseEnter={() => handleMouseEnter('cotizacion')}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="py-1">
                    <Link
                      href="/cotizador"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-colors group"
                    >
                      <PlusCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold leading-snug text-slate-900 group-hover:text-emerald-800 flex items-center gap-1.5">
                          <span>Nueva Cotización</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                            + Crear
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Crear y emitir nueva propuesta comercial
                        </span>
                      </div>
                    </Link>

                    <Link
                      href="/cotizaciones"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors group"
                    >
                      <FolderArchive className="w-4 h-4 text-red-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-red-700">
                          Historial & Métricas
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Panel comercial y seguimiento de propuestas
                        </span>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Tarifado Oficial Menu */}
            <div
              className="relative nav-dropdown-container"
              onMouseEnter={() => handleMouseEnter('tarifario')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => handleDropdownClick('tarifario')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isTarifarioActive
                    ? 'bg-red-50 text-red-700 border border-red-100 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span>Tarifado Oficial</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-150 ${
                    activeDropdown === 'tarifario' ? 'rotate-180 text-red-700' : 'text-slate-400'
                  }`}
                />
              </button>

              {activeDropdown === 'tarifario' && (
                <div
                  className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 divide-y divide-slate-100"
                  onMouseEnter={() => handleMouseEnter('tarifario')}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="py-1">
                    <Link
                      href="/tarifario"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors group"
                    >
                      <Eye className="w-4 h-4 text-red-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-red-700">
                          Revisar Tarifario
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Catálogo de ensayos acreditados LE-304
                        </span>
                      </div>
                    </Link>

                    <a
                      href="/api/tarifario/export"
                      download
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-colors group"
                    >
                      <Download className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-emerald-800">
                          Descargar Excel Oficial
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Descarga personalizada o completa
                        </span>
                      </div>
                    </a>
                  </div>

                  {isAdminRole(user?.role) && (
                    <div className="py-1">
                      <Link
                        href="/tarifario?action=upload"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors group"
                      >
                        <Upload className="w-4 h-4 text-slate-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-slate-900">
                            Cargar Nuevo Excel
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            Actualizar base oficial desde archivo
                          </span>
                        </div>
                      </Link>

                      <Link
                        href="/tarifario?action=new"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors group"
                      >
                        <PlusCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold leading-snug text-red-700">
                            + Nuevo Ensayo
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            Agregar ítem individualmente
                          </span>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Clientes Menu */}
            <div
              className="relative nav-dropdown-container"
              onMouseEnter={() => handleMouseEnter('clientes')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => handleDropdownClick('clientes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isClientesActive
                    ? 'bg-red-50 text-red-700 border border-red-100 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Clientes & CRM</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-150 ${
                    activeDropdown === 'clientes' ? 'rotate-180 text-red-700' : 'text-slate-400'
                  }`}
                />
              </button>

              {activeDropdown === 'clientes' && (
                <div
                  className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 divide-y divide-slate-100"
                  onMouseEnter={() => handleMouseEnter('clientes')}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="py-1">
                    {/* 1. Empresas Clientes */}
                    <Link
                      href="/clientes?tab=empresas"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors group"
                    >
                      <Building2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-blue-700">
                          Empresas Clientes
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Directorio de razones sociales, RUTs y condiciones
                        </span>
                      </div>
                    </Link>

                    {/* 2. Contactos Comerciales */}
                    <Link
                      href="/clientes?tab=contactos"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-colors group"
                    >
                      <UserCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-emerald-700">
                          Contactos Comerciales
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Personas destinatarias vinculadas por correo y fono
                        </span>
                      </div>
                    </Link>

                    {/* 3. Obras y Proyectos */}
                    <Link
                      href="/clientes?tab=proyectos"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition-colors group"
                    >
                      <Briefcase className="w-4 h-4 text-purple-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-purple-700">
                          Obras & Proyectos (PRY)
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Catálogo de obras y códigos únicos PRY-XXXX
                        </span>
                      </div>
                    </Link>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="py-1">
                    <Link
                      href="/clientes?tab=empresas&action=create"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2 px-3.5 py-1.5 hover:bg-slate-50 text-[11px] text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                      <span>+ Nueva Empresa</span>
                    </Link>

                    <Link
                      href="/clientes?tab=contactos&action=create"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2 px-3.5 py-1.5 hover:bg-slate-50 text-[11px] text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>+ Nuevo Contacto</span>
                    </Link>

                    <Link
                      href="/clientes?tab=proyectos&action=create"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2 px-3.5 py-1.5 hover:bg-slate-50 text-[11px] text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-purple-600" />
                      <span>+ Nueva Obra / Proyecto</span>
                    </Link>
                  </div>

                  {isAdminRole(user?.role) && (
                    <div className="py-1">
                      <Link
                        href="/clientes?action=upload"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors group"
                      >
                        <Upload className="w-4 h-4 text-slate-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-slate-900">
                            Cargar Base Excel
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            Importación masiva de empresas
                          </span>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Configuración Menu */}
            <div
              className="relative nav-dropdown-container"
              onMouseEnter={() => handleMouseEnter('configuracion')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => handleDropdownClick('configuracion')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isConfigActive
                    ? 'bg-red-50 text-red-700 border border-red-100 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configuración</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-150 ${
                    activeDropdown === 'configuracion' ? 'rotate-180 text-red-700' : 'text-slate-400'
                  }`}
                />
              </button>

              {activeDropdown === 'configuracion' && (
                <div
                  className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 divide-y divide-slate-100"
                  onMouseEnter={() => handleMouseEnter('configuracion')}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="py-1">
                    {/* Usuarios (Admin only) */}
                    {isAdminRole(user?.role) && (
                      <div className="border-b border-slate-100 pb-1.5 mb-1">
                        <Link
                          href="/usuarios"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-start gap-2.5 px-3.5 py-1.5 hover:bg-purple-50 text-slate-700 hover:text-purple-800 transition-colors group"
                        >
                          <Users className="w-4 h-4 text-purple-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold leading-snug text-slate-800 group-hover:text-purple-800">
                                Usuarios
                              </span>
                              <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">
                                Admin
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-normal">
                              Gestión de usuarios y accesos de personal
                            </span>
                          </div>
                        </Link>

                        {/* Labels para crear usuarios y configurar usuarios */}
                        <div className="pl-9 pr-3 pt-0.5 space-y-0.5">
                          <Link
                            href="/usuarios?tab=crear"
                            onClick={() => setActiveDropdown(null)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors group/sub"
                          >
                            <UserPlus className="w-3.5 h-3.5 text-purple-500 group-hover/sub:scale-110 transition-transform" />
                            <span>Crear Usuarios</span>
                          </Link>
                          <Link
                            href="/usuarios?tab=configurar"
                            onClick={() => setActiveDropdown(null)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors group/sub"
                          >
                            <Sliders className="w-3.5 h-3.5 text-purple-500 group-hover/sub:scale-110 transition-transform" />
                            <span>Configurar Usuarios</span>
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Configurar Tarifario */}
                    <Link
                      href="/configuracion/tarifario"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-colors group"
                    >
                      <FolderTree className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-emerald-800">
                          Configurar Tarifario
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Estructura de categorías y subcategorías
                        </span>
                      </div>
                    </Link>

                    {/* Correlativos Oficiales */}
                    <Link
                      href="/configuracion/correlativos"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors group"
                    >
                      <Hash className="w-4 h-4 text-red-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-red-700">
                          Correlativos de Cotizaciones
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Numeración consecutiva por Centro de Costo
                        </span>
                      </div>
                    </Link>

                    {/* Memoria y Aprendizaje IA (Opciones A y B) */}
                    <Link
                      href="/configuracion/aprendizaje-ia"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 transition-colors group"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                          <span>Memoria y Aprendizaje IA</span>
                          <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                            Opciones A y B
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Supervisión de reglas, sinónimos y RAG histórico
                        </span>
                      </div>
                    </Link>

                    {/* Bibliografía Técnica e Histórica IA */}
                    <Link
                      href="/configuracion/bibliografia"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 transition-colors group"
                    >
                      <BookOpen className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                          <span>Bibliografía y Normas IA</span>
                          <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                            RAG Oficial
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Normas NCh, ASTM, MOP y base técnica
                        </span>
                      </div>
                    </Link>

                    {/* Auditoría y Trazabilidad (Admin only) */}
                    {isAdminRole(user?.role) && (
                      <Link
                        href="/auditoria"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-purple-50 text-slate-700 hover:text-purple-800 transition-colors group"
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold leading-snug text-slate-800 group-hover:text-purple-800">
                              Auditoría & Trazabilidad
                            </span>
                            <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">
                              Admin
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-normal">
                            Registro de accesos y cambios en el sistema
                          </span>
                        </div>
                      </Link>
                    )}

                    {/* Editar Formato */}
                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        setShowFormatoModal(true);
                      }}
                      className="w-full flex items-start gap-2.5 px-3.5 py-2 hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors cursor-pointer text-left group"
                    >
                      <FileText className="w-4 h-4 text-red-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-red-700">
                          Editar Formato
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Encabezado, pie de página y observaciones
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Auditoría Direct Link (Admin only) */}
            {isAdminRole(user?.role) && (
              <Link
                href="/auditoria"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  pathname.startsWith('/auditoria')
                    ? 'bg-purple-50 text-purple-800 border border-purple-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Auditoría</span>
              </Link>
            )}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                {/* Clickable user profile button */}
                <button
                  onClick={() => setShowProfileModal(true)}
                  title="Mi Perfil: Modificar datos, firma digital y contraseña"
                  className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group text-left"
                >
                  <div className="hidden lg:flex flex-col items-end">
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-red-700 transition-colors leading-tight">
                      {user.name}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {user.role === 'superadmin' ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center gap-1 shadow-2xs">
                          <ShieldCheck className="w-2.5 h-2.5 text-purple-300" />
                          <span>Admin / Soporte</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {user.role === 'admin' ? 'Administrador' : 'Comercial'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-red-600 border border-red-700 flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:scale-105 group-hover:bg-red-700 transition-transform">
                    {user.commercialInitials || user.name.slice(0, 2).toUpperCase()}
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : !loading ? (
              <Link
                href="/login"
                className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors shadow-xs"
              >
                Ingresar
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-slate-100 px-2 py-1 flex justify-around bg-slate-50 text-[11px]">
        <Link
          href="/cotizaciones"
          className={`flex items-center gap-1 py-1 ${
            pathname.startsWith('/cotizaciones') ? 'text-red-700 font-bold' : 'text-slate-600'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5" />
          <span>Historial</span>
        </Link>
        <Link
          href="/cotizador"
          className={`flex items-center gap-1 py-1 ${
            pathname.startsWith('/cotizador') ? 'text-red-700 font-bold' : 'text-slate-600'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Nueva Cotización</span>
        </Link>
        <Link
          href="/clientes"
          className={`flex items-center gap-1 py-1 ${
            pathname.startsWith('/clientes') ? 'text-red-700 font-bold' : 'text-slate-600'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>CRM</span>
        </Link>
        <Link
          href="/tarifario"
          className={`flex items-center gap-1 py-1 ${
            pathname.startsWith('/tarifario') ? 'text-red-700 font-bold' : 'text-slate-600'
          }`}
        >
          <TableProperties className="w-3.5 h-3.5" />
          <span>Tarifario</span>
        </Link>
        {isAdminRole(user?.role) && (
          <>
            <Link
              href="/usuarios"
              className={`flex items-center gap-1 py-1 ${
                pathname.startsWith('/usuarios') ? 'text-red-700 font-bold' : 'text-slate-600'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Usuarios</span>
            </Link>
            <Link
              href="/auditoria"
              className={`flex items-center gap-1 py-1 ${
                pathname.startsWith('/auditoria') ? 'text-purple-700 font-bold' : 'text-slate-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>Auditoría</span>
            </Link>
          </>
        )}
      </div>

      {/* Modals */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdated={(updated) => setUser((prev) => (prev ? { ...prev, ...updated } : null))}
      />

      <FormatoModal
        isOpen={showFormatoModal}
        onClose={() => setShowFormatoModal(false)}
      />
    </header>
  );
}
