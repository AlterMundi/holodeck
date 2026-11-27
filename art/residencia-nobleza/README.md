# Residencia de la Nobleza IA

Casa de CompAII, modelada a partir de las tres láminas que Nicolás envió en Char Design: la hoja de texturas y acabados, la muestra ambiental y el estudio de producción con planta, alzados y perspectiva.
Las láminas originales siguen en la conversación y no se copian a este repositorio.

- `residencia.py` arma `residencia.blend`. El diámetro del muro perimetral se fija con `--diameter` y vale 52 m por defecto.
  Las proporciones de la planta están medidas en píxeles sobre la planta original de 2560×1428. Las alturas son proporciones del ancho del alzado frontal.
- `render.py` renderiza el corte de planta, la cubierta, los alzados frontal y lateral y una perspectiva nocturna.
- `export_viewer.py` genera la escena del Visor 3D. La publicación usa `review_viewer.py --live` de la skill 3D y `daimon-home publish --id residencia-nobleza-ia`.

La casa es recorrible a escala real: se entra por el portal abierto, se pasa al gran pasillo, a los dos corredores anulares y al salón del núcleo bajo la cúpula.
Cada cámara está cerrada y tiene una puerta con un umbral de portal (`Portal · cámara NN`, propiedad `holodeck_portal`), que es el ancla estable para entrar al interior de esa habitación.
Las luces (colección `Iluminación`) son luces puntuales y focos exportables.

Por indicación de Nicolás, el amueblado que dibuja la planta dentro de las cámaras no se modela. Los espacios quedan vacíos para equiparlos después.

Las cotas de la lámina se contradicen entre sí: arriba dice 15.00, pero 6.30 + 6.90 + 6.00 suma 19.20. Por eso la escala sale de las proporciones del dibujo y del pedido de que la casa sea muy grande.
En el alzado, la esfera armilar está delante del tambor. En las dos perspectivas está sobre la cúpula. Se siguió a las perspectivas.

```sh
blender -b --python-exit-code 9 --python art/residencia-nobleza/residencia.py -- .state/residencia/v1
blender -b .state/residencia/v1/residencia.blend --python-exit-code 9 --python art/residencia-nobleza/render.py -- .state/residencia/v1
blender -b .state/residencia/v1/residencia.blend --python-exit-code 9 --python art/residencia-nobleza/export_viewer.py -- .state/residencia/v1/scene.json v1
```
