# Flujo completo del caso de uso: Habilitación de WFS para capas vectoriales en Gisquick

## Contexto y problema inicial

El problema que estábamos resolviendo era que, cuando un usuario añadía una nueva capa vectorial a un proyecto QGIS existente, la opción para habilitar WFS (Web Feature Service) no aparecía automáticamente, lo que impedía que esa capa fuera consultable (queryable) en Gisquick.

## Flujo completo de la aplicación

### 1. **Apertura del proyecto QGIS**
- El usuario trabaja con un proyecto QGIS y puede añadir nuevas capas vectoriales
- Cuando el usuario quiere publicarlo en Gisquick, accede a la interfaz web

### 2. **Carga inicial de la vista de publicación**
- `PublishView.vue` se inicializa y verifica si hay conexión con el plugin QGIS
- Si hay conexión, llama a `onProjectChange()` que a su vez llama a `fetchProjectInfo()` para obtener los metadatos del proyecto

### 3. **Análisis de las capas del proyecto**
- El sistema recibe los metadatos que incluyen información sobre todas las capas
- La propiedad computada `wfsNotEnabled` determina si hay capas vectoriales en el proyecto
- Según nuestra modificación, mostramos siempre el botón "Make Queryable" cuando hay capas vectoriales

### 4. **Detección del estado de las capas**
- El archivo `flags.js` contiene la lógica que determina si una capa es "queryable" (consultable)
- Para que una capa sea consultable necesita:
  1. Tener WFS habilitado (`options.wfs` con al menos un valor)
  2. Tener el flag "query" en su lista de flags

### 5. **Habilitación de WFS y flags de consulta**
- Cuando el usuario hace clic en "Make Queryable", se ejecuta el método `enableWFS()`
- Este método ahora incluye dos parámetros clave en la solicitud:
  - `all: true` - Para aplicar a todas las capas vectoriales
  - `makeQueryable: true` - Para asegurarse de que se añada el flag "query"
- La solicitud va al plugin QGIS que modifica la configuración del proyecto

### 6. **Actualización de la interfaz**
- Después de habilitar WFS, se vuelve a llamar a `fetchProjectInfo()` para actualizar los metadatos
- La interfaz se actualiza mostrando las capas con sus nuevas capacidades
- Se muestra un mensaje de éxito al usuario

### 7. **Flujo de publicación**
- Con todas las capas vectoriales correctamente configuradas como consultables
- El usuario puede continuar con el proceso de publicación del proyecto en Gisquick

## Solución implementada

Nuestra solución modificó el comportamiento para:

1. Mostrar siempre el botón "Make Queryable" cuando hay capas vectoriales
2. Al hacer clic en el botón, habilitar WFS para todas las capas vectoriales
3. Asegurarse de que se añada el flag "query" a las capas vectoriales
4. Actualizar la interfaz inmediatamente para reflejar los cambios

Esta solución unificó el comportamiento entre proyectos nuevos y proyectos con capas añadidas posteriormente, solucionando el problema original.



# Explicación sencilla del problema de las tablas de atributos en capas vectoriales

## El problema 

Cuando se añadía una nueva capa vectorial a un proyecto existente de QGIS, no se podía ver su tabla de atributos (la información asociada) después de publicarlo en Gisquick. Sin embargo, cuando se creaba un proyecto nuevo con esas mismas capas, todo funcionaba correctamente.

## Conceptos clave para entender el problema

- **Capa vectorial**: Es una capa en un mapa que contiene objetos como puntos, líneas o polígonos (por ejemplo, edificios, calles, parcelas).

- **WFS (Web Feature Service)**: Es un protocolo que permite acceder a los datos y atributos de una capa. En términos sencillos, es como "abrir la puerta" para poder ver y consultar la información asociada a cada elemento del mapa.

- **Queryable (Consultable)**: Es la propiedad que permite que una capa pueda ser interrogada para mostrar sus atributos. Para que una capa sea consultable necesita:
  1. Tener habilitado el servicio WFS
  2. Tener marcada la opción "query" en sus ajustes

## ¿Qué fallaba?

Cuando se añadía una nueva capa vectorial a un proyecto existente:

1. El sistema no detectaba correctamente que la nueva capa necesitaba tener WFS habilitado
2. No aparecía el botón para habilitar WFS en la interfaz
3. Como resultado, la capa se publicaba sin capacidad para mostrar su tabla de atributos

## La solución implementada

Hemos modificado el código para que:

1. Detecte cualquier capa vectorial que no tenga WFS habilitado
2. Muestre siempre el botón "Make Queryable" (Hacer consultable) cuando haya capas vectoriales sin WFS
3. Al hacer clic en el botón, se habiliten todas las capas vectoriales para consultas
4. Actualice automáticamente la interfaz para mostrar los cambios

Ahora, tanto las capas vectoriales en proyectos nuevos como las añadidas posteriormente se configuran correctamente y permiten ver sus tablas de atributos.