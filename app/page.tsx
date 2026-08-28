'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { processAndUploadCatalog } from '@/app/actions/upload-catalog';

const SUPABASE_URL = 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Product {
  id?: string;
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
  estado_analisis?: string;
}

const USERS_DATABASE: Record<string, { pass: string; role: string; name: string }> = {
  'admin': { pass: 'admin123', role: 'admin', name: 'Administrador' },
  'vendedor': { pass: 'vend123', role: 'vendedor', name: 'Vendedor General' },
  'cliente': { pass: 'cli123', role: 'cliente', name: 'Cliente' },
  'ernesto punina': { pass: 'ernesto.punina', role: 'vendedor', name: 'Ernesto Punina' },
  'ronald castro': { pass: 'ronald.castro', role: 'vendedor', name: 'Ronald Castro' },
  'franklin guaman': { pass: 'franklin.guaman', role: 'vendedor', name: 'Franklin Guaman' },
  'marina flores': { pass: 'marina.flores', role: 'vendedor', name: 'Marina Flores' },
  'hector morales': { pass: 'hector.morales', role: 'vendedor', name: 'Hector Morales' },
  'pablo llumiquinga': { pass: 'pablo.llumiquinga', role: 'vendedor', name: 'Pablo Llumiquinga' },
  'cristian martinez': { pass: 'cristian.martinez', role: 'vendedor', name: 'Cristian Martinez' },
  'alexander baquero': { pass: 'alexander.baquero', role: 'vendedor', name: 'Alexander Baquero' },
  'gabriela flores': { pass: 'gabriela.flores', role: 'vendedor', name: 'Gabriela Flores' },
  'gabrielaflores': { pass: 'gabriela.flores', role: 'vendedor', name: 'Gabriela Flores' },
  'madeleine vizcaino': { pass: 'madeleine.vizcaino', role: 'vendedor', name: 'Madeleine Vizcaino' },
};

