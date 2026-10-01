'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import {
  TarifarioItem,
  CotizacionItem,
  SessionUser,
  EconomicIndicators,
  Cliente,
  Contacto,
  Proyecto,
  Cotizacion,
  FormatoSettings,
  CENTROS_DE_COSTO,
  CotizacionCondicionesComerciales,
  ReglaAprendida,
} from '@/lib/types';
import { generateCotizacionPdf } from '@/lib/pdf-generator';
import UnifiedAiAssistantModal, { DisplayChatMessage } from '@/components/UnifiedAiAssistantModal';
import CommercialConditionsEditor from '@/components/CommercialConditionsEditor';
import {
  DEFAULT_OBSERVACIONES,
  getDefaultCondicionesComerciales,
} from '@/lib/default-conditions';
import { AiDatosProyecto, AiEnsayoSugerido, AiChatAction, AiAnalisisResponse } from '@/lib/ai-service';
import { smartSearchTarifario } from '@/lib/search-utils';
import { hasPermission, isAdminRole } from '@/lib/permissions';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Trash2,
  FileText,
  Save,
  RotateCcw,
  TrendingUp,
  Building,
  Building2,
  User,
  Scale,
  Sparkles,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  GripVertical,
  PlusCircle,
  Edit3,
  X,
  Loader2,
  Briefcase,
  UserCheck,
  Check,
  ExternalLink,
  RefreshCw,
  Lock,
  Mail,
  Phone,
  FolderPlus,
  FolderArchive,
  TableProperties,
} from 'lucide-react';

function extractCcCode(ccStr: string): string {
  const match = ccStr.match(/^(\d{4})/);
  return match ? match[1] : '2339';
}

function updateCodeWithCc(currentCode: string, newCc: string): string {
  const ccNum = extractCcCode(newCc);
  const year = new Date().getFullYear();
  if (!currentCode) {
    return `PR.DGL.${ccNum}.${year}.0598-V1`;
  }

  // Preserve version suffix if present: e.g. "-V1", "-V2" or "_V2"
  const versionMatch = currentCode.match(/([-_.\s]+V\d+)$/i);
  const versionSuffix = versionMatch ? versionMatch[1] : '';
  const baseWithoutVersion = currentCode.slice(0, currentCode.length - versionSuffix.length);

  const parts = baseWithoutVersion.split('.');
  if (parts.length >= 5 && parts[0].toUpperCase() === 'PR' && parts[1].toUpperCase() === 'DGL') {
    parts[2] = ccNum;
    return parts.join('.') + versionSuffix;
  }

  if (/PR\.DGL\.\w+\./i.test(baseWithoutVersion)) {
    return baseWithoutVersion.replace(/PR\.DGL\.\w+\./i, `PR.DGL.${ccNum}.`) + versionSuffix;
  }

  return `PR.DGL.${ccNum}.${year}.0598${versionSuffix || '-V1'}`;
}

function getNextVersionCode(currentCode: string): string {
  if (!currentCode) return `PR.DGL.2339.${new Date().getFullYear()}.0001-V2`;
  const trimmed = currentCode.trim();
  const match = trimmed.match(/^(.*?)(?:[-_.\s]+V(\d+))$/i);
  if (match) {
    const base = match[1];
    const nextVer = parseInt(match[2], 10) + 1;
    return `${base}-V${nextVer}`;
  }
  return `${trimmed}-V2`;
}

// Separar título principal y especificaciones/notas del detalle del ensayo
function parseDesignation(raw: string): { title: string; detail: string } {
  if (!raw) return { title: '', detail: '' };
  const clean = raw.trim();

  // Caso 1: Tiene saltos de línea explícitos (muy común en tarifario IDIEM: Título \n Especificaciones / Notas)
  if (clean.includes('\n')) {
    const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
    const title = lines[0] || '';
    const detail = lines.slice(1).join('\n');
    return { title, detail };
  }

  // Caso 2: Bloques separados por múltiples espacios consecutivos (como en código 319)
  if (/\s{3,}/.test(clean)) {
    const parts = clean.split(/\s{3,}/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      return { title: parts[0], detail: parts.slice(1).join('\n') };
    }
  }

  // Caso 3: Frases largas con prefijos de notas/especificaciones (Nota:, Incluye:, Tamaño mínimo:, etc.)
  const match = clean.match(/^(.*?)\.\s+(Nota.*|Incluye:.*|Tamaño mínimo.*|Considera.*|Probeta tallada.*)$/i);
  if (match) {
    return { title: match[1] + '.', detail: match[2] };
  }

  return { title: clean, detail: '' };
}

function CotizadorContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [originalQuote, setOriginalQuote] = useState<Cotizacion | null>(null);
  const [isVersionMode, setIsVersionMode] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tarifario, setTarifario] = useState<TarifarioItem[]>([]);
  const [indicators, setIndicators] = useState<EconomicIndicators>({
    uf: 40879.04,
    dolar: 933.47,
    date: new Date().toISOString().slice(0, 10),
    source: 'Oficial Banco Central (findic.cl)',
  });

  // Client and Project Information Form
  const defaultCc = '2339 - Ensayos Rocas';
  const [centroCosto, setCentroCosto] = useState<string>(defaultCc);
  const [currency, setCurrency] = useState<'UF' | 'USD'>('UF');
  const [code, setCode] = useState(() => {
    const year = new Date().getFullYear();
    return `PR.DGL.2339.${year}.0598-V1`;
  });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [city, setCity] = useState('Santiago');
  const [paymentCondition, setPaymentCondition] = useState('50% AL CONTADO Y 50% CONTRA ENTREGA');
  const [clientName, setClientName] = useState('');
  const [clientRut, setClientRut] = useState('');
  const [clientAttention, setClientAttention] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [reference, setReference] = useState('Ensayos Geotécnicos');
  const [projectName, setProjectName] = useState('');
  const [projectId, setProjectId] = useState(''); // e.g. "PRY-0001" (unique, irrepeatable, unmodifiable)
  const [commercialName, setCommercialName] = useState('Diego Román Araneda');
  const [commercialTitle, setCommercialTitle] = useState('Analista Comercial');
  const [commercialInitials, setCommercialInitials] = useState('PCM/DRA');
  const [commercialSignature, setCommercialSignature] = useState<string | undefined>(undefined);
  const [formatoSettings, setFormatoSettings] = useState<FormatoSettings | null>(null);
  const [ufValue, setUfValue] = useState<number>(40879.04);
  const [dollarValue, setDollarValue] = useState<number>(933.47);
  const [isRefreshingIndicators, setIsRefreshingIndicators] = useState(false);
  const [showManualIndicatorEdit, setShowManualIndicatorEdit] = useState(false);
  const [customUfInput, setCustomUfInput] = useState<string>('40879.04');
  const [customDollarInput, setCustomDollarInput] = useState<string>('933.47');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUnifiedAiModal, setShowUnifiedAiModal] = useState(false);
  const [unifiedAiTab, setUnifiedAiTab] = useState<'chat' | 'analizar' | 'memoria'>('chat');
  const [assistantChatMessages, setAssistantChatMessages] = useState<DisplayChatMessage[] | null>(null);
  const [assistantActiveAnalisis, setAssistantActiveAnalisis] = useState<AiAnalisisResponse | null>(null);
  const [showIndicatorsInPdf, setShowIndicatorsInPdf] = useState<boolean>(true);

  // Items in current quotation
  const [items, setItems] = useState<CotizacionItem[]>([]);
  // Estado para expandir/ocultar especificaciones y detalles técnicos del ensayo
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const toggleExpandDetail = (id: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleAllDetails = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    items.forEach((it) => {
      next[it.id] = expand;
    });
    setExpandedDetails(next);
  };

  // Commercial conditions & observations for this proposal
  const [observations, setObservations] = useState<string[]>(() => [...DEFAULT_OBSERVACIONES]);
  const [condicionesComerciales, setCondicionesComerciales] = useState<CotizacionCondicionesComerciales>(() =>
    getDefaultCondicionesComerciales('50% AL CONTADO Y 50% CONTRA ENTREGA')
  );

  // Search input and dropdown for tests
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ code: string; explicacion: string }>>([]);
  const [reglasAprendidas, setReglasAprendidas] = useState<ReglaAprendida[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Client search and selection states
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Cliente[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  // Contact search and selection states
  const [selectedContact, setSelectedContact] = useState<Contacto | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSuggestions, setContactSuggestions] = useState<Contacto[]>([]);
  const [contactSearching, setContactSearching] = useState(false);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const contactBlockRef = useRef<HTMLDivElement>(null);

  // Project search and selection states
  const [projectSuggestions, setProjectSuggestions] = useState<Proyecto[]>([]);
  const [projectSearching, setProjectSearching] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);

  // Client create/edit modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingModalClient, setEditingModalClient] = useState<Cliente | null>(null);
  const [clientModalForm, setClientModalForm] = useState({
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
  const [savingClientModal, setSavingClientModal] = useState(false);

  // Saving / PDF states
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [modalMode, setModalMode] = useState<'draft' | 'finalized'>('draft');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Recalculate CLP when UF changes
  const handleUfChange = (newUf: number) => {
    setUfValue(newUf);
    setCustomUfInput(String(newUf));
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        subtotalClp: Math.round(it.subtotalUf * newUf),
      }))
    );
  };

  const fetchIndicators = async (force = false) => {
    setIsRefreshingIndicators(true);
    try {
      const url = force ? '/api/indicadores?refresh=true' : '/api/indicadores';
      const res = await fetch(url);
      if (res.ok) {
        const d: EconomicIndicators = await res.json();
        if (d && d.uf) {
          setIndicators(d);
          handleUfChange(d.uf);
          setDollarValue(d.dolar);
          setCustomDollarInput(String(d.dolar));
          if (force) {
            setStatusMessage({
              type: 'success',
              text: `Indicadores económicos revalidados: UF $${d.uf.toLocaleString('es-CL', { minimumFractionDigits: 2 })} / USD $${d.dolar.toLocaleString('es-CL', { minimumFractionDigits: 2 })} (${d.source || 'Oficial'})`,
            });
          }
        }
      }
    } catch {
      if (force) {
        setStatusMessage({
          type: 'error',
          text: 'Error al consultar indicadores económicos.',
        });
      }
    } finally {
      setIsRefreshingIndicators(false);
    }
  };

  const handleApplyCustomIndicators = () => {
    const parsedUf = parseFloat(customUfInput.replace(',', '.'));
    const parsedDollar = parseFloat(customDollarInput.replace(',', '.'));

    if (isNaN(parsedUf) || parsedUf <= 0) {
      setStatusMessage({
        type: 'error',
        text: 'Debes ingresar un valor numérico válido para la UF.',
      });
      return;
    }

    // Regla de seguridad contra errores humanos de digitación (ej: $3.800 en vez de $38.000)
    if (parsedUf < 30000 || parsedUf > 70000) {
      setStatusMessage({
        type: 'error',
        text: `El valor de UF ($${parsedUf.toLocaleString('es-CL')}) está fuera del rango normal esperado ($30.000 - $70.000 CLP). Por favor verifica que no falte ni sobre un cero.`,
      });
      return;
    }

    if (!isNaN(parsedDollar) && parsedDollar > 0) {
      if (parsedDollar < 500 || parsedDollar > 2500) {
        setStatusMessage({
          type: 'error',
          text: `El valor del Dólar ($${parsedDollar.toLocaleString('es-CL')}) parece fuera de rango ($500 - $2.500 CLP). Por favor verifica la cifra.`,
        });
        return;
      }
      setDollarValue(parsedDollar);
      setCustomDollarInput(String(parsedDollar));
    }

    handleUfChange(parsedUf);
    setShowManualIndicatorEdit(false);
    setStatusMessage({
      type: 'success',
      text: 'Valores de UF y Dólar actualizados y validados para esta cotización.',
    });
  };

  useEffect(() => {
    // Current user
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) {
          setUser(d.user);
          setCommercialName(d.user.name);
        }
      });

    // User profile defaults (commercial title, initials, signature)
    fetch('/api/users/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) {
          if (d.user.commercialTitle) setCommercialTitle(d.user.commercialTitle);
          if (d.user.commercialInitials) setCommercialInitials(d.user.commercialInitials);
          if (d.user.signature) setCommercialSignature(d.user.signature);
        }
      })
      .catch(() => {});

    // Formato settings
    fetch('/api/formato')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.settings) setFormatoSettings(d.settings);
      })
      .catch(() => {});

    // Tarifario
    fetch('/api/tarifario')
      .then((res) => res.json())
      .then((d) => {
        if (d.items) setTarifario(d.items);
      });

    // Reglas aprendidas por uso de los ejecutivos (Opción B)
    fetch('/api/ai/feedback')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.reglas) setReglasAprendidas(d.reglas);
      })
      .catch(() => {});

    // Economic Indicators (Official Banco Central & findic.cl)
    fetchIndicators(false);

    // Correlativo inicial oficial DGL (si es una nueva propuesta)
    if (!editId) {
      fetch('/api/cotizaciones/next-code?centroCosto=2339')
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => {
          if (d?.code) setCode(d.code);
        })
        .catch(() => {});
    }

    // Listen for profile updates from ProfileModal
    const handleProfileUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const u = customEvent.detail;
      if (u) {
        if (u.name) setCommercialName(u.name);
        if (u.commercialTitle) setCommercialTitle(u.commercialTitle);
        if (u.commercialInitials) setCommercialInitials(u.commercialInitials);
        if (u.signature) setCommercialSignature(u.signature);
      }
    };
    window.addEventListener('dgl-profile-updated', handleProfileUpdated);

    // Close dropdowns on outside click
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
      if (contactBlockRef.current && !contactBlockRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false);
      }
      if (projectSearchRef.current && !projectSearchRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('dgl-profile-updated', handleProfileUpdated);
    };
  }, []);

  // Load existing quote if edit param is present
  useEffect(() => {
    if (!editId) return;
    setLoadingExisting(true);
    fetch(`/api/cotizaciones/${editId}`)
      .then((res) => {
        if (!res.ok) throw new Error('No se encontró la cotización');
        return res.json();
      })
      .then((data) => {
        if (data?.cotizacion) {
          const c: Cotizacion = data.cotizacion;
          setOriginalQuote(c);

          const isAlreadyFinalized =
            c.status === 'Finalizada' || c.status === 'Enviada' || c.status === 'Aprobada';

          if (isAlreadyFinalized) {
            // Solo si ya fue finalizada/oficial se crea una nueva versión de trabajo
            setIsVersionMode(true);
            const nextCode = getNextVersionCode(c.code);
            setCode(nextCode);
            setSavedId(null);
            setDate(new Date().toISOString().slice(0, 10)); // Nueva fecha de emisión para nueva versión
            setStatusMessage({
              type: 'success',
              text: `Cotización oficial "${c.code}" (${c.status}) cargada. Se ha generado la nueva versión de trabajo "${nextCode}". Las modificaciones se guardarán como una nueva propuesta sin alterar el registro oficial original.`,
            });
          } else {
            // Si es un borrador en proceso, se continúa editando exactamente el mismo borrador sin incrementar versión
            setIsVersionMode(false);
            setCode(c.code);
            setSavedId(c.id);
            if (c.date) setDate(c.date);
            setStatusMessage({
              type: 'success',
              text: `Borrador "${c.code}" cargado para edición continua. Los cambios se actualizarán sobre este mismo documento.`,
            });
          }

          if (c.city) setCity(c.city);
          if (c.clientName) setClientName(c.clientName);
          if (c.clientRut) setClientRut(c.clientRut);
          if (c.clientAttention) setClientAttention(c.clientAttention);
          if (c.clientPhone) setClientPhone(c.clientPhone);
          if (c.clientEmail) setClientEmail(c.clientEmail);
          if (c.reference) setReference(c.reference);
          if (c.projectName) setProjectName(c.projectName);
          if (c.projectId) setProjectId(c.projectId);
          if (c.centroCosto) {
            setCentroCosto(c.centroCosto);
          } else {
            const foundCc = CENTROS_DE_COSTO.find((cc) => cc.startsWith(c.code.split('.')[2] || ''));
            if (foundCc) setCentroCosto(foundCc);
          }
          if (c.currency) setCurrency(c.currency);
          if (c.commercialName) setCommercialName(c.commercialName);
          if (c.commercialTitle) setCommercialTitle(c.commercialTitle);
          if (c.commercialInitials) setCommercialInitials(c.commercialInitials);
          if (c.commercialSignature) setCommercialSignature(c.commercialSignature);
          if (c.ufValue) setUfValue(c.ufValue);
          if (c.dollarValue) setDollarValue(c.dollarValue);
          if (c.paymentCondition) setPaymentCondition(c.paymentCondition);
          if (Array.isArray(c.observations) && c.observations.length > 0) {
            setObservations(c.observations);
          } else {
            setObservations([...DEFAULT_OBSERVACIONES]);
          }
          if (c.condicionesComerciales) {
            setCondicionesComerciales(c.condicionesComerciales);
          } else {
            setCondicionesComerciales(getDefaultCondicionesComerciales(c.paymentCondition));
          }
          if (c.showEconomicIndicators !== undefined) {
            setShowIndicatorsInPdf(c.showEconomicIndicators !== false);
          }
          if (Array.isArray(c.items)) setItems(c.items);
          if (c.aiChatState?.messages && Array.isArray(c.aiChatState.messages) && c.aiChatState.messages.length > 0) {
            setAssistantChatMessages(c.aiChatState.messages);
            if (c.aiChatState.activeAnalisis) {
              setAssistantActiveAnalisis(c.aiChatState.activeAnalisis);
            }
          } else {
            setAssistantChatMessages(null);
            setAssistantActiveAnalisis(null);
          }
        }
      })
      .catch((err) => {
        console.error('Error cargando cotización para editar:', err);
        setStatusMessage({
          type: 'error',
          text: 'No se pudo cargar la cotización seleccionada para edición.',
        });
      })
      .finally(() => setLoadingExisting(false));
  }, [editId]);

  const handleCentroCostoChange = (newCc: string) => {
    setCentroCosto(newCc);
    if (!isVersionMode && !savedId) {
      fetch(`/api/cotizaciones/next-code?centroCosto=${encodeURIComponent(newCc)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.code) {
            setCode(data.code);
          } else {
            setCode((prevCode) => updateCodeWithCc(prevCode, newCc));
          }
        })
        .catch(() => {
          setCode((prevCode) => updateCodeWithCc(prevCode, newCc));
        });
    } else {
      setCode((prevCode) => updateCodeWithCc(prevCode, newCc));
    }
  };

  // Predictive search for clients
  useEffect(() => {
    if (!clientSearchQuery.trim() || clientSearchQuery.trim().length < 2) {
      setClientSuggestions([]);
      return;
    }

    setClientSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/clientes?q=${encodeURIComponent(clientSearchQuery.trim())}&limit=10`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.clientes) {
            setClientSuggestions(data.clientes);
            setClientDropdownOpen(true);
          }
        })
        .catch(() => {})
        .finally(() => setClientSearching(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [clientSearchQuery]);

  // Client Selection Handlers
  const handleSelectClient = (c: Cliente) => {
    setSelectedClient(c);
    setClientName(c.name);
    setClientRut(c.rut);
    if (c.phone) setClientPhone(c.phone);
    if (c.email) setClientEmail(c.email);
    if (c.contactPerson) setClientAttention(c.contactPerson);
    if (c.paymentCondition) setPaymentCondition(c.paymentCondition);
    setClientSearchQuery('');
    setClientDropdownOpen(false);
    setStatusMessage({
      type: 'success',
      text: `Empresa "${c.name}" asignada a la cotización.`,
    });
  };

  // Predictive search for contacts
  useEffect(() => {
    if (!contactSearchQuery.trim() || contactSearchQuery.trim().length < 2) {
      setContactSuggestions([]);
      return;
    }

    setContactSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/contactos?q=${encodeURIComponent(contactSearchQuery.trim())}&limit=8`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.contactos) {
            setContactSuggestions(data.contactos);
            setContactDropdownOpen(data.contactos.length > 0);
          }
        })
        .catch(() => {})
        .finally(() => setContactSearching(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [contactSearchQuery]);

  // Predictive search for projects
  useEffect(() => {
    if (!projectName.trim() || projectName.trim().length < 2) {
      setProjectSuggestions([]);
      return;
    }

    if (projectId) {
      return;
    }

    setProjectSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/proyectos?q=${encodeURIComponent(projectName.trim())}&limit=8`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.proyectos) {
            setProjectSuggestions(data.proyectos);
            setProjectDropdownOpen(data.proyectos.length > 0);
          }
        })
        .catch(() => {})
        .finally(() => setProjectSearching(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [projectName, projectId]);

  const handleSelectContact = (c: Contacto) => {
    setSelectedContact(c);
    setClientAttention(c.name);
    setClientPhone(c.phone || '');
    setClientEmail(c.email);
    setContactDropdownOpen(false);
    setContactSearchQuery('');
    setStatusMessage({
      type: 'success',
      text: `Contacto "${c.name}" (${c.email}) vinculado.`,
    });
  };

  const handleSelectProject = (p: Proyecto) => {
    setProjectName(p.name);
    setProjectId(p.id);
    if (p.reference) setReference(p.reference);
    if (p.city) setCity(p.city);
    setProjectDropdownOpen(false);
    setStatusMessage({
      type: 'success',
      text: `Proyecto "${p.name}" [${p.id}] asignado.`,
    });
  };

  // Pre-load project, client, or contact from URL query params (when not editing an existing quote)
  useEffect(() => {
    if (editId) return;

    const paramProjectId = searchParams.get('projectId') || searchParams.get('project');
    const paramClient = searchParams.get('client');
    const paramContactEmail = searchParams.get('contactEmail');

    if (paramProjectId) {
      fetch(`/api/proyectos?q=${encodeURIComponent(paramProjectId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.proyectos && data.proyectos.length > 0) {
            const p: Proyecto = data.proyectos[0];
            handleSelectProject(p);
            if (p.clientName) {
              fetch(`/api/clientes?q=${encodeURIComponent(p.clientName)}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((cd) => {
                  if (cd?.clientes && cd.clientes.length > 0) {
                    handleSelectClient(cd.clientes[0]);
                  } else {
                    setClientName(p.clientName || '');
                  }
                })
                .catch(() => setClientName(p.clientName || ''));
            }
          }
        })
        .catch((err) => console.error('Error preloading project:', err));
    } else if (paramClient) {
      fetch(`/api/clientes?q=${encodeURIComponent(paramClient)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.clientes && data.clientes.length > 0) {
            handleSelectClient(data.clientes[0]);
          }
        })
        .catch((err) => console.error('Error preloading client:', err));
    }

    if (paramContactEmail) {
      fetch(`/api/contactos?q=${encodeURIComponent(paramContactEmail)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.contactos && data.contactos.length > 0) {
            handleSelectContact(data.contactos[0]);
          }
        })
        .catch((err) => console.error('Error preloading contact:', err));
    }
  }, [editId, searchParams]);

  const handleOpenNewClientModal = () => {
    setEditingModalClient(null);
    setClientModalForm({
      name: clientName || '',
      rut: clientRut || '',
      comuna: '',
      address: '',
      giro: '',
      phone: clientPhone || '',
      paymentCondition: '50% AL CONTADO Y 50% CONTRA ENTREGA',
      email: clientEmail || '',
      contactPerson: clientAttention || '',
    });
    setShowClientModal(true);
  };

  const handleOpenEditClientModal = () => {
    if (!selectedClient) return;
    setEditingModalClient(selectedClient);
    setClientModalForm({
      name: selectedClient.name,
      rut: selectedClient.rut,
      comuna: selectedClient.comuna,
      address: selectedClient.address,
      giro: selectedClient.giro,
      phone: selectedClient.phone,
      paymentCondition: selectedClient.paymentCondition,
      email: selectedClient.email,
      contactPerson: selectedClient.contactPerson,
    });
    setShowClientModal(true);
  };

  const handleSaveClientModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientModalForm.name.trim() || !clientModalForm.rut.trim()) {
      alert('Razón Social y RUT son requeridos.');
      return;
    }

    setSavingClientModal(true);
    try {
      if (editingModalClient) {
        const res = await fetch(`/api/clientes/${editingModalClient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientModalForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar');

        handleSelectClient(data.cliente);
        setShowClientModal(false);
        setStatusMessage({
          type: 'success',
          text: `Empresa "${data.cliente.name}" actualizada con éxito.`,
        });
      } else {
        const res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientModalForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear');

        handleSelectClient(data.cliente);
        setShowClientModal(false);
        setStatusMessage({
          type: 'success',
          text: `Empresa "${data.cliente.name}" registrada y vinculada a la cotización.`,
        });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar cliente');
    } finally {
      setSavingClientModal(false);
    }
  };

  // Filter tarifario using smart geotechnical search (0ms instant normalization + reglas aprendidas)
  const localSmartResults = useMemo(() => {
    return smartSearchTarifario(tarifario, searchQuery, 20, reglasAprendidas);
  }, [tarifario, searchQuery, reglasAprendidas]);

  // Combine local smart results with AI suggestions (if any)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const aiItems: Array<{
      id: string;
      item: TarifarioItem;
      matchReason?: string;
      isAiSuggested: boolean;
      isLearnedRule?: boolean;
    }> = [];
    const seenCodes = new Set<string>();

    // Process AI suggestions first if available
    if (aiSuggestions.length > 0) {
      for (const sug of aiSuggestions) {
        const found = tarifario.find(
          (t) => t.code === sug.code || (sug.code && t.sku === sug.code)
        );
        if (found && !seenCodes.has(found.code)) {
          seenCodes.add(found.code);
          aiItems.push({
            id: found.id,
            item: found,
            matchReason: sug.explicacion,
            isAiSuggested: true,
            isLearnedRule: sug.explicacion?.includes('🧠'),
          });
        }
      }
    }

    // Merge local smart results
    const merged = [...aiItems];
    for (const r of localSmartResults) {
      if (!seenCodes.has(r.item.code)) {
        seenCodes.add(r.item.code);
        merged.push({
          id: r.item.id,
          item: r.item,
          matchReason: r.matchReason,
          isAiSuggested: false,
          isLearnedRule: r.isLearnedRule,
        });
      }
    }

    return merged.slice(0, 15);
  }, [tarifario, searchQuery, localSmartResults, aiSuggestions]);

  // Trigger AI semantic search for tests
  const handleTriggerAiSearch = async () => {
    const q = searchQuery.trim();
    if (!q || aiSearching) return;

    setAiSearching(true);
    setDropdownOpen(true);
    try {
      const res = await fetch('/api/ai/buscar-ensayos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sugerencias) && data.sugerencias.length > 0) {
          setAiSuggestions(data.sugerencias);
        } else {
          setStatusMessage({
            type: 'error',
            text: `No se encontraron sugerencias adicionales de IA para "${q}".`,
          });
        }
      }
    } catch (err) {
      console.warn('Error en búsqueda con IA:', err);
    } finally {
      setAiSearching(false);
    }
  };

  // Add item from catalog to quotation
  const handleAddItem = (tarifarioItem: TarifarioItem) => {
    const newItem: CotizacionItem = {
      id: `ci-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemNumber: `1.1.${items.length + 1}`,
      code: tarifarioItem.code,
      designation: tarifarioItem.designation,
      norm: tarifarioItem.norm,
      minWeightKg: tarifarioItem.minWeightKg,
      unit: tarifarioItem.unit,
      ufPrice: tarifarioItem.ufPrice,
      factor: 1.0,
      quantity: 1,
      subtotalUf: tarifarioItem.ufPrice,
      subtotalClp: Math.round(tarifarioItem.ufPrice * ufValue),
      sku: tarifarioItem.sku,
    };

    setItems((prev) => [...prev, newItem]);

    // Reforzar aprendizaje de equivalencia por selección directa en el buscador
    const currentQuery = searchQuery.trim();
    if (currentQuery.length >= 3) {
      fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminoUsuario: currentQuery,
          codigoEnsayo: tarifarioItem.code,
          origen: 'buscador_ensayos',
        }),
      }).catch(() => {});
    }

    setSearchQuery('');
    setAiSuggestions([]);
    setDropdownOpen(false);
  };

  // Update item field (quantity or factor)
  const handleItemChange = (id: string, field: 'quantity' | 'factor', val: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newQty = field === 'quantity' ? Math.max(0, val) : it.quantity;
        const newFactor = field === 'factor' ? Math.max(0, val) : it.factor;
        const newSubtotalUf = Math.round(it.ufPrice * newFactor * newQty * 100) / 100;
        const newSubtotalClp = Math.round(newSubtotalUf * ufValue);

        return {
          ...it,
          quantity: newQty,
          factor: newFactor,
          subtotalUf: newSubtotalUf,
          subtotalClp: newSubtotalClp,
        };
      })
    );
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    setItems((prev) =>
      prev
        .filter((it) => it.id !== id)
        .map((it, idx) => ({ ...it, itemNumber: `1.1.${idx + 1}` }))
    );
  };

  // Reorganizar orden de ensayos (Mover y Drag & Drop)
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return;
    setItems((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((it, idx) => ({ ...it, itemNumber: `1.1.${idx + 1}` }));
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch {}
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverItemIndex !== index) {
      setDragOverItemIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
      handleMoveItem(draggedItemIndex, targetIndex);
    }
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  // Totals calculations
  const totals = useMemo(() => {
    let totalUf = 0;
    let totalClp = 0;
    let totalWeight = 0;

    items.forEach((it) => {
      totalUf += it.subtotalUf;
      totalClp += it.subtotalClp;
      const w = typeof it.minWeightKg === 'number' ? it.minWeightKg : parseFloat(String(it.minWeightKg));
      if (!isNaN(w) && w > 0) {
        totalWeight += w * it.quantity;
      }
    });

    return {
      totalUf: Math.round(totalUf * 100) / 100,
      totalClp: Math.round(totalClp),
      totalWeight: Math.round(totalWeight * 10) / 10,
    };
  }, [items]);

  const totalUsd = useMemo(() => {
    const ufVal = ufValue || 40879.04;
    const usdVal = dollarValue || 933.47;
    return Math.round(((totals.totalUf * ufVal) / usdVal) * 100) / 100;
  }, [totals.totalUf, ufValue, dollarValue]);

  // Build current cotizacion object
  const currentCotizacion: Cotizacion = useMemo(() => {
    return {
      id: savedId || `cot-${Date.now()}`,
      code,
      date,
      clientName: clientName.trim() || 'RAZÓN SOCIAL',
      clientRut: clientRut.trim(),
      clientAttention: clientAttention.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      reference: reference.trim(),
      projectName: projectName.trim(),
      projectId: projectId || undefined,
      city,
      paymentCondition,
      centroCosto,
      currency,
      commercialName,
      commercialTitle,
      commercialInitials,
      commercialSignature,
      ufValue,
      dollarValue,
      items,
      totalUf: totals.totalUf,
      totalClp: totals.totalClp,
      totalUsd,
      totalWeightKg: totals.totalWeight,
      observations,
      condicionesComerciales,
      showEconomicIndicators: showIndicatorsInPdf,
      status: 'Borrador' as const,
      aiChatState: assistantChatMessages && assistantChatMessages.length > 0 ? {
        messages: assistantChatMessages,
        activeAnalisis: assistantActiveAnalisis,
        updatedAt: new Date().toISOString(),
      } : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user?.name || 'Comercial',
    };
  }, [
    savedId,
    code,
    date,
    clientName,
    clientRut,
    clientAttention,
    clientPhone,
    clientEmail,
    reference,
    projectName,
    projectId,
    city,
    paymentCondition,
    centroCosto,
    currency,
    commercialName,
    commercialTitle,
    commercialInitials,
    commercialSignature,
    ufValue,
    dollarValue,
    items,
    totals,
    totalUsd,
    observations,
    condicionesComerciales,
    showIndicatorsInPdf,
    user,
    assistantChatMessages,
    assistantActiveAnalisis,
  ]);

  // Save draft quote to database (no PDF generation)
  const handleSaveDraft = async () => {
    if (!clientName.trim()) {
      setStatusMessage({ type: 'error', text: 'Debe ingresar o vincular la Razón Social del cliente.' });
      return;
    }
    if (items.length === 0) {
      setStatusMessage({ type: 'error', text: 'Debe agregar al menos un ensayo a la cotización.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      // Ensure active signature from profile
      let activeSig = commercialSignature;
      if (!activeSig || activeSig.length < 200) {
        try {
          const pRes = await fetch('/api/users/profile');
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData?.user?.signature && pData.user.signature.length > 200) {
              activeSig = pData.user.signature;
              setCommercialSignature(activeSig);
            }
          }
        } catch {}
      }

      const cotizacionToSave = {
        ...currentCotizacion,
        commercialSignature: activeSig || currentCotizacion.commercialSignature,
        status: 'Borrador' as const,
      };

      const res = await fetch('/api/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cotizacionToSave),
      });

      const d = await res.json();
      if (res.ok && d.cotizacion) {
        setSavedId(d.cotizacion.id);
        if (d.cotizacion.projectId) {
          setProjectId(d.cotizacion.projectId);
        }
        if (isVersionMode) {
          setOriginalQuote(d.cotizacion);
          setIsVersionMode(false);
        }
        setModalMode('draft');
        setShowSuccessModal(true);
        setStatusMessage({
          type: 'success',
          text: isVersionMode
            ? `¡Nueva versión "${d.cotizacion.code}" guardada como borrador con éxito!`
            : `Cotización ${d.cotizacion.code} guardada como borrador. Puede seguir editándola cuando lo requiera.`,
        });
      } else {
        setStatusMessage({ type: 'error', text: d.error || 'Error al guardar el borrador.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error al comunicarse con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

    // Finalizar cotización: guardar con estado 'Finalizada' y descargar PDF oficial limpio
  const handleFinalize = async () => {
    // Validar autorización del usuario para finalizar
    if (user && !isAdminRole(user.role) && !hasPermission(user, 'cotizador.descargar_definitivo')) {
      alert(
        'Tu perfil de usuario no cuenta con autorización para finalizar y emitir cotizaciones definitivas. Por favor utiliza la opción "Descargar Borrador (PDF)" para revisión técnica de jefatura.'
      );
      return;
    }

    if (!clientName.trim()) {
      alert('Debe ingresar o vincular la Razón Social del cliente antes de finalizar.');
      return;
    }
    if (items.length === 0) {
      alert('Debe agregar al menos un ensayo antes de finalizar la cotización.');
      return;
    }

    setGeneratingPdf(true);
    try {
      // Asegurar firma comercial activa
      let activeSig = commercialSignature;
      if (!activeSig || activeSig.length < 200) {
        try {
          const pRes = await fetch('/api/users/profile');
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData?.user?.signature && pData.user.signature.length > 200) {
              activeSig = pData.user.signature;
              setCommercialSignature(activeSig);
            }
          }
        } catch {}
      }

      // Logotipo institucional IDIEM
      let logoBase64: string | undefined = formatoSettings?.headerImage;
      if (!logoBase64) {
        try {
          const imgRes = await fetch('/logo_125.png');
          const blob = await imgRes.blob();
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (err) {
          console.warn('No se pudo cargar el logo institucional:', err);
        }
      }

      const cotizacionForPdf: Cotizacion = {
        ...currentCotizacion,
        commercialSignature: activeSig || currentCotizacion.commercialSignature,
        showEconomicIndicators: showIndicatorsInPdf,
        status: 'Finalizada',
      };

      // 1. Generar y descargar el PDF oficial limpio (sin marca de agua de borrador)
      const doc = generateCotizacionPdf(cotizacionForPdf, logoBase64, formatoSettings || undefined, {
        isDraft: false,
        showEconomicIndicators: showIndicatorsInPdf,
      });
      const cleanCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Cotizacion_${cleanCode}_${(clientName || 'Cliente').replace(/\s+/g, '_')}.pdf`;
      doc.save(filename);

      // 2. Persistir en base de datos con estado 'Finalizada'
      try {
        const res = await fetch('/api/cotizaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cotizacionForPdf),
        });
        const d = await res.json();
        if (res.ok && d.cotizacion) {
          setSavedId(d.cotizacion.id);
          if (d.cotizacion.projectId) {
            setProjectId(d.cotizacion.projectId);
          }
          if (isVersionMode) {
            setOriginalQuote(d.cotizacion);
            setIsVersionMode(false);
          }
        }
      } catch (saveErr) {
        console.warn('Error al guardar cotización finalizada:', saveErr);
      }

      // 3. Si hubo diálogo con el Asistente IA, registrarlo en la Bibliografía Histórica
      if (assistantChatMessages && assistantChatMessages.some((m) => m.role === 'user')) {
        try {
          const transcript = assistantChatMessages
            .map((m) => `[${m.role === 'user' ? 'EJECUTIVO COMERCIAL' : 'ASISTENTE IA'}] (${m.timestamp}):\n${m.content}`)
            .join('\n\n');

          const itemsSummary = items
            .map((it) => `- [Cód ${it.code}] ${it.designation} (${it.quantity} ${it.unit || 'c/u'}) - UF ${it.ufPrice}`)
            .join('\n');

          fetch('/api/bibliografia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'historica',
              titulo: `Cotización Finalizada ${code} - ${clientName || 'Cliente'} (${new Date().toLocaleDateString('es-CL')})`,
              descripcion: `Cotización oficial emitida con ${items.length} ensayos por valor UF ${cotizacionForPdf.totalUf?.toFixed(2) || '0'}.`,
              contenidoTexto: `COTIZACIÓN OFICIAL: ${code}\nCLIENTE: ${clientName}\nPROYECTO: ${projectName}\nCENTRO DE COSTO: ${centroCosto}\n\nBATERÍA DE ENSAYOS FINALIZADA:\n${itemsSummary}\n\nHISTORIAL DE CONSULTAS Y DIÁLOGO CON IA:\n${transcript}`,
              tipoArchivo: 'chat',
              tags: ['Cotización Finalizada', 'Histórica', centroCosto.slice(0, 4)],
              metadatos: {
                cliente: clientName,
                proyecto: projectName,
                centroCosto: centroCosto,
                codigoCotizacion: code,
                totalUf: cotizacionForPdf.totalUf,
              },
            }),
          }).catch((e) => console.error('Error archivando cotización finalizada en histórica:', e));
        } catch (archErr) {
          console.error('Error registrando bibliografía histórica:', archErr);
        }
      }

      // 4. Forzar reinicio del asistente IA para comenzar con chat limpio en futuras cotizaciones
      setAssistantChatMessages(null);
      setAssistantActiveAnalisis(null);

      setModalMode('finalized');
      setShowSuccessModal(true);
      setStatusMessage({
        type: 'success',
        text: `Cotización ${code} finalizada con éxito y documento PDF oficial emitido.`,
      });
    } catch (err) {
      console.error('Error al finalizar cotización:', err);
      alert('Error al finalizar y generar el archivo PDF oficial.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Descargar PDF preliminar en Borrador (mantiene estado 'Borrador' y añade marca de agua)
  const handleDownloadDraftPdf = async () => {
    if (!clientName.trim()) {
      alert('Debe ingresar o vincular la Razón Social del cliente antes de descargar el borrador.');
      return;
    }
    if (items.length === 0) {
      alert('Debe agregar al menos un ensayo para generar el PDF en borrador.');
      return;
    }

    setGeneratingPdf(true);
    try {
      let activeSig = commercialSignature;
      if (!activeSig || activeSig.length < 200) {
        try {
          const pRes = await fetch('/api/users/profile');
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData?.user?.signature && pData.user.signature.length > 200) {
              activeSig = pData.user.signature;
              setCommercialSignature(activeSig);
            }
          }
        } catch {}
      }

      let logoBase64: string | undefined = formatoSettings?.headerImage;
      if (!logoBase64) {
        try {
          const imgRes = await fetch('/logo_125.png');
          const blob = await imgRes.blob();
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (err) {
          console.warn('No se pudo cargar el logo institucional:', err);
        }
      }

      const cotizacionForPdf: Cotizacion = {
        ...currentCotizacion,
        commercialSignature: activeSig || currentCotizacion.commercialSignature,
        showEconomicIndicators: showIndicatorsInPdf,
        status: 'Borrador',
      };

      // 1. Guardar en base de datos como Borrador
      try {
        const res = await fetch('/api/cotizaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cotizacionForPdf),
        });
        const d = await res.json();
        if (res.ok && d.cotizacion) {
          setSavedId(d.cotizacion.id);
          if (d.cotizacion.projectId) {
            setProjectId(d.cotizacion.projectId);
          }
          if (isVersionMode) {
            setOriginalQuote(d.cotizacion);
            setIsVersionMode(false);
          }
        }
      } catch (saveErr) {
        console.warn('Error al guardar borrador en base de datos:', saveErr);
      }

      // 2. Generar y descargar PDF con marca de agua BORRADOR
      const doc = generateCotizacionPdf(cotizacionForPdf, logoBase64, formatoSettings || undefined, {
        isDraft: true,
        showEconomicIndicators: showIndicatorsInPdf,
      });
      const cleanCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Borrador_Cotizacion_${cleanCode}_${(clientName || 'Cliente').replace(/\s+/g, '_')}.pdf`;
      doc.save(filename);

      setStatusMessage({
        type: 'success',
        text: `Borrador de cotización ${code} descargado en PDF (con marca de agua "BORRADOR"). El estado comercial permanece en Borrador.`,
      });
    } catch (err) {
      console.error('Error al generar PDF en borrador:', err);
      alert('Error al generar el archivo PDF en borrador.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Re-download PDF without changing status
  const handleDownloadPdfOnly = async () => {
    setGeneratingPdf(true);
    try {
      let activeSig = commercialSignature;
      if (!activeSig || activeSig.length < 200) {
        try {
          const pRes = await fetch('/api/users/profile');
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData?.user?.signature && pData.user.signature.length > 200) {
              activeSig = pData.user.signature;
              setCommercialSignature(activeSig);
            }
          }
        } catch {}
      }

      let logoBase64: string | undefined = formatoSettings?.headerImage;
      if (!logoBase64) {
        try {
          const imgRes = await fetch('/logo_125.png');
          const blob = await imgRes.blob();
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (err) {
          console.warn('Could not load idiem_logo for PDF:', err);
        }
      }

      const cotizacionForPdf: Cotizacion = {
        ...currentCotizacion,
        commercialSignature: activeSig || currentCotizacion.commercialSignature,
        status: 'Finalizada',
      };

      const doc = generateCotizacionPdf(cotizacionForPdf, logoBase64, formatoSettings || undefined);
      const cleanCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Cotizacion_${cleanCode}_${(clientName || 'Cliente').replace(/\s+/g, '_')}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Error downloading PDF copy:', err);
      alert('Error al generar el archivo PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Reset form
  const handleReset = () => {
    if (items.length > 0 && !confirm('¿Desea limpiar el formulario y comenzar una nueva cotización?')) {
      return;
    }
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const defaultCc = '2339 - Ensayos Rocas';
    setCentroCosto(defaultCc);
    setCode(`PR.DGL.2339.${year}.${rand}-V1`);
    setDate(new Date().toISOString().slice(0, 10));
    setCity('Santiago');
    setCurrency('UF');
    setClientName('');
    setClientRut('');
    setClientAttention('');
    setClientPhone('');
    setClientEmail('');
    setProjectName('');
    setReference('Ensayos Geotécnicos');
    setItems([]);
    setSelectedClient(null);
    setClientSearchQuery('');
    setPaymentCondition('50% AL CONTADO Y 50% CONTRA ENTREGA');
    setObservations([...DEFAULT_OBSERVACIONES]);
    setCondicionesComerciales(getDefaultCondicionesComerciales('50% AL CONTADO Y 50% CONTRA ENTREGA'));
    setSavedId(null);
    setOriginalQuote(null);
    setIsVersionMode(false);
    setShowIndicatorsInPdf(true);
    setStatusMessage(null);
    setShowSuccessModal(false);
    setAssistantChatMessages(null);
    setAssistantActiveAnalisis(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/cotizador');
    }
  };

  // Aplicar las acciones estructuradas emitidas por el Asistente IA Técnico-Comercial DGL
  const handleApplyAiChatActions = (
    acciones: AiChatAction[],
    itemsCompletos: TarifarioItem[]
  ) => {
    setItems((prevItems) => {
      let updated = [...prevItems];

      for (const act of acciones) {
        if (act.tipo === 'AGREGAR' && act.codigo) {
          const tarifarioItem =
            itemsCompletos.find((it) => it.code === act.codigo) ||
            tarifario.find((it) => it.code === act.codigo);

          if (tarifarioItem) {
            const existingIdx = updated.findIndex((it) => it.code === tarifarioItem.code);
            const qtyToAdd = act.cantidad || 1;
            const factorToApply = act.factor !== undefined ? act.factor : 1.0;

            if (existingIdx !== -1) {
              const newQty = updated[existingIdx].quantity + qtyToAdd;
              const subUf = tarifarioItem.ufPrice * factorToApply * newQty;
              const subClp = Math.round(subUf * ufValue);
              updated[existingIdx] = {
                ...updated[existingIdx],
                quantity: newQty,
                factor: factorToApply,
                subtotalUf: subUf,
                subtotalClp: subClp,
              };
            } else {
              const subUf = tarifarioItem.ufPrice * factorToApply * qtyToAdd;
              const subClp = Math.round(subUf * ufValue);
              updated.push({
                id: `cot-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                itemNumber: `1.1.${updated.length + 1}`,
                code: tarifarioItem.code,
                designation: tarifarioItem.designation,
                norm: tarifarioItem.norm,
                minWeightKg: tarifarioItem.minWeightKg,
                unit: tarifarioItem.unit,
                ufPrice: tarifarioItem.ufPrice,
                factor: factorToApply,
                quantity: qtyToAdd,
                subtotalUf: subUf,
                subtotalClp: subClp,
                sku: tarifarioItem.sku,
              });
            }
          }
        } else if (act.tipo === 'MODIFICAR_CANTIDAD' && act.codigo) {
          const idx = updated.findIndex((it) => it.code === act.codigo);
          if (idx !== -1 && act.cantidad && act.cantidad > 0) {
            const subUf = updated[idx].ufPrice * updated[idx].factor * act.cantidad;
            const subClp = Math.round(subUf * ufValue);
            updated[idx] = {
              ...updated[idx],
              quantity: act.cantidad,
              subtotalUf: subUf,
              subtotalClp: subClp,
            };
          }
        } else if (act.tipo === 'ELIMINAR' && act.codigo) {
          updated = updated.filter((it) => it.code !== act.codigo);
        } else if (act.tipo === 'APLICAR_FACTOR') {
          const factorVal = act.factor !== undefined ? act.factor : 1.0;
          if (act.codigo) {
            const idx = updated.findIndex((it) => it.code === act.codigo);
            if (idx !== -1) {
              const subUf = updated[idx].ufPrice * factorVal * updated[idx].quantity;
              const subClp = Math.round(subUf * ufValue);
              updated[idx] = {
                ...updated[idx],
                factor: factorVal,
                subtotalUf: subUf,
                subtotalClp: subClp,
              };
            }
          } else {
            updated = updated.map((it) => {
              const subUf = it.ufPrice * factorVal * it.quantity;
              const subClp = Math.round(subUf * ufValue);
              return { ...it, factor: factorVal, subtotalUf: subUf, subtotalClp: subClp };
            });
          }
        } else if (act.tipo === 'APLICAR_FACTOR_GLOBAL') {
          const factorVal = act.factor !== undefined ? act.factor : 1.0;
          updated = updated.map((it) => {
            const subUf = it.ufPrice * factorVal * it.quantity;
            const subClp = Math.round(subUf * ufValue);
            return { ...it, factor: factorVal, subtotalUf: subUf, subtotalClp: subClp };
          });
        } else if (act.tipo === 'LIMPIAR_TODO') {
          updated = [];
        }
      }

      return updated.map((it, i) => ({
        ...it,
        itemNumber: `1.1.${i + 1}`,
      }));
    });

    setStatusMessage({
      type: 'success',
      text: `El Asistente IA DGL ejecutó ${acciones.length} cambio(s) en la propuesta.`,
    });
  };

  const handleApplyAiSuggestions = (data: {
    datosProyecto?: AiDatosProyecto;
    ensayos: AiEnsayoSugerido[];
    centroCosto: string | null;
    observacionesComerciales?: string;
  }) => {
    // 1. Update Centro de Costo if suggested for the test campaign
    if (data.centroCosto) {
      const validCc = CENTROS_DE_COSTO.find((c) =>
        c.startsWith(data.centroCosto?.slice(0, 4) || '')
      );
      if (validCc) {
        setCentroCosto(validCc);
        setCode((prevCode) => updateCodeWithCc(prevCode, validCc));
      }
    }

    // 2. Map and append suggested essays (Campaña de Ensayos)
    if (data.ensayos && data.ensayos.length > 0) {
      const currentCount = items.length;
      const newItems: CotizacionItem[] = data.ensayos.map((e, idx) => {
        const itemNumber = `1.${currentCount + idx + 1}`;
        const subtotalUf = e.precio_uf * e.cantidad_estimada;
        const subtotalClp = Math.round(subtotalUf * ufValue);

        return {
          id: `ai-${Date.now()}-${idx}`,
          itemNumber,
          code: e.codigo,
          designation: e.designacion,
          norm: e.norma,
          minWeightKg: 0,
          unit: e.unidad || 'c/u',
          ufPrice: e.precio_uf,
          factor: 1.0,
          quantity: e.cantidad_estimada,
          subtotalUf: Number(subtotalUf.toFixed(2)),
          subtotalClp,
          sku: e.sku,
        };
      });

      setItems((prev) => [...prev, ...newItems]);

      // Retroalimentar el sistema de aprendizaje continuo (Opción B)
      for (const e of data.ensayos) {
        fetch('/api/ai/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            terminoUsuario: e.designacion,
            codigoEnsayo: e.codigo,
            origen: 'analisis_solicitud',
          }),
        }).catch(() => {});
      }
    }

    // 4. Append technical/commercial observation to proposal's particular clauses if provided
    if (data.observacionesComerciales && data.observacionesComerciales.trim()) {
      const obsText = data.observacionesComerciales.trim();
      setCondicionesComerciales((prev) => ({
        ...prev,
        clausulasParticulares: Array.from(new Set([...(prev.clausulasParticulares || []), obsText])),
      }));

      // Retroalimentar observación frecuente
      fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminoUsuario: data.datosProyecto?.nombre_obra || 'Observación de Campaña',
          observacionSugerida: obsText,
          origen: 'analisis_solicitud',
        }),
      }).catch(() => {});
    }

    setStatusMessage({
      type: 'success',
      text: `¡Se cargaron exitosamente ${data.ensayos?.length || 0} ensayos estimados para la campaña!`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1">
        {/* Top Header - Compact */}
        <div className="bg-white rounded-xl px-4 py-2.5 border border-slate-200 shadow-xs mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Generador de Cotizaciones
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Tarifario Oficial
              </span>
            </h1>
            <span className="hidden lg:inline text-slate-300">|</span>
            <p className="hidden lg:inline text-xs text-slate-500">
              Búsqueda predictiva, cálculo automático y generación instantánea de propuestas oficiales.
            </p>
          </div>
        </div>

        {/* Edit / Version Mode Banner (Creating new version from finalized quote) */}
        {isVersionMode && originalQuote && (
          <div className="mb-3.5 p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs text-xs text-amber-950">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Edit3 className="w-3 h-3" />
                Modo Edición / Nueva Versión
              </span>
              <span>
                Editando a partir de la propuesta oficial <strong className="font-mono">{originalQuote.code}</strong> ({originalQuote.status}). Al guardar se registrará una nueva versión con código <strong className="font-mono text-blue-900 bg-white px-1.5 py-0.5 rounded border border-amber-300 font-bold">{code}</strong> manteniendo el original oficial intacto en el historial.
              </span>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <Link
                href="/cotizaciones"
                className="text-amber-900 hover:text-amber-950 font-semibold underline"
              >
                Ver Historial
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="text-amber-800 hover:text-amber-950 font-medium underline cursor-pointer"
              >
                Crear en Blanco
              </button>
            </div>
          </div>
        )}

        {/* Draft Edit Mode Banner (Editing existing draft in-place) */}
        {!isVersionMode && originalQuote && originalQuote.status === 'Borrador' && (
          <div className="mb-3.5 p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs text-xs text-blue-950">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Modo Edición de Borrador
              </span>
              <span>
                Editando cotización en borrador <strong className="font-mono text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-300 font-bold">{code}</strong>. Todas las modificaciones se actualizarán directamente sobre este mismo documento.
              </span>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <Link
                href="/cotizaciones"
                className="text-blue-900 hover:text-blue-950 font-semibold underline"
              >
                Ver Historial
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="text-blue-800 hover:text-blue-950 font-medium underline cursor-pointer"
              >
                Crear en Blanco
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center gap-3 border text-sm ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="ml-auto text-xs opacity-60 hover:opacity-100"
            >
              Cerrar
            </button>
          </div>
        )}


        {/* 3 Blocks: 1. Empresa | 2. Contacto | 3. Proyecto y Presupuesto */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mb-3.5">
          {/* ================= BLOQUE 1: EMPRESA ================= */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-700" />
                  <span>1. Empresa Cliente</span>
                </h2>
                <button
                  type="button"
                  onClick={handleOpenNewClientModal}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>+ Nueva</span>
                </button>
              </div>

              {/* Predictive Search Bar */}
              <div className="relative mb-3" ref={clientSearchRef}>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                  Buscar en Base de Clientes (Razón Social o RUT)
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Escriba nombre de empresa o RUT..."
                    value={clientSearchQuery}
                    onChange={(e) => {
                      setClientSearchQuery(e.target.value);
                      if (!clientDropdownOpen) setClientDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (clientSuggestions.length > 0) setClientDropdownOpen(true);
                    }}
                    className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-blue-200 bg-blue-50/20 text-xs focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none placeholder:text-slate-400"
                  />
                  {clientSearching && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {clientDropdownOpen && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-100">
                    {clientSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-start justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">{c.name}</div>
                          <div className="text-[10px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                            {c.comuna && <span>📍 {c.comuna}</span>}
                            {c.paymentCondition && <span>💳 {c.paymentCondition}</span>}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 flex-shrink-0">
                          {c.rut}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Company Card (Ficha Fija de Empresa) */}
              {clientName ? (
                <div className="bg-slate-50 border border-blue-200 rounded-xl p-3 text-xs space-y-2 relative">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block">
                        Empresa Asignada
                      </span>
                      <div className="font-bold text-slate-900 text-sm leading-snug">
                        {clientName}
                      </div>
                    </div>
                    {clientRut && (
                      <span className="font-mono text-[11px] font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 flex-shrink-0">
                        {clientRut}
                      </span>
                    )}
                  </div>

                  {selectedClient?.giro && (
                    <div className="text-[11px] text-slate-600 truncate">
                      🏢 <span className="font-medium">{selectedClient.giro}</span>
                    </div>
                  )}

                  {selectedClient?.comuna && (
                    <div className="text-[11px] text-slate-600 truncate">
                      📍 <span>{selectedClient.address ? `${selectedClient.address}, ` : ''}{selectedClient.comuna}</span>
                    </div>
                  )}

                  <div className="pt-1.5 border-t border-slate-200/80">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                      Condición de Pago
                    </label>
                    <input
                      type="text"
                      value={paymentCondition}
                      onChange={(e) => setPaymentCondition(e.target.value)}
                      className="w-full py-1 px-2 rounded border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[10px]">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Datos vinculados
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedClient && (
                        <button
                          type="button"
                          onClick={handleOpenEditClientModal}
                          className="text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                        >
                          Modificar en Base
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(null);
                          setClientName('');
                          setClientRut('');
                        }}
                        className="text-slate-400 hover:text-red-600 font-medium cursor-pointer"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Fallback if user types without selecting from database */
                <div className="border border-dashed border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                  <div className="text-center">
                    <Building className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs font-medium text-slate-600">
                      Ninguna empresa vinculada
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Selecciona una empresa del buscador o presiona <strong>+ Nueva</strong>.
                    </p>
                  </div>
                  <div className="pt-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="O escribe Razón Social directamente..."
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full py-1.5 px-2 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="RUT Cliente (ej. 76.123.456-7)"
                      value={clientRut}
                      onChange={(e) => setClientRut(e.target.value)}
                      className="w-full py-1.5 px-2 text-xs border border-slate-300 rounded font-mono bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-2 border-t border-slate-100">
              <span>✓ Razón Social y RUT quedan fijos automáticamente.</span>
            </div>
          </div>

          {/* ================= BLOQUE 2: CONTACTO ================= */}
          <div 
            ref={contactBlockRef}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 relative"
          >
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                  <span>2. Contacto Comercial</span>
                </h2>
                {selectedContact ? (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Registrado
                  </span>
                ) : clientEmail && clientEmail.includes('@') ? (
                  <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Nuevo Contacto
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded font-medium">
                    Búsqueda predictiva
                  </span>
                )}
              </div>

              <div className="space-y-2.5 relative">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider flex items-center justify-between">
                    <span>Atención (Contacto) *</span>
                    {contactSearching && <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ej. Ing. Carlos Muñoz"
                      value={clientAttention}
                      onChange={(e) => {
                        setClientAttention(e.target.value);
                        setContactSearchQuery(e.target.value);
                        if (selectedContact && selectedContact.name !== e.target.value) {
                          setSelectedContact(null);
                        }
                      }}
                      onFocus={() => {
                        if (contactSuggestions.length > 0) setContactDropdownOpen(true);
                      }}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider">
                    Teléfono Móvil
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ej. +56 9 8765 4321"
                      value={clientPhone}
                      onChange={(e) => {
                        setClientPhone(e.target.value);
                        setContactSearchQuery(e.target.value);
                      }}
                      onFocus={() => {
                        if (contactSuggestions.length > 0) setContactDropdownOpen(true);
                      }}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider flex items-center justify-between">
                    <span>Correo Electrónico (ID Único) *</span>
                    <span className="text-[9px] font-normal text-slate-400 lowercase">Clave principal</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="ej. contacto@empresa.cl"
                      value={clientEmail}
                      onChange={(e) => {
                        setClientEmail(e.target.value);
                        setContactSearchQuery(e.target.value);
                        if (selectedContact && selectedContact.email.toLowerCase() !== e.target.value.toLowerCase()) {
                          setSelectedContact(null);
                        }
                      }}
                      onFocus={() => {
                        if (contactSuggestions.length > 0) setContactDropdownOpen(true);
                      }}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Suggestions Dropdown for Contactos */}
                {contactDropdownOpen && contactSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-100">
                    <div className="px-3 py-1 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Contactos Registrados ({contactSuggestions.length})</span>
                      <span className="text-[9px] text-blue-600 font-normal">Clic para autocompletar</span>
                    </div>
                    {contactSuggestions.map((c) => (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => handleSelectContact(c)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-start justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                            <User className="w-3 h-3 text-blue-600 flex-shrink-0" />
                            <span>{c.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 text-slate-600 font-mono text-[10px]">
                              <Mail className="w-2.5 h-2.5 text-slate-400" />
                              {c.email}
                            </span>
                            {c.phone && (
                              <span className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                                <Phone className="w-2.5 h-2.5 text-slate-400" />
                                {c.phone}
                              </span>
                            )}
                          </div>
                          {c.company && (
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              🏢 {c.company}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 flex-shrink-0 font-medium">
                          ✓ En Base
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Status Footer */}
            {selectedContact ? (
              <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-[10px] text-emerald-900 flex items-center justify-between">
                <span className="flex items-center gap-1 font-medium truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Contacto registrado: <strong>{selectedContact.name}</strong></span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedContact(null)}
                  className="text-emerald-700 hover:text-red-600 underline font-semibold ml-2 cursor-pointer flex-shrink-0"
                >
                  Desvincular
                </button>
              </div>
            ) : clientEmail && clientEmail.includes('@') && clientAttention ? (
              <div className="p-2 bg-blue-50/80 border border-blue-200 rounded-lg text-[10px] text-blue-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>✨ Nuevo contacto: se guardará y asociará a <strong>{clientEmail}</strong> automáticamente al cotizar.</span>
              </div>
            ) : (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-500">
                💡 Al ingresar nombre, teléfono o correo, el sistema busca predictivamente y autocompleta. Si no existe, se guarda como nuevo.
              </div>
            )}
          </div>

          {/* ================= BLOQUE 3: PROYECTO Y PRESUPUESTO ================= */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-700" />
                  <span>3. Proyecto y Presupuesto</span>
                </h2>
                {code.match(/V\d+$/i) && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-mono">
                    {code.match(/V\d+$/i)?.[0].toUpperCase()}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {/* Project Name & Unique ID */}
                <div ref={projectSearchRef} className="relative">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      Nombre Obra / Proyecto
                    </label>
                    {projectId ? (
                      <div className="flex items-center gap-1.5">
                        <span 
                          title="ID único e irrepetible no modificable por usuarios"
                          className="font-mono text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-default select-none shadow-xs"
                        >
                          <Lock className="w-2.5 h-2.5 text-blue-700" />
                          {projectId}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setProjectId('');
                            setStatusMessage({
                              type: 'success',
                              text: 'Proyecto desvinculado. Al guardar se generará un nuevo ID irrepetible.',
                            });
                          }}
                          title="Desvincular para registrar como un nuevo proyecto con ID único"
                          className="text-[9px] text-slate-400 hover:text-red-600 underline cursor-pointer"
                        >
                          Nuevo Proyecto
                        </button>
                      </div>
                    ) : projectName ? (
                      <span className="text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                        ID asignado al guardar
                      </span>
                    ) : null}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ej. Edificio Los Olivos - Etapa 2"
                      value={projectName}
                      onChange={(e) => {
                        setProjectName(e.target.value);
                        if (projectId) setProjectId('');
                      }}
                      onFocus={() => {
                        if (projectSuggestions.length > 0 && !projectId) setProjectDropdownOpen(true);
                      }}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                    {projectSearching && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Suggestions Dropdown for Projects */}
                  {projectDropdownOpen && projectSuggestions.length > 0 && !projectId && (
                    <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 max-h-52 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-100">
                      <div className="px-3 py-1 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Proyectos Registrados ({projectSuggestions.length})</span>
                        <span className="text-[9px] text-blue-600 font-normal">Clic para asignar</span>
                      </div>
                      {projectSuggestions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProject(p)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-start justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                              {p.reference && <span>📋 {p.reference}</span>}
                              {p.city && <span>📍 {p.city}</span>}
                              {p.clientName && <span>🏢 {p.clientName}</span>}
                            </div>
                          </div>
                          <span className="font-mono text-[10px] font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 flex-shrink-0 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-blue-600" />
                            {p.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider">
                      Referencia
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full py-1.5 px-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider">
                      Sede
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full py-1.5 px-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium"
                    >
                      <option value="Santiago">Santiago</option>
                      <option value="Concepción">Concepción</option>
                      <option value="Terreno / Regiones">Terreno / Regiones</option>
                    </select>
                  </div>
                </div>

                {/* CC Dropdown & Currency Selector */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider">
                      Centro de Costo (CC) *
                    </label>
                    <select
                      value={centroCosto}
                      onChange={(e) => handleCentroCostoChange(e.target.value)}
                      className="w-full py-1.5 px-2 rounded-lg border border-blue-300 bg-blue-50/40 text-xs font-semibold text-blue-950 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    >
                      {CENTROS_DE_COSTO.map((cc) => (
                        <option key={cc} value={cc}>
                          {cc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider">
                      Moneda Propuesta *
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'UF' | 'USD')}
                      className="w-full py-1.5 px-2 rounded-lg border border-emerald-300 bg-emerald-50/40 text-xs font-bold text-emerald-950 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    >
                      <option value="UF">UF (Unidad de Fomento)</option>
                      <option value="USD">USD (Dólares Americanos)</option>
                    </select>
                  </div>
                </div>

                {/* Resulting Code */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider">
                    Código de Presupuesto
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 font-mono text-xs font-bold text-blue-900 bg-blue-50/40 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                {/* Validador Oficial UF / Dólar */}
                <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">
                        Indicadores Oficiales
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => fetchIndicators(true)}
                        disabled={isRefreshingIndicators}
                        title="Revalidar valor oficial en tiempo real con Banco Central"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 text-slate-500 ${isRefreshingIndicators ? 'animate-spin' : ''}`} />
                        <span>{isRefreshingIndicators ? 'Revalidando...' : 'Revalidar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowManualIndicatorEdit(!showManualIndicatorEdit)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        {showManualIndicatorEdit ? 'Cerrar' : 'Ajustar'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-white px-2 py-1.5 rounded border border-slate-200">
                      <div className="text-[9px] text-slate-500 font-medium">UF Oficial</div>
                      <div className="text-xs font-mono font-bold text-emerald-900">
                        ${ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="bg-white px-2 py-1.5 rounded border border-slate-200">
                      <div className="text-[9px] text-slate-500 font-medium">Dólar Observado</div>
                      <div className="text-xs font-mono font-bold text-slate-900">
                        ${dollarValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {indicators?.source && (
                    <div className="text-[9px] text-slate-400 flex items-center justify-between">
                      <span className="truncate">Fuente: {indicators.source}</span>
                      <span>{indicators.date || 'Hoy'}</span>
                    </div>
                  )}

                  {/* Opción para incluir o no los indicadores oficiales en el documento PDF */}
                  <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showIndicatorsInPdf}
                        onChange={(e) => setShowIndicatorsInPdf(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Mostrar en documento PDF</span>
                    </label>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        showIndicatorsInPdf
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600 border border-slate-300'
                      }`}
                    >
                      {showIndicatorsInPdf ? 'Visible en PDF' : 'Oculto en PDF'}
                    </span>
                  </div>

                  {showManualIndicatorEdit && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-200 space-y-1.5">
                      <div className="text-[10px] font-semibold text-amber-800 bg-amber-50 p-1 rounded border border-amber-200">
                        Ajustar valores para este presupuesto:
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[9px] text-slate-600 mb-0.5">UF ($)</label>
                          <input
                            type="text"
                            value={customUfInput}
                            onChange={(e) => setCustomUfInput(e.target.value)}
                            className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded font-mono"
                            placeholder="40879.04"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-600 mb-0.5">Dólar ($)</label>
                          <input
                            type="text"
                            value={customDollarInput}
                            onChange={(e) => setCustomDollarInput(e.target.value)}
                            className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded font-mono"
                            placeholder="933.47"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setShowManualIndicatorEdit(false)}
                          className="px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyCustomIndicators}
                          className="px-2 py-0.5 text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded shadow-xs cursor-pointer"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Automated Session Info Badge */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span className="truncate">
                Emisor: <strong className="text-slate-700">{commercialName}</strong> ({commercialTitle})
              </span>
              <span className="font-mono text-slate-600 flex-shrink-0">
                Ref: {commercialInitials} {commercialSignature ? '• Firma ✓' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Items Table Section - Compact */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 mb-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>1.1 Ensayos y Servicios Solicitados</span>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Busca cualquier ensayo por nombre o norma para agregarlo a la propuesta.
              </p>
            </div>

            {/* Buscador inteligente de Ensayos */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div ref={searchRef} className="relative w-full md:w-[480px]">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar 'triaxial 15x30', 'corte 30x30' o con IA..."
                    value={searchQuery}
                    onFocus={() => setDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setDropdownOpen(true);
                      if (aiSuggestions.length > 0) setAiSuggestions([]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleTriggerAiSearch();
                      }
                    }}
                    className="w-full pl-8 pr-28 py-1.5 text-xs rounded-lg border border-blue-200 focus:border-blue-600 focus:outline-none bg-blue-50/20 text-slate-800 placeholder-slate-400 font-medium"
                  />
                  {/* Action buttons inside search bar */}
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setAiSuggestions([]);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 text-xs"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleTriggerAiSearch}
                      disabled={aiSearching || !searchQuery.trim()}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-2xs transition disabled:opacity-30 cursor-pointer"
                      title="Buscar con Inteligencia Artificial (Gemini) o presiona Enter"
                    >
                      {aiSearching ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-amber-300" />
                      )}
                      <span>Buscar IA</span>
                    </button>
                  </div>
                </div>

                {/* Autocomplete Dropdown with Smart & AI Matches */}
                {dropdownOpen && (searchResults.length > 0 || aiSearching || searchQuery.trim().length > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-96 overflow-y-auto z-50 divide-y divide-slate-100">
                    {/* Header info */}
                    <div className="bg-slate-50/90 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-xs">
                      <span className="font-semibold text-slate-700">
                        {aiSearching ? (
                          <span className="flex items-center gap-1.5 text-purple-700">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Consultando catálogo con Asistente IA...
                          </span>
                        ) : searchResults.length > 0 ? (
                          <span>
                            {searchResults.length} {searchResults.length === 1 ? 'ensayo encontrado' : 'ensayos encontrados'}
                          </span>
                        ) : (
                          <span>Sin coincidencia directa</span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:inline">Presiona [Enter] o [Buscar IA]</span>
                    </div>

                    {/* Results list */}
                    {searchResults.length > 0 ? (
                      searchResults.map((res) => (
                        <div
                          key={res.id}
                          onClick={() => handleAddItem(res.item)}
                          className="p-3 hover:bg-blue-50/70 transition-colors cursor-pointer flex items-start justify-between gap-3 group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {res.item.code && (
                                <span className="bg-slate-100 text-slate-700 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded">
                                  #{res.item.code}
                                </span>
                              )}
                              <span className="text-xs font-semibold text-blue-700">
                                {res.item.subcategory || res.item.category}
                              </span>
                              {res.isAiSuggested && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded-full">
                                  <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                  Coincidencia IA
                                </span>
                              )}
                              {res.isLearnedRule && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-full" title="Equivalencia aprendida del uso de ejecutivos">
                                  <span>🧠</span>
                                  Aprendido
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-slate-900 mt-0.5 group-hover:text-blue-900">
                              {res.item.designation}
                            </p>
                            {res.matchReason && res.isAiSuggested && (
                              <p className="text-[11px] text-purple-700 font-medium mt-0.5">
                                ℹ️ {res.matchReason}
                              </p>
                            )}
                            {res.matchReason && res.isLearnedRule && !res.isAiSuggested && (
                              <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                                {res.matchReason}
                              </p>
                            )}
                            {res.item.norm && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                {res.item.norm}
                              </p>
                            )}
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-bold font-mono text-slate-900 block">
                              {res.item.ufPrice.toFixed(2)} UF
                            </span>
                            <span className="text-[11px] text-slate-500">
                              ${Math.round(res.item.ufPrice * ufValue).toLocaleString('es-CL')}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : !aiSearching && searchQuery.trim() ? (
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-600 mb-2">
                          No se encontró coincidencia directa para <strong>&ldquo;{searchQuery}&rdquo;</strong>
                        </p>
                        <button
                          type="button"
                          onClick={handleTriggerAiSearch}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Buscar con Inteligencia Artificial</span>
                        </button>
                      </div>
                    ) : null}

                    {/* Footer AI suggestion trigger */}
                    {searchResults.length > 0 && !aiSearching && aiSuggestions.length === 0 && searchQuery.trim() && (
                      <div
                        onClick={handleTriggerAiSearch}
                        className="p-2.5 bg-purple-50/60 hover:bg-purple-100 text-purple-800 text-xs font-semibold text-center cursor-pointer flex items-center justify-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                        <span>¿Buscas una variante específica? <strong>Analizar con IA para &ldquo;{searchQuery}&rdquo;</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
          </div>
        </div>

          {/* Items Table */}
          {(() => {
            const itemsWithDetailsCount = items.filter(
              (it) => !!parseDesignation(it.designation).detail
            ).length;
            const hasAnyDetails = itemsWithDetailsCount > 0;
            const allDetailsExpanded =
              hasAnyDetails &&
              items.every((it) => {
                const { detail } = parseDesignation(it.designation);
                return !detail || !!expandedDetails[it.id];
              });

            return (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs bg-white">
                <table className="w-full min-w-[1100px] text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th
                        className="py-3 px-2 w-20 min-w-[76px] text-center"
                        title="Reorganizar posición: arrastra la fila o usa las flechas"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                          <span>Item</span>
                        </div>
                      </th>
                      <th className="py-3 px-4 min-w-[340px] lg:min-w-[420px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800">Designación Ensayo</span>
                          {hasAnyDetails && (
                            <button
                              type="button"
                              onClick={() => handleToggleAllDetails(!allDetailsExpanded)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100/90 border border-blue-200/80 px-2 py-0.5 rounded-md transition cursor-pointer normal-case tracking-normal shadow-2xs"
                              title={
                                allDetailsExpanded
                                  ? 'Ocultar todos los detalles técnicos'
                                  : 'Ver todos los detalles técnicos de los ensayos'
                              }
                            >
                              {allDetailsExpanded ? (
                                <>
                                  <ChevronUp className="w-3 h-3 text-blue-600" />
                                  <span>Ocultar detalles</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3 text-blue-600" />
                                  <span>Ver detalles ({itemsWithDetailsCount})</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-3 w-40 min-w-[140px] max-w-[180px]">Norma</th>
                      <th className="py-3 px-2 w-20 min-w-[70px] text-center">Masa</th>
                      <th className="py-3 px-2 w-16 min-w-[60px] text-center">Unidad</th>
                      <th className="py-3 px-3 w-24 min-w-[85px] text-right">
                        {currency === 'USD' ? 'Precio USD' : 'Precio UF'}
                      </th>
                      <th
                        className="py-3 px-2 w-24 min-w-[85px] text-center"
                        title="Factor multiplicador (1.0 = Precio lista, 0.9 = 10% desc., 1.15 = 15% recargo)"
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-[11px] font-bold text-slate-700">Desc./Aum.</span>
                          <span className="text-[9px] font-normal text-slate-400 lowercase">(factor)</span>
                        </div>
                      </th>
                      <th className="py-3 px-2 w-16 min-w-[65px] text-center">Cant.</th>
                      <th className="py-3 px-3 w-28 min-w-[95px] text-right">
                        {currency === 'USD' ? 'Subtotal USD' : 'Subtotal UF'}
                      </th>
                      <th className="py-3 px-3 w-32 min-w-[110px] text-right">Subtotal CLP</th>
                      <th className="py-3 px-2 w-10 min-w-[40px] text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="w-8 h-8 text-slate-300" />
                            <span className="text-sm font-medium text-slate-500">
                              Aún no has agregado ningún ensayo.
                            </span>
                            <span className="text-xs text-slate-400">
                              Utiliza el buscador superior para seleccionar ítems del tarifario oficial.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const finalUnitUf = item.ufPrice * item.factor;
                        const finalUnitDisplay =
                          currency === 'USD'
                            ? ((finalUnitUf * ufValue) / dollarValue).toFixed(2)
                            : finalUnitUf.toFixed(2);
                        const finalSubtotalDisplay =
                          currency === 'USD'
                            ? `${((item.subtotalUf * ufValue) / dollarValue).toFixed(2)} USD`
                            : `${item.subtotalUf.toFixed(2)} UF`;

                        const { title, detail } = parseDesignation(item.designation);
                        const isExpanded = !!expandedDetails[item.id];

                        return (
                          <tr
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={(e) => handleDrop(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`transition-colors select-none ${
                              draggedItemIndex === idx
                                ? 'opacity-30 bg-blue-100/50 border-2 border-dashed border-blue-400'
                                : dragOverItemIndex === idx
                                ? 'bg-blue-50 border-t-2 border-blue-600'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-2 text-center align-top">
                              <div className="flex items-center justify-center gap-1 pt-0.5">
                                {/* Grip Handle for Drag & Drop */}
                                <div
                                  className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-600 rounded transition"
                                  title="Arrastra para reordenar"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>

                                {/* Item Number 1.1.X */}
                                <span className="font-mono text-xs font-semibold text-slate-600 min-w-[36px]">
                                  1.1.{idx + 1}
                                </span>

                                {/* Up / Down Buttons */}
                                <div className="flex flex-col -space-y-0.5">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveItem(idx, idx - 1);
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition"
                                    title="Mover arriba"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === items.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveItem(idx, idx + 1);
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition"
                                    title="Mover abajo"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 align-top">
                              <div className="font-semibold text-slate-900 leading-snug text-[13px] md:text-sm">
                                {title}
                              </div>

                              {detail && (
                                <div className="mt-1">
                                  {!isExpanded ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandDetail(item.id)}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 px-2 py-0.5 rounded-md transition cursor-pointer border border-blue-200/60"
                                      title="Ver especificaciones técnicas y condiciones del ensayo"
                                    >
                                      <Info className="w-3 h-3 text-blue-500" />
                                      <span>Ver detalle del ensayo</span>
                                      <ChevronDown className="w-3 h-3 text-blue-500" />
                                    </button>
                                  ) : (
                                    <div className="mt-1.5 p-2.5 bg-slate-50 border border-slate-200 border-l-4 border-l-blue-600 rounded-r-md">
                                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                                        <span className="flex items-center gap-1 text-slate-700">
                                          <Info className="w-3 h-3 text-blue-600" /> Especificaciones / Detalle:
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => toggleExpandDetail(item.id)}
                                          className="text-slate-400 hover:text-slate-700 flex items-center gap-0.5 cursor-pointer text-[10px] font-medium hover:underline"
                                        >
                                          <ChevronUp className="w-3 h-3" /> Ocultar detalle
                                        </button>
                                      </div>
                                      <div className="text-xs text-slate-600 font-normal whitespace-pre-line leading-relaxed">
                                        {detail}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600 align-top">
                              <div
                                className="line-clamp-2 hover:line-clamp-none transition-all cursor-default whitespace-pre-line leading-relaxed"
                                title={item.norm || undefined}
                              >
                                {item.norm || <span className="text-slate-400 italic">-</span>}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center text-xs font-mono text-slate-600 align-top pt-3.5">
                              {item.minWeightKg ? `${item.minWeightKg} kg` : '-'}
                            </td>
                            <td className="py-3 px-2 text-center text-xs font-semibold text-slate-600 align-top pt-3.5">
                              {item.unit}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-medium text-slate-700 align-top pt-3.5">
                              {finalUnitDisplay}
                            </td>
                            <td className="py-3 px-2 text-center align-top pt-2.5">
                              <input
                                type="number"
                                step="0.05"
                                min="0"
                                value={item.factor}
                                onChange={(e) =>
                                  handleItemChange(item.id, 'factor', parseFloat(e.target.value) || 0)
                                }
                                className="w-16 p-1 text-center font-mono text-xs border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                title="Factor multiplicador (1.0 = 100%, 0.9 = 10% desc.)"
                              />
                            </td>
                            <td className="py-3 px-2 text-center align-top pt-2.5">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)
                                }
                                className="w-14 p-1 text-center font-mono text-xs font-bold border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 focus:outline-none bg-blue-50/30"
                              />
                            </td>
                            <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 align-top pt-3.5">
                              {finalSubtotalDisplay}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-700 align-top pt-3.5">
                              ${item.subtotalClp.toLocaleString('es-CL')}
                            </td>
                            <td className="py-3 px-2 text-center align-top pt-2.5">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar ensayo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Summary Cards - Compact Executive Stat Strip */}
          <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Total Principal (UF or USD) */}
            <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl px-4 py-2.5 text-white shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider block">
                  Total Presupuesto ({currency})
                </span>
                <div className="text-xl font-bold font-mono mt-0.5">
                  {currency === 'USD' ? totalUsd.toFixed(2) : totals.totalUf.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-blue-200">{currency}</span>
                </div>
                <span className="text-[10px] text-blue-300">
                  {currency === 'USD'
                    ? `Equivalente: ${totals.totalUf.toFixed(2)} UF`
                    : 'Valor Neto de Ensayos'}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-800/60 border border-blue-700/50 flex items-center justify-center text-blue-200 font-bold text-xs">
                {currency}
              </div>
            </div>

            {/* Total CLP */}
            <div className="bg-slate-900 rounded-xl px-4 py-2.5 text-white shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Total Estimado en Pesos (CLP)
                </span>
                <div className="text-xl font-bold font-mono mt-0.5">
                  ${totals.totalClp.toLocaleString('es-CL')}
                </div>
                <span className="text-[10px] text-slate-400">
                  UF ref: ${ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | USD: ${dollarValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center text-slate-300 font-bold text-xs">
                $
              </div>
            </div>

            {/* Sample Mass */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-amber-900 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-amber-700" />
                  Masa Total de Muestras
                </span>
                <div className="text-xl font-bold font-mono text-amber-950 mt-0.5">
                  {totals.totalWeight.toFixed(1)} <span className="text-xs font-normal text-amber-800">kg</span>
                </div>
                <span className="text-[10px] text-amber-700">Mínimo para laboratorio</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200/60 flex items-center justify-center text-amber-800 font-bold text-xs">
                kg
              </div>
            </div>
          </div>
        </div>

        {/* 1.2 Commercial Conditions and Observations Editor */}
        <CommercialConditionsEditor
          observations={observations}
          onChangeObservations={setObservations}
          condiciones={condicionesComerciales}
          onChangeCondiciones={(newCond) => {
            setCondicionesComerciales(newCond);
            if (newCond.condicionVenta && newCond.condicionVenta !== paymentCondition) {
              setPaymentCondition(newCond.condicionVenta);
            }
          }}
          paymentCondition={paymentCondition}
          onChangePaymentCondition={(val) => {
            setPaymentCondition(val);
            setCondicionesComerciales((prev) => ({ ...prev, condicionVenta: val }));
          }}
          onResetDefaults={() => {
            if (
              confirm(
                '¿Desea restaurar las condiciones comerciales y observaciones a los valores oficiales de IDIEM?'
              )
            ) {
              setObservations([...DEFAULT_OBSERVACIONES]);
              setCondicionesComerciales(getDefaultCondicionesComerciales(paymentCondition));
              setStatusMessage({
                type: 'success',
                text: 'Condiciones comerciales y observaciones restauradas a valores estándar IDIEM.',
              });
            }
          }}
        />

        {/* Action Bar - Compact */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Limpiar / Nuevo</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Guardar Borrador (Solo Base de Datos) */}
            <button
              onClick={handleSaveDraft}
              disabled={saving || generatingPdf}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Guarda los avances en la base de datos sin generar documento"
            >
              <Save className="w-3.5 h-3.5 text-slate-300" />
              <span>
                {saving
                  ? 'Guardando...'
                  : isVersionMode
                  ? 'Guardar Versión'
                  : 'Guardar Borrador'}
              </span>
            </button>

            {/* Descargar PDF en Borrador (Con marca de agua, estado permanece en Borrador) */}
            <button
              onClick={handleDownloadDraftPdf}
              disabled={saving || generatingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Descarga documento preliminar en PDF con marca de agua 'BORRADOR' para revisión técnica"
            >
              <FileText className="w-3.5 h-3.5 text-amber-200" />
              <span>{generatingPdf ? 'Generando...' : 'Descargar Borrador (PDF)'}</span>
            </button>

            {/* Finalizar y Descargar PDF Definitivo (Cambia estado a Finalizada) */}
            <button
              onClick={handleFinalize}
              disabled={saving || generatingPdf}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E20000] hover:bg-[#C20000] text-white text-xs font-bold shadow-xs shadow-red-600/20 transition-all cursor-pointer disabled:opacity-50"
              title="Cierra el presupuesto a estado 'Finalizada' y descarga el PDF oficial definitivo"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{generatingPdf ? 'Finalizando...' : 'Finalizar y Descargar (PDF Definitivo)'}</span>
            </button>
          </div>
        </div>
      </main>

      {/* Centered Overlay Confirmation Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-150 relative">
            {/* Close button */}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Success check icon */}
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3.5 border-4 ${
                modalMode === 'finalized'
                  ? 'bg-emerald-100 border-emerald-50 text-emerald-600'
                  : 'bg-blue-100 border-blue-50 text-blue-700'
              }`}
            >
              {modalMode === 'finalized' ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : (
                <Save className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {modalMode === 'finalized'
                ? isVersionMode
                  ? '¡Nueva Versión Finalizada!'
                  : '¡Cotización Finalizada y PDF Generado!'
                : isVersionMode
                ? '¡Nueva Versión Guardada como Borrador!'
                : '¡Borrador Guardado con Éxito!'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {modalMode === 'finalized'
                ? 'El documento PDF oficial ha sido generado y descargado a tu equipo. La cotización ha quedado finalizada en el historial e indexada como caso de referencia en el Asistente IA.'
                : 'La cotización se guardó como borrador en el sistema (no se indexa en la memoria IA hasta que sea finalizada). Puedes continuar editándola ahora o más tarde desde el historial.'}
            </p>

            {/* Quotation Details Card */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-left mb-5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Código:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                    {code}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      modalMode === 'finalized'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {modalMode === 'finalized' ? 'Finalizada' : 'Borrador'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Cliente / Empresa:</span>
                <span className="font-bold text-slate-800 truncate max-w-[200px]">
                  {clientName || 'Sin Razón Social'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Centro de Costo:</span>
                <span className="font-semibold text-slate-700">{centroCosto}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700">Total Propuesta:</span>
                <span className="font-bold font-mono text-sm text-emerald-700">
                  {currency === 'USD'
                    ? `${totalUsd.toFixed(2)} USD`
                    : `${totals.totalUf.toFixed(2)} UF`}
                </span>
              </div>
            </div>

            {/* Direct Action Buttons */}
            {modalMode === 'finalized' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPdfOnly()}
                  disabled={generatingPdf}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#E20000] hover:bg-[#C20000] text-white text-xs font-bold shadow-sm shadow-red-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  <span>{generatingPdf ? 'Descargando...' : 'Descargar PDF Nuevamente'}</span>
                </button>

                <Link
                  href="/cotizaciones"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all"
                >
                  <span>Ver en Historial</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Continuar Editando
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    handleReset();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                >
                  Nueva Cotización
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    handleFinalize();
                  }}
                  disabled={generatingPdf}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#E20000] hover:bg-[#C20000] text-white text-xs font-bold shadow-sm shadow-red-600/20 transition-all cursor-pointer disabled:opacity-50 sm:col-span-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>{generatingPdf ? 'Finalizando...' : 'Finalizar y Generar PDF Ahora'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Continuar Editando
                </button>

                <Link
                  href="/cotizaciones"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                >
                  <span>Ver en Historial</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Cliente in Cotizador */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-700" />
                {editingModalClient ? 'Modificar Empresa' : 'Registrar Nueva Empresa'}
              </h2>
              <button
                onClick={() => setShowClientModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClientModal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientModalForm.name}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, name: e.target.value })}
                    placeholder="ej. Constructora e Inmobiliaria SpA"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    RUT *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientModalForm.rut}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, rut: e.target.value })}
                    placeholder="ej. 76.123.456-7"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Comuna / Ciudad
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.comuna}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, comuna: e.target.value })}
                    placeholder="ej. Santiago, Concepción"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Dirección Comercial
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.address}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, address: e.target.value })}
                    placeholder="ej. Av. Providencia 1234, Of. 502"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Giro Comercial
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.giro}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, giro: e.target.value })}
                    placeholder="ej. Construcción e Ingeniería"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.phone}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, phone: e.target.value })}
                    placeholder="ej. +56 9 8765 4321"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={clientModalForm.email}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, email: e.target.value })}
                    placeholder="ej. contacto@empresa.cl"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Atención / Contacto
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.contactPerson}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, contactPerson: e.target.value })}
                    placeholder="ej. Ing. Carlos Muñoz"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Condición de Pago
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.paymentCondition}
                    onChange={(e) => setClientModalForm({ ...clientModalForm, paymentCondition: e.target.value })}
                    placeholder="ej. 50% anticipo, 50% contra entrega"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingClientModal}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  {savingClientModal
                    ? 'Guardando...'
                    : editingModalClient
                    ? 'Guardar Cambios'
                    : 'Registrar y Asignar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Botón flotante para abrir Asistente IA Técnico-Comercial */}
      <button
        type="button"
        onClick={() => {
          setUnifiedAiTab('chat');
          setShowUnifiedAiModal(true);
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white font-bold text-xs sm:text-sm shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
        title="Abrir Asistente IA Técnico-Comercial DGL"
      >
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        <span>Asistente IA DGL</span>
      </button>

      {/* Modal Unificado del Asistente IA Técnico-Comercial DGL */}
      <UnifiedAiAssistantModal
        isOpen={showUnifiedAiModal}
        onClose={() => setShowUnifiedAiModal(false)}
        initialTab={unifiedAiTab}
        currentItems={items}
        onApplyActions={handleApplyAiChatActions}
        onApplyCampaign={handleApplyAiSuggestions}
        contexto={{
          clientName,
          projectName,
          centroCosto,
          currency,
          cotizacionCode: code,
        }}
        initialChatMessages={assistantChatMessages}
        initialActiveAnalisis={assistantActiveAnalisis}
        onChatStateChange={(msgs, analisis) => {
          setAssistantChatMessages(msgs);
          setAssistantActiveAnalisis(analisis);
        }}
      />
    </div>
  );
}

export default function CotizadorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-slate-600">Cargando cotizador...</span>
          </div>
        </div>
      }
    >
      <CotizadorContent />
    </Suspense>
  );
}

