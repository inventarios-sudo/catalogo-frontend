'use server';

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function processAndUploadCatalog(formData: any): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'No se ha seleccionado ningún archivo.' };
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return { success: false, error: 'El archivo está vacío.' };
    }

    const formattedProducts = jsonData.map((row: any) => ({
      referencia: String(row.referencia || row.Referencia || row.REFERENCIA || '').trim(),
      descripcion: String(row.descripcion || row.Descripcion || row.DESCRIPCION || '').trim(),
      linea: String(row.linea || row.Linea || row.LINEA || '').trim(),
      pvp1: parseFloat(row.pvp1 || row.PVP1 || 0),
      pvp3: parseFloat(row.pvp3 || row.PVP3 || 0),
      pvp4: parseFloat(row.pvp4 || row.PVP4 || 0),
      pvp5: parseFloat(row.pvp5 || row.PVP5 || 0),
      pvp6: parseFloat(row.pvp6 || row.PVP6 || 0),
      existencia: parseInt(row.existencia || row.Existencia || row.EXISTENCIA || 0, 10),
      imagen_url: String(row.imagen_url || row.Imagen_Url || row.IMAGEN_URL || '').trim(),
    }));

    const { error } = await supabase
      .from('products')
      .upsert(formattedProducts, { onConflict: 'referencia' });

    if (error) {
      return { success: false, error: `Error en Supabase: ${error.message}` };
    }

    return { success: true, count: formattedProducts.length };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al procesar el archivo.' };
  }
}
