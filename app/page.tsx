'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function CatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('PVP1');
  const [showPrices, setShowPrices] = useState(true);
  const [user, setUser] = useState<string>('vendedor');
  
  // Estados para la carga masiva (Admin)
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('referencia', { ascending: true });

    if (!error && data) {
      setProducts(data);
      setFilteredProducts(data);

      // Extraer líneas únicas para el filtro
      const uniqueLines = Array.from(new Set(data.map((p) => p.linea))).filter(Boolean);
      setLines(uniqueLines as string[]);
    }
  }

  // Filtrado dinámico por texto y línea
  useEffect(() => {
    let result = products;

    if (selectedLine) {
      result = result.filter((p) => p.linea === selectedLine);
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          (p.referencia && p.referencia.toLowerCase().includes(term)) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(term))
      );
    }

    setFilteredProducts(result);
  }, [searchTerm, selectedLine, products]);

  // Manejador de carga de archivo masivo (Acción Servidor)
  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', user);

    try {
      const { processAndUploadCatalog } = await import('@/app/actions/upload-catalog');
      const res = await processAndUploadCatalog(formData);

      if (res.success) {
        setUploadMessage(`✅ ¡Éxito! Se actualizaron ${res.count} productos.`);
        fetchProducts(); // Recargar datos
      } else {
        setUploadMessage(`❌ Error: ${res.error}`);
      }
    } catch (err: any) {
      setUploadMessage(`❌ Error inesperado: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* PANEL DE ADMINISTRACIÓN - SOLO SI ES ADMIN */}
        {user === 'admin' && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              ⚙️ PANEL DE ADMINISTRACIÓN - Actualizar Catálogo Masivo
            </h2>
            <form onSubmit={handleFileUpload} className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <button
                type="submit"
                disabled={uploading || !file}
                className="bg-gray-400 hover:bg-gray-500 text-white text-sm font-bold py-2 px-4 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {uploading ? 'Procesando...' : '🚀 Actualizar Catálogo'}
              </button>
            </form>
            {uploadMessage && (
              <p className="mt-2 text-xs font-semibold text-gray-600">{uploadMessage}</p>
            )}
          </div>
        )}

        {/* CABECERA Y FILTROS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              📦 Catálogo de Productos
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Mostrando: <strong className="text-blue-600">{filteredProducts.length}</strong> de {products.length} productos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Buscador */}
            <input
              type="text"
              placeholder="Buscar por Ref o Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Seleccionar Línea */}
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las Líneas ({lines.length})</option>
              {lines.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            {/* Seleccionar Precio */}
            <select
              value={selectedPrice}
              onChange={(e) => setSelectedPrice(e.target.value)}
              className="px-3 py-2 bg-white border border-blue-300 text-blue-700 font-semibold rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PVP1">Lista PVP 1</option>
              <option value="PVP3">Lista PVP 3</option>
              <option value="PVP4">Lista PVP 4</option>
              <option value="PVP5">Lista PVP 5</option>
              <option value="PVP6">Lista PVP 6</option>
            </select>

            {/* Toggle Ver Precios */}
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrices}
                onChange={(e) => setShowPrices(e.target.checked)}
                className="rounded text-blue-600"
              />
              Ver Precios
            </label>

            {/* Botones de Acción */}
            <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-sm flex items-center gap-1">
              💵 Generar QR
            </button>
            <button className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-sm flex items-center gap-1">
              📄 PDF
            </button>
          </div>
        </div>

        {/* GRILLA DE PRODUCTOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            // Obtener el precio dinámico
            const currentPrice = product[selectedPrice.toLowerCase()] || product.pvp1 || 0;

            return (
              <div
                key={product.referencia}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  {/* IMAGEN DEL PRODUCTO */}
                  <div className="w-full h-44 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden mb-3">
                    {product.imagen_url ? (
                      <img
                        src={product.imagen_url}
                        alt={product.descripcion || product.referencia}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center text-gray-400 text-xs">
                        <span className="block text-2xl mb-1">🖼️</span>
                        Sin Imagen
                      </div>
                    )}
                  </div>

                  {/* LÍNEA / MARCA */}
                  <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-1">
                    {product.linea}
                  </div>

                  {/* CÓDIGO/REFERENCIA PRINCIPAL */}
                  <div className="text-sm font-bold text-gray-900 leading-tight">
                    {product.referencia}
                  </div>

                  {/* DESCRIPCIÓN ADICIONADA DEL PRODUCTO */}
                  {product.descripcion && product.descripcion !== product.referencia && (
                    <div className="text-xs font-semibold text-gray-700 mt-1 leading-snug">
                      {product.descripcion}
                    </div>
                  )}

                  {/* REFERENCIA SECUNDARIA */}
                  <div className="text-xs text-gray-500 mt-1">
                    Ref: <span className="font-bold text-gray-800">{product.referencia}</span>
                  </div>
                </div>

                {/* PIE DE TARJETA: PRECIO Y STOCK */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-end">
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">
                      PRECIO ({selectedPrice})
                    </div>
                    {showPrices ? (
                      <div className="text-base font-extrabold text-green-600">
                        ${Number(currentPrice).toFixed(2)}
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-gray-300">***</div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 font-bold uppercase">
                      STOCK
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {product.existencia} <span className="text-xs text-gray-500 font-normal">und</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
