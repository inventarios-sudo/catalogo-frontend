'use server';

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export interface ProductRecord {
  referencia: string;
  descripcion: string;
  linea: string;
  pvp1: number;
  pvp3: number;
  pvp4: number;
  pvp5: number;
  pvp6: number;
  existencia: number;
  estado_compra?: string;
  [key: string]: any;
}

// Sanitizar codificación de textos
function fixEncoding(text: string): string {
  if (!text) return '';
  return text
    .replace(/NIÃ'A/g, 'NIÑA')
    .replace(/NIÑ'A/g, 'NIÑA')
    .replace(/COMPAÃIA/g, 'COMPAÑIA')
    .replace(/COMPAÑIA/g, 'COMPAÑIA')
    .replace(/\uFFFD/g, 'Ñ')
    .trim();
}

function esInvalidoParaLinea(val: string): boolean {
  if (!val) return true;
  const clean = val.trim();
  if (!isNaN(Number(clean))) return true;
  if (/^[\d.,\s]+$/.test(clean)) return true;
  return false;
}

export async function processAndUploadCatalog(formData: FormData) {
  try {
    const userRole = formData.get('user') as string;
    if (userRole !== 'admin') {
      return { success: false, error: 'No tienes permisos de administrador para realizar esta acción.' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No se ha adjuntado ningún archivo.' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rawRows || rawRows.length === 0) {
      return { success: false, error: 'El archivo Excel no contiene datos.' };
    }

    const uniqueProductsMap = new Map<string, ProductRecord>();

    rawRows.forEach((row) => {
      const referencia = fixEncoding(String(row['Referencia'] || row['referencia'] || row['A'] || '')).trim();
      if (!referencia || referencia.toUpperCase() === 'REFERENCIA') return;

      const descripcion = fixEncoding(String(row['Descripcion'] || row['DESCRIPCION'] || row['Descripción'] || row['B'] || ''));

      let lineaRaw = fixEncoding(String(
        row['Linea'] || row['LINEA'] || row['Línea'] || row['LÍNEA'] || row['Proveedor'] || row['PROVEEDOR'] || row['D'] || ''
      ));

      if (esInvalidoParaLinea(lineaRaw)) {
        lineaRaw = 'SIN LÍNEA';
      }

      const existencia = parseInt(String(row['Existencia'] || row['EXISTENCIA'] || row['E'] || '0').replace(',', '.'), 10) || 0;

      const parseNum = (v: any) => {
        if (!v) return 0;
        const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
      };

      const pvp1 = parseNum(row['PVP1'] || row['pvp1'] || row['F']);
      const pvp3 = parseNum(row['PVP3'] || row['pvp3'] || row['G']);
      const pvp4 = parseNum(row['PVP4'] || row['pvp4'] || row['H']);
      const pvp5 = parseNum(row['PVP5'] || row['pvp5'] || row['I']);
      const pvp6 = parseNum(row['PVP6'] || row['pvp6'] || row['J']);

      const estadoCompra = fixEncoding(String(row['estado compra'] || row['ESTADO COMPRA'] || row['L'] || 'SI - SI SE ANALIZA PARA COMPRAS'));

      uniqueProductsMap.set(referencia, {
        referencia,
        descripcion,
        linea: lineaRaw,
        pvp1,
        pvp3,
        pvp4,
        pvp5,
        pvp6,
        existencia,
        estado_compra: estadoCompra,
      });
    });

    const formattedProducts = Array.from(uniqueProductsMap.values());
    const chunkSize = 500;
    let totalInserted = 0;

    for (let i = 0; i < formattedProducts.length; i += chunkSize) {
      const chunk = formattedProducts.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('products')
        .upsert(chunk, { onConflict: 'referencia' });

      if (error) {
        return { success: false, error: `Error DB: ${error.message}` };
      }
      totalInserted += chunk.length;
    }

    return {
      success: true,
      count: totalInserted,
      message: `Catálogo actualizado exitosamente. (${totalInserted} productos procesados)`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error inesperado al procesar el archivo.' };
  }
}
