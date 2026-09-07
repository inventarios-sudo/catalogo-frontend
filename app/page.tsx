'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { processAndUploadCatalog } from '@/app/actions/upload-catalog';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Product {
  referencia: string;
  descripcion: string;
  linea: string;
  pvp1: number;
  pvp3: number;
  pvp4: number;
  pvp5: number;
  pvp6: number;
  existencia: number;
  estado_compra?: string;
  imagen?: string;
  [key: string]: any;
}

export default function CatalogPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedLinea, setSelectedLinea] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPvp, setSelectedPvp] = useState<string>('pvp5');
  const [verPrecios, setVerPrecios] = useState<boolean>(true);

  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().toLowerCase() === 'admin' && password === 'admin123') {
      setIsAuthenticated(true);
      setLoginError('');
      fetchProducts();
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let allData: Product[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .range(from, from + step - 1);

        if (error) break;

        if (data && data.length > 0) {
          allData = [...allData, ...(data as Product[])];
          from += step;
          if (data.length < step) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      setProducts(allData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const lineas = useMemo(() => {
    const rawLineas = products.map((p) => String(p.linea || '').trim());
    const validLineas = rawLineas.filter((linea) => {
      if (!linea || linea === 'SIN LÍNEA') return false;
      if (!isNaN(Number(linea))) return false;
      if (/^[\d.,\s]+$/.test(linea)) return false;
      return true;
    });

    return Array.from(new Set(validLineas)).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.referencia?.toLowerCase().includes(q) ||
        p.descripcion?.toLowerCase().includes(q);

      const matchesLinea = selectedLinea ? p.linea === selectedLinea : true;

      return matchesSearch && matchesLinea;
    });
  }, [products, searchQuery, selectedLinea]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('user', 'admin');

    const result = await processAndUploadCatalog(formData);

    if (result.success) {
      setUploadMessage(result.message);
      await fetchProducts();
    } else {
      setUploadMessage(`Error: ${result.error}`);
    }

    setIsUploading(false);
  };

  // PANTALLA DE ACCESO AL CATÁLOGO (Igual a Captura 1)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
        <div className="bg-white rounded-[28px] w-full max-w-[420px] overflow-hidden shadow-2xl flex flex-col items-center">
          <div className="w-full bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#6366f1] p-8 text-center text-white flex flex-col items-center justify-center relative">
            <div className="w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-md mb-4 flex items-center justify-center">
              <div className="w-8 h-8 bg-white/30 rounded-lg"></div>
            </div>
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Acceso al Catálogo</h2>
            <p className="text-xs text-blue-100/80 font-normal">
              Ingresa tus credenciales autorizadas para continuar
            </p>
          </div>

          <form onSubmit={handleLogin} className="w-full p-8 space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                USUARIO
              </label>
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/30 text-slate-700"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                CONTRASEÑA
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/30 text-slate-700"
                required
              />
            </div>

            {loginError && (
              <p className="text-xs font-semibold text-rose-500 text-center">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-[#1d4ed8] hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-md transition-all mt-2"
            >
              Iniciar Sesión
            </button>

            <p className="text-[11px] text-slate-400 text-center pt-4 font-medium">
              Sistema de Inventarios & Catálogo Digital
            </p>
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA PRINCIPAL DEL CATÁLOGO (Igual a Captura 2)
  return (
    <div className="min-h-screen bg-[#f1f3f6] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Panel de Carga Masiva */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-400">⚙️</span>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              PANEL DE ADMINISTRACIÓN - Actualizar Catálogo Masivo
            </h2>
          </div>
          <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl text-xs hover:bg-blue-700 disabled:opacity-50 transition"
            >
              🚀 {isUploading ? 'Procesando...' : 'Actualizar Catálogo'}
            </button>
          </form>
          {uploadMessage && (
            <p className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
              ✅ {uploadMessage}
            </p>
          )}
        </div>

        {/* Header con estructura exacta */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl mt-0.5">📦</span>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">
                  Catálogo de Productos
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Mostrando: <span className="text-blue-600 font-bold">{filteredProducts.length}</span> de {products.length} productos
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 w-full md:w-auto">
              {/* Fila superior de filtros */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                <input
                  type="text"
                  placeholder="Buscar por Ref o Nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-blue-500 rounded-full px-4 py-2 text-xs w-full sm:w-52 focus:outline-none bg-white text-slate-700"
                />

                <select
                  value={selectedLinea}
                  onChange={(e) => setSelectedLinea(e.target.value)}
                  className="border border-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none bg-slate-50/50 text-slate-700 font-medium max-w-[200px] truncate"
                >
                  <option value="">Todas las Lineas ({lineas.length})</option>
                  {lineas.map((linea) => (
                    <option key={linea} value={linea}>
                      {linea}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedPvp}
                  onChange={(e) => setSelectedPvp(e.target.value)}
                  className="border border-blue-100 rounded-full px-4 py-2 text-xs focus:outline-none text-blue-600 font-bold bg-blue-50/50"
                >
                  <option value="pvp1">Lista PVP 1</option>
                  <option value="pvp3">Lista PVP 3</option>
                  <option value="pvp4">Lista PVP 4</option>
                  <option value="pvp5">Lista PVP 5</option>
                  <option value="pvp6">Lista PVP 6</option>
                </select>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={verPrecios}
                    onChange={(e) => setVerPrecios(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Ver Precios
                </label>
              </div>

              {/* Fila inferior de acciones */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={() => alert('Generando código QR...')}
                  className="bg-[#8b5cf6] hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <span>📷</span> Generar QR
                </button>

                <button
                  onClick={() => alert('Generando PDF...')}
                  className="bg-[#ef4444] hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <span>📄</span> PDF
                </button>

                <button
                  onClick={() => setIsAuthenticated(false)}
                  className="bg-[#1e293b] hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <span>🚪</span> Salir
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Grilla de productos */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-medium">Cargando productos...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const precioActual = p[selectedPvp] || 0;
              const imagenUrl = p.imagen || `https://ykkfaflwzoyynhtmtqwp.supabase.co/storage/v1/object/public/product-images/${p.referencia}.jpg`;

              return (
                <div
                  key={p.referencia}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="w-full h-48 bg-slate-100 rounded-xl mb-3 overflow-hidden flex items-center justify-center relative">
                      <img
                        src={imagenUrl}
                        alt={p.descripcion}
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>

                    <span className="text-[11px] font-bold text-blue-600 uppercase block mb-1 truncate">
                      {p.linea || 'SIN LÍNEA'}
                    </span>

                    <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase leading-snug">
                      {p.descripcion}
                    </h3>

                    <p className="text-[11px] text-slate-400 font-mono mb-4">
                      Ref: <span className="font-bold text-slate-600">{p.referencia}</span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold block leading-none mb-1">
                        PRECIO ({selectedPvp.toUpperCase()})
                      </span>
                      {verPrecios && precioActual > 0 ? (
                        <span className="text-sm font-extrabold text-[#10b981]">
                          ${precioActual.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin Precio</span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block leading-none mb-1">
                        STOCK
                      </span>
                      <span className="text-xs font-bold text-[#ef4444]">
                        {p.existencia} und
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