export default function CatalogoPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [usuarioInput, setUsuarioInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [lineas, setLineas] = useState<string[]>([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [priceList, setPriceList] = useState<'pvp1' | 'pvp3' | 'pvp4' | 'pvp5' | 'pvp6'>('pvp1');
  const [showPrices, setShowPrices] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = usuarioInput.trim().toLowerCase();
    const p = passwordInput.trim();
    const matchedUser = USERS_DATABASE[u];

    if (matchedUser && matchedUser.pass === p) {
      setIsAuthenticated(true);
      setCurrentUserRole(matchedUser.role);
      setCurrentUserName(matchedUser.name);
      setPriceList('pvp1');
      setShowPrices(true);
      setLoginError('');
    } else {
      setLoginError('Usuario o contraseña incorrectos.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUserRole('');
    setCurrentUserName('');
    setUsuarioInput('');
    setPasswordInput('');
  };

  async function fetchProducts() {
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.from('products').select('*').range(0, 2999);

      if (error) {
        setErrorMsg(`Error [${error.code}]: ${error.message}`);
      } else if (data) {
        setProducts(data as Product[]);
        const uniqueLineas = Array.from(new Set(data.map((p: Product) => p.linea))).filter(Boolean) as string[];
        setLineas(uniqueLineas);
      }
    } catch (err: any) {
      setErrorMsg(`Excepción: ${err.message || 'Sin conexión al servidor'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let result = products;
    result = result.filter((p) => Number(p.existencia || 0) > 0);

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

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentUserRole !== 'admin') {
      alert('Solo el usuario Administrador puede realizar cargas masivas.');
      return;
    }

    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      setUploadStatus({ success: false, message: 'Selecciona un archivo Excel o CSV.' });
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('user', currentUserRole);

    const res = await processAndUploadCatalog(formData);
    setUploading(false);

    if (res.success) {
      setUploadStatus({ success: true, message: `¡Éxito! Se actualizaron ${res.count} productos.` });
      fetchProducts();
      form.reset();
    } else {
      setUploadStatus({ success: false, message: res.error || 'Ocurrió un error al procesar el archivo.' });
    }
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-200">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Catálogo de Productos</h1>
            <p className="text-sm text-gray-500 mt-1">Ingresa tus credenciales para acceder</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Usuario</label>
              <input
                type="text"
                value={usuarioInput}
                onChange={(e) => setUsuarioInput(e.target.value)}
                placeholder="Ej. Ernesto Punina o admin"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Contraseña</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>

            {loginError && (
              <div className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded border border-red-200">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors shadow"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* HEADER WEB (SE OCULTA EN IMPRESIÓN / PDF) */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Catálogo Digital</h1>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              👤 {currentUserName} ({currentUserRole})
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs">
              <span className="font-semibold text-gray-600 px-2">Lista:</span>
              <select
                value={priceList}
                onChange={(e) => setPriceList(e.target.value as any)}
                className="bg-white text-gray-800 font-bold py-1 px-2 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="pvp1">PVP 1</option>
                <option value="pvp3">PVP 3</option>
                <option value="pvp4">PVP 4</option>
                <option value="pvp5">PVP 5</option>
                <option value="pvp6">PVP 6</option>
              </select>
            </div>

            <button
              onClick={() => setShowPrices(!showPrices)}
              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-3 py-1.5 rounded-lg transition"
            >
              {showPrices ? '🙈 Ocultar Precios' : '👁️ Mostrar Precios'}
            </button>

            <button
              onClick={handleDownloadPDF}
              className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg transition shadow"
            >
              📄 Descargar PDF
            </button>

            <button
              onClick={handleLogout}
              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold px-3 py-1.5 rounded-lg transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* ENCABEZADO EXCLUSIVO PARA EL PDF / IMPRESIÓN */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-gray-300 pb-3 mb-4">
        <img src="/logo-texcomercial.jpg" alt="Texcomercial" className="h-12 object-contain" />
        <div className="text-right">
          <h2 className="text-lg font-bold text-gray-900">CATÁLOGO DE PRODUCTOS</h2>
          <p className="text-xs text-gray-500">Lista seleccionada: {priceList.toUpperCase()}</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* PANEL ADMINISTRADOR */}
        {currentUserRole === 'admin' && (
          <div className="bg-white border border-blue-200 rounded-xl p-4 mb-6 shadow-sm print:hidden">
            <h2 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span>🚀 Carga Masiva de Productos (Excel / CSV)</span>
            </h2>
            <form onSubmit={handleFileUpload} className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <button
                type="submit"
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold py-2 px-4 rounded-lg transition shadow-sm"
              >
                {uploading ? 'Procesando...' : '🚀 Actualizar Catálogo'}
              </button>
            </form>

            {uploadStatus && (
              <div
                className={`mt-3 text-xs p-2.5 rounded-lg border font-medium ${
                  uploadStatus.success
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {uploadStatus.message}
              </div>
            )}
          </div>
        )}

        {/* BUSCADOR Y LÍNEA */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 print:hidden">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Buscar por referencia o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          <div className="w-full md:w-64">
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
            >
              <option value="">Todas las Líneas ({lineas.length})</option>
              {lineas.map((linea) => (
                <option key={linea} value={linea}>
                  {linea}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ESTADOS */}
        {loading && (
          <div className="text-center py-12 print:hidden">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-sm text-gray-500 mt-2 font-medium">Cargando catálogo...</p>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm mb-6 print:hidden">
            {errorMsg}
          </div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 text-sm font-medium">No se encontraron productos disponibles con existencias.</p>
          </div>
        )}

        {/* GRILLA DE PRODUCTOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:grid-cols-3 print:gap-2">
          {filteredProducts.map((p) => {
            const price = p[priceList] || 0;
            const cleanUrl = p.imagen_url && p.imagen_url.trim() !== '' ? p.imagen_url : null;

            return (
              <div
                key={p.referencia}
                className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between relative print:break-inside-avoid print:p-2"
              >
                <div className="w-full h-36 bg-gray-50 rounded-lg overflow-hidden mb-2 relative flex items-center justify-center border border-gray-100 print:h-28">
                  {cleanUrl ? (
                    <img
                      src={cleanUrl}
                      alt={p.descripcion || p.referencia}
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={() => setPreviewImage(cleanUrl)}
                    />
                  ) : (
                    <span className="text-xs text-gray-400 font-medium">Sin Imagen</span>
                  )}
                  <span className="absolute top-1.5 right-1.5 bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Stock: {p.existencia}
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-0.5">
                      {p.linea}
                    </div>

                    <h3 className="text-[11px] sm:text-xs font-bold text-gray-900 line-clamp-2 leading-tight uppercase mb-1">
                      {p.descripcion}
                    </h3>

                    <div className="text-[10px] sm:text-[11px] text-gray-600 mb-2">
                      Ref: <span className="font-mono font-bold text-gray-900">{p.referencia}</span>
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* PIE DE PÁGINA CON LEYENDA IVA (VISIBLE ÚNICAMENTE EN PDF / IMPRESIÓN) */}
      <footer className="hidden print:block fixed bottom-0 left-0 right-0 text-center py-2 bg-white border-t border-gray-200">
        <p className="text-[10px] font-bold text-gray-700 tracking-wider">
          * PRECIOS NO INCLUYEN IVA *
        </p>
      </footer>

      {/* MODAL PREVIEW DE IMAGEN */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 print:hidden"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden p-2 shadow-2xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 bg-gray-900 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm hover:bg-gray-700 z-10"
            >
              ✕
            </button>
            <img src={previewImage} alt="Vista previa" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
