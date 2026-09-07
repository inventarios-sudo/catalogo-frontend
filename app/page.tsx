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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedLinea, setSelectedLinea] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPvp, setSelectedPvp] = useState<string>('pvp1');
  const [verPrecios, setVerPrecios] = useState<boolean>(false);

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

  // Función corregida para cargar TODOS los productos en lotes (superando el límite de 1000 de Supabase)
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

        if (error) {
          console.error('Error al obtener productos:', error);
          break;
        }

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
      setUploadMessage(`¡Éxito! ${result.message}`);
      await fetchProducts();
    } else {
      setUploadMessage(`Error: ${result.error}`);
    }

    setIsUploading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-1">Acceso al Catálogo</h2>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">USUARIO</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">CONTRASEÑA</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {loginError && <p className="text-xs font-semibold text-rose-500 text-center">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-sm"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f3f6] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
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
              {isUploading ? 'Procesando...' : 'Actualizar Catálogo'}
            </button>
          </form>
          {uploadMessage && (
            <p className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
              ✅ {uploadMessage}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 leading-tight">Catálogo de Productos</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Mostrando: <span className="text-blue-600 font-bold">{filteredProducts.length}</span> de {products.length} productos cargados
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <input
                type="text"
                placeholder="Buscar por Ref o Nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-slate-200 rounded-xl px-3.5 py-2 text-xs w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />

              <select
                value={selectedLinea}
                onChange={(e) => setSelectedLinea(e.target.value)}
                className="border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-slate-50/50 text-slate-700 max-w-[200px] truncate"
              >
                <option value="">Todas las Líneas ({lineas.length})</option>
                {lineas.map((linea) => (
                  <option key={linea} value={linea}>
                    {linea}
                  </option>
                ))}
              </select>

              <select
                value={selectedPvp}
                onChange={(e) => setSelectedPvp(e.target.value)}
                className="border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-600 font-bold bg-blue-50/50"
              >
                <option value="pvp1">Lista PVP 1</option>
                <option value="pvp3">Lista PVP 3</option>
                <option value="pvp4">Lista PVP 4</option>
                <option value="pvp5">Lista PVP 5</option>
                <option value="pvp6">Lista PVP 6</option>
              </select>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none px-2 py-1">
                <input
                  type="checkbox"
                  checked={verPrecios}
                  onChange={(e) => setVerPrecios(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                Ver Precios
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 font-medium">Cargando la totalidad del catálogo...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const precioActual = p[selectedPvp] || 0;
              const imagenUrl = p.imagen || `https://ykkfaflwzoyynhtmtqwp.supabase.co/storage/v1/object/public/product-images/${p.referencia}.jpg`;

              return (
                <div
                  key={p.referencia}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="w-full h-44 bg-slate-50 rounded-xl mb-3 overflow-hidden flex items-center justify-center border border-slate-100">
                      <img
                        src={imagenUrl}
                        alt={p.descripcion}
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          (e.target as HTMLElement).parentElement!.innerHTML = `
                            <div className="text-center p-4">
                              <div className="w-8 h-8 mx-auto mb-1 opacity-40">🖼️</div>
                              <span className="text-[11px] text-slate-400 font-medium">Sin Imagen</span>
                            </div>
                          `;
                        }}
                      />
                    </div>

                    <span className="text-[11px] font-bold text-blue-600 uppercase block mb-1 truncate">
                      {p.linea || 'SIN LÍNEA'}
                    </span>

                    <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase leading-snug">
                      {p.descripcion}
                    </h3>

                    <p className="text-[11px] text-slate-400 font-mono mb-3">
                      Ref: <span className="font-bold text-slate-600">{p.referencia}</span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
                    <div>
                      {verPrecios && precioActual > 0 ? (
                        <span className="text-sm font-extrabold text-slate-900">
                          ${precioActual.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Sin Precio</span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block leading-none mb-0.5">
                        STOCK
                      </span>
                      <span className="text-xs font-bold text-red-600">
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
