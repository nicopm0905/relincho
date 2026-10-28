-- Migración base de Relincho (S0-0.5, roadmap §1.7).
--
-- Es el esquema `public` de producción tal cual estaba el 28 oct 2026, tras las
-- 15 migraciones que ahora viven en prisma/migrations-archivo/ (el esquema
-- inicial se creó con `db push` y nunca tuvo migración). Incluye RLS, políticas,
-- triggers de inalterabilidad de Veri*Factu y permisos, que `prisma migrate
-- diff` no captura.
--
-- Origen: pg_dump --schema=public --schema-only --no-owner
--         --exclude-table=public._prisma_migrations (pg_dump 17.11, servidor 17.6)
-- Quitado del volcado: órdenes de psql (\restrict), SET de sesión, el
-- set_config del search_path, CREATE/COMMENT ON SCHEMA public y los
-- ALTER DEFAULT PRIVILEGES de la plataforma Supabase.
--
-- Requiere que existan los roles anon, authenticated y service_role (en
-- Supabase existen; en la BD de tests los crea scripts/test-db.mjs).
-- En producción NO se ejecuta: se marca con `prisma migrate resolve --applied`.

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

--
-- Name: CoveringMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CoveringMethod" AS ENUM (
    'NATURAL',
    'AI_FRESH',
    'AI_REFRIGERATED',
    'AI_FROZEN',
    'ET'
);

--
-- Name: DayStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DayStatus" AS ENUM (
    'PLANNED',
    'COMPLETED',
    'MISSED',
    'ADJUSTED'
);

--
-- Name: Discipline; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Discipline" AS ENUM (
    'DOMA_CLASICA',
    'DOMA_VAQUERA',
    'SALTO',
    'COMPLETO',
    'RAID',
    'ENGANCHES',
    'FUNCIONALIDAD',
    'OCIO'
);

--
-- Name: EquineSpecies; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EquineSpecies" AS ENUM (
    'CABALLAR',
    'ASNAL',
    'MULAR',
    'BURDEGANO'
);

--
-- Name: FatigueZone; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FatigueZone" AS ENUM (
    'BAJA',
    'MEDIA',
    'ALTA'
);

--
-- Name: HealthEventType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HealthEventType" AS ENUM (
    'VACCINE',
    'DEWORMING',
    'DENTAL',
    'FARRIER',
    'VET_CHECKUP',
    'TREATMENT',
    'INJURY',
    'OTHER'
);

--
-- Name: HorseStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HorseStatus" AS ENUM (
    'ACTIVE',
    'SOLD',
    'DEAD',
    'RETIRED',
    'IN_TRAINING'
);

--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'ISSUED',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);

--
-- Name: Lameness; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Lameness" AS ENUM (
    'NO',
    'DUDOSA',
    'SI'
);

--
-- Name: MesocyclePhase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MesocyclePhase" AS ENUM (
    'ACUMULACION',
    'TRANSMUTACION',
    'REALIZACION',
    'TRANSICION'
);

--
-- Name: MovementCause; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MovementCause" AS ENUM (
    'APERTURA',
    'NACIMIENTO',
    'COMPRA',
    'RETORNO',
    'TRASLADO_PROVISIONAL',
    'VENTA',
    'SACRIFICIO',
    'MUERTE'
);

--
-- Name: PlanStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlanStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED',
    'COMPLETED'
);

--
-- Name: ReproductiveStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReproductiveStatus" AS ENUM (
    'NA',
    'CICLANDO',
    'GESTANTE',
    'LACTANDO',
    'SEMENTAL_EN_MONTA',
    'SEMENTAL_REPOSO'
);

--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'OWNER',
    'MANAGER',
    'GROOM',
    'VET_EXTERNAL',
    'OWNER_EXTERNAL'
);

--
-- Name: Sex; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Sex" AS ENUM (
    'MALE',
    'FEMALE',
    'GELDING'
);

--
-- Name: SweatLoss; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SweatLoss" AS ENUM (
    'BAJA',
    'MEDIA',
    'ALTA'
);

--
-- Name: VerifactuMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VerifactuMode" AS ENUM (
    'VERIFACTU',
    'NO_VERIFACTU'
);

--
-- Name: WeightMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WeightMethod" AS ENUM (
    'BASCULA',
    'CINTA',
    'MEDIDAS'
);

--
-- Name: WorkType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkType" AS ENUM (
    'DESCANSO',
    'RECUPERACION_ACTIVA',
    'PISTA_TECNICA',
    'PISTA_ALTA_INTENSIDAD',
    'CAMPO_FONDO',
    'GIMNASIA_SALTO',
    'COMPETICION'
);

--
-- Name: relincho_invoice_inalterable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.relincho_invoice_inalterable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status <> 'DRAFT' AND (
       NEW.number IS DISTINCT FROM OLD.number
    OR NEW.series IS DISTINCT FROM OLD.series
    OR NEW."issueDate" IS DISTINCT FROM OLD."issueDate"
    OR NEW."clientId" IS DISTINCT FROM OLD."clientId"
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW."vatTotal" IS DISTINCT FROM OLD."vatTotal"
    OR NEW.total IS DISTINCT FROM OLD.total
    OR NEW."invoiceType" IS DISTINCT FROM OLD."invoiceType"
    OR NEW."rectifiesId" IS DISTINCT FROM OLD."rectifiesId"
    OR NEW."verifactuHash" IS DISTINCT FROM OLD."verifactuHash"
  ) THEN
    RAISE EXCEPTION 'Factura emitida: sus datos fiscales no se pueden modificar (emite una rectificativa)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: relincho_invoice_line_inalterable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.relincho_invoice_line_inalterable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  inv_status text;
BEGIN
  SELECT status INTO inv_status FROM "Invoice"
    WHERE id = COALESCE(NEW."invoiceId", OLD."invoiceId");
  -- Sin factura (se esta borrando en cascada): no hay nada que proteger.
  IF inv_status IS NOT NULL AND inv_status <> 'DRAFT' AND TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'Factura emitida: sus lineas no se pueden modificar'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

--
-- Name: relincho_verifactu_inalterable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.relincho_verifactu_inalterable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.hash IS DISTINCT FROM OLD.hash
    OR NEW."prevHash" IS DISTINCT FROM OLD."prevHash"
    OR NEW."generatedAt" IS DISTINCT FROM OLD."generatedAt"
    OR NEW.payload IS DISTINCT FROM OLD.payload
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
  THEN
    RAISE EXCEPTION 'Registro Veri*Factu: solo cambia su estado de envio'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);

--
-- Name: BoardingContract; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BoardingContract" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "clientId" text NOT NULL,
    "horseId" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "monthlyFee" numeric(10,2) NOT NULL,
    "vatRate" numeric(5,2) DEFAULT 21 NOT NULL,
    includes text[],
    active boolean DEFAULT true NOT NULL
);

