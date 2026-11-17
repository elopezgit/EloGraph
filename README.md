# CensysDesigne Web

Editor web de diagramas (UML, procesos, secuencia, tablas de BD, casos de uso, catálogos) estilo Excalidraw/Figma.

## Ejecutar

```bash
npm install
npm run dev
```

Abrir http://localhost:5173

## Funcionalidades

- Canvas de dibujo libre (Excalidraw): formas, flechas, texto, comentarios.
- Pestañas múltiples por proyecto.
- Insertar shapes: Clase UML, Tabla BD, Caso de uso, Actor, Tarea, Gateway, Flecha, Comentario.
- Catálogos reutilizables (panel derecho).
- Guardar/Abrir archivo propio `.cdsgn` (JSON) con File System Access API (fallback descarga).
- Autosave en IndexedDB cada 5s.
- Exportar PDF vectorial y PNG.
- Importar Excel (`.xlsx`) como pestañas con contenido.

## Atajos

- Ctrl+S: Guardar.

## Notas

- PDF vectorial usa exportación SVG → jsPDF.
- Para navegadores sin File System Access API se usa descarga/subida de archivo.