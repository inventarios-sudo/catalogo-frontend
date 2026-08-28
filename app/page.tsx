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
  'admin': { pass: '123456', role: 'admin', name: 'Administrador' },
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
  const [showPrices, setShowPrices] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

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
      setShowPrices(false);
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

  const handleImageError = (ref: string) => {
    setFailedImages((prev) => ({ ...prev, [ref]: true }));
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-b from-[#2563eb] to-[#4f46e5] pt-10 pb-8 px-6 text-center relative">
            <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Acceso al Catálogo</h1>
            <p className="text-xs text-blue-100 mt-1">Ingresa tus credenciales autorizadas para continuar</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1.5">
                  USUARIO
                </label>
                <input
                  type="text"
                  value={usuarioInput}
                  onChange={(e) => setUsuarioInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-gray-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1.5">
                  CONTRASEÑA
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-gray-50/50"
                  required
                />
              </div>

              {loginError && (
                <div className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200 text-center">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#1d63ed] hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all duration-200 shadow-md hover:shadow-lg mt-2"
              >
                Iniciar Sesión
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* ENCABEZADO PDF CON VERIFICACIÓN DE LOGO */}
        <div className="hidden print:flex items-center justify-between border-b-2 border-gray-300 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <img 
              src="/logo-texcomercial.jpg" 
              alt="Texcomercial" 
              className="h-16 object-contain"
              onError={(e) => {
                // Si la imagen local falla, mostrar texto estructurado alternativo en el PDF
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-xl font-black text-blue-900 tracking-tight">TEXCOMERCIAL</span>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-900">CATÁLOGO DE PRODUCTOS</h2>
            <p className="text-xs text-gray-500">Lista seleccionada: {priceList.toUpperCase()}</p>
          </div>
        </div>

        {/* PANEL WEB */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm space-y-4 print:hidden">
          {currentUserRole === 'admin' && (
            <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center space-x-2 text-slate-700 text-xs font-bold mb-2">
                <span>⚙️ PANEL DE ADMINISTRACIÓN - Actualizar Catálogo Masivo</span>
              </div>
              
              <form onSubmit={handleFileUpload} className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-200 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-[#94a3b8] hover:bg-slate-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition"
                >
                  🔖 {uploading ? 'Cargando...' : 'Actualizar Catálogo'}
                </button>
              </form>

              {uploadStatus && (
                <div className="mt-2 text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <span>✅</span> {uploadStatus.message}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">📦</span>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">
                  Catálogo de Productos
                </h1>
                <div className="text-xs text-gray-500 font-medium mt-1 flex items-center gap-2">
                  <span>Mostrando: <strong className="text-blue-600">{filteredProducts.length}</strong> de {products.length} productos</span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[11px]">
                    👤 {currentUserName}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Buscar por Ref o Nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-gray-200 text-gray-800 rounded-xl px-3 py-2 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />

              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="bg-white border border-gray-200 text-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
              >
                <option value="">Todas las Líneas ({lineas.length})</option>
                {lineas.map((linea) => (
                  <option key={linea} value={linea}>
                    {linea}
                  </option>
                ))}
              </select>

              <select
                value={priceList}
                onChange={(e) => setPriceList(e.target.value as any)}
                className="bg-blue-50 border border-blue-200 text-blue-700 font-bold px-3 py-2 rounded-xl text-xs focus:outline-none"
              >
                <option value="pvp1">Lista PVP 1</option>
                <option value="pvp3">Lista PVP 3</option>
                <option value="pvp4">Lista PVP 4</option>
                <option value="pvp5">Lista PVP 5</option>
                <option value="pvp6">Lista PVP 6</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-2 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPrices}
                  onChange={(e) => setShowPrices(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Ver Precios</span>
              </label>

              <button
                onClick={() => alert('Generando código QR...')}
                className="bg-[#a855f7] hover:bg-purple-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shadow-sm"
              >
                📷 Generar QR
              </button>

              <button
                onClick={handleDownloadPDF}
                className="bg-[#ef4444] hover:bg-red-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shadow-sm"
              >
                🚩 PDF
              </button>

              <button
                onClick={handleLogout}
                className="bg-[#1e293b] hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shadow-sm"
              >
                🚪 Salir
              </button>
            </div>
          </div>
        </div>

        {/* CONTENIDO Y TARJETAS */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3">
            {filteredProducts.map((p) => {
              const price = p[priceList] || 0;
              const hasImage = p.imagen_url && p.imagen_url.trim() !== '' && !failedImages[p.referencia];

              return (
                <div
                  key={p.referencia}
                  className="bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative print:break-inside-avoid"
                >
                  <div className="w-full h-44 bg-gray-50/70 rounded-xl overflow-hidden mb-3 relative flex items-center justify-center p-2">
                    {hasImage ? (
                      <img
                        src={p.imagen_url}
                        alt=""
                        onError={() => handleImageError(p.referencia)}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => setPreviewImage(p.imagen_url)}
                      />
                    ) : (
                      <div className="text-center text-gray-300">
                        <span className="text-3xl">🖼️</span>
                        <p className="text-[10px] font-semibold text-gray-400 mt-1">Sin Imagen</p>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-blue-600 uppercase tracking-tight mb-0.5">
                        {p.linea}
                      </div>

                      <h3 className="text-xs font-bold text-gray-900 line-clamp-2 uppercase leading-snug mb-1">
                        {p.descripcion}
                      </h3>

                      <div className="text-[11px] text-gray-500 mb-3">
                        Ref: <span className="font-mono font-bold text-gray-800">{p.referencia}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-end justify-between">
                      <div>
                        {showPrices ? (
                          <div className="text-sm font-extrabold text-green-600">
                            ${typeof price === 'number' ? price.toFixed(2) : price}
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400 italic">Sin Precio</div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-[9px] text-gray-400 font-bold uppercase">STOCK</div>
                        <div className="text-xs font-bold text-red-600">
                          {p.existencia} und
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="hidden print:block fixed bottom-0 left-0 right-0 text-center py-2 bg-white border-t border-gray-200">
        <p className="text-[10px] font-bold text-gray-700 tracking-wider">
          * PRECIOS NO INCLUYEN IVA *
        </p>
      </footer>
    </div>
  );
}
