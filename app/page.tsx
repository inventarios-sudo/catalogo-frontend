'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const SUPABASE_URL = 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlra2ZhZmx3em95eW5odG10cXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTEzMDIsImV4cCI6MjEwMDc2NzMwMn0.0AWI85fviSMWrGfXNLu9nwvhPEEf5BMNWiXwoIopI_Q';

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

// Función para transformar links de Google Drive a formato directo compatible con <img>
function getCleanImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';

  if (url.includes('drive.google.com')) {
    const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  return url;
}

export default function CatalogoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lineas, setLineas] = useState<string[]>([]);
  const [selectedLinea, setSelectedLinea] = useState<string>('TODAS');
  const [priceList, setPriceList] = useState<string>('pvp1');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setErrorMsg('');
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*');
       

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

  const getPrice = (product: Product) => {
    const priceMap: Record<string, number> = {
      pvp1: product.pvp1,
      pvp3: product.pvp3,
      pvp4: product.pvp4,
      pvp5: product.pvp5,
      pvp6: product.pvp6,
    };
    return priceMap[priceList] || product.pvp1;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-800">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📦 Catálogo de Productos</h1>
          <p className="text-sm text-gray-500">
            Total cargados: <strong className="text-blue-600">{products.length} productos</strong>
          </p>
        </div>

        {/* Controles de Filtro y Búsqueda */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por código o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={selectedLinea}
            onChange={(e) => setSelectedLinea(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium text-gray-800"
          >
            <option value="TODAS">Todas las Líneas ({lineas.length})</option>
            {lineas.map((linea) => (
              <option key={linea} value={linea}>{linea}</option>
            ))}
          </select>

          <select
            value={priceList}
            onChange={(e) => setPriceList(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm bg-blue-50 border-blue-200 font-bold text-blue-700"
          >
            <option value="pvp1">Lista PVP 1</option>
            <option value="pvp3">Lista PVP 3</option>
            <option value="pvp4">Lista PVP 4</option>
            <option value="pvp5">Lista PVP 5</option>
            <option value="pvp6">Lista PVP 6</option>
          </select>
        </div>
      </header>

      {errorMsg && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
          ⚠️ <strong>Diagnóstico:</strong> {errorMsg}
        </div>
      )}

      {/* Grid de Productos */}
      <main className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-500 font-medium">Cargando catálogo...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-gray-500 font-medium">No se encontraron productos.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const cleanUrl = getCleanImageUrl(p.imagen_url);
              return (
                <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
                  <div className="h-48 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                    {cleanUrl ? (
                      <img 
                        src={cleanUrl} 
                        alt={p.descripcion || 'Producto'} 
                        className="w-full h-full object-contain p-2"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.target as HTMLElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = '<span class="text-xs text-gray-400">Sin Imagen</span>';
                          }
                        }}
                      />
                    ) : (
                      <span className="text-xs text-gray-400">Sin Imagen</span>
                    )}
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {p.linea}
                    </span>
                    <h3 className="font-bold text-gray-800 text-sm mt-2 line-clamp-2">{p.descripcion}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-1">Ref: {p.referencia}</p>

                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <div>
                        <span className="text-xs text-gray-400 block">Precio ({priceList.toUpperCase()})</span>
                        <span className="text-lg font-extrabold text-green-600">
                          ${Number(getPrice(p) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-400 block">Stock</span>
                        <span className={`text-xs font-bold ${p.existencia > 0 ? 'text-gray-700' : 'text-red-500'}`}>
                          {p.existencia} und
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}