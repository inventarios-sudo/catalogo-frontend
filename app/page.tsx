'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

// Instancia del cliente de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Interfaz del Producto
interface Product {
  id?: string;
  referencia: string;
  descripcion: string;
  um_precio: string;
  linea: string;
  existencia: number;
  pvp1: number;
  pvp3: number;
  pvp4: number;
  pvp5: number;
  pvp6: number;
  imagen: string;
  estado_compra: string;
}

/**
 * Convierte un enlace de Google Drive en un enlace directo de imagen
 */
const getDirectDriveUrl = (url: string): string => {
  if (!url) return '';
  const cleanUrl = url.toString().trim();
  const match = cleanUrl.match(/\/d\/([^\/]+)/) || cleanUrl.match(/id=([^&]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return cleanUrl;
};

/**
 * Convierte valores de texto a números seguros
 */
const parseNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = val.toString().replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export default function CatalogoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [lineas, setLineas] = useState<string[]>([]);
  
  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedPvp, setSelectedPvp] = useState('pvp1');
  const [showPrices, setShowPrices] = useState(false);
  
  // Estados de Carga y Mensajes
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  // 1. CARGA COMPLETA DE PRODUCTOS DESDE SUPABASE (SIN LÍMITE DE 2000)
  const fetchProducts = async () => {
    setLoading(true);
    try {
      let allProducts: Product[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      // Consulta en bucle para traer la base de datos completa por lotes
      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allProducts = [...allProducts, ...(data as Product[])];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      // Limpieza de espacios invisibles
      const normalized = allProducts.map((p) => ({
        ...p,
        referencia: (p.referencia || '').toString().trim(),
        descripcion: (p.descripcion || '').toString().trim(),
        linea: (p.linea || '').toString().trim(),
        imagen: getDirectDriveUrl(p.imagen || ''),
      }));

      setProducts(normalized);

      // Extraer lista única de líneas
      const uniqueLineas = Array.from(new Set(normalized.map((p) => p.linea)))
        .filter(Boolean)
        .sort();
      setLineas(uniqueLineas);

    } catch (error: any) {
      console.error('Error al obtener productos:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 2. FILTRADO DINÁMICO (BÚSQUEDA Y LÍNEAS)
  useEffect(() => {
    let result = products;

    if (selectedLine) {
      result = result.filter(
        (p) => p.linea.toLowerCase().trim() === selectedLine.toLowerCase().trim()
      );
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((p) => {
        const matchRef = p.referencia.toLowerCase().includes(term);
        const matchDesc = p.descripcion.toLowerCase().includes(term);
        return matchRef || matchDesc;
      });
    }

    setFilteredProducts(result);
  }, [searchTerm, selectedLine, products]);

  // 3. PROCESAMIENTO RÁPIDO EN CLIENTE CON PAPAPARSE
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage('Leyendo archivo CSV...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Normalizar celdas e imágenes del CSV
          const productsToInsert = results.data
            .map((row: any) => {
              const normalizedRow: Record<string, any> = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key.trim().toLowerCase()] = row[key];
              });

              const referencia = (normalizedRow['referencia'] || '').toString().trim();
              if (!referencia) return null;

              return {
                referencia,
                descripcion: (normalizedRow['descripcion'] || '').toString().trim(),
                um_precio: (
                  normalizedRow['u.m. precio'] || 
                  normalizedRow['u.m.precio'] || 
                  normalizedRow['um_precio'] || ''
                ).toString().trim(),
                linea: (normalizedRow['linea'] || '').toString().trim(),
                existencia: parseNumber(normalizedRow['existencia']),
                pvp1: parseNumber(normalizedRow['pvp1']),
                pvp3: parseNumber(normalizedRow['pvp3']),
                pvp4: parseNumber(normalizedRow['pvp4']),
                pvp5: parseNumber(normalizedRow['pvp5']),
                pvp6: parseNumber(normalizedRow['pvp6']),
                imagen: getDirectDriveUrl(normalizedRow['imagen'] || ''),
                estado_compra: (
                  normalizedRow['estado compra'] || 
                  normalizedRow['estado_compra'] || ''
                ).toString().trim(),
              };
            })
            .filter(Boolean);

          if (productsToInsert.length === 0) {
            throw new Error('No se encontraron filas con la columna "Referencia".');
          }

          // Enviar a Supabase en lotes pequeños para evitar bloqueos
          const BATCH_SIZE = 100;
          for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE) {
            const batch = productsToInsert.slice(i, i + BATCH_SIZE);
            const currentCount = Math.min(i + BATCH_SIZE, productsToInsert.length);
            setUploadMessage(`Guardando ${currentCount} de ${productsToInsert.length} productos...`);
            
            const { error } = await supabase
              .from('products')
              .upsert(batch, { onConflict: 'referencia' });

            if (error) throw error;
          }

          setUploadMessage(`¡Éxito! Se actualizaron ${productsToInsert.length} productos.`);
          await fetchProducts(); // Recargar la vista con los nuevos productos

        } catch (error: any) {
          console.error(error);
          setUploadMessage(`Error: ${error.message}`);
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        console.error(error);
        setUploadMessage('Error al leer el archivo CSV.');
        setIsUploading(false);
      },
    });
  };

  // Obtener precio seleccionado
  const getProductPrice = (product: Product) => {
    switch (selectedPvp) {
      case 'pvp3': return product.pvp3;
      case 'pvp4': return product.pvp4;
      case 'pvp5': return product.pvp5;
      case 'pvp6': return product.pvp6;
      default: return product.pvp1;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      
      {/* PANEL DE ADMINISTRACIÓN */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
          ⚙ PANEL DE ADMINISTRACIÓN - Actualizar Catálogo Masivo
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 cursor-pointer"
          />

          {isUploading && (
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-amber-700">
                {uploadMessage}
              </span>
            </div>
          )}

          {!isUploading && uploadMessage && (
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <span className="text-xs font-semibold text-emerald-700">
                {uploadMessage}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Catálogo de Productos</h1>
            <p className="text-sm text-gray-500 mt-1">
              Mostrando: <span className="font-semibold text-blue-600">{filteredProducts.length}</span> de {products.length} productos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <input
              type="text"
              placeholder="Buscar por Ref o Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las Líneas ({lineas.length})</option>
              {lineas.map((linea, idx) => (
                <option key={idx} value={linea}>
                  {linea}
                </option>
              ))}
            </select>

            <select
              value={selectedPvp}
              onChange={(e) => setSelectedPvp(e.target.value)}
              className="px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium focus:outline-none"
            >
              <option value="pvp1">Lista PVP 1</option>
              <option value="pvp3">Lista PVP 3</option>
              <option value="pvp4">Lista PVP 4</option>
              <option value="pvp5">Lista PVP 5</option>
              <option value="pvp6">Lista PVP 6</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={showPrices}
                onChange={(e) => setShowPrices(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span>Ver Precios</span>
            </label>
          </div>
        </div>
      </div>

      {/* TARJETAS DE PRODUCTOS */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-gray-500 text-sm font-medium">Cargando catálogo completo...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.referencia}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="w-full h-48 bg-gray-100 relative overflow-hidden flex items-center justify-center">
                  {product.imagen ? (
                    <img
                      src={product.imagen}
                      alt={product.descripcion}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Sin+Imagen';
                      }}
                    />
                  ) : (
                    <span className="text-xs text-gray-400 font-medium">Sin Imagen</span>
                  )}
                  <span className="absolute top-2 left-2 bg-gray-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow">
                    Ref: {product.referencia}
                  </span>
                </div>

                <div className="p-4">
                  <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide truncate">
                    {product.linea || 'General'}
                  </p>
                  <h3 className="text-sm font-medium text-gray-800 line-clamp-2 h-10 mb-2" title={product.descripcion}>
                    {product.descripcion}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <span>Existencia: <strong className="text-gray-800 font-semibold">{product.existencia}</strong></span>
                    <span>U.M: <strong className="text-gray-800 font-semibold">{product.um_precio || 'UND'}</strong></span>
                  </div>
                </div>
              </div>

              {showPrices && (
                <div className="p-4 pt-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">{selectedPvp}</span>
                  <span className="text-base font-bold text-emerald-600">
                    ${getProductPrice(product).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && filteredProducts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 font-medium">No se encontraron productos que coincidan con la búsqueda.</p>
        </div>
      )}

    </div>
  );
}