--
-- Name: BoardingContractExtra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BoardingContractExtra" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "boardingContractId" text NOT NULL,
    concept text NOT NULL,
    amount numeric(10,2) NOT NULL,
    "vatRate" numeric(5,2) DEFAULT 21 NOT NULL,
    recurring boolean DEFAULT true NOT NULL,
    "oneOffApplied" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: BodyMeasurement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BodyMeasurement" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    date date NOT NULL,
    method public."WeightMethod",
    "weightKg" numeric(6,1),
    "girthCm" numeric(5,1),
    "lengthCm" numeric(5,1),
    "bodyCondition" numeric(3,1),
    notes text,
    "recordedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: ChipTag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChipTag" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    "chipId" text NOT NULL,
    kind text DEFAULT 'NFC'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "pairedById" text,
    "pairedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: CompetitionTarget; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompetitionTarget" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    name text NOT NULL,
    "targetDate" timestamp(3) without time zone NOT NULL,
    priority text,
    notes text
);

--
-- Name: Contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Contact" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    nif text,
    email text,
    phone text,
    address text
);

--
-- Name: Covering; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Covering" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cycleId" text NOT NULL,
    "mareId" text NOT NULL,
    "stallionId" text,
    method public."CoveringMethod" NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    result text,
    "ancceServiceRequestId" text,
    notes text,
    "dosesUsed" integer,
    "externalStallionName" text,
    "semenBatchId" text
);

--
-- Name: DailyJournal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DailyJournal" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    content text NOT NULL,
    "aiAnalysis" text
);

--
-- Name: DailyLoad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DailyLoad" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "microcycleId" text NOT NULL,
    "horseId" text NOT NULL,
    date date NOT NULL,
    "workType" public."WorkType" NOT NULL,
    "rpeTarget" integer NOT NULL,
    "durationMinutes" integer NOT NULL,
    "plannedLoadUa" integer NOT NULL,
    "impactSurfaceMinutes" integer DEFAULT 0 NOT NULL,
    status public."DayStatus" DEFAULT 'PLANNED'::public."DayStatus" NOT NULL,
    "actualRpe" integer,
    "actualMinutes" integer,
    "actualLoadUa" integer,
    "fatigueZone" public."FatigueZone",
    "adjustmentReason" text,
    "trainingSessionId" text
);

--
-- Name: Document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text,
    kind text NOT NULL,
    name text NOT NULL,
    "fileUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "storageKey" text,
    "mimeType" text,
    "sizeBytes" integer,
    "uploadedById" text,
    "expiresAt" timestamp(3) without time zone,
    "deletedAt" timestamp(3) without time zone
);

--
-- Name: Event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Event" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone,
    location text,
    notes text,
    "horseId" text
);

--
-- Name: FarmBookSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FarmBookSettings" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "farmName" text,
    "farmAddress" text,
    "farmMunicipality" text,
    "farmProvince" text,
    latitude numeric(9,6),
    longitude numeric(9,6),
    "holderPhone" text,
    "holderEmail" text,
    "legalRepName" text,
    "legalRepNif" text,
    adsg text,
    classification text,
    capacity integer,
    "surfaceHa" numeric(8,2),
    "installationsM2" numeric(10,2),
    "sanitaryQualification" text,
    "openedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: FarmCaretaker; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FarmCaretaker" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    "documentId" text,
    role text,
    phone text,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: FarmInspection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FarmInspection" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    reason text NOT NULL,
    "actNumber" text,
    "officialName" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: FeedingLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeedingLog" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "mealType" text NOT NULL,
    status text NOT NULL
);

--
-- Name: FeedingPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeedingPlan" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    items jsonb NOT NULL,
    "startDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Foaling; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Foaling" (
    id text NOT NULL,
    "coveringId" text NOT NULL,
    "foalId" text,
    date timestamp(3) without time zone NOT NULL,
    sex public."Sex",
    alive boolean DEFAULT true NOT NULL,
    notes text,
    "tenantId" text NOT NULL,
    "birthWeightKg" numeric(5,1),
    complications text[] DEFAULT ARRAY[]::text[],
    "foalIggMgDl" integer,
    "foalStoodMinutes" integer,
    "foalSuckledMinutes" integer,
    "meconiumPassed" boolean,
    "placentaMinutes" integer
);

--
-- Name: FoalingWatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoalingWatch" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "coveringId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "udderScore" integer,
    wax boolean DEFAULT false NOT NULL,
    "milkCalciumPpm" integer,
    relaxation boolean DEFAULT false NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: HealthEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HealthEvent" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    type public."HealthEventType" NOT NULL,
    name text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "nextDueDate" timestamp(3) without time zone,
    dose text,
    "vetContactId" text,
    cost numeric(10,2),
    notes text,
    "attachmentUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "prescriptionNumber" text,
    "withdrawalDays" integer,
    "durationDays" integer,
    supplier text,
    "purchaseReference" text,
    "batchNumber" text
);

--
-- Name: Horse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Horse" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    "uelnCode" text,
    microchip text,
    sex public."Sex" NOT NULL,
    coat text,
    breed text,
    "birthDate" timestamp(3) without time zone,
    hierro text,
    status public."HorseStatus" DEFAULT 'ACTIVE'::public."HorseStatus" NOT NULL,
    "boxLocation" text,
    "photoUrl" text,
    "sireId" text,
    "damId" text,
    "currentOwnerId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "breederId" text,
    "lgNumber" text,
    "excludedFromFoodChain" boolean DEFAULT false NOT NULL,
    species public."EquineSpecies" DEFAULT 'CABALLAR'::public."EquineSpecies" NOT NULL
);

--
-- Name: HorseAccess; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HorseAccess" (
    id text NOT NULL,
    "horseId" text NOT NULL,
    "membershipId" text NOT NULL
);

--
-- Name: IdentificationIncident; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IdentificationIncident" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "previousId" text,
    "newId" text,
    cause text NOT NULL,
    duplicate boolean DEFAULT false NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    series text NOT NULL,
    number integer,
    "issueDate" timestamp(3) without time zone NOT NULL,
    "clientId" text NOT NULL,
    "boardingContractId" text,
    subtotal numeric(12,2) NOT NULL,
    "vatTotal" numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    "verifactuMode" public."VerifactuMode" DEFAULT 'NO_VERIFACTU'::public."VerifactuMode" NOT NULL,
    "verifactuHash" text,
    "verifactuPrevHash" text,
    "verifactuQrUrl" text,
    "verifactuSentAt" timestamp(3) without time zone,
    "pdfUrl" text,
    "dueDate" timestamp(3) without time zone,
    "seriesId" text,
    "invoiceType" text DEFAULT 'F1'::text NOT NULL,
    "periodMonth" text,
    "rectificationKind" text,
    "rectificationReason" text,
    "rectifiesId" text,
    "emailedAt" timestamp(3) without time zone
);

--
-- Name: InvoiceLine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InvoiceLine" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "horseId" text,
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    "vatRate" numeric(5,2) NOT NULL,
    "exemptionCause" text
);

--
-- Name: InvoiceSeries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InvoiceSeries" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    code text NOT NULL,
    prefix text NOT NULL,
    year integer NOT NULL,
    "nextNumber" integer DEFAULT 1 NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isRectifying" boolean DEFAULT false NOT NULL
);

