# ActivaciÃ³n de la base pÃºblica de INCAMAT

La URL pÃºblica usa Cloudflare Worker y una base D1 independiente de MariaDB local. Antes de probar login o QR se debe completar esta Ãºnica vez:

1. En Cloudflare, abre **Compute > Workers & Pages > incamat > Settings > Bindings**.
2. Agrega una base **D1** con el nombre de variable `DB`. Crea o selecciona `incamat-db`.
3. En la consola SQL de esa base, ejecuta primero `cloudflare/migrations/0001_schema.sql`.
4. Genera el archivo de datos local ejecutando dentro del contenedor backend `node scripts/exportarD1Publico.js`. El resultado queda en `backend/exports/incamat-d1.sql` y no se sube a GitHub.
5. Importa ese archivo en la base D1. AsÃ­ se conservan Ã¡reas, las 703 mÃ¡quinas, sus cÃ³digos QR y los repuestos.
6. En **Settings > Variables and Secrets**, crea los secretos de producciÃ³n:
   - `INCAMAT_ADMIN_PASSWORD`
   - `INCAMAT_INGENIERO_PASSWORD`
   - `INCAMAT_TECNICO_PASSWORD`
   - `INCAMAT_OPERARIO_PASSWORD`
7. En la integraciÃ³n con GitHub usa el comando de compilaciÃ³n:
   `npm ci --prefix frontend && npm run build --prefix frontend`
   y conserva como despliegue `npx wrangler deploy`.

DespuÃ©s de ello, al iniciar sesiÃ³n por primera vez el Worker crea los cuatro usuarios estÃ¡ndar usando los secretos. Un QR fÃ­sico debe contener la URL `https://incamat.incamat-incalpaca.workers.dev/reportar/<token>` de la mÃ¡quina.

No subas el archivo `backend/exports/incamat-d1.sql` a GitHub: contiene informaciÃ³n operativa de la planta.

