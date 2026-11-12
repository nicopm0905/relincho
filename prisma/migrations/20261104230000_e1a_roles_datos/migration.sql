-- E1a 2/2 (roadmap §4): migración de datos de los roles. Solo datos, sin
-- cambios de esquema. Usa los valores de enum que añadió la 1/2
-- (20261028170000_e1a_roles_esquema), nunca los suyos propios.
-- Se puede volver a ejecutar sin efecto: solo toca filas que aún no estén migradas.
-- Vuelta atrás: no hay forma exacta de distinguir después a un PROFESSIONAL
-- que antes era VET_EXTERNAL, así que se hace copia de "Membership" antes de
-- aplicarla en producción.

-- El veterinario externo pasa a profesional con especialidad VET. Si alguien
-- ya le había puesto una especialidad, se respeta.
UPDATE "Membership"
SET "role" = 'PROFESSIONAL', "specialty" = COALESCE("specialty", 'VET')
WHERE "role" = 'VET_EXTERNAL';

-- La relación con el caballo se deduce del rol. Va después de la sentencia
-- anterior para que los antiguos VET_EXTERNAL queden como PROFESSIONAL.
-- Una relación ya puesta (CO_OWNER, HALF_LEASE...) no se pisa.
UPDATE "HorseAccess" AS ha
SET "relation" = CASE m."role"
    WHEN 'OWNER_EXTERNAL' THEN 'OWNER'::"HorseRelation"
    WHEN 'PROFESSIONAL' THEN 'PROFESSIONAL'::"HorseRelation"
    WHEN 'RIDER' THEN 'RIDER'::"HorseRelation"
  END
FROM "Membership" AS m
WHERE ha."membershipId" = m."id"
  AND ha."relation" IS NULL
  AND m."role" IN ('OWNER_EXTERNAL', 'PROFESSIONAL', 'RIDER');
