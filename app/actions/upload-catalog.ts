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
  [key: string]: any;
}

export async function processAndUploadCatalog(formData: FormData) {
  try {
    const userRole = formData.get('user') as string;

    // Validación de seguridad por rol
    if (userRole !== 'admin') {
      return { success: false, error: 'No tienes permisos de administrador para subir archivos.' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No se ha adjuntado ningún archivo.' };
    }

    // Convertir el archivo cargado a Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Leer el libro de trabajo Excel/CSV
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertir la hoja a JSON
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return { success: false, error: 'El archivo subido está vacío o no tiene el formato correcto.' };
    }

    // Mapear y procesar cada fila del archivo
    const formattedProducts: ProductRecord[] = rawRows
      .map((row) => {
        // Mapeo flexible para nombres de encabezados con/sin acentos o variantes
        const referencia = String(row['Referencia'] || row['referencia'] || row['CODIGO'] || row['codigo'] || '').trim();
        const descripcion = String(row['Descripcion'] || row['DESCRIPCION'] || row['descripcion'] || row['Descripción'] || '').trim();
        const linea = String(row['Linea'] || row['LINEA'] || row['linea'] || row['Línea'] || '').trim();
        const imagen = String(row['Imagen'] || row['IMAGEN'] || row['imagen'] || row['Url'] || '').trim();

        // Mapeo específico para la columna ESTADO COMPRA
        const estadoCompraRaw = 
          row['estado compra'] || 
          row['ESTADO COMPRA'] || 
          row['Estado Compra'] || 
          row['estado_compra'] || 
          row['ESTADO PARA ANALISIS DE COMPRAS'] || 
          row['ESTADO PARA ANÁLISIS DE COMPRAS'] || 
          'SI - SI SE ANALIZA PARA COMPRAS';

        const estadoCompra = String(estadoCompraRaw).trim();

        // Conversión y limpieza de valores numéricos
        const pvp1 = parseFloat(String(row['PVP1'] || row['pvp1'] || '0').replace(',', '.')) || 0;
        const pvp3 = parseFloat(String(row['PVP3'] || row['pvp3'] || '0').replace(',', '.')) || 0;
        const pvp4 = parseFloat(String(row['PVP4'] || row['pvp4'] || '0').replace(',', '.')) || 0;
        const pvp5 = parseFloat(String(row['PVP5'] || row['pvp5'] || '0').replace(',', '.')) || 0;
        const pvp6 = parseFloat(String(row['PVP6'] || row['pvp6'] || '0').replace(',', '.')) || 0;

        const existencia = parseInt(String(row['Existencia'] || row['EXISTENCIA'] || row['existencia'] || row['Stock'] || '0'), 10) || 0;

        return {
          referencia,
          descripcion,
          linea,
          pvp1,
          pvp3,
          pvp4,
          pvp5,
          pvp6,
          existencia,
          imagen,
          estado_compra: estadoCompra,
        };
      })
      // Omitir filas que no tengan referencia válida
      .filter((p) => p.referencia !== '');

    if (formattedProducts.length === 0) {
      return { success: false, error: 'No se encontraron filas con el campo "Referencia" válido.' };
    }

    // Insertar/Actualizar en Supabase en bloques (chunks) para evitar límites de payload
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
