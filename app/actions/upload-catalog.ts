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
  imagen?: string;
  estado_compra?: string;
}

function sanitizeText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/NIÃ'A/g, 'NIÑA')
    .replace(/NIÑ'A/g, 'NIÑA')
    .replace(/COMPAÃIA/g, 'COMPAÑIA')
    .replace(/\uFFFD/g, 'Ñ')
    .trim();
}

function parseNum(v: any): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export async function processAndUploadCatalog(formData: FormData) {
  try {
    const userRole = formData.get('user') as string;
    if (userRole !== 'admin') {
      return { success: false, error: 'No tienes permisos de administrador.' };
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

    // Leer como matriz/arreglo (filas con celdas por posición)
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) {
      return { success: false, error: 'El archivo Excel está vacío.' };
    }

    const uniqueProductsMap = new Map<string, ProductRecord>();

    for (let rowIndex = 0; rowIndex < rawMatrix.length; rowIndex++) {
      const row = rawMatrix[rowIndex];
      if (!row || row.length === 0) continue;

      const col0 = sanitizeText(row[0]);
      if (!col0 || col0.toUpperCase() === 'REFERENCIA' || col0.toUpperCase() === 'REF') {
        continue; // Ignorar cabeceras
      }

      const referencia = col0;
      const descripcion = sanitizeText(row[1]);

      // Detectar dinámicamente si la columna 2 es Unidad (UND) o Línea
      let lineaIndex = 2;
      if (sanitizeText(row[2]).toUpperCase() === 'UND' || sanitizeText(row[2]).length <= 3) {
        lineaIndex = 3; // Hay columna de Unidad, por lo que Línea está en la celda 3
      }

      let lineaRaw = sanitizeText(row[lineaIndex]);
      if (!lineaRaw || !isNaN(Number(lineaRaw)) || /^[\d.,\s]+$/.test(lineaRaw)) {
        lineaRaw = 'SIN LÍNEA';
      }

      const existencia = parseInt(String(row[lineaIndex + 1] || '0').replace(',', '.'), 10) || 0;
      const pvp1 = parseNum(row[lineaIndex + 2]);
      const pvp3 = parseNum(row[lineaIndex + 3]);
      const pvp4 = parseNum(row[lineaIndex + 4]);
      const pvp5 = parseNum(row[lineaIndex + 5]);
      const pvp6 = parseNum(row[lineaIndex + 6]);

      // Buscar URL de imagen de Google Drive en las siguientes columnas
      let imagenUrl = '';
      for (let i = lineaIndex + 7; i < row.length; i++) {
        const val = sanitizeText(row[i]);
        if (val.includes('http://') || val.includes('https://') || val.includes('drive.google')) {
          imagenUrl = val;
          break;
        }
      }

      const estadoCompra = sanitizeText(row[row.length - 1] || 'SI - SI SE ANALIZA PARA COMPRAS');

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
        imagen: imagenUrl,
        estado_compra: estadoCompra,
      });
    }

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
      message: `Catálogo actualizado con éxito. (${totalInserted} productos procesados)`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al procesar el archivo.' };
  }
}
