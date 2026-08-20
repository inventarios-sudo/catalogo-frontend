'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const SUPABASE_URL = 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🔑 CAMBIA AQUÍ TU USUARIO Y CONTRASEÑA DE ACCESO
const USERNAME_VALIDO = 'admin';
const PASSWORD_VALIDA = '123456';

interface Product {
  id: number;
  referencia: string;
  descripcion: string;
  linea: string;
  pvp1: number;
  pvp3: number;
  pvp4: number;
  pvp5: number;
  pvp6: number;
  existencia: number;
  imagen_url: string;
}

function getCleanImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}=s1000`;
    }
  }
  return url.trim();
}

export default function CatalogoPage() {
  // Estado para el control de la Interfaz de Ingreso (Login)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [usuarioInput, setUsuarioInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Estados del Catálogo
  const [products, setProducts] = useState<Product[]>([]);
  const [lineas, setLineas] = useState<string[]>([]);
  const [selectedLinea, setSelectedLinea] = useState<string>('TODAS');
  const [priceList, setPriceList] = useState<string>('pvp1');
  const [showPrices, setShowPrices] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Estado para la vista de imagen completa
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Verificar si el usuario ya había iniciado sesión antes
  useEffect(() => {
    const logged = sessionStorage.getItem('catalogo_session_active');
    if (logged === 'true') {
      setIsAuthenticated(true);
      fetchProducts();
    }
  }, []);

  // Cerrar vista previa de imagen con la tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Manejador del Formulario de Ingreso
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usuarioInput === USERNAME_VALIDO && passwordInput === PASSWORD_VALIDA) {
      sessionStorage.setItem('catalogo_session_active', 'true');
      setIsAuthenticated(true);
      setAuthError('');
      fetchProducts();
    } else {
      setAuthError('❌ Usuario o contraseña incorrectos');
    }
  };

  // Manejador para Cerrar Sesión
  const handleLogout = () => {
    sessionStorage.removeItem('catalogo_session_active');
    setIsAuthenticated(false);
    setUsuarioInput('');
    setPasswordInput('');
  };

  async function fetchProducts() {
    setLoading(true);
    setErrorMsg('');
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .range(0, 2999);

      if (error) {
        console.error('DETALLE ERROR SUPABASE:', error);
        setErrorMsg(`Error [${error.code}]: ${error.message}`);
      } else if (data) {
        setProducts(data);
        const uniqueLineas = Array.from(new Set(data.map((p: Product) => p.linea))).filter(Boolean);
        setLineas(uniqueLineas as string[]);
      }
    } catch (err: any) {
      console.error('EXCEPCION DE RED:', err);
      setErrorMsg(`Excepción: ${err.message || 'Sin conexión al servidor'}`);
    }
    
    setLoading(false);
  }

  const filteredProducts = products.filter((p) => {
    const matchesLinea = selectedLinea === 'TODAS' || p.linea === selectedLinea;
    const matchesSearch =
      p.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
      p.referencia?.toLowerCase().includes(search.toLowerCase());
    return matchesLinea && matchesSearch;
  });

  const getSelectedPrice = (product: Product) => {
    return product[priceList as keyof Product] ?? '0.00';
  };

  // =============================================================
  // INTERFAZ DE INGRESO (LOGIN)
  // =============================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full border border-gray-100">
          
          {/* Encabezado del Formulario */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center text-white">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm text-3xl shadow-inner">
              🔒
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Acceso al Catálogo</h2>
            <p className="text-xs text-blue-100 mt-1">
              Ingresa tus credenciales autorizadas para continuar
            </p>
          </div>

          {/* Formulario de Entrada */}
          <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Usuario
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej. admin"
                  value={usuarioInput}
                  onChange={(e) => setUsuarioInput(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
                  required
                />
              </div>
            </div>

            {/* Alerta de Error */}
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium text-center animate-shake">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              Iniciar Sesión
            </button>

            <div className="text-center pt-2">
              <span className="text-[11px] text-gray-400">
                Sistema de Inventarios & Catálogo Digital
              </span>
            </div>
          </form>

        </div>
      </div>
    );
  }

  // =============================================================
  // INTERFAZ DEL CATÁLOGO (Una vez autenticado)
  // =============================================================
  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 font-sans print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; font-size: 10px; }
          .page-break { page-break-inside: avoid; }
          .grid-container {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
          }
        }
      `}</style>

      {/* HEADER Y FILTROS */}
      <div className="no-print max-w-7xl mx-auto bg-white p-3 sm:p-5 rounded-2xl shadow-sm border border-gray-200 mb-4 sm:mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            📦 Catálogo de Productos
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Mostrando: <span className="font-bold text-blue-600">{filteredProducts.length}</span> de {products.length} productos
          </p>
        </div>

        {/* Controles de búsqueda y filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2 sm:gap-3">
          
          <input
            type="text"
            placeholder="Buscar código o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-auto border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={selectedLinea}
            onChange={(e) => setSelectedLinea(e.target.value)}
            className="w-full sm:w-auto border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODAS">Todas las Líneas ({lineas.length})</option>
            {lineas.map((linea) => (
              <option key={linea} value={linea}>
                {linea}
              </option>
            ))}
          </select>

          <select
            value={priceList}
            onChange={(e) => setPriceList(e.target.value)}
            className="w-full sm:w-auto border border-gray-300 rounded-xl px-3 py-2 text-sm bg-blue-50 text-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pvp1">Lista PVP 1</option>
            <option value="pvp3">Lista PVP 3</option>
            <option value="pvp4">Lista PVP 4</option>
            <option value="pvp5">Lista PVP 5</option>
            <option value="pvp6">Lista PVP 6</option>
          </select>

          <label className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPrices}
              onChange={(e) => setShowPrices(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            Ver Precios
          </label>

          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow transition-colors flex items-center justify-center gap-2"
          >
            📄 Generar PDF
          </button>

          {/* Botón para salir */}
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
            title="Cerrar Sesión"
          >
            🚪 Salir
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="no-print max-w-7xl mx-auto mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm font-medium">
          ⚠️ Diagnóstico: {errorMsg}
        </div>
      )}

      {/* REJILLA DE PRODUCTOS */}
      {loading ? (
        <div className="text-center py-16 no-print">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-2 text-gray-600 text-sm font-medium">Cargando catálogo...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm font-medium no-print">
          No se encontraron productos para esta búsqueda.
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 grid-container">
          {filteredProducts.map((p) => {
            const cleanUrl = getCleanImageUrl(p.imagen_url);
            const price = getSelectedPrice(p);

            return (
              <div
                key={p.id}
                className="page-break bg-white border border-gray-200 rounded-xl p-2.5 sm:p-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div 
                    onClick={() => cleanUrl && setPreviewImage(cleanUrl)}
                    className={`w-full h-32 sm:h-40 bg-gray-50 rounded-lg overflow-hidden mb-2 sm:mb-3 flex items-center justify-center relative ${
                      cleanUrl ? 'cursor-zoom-in group' : ''
                    }`}
                  >
                    {cleanUrl ? (
                      <>
                        <img
                          src={cleanUrl}
                          alt={p.descripcion}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-medium">🔍 Ampliar</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] sm:text-xs text-gray-400">Sin Imagen</span>
                    )}
                  </div>

                  <div className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-wide truncate mb-0.5">
                    {p.linea}
                  </div>

                  <h3 
                    onClick={() => cleanUrl && setPreviewImage(cleanUrl)}
                    className={`text-[11px] sm:text-xs font-bold text-gray-800 line-clamp-2 leading-tight uppercase mb-1 transition-colors ${
                      cleanUrl ? 'cursor-pointer hover:text-blue-600' : ''
                    }`}
                  >
                    {p.descripcion}
                  </h3>

                  <div className="text-[10px] sm:text-[11px] text-gray-500 mb-2">
                    Ref: <span className="font-mono text-gray-700">{p.referencia}</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-1.5 sm:pt-2 flex items-center justify-between mt-auto">
                  {showPrices ? (
                    <div>
                      <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">
                        Precio ({priceList.toUpperCase()})
                      </div>
                      <div className="text-xs sm:text-sm font-extrabold text-green-600">
                        ${typeof price === 'number' ? price.toFixed(2) : price}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[9px] sm:text-[10px] text-gray-400 italic">Sin Precio</div>
                  )}

                  <div className="text-right">
                    <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-bold">Stock</div>
                    <div className={`text-[11px] sm:text-xs font-bold ${p.existencia > 0 ? 'text-gray-700' : 'text-red-500'}`}>
                      {p.existencia} und
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VISTA DE IMAGEN EN PANTALLA COMPLETA */}
      {previewImage && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
          className="no-print flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 100000 }}
            className="bg-white/20 hover:bg-white/40 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold shadow-xl backdrop-blur-sm transition-all active:scale-90"
          >
            ✕
          </button>

          <img
            src={previewImage}
            alt="Imagen ampliada"
            style={{ maxHeight: '92vh', maxWidth: '92vw', objectFit: 'contain' }}
            className="rounded-lg shadow-2xl transition-all duration-300 transform scale-100 select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
