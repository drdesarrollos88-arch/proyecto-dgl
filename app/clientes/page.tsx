'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Cliente, Contacto, Proyecto, SessionUser } from '@/lib/types';
import {
  Building2,
  Search,
  Plus,
  Upload,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  User,
  CreditCard,
  FileSpreadsheet,
  Briefcase,
  Lock,
  ExternalLink,
  Loader2,
  Calculator,
  FolderArchive,
} from 'lucide-react';

function ClientesContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<'empresas' | 'contactos' | 'proyectos'>('empresas');

  // ================= EMPRESAS (CLIENTES) STATE =================
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesLoading, setClientesLoading] = useState(true);
  const [clientesSearch, setClientesSearch] = useState('');
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [showCreateClienteModal, setShowCreateClienteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [clienteFormData, setClienteFormData] = useState({
    name: '',
    rut: '',
    comuna: '',
    address: '',
    giro: '',
    phone: '',
    paymentCondition: '50% AL CONTADO Y 50% CONTRA ENTREGA',
    email: '',
    contactPerson: '',
  });

  // ================= CONTACTOS STATE =================
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [contactosLoading, setContactosLoading] = useState(false);
  const [contactosSearch, setContactosSearch] = useState('');
  const [editingContacto, setEditingContacto] = useState<Contacto | null>(null);
  const [showCreateContactoModal, setShowCreateContactoModal] = useState(false);
  const [contactoFormData, setContactoFormData] = useState({
    email: '',
    name: '',
    phone: '',
    company: '',
  });

  // ================= PROYECTOS STATE =================
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectosLoading, setProyectosLoading] = useState(false);
  const [proyectosSearch, setProyectosSearch] = useState('');
  const [editingProyecto, setEditingProyecto] = useState<Proyecto | null>(null);
  const [showCreateProyectoModal, setShowCreateProyectoModal] = useState(false);
  const [proyectoFormData, setProyectoFormData] = useState({
    id: '',
    name: '',
    reference: '',
    city: 'Santiago',
    clientName: '',
  });

  // Shared status & file upload states
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      });
  }, []);

  // Search Clientes (Debounced)
  useEffect(() => {
    if (activeTab !== 'empresas') return;
    setClientesLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/clientes?q=${encodeURIComponent(clientesSearch)}&limit=50`)
        .then((res) => res.json())
        .then((data) => {
          if (data.clientes) setClientes(data.clientes);
        })
        .catch((err) => console.error('Error fetching clientes:', err))
        .finally(() => setClientesLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [clientesSearch, activeTab]);

  // Search Contactos (Debounced)
  useEffect(() => {
    if (activeTab !== 'contactos') return;
    setContactosLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/contactos?q=${encodeURIComponent(contactosSearch)}&limit=50`)
        .then((res) => res.json())
        .then((data) => {
          if (data.contactos) setContactos(data.contactos);
        })
        .catch((err) => console.error('Error fetching contactos:', err))
        .finally(() => setContactosLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [contactosSearch, activeTab]);

  // Search Proyectos (Debounced)
  useEffect(() => {
    if (activeTab !== 'proyectos') return;
    setProyectosLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/proyectos?q=${encodeURIComponent(proyectosSearch)}&limit=50`)
        .then((res) => res.json())
        .then((data) => {
          if (data.proyectos) setProyectos(data.proyectos);
        })
        .catch((err) => console.error('Error fetching proyectos:', err))
        .finally(() => setProyectosLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [proyectosSearch, activeTab]);

  // Load active tab data on tab switch and update URL cleanly
  const handleSwitchTab = (tab: 'empresas' | 'contactos' | 'proyectos') => {
    setActiveTab(tab);
    setMessage(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      url.searchParams.delete('action');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  // Handle tab and action query parameter from navbar or external links
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'contactos' || tabParam === 'proyectos' || tabParam === 'empresas') {
      setActiveTab(tabParam);
    }
    const action = searchParams.get('action');
    if (action === 'create') {
      if (tabParam === 'contactos') {
        handleCreateContactoClick();
      } else if (tabParam === 'proyectos') {
        handleCreateProyectoClick();
      } else {
        handleCreateClienteClick();
      }
    } else if (action === 'upload') {
      setShowUploadModal(true);
    }
  }, [searchParams]);

  // ================= CLIENTE HANDLERS =================
  const handleEditClienteClick = (c: Cliente) => {
    setEditingCliente(c);
    setClienteFormData({
      name: c.name,
      rut: c.rut,
      comuna: c.comuna,
      address: c.address,
      giro: c.giro,
      phone: c.phone,
      paymentCondition: c.paymentCondition,
      email: c.email,
      contactPerson: c.contactPerson,
    });
  };

  const handleCreateClienteClick = () => {
    setEditingCliente(null);
    setClienteFormData({
      name: '',
      rut: '',
      comuna: '',
      address: '',
      giro: '',
      phone: '',
      paymentCondition: '50% AL CONTADO Y 50% CONTRA ENTREGA',
      email: '',
      contactPerson: '',
    });
    setShowCreateClienteModal(true);
  };

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteFormData.name.trim() || !clienteFormData.rut.trim()) {
      setMessage({ type: 'error', text: 'Nombre/Razón Social y RUT son obligatorios.' });
      return;
    }

    setSaving(true);
    try {
      if (editingCliente) {
        const res = await fetch(`/api/clientes/${editingCliente.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clienteFormData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar empresa');

        setClientes((prev) =>
          prev.map((c) => (c.id === editingCliente.id ? data.cliente : c))
        );
        setMessage({ type: 'success', text: `Empresa "${data.cliente.name}" actualizada con éxito.` });
        setEditingCliente(null);
      } else {
        const res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clienteFormData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear empresa');

        setClientes((prev) => [data.cliente, ...prev]);
        setMessage({ type: 'success', text: `Empresa "${data.cliente.name}" registrada con éxito.` });
        setShowCreateClienteModal(false);
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al guardar empresa',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCliente = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar la empresa "${name}"?`)) return;

    try {
      const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setClientes((prev) => prev.filter((c) => c.id !== id));
        setMessage({ type: 'success', text: `Empresa "${name}" eliminada.` });
      } else {
        setMessage({ type: 'error', text: data?.error || 'Error al eliminar la empresa.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    }
  };

  // ================= CONTACTO HANDLERS =================
  const handleEditContactoClick = (c: Contacto) => {
    setEditingContacto(c);
    setContactoFormData({
      email: c.email,
      name: c.name,
      phone: c.phone || '',
      company: c.company || '',
    });
  };

  const handleCreateContactoClick = () => {
    setEditingContacto(null);
    setContactoFormData({
      email: '',
      name: '',
      phone: '',
      company: '',
    });
    setShowCreateContactoModal(true);
  };

  const handleSubmitContacto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactoFormData.email.trim() || !contactoFormData.email.includes('@')) {
      setMessage({ type: 'error', text: 'El correo electrónico es obligatorio y debe ser válido.' });
      return;
    }
    if (!contactoFormData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del contacto es obligatorio.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/contactos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactoFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar contacto');

      if (editingContacto) {
        setContactos((prev) =>
          prev.map((c) => (c.email.toLowerCase() === editingContacto.email.toLowerCase() ? data.contacto : c))
        );
        setMessage({ type: 'success', text: `Contacto "${data.contacto.name}" actualizado con éxito.` });
        setEditingContacto(null);
      } else {
        setContactos((prev) => [
          data.contacto,
          ...prev.filter((c) => c.email.toLowerCase() !== data.contacto.email.toLowerCase()),
        ]);
        setMessage({ type: 'success', text: `Contacto "${data.contacto.name}" registrado con éxito.` });
        setShowCreateContactoModal(false);
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al guardar contacto',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContacto = async (email: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar el contacto "${name}" (${email})?`)) return;

    try {
      const res = await fetch(`/api/contactos?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setContactos((prev) => prev.filter((c) => c.email.toLowerCase() !== email.toLowerCase()));
        setMessage({ type: 'success', text: `Contacto "${name}" eliminado.` });
      } else {
        setMessage({ type: 'error', text: data?.error || 'Error al eliminar el contacto.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    }
  };

  // ================= PROYECTO HANDLERS =================
  const handleEditProyectoClick = (p: Proyecto) => {
    setEditingProyecto(p);
    setProyectoFormData({
      id: p.id,
      name: p.name,
      reference: p.reference || '',
      city: p.city || 'Santiago',
      clientName: p.clientName || '',
    });
  };

  const handleCreateProyectoClick = () => {
    setEditingProyecto(null);
    setProyectoFormData({
      id: '',
      name: '',
      reference: '',
      city: 'Santiago',
      clientName: '',
    });
    setShowCreateProyectoModal(true);
  };

  const handleSubmitProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proyectoFormData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la obra o proyecto es obligatorio.' });
      return;
    }

    setSaving(true);
    try {
      if (editingProyecto) {
        const res = await fetch('/api/proyectos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proyectoFormData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar proyecto');

        setProyectos((prev) =>
          prev.map((p) => (p.id === editingProyecto.id ? data.proyecto : p))
        );
        setMessage({ type: 'success', text: `Proyecto "${data.proyecto.name}" [${data.proyecto.id}] actualizado.` });
        setEditingProyecto(null);
      } else {
        const res = await fetch('/api/proyectos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proyectoFormData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrar proyecto');

        setProyectos((prev) => [data.proyecto, ...prev]);
        setMessage({ type: 'success', text: `Proyecto "${data.proyecto.name}" registrado con ID ${data.proyecto.id}.` });
        setShowCreateProyectoModal(false);
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al guardar proyecto',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProyecto = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar el proyecto "${name}" [${id}]?`)) return;

    try {
      const res = await fetch(`/api/proyectos?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setProyectos((prev) => prev.filter((p) => p.id !== id));
        setMessage({ type: 'success', text: `Proyecto "${name}" [${id}] eliminado.` });
      } else {
        setMessage({ type: 'error', text: data?.error || 'Error al eliminar el proyecto.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    }
  };

  // ================= EXCEL UPLOAD HANDLER =================
  const handleUploadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      setMessage({ type: 'error', text: 'Por favor selecciona un archivo Excel (.xlsx)' });
      return;
    }

    const file = files[0];
    const formDataObj = new FormData();
    formDataObj.append('file', file);

    setUploading(true);
    try {
      const res = await fetch('/api/clientes/upload', {
        method: 'POST',
        body: formDataObj,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar Excel');

      setMessage({
        type: 'success',
        text: `¡Importación exitosa! ${data.importedCount} empresas agregadas/actualizadas.`,
      });
      setShowUploadModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Reload clients
      fetch('/api/clientes?limit=50')
        .then((r) => r.json())
        .then((d) => {
          if (d.clientes) setClientes(d.clientes);
        });
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al importar archivo',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Header Banner */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Centro de Gestión Comercial (CRM)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Directorio unificado de Empresas, Contactos Comerciales y Obras vinculadas con el Cotizador DGL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              href="/cotizaciones"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors shadow-xs"
              title="Ir al Resumen Comercial y Registro de Cotizaciones"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Ver Historial</span>
            </Link>

            <Link
              href="/cotizador"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-xs"
              title="Crear nueva cotización"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ir al Cotizador</span>
            </Link>

            {activeTab === 'empresas' && user?.role === 'admin' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>Cargar Excel</span>
              </button>
            )}

            {activeTab === 'empresas' && (
              <button
                onClick={handleCreateClienteClick}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nueva Empresa</span>
              </button>
            )}

            {activeTab === 'contactos' && (
              <button
                onClick={handleCreateContactoClick}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nuevo Contacto</span>
              </button>
            )}

            {activeTab === 'proyectos' && (
              <button
                onClick={handleCreateProyectoClick}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nueva Obra / Proyecto</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Message Alert */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center gap-3 border text-sm animate-in fade-in duration-200 ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto text-xs opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3 Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => handleSwitchTab('empresas')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'empresas'
                ? 'border-blue-700 text-blue-800 bg-white shadow-xs rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-t-xl'
            }`}
          >
            <Building2 className="w-4 h-4 text-blue-700" />
            <span>Empresas Clientes</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {clientes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('contactos')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'contactos'
                ? 'border-blue-700 text-blue-800 bg-white shadow-xs rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-t-xl'
            }`}
          >
            <User className="w-4 h-4 text-blue-700" />
            <span>Contactos Comerciales</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {contactos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('proyectos')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'proyectos'
                ? 'border-blue-700 text-blue-800 bg-white shadow-xs rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-t-xl'
            }`}
          >
            <Briefcase className="w-4 h-4 text-blue-700" />
            <span>Obras y Proyectos (PRY)</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {proyectos.length}
            </span>
          </button>
        </div>

        {/* ================= TAB 1: EMPRESAS CLIENTES ================= */}
        {activeTab === 'empresas' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por Razón Social o RUT (ej. Besalco, Constructora, 76.123.456-7)..."
                  value={clientesSearch}
                  onChange={(e) => setClientesSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              {clientesSearch && (
                <button
                  onClick={() => setClientesSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{clientesLoading ? 'Buscando empresas...' : `Mostrando ${clientes.length} resultados`}</span>
                <span className="text-[11px] text-slate-400">* Base SQLite local optimizada</span>
              </div>

              <div className="max-h-[600px] overflow-y-auto relative">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-3 px-4 w-1/4">Razón Social</th>
                      <th className="py-3 px-4 w-32">RUT</th>
                      <th className="py-3 px-4 w-36">Comuna</th>
                      <th className="py-3 px-4">Dirección</th>
                      <th className="py-3 px-4 w-40">Giro</th>
                      <th className="py-3 px-4 w-32">Teléfono</th>
                      <th className="py-3 px-4 w-28 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientes.length > 0 ? (
                      clientes.map((c) => (
                        <tr key={c.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {c.name}
                            {c.contactPerson && (
                              <span className="block text-[11px] font-normal text-slate-500">
                                Contacto: {c.contactPerson}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                              {c.rut}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {c.comuna ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {c.comuna}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={c.address}>
                            {c.address || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 truncate max-w-[150px]" title={c.giro}>
                            {c.giro || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {c.phone ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {c.phone}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                href={`/cotizador?client=${encodeURIComponent(c.name)}`}
                                title={`Iniciar cotización oficial para ${c.name}`}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                onClick={() => handleEditClienteClick(c)}
                                title="Editar empresa"
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {user?.role === 'admin' && (
                                <button
                                  onClick={() => handleDeleteCliente(c.id, c.name)}
                                  title="Eliminar empresa"
                                  className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                          {clientesLoading ? 'Cargando empresas...' : 'No se encontraron empresas con ese criterio.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CONTACTOS COMERCIALES ================= */}
        {activeTab === 'contactos' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar contacto por Nombre, Correo electrónico, Teléfono o Empresa..."
                  value={contactosSearch}
                  onChange={(e) => setContactosSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              {contactosSearch && (
                <button
                  onClick={() => setContactosSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{contactosLoading ? 'Buscando contactos...' : `Mostrando ${contactos.length} contactos registrados`}</span>
                <span className="text-[11px] text-blue-600 font-medium">* El correo actúa como identificador único</span>
              </div>

              <div className="max-h-[600px] overflow-y-auto relative">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-3 px-4 w-1/4">Atención (Nombre Contacto)</th>
                      <th className="py-3 px-4 w-1/4">Correo Electrónico (ID Único)</th>
                      <th className="py-3 px-4 w-36">Teléfono Móvil</th>
                      <th className="py-3 px-4">Empresa / Razón Social</th>
                      <th className="py-3 px-4 w-32 text-center">Registrado</th>
                      <th className="py-3 px-4 w-24 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contactos.length > 0 ? (
                      contactos.map((c) => (
                        <tr key={c.email} className="hover:bg-blue-50/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span>{c.name}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-blue-900">
                            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                              <Mail className="w-3 h-3 text-blue-500" />
                              {c.email}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                            {c.phone ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {c.phone}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {c.company ? (
                              <span className="inline-flex items-center gap-1">
                                🏢 {c.company}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">No especificada</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 text-[11px]">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-CL') : '-'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                href={`/cotizador?contactEmail=${encodeURIComponent(c.email)}`}
                                title={`Iniciar cotización oficial dirigida a ${c.name}`}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                onClick={() => handleEditContactoClick(c)}
                                title="Editar contacto"
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteContacto(c.email, c.name)}
                                title="Eliminar contacto"
                                className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                          {contactosLoading ? 'Cargando contactos...' : 'No se encontraron contactos registrados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: OBRAS Y PROYECTOS ================= */}
        {activeTab === 'proyectos' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por código PRY-XXXX, Nombre de la obra, Referencia o Cliente..."
                  value={proyectosSearch}
                  onChange={(e) => setProyectosSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              {proyectosSearch && (
                <button
                  onClick={() => setProyectosSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{proyectosLoading ? 'Buscando proyectos...' : `Mostrando ${proyectos.length} proyectos registrados`}</span>
                <span className="text-[11px] text-blue-600 font-medium">* Códigos correlativos únicos e inmutables</span>
              </div>

              <div className="max-h-[600px] overflow-y-auto relative">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-3 px-4 w-32">ID Proyecto</th>
                      <th className="py-3 px-4 w-1/3">Nombre Obra / Proyecto</th>
                      <th className="py-3 px-4">Referencia Técnica</th>
                      <th className="py-3 px-4 w-32">Sede</th>
                      <th className="py-3 px-4 w-44">Cliente Asociado</th>
                      <th className="py-3 px-4 w-32 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {proyectos.length > 0 ? (
                      proyectos.map((p) => (
                        <tr key={p.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded">
                              <Lock className="w-2.5 h-2.5 text-blue-700" />
                              {p.id}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {p.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {p.reference || <span className="text-slate-400 italic">-</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {p.city || 'Santiago'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {p.clientName ? (
                              <span className="truncate block max-w-[170px]" title={p.clientName}>
                                {p.clientName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Cotizar este Proyecto */}
                              <Link
                                href={`/cotizador?projectId=${encodeURIComponent(p.id)}`}
                                title="Iniciar nueva cotización oficial para este proyecto"
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                              >
                                <Calculator className="w-3 h-3 text-emerald-600" />
                                <span>Cotizar</span>
                              </Link>

                              {/* Ver Cotizaciones */}
                              <Link
                                href={`/cotizaciones?search=${encodeURIComponent(p.id)}`}
                                title="Ver cotizaciones de esta obra en el Historial"
                                className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>

                              {/* Editar */}
                              <button
                                onClick={() => handleEditProyectoClick(p)}
                                title="Modificar datos del proyecto"
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Eliminar */}
                              <button
                                onClick={() => handleDeleteProyecto(p.id, p.name)}
                                title="Eliminar proyecto"
                                className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                          {proyectosLoading ? 'Cargando proyectos...' : 'No se encontraron proyectos registrados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: CLIENTE (EMPRESA) ================= */}
        {(showCreateClienteModal || editingCliente) && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  {editingCliente ? 'Modificar Datos de Empresa' : 'Registrar Nueva Empresa'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateClienteModal(false);
                    setEditingCliente(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitCliente} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Razón Social *
                    </label>
                    <input
                      type="text"
                      required
                      value={clienteFormData.name}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, name: e.target.value })}
                      placeholder="ej. Constructora e Inmobiliaria SpA"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      RUT *
                    </label>
                    <input
                      type="text"
                      required
                      value={clienteFormData.rut}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, rut: e.target.value })}
                      placeholder="ej. 76.123.456-7"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Comuna / Ciudad
                    </label>
                    <input
                      type="text"
                      value={clienteFormData.comuna}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, comuna: e.target.value })}
                      placeholder="ej. Santiago, Concepción"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Dirección Comercial
                    </label>
                    <input
                      type="text"
                      value={clienteFormData.address}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, address: e.target.value })}
                      placeholder="ej. Av. Providencia 1234, Of. 502"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Giro Comercial
                    </label>
                    <input
                      type="text"
                      value={clienteFormData.giro}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, giro: e.target.value })}
                      placeholder="ej. Construcción e Ingeniería"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={clienteFormData.phone}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, phone: e.target.value })}
                      placeholder="ej. +56 9 8765 4321"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={clienteFormData.email}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, email: e.target.value })}
                      placeholder="ej. contacto@empresa.cl"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Atención / Contacto
                    </label>
                    <input
                      type="text"
                      value={clienteFormData.contactPerson}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, contactPerson: e.target.value })}
                      placeholder="ej. Ing. Juan Pérez"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Condición de Pago Predeterminada
                    </label>
                    <input
                      type="text"
                      value={clienteFormData.paymentCondition}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, paymentCondition: e.target.value })}
                      placeholder="ej. 50% AL CONTADO Y 50% CONTRA ENTREGA"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateClienteModal(false);
                      setEditingCliente(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingCliente ? 'Guardar Cambios' : 'Registrar Empresa'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: CONTACTO ================= */}
        {(showCreateContactoModal || editingContacto) && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-700" />
                  {editingContacto ? 'Modificar Contacto Comercial' : 'Nuevo Contacto Comercial'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateContactoModal(false);
                    setEditingContacto(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitContacto} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Atención (Nombre y Apellido) *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactoFormData.name}
                    onChange={(e) => setContactoFormData({ ...contactoFormData, name: e.target.value })}
                    placeholder="ej. Ing. Carlos Muñoz"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>Correo Electrónico (ID Único) *</span>
                    <span className="text-[10px] text-blue-600 font-normal">Clave principal</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingContacto}
                    value={contactoFormData.email}
                    onChange={(e) => setContactoFormData({ ...contactoFormData, email: e.target.value })}
                    placeholder="ej. carlos.munoz@empresa.cl"
                    className={`w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono ${
                      editingContacto ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                    }`}
                  />
                  {editingContacto && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      El correo actúa como ID único y no puede modificarse una vez registrado.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Teléfono Móvil
                  </label>
                  <input
                    type="text"
                    value={contactoFormData.phone}
                    onChange={(e) => setContactoFormData({ ...contactoFormData, phone: e.target.value })}
                    placeholder="ej. +56 9 8765 4321"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Empresa / Razón Social Asociada
                  </label>
                  <input
                    type="text"
                    value={contactoFormData.company}
                    onChange={(e) => setContactoFormData({ ...contactoFormData, company: e.target.value })}
                    placeholder="ej. Constructora Los Olivos SpA"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateContactoModal(false);
                      setEditingContacto(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingContacto ? 'Guardar Cambios' : 'Registrar Contacto'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: PROYECTO ================= */}
        {(showCreateProyectoModal || editingProyecto) && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-700" />
                  {editingProyecto ? 'Modificar Obra / Proyecto' : 'Registrar Nueva Obra / Proyecto'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateProyectoModal(false);
                    setEditingProyecto(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitProyecto} className="space-y-3.5">
                {editingProyecto && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      ID Proyecto (Inmutable)
                    </label>
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl font-mono text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-blue-700" />
                      <span>{editingProyecto.id}</span>
                      <span className="text-[10px] text-blue-600 font-normal ml-auto">(No modificable)</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nombre Obra / Proyecto *
                  </label>
                  <input
                    type="text"
                    required
                    value={proyectoFormData.name}
                    onChange={(e) => setProyectoFormData({ ...proyectoFormData, name: e.target.value })}
                    placeholder="ej. Edificio Los Olivos - Etapa 2"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Referencia Técnica
                  </label>
                  <input
                    type="text"
                    value={proyectoFormData.reference}
                    onChange={(e) => setProyectoFormData({ ...proyectoFormData, reference: e.target.value })}
                    placeholder="ej. Ensayos Geotécnicos y Mecánica de Suelos"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Sede
                    </label>
                    <select
                      value={proyectoFormData.city}
                      onChange={(e) => setProyectoFormData({ ...proyectoFormData, city: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    >
                      <option value="Santiago">Santiago</option>
                      <option value="Concepción">Concepción</option>
                      <option value="Terreno / Regiones">Terreno / Regiones</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Cliente / Empresa
                    </label>
                    <input
                      type="text"
                      value={proyectoFormData.clientName}
                      onChange={(e) => setProyectoFormData({ ...proyectoFormData, clientName: e.target.value })}
                      placeholder="ej. Inmobiliaria ABC"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {!editingProyecto && (
                  <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-[10px] text-blue-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span>Se le asignará automáticamente el siguiente código correlativo único (ej. <strong>PRY-XXXX</strong>).</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProyectoModal(false);
                      setEditingProyecto(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingProyecto ? 'Guardar Cambios' : 'Registrar Proyecto'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: CARGAR EXCEL ================= */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  Importar Empresas desde Excel
                </h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUploadExcel} className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Selecciona el archivo oficial de clientes</p>
                  <p className="text-[10px] text-slate-400 mt-1">Formato admitido: Microsoft Excel (.xlsx)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    className="mt-3 block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="font-semibold text-slate-700 mb-1">Estructura de columnas esperada:</p>
                  <p>RUT, Razón Social, Comuna, Dirección Comercial, Giro Comercial, Teléfono, Condición de Pago.</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{uploading ? 'Importando...' : 'Iniciar Carga'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <ClientesContent />
    </Suspense>
  );
}
