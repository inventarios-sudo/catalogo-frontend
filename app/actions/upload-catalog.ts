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

    // 1. Leer el archivo Excel / CSV enviado
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convierte la hoja a objetos JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      return { success: false, error: 'El archivo Excel está vacío o no se pudo leer.' };
    }

    // 2. Mapear, limpiar espacios invisibles (.trim()) y eliminar duplicados por referencia
    const uniqueProductsMap = new Map();

    rawData.forEach((row) => {
      // Normalización de nombres de columnas y limpieza de espacios (.trim())
      const ref = String(
        row['REFERENCIA'] || row['referencia'] || row['Referencia'] || ''
      ).trim();

      const desc = String(
        row['DESCRIPCION'] || row['descripcion'] || row['Descripcion'] || ''
      ).trim();

      const linea = String(
        row['LINEA'] || row['linea'] || row['Linea'] || ''
      ).trim();

      // Solo procesamos si hay una referencia válida
      if (ref) {
        uniqueProductsMap.set(ref, {
          referencia: ref,
          descripcion: desc,
          linea: linea,
          pvp1: parseFloat(row['PVP1'] || row['pvp1'] || 0) || 0,
          pvp3: parseFloat(row['PVP3'] || row['pvp3'] || 0) || 0,
          pvp4: parseFloat(row['PVP4'] || row['pvp4'] || 0) || 0,
          pvp5: parseFloat(row['PVP5'] || row['pvp5'] || 0) || 0,
          pvp6: parseFloat(row['PVP6'] || row['pvp6'] || 0) || 0,
          existencia: parseInt(row['EXISTENCIA'] || row['existencia'] || 0, 10) || 0,
        });
      }
    });

    const productsToUpload = Array.from(uniqueProductsMap.values());

    if (productsToUpload.length === 0) {
      return { success: false, error: 'No se encontraron referencias válidas en la columna REFERENCIA.' };
    }

    // 3. Subir a Supabase en lotes (Batches) de 500 registros para evitar recarga del servidor
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
