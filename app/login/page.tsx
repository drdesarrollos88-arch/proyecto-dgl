'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/cotizaciones';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas.');
        setLoading(false);
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError('Error al comunicarse con el servidor. Intente nuevamente.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 text-[#E20000] flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          Correo Electrónico o RUT
        </label>
        <div className="relative">
          <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            required
            placeholder="ej. diego.roman@idiem.cl o 16.898.141-4"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E20000] focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          Contraseña
        </label>
        <div className="relative">
          <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E20000] focus:border-transparent transition-all"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 px-4 bg-[#E20000] hover:bg-[#C20000] text-white font-semibold rounded-xl text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        ) : (
          <>
            <span>Ingresar a la Plataforma</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient lighting in IDIEM red */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#E20000]/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#C20000]/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Card Header Banner with IDIEM Logo */}
        <div className="bg-white rounded-t-2xl p-6 border-b border-slate-100 flex flex-col items-center text-center shadow-lg">
          <div className="w-full max-w-[260px] h-20 relative mb-2 flex items-center justify-center">
            <Image
              src="/logo_125.png"
              alt="IDIEM - 125 Años"
              fill
              unoptimized
              className="object-contain"
              priority
            />
          </div>
          <div className="h-0.5 w-12 bg-[#E20000] my-2 rounded-full"></div>
          <p className="text-xs font-semibold text-slate-700">
            Laboratorio Geotécnico DGL
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Tarifario Oficial & Cotizador de Ensayos
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-white rounded-b-2xl p-8 shadow-2xl border border-slate-100">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900">Iniciar Sesión</h1>
            <p className="text-sm text-slate-500 mt-1">
              Ingrese con su cuenta autorizada institucional
            </p>
          </div>

          <Suspense fallback={<div className="py-8 text-center text-sm text-slate-400">Cargando formulario...</div>}>
            <LoginForm />
          </Suspense>

          {/* Security Features Info */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Cifrado SSL/TLS 256-bit
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#E20000]" />
              Acceso Institucional IDIEM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

