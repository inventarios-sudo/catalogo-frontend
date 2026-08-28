'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { processAndUploadCatalog } from '@/app/actions/upload-catalog';
import { QRCodeSVG } from 'qrcode.react';

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
  [key: string]: any;
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

function resolveImageUrl(product: Product, bucketName: string): string[] {
  let foundUrl = '';

  for (const key of Object.keys(product)) {
    const val = product[key];
    if (typeof val === 'string' && val.trim().startsWith('http')) {
      foundUrl = val.trim();
      break;
    }
  }

  if (foundUrl.includes('drive.google.com') || foundUrl.includes('docs.google.com')) {
    const match = foundUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || foundUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return [
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        `https://drive.google.com/uc?export=view&id=${fileId}`
      ];
    }
  }

  if (foundUrl) {
    return [foundUrl];
  }

  const cleanRef = (product.referencia || '').trim().replace(/\//g, '_');
  return [
    `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanRef}.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanRef}.png`,
    `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanRef}.jpeg`,
    `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${cleanRef}.JPG`
  ];
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
  const [candidateUrls, setCandidateUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const urls = resolveImageUrl(product, bucketName);
    setCandidateUrls(urls);
    setCurrentIndex(0);
    setHasError(false);
  }, [product, bucketName]);

  const handleError = () => {
    if (currentIndex + 1 < candidateUrls.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const currentSrc = candidateUrls[currentIndex] || '';

  if (hasError || !currentSrc) {
    return (
      <div className="text-center p-2">
        <span className="text-2xl">🖼️</span>
        <p className="text-[10px] font-semibold text-gray-400 mt-1">Sin Imagen</p>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={product.descripcion || product.referencia}
      onError={handleError}
      onClick={() => onImageClick(currentSrc)}
      className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
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

  // Estado para el modal de código QR
  const [showQRModal, setShowQRModal] = useState(false);
  const [generatedQRUrl, setGeneratedQRUrl] = useState('');

  // Cargar parámetros de la URL al iniciar (si se accede mediante escaneo de QR)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlLine = params.get('linea');
      const urlList = params.get('lista');
      const urlPrices = params.get('precios');

      if (urlLine) setSelectedLine(decodeURIComponent(urlLine));
      if (urlList && ['pvp1', 'pvp3', 'pvp4', 'pvp5', 'pvp6'].includes(urlList)) {
        setPriceList(urlList as any);
      }
      if (urlPrices !== null) {
        setShowPrices(urlPrices === '1' || urlPrices === 'true');
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = usuarioInput.trim().toLowerCase();
    const p = passwordInput.trim();
    const matchedUser = USERS_DATABASE[u];

    if (matchedUser && matchedUser.pass === p) {
      setIsAuthenticated(true);
      setCurrentUserRole(matchedUser.role);
      setCurrentUserName(matchedUser.name);
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

  // Función para construir la URL codificada e invocar el modal del QR
  const handleGenerateQR = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();

    if (selectedLine) {
      params.set('linea', selectedLine);
    }
    params.set('lista', priceList);
    params.set('precios', showPrices ? '1' : '0');

    const finalUrl = `${baseUrl}?${params.toString()}`;
    setGeneratedQRUrl(finalUrl);
    setShowQRModal(true);
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
    <div className="min-h-screen bg-[#f3f4f6] text-gray-800 p-4 md:p-6 print:bg-white print:p-0">
      
      {/* ESTILOS DE IMPRESIÓN */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 15mm 10mm 15mm 10mm;
          }
          body {
            background-color: #ffffff !important;
          }
          .print-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #e2e8f0;
            background-color: white;
            z-index: 1000;
          }
          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 30px;
            display: flex !important;
            align-items: center;
            justify-content: center;
            border-top: 1px solid #e2e8f0;
            background-color: white;
            z-index: 1000;
          }
          .print-content-padding {
            padding-top: 70px;
            padding-bottom: 40px;
          }
        }
      `}</style>

      {/* HEADER VISIBLE SÓLO EN IMPRESIÓN / PDF */}
      <div className="hidden print-header">
        <img src="/logo-texcomercial.jpg" alt="Texcomercial" className="h-12 object-contain" />
        <div className="text-right">
          <h2 className="text-base font-bold text-gray-900 tracking-tight">CATÁLOGO DE PRODUCTOS</h2>
          <p className="text-[10px] text-gray-500 font-semibold uppercase">
            Lista: {priceList.toUpperCase()} {selectedLine ? `| Línea: ${selectedLine}` : ''}
          </p>
        </div>
      </div>

      {/* FOOTER VISIBLE SÓLO EN IMPRESIÓN / PDF */}
      <div className="hidden print-footer">
        <p className="text-xs font-bold text-gray-700 tracking-wider uppercase">
          * PRECIOS NO INCLUYEN IVA *
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-4 print-content-padding">

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
                className="bg-white border border-gray-200 text-gray-800 rounded-xl px-3 py-2 text-xs shadow-sm font-semibold"
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

              {/* BOTÓN DE GENERACIÓN DE QR */}
              <button
                onClick={handleGenerateQR}
                className="bg-[#0284c7] hover:bg-sky-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-colors"
              >
                📱 Generar QR
              </button>

              <button
                onClick={() => window.print()}
                className="bg-[#ef4444] hover:bg-red-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-colors"
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
                  className="bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm print:break-inside-avoid print:shadow-none print:border-gray-300"
                >
                  <div className="w-full h-44 bg-gray-50/70 rounded-xl overflow-hidden mb-3 flex items-center justify-center p-2 print:bg-white">
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

      {/* MODAL PARA MOSTRAR EL CÓDIGO QR GENERADO */}
      {showQRModal && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 print:hidden"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
            >
              ✕
            </button>

            <div>
              <h3 className="text-lg font-bold text-gray-900">Código QR del Catálogo</h3>
              <p className="text-xs text-gray-500 mt-1">
                Escanea este código para ver el catálogo con la configuración actual.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-center border border-gray-100">
              <QRCodeSVG value={generatedQRUrl} size={200} level="H" includeMargin={true} />
            </div>

            <div className="text-left bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 space-y-1">
              <div><strong>Línea:</strong> {selectedLine || 'Todas las Líneas'}</div>
              <div><strong>Lista Seleccionada:</strong> {priceList.toUpperCase()}</div>
              <div>
                <strong>Precios Visibles:</strong>{' '}
                <span className={showPrices ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                  {showPrices ? 'SÍ (Con Precios)' : 'NO (Sin Precios)'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full bg-[#0284c7] hover:bg-sky-700 text-white font-bold py-2.5 rounded-xl text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL PARA VISTA PREVIA DE IMAGEN */}
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