--
-- Name: LimbCheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LimbCheck" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    date date NOT NULL,
    "heatLegs" text[] DEFAULT ARRAY[]::text[],
    "swellingLegs" text[] DEFAULT ARRAY[]::text[],
    "painLegs" text[] DEFAULT ARRAY[]::text[],
    lameness public."Lameness" DEFAULT 'NO'::public."Lameness" NOT NULL,
    notes text,
    "checkedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: Macrocycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Macrocycle" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    name text NOT NULL,
    discipline public."Discipline",
    "startDate" timestamp(3) without time zone NOT NULL,
    "targetDate" timestamp(3) without time zone NOT NULL,
    "competitionTargetId" text,
    status public."PlanStatus" DEFAULT 'ACTIVE'::public."PlanStatus" NOT NULL,
    "recoveryBufferPct" integer DEFAULT 15 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: MareReproProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MareReproProfile" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    "cycleLengthDays" integer,
    "estrusLengthDays" integer,
    "gestationDays" integer,
    "preovulatoryFollicleMm" integer,
    conditions text[] DEFAULT ARRAY[]::text[],
    notes text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: Membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Membership" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    role public."Role" NOT NULL
);

--
-- Name: Mesocycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Mesocycle" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "macrocycleId" text NOT NULL,
    phase public."MesocyclePhase" NOT NULL,
    "orderIndex" integer NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    weeks integer NOT NULL,
    "volumeIndex" double precision NOT NULL,
    "intensityIndex" double precision NOT NULL
);

--
-- Name: Microcycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Microcycle" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "mesocycleId" text NOT NULL,
    "weekNumber" integer NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "plannedLoadUa" integer NOT NULL,
    "actualLoadUa" integer DEFAULT 0 NOT NULL,
    "mandatoryRestDays" integer DEFAULT 2 NOT NULL,
    "bufferStatus" text DEFAULT 'idle'::text NOT NULL
);

--
-- Name: Movement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Movement" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    direction text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "originRega" text,
    "destinationRega" text,
    reason text,
    cause public."MovementCause",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "disposalMethod" text,
    "disposalPlace" text,
    "documentNumber" text,
    "documentType" text,
    "expectedReturnDate" timestamp(3) without time zone,
    "notifiedAt" timestamp(3) without time zone,
    "trailerPlate" text,
    "transporterId" text,
    "transporterName" text,
    "vehiclePlate" text
);

--
-- Name: NutritionBaseline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NutritionBaseline" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    "baseForageKg" numeric(5,2) NOT NULL,
    "baseConcentrateKg" numeric(5,2) NOT NULL,
    "proteinPercentTarget" integer DEFAULT 12 NOT NULL,
    "mealsPerDay" integer DEFAULT 3 NOT NULL,
    "minForagePctBodyweight" numeric(4,2) DEFAULT 1.5 NOT NULL,
    "maxConcentrateKgPerDay" numeric(5,2) NOT NULL,
    "maxConcentrateKgPerMeal" numeric(4,2) DEFAULT 2 NOT NULL,
    "maxElectrolytesGrams" integer DEFAULT 90 NOT NULL,
    "maxVitaminEIu" integer DEFAULT 5000 NOT NULL,
    supplements jsonb,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: NutritionPrescription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NutritionPrescription" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    date date NOT NULL,
    "internalLoadUa" integer DEFAULT 0 NOT NULL,
    "fatigueZone" public."FatigueZone" DEFAULT 'BAJA'::public."FatigueZone" NOT NULL,
    "mesocyclePhase" public."MesocyclePhase",
    "forageKg" numeric(5,2) NOT NULL,
    "concentrateKg" numeric(5,2) NOT NULL,
    "extraConcentrateGrams" integer DEFAULT 0 NOT NULL,
    "proteinPercentTarget" integer NOT NULL,
    "electrolytesGrams" integer DEFAULT 0 NOT NULL,
    "vitaminEIu" integer DEFAULT 0 NOT NULL,
    "seleniumMg" numeric(4,2),
    bcaa boolean DEFAULT false NOT NULL,
    "totalMeals" integer NOT NULL,
    "instructionsForStaff" text NOT NULL,
    "clampNotes" text[] DEFAULT ARRAY[]::text[],
    "ambientTempC" double precision,
    "computedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isProjection" boolean DEFAULT false NOT NULL,
    "workType" public."WorkType"
);

--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    method text NOT NULL,
    reference text
);

--
-- Name: PregnancyCheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PregnancyCheck" (
    id text NOT NULL,
    "coveringId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    result text NOT NULL,
    "dayOfPregnancy" integer,
    heartbeat boolean,
    notes text,
    "tenantId" text NOT NULL,
    "vesicleMm" integer
);

--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    sku text,
    name text NOT NULL,
    kind text NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    stock numeric(10,2),
    cost numeric(10,2)
);

--
-- Name: ReproExam; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReproExam" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cycleId" text NOT NULL,
    "mareId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "teasingScore" integer,
    "leftFollicleMm" integer,
    "rightFollicleMm" integer,
    "corpusLuteum" text,
    "uterineEdema" integer,
    "uterineFluidMm" integer,
    cervix text,
    ovulated boolean DEFAULT false NOT NULL,
    "ovulationSide" text,
    treatments text[] DEFAULT ARRAY[]::text[],
    notes text,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: ReproSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReproSettings" (
    "tenantId" text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: ReproductionCycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReproductionCycle" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "mareId" text NOT NULL,
    season integer NOT NULL,
    notes text,
    category text
);

--
-- Name: SemenBatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SemenBatch" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "stallionId" text,
    "externalStallionName" text,
    "semenType" text NOT NULL,
    provider text,
    "dosesTotal" integer NOT NULL,
    "collectedAt" timestamp(3) without time zone,
    location text,
    "costPerDose" numeric(10,2),
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);

--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text,
    "assigneeMembershipId" text,
    title text NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "doneAt" timestamp(3) without time zone,
    notes text,
    "sourceKey" text
);

--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    "fiscalName" text,
    nif text,
    address text,
    city text,
    province text,
    "postalCode" text,
    country text DEFAULT 'ES'::text NOT NULL,
    "regaCode" text,
    plan text DEFAULT 'cuaderno'::text NOT NULL,
    "stripeCustomerId" text,
    "stripePriceId" text,
    "verifactuMode" public."VerifactuMode" DEFAULT 'NO_VERIFACTU'::public."VerifactuMode" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "stripeStatus" text,
    "stripeCurrentPeriodEnd" timestamp(3) without time zone,
    "acquisitionSource" text,
    "acquisitionReferrer" text,
    "extraHorseBlocks" integer DEFAULT 0 NOT NULL,
    "billingModule" boolean DEFAULT false NOT NULL,
    founder boolean DEFAULT false NOT NULL,
    iban text,
    "paymentTerms" text,
    "trialEndsAt" timestamp(3) without time zone
);

--
-- Name: TrainingSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TrainingSession" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "riderName" text,
    minutes integer NOT NULL,
    type text,
    notes text,
    "fatigueZone" public."FatigueZone",
    "internalLoadUa" integer,
    rpe integer,
    "sweatLoss" public."SweatLoss",
    "heartRateBpm" integer
);

--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    image text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "emailVerified" timestamp(3) without time zone
);

