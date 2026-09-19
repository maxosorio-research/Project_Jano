import spriteUrl from "./jano-sprite.svg";

export type JanoIconName =
  | "par-completo"
  | "falta-traduccion"
  | "falta-original"
  | "ruta-perdida"
  | "vinculo-manual"
  | "conflicto-pareja"
  | "traduccion-en-proceso"
  | "carpeta"
  | "biblioteca"
  | "importar"
  | "alineacion"
  | "sync-scroll"
  | "realinear"
  | "proporcion-igual"
  | "proporcion-original"
  | "proporcion-traduccion"
  | "solo-original"
  | "solo-traduccion"
  | "sidebar"
  | "buscar"
  | "tamano-texto"
  | "destacar"
  | "comentario"
  | "etiqueta"
  | "nota"
  | "cita"
  | "segmento"
  | "pagina"
  | "traducir"
  | "ocr"
  | "modelo-local"
  | "par-idiomas"
  | "glosario"
  | "regenerar"
  | "ajustes"
  | "extensiones"
  | "clave-api"
  | "respaldo"
  | "privacidad-local"
  | "gestor-bibliografico"
  | "nuevo"
  | "cerrar"
  | "atras"
  | "mas-opciones"
  | "pagina-anterior"
  | "pagina-siguiente"
  | "zoom-mas"
  | "zoom-menos"
  | "bloquear-panel"
  | "desbloquear-panel"
  | "localizar-documento"
  | "inicio"
  | "nuevo-proyecto"
  | "abrir-proyecto"
  | "nueva-carpeta"
  | "quitar-de-jano"
  | "eliminar"
  | "restaurar"
  | "segmento-sin-alinear"
  | "problema-alineacion"
  | "vincular"
  | "desvincular"
  | "dividir"
  | "unir"
  | "aceptar"
  | "rechazar"
  | "informacion"
  | "advertencia"
  | "error"
  | "exito"
  | "seleccionado"
  | "actualizar"
  | "ordenar"
  | "filtrar"
  | "colapsar-todo"
  | "expandir-carpeta"
  | "contraer-carpeta";

type Props = {
  name: JanoIconName;
  size?: number;
  className?: string;
  title?: string;
};

/** Icono del set interno de Jano. Hereda el color vía `currentColor`. */
export function JanoIcon({ name, size = 16, className, title }: Props) {
  const classes = ["jano-icon", className].filter(Boolean).join(" ");

  return (
    <svg
      width={size}
      height={size}
      className={classes}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <use href={`${spriteUrl}#jano-${name}`} />
    </svg>
  );
}
