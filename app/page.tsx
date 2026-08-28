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
  imagen_url?: string;
  url_imagen?: string;
  imagen?: string;
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

// Función para transformar URLs de Google Drive a URLs de imagen directas
function formatImageUrl(url: string | undefined, ref: string, bucketName: string): string {
  if (!url) {
    const cleanRef = (ref || '').trim().replace(/\//g, '_');
    return `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanRef}.jpg`;
  }

  const trimmedUrl = url.trim();

  // Si es un enlace de Google Drive
  if (trimmedUrl.includes('drive.google.com') || trimmedUrl.includes('docs.google.com')) {
    // Extraer ID usando Regex
    const match = trimmedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmedUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      // Endpoint CDN rápido y directo de Google
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  // Si es URL relativa o nombre de archivo de Supabase
  if (!trimmedUrl.startsWith('http')) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${trimmedUrl}`;
  }

  return trimmedUrl;
}

function ProductImage({ 
  product, 
  bucketName, 
  onImageClick 
}: { 
  product: Product; 
  bucketName: string;
  onImageClick: (url: string) => void;
}) {
  const rawDbUrl = product.imagen_url || product.url_imagen || product.imagen || '';
  const [imageSrc, setImageSrc] = useState<string>('');
  const [attempt, setAttempt] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setHasError(false);
    setAttempt(0);
    const initialUrl = formatImageUrl(rawDbUrl, product.referencia, bucketName);
    setImageSrc(initialUrl);
  }, [product, bucketName, rawDbUrl]);

  const handleError = () => {
    // Si la imagen de Google Drive (lh3.googleusercontent.com) falla, probar con la URL secundaria de exportación
    if (imageSrc.includes('lh3.googleusercontent.com/d/')) {
      const id = imageSrc.split('/d/')[1];
      setImageSrc(`https://drive.google.com/uc?export=view&id=${id}`);
      setAttempt(1);
      return;
    }

    // Probar formatos locales si todo lo demás falla
    const cleanRef = (product.referencia || '').trim().replace(/\//g, '_');
    if (attempt === 0 || attempt === 1) {
      setImageSrc(`${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanRef}.png`);
      setAttempt(2);
    } else if (attempt === 2) {
      setImageSrc(`${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanRef}.jpeg`);
      setAttempt(3);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className="text-center p-2">
        <span className="text-2xl">🖼️</span>
        <p className="text-[10px] font-semibold text-gray-400 mt-1">Sin Imagen</p>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={product.descripcion || product.referencia}
      onError={handleError}
      onClick={() => onImageClick(imageSrc)}
      className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
      referrerPolicy="no-referrer"
    />
  );
}

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

  const [bucketName] = useState('productos');

  const [priceList, setPriceList] = useState<'pvp1' | 'pvp3' | 'pvp4' | 'pvp5' | 'pvp6'>('pvp1');
  const [showPrices, setShowPrices] = useState(false);
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

    try {
      const { data, error } = await supabase.from('products').select('*').range(0, 2999);

      if (!error && data) {
        setProducts(data as Product[]);
        const uniqueLineas = Array.from(new Set(data.map((p: Product) => p.linea))).filter(Boolean) as string[];
        setLineas(uniqueLineas);
      }
    } catch (err) {
      console.error(err);
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-b from-[#2563eb] to-[#4f46e5] pt-10 pb-8 px-6 text-center">
            <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Acceso al Catálogo</h1>
            <p className="text-xs text-blue-100 mt-1">Ingresa tus credenciales autorizadas</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">USUARIO</label>
                <input
                  type="text"
                  value={usuarioInput}
                  onChange={(e) => setUsuarioInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">CONTRASEÑA</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
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
                className="w-full bg-[#1d63ed] hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm shadow-md"
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

        {/* HEADER IMPRESIÓN */}
        <div className="hidden print:flex items-center justify-between border-b-2 border-gray-300 pb-3 mb-4">
          <img src="/logo-texcomercial.jpg" alt="Texcomercial" className="h-16 object-contain" />
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-900">CATÁLOGO DE PRODUCTOS</h2>
            <p className="text-xs text-gray-500">Lista: {priceList.toUpperCase()}</p>
          </div>
        </div>

        {/* PANEL CONTROL */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm space-y-4 print:hidden">
          {currentUserRole === 'admin' && (
            <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-4">
              <div className="text-slate-700 text-xs font-bold mb-2">
                ⚙️ PANEL DE ADMINISTRACIÓN - Actualizar Catálogo Masivo
              </div>
              
              <form onSubmit={handleFileUpload} className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="text-xs text-gray-600 border border-gray-200 rounded-lg p-1"
                />
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-[#94a3b8] hover:bg-slate-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg"
                >
                  🔖 {uploading ? 'Cargando...' : 'Actualizar Catálogo'}
                </button>
              </form>

              {uploadStatus && (
                <div className="mt-2 text-xs text-emerald-700 font-semibold">
                  ✅ {uploadStatus.message}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">📦</span>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 leading-none">
                  Catálogo de Productos
                </h1>
                <div className="text-xs text-gray-500 font-medium mt-1 flex items-center gap-2">
                  <span>Mostrando: <strong className="text-blue-600">{filteredProducts.length}</strong> de {products.length}</span>
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
                className="bg-white border border-gray-200 text-gray-800 rounded-xl px-3 py-2 text-xs w-48 shadow-sm"
              />

              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="bg-white border border-gray-200 text-gray-800 rounded-xl px-3 py-2 text-xs shadow-sm"
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
                className="bg-blue-50 border border-blue-200 text-blue-700 font-bold px-3 py-2 rounded-xl text-xs"
              >
                <option value="pvp1">Lista PVP 1</option>
                <option value="pvp3">Lista PVP 3</option>
                <option value="pvp4">Lista PVP 4</option>
                <option value="pvp5">Lista PVP 5</option>
                <option value="pvp6">Lista PVP 6</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-2 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrices}
                  onChange={(e) => setShowPrices(e.target.checked)}
                />
                <span>Ver Precios</span>
              </label>

              <button
                onClick={() => window.print()}
                className="bg-[#ef4444] text-white font-bold text-xs px-3.5 py-2 rounded-xl"
              >
                🚩 PDF
              </button>

              <button
                onClick={handleLogout}
                className="bg-[#1e293b] text-white font-bold text-xs px-3.5 py-2 rounded-xl"
              >
                🚪 Salir
              </button>
            </div>
          </div>
        </div>

        {/* GRILLA DE PRODUCTOS */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3">
            {filteredProducts.map((p) => {
              const price = p[priceList] || 0;

              return (
                <div
                  key={p.referencia}
                  className="bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm print:break-inside-avoid"
                >
                  <div className="w-full h-44 bg-gray-50/70 rounded-xl overflow-hidden mb-3 flex items-center justify-center p-2">
                    <ProductImage
                      product={p}
                      bucketName={bucketName}
                      onImageClick={(url) => setPreviewImage(url)}
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-blue-600 uppercase mb-0.5">
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

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 print:hidden"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl w-full bg-white rounded-2xl p-2 shadow-2xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 bg-gray-900 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
            >
              ✕
            </button>
            <img 
              src={previewImage} 
              alt="Vista previa" 
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
