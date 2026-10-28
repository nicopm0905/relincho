import { test } from "node:test";
import assert from "node:assert/strict";

import * as engine from "@/lib/incidents";
import {
  IncidentError,
  acknowledge,
  addUpdate,
  escalationDue,
  followUp,
  markRead,
  openIncident,
  resolve,
  type Incident,
} from "@/lib/incidents";

const t0 = new Date("2026-11-02T09:00:00Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

const mozo = { membershipId: "m-mozo", role: "GROOM" };
const encargado = { membershipId: "m-encargado", role: "MANAGER" };
const propietaria = { membershipId: "m-propietaria", role: "OWNER_EXTERNAL" };
const copropietario = { membershipId: "m-copropietario", role: "OWNER_EXTERNAL" };

const nueva = (over: Partial<Parameters<typeof openIncident>[0]> = {}) =>
  openIncident({
    createdBy: mozo,
    owners: [propietaria, copropietario],
    category: "EQUIPMENT",
    severity: "LOW",
    description: "Manta rota por el cierre del pecho",
    at: t0,
    ...over,
  });

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof IncidentError, `esperaba IncidentError, llegó ${String(err)}`);
    return err.code;
  }
  assert.fail("esperaba un error");
};

test("una incidencia nueva queda OPEN y exige confirmación de todos los propietarios del caballo", () => {
  const { incident } = nueva();
  assert.equal(incident.status, "OPEN");
  assert.deepEqual(
    incident.receipts.map((r) => [r.membershipId, r.readAt, r.acknowledgedAt]),
    [
      ["m-propietaria", null, null],
      ["m-copropietario", null, null],
    ],
  );
});

test("abrir la incidencia marca readAt pero no la confirma", () => {
  const leida = markRead(nueva().incident, "m-propietaria", later(5));
  const r = leida.receipts.find((x) => x.membershipId === "m-propietaria");
  assert.deepEqual(r?.readAt, later(5));
  assert.equal(r?.acknowledgedAt, null);
  assert.equal(leida.status, "OPEN");
  // Leerla dos veces conserva la primera hora de lectura.
  assert.deepEqual(markRead(leida, "m-propietaria", later(30)).receipts[0]?.readAt, later(5));
});

test("cuando confirma el último propietario, pasa a ACKNOWLEDGED", () => {
  const una = acknowledge(nueva().incident, "m-propietaria", later(10));
  assert.equal(una.status, "OPEN");
  const dos = acknowledge(una, "m-copropietario", later(20));
  assert.equal(dos.status, "ACKNOWLEDGED");
  // Confirmar implica haberla leído.
  assert.deepEqual(dos.receipts.find((r) => r.membershipId === "m-copropietario")?.readAt, later(20));
  // Quien no es destinatario no puede confirmar.
  assert.equal(code(() => acknowledge(una, "m-ajeno", later(15))), "NOT_RECIPIENT");
});

test("una incidencia grave sin confirmar a las 2 horas vence para escalado; una leve no escala", () => {
  const grave = nueva({ category: "COLIC_SIGNS", severity: "HIGH" }).incident;
  assert.equal(escalationDue(grave, later(119)), false);
  assert.equal(escalationDue(grave, later(120)), true);
  assert.equal(escalationDue({ ...grave, escalatedAt: later(120) }, later(180)), false, "solo una vez");
  assert.equal(escalationDue(acknowledge(acknowledge(grave, "m-propietaria", later(30)), "m-copropietario", later(40)), later(180)), false);
  assert.equal(escalationDue(nueva().incident, later(24 * 60)), false);
});

test("solo el personal del centro puede resolverla; el propietario no", () => {
  const abierta = nueva().incident;
  assert.equal(code(() => resolve(abierta, propietaria, later(60), "La cosemos")), "FORBIDDEN");
  const resuelta = resolve(abierta, encargado, later(60), "Manta cambiada por la de repuesto");
  assert.equal(resuelta.status, "RESOLVED");
  assert.deepEqual(resuelta.resolvedAt, later(60));
  assert.equal(resuelta.resolutionNote, "Manta cambiada por la de repuesto");
});

test("de RESOLVED no se vuelve a OPEN: se abre otra enlazada", () => {
  const resuelta = resolve(nueva().incident, mozo, later(60), "Arreglada");
  assert.equal(code(() => resolve(resuelta, mozo, later(62), "otra vez")), "INVALID_TRANSITION");
  assert.equal(code(() => acknowledge(resuelta, "m-propietaria", later(62))), "INVALID_TRANSITION");
  const seguimiento = followUp(resuelta, {
    createdBy: mozo,
    owners: [propietaria],
    description: "Se ha vuelto a romper",
    at: later(24 * 60),
  });
  assert.equal(seguimiento.incident.status, "OPEN");
  assert.equal(seguimiento.incident.followsId, resuelta.id);
  assert.equal(resuelta.status, "RESOLVED");
});

test("si el caballo no tiene propietarios con cuenta, se avisa al centro de que hay que llamar", () => {
  const sinCuenta = nueva({ owners: [] });
  assert.equal(sinCuenta.callOwner, true);
  assert.deepEqual(sinCuenta.incident.receipts, []);
  assert.equal(nueva().callOwner, false);
});

test("la descripción no se edita tras crearla; las correcciones van como actualización con autor y hora", () => {
  const original = nueva().incident;
  const corregida = addUpdate(original, encargado, "Corrijo: es la manta de invierno, no la de paddock", later(15));
  assert.equal(corregida.description, original.description);
  assert.deepEqual(corregida.updates, [
    { authorMembershipId: "m-encargado", text: "Corrijo: es la manta de invierno, no la de paddock", at: later(15) },
  ]);
  // El motor no ofrece ninguna forma de reescribir la descripción.
  assert.equal(Object.keys(engine).some((k) => /edit|setDescription|update(Description)?$/i.test(k) && k !== "addUpdate"), false);
});

// Para que TypeScript compruebe que Incident es el tipo público del motor.
export type _Incident = Incident;
