/** https://host/ruta.ics -> webcal://host/ruta.ics: abre la suscripción en el calendario del sistema (iOS/macOS). */
export function toWebcalUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "webcal://");
}