--
-- Name: VerifactuRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerifactuRecord" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "invoiceId" text NOT NULL,
    kind text NOT NULL,
    hash text NOT NULL,
    "prevHash" text,
    "generatedAt" text NOT NULL,
    payload text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "sentAt" timestamp(3) without time zone,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);

--
-- Name: VeterinaryProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VeterinaryProfile" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "horseId" text NOT NULL,
    discipline public."Discipline",
    "baseWeightKg" numeric(6,2),
    "reproductiveStatus" public."ReproductiveStatus" DEFAULT 'NA'::public."ReproductiveStatus" NOT NULL,
    "gestationMonth" integer,
    "tendonHistoryAlert" boolean DEFAULT false NOT NULL,
    "maxImpactSurfaceMinutes" integer,
    "maxRpe" integer,
    restrictions text[] DEFAULT ARRAY[]::text[],
    notes text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: WeatherForecast; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WeatherForecast" (
    id text NOT NULL,
    "locationKey" text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    "timeZone" text NOT NULL,
    points jsonb NOT NULL,
    "lastModified" text,
    "fetchedAt" timestamp(3) without time zone NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);

--
-- Name: BoardingContractExtra BoardingContractExtra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardingContractExtra"
    ADD CONSTRAINT "BoardingContractExtra_pkey" PRIMARY KEY (id);

--
-- Name: BoardingContract BoardingContract_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardingContract"
    ADD CONSTRAINT "BoardingContract_pkey" PRIMARY KEY (id);

--
-- Name: BodyMeasurement BodyMeasurement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BodyMeasurement"
    ADD CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY (id);

--
-- Name: ChipTag ChipTag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChipTag"
    ADD CONSTRAINT "ChipTag_pkey" PRIMARY KEY (id);

--
-- Name: CompetitionTarget CompetitionTarget_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionTarget"
    ADD CONSTRAINT "CompetitionTarget_pkey" PRIMARY KEY (id);

--
-- Name: Contact Contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_pkey" PRIMARY KEY (id);

--
-- Name: Covering Covering_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Covering"
    ADD CONSTRAINT "Covering_pkey" PRIMARY KEY (id);

--
-- Name: DailyJournal DailyJournal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyJournal"
    ADD CONSTRAINT "DailyJournal_pkey" PRIMARY KEY (id);

--
-- Name: DailyLoad DailyLoad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyLoad"
    ADD CONSTRAINT "DailyLoad_pkey" PRIMARY KEY (id);

--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);

--
-- Name: Event Event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_pkey" PRIMARY KEY (id);

--
-- Name: FarmBookSettings FarmBookSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmBookSettings"
    ADD CONSTRAINT "FarmBookSettings_pkey" PRIMARY KEY (id);

--
-- Name: FarmCaretaker FarmCaretaker_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmCaretaker"
    ADD CONSTRAINT "FarmCaretaker_pkey" PRIMARY KEY (id);

--
-- Name: FarmInspection FarmInspection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmInspection"
    ADD CONSTRAINT "FarmInspection_pkey" PRIMARY KEY (id);

--
-- Name: FeedingLog FeedingLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingLog"
    ADD CONSTRAINT "FeedingLog_pkey" PRIMARY KEY (id);

--
-- Name: FeedingPlan FeedingPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingPlan"
    ADD CONSTRAINT "FeedingPlan_pkey" PRIMARY KEY (id);

--
-- Name: FoalingWatch FoalingWatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingWatch"
    ADD CONSTRAINT "FoalingWatch_pkey" PRIMARY KEY (id);

--
-- Name: Foaling Foaling_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Foaling"
    ADD CONSTRAINT "Foaling_pkey" PRIMARY KEY (id);

--
-- Name: HealthEvent HealthEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HealthEvent"
    ADD CONSTRAINT "HealthEvent_pkey" PRIMARY KEY (id);

--
-- Name: HorseAccess HorseAccess_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HorseAccess"
    ADD CONSTRAINT "HorseAccess_pkey" PRIMARY KEY (id);

--
-- Name: Horse Horse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Horse"
    ADD CONSTRAINT "Horse_pkey" PRIMARY KEY (id);

--
-- Name: IdentificationIncident IdentificationIncident_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdentificationIncident"
    ADD CONSTRAINT "IdentificationIncident_pkey" PRIMARY KEY (id);

--
-- Name: InvoiceLine InvoiceLine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY (id);

--
-- Name: InvoiceSeries InvoiceSeries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceSeries"
    ADD CONSTRAINT "InvoiceSeries_pkey" PRIMARY KEY (id);

--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);

--
-- Name: LimbCheck LimbCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LimbCheck"
    ADD CONSTRAINT "LimbCheck_pkey" PRIMARY KEY (id);

--
-- Name: Macrocycle Macrocycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Macrocycle"
    ADD CONSTRAINT "Macrocycle_pkey" PRIMARY KEY (id);

--
-- Name: MareReproProfile MareReproProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MareReproProfile"
    ADD CONSTRAINT "MareReproProfile_pkey" PRIMARY KEY (id);

--
-- Name: Membership Membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_pkey" PRIMARY KEY (id);

--
-- Name: Mesocycle Mesocycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Mesocycle"
    ADD CONSTRAINT "Mesocycle_pkey" PRIMARY KEY (id);

--
-- Name: Microcycle Microcycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Microcycle"
    ADD CONSTRAINT "Microcycle_pkey" PRIMARY KEY (id);

--
-- Name: Movement Movement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movement"
    ADD CONSTRAINT "Movement_pkey" PRIMARY KEY (id);

--
-- Name: NutritionBaseline NutritionBaseline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NutritionBaseline"
    ADD CONSTRAINT "NutritionBaseline_pkey" PRIMARY KEY (id);

--
-- Name: NutritionPrescription NutritionPrescription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NutritionPrescription"
    ADD CONSTRAINT "NutritionPrescription_pkey" PRIMARY KEY (id);

--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);

--
-- Name: PregnancyCheck PregnancyCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PregnancyCheck"
    ADD CONSTRAINT "PregnancyCheck_pkey" PRIMARY KEY (id);

--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);

--
-- Name: ReproExam ReproExam_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproExam"
    ADD CONSTRAINT "ReproExam_pkey" PRIMARY KEY (id);

--
-- Name: ReproSettings ReproSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproSettings"
    ADD CONSTRAINT "ReproSettings_pkey" PRIMARY KEY ("tenantId");

--
-- Name: ReproductionCycle ReproductionCycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproductionCycle"
    ADD CONSTRAINT "ReproductionCycle_pkey" PRIMARY KEY (id);

--
-- Name: SemenBatch SemenBatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenBatch"
    ADD CONSTRAINT "SemenBatch_pkey" PRIMARY KEY (id);

--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);

--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);

--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);

--
-- Name: TrainingSession TrainingSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrainingSession"
    ADD CONSTRAINT "TrainingSession_pkey" PRIMARY KEY (id);

--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);

--
-- Name: VerifactuRecord VerifactuRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerifactuRecord"
    ADD CONSTRAINT "VerifactuRecord_pkey" PRIMARY KEY (id);

