'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const SUPABASE_URL = 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const [products, setProducts] = useState<Product[]>([]);
  const [lineas, setLineas] = useState<string[]>([]);
  const [selectedLinea, setSelectedLinea] = useState<string>('TODAS');
  const [priceList, setPriceList] = useState<string>('pvp1');
  const [showPrices, setShowPrices] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Estado para controlar la imagen que se abre en pantalla grande
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setErrorMsg('');
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .range(0, 1999); // Carga hasta 2000 productos

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

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans print:bg-white print:p-0">
      {/* Estilos para exportar a PDF */}
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

      {/* Header y Filtros (Ocultos al imprimir) */}
      <div className="no-print max-w-7xl mx-auto bg-white p-4 rounded-xl shadow-md mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📦 Catálogo de Productos
          </h1>
          <p className="text-sm text-gray-500">
            Mostrando: <span className="font-semibold text-blue-600">{filteredProducts.length}</span> de {products.length} productos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por código o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={selectedLinea}
            onChange={(e) => setSelectedLinea(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-blue-50 text-blue-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pvp1">Lista PVP 1</option>
            <option value="pvp3">Lista PVP 3</option>
            <option value="pvp4">Lista PVP 4</option>
            <option value="pvp5">Lista PVP 5</option>
            <option value="pvp6">Lista PVP 6</option>
          </select>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border cursor-pointer select-none">
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
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2"
          >
            📄 PDF ({selectedLinea === 'TODAS' ? 'Todo' : 'Línea'})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="no-print max-w-7xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
          ⚠️ Diagnóstico: {errorMsg}
        </div>
      )}

      {/* Encabezado exclusivo para PDF */}
      <div className="hidden print:block mb-4 text-center border-b pb-2">
        <h1 className="text-xl font-bold">Catálogo de Productos</h1>
        <p className="text-xs text-gray-600">
          Línea: <strong>{selectedLinea}</strong> | Total: {filteredProducts.length} productos
        </p>
      </div>

      {/* Tarjetas de Productos */}
      {loading ? (
        <div className="text-center py-20 no-print">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-2 text-gray-600 font-medium">Cargando catálogo...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 text-gray-500 font-medium no-print">
          No se encontraron productos para esta línea o búsqueda.
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 grid-container">
          {filteredProducts.map((p) => {
            const cleanUrl = getCleanImageUrl(p.imagen_url);
            const price = getSelectedPrice(p);

            return (
              <div
                key={p.id}
                className="page-break bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="w-full h-40 bg-gray-50 rounded-lg overflow-hidden mb-3 flex items-center justify-center relative group">
                    {cleanUrl ? (
                      <img
                        src={cleanUrl}
                        alt={p.descripcion}
                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setPreviewImage(cleanUrl)}
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">Sin Imagen</span>
                    )}
                  </div>

                  <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide truncate mb-1">
                    {p.linea}
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 line-clamp-2 mb-1 uppercase">
                    {p.descripcion}
                  </h3>

                  <div className="text-[11px] text-gray-500 mb-2">
                    Ref: <span className="font-mono text-gray-700">{p.referencia}</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2 flex items-center justify-between mt-auto">
                  {showPrices ? (
                    <div>
                      <div className="text-[9px] text-gray-400 uppercase font-bold">
                        Precio ({priceList.toUpperCase()})
                      </div>
                      <div className="text-sm font-black text-green-600">
                        ${typeof price === 'number' ? price.toFixed(2) : price}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400 italic">Precio no disponible</div>
                  )}

                  <div className="text-right">
                    <div className="text-[9px] text-gray-400 uppercase font-bold">Stock</div>
                    <div className={`text-xs font-bold ${p.existencia > 0 ? 'text-gray-700' : 'text-red-500'}`}>
                      {p.existencia} und
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VENTANA EMERGENTE / MODAL PARA AMPLIAR IMAGEN */}
      {previewImage && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 bg-gray-900/70 hover:bg-gray-900 text-white rounded-full p-2 w-8 h-8 flex items-center justify-center text-sm font-bold shadow transition-colors z-10"
            >
              ✕
            </button>
            <img
              src={previewImage}
              alt="Imagen ampliada"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
