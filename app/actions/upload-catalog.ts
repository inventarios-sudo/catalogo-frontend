'use server';

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Inicializar cliente de Supabase (usa las variables de entorno de tu proyecto)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Convierte un enlace de Google Drive en un enlace directo de imagen
 */
function convertDriveUrl(url: string): string {
  if (!url) return '';
  const strUrl = url.toString().trim();
  
  // Buscar el ID en formatos tipo /d/ID/view o id=ID
  const match = strUrl.match(/\/d\/([^\/]+)/) || strUrl.match(/id=([^&]+)/);
  
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  
  return strUrl;
}

/**
 * Parsea un valor a número decimal/entero de forma segura
 */
function parseNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = val.toString().replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function processAndUploadCatalog(formData: FormData) {
  try {
    const file = formData.get('file') as File;

    if (!file) {
      return { success: false, error: 'No se seleccionó ningún archivo.' };
    }

    // Leer el archivo enviado como buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parsear el libro de Excel / CSV
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convertir la hoja a objetos JSON
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return { success: false, error: 'El archivo está vacío o no tiene un formato válido.' };
    }

    // Mapeo y limpieza de datos
    const productsToInsert = rawRows
      .map((row) => {
        // Normalizar los nombres de las columnas a minúsculas para evitar diferencias de mayúsculas
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach((key) => {
          normalizedRow[key.trim().toLowerCase()] = row[key];
        });

        // Obtener la referencia
        const referencia = (normalizedRow['referencia'] || '').toString().trim();

        // Ignorar filas que no tengan referencia
        if (!referencia) return null;

        // Procesar la URL de la imagen (Columna 'Imagen' o 'imagen')
        const rawImageUrl = (normalizedRow['imagen'] || '').toString().trim();
        const cleanImageUrl = convertDriveUrl(rawImageUrl);

        return {
          referencia: referencia,
          descripcion: (normalizedRow['descripcion'] || '').toString().trim(),
          um_precio: (normalizedRow['u.m. precio'] || normalizedRow['u.m.precio'] || normalizedRow['um_precio'] || '').toString().trim(),
          linea: (normalizedRow['linea'] || '').toString().trim(),
          existencia: parseNumber(normalizedRow['existencia']),
          pvp1: parseNumber(normalizedRow['pvp1']),
          pvp3: parseNumber(normalizedRow['pvp3']),
          pvp4: parseNumber(normalizedRow['pvp4']),
          pvp5: parseNumber(normalizedRow['pvp5']),
          pvp6: parseNumber(normalizedRow['pvp6']),
          imagen: cleanImageUrl,
          estado_compra: (normalizedRow['estado compra'] || normalizedRow['estado_compra'] || '').toString().trim(),
        };
      })
      .filter((item) => item !== null); // Filtrar filas vacías

    if (productsToInsert.length === 0) {
      return { success: false, error: 'No se encontraron datos válidos con la columna "Referencia".' };
    }

    // 1. Opcional: Limpiar o vaciar la tabla actual antes de insertar
    // const { error: deleteError } = await supabase.from('products').delete().neq('referencia', '');
    // if (deleteError) console.error('Error al limpiar la tabla:', deleteError);

    // 2. Insertar/Actualizar en Supabase en bloques de 500 registros
    const BATCH_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE) {
      const batch = productsToInsert.slice(i, i + BATCH_SIZE);

      const { error } = await supabase
        .from('products')
        .upsert(batch, { onConflict: 'referencia' }); // Utiliza 'referencia' como clave única

      if (error) {
        console.error(`Error en el lote ${i / BATCH_SIZE + 1}:`, error);
        return { success: false, error: `Error guardando en base de datos: ${error.message}` };
      }

      totalInserted += batch.length;
    }

    return {
      success: true,
      message: `¡Éxito! Se actualizaron ${totalInserted} productos.`,
      count: totalInserted,
    };
  } catch (error: any) {
    console.error('Error en processAndUploadCatalog:', error);
    return { success: false, error: error?.message || 'Error interno al procesar el archivo.' };
  }
}
