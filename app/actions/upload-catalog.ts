'use server';

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://ykkfaflwzoyynhtmtqwp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function processAndUploadCatalog(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No se subió ningún archivo' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawData: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!rawData || rawData.length === 0) {
      return { success: false, error: 'El archivo Excel/CSV está vacío' };
    }

    const productsMap = new Map<string, any>();

    rawData.forEach((row) => {
      const getVal = (possibleKeys: string[]) => {
        for (const key of possibleKeys) {
          const foundKey = Object.keys(row).find(
            (k) => k.trim().toLowerCase() === key.toLowerCase()
          );
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
            return row[foundKey];
          }
        }
        return null;
      };

      const referencia = String(getVal(['referencia', 'ref', 'codigo', 'item']) || '').trim();
      const descripcion = String(getVal(['descripcion', 'nombre', 'producto', 'detalle']) || '').trim();
      const linea = String(getVal(['linea', 'categoria', 'marca']) || 'GENERAL').trim();

      const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const cleaned = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };

      const pvp1 = parseNum(getVal(['pvp1', 'precio1', 'precio_1', 'pvp']));
      const pvp3 = parseNum(getVal(['pvp3', 'precio3', 'precio_3']));
      const pvp4 = parseNum(getVal(['pvp4', 'precio4', 'precio_4']));
      const pvp5 = parseNum(getVal(['pvp5', 'precio5', 'precio_5']));
      const pvp6 = parseNum(getVal(['pvp6', 'precio6', 'precio_6']));
      const existencia = Math.floor(parseNum(getVal(['existencia', 'stock', 'cantidad', 'inv'])));
      
      const imagen_url = String(getVal(['imagen_url', 'imagen', 'url_imagen', 'foto']) || '').trim();

      if (referencia && descripcion) {
        // Al usar Map, si la referencia se repite en el archivo, conservará la última ocurrencia
        productsMap.set(referencia, {
          referencia,
          descripcion,
          linea,
          pvp1,
          pvp3,
          pvp4,
          pvp5,
          pvp6,
          existencia,
          imagen_url,
        });
      }
    });

    const productsToUpsert = Array.from(productsMap.values());

    if (productsToUpsert.length === 0) {
      return { success: false, error: 'No se encontraron filas válidas con referencia y descripción.' };
    }

    // Insertar/actualizar en bloques de 500
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
