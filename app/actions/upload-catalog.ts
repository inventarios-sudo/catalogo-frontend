'use server';

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function processAndUploadCatalog(formData: FormData) {
  try {
    const file = formData.get('file') as File;

    if (!file) {
      return { success: false, error: 'No se seleccionó ningún archivo.' };
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      return { success: false, error: 'El archivo Excel está vacío o no se pudo leer.' };
    }

    const uniqueProductsMap = new Map();

    rawData.forEach((row) => {
      // Búsqueda insensible a mayúsculas/minúsculas y espacios en las llaves del Excel
      const rowKeys = Object.keys(row);
      
      const getVal = (keyName: string) => {
        const foundKey = rowKeys.find(
          (k) => k.trim().toLowerCase() === keyName.trim().toLowerCase()
        );
        return foundKey ? row[foundKey] : undefined;
      };

      const ref = String(getVal('referencia') || '').trim();
      const desc = String(getVal('descripcion') || '').trim();
      const linea = String(getVal('linea') || '').trim();

      // Extracción limpia de Existencia
      const rawExistencia = getVal('existencia') ?? getVal('stock') ?? 0;
      const cleanExistencia = String(rawExistencia).replace(/[,.\s]/g, '').trim();
      const parsedExistencia = parseInt(cleanExistencia, 10);
      const existenciaFinal = isNaN(parsedExistencia) ? 0 : parsedExistencia;

      const parsePrice = (val: any) => {
        if (!val) return 0;
        const clean = String(val).replace(',', '.').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      };

      if (ref) {
        uniqueProductsMap.set(ref, {
          referencia: ref,
          descripcion: desc,
          linea: linea,
          pvp1: parsePrice(getVal('pvp1')),
          pvp3: parsePrice(getVal('pvp3')),
          pvp4: parsePrice(getVal('pvp4')),
          pvp5: parsePrice(getVal('pvp5')),
          pvp6: parsePrice(getVal('pvp6')),
          existencia: existenciaFinal, // Campo exacto como en Supabase
        });
      }
    });

    const productsToUpload = Array.from(uniqueProductsMap.values());

    if (productsToUpload.length === 0) {
      return { success: false, error: 'No se encontraron referencias válidas.' };
    }

    const BATCH_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < productsToUpload.length; i += BATCH_SIZE) {
      const batch = productsToUpload.slice(i, i + BATCH_SIZE);

      const { error } = await supabase
        .from('products')
        .upsert(batch, { onConflict: 'referencia' });

      if (error) {
        console.error('Error al insertar lote en Supabase:', error);
        return {
          success: false,
          error: `Error al subir el lote desde el índice ${i}: ${error.message}`,
        };
      }

      totalInserted += batch.length;
    }

    return {
      success: true,
      count: totalInserted,
      message: `¡Éxito! Se actualizaron ${totalInserted} productos correctamente.`,
    };

  } catch (error: any) {
    console.error('Error interno en processAndUploadCatalog:', error);
    return {
      success: false,
      error: error.message || 'Ocurrió un error inesperado al procesar el archivo.',
    };
  }
}
