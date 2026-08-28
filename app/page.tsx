'use server';

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function processAndUploadCatalog(formData: FormData) {
  try {
    const currentUser = (formData.get('user') as string || '').toLowerCase().trim();

    if (currentUser !== 'admin') {
      return { 
        success: false, 
        error: '⛔ Acceso denegado: Solo la cuenta Administrador tiene permisos para realizar cargas masivas.' 
      };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No se subió ningún archivo' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      return { success: false, error: 'El archivo Excel/CSV está vacío' };
    }

    const productsMap = new Map<string, any>();

    rawData.forEach((row) => {
      const getVal = (possibleKeys: string[]) => {
        const rowKeys = Object.keys(row);
        for (const key of possibleKeys) {
          const foundKey = rowKeys.find((k) => {
            const cleanK = k.trim().toLowerCase();
            const cleanKey = key.trim().toLowerCase();
            return cleanK === cleanKey || cleanK.includes(cleanKey);
          });
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
            return row[foundKey];
          }
        }
        return null;
      };

      const referencia = String(getVal(['referencia', 'ref', 'codigo', 'item']) || '').trim();
      
      const descripcion = String(
        getVal(['descripción', 'descripcion', 'nombre', 'producto', 'articulo', 'detalle']) || ''
      ).trim();

      const linea = String(getVal(['linea', 'categoría', 'categoria', 'marca', 'grupo']) || 'GENERAL').trim();

      const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const cleaned = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };

      const pvp1 = parseNum(getVal(['pvp1', 'precio1', 'precio_1', 'pvp', 'precio']));
      const pvp3 = parseNum(getVal(['pvp3', 'precio3', 'precio_3']));
      const pvp4 = parseNum(getVal(['pvp4', 'precio4', 'precio_4']));
      const pvp5 = parseNum(getVal(['pvp5', 'precio5', 'precio_5']));
      const pvp6 = parseNum(getVal(['pvp6', 'precio6', 'precio_6']));
      const existencia = Math.floor(parseNum(getVal(['existencia', 'stock', 'cantidad', 'inv', 'saldo'])));
      
      let rawImg = String(getVal(['imagen', 'imagen_url', 'foto', 'url', 'link']) || '').trim();
      if (rawImg.includes('#N/A') || rawImg.includes('N/A')) {
        rawImg = '';
      }
      const imagen_url = rawImg;

      // Lectura de la columna "ESTADO PARA ANALISIS DE COMPRAS"
      const estado_analisis = String(
        getVal([
          'estado para analisis de compras',
          'analisis de compras',
          'estado analisis',
          'analisis_compras'
        ]) || 'SI'
      ).trim();

      if (referencia) {
        productsMap.set(referencia, {
          referencia,
          descripcion: descripcion || referencia,
          linea: linea || 'GENERAL',
          pvp1,
          pvp3,
          pvp4,
          pvp5,
          pvp6,
          existencia,
          imagen_url,
          estado_analisis,
        });
      }
    });

    const productsToUpsert = Array.from(productsMap.values());

    if (productsToUpsert.length === 0) {
      return { 
        success: false, 
        error: 'No se encontraron columnas válidas de Referencia en el archivo.' 
      };
    }

    const chunkSize = 500;
    for (let i = 0; i < productsToUpsert.length; i += chunkSize) {
      const chunk = productsToUpsert.slice(i, i + chunkSize);
      const { error: upsertError } = await supabase
        .from('products')
        .upsert(chunk, { onConflict: 'referencia' });

      if (upsertError) {
        return { success: false, error: `Error en Supabase: ${upsertError.message}` };
      }
    }

    return { success: true, count: productsToUpsert.length };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado procesando el catálogo' };
  }
}
