// Temporada WCBA actual. Unica fuente para los sitios del backend que antes
// tenian el numero suelto (server/index.ts, server/stats-ingest.ts).
//
// server/routes.ts mantiene su propia constante local CURRENT_SEASON_ID (no
// se toca aqui a proposito: routes.ts es fragil para edicion automatica por
// los template literals SQL de Drizzle -- ver ways-of-working).
export const CURRENT_SEASON_ID = 2092;