--
-- Name: VeterinaryProfile VeterinaryProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VeterinaryProfile"
    ADD CONSTRAINT "VeterinaryProfile_pkey" PRIMARY KEY (id);

--
-- Name: WeatherForecast WeatherForecast_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WeatherForecast"
    ADD CONSTRAINT "WeatherForecast_pkey" PRIMARY KEY (id);

--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");

--
-- Name: BoardingContractExtra_tenantId_boardingContractId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BoardingContractExtra_tenantId_boardingContractId_idx" ON public."BoardingContractExtra" USING btree ("tenantId", "boardingContractId");

--
-- Name: BoardingContract_horseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BoardingContract_horseId_key" ON public."BoardingContract" USING btree ("horseId");

--
-- Name: BoardingContract_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BoardingContract_tenantId_idx" ON public."BoardingContract" USING btree ("tenantId");

--
-- Name: BodyMeasurement_horseId_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BodyMeasurement_horseId_date_key" ON public."BodyMeasurement" USING btree ("horseId", date);

--
-- Name: BodyMeasurement_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BodyMeasurement_tenantId_date_idx" ON public."BodyMeasurement" USING btree ("tenantId", date);

--
-- Name: ChipTag_chipId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ChipTag_chipId_key" ON public."ChipTag" USING btree ("chipId");

--
-- Name: ChipTag_tenantId_horseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChipTag_tenantId_horseId_idx" ON public."ChipTag" USING btree ("tenantId", "horseId");

--
-- Name: CompetitionTarget_tenantId_horseId_targetDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompetitionTarget_tenantId_horseId_targetDate_idx" ON public."CompetitionTarget" USING btree ("tenantId", "horseId", "targetDate");

--
-- Name: Contact_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_tenantId_idx" ON public."Contact" USING btree ("tenantId");

--
-- Name: Covering_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Covering_tenantId_idx" ON public."Covering" USING btree ("tenantId");

--
-- Name: DailyJournal_tenantId_horseId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DailyJournal_tenantId_horseId_date_idx" ON public."DailyJournal" USING btree ("tenantId", "horseId", date);

--
-- Name: DailyLoad_microcycleId_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DailyLoad_microcycleId_date_key" ON public."DailyLoad" USING btree ("microcycleId", date);

--
-- Name: DailyLoad_tenantId_horseId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DailyLoad_tenantId_horseId_date_idx" ON public."DailyLoad" USING btree ("tenantId", "horseId", date);

--
-- Name: DailyLoad_trainingSessionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DailyLoad_trainingSessionId_key" ON public."DailyLoad" USING btree ("trainingSessionId");

--
-- Name: Document_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_tenantId_deletedAt_idx" ON public."Document" USING btree ("tenantId", "deletedAt");

--
-- Name: Document_tenantId_horseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_tenantId_horseId_idx" ON public."Document" USING btree ("tenantId", "horseId");

--
-- Name: Event_tenantId_startsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Event_tenantId_startsAt_idx" ON public."Event" USING btree ("tenantId", "startsAt");

--
-- Name: FarmBookSettings_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FarmBookSettings_tenantId_key" ON public."FarmBookSettings" USING btree ("tenantId");

--
-- Name: FarmCaretaker_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FarmCaretaker_tenantId_idx" ON public."FarmCaretaker" USING btree ("tenantId");

--
-- Name: FarmInspection_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FarmInspection_tenantId_date_idx" ON public."FarmInspection" USING btree ("tenantId", date);

--
-- Name: FeedingLog_horseId_date_mealType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FeedingLog_horseId_date_mealType_key" ON public."FeedingLog" USING btree ("horseId", date, "mealType");

--
-- Name: FeedingLog_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingLog_tenantId_date_idx" ON public."FeedingLog" USING btree ("tenantId", date);

--
-- Name: FeedingPlan_horseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FeedingPlan_horseId_key" ON public."FeedingPlan" USING btree ("horseId");

--
-- Name: FoalingWatch_tenantId_coveringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoalingWatch_tenantId_coveringId_idx" ON public."FoalingWatch" USING btree ("tenantId", "coveringId");

--
-- Name: Foaling_coveringId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Foaling_coveringId_key" ON public."Foaling" USING btree ("coveringId");

--
-- Name: Foaling_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Foaling_tenantId_idx" ON public."Foaling" USING btree ("tenantId");

--
-- Name: HealthEvent_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HealthEvent_tenantId_date_idx" ON public."HealthEvent" USING btree ("tenantId", date);

--
-- Name: HealthEvent_tenantId_horseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HealthEvent_tenantId_horseId_idx" ON public."HealthEvent" USING btree ("tenantId", "horseId");

--
-- Name: HealthEvent_tenantId_nextDueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HealthEvent_tenantId_nextDueDate_idx" ON public."HealthEvent" USING btree ("tenantId", "nextDueDate");

--
-- Name: HorseAccess_horseId_membershipId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "HorseAccess_horseId_membershipId_key" ON public."HorseAccess" USING btree ("horseId", "membershipId");

--
-- Name: Horse_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Horse_tenantId_idx" ON public."Horse" USING btree ("tenantId");

--
-- Name: Horse_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Horse_tenantId_status_idx" ON public."Horse" USING btree ("tenantId", status);

--
-- Name: IdentificationIncident_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IdentificationIncident_tenantId_date_idx" ON public."IdentificationIncident" USING btree ("tenantId", date);

--
-- Name: InvoiceSeries_tenantId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InvoiceSeries_tenantId_code_key" ON public."InvoiceSeries" USING btree ("tenantId", code);

--
-- Name: InvoiceSeries_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceSeries_tenantId_idx" ON public."InvoiceSeries" USING btree ("tenantId");

--
-- Name: Invoice_boardingContractId_periodMonth_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_boardingContractId_periodMonth_key" ON public."Invoice" USING btree ("boardingContractId", "periodMonth");

--
-- Name: Invoice_tenantId_issueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_issueDate_idx" ON public."Invoice" USING btree ("tenantId", "issueDate");

--
-- Name: Invoice_tenantId_series_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_tenantId_series_number_key" ON public."Invoice" USING btree ("tenantId", series, number);

--
-- Name: LimbCheck_horseId_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LimbCheck_horseId_date_key" ON public."LimbCheck" USING btree ("horseId", date);

--
-- Name: LimbCheck_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LimbCheck_tenantId_date_idx" ON public."LimbCheck" USING btree ("tenantId", date);

--
-- Name: Macrocycle_tenantId_horseId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Macrocycle_tenantId_horseId_status_idx" ON public."Macrocycle" USING btree ("tenantId", "horseId", status);

--
-- Name: MareReproProfile_horseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MareReproProfile_horseId_key" ON public."MareReproProfile" USING btree ("horseId");

--
-- Name: MareReproProfile_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MareReproProfile_tenantId_idx" ON public."MareReproProfile" USING btree ("tenantId");

--
-- Name: Membership_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Membership_tenantId_idx" ON public."Membership" USING btree ("tenantId");

--
-- Name: Membership_userId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON public."Membership" USING btree ("userId", "tenantId");

--
-- Name: Mesocycle_macrocycleId_orderIndex_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Mesocycle_macrocycleId_orderIndex_key" ON public."Mesocycle" USING btree ("macrocycleId", "orderIndex");

