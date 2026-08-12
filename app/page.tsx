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
  
  // Estado para la ventana emergente (modal)
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
        .range(0, 1999);

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

      {/* HEADER Y FILTROS RESPONSIVOS (OPTIMIZADOS PARA MÓVIL) */}
      <div className="no-print max-w-7xl mx-auto bg-white p-3 sm:p-5 rounded-2xl shadow-sm border border-gray-200 mb-4 sm:mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            📦 Catálogo de Productos
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Mostrando: <span className="font-bold text-blue-600">{filteredProducts.length}</span> de {products.length} productos
          </p>
        </div>

        {/* Controles de búsqueda y filtros adaptables */}
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
        </div>
      </div>

      {errorMsg && (
        <div className="no-print max-w-7xl mx-auto mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm font-medium">
          ⚠️ Diagnóstico: {errorMsg}
        </div>
      )}

      {/* ENCABEZADO PARA IMPRESIÓN/PDF */}
      <div className="hidden print:block mb-4 text-center border-b pb-2">
        <h1 className="text-xl font-bold">Catálogo de Productos</h1>
        <p className="text-xs text-gray-600">
          Línea: <strong>{selectedLinea}</strong> | Total: {filteredProducts.length} productos
        </p>
      </div>

      {/* REJILLA DE PRODUCTOS (GRID RESPONSIVO) */}
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
        /* En móviles pequeños muestra 2 tarjetas por fila (grid-cols-2), en pantallas medianas 3 y en PC 4 */
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
                  {/* Foto con soporte táctil */}
                  <div 
                    onClick={() => cleanUrl && setPreviewImage(cleanUrl)}
                    className={`w-full h-32 sm:h-40 bg-gray-50 rounded-lg overflow-hidden mb-2 sm:mb-3 flex items-center justify-center relative touch-manipulation ${
                      cleanUrl ? 'cursor-pointer active:scale-95 transition-transform' : ''
                    }`}
                  >
                    {cleanUrl ? (
                      <img
                        src={cleanUrl}
                        alt={p.descripcion}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[10px] sm:text-xs text-gray-400">Sin Imagen</span>
                    )}
                  </div>

                  <div className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-wide truncate mb-0.5">
                    {p.linea}
                  </div>

                  <h3 className="text-[11px] sm:text-xs font-bold text-gray-800 line-clamp-2 leading-tight uppercase mb-1">
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

      {/* VENTANA EMERGENTE PARA MÓVILES Y COMPUTADORAS */}
      {previewImage && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          className="no-print flex items-center justify-center p-2 sm:p-4 touch-none backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            style={{ position: 'relative', maxWidth: '95vw', maxHeight: '90vh' }}
            className="bg-white rounded-2xl p-2 shadow-2xl flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón de cierre agrandado para tocar fácilmente con el dedo */}
            <button
              onClick={() => setPreviewImage(null)}
              style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 100000 }}
              className="bg-black/80 hover:bg-black text-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold shadow-lg transition-colors active:scale-90"
            >
              ✕
            </button>
            <img
              src={previewImage}
              alt="Vista ampliada"
              style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain' }}
              className="rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
