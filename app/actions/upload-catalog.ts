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

export async function processAndUploadCatalog(formData: FormData) {
  try {
    const userRole = formData.get('user') as string;

    if (userRole !== 'admin') {
      return { success: false, error: 'No tienes permisos de administrador para subir archivos.' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No se ha adjuntado ningún archivo.' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertir hoja a JSON
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return { success: false, error: 'El archivo subido está vacío o no tiene el formato correcto.' };
    }

    const uniqueProductsMap = new Map<string, ProductRecord>();

    rawRows.forEach((row) => {
      // 1. REFERENCIA (Columna A)
      const referencia = String(row['Referencia'] || row['referencia'] || row['A'] || '').trim();
      if (!referencia || referencia.toUpperCase() === 'REFERENCIA') return;

      // 2. DESCRIPCIÓN (Columna B)
      const descripcion = String(row['Descripcion'] || row['DESCRIPCION'] || row['Descripción'] || row['B'] || '').trim();

      // 3. LÍNEA / PROVEEDOR (Columna D)
      let lineaRaw = String(row['Linea'] || row['LINEA'] || row['Línea'] || row['D'] || '').trim();

      // Validación estricta: Si es número/decimal/precio o está vacío, asignar 'SIN LÍNEA'
      if (!lineaRaw || !isNaN(Number(lineaRaw)) || /^[\d.,]+$/.test(lineaRaw)) {
        lineaRaw = 'SIN LÍNEA';
      }

      // 4. EXISTENCIA (Columna E)
      const existencia = parseInt(String(row['Existencia'] || row['EXISTENCIA'] || row['E'] || '0'), 10) || 0;

      // 5. PRECIOS (Columnas F, G, H, I, J)
      const pvp1 = parseFloat(String(row['PVP1'] || row['pvp1'] || row['F'] || '0').replace(',', '.')) || 0;
      const pvp3 = parseFloat(String(row['PVP3'] || row['pvp3'] || row['G'] || '0').replace(',', '.')) || 0;
      const pvp4 = parseFloat(String(row['PVP4'] || row['pvp4'] || row['H'] || '0').replace(',', '.')) || 0;
      const pvp5 = parseFloat(String(row['PVP5'] || row['pvp5'] || row['I'] || '0').replace(',', '.')) || 0;
      const pvp6 = parseFloat(String(row['PVP6'] || row['pvp6'] || row['J'] || '0').replace(',', '.')) || 0;

      // 6. ESTADO COMPRA (Columna L)
      const estadoCompraRaw = 
        row['estado compra'] || 
        row['ESTADO COMPRA'] || 
        row['Estado Compra'] || 
        row['estado_compra'] || 
        row['L'] || 
        'SI - SI SE ANALIZA PARA COMPRAS';

      const estadoCompra = String(estadoCompraRaw).trim();

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

    if (formattedProducts.length === 0) {
      return { success: false, error: 'No se encontraron filas con el campo "Referencia" válido.' };
    }

    // Subida en bloques a Supabase
    const chunkSize = 500;
    let totalInserted = 0;

    for (let i = 0; i < formattedProducts.length; i += chunkSize) {
      const chunk = formattedProducts.slice(i, i + chunkSize);

      const { error } = await supabase
        .from('products')
        .upsert(chunk, { onConflict: 'referencia' });

      if (error) {
        console.error('Error al insertar en Supabase:', error);
        return { success: false, error: `Error en la base de datos: ${error.message}` };
      }

      totalInserted += chunk.length;
    }

    return {
      success: true,
      count: totalInserted,
      message: `Catálogo actualizado exitosamente. (${totalInserted} productos procesados)`,
    };

  } catch (error: any) {
    console.error('Error al procesar el archivo:', error);
    return {
      success: false,
      error: error.message || 'Ocurrió un error inesperado al procesar el archivo.',
    };
  }
}
