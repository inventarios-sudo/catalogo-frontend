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
  [key: string]: any;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLinea, setSelectedLinea] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPvp, setSelectedPvp] = useState<string>('pvp1');
  const [verPrecios, setVerPrecios] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Cargar productos desde Supabase
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .range(0, 2999);

      if (error) {
        console.error('Error consultando Supabase:', error);
      } else if (data) {
        setProducts(data as Product[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // FILTRO ESTRICTO DE LÍNEAS PARA EL SELECT (Elimina precios/números)
  const lineas = useMemo(() => {
    const rawLineas = products.map((p) => String(p.linea || '').trim());
    const validLineas = rawLineas.filter((linea) => {
      if (!linea || linea === 'SIN LÍNEA') return false;
      // Excluir si es un número decimal o precio puro (ej: 2.98, 15.09)
      const esNumero = !isNaN(Number(linea));
      const esPrecio = /^[\d.,]+$/.test(linea);
      return !esNumero && !esPrecio;
    });

    return Array.from(new Set(validLineas)).sort();
  }, [products]);

  // Filtrado de productos por búsqueda y línea seleccionada
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.referencia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLinea = selectedLinea ? p.linea === selectedLinea : true;

      return matchesSearch && matchesLinea;
    });
  }, [products, searchQuery, selectedLinea]);

  // Manejador de subida masiva de archivo
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('user', 'admin'); // O ajustar según el rol del usuario activo

    const result = await processAndUploadCatalog(formData);

    if (result.success) {
      setUploadMessage(`¡Éxito! ${result.message}`);
      fetchProducts(); // Recargar el catálogo
    } else {
      setUploadMessage(`Error: ${result.error}`);
    }

    setIsUploading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* PANEL DE ADMINISTRACIÓN - SUBIDA MASIVA */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          ⚙️ PANEL DE ADMINISTRACIÓN - Actualizar Catálogo Masivo
        </h2>
        <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
          />
          <button
            type="submit"
            disabled={isUploading || !selectedFile}
            className="px-4 py-2 bg-rose-500 text-white font-medium rounded-lg text-sm hover:bg-rose-600 disabled:opacity-50 transition"
          >
            {isUploading ? 'Procesando...' : '🏷️ Actualizar Catálogo'}
          </button>
        </form>
        {uploadMessage && (
          <p className="mt-3 text-sm font-medium text-emerald-600 flex items-center gap-1">
            ✅ {uploadMessage}
          </p>
        )}
      </div>

      {/* CABECERA Y FILTROS */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de Productos</h1>
          <p className="text-xs text-slate-500 font-medium">
            Mostrando: <span className="text-blue-600 font-bold">{filteredProducts.length}</span> de {products.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda por Ref o Nombre */}
          <input
            type="text"
            placeholder="Buscar por Ref o Nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* SELECTOR DE LÍNEAS (FILTRADO LIMPIO) */}
          <select
            value={selectedLinea}
            onChange={(e) => setSelectedLinea(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">Todas las Líneas ({lineas.length})</option>
            {lineas.map((linea) => (
              <option key={linea} value={linea}>
                {linea}
              </option>
            ))}
          </select>

          {/* Selector Lista PVP */}
          <select
            value={selectedPvp}
            onChange={(e) => setSelectedPvp(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-600 font-semibold"
          >
            <option value="pvp1">Lista PVP 1</option>
            <option value="pvp3">Lista PVP 3</option>
            <option value="pvp4">Lista PVP 4</option>
            <option value="pvp5">Lista PVP 5</option>
            <option value="pvp6">Lista PVP 6</option>
          </select>

          {/* Switch Ver Precios */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={verPrecios}
              onChange={(e) => setVerPrecios(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Ver Precios
          </label>
        </div>
      </div>

      {/* GRILLA DE PRODUCTOS */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando productos...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const precioActual = p[selectedPvp] || 0;

            return (
              <div key={p.referencia} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  {/* Etiqueta de la Línea */}
                  <span className="text-[11px] font-bold text-blue-600 uppercase block mb-1">
                    {p.linea && !/^[\d.,]+$/.test(p.linea) ? p.linea : 'SIN LÍNEA'}
                  </span>

                  {/* Nombre del Producto */}
                  <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">
                    {p.descripcion}
                  </h3>

                  <p className="text-xs text-slate-400 font-mono mb-2">Ref: {p.referencia}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    {verPrecios && precioActual > 0 ? (
                      <span className="text-base font-bold text-slate-900">
                        ${precioActual.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Sin Precio</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">STOCK</span>
                    <span className={`text-xs font-bold ${p.existencia > 0 ? 'text-red-600' : 'text-slate-400'}`}>
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
  );
}