--
-- Name: Mesocycle_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Mesocycle_tenantId_idx" ON public."Mesocycle" USING btree ("tenantId");

--
-- Name: Microcycle_mesocycleId_weekNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Microcycle_mesocycleId_weekNumber_key" ON public."Microcycle" USING btree ("mesocycleId", "weekNumber");

--
-- Name: Microcycle_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Microcycle_tenantId_idx" ON public."Microcycle" USING btree ("tenantId");

--
-- Name: Movement_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Movement_tenantId_date_idx" ON public."Movement" USING btree ("tenantId", date);

--
-- Name: Movement_tenantId_horseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Movement_tenantId_horseId_idx" ON public."Movement" USING btree ("tenantId", "horseId");

--
-- Name: NutritionBaseline_horseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NutritionBaseline_horseId_key" ON public."NutritionBaseline" USING btree ("horseId");

--
-- Name: NutritionBaseline_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NutritionBaseline_tenantId_idx" ON public."NutritionBaseline" USING btree ("tenantId");

--
-- Name: NutritionPrescription_horseId_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NutritionPrescription_horseId_date_key" ON public."NutritionPrescription" USING btree ("horseId", date);

--
-- Name: NutritionPrescription_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NutritionPrescription_tenantId_date_idx" ON public."NutritionPrescription" USING btree ("tenantId", date);

--
-- Name: PregnancyCheck_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PregnancyCheck_tenantId_idx" ON public."PregnancyCheck" USING btree ("tenantId");

--
-- Name: Product_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_tenantId_idx" ON public."Product" USING btree ("tenantId");

--
-- Name: ReproExam_cycleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReproExam_cycleId_idx" ON public."ReproExam" USING btree ("cycleId");

--
-- Name: ReproExam_tenantId_mareId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReproExam_tenantId_mareId_date_idx" ON public."ReproExam" USING btree ("tenantId", "mareId", date);

--
-- Name: ReproductionCycle_tenantId_mareId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReproductionCycle_tenantId_mareId_idx" ON public."ReproductionCycle" USING btree ("tenantId", "mareId");

--
-- Name: SemenBatch_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SemenBatch_tenantId_idx" ON public."SemenBatch" USING btree ("tenantId");

--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");

--
-- Name: Task_tenantId_dueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_tenantId_dueDate_idx" ON public."Task" USING btree ("tenantId", "dueDate");

--
-- Name: Task_tenantId_sourceKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Task_tenantId_sourceKey_key" ON public."Task" USING btree ("tenantId", "sourceKey");

--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);

--
-- Name: TrainingSession_tenantId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TrainingSession_tenantId_date_idx" ON public."TrainingSession" USING btree ("tenantId", date);

--
-- Name: TrainingSession_tenantId_horseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TrainingSession_tenantId_horseId_idx" ON public."TrainingSession" USING btree ("tenantId", "horseId");

--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);

--
-- Name: VerifactuRecord_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerifactuRecord_tenantId_createdAt_idx" ON public."VerifactuRecord" USING btree ("tenantId", "createdAt");

--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);

--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);

--
-- Name: VeterinaryProfile_horseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VeterinaryProfile_horseId_key" ON public."VeterinaryProfile" USING btree ("horseId");

--
-- Name: VeterinaryProfile_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VeterinaryProfile_tenantId_idx" ON public."VeterinaryProfile" USING btree ("tenantId");

--
-- Name: WeatherForecast_locationKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WeatherForecast_locationKey_key" ON public."WeatherForecast" USING btree ("locationKey");

--
-- Name: Invoice invoice_inalterable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_inalterable BEFORE UPDATE ON public."Invoice" FOR EACH ROW EXECUTE FUNCTION public.relincho_invoice_inalterable();

--
-- Name: InvoiceLine invoice_line_inalterable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_line_inalterable BEFORE INSERT OR UPDATE ON public."InvoiceLine" FOR EACH ROW EXECUTE FUNCTION public.relincho_invoice_line_inalterable();

--
-- Name: VerifactuRecord verifactu_inalterable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER verifactu_inalterable BEFORE UPDATE ON public."VerifactuRecord" FOR EACH ROW EXECUTE FUNCTION public.relincho_verifactu_inalterable();

