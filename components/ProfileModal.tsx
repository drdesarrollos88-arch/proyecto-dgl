'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, SessionUser } from '@/lib/types';
import {
  X,
  User as UserIcon,
  Lock,
  PenTool,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Phone,
  Mail,
  FileBadge,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (updatedUser: Partial<User>) => void;
}

export default function ProfileModal({ isOpen, onClose, onProfileUpdated }: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile Form States
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [commercialTitle, setCommercialTitle] = useState('');
  const [commercialInitials, setCommercialInitials] = useState('');
  const [phone, setPhone] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Signature Canvas Ref & State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load User Data
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setStatusMessage(null);

    fetch('/api/users/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setName(data.user.name || '');
          setRut(data.user.rut || '');
          setEmail(data.user.email || '');
          setCommercialTitle(data.user.commercialTitle || 'Analista Comercial');
          setCommercialInitials(data.user.commercialInitials || 'DRA');
          setPhone(data.user.phone || '');
          setSignature(data.user.signature || null);
        }
      })
      .catch((err) => {
        console.error('Error fetching profile:', err);
        setStatusMessage({ type: 'error', text: 'Error al cargar los datos del perfil.' });
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Initialize Canvas
  useEffect(() => {
    if (activeTab === 'profile' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activeTab, loading]);

  if (!isOpen) return null;

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      const dataUrl = canvasRef.current.toDataURL('image/png');
      setSignature(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSignature(null);
  };

  // Upload Signature Image File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione un archivo de imagen válido (PNG, JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setSignature(result);
    };
    reader.readAsDataURL(file);
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          rut,
          email,
          commercialTitle,
          commercialInitials,
          phone,
          signature,
        }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        setStatusMessage({ type: 'success', text: 'Perfil y firma comercial actualizados con éxito.' });
        if (onProfileUpdated) onProfileUpdated(data.user);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dgl-profile-updated', { detail: data.user }));
        }
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Error al guardar los datos del perfil.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error al comunicarse con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'La nueva contraseña y su confirmación no coinciden.' });
      return;
    }

    setChangingPassword(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Contraseña actualizada con éxito.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Error al cambiar contraseña.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header with IDIEM Red Accent */}
        <div className="bg-[#1A1A1A] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#E20000]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#E20000] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {name ? name.slice(0, 2).toUpperCase() : 'MI'}
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Mi Perfil & Firma Oficial</h2>
              <p className="text-xs text-slate-400">Personaliza tus datos de emisión de cotizaciones y credenciales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-3">
          <button
            type="button"
            onClick={() => { setActiveTab('profile'); setStatusMessage(null); }}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#E20000] text-[#E20000]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Datos & Firma Comercial</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('security'); setStatusMessage(null); }}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#E20000] text-[#E20000]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Seguridad & Contraseña</span>
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-[#E20000] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-500">Cargando perfil...</span>
            </div>
          ) : activeTab === 'profile' ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Nombre Completo *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    RUT *
                  </label>
                  <input
                    type="text"
                    required
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Cargo Comercial (para Cotizaciones) *
                  </label>
                  <div className="relative">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="ej. Analista Comercial, Ingeniero de Proyectos"
                      value={commercialTitle}
                      onChange={(e) => setCommercialTitle(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Sigla Referencia Presupuesto
                  </label>
                  <div className="relative">
                    <FileBadge className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ej. DRA o PCM/DRA"
                      value={commercialInitials}
                      onChange={(e) => setCommercialInitials(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Teléfono de Contacto
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ej. +56 9 1234 5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Digital Signature Section */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-tight">
                      Firma Digital para Cotizaciones
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Esta firma aparecerá automáticamente al final de tus cotizaciones y en el PDF oficial.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/png, image/jpeg"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200"
                    >
                      <Upload className="w-3 h-3 text-slate-600" />
                      <span>Subir Imagen</span>
                    </button>
                    {signature && (
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Borrar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Signature Canvas / Preview Box */}
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center relative">
                  {signature ? (
                    <div className="flex flex-col items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={signature}
                        alt="Firma Digital"
                        className="max-h-24 max-w-full object-contain filter drop-shadow-xs"
                      />
                      <span className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Firma cargada y lista para cotizaciones
                      </span>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center">
                      <canvas
                        ref={canvasRef}
                        width={460}
                        height={110}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="border border-slate-200 bg-white rounded-lg cursor-crosshair w-full max-w-[460px] h-[110px]"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <PenTool className="w-3 h-3" /> Dibuja tu firma arriba o presiona "Subir Imagen"
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#E20000] hover:bg-[#C20000] rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Guardando...' : 'Guardar Perfil'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Security / Password Tab */
            <form onSubmit={handleChangePassword} className="space-y-4 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                Para tu seguridad, ingresa tu contraseña actual antes de definir tu nueva clave de acceso.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Contraseña Actual *
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nueva Contraseña *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Confirmar Nueva Contraseña *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita la nueva clave"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#E20000] hover:bg-[#C20000] rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{changingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

