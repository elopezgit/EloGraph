# elograph Web

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
- Panel lateral de piezas como mini-lienzos dibujados (SVG), con inserción por clic o arrastrar al lienzo.
- Importar librerías `.excalidrawlib` desde URL (incluido `libraries.excalidraw.com`).
- Guardar/Abrir archivo propio `.cdsgn` (JSON) con File System Access API (fallback descarga).
- Abrir lienzos `.excalidraw` de Excalidraw: se importan como una nueva pestaña del proyecto actual (con sus elementos, imágenes y vista).
- Autosave en IndexedDB cada 5s.
- Exportar PDF vectorial y PNG.
- Importar Excel (`.xlsx`) como pestañas con contenido.
- Asistente IA (botón **IA**): interpreta el dibujo de la pestaña activa (o de todo el proyecto) y lo convierte a texto Markdown (resumen, pasos, actores, decisiones). Envía una imagen PNG + un grafo de elementos a cualquier API compatible con OpenAI (Gemini por defecto, OpenAI, OpenRouter u Ollama local). El resultado se puede copiar, insertar en el lienzo o descargar como `.md`. La clave se guarda solo en el navegador.

## Atajos

- Ctrl+S: Guardar.

## Notas

- PDF vectorial usa exportación SVG → jsPDF.
- Para navegadores sin File System Access API se usa descarga/subida de archivo.