--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: BoardingContractExtra BoardingContractExtra_boardingContractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardingContractExtra"
    ADD CONSTRAINT "BoardingContractExtra_boardingContractId_fkey" FOREIGN KEY ("boardingContractId") REFERENCES public."BoardingContract"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: BoardingContract BoardingContract_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardingContract"
    ADD CONSTRAINT "BoardingContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: BoardingContract BoardingContract_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardingContract"
    ADD CONSTRAINT "BoardingContract_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: BoardingContract BoardingContract_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BoardingContract"
    ADD CONSTRAINT "BoardingContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: BodyMeasurement BodyMeasurement_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BodyMeasurement"
    ADD CONSTRAINT "BodyMeasurement_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: ChipTag ChipTag_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChipTag"
    ADD CONSTRAINT "ChipTag_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: CompetitionTarget CompetitionTarget_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionTarget"
    ADD CONSTRAINT "CompetitionTarget_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Contact Contact_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Covering Covering_cycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Covering"
    ADD CONSTRAINT "Covering_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES public."ReproductionCycle"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Covering Covering_mareId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Covering"
    ADD CONSTRAINT "Covering_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: Covering Covering_semenBatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Covering"
    ADD CONSTRAINT "Covering_semenBatchId_fkey" FOREIGN KEY ("semenBatchId") REFERENCES public."SemenBatch"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Covering Covering_stallionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Covering"
    ADD CONSTRAINT "Covering_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: DailyJournal DailyJournal_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyJournal"
    ADD CONSTRAINT "DailyJournal_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: DailyLoad DailyLoad_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyLoad"
    ADD CONSTRAINT "DailyLoad_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: DailyLoad DailyLoad_microcycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyLoad"
    ADD CONSTRAINT "DailyLoad_microcycleId_fkey" FOREIGN KEY ("microcycleId") REFERENCES public."Microcycle"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: DailyLoad DailyLoad_trainingSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyLoad"
    ADD CONSTRAINT "DailyLoad_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES public."TrainingSession"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Document Document_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Document Document_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Document Document_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Event Event_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Event Event_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: FarmBookSettings FarmBookSettings_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmBookSettings"
    ADD CONSTRAINT "FarmBookSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: FarmCaretaker FarmCaretaker_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmCaretaker"
    ADD CONSTRAINT "FarmCaretaker_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: FarmInspection FarmInspection_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmInspection"
    ADD CONSTRAINT "FarmInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: FeedingLog FeedingLog_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingLog"
    ADD CONSTRAINT "FeedingLog_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: FeedingPlan FeedingPlan_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingPlan"
    ADD CONSTRAINT "FeedingPlan_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: FoalingWatch FoalingWatch_coveringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingWatch"
    ADD CONSTRAINT "FoalingWatch_coveringId_fkey" FOREIGN KEY ("coveringId") REFERENCES public."Covering"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Foaling Foaling_coveringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Foaling"
    ADD CONSTRAINT "Foaling_coveringId_fkey" FOREIGN KEY ("coveringId") REFERENCES public."Covering"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: HealthEvent HealthEvent_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HealthEvent"
    ADD CONSTRAINT "HealthEvent_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: HorseAccess HorseAccess_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HorseAccess"
    ADD CONSTRAINT "HorseAccess_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: HorseAccess HorseAccess_membershipId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HorseAccess"
    ADD CONSTRAINT "HorseAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES public."Membership"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Horse Horse_breederId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Horse"
    ADD CONSTRAINT "Horse_breederId_fkey" FOREIGN KEY ("breederId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Horse Horse_currentOwnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Horse"
    ADD CONSTRAINT "Horse_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Horse Horse_damId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Horse"
    ADD CONSTRAINT "Horse_damId_fkey" FOREIGN KEY ("damId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Horse Horse_sireId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Horse"
    ADD CONSTRAINT "Horse_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Horse Horse_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Horse"
    ADD CONSTRAINT "Horse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: IdentificationIncident IdentificationIncident_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdentificationIncident"
    ADD CONSTRAINT "IdentificationIncident_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: InvoiceLine InvoiceLine_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: InvoiceLine InvoiceLine_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: InvoiceSeries InvoiceSeries_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceSeries"
    ADD CONSTRAINT "InvoiceSeries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Invoice Invoice_boardingContractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_boardingContractId_fkey" FOREIGN KEY ("boardingContractId") REFERENCES public."BoardingContract"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Invoice Invoice_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: Invoice Invoice_rectifiesId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_rectifiesId_fkey" FOREIGN KEY ("rectifiesId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: Invoice Invoice_seriesId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES public."InvoiceSeries"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Invoice Invoice_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: LimbCheck LimbCheck_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LimbCheck"
    ADD CONSTRAINT "LimbCheck_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Macrocycle Macrocycle_competitionTargetId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Macrocycle"
    ADD CONSTRAINT "Macrocycle_competitionTargetId_fkey" FOREIGN KEY ("competitionTargetId") REFERENCES public."CompetitionTarget"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Macrocycle Macrocycle_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Macrocycle"
    ADD CONSTRAINT "Macrocycle_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: MareReproProfile MareReproProfile_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MareReproProfile"
    ADD CONSTRAINT "MareReproProfile_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Membership Membership_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Membership Membership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Mesocycle Mesocycle_macrocycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Mesocycle"
    ADD CONSTRAINT "Mesocycle_macrocycleId_fkey" FOREIGN KEY ("macrocycleId") REFERENCES public."Macrocycle"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Microcycle Microcycle_mesocycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Microcycle"
    ADD CONSTRAINT "Microcycle_mesocycleId_fkey" FOREIGN KEY ("mesocycleId") REFERENCES public."Mesocycle"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Movement Movement_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movement"
    ADD CONSTRAINT "Movement_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: NutritionBaseline NutritionBaseline_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NutritionBaseline"
    ADD CONSTRAINT "NutritionBaseline_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: NutritionPrescription NutritionPrescription_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NutritionPrescription"
    ADD CONSTRAINT "NutritionPrescription_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: PregnancyCheck PregnancyCheck_coveringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PregnancyCheck"
    ADD CONSTRAINT "PregnancyCheck_coveringId_fkey" FOREIGN KEY ("coveringId") REFERENCES public."Covering"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Product Product_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: ReproExam ReproExam_cycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproExam"
    ADD CONSTRAINT "ReproExam_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES public."ReproductionCycle"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: ReproExam ReproExam_mareId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproExam"
    ADD CONSTRAINT "ReproExam_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: ReproSettings ReproSettings_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproSettings"
    ADD CONSTRAINT "ReproSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: ReproductionCycle ReproductionCycle_mareId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproductionCycle"
    ADD CONSTRAINT "ReproductionCycle_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: SemenBatch SemenBatch_stallionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenBatch"
    ADD CONSTRAINT "SemenBatch_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Task Task_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: TrainingSession TrainingSession_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrainingSession"
    ADD CONSTRAINT "TrainingSession_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: VerifactuRecord VerifactuRecord_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerifactuRecord"
    ADD CONSTRAINT "VerifactuRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: VerifactuRecord VerifactuRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerifactuRecord"
    ADD CONSTRAINT "VerifactuRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: VeterinaryProfile VeterinaryProfile_horseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VeterinaryProfile"
    ADD CONSTRAINT "VeterinaryProfile_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES public."Horse"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: Account; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY;

--
-- Name: BoardingContract; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BoardingContract" ENABLE ROW LEVEL SECURITY;

--
-- Name: BoardingContractExtra; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BoardingContractExtra" ENABLE ROW LEVEL SECURITY;

--
-- Name: BodyMeasurement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BodyMeasurement" ENABLE ROW LEVEL SECURITY;

--
-- Name: ChipTag; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ChipTag" ENABLE ROW LEVEL SECURITY;

--
-- Name: CompetitionTarget; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CompetitionTarget" ENABLE ROW LEVEL SECURITY;

--
-- Name: Contact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Contact" ENABLE ROW LEVEL SECURITY;

--
-- Name: Covering; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Covering" ENABLE ROW LEVEL SECURITY;

--
-- Name: DailyJournal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."DailyJournal" ENABLE ROW LEVEL SECURITY;

--
-- Name: DailyLoad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."DailyLoad" ENABLE ROW LEVEL SECURITY;

--
-- Name: Document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;

--
-- Name: Event; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Event" ENABLE ROW LEVEL SECURITY;

--
-- Name: FarmBookSettings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."FarmBookSettings" ENABLE ROW LEVEL SECURITY;

--
-- Name: FarmCaretaker; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."FarmCaretaker" ENABLE ROW LEVEL SECURITY;

--
-- Name: FarmInspection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."FarmInspection" ENABLE ROW LEVEL SECURITY;

--
-- Name: FeedingLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."FeedingLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: FeedingPlan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."FeedingPlan" ENABLE ROW LEVEL SECURITY;

--
-- Name: Foaling; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Foaling" ENABLE ROW LEVEL SECURITY;

--
-- Name: FoalingWatch; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."FoalingWatch" ENABLE ROW LEVEL SECURITY;

--
-- Name: HealthEvent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."HealthEvent" ENABLE ROW LEVEL SECURITY;

--
-- Name: Horse; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Horse" ENABLE ROW LEVEL SECURITY;

--
-- Name: HorseAccess; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."HorseAccess" ENABLE ROW LEVEL SECURITY;

--
-- Name: IdentificationIncident; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."IdentificationIncident" ENABLE ROW LEVEL SECURITY;

--
-- Name: Invoice; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Invoice" ENABLE ROW LEVEL SECURITY;

--
-- Name: InvoiceLine; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."InvoiceLine" ENABLE ROW LEVEL SECURITY;

--
-- Name: InvoiceSeries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."InvoiceSeries" ENABLE ROW LEVEL SECURITY;

--
-- Name: LimbCheck; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."LimbCheck" ENABLE ROW LEVEL SECURITY;

--
-- Name: Macrocycle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Macrocycle" ENABLE ROW LEVEL SECURITY;

--
-- Name: MareReproProfile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."MareReproProfile" ENABLE ROW LEVEL SECURITY;

--
-- Name: Membership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Membership" ENABLE ROW LEVEL SECURITY;

--
-- Name: Mesocycle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Mesocycle" ENABLE ROW LEVEL SECURITY;

--
-- Name: Microcycle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Microcycle" ENABLE ROW LEVEL SECURITY;

--
-- Name: Movement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Movement" ENABLE ROW LEVEL SECURITY;

--
-- Name: NutritionBaseline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."NutritionBaseline" ENABLE ROW LEVEL SECURITY;

--
-- Name: NutritionPrescription; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."NutritionPrescription" ENABLE ROW LEVEL SECURITY;

--
-- Name: Payment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;

--
-- Name: PregnancyCheck; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PregnancyCheck" ENABLE ROW LEVEL SECURITY;

--
-- Name: Product; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;

--
-- Name: ReproExam; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ReproExam" ENABLE ROW LEVEL SECURITY;

--
-- Name: ReproSettings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ReproSettings" ENABLE ROW LEVEL SECURITY;

--
-- Name: ReproductionCycle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ReproductionCycle" ENABLE ROW LEVEL SECURITY;

--
-- Name: SemenBatch; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."SemenBatch" ENABLE ROW LEVEL SECURITY;

--
-- Name: Session; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;

--
-- Name: Task; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Task" ENABLE ROW LEVEL SECURITY;

--
-- Name: Tenant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Tenant" ENABLE ROW LEVEL SECURITY;

--
-- Name: TrainingSession; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."TrainingSession" ENABLE ROW LEVEL SECURITY;

--
-- Name: User; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerifactuRecord; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerifactuRecord" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerificationToken; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerificationToken" ENABLE ROW LEVEL SECURITY;

--
-- Name: VeterinaryProfile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VeterinaryProfile" ENABLE ROW LEVEL SECURITY;

--
-- Name: WeatherForecast; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."WeatherForecast" ENABLE ROW LEVEL SECURITY;

--
-- Name: BoardingContractExtra tenant_isolation_boardingcontractextra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_boardingcontractextra ON public."BoardingContractExtra" USING (("tenantId" = current_setting('app.current_tenant'::text, true)));

--
-- Name: InvoiceSeries tenant_isolation_invoiceseries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_invoiceseries ON public."InvoiceSeries" USING (("tenantId" = current_setting('app.current_tenant'::text, true)));

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

--
-- Name: FUNCTION relincho_invoice_inalterable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.relincho_invoice_inalterable() TO service_role;

--
-- Name: FUNCTION relincho_invoice_line_inalterable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.relincho_invoice_line_inalterable() TO service_role;

--
-- Name: FUNCTION relincho_verifactu_inalterable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.relincho_verifactu_inalterable() TO service_role;

--
-- Name: TABLE "Account"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Account" TO service_role;

--
-- Name: TABLE "BoardingContract"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."BoardingContract" TO service_role;

--
-- Name: TABLE "BoardingContractExtra"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."BoardingContractExtra" TO service_role;

--
-- Name: TABLE "BodyMeasurement"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."BodyMeasurement" TO service_role;

--
-- Name: TABLE "ChipTag"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."ChipTag" TO service_role;

--
-- Name: TABLE "CompetitionTarget"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."CompetitionTarget" TO service_role;

--
-- Name: TABLE "Contact"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Contact" TO service_role;

--
-- Name: TABLE "Covering"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Covering" TO service_role;

--
-- Name: TABLE "DailyJournal"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."DailyJournal" TO service_role;

--
-- Name: TABLE "DailyLoad"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."DailyLoad" TO service_role;

--
-- Name: TABLE "Document"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Document" TO service_role;

--
-- Name: TABLE "Event"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Event" TO service_role;

--
-- Name: TABLE "FarmBookSettings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."FarmBookSettings" TO service_role;

--
-- Name: TABLE "FarmCaretaker"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."FarmCaretaker" TO service_role;

--
-- Name: TABLE "FarmInspection"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."FarmInspection" TO service_role;

--
-- Name: TABLE "FeedingLog"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."FeedingLog" TO service_role;

--
-- Name: TABLE "FeedingPlan"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."FeedingPlan" TO service_role;

--
-- Name: TABLE "Foaling"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Foaling" TO service_role;

--
-- Name: TABLE "FoalingWatch"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."FoalingWatch" TO service_role;

--
-- Name: TABLE "HealthEvent"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."HealthEvent" TO service_role;

--
-- Name: TABLE "Horse"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Horse" TO service_role;

--
-- Name: TABLE "HorseAccess"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."HorseAccess" TO service_role;

--
-- Name: TABLE "IdentificationIncident"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."IdentificationIncident" TO service_role;

--
-- Name: TABLE "Invoice"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Invoice" TO service_role;

--
-- Name: TABLE "InvoiceLine"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."InvoiceLine" TO service_role;

--
-- Name: TABLE "InvoiceSeries"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."InvoiceSeries" TO service_role;

--
-- Name: TABLE "LimbCheck"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."LimbCheck" TO service_role;

--
-- Name: TABLE "Macrocycle"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Macrocycle" TO service_role;

--
-- Name: TABLE "MareReproProfile"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."MareReproProfile" TO service_role;

--
-- Name: TABLE "Membership"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Membership" TO service_role;

--
-- Name: TABLE "Mesocycle"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Mesocycle" TO service_role;

--
-- Name: TABLE "Microcycle"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Microcycle" TO service_role;

--
-- Name: TABLE "Movement"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Movement" TO service_role;

--
-- Name: TABLE "NutritionBaseline"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."NutritionBaseline" TO service_role;

--
-- Name: TABLE "NutritionPrescription"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."NutritionPrescription" TO service_role;

--
-- Name: TABLE "Payment"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Payment" TO service_role;

--
-- Name: TABLE "PregnancyCheck"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."PregnancyCheck" TO service_role;

--
-- Name: TABLE "Product"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Product" TO service_role;

--
-- Name: TABLE "ReproExam"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."ReproExam" TO service_role;

--
-- Name: TABLE "ReproSettings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."ReproSettings" TO service_role;

--
-- Name: TABLE "ReproductionCycle"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."ReproductionCycle" TO service_role;

--
-- Name: TABLE "SemenBatch"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."SemenBatch" TO service_role;

--
-- Name: TABLE "Session"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Session" TO service_role;

--
-- Name: TABLE "Task"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Task" TO service_role;

--
-- Name: TABLE "Tenant"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."Tenant" TO service_role;

--
-- Name: TABLE "TrainingSession"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."TrainingSession" TO service_role;

--
-- Name: TABLE "User"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."User" TO service_role;

--
-- Name: TABLE "VerifactuRecord"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."VerifactuRecord" TO service_role;

--
-- Name: TABLE "VerificationToken"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."VerificationToken" TO service_role;

--
-- Name: TABLE "VeterinaryProfile"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."VeterinaryProfile" TO service_role;

--
-- Name: TABLE "WeatherForecast"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."WeatherForecast" TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- PostgreSQL database dump complete
--
