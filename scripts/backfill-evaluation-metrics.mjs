#!/usr/bin/env node

import 'dotenv/config';
import mongoose from 'mongoose';
import { dbConnect } from '../lib/db.js';
import Evaluation from '../models/Evaluation.js';

const FIELD_MAPPINGS = [
  { target: 'hourmeterCurrent', keys: ['horometro_actual', 'hourmeter_actual', 'hourmeter', 'horometro'] },
  { target: 'odometerCurrent', keys: ['odometro_actual', 'odometro', 'odometer', 'kilometraje'] },
  { target: 'fuelLevelBefore', keys: ['combustible_anterior', 'fuel_level_before', 'nivel_combustible_previo'] },
  { target: 'fuelLevelAfter', keys: ['combustible_actual', 'fuel_level_after', 'nivel_combustible'] },
  { target: 'fuelAddedLiters', keys: ['combustible_cargado', 'litros_cargados', 'fuel_added', 'fuelAddedLiters'] },
  { target: 'energyAddedKwh', keys: ['energia_cargada', 'kwh_cargados', 'energy_added', 'energyAddedKwh'] },
  { target: 'adblueAddedLiters', keys: ['adblue_cargado', 'adblue_litros', 'adblueAddedLiters'] },
  { target: 'batteryLevelBefore', keys: ['bateria_anterior', 'battery_level_before'] },
  { target: 'batteryLevelAfter', keys: ['bateria_actual', 'battery_level_after'] }
];

const RESPONSE_KEY_ALIASES = {
  hourmeterCurrent: ['horometro_actual', 'hourmeter_actual', 'hourmeter'],
  odometerCurrent: ['odometro_actual', 'odometro', 'odometer'],
  fuelAddedLiters: ['combustible_cargado', 'litros_cargados', 'fuel_added', 'fuelAddedLiters'],
  energyAddedKwh: ['energia_cargada', 'kwh_cargados', 'energy_added', 'energyAddedKwh'],
  adblueAddedLiters: ['adblue_cargado', 'adblue_litros', 'adblueAddedLiters']
};

function toNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function valueFromObject(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const parsed = toNumber(obj[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function valueFromResponses(responses, keys) {
  if (!Array.isArray(responses) || responses.length === 0) return null;
  for (const key of keys) {
    const match = responses.find((item) => item?.itemKey === key);
    if (!match) continue;
    const parsed = toNumber(match.value);
    if (parsed !== null) return parsed;
  }
  return null;
}

async function backfill() {
  await dbConnect();
  const equipmentIds = await Evaluation.distinct('equipment');
  let processed = 0;
  let updated = 0;

  for (const equipmentId of equipmentIds) {
    const evaluations = await Evaluation.find({ equipment: equipmentId }).sort({ completedAt: 1, createdAt: 1 }).lean();
    let lastHour = null;
    let lastOdo = null;

    for (const evaluation of evaluations) {
      processed += 1;
      const update = {};
      const formData = evaluation.formData || {};
      const templateValues = evaluation.templateValues || {};
      const responses = evaluation.responses || [];

      for (const mapping of FIELD_MAPPINGS) {
        const existing = evaluation[mapping.target];
        const parsedExisting = toNumber(existing);

        const fromForm = valueFromObject(formData, mapping.keys);
        const fromTemplate = valueFromObject(templateValues, mapping.keys);
        const responseKeys = RESPONSE_KEY_ALIASES[mapping.target] || [];
        const fromResponses = valueFromResponses(responses, [...mapping.keys, ...responseKeys]);

        let nextValue = parsedExisting;
        if (nextValue === null) {
          nextValue = fromForm ?? fromTemplate ?? fromResponses ?? null;
        }

        if (nextValue !== null && (parsedExisting === null || parsedExisting !== nextValue)) {
          update[mapping.target] = nextValue;
        }
      }

      const hourCurrent = update.hourmeterCurrent ?? toNumber(evaluation.hourmeterCurrent);
      if (hourCurrent !== null) {
        if (lastHour !== null && hourCurrent >= lastHour) {
          if (evaluation.hourmeterPrevious !== lastHour) {
            update.hourmeterPrevious = lastHour;
          }
          const delta = hourCurrent - lastHour;
          if (evaluation.hourmeterDelta !== delta) {
            update.hourmeterDelta = delta;
          }
        }
        lastHour = hourCurrent;
      }

      const odometerCurrent = update.odometerCurrent ?? toNumber(evaluation.odometerCurrent);
      if (odometerCurrent !== null) {
        if (lastOdo !== null && odometerCurrent >= lastOdo) {
          if (evaluation.odometerPrevious !== lastOdo) {
            update.odometerPrevious = lastOdo;
          }
          const delta = odometerCurrent - lastOdo;
          if (evaluation.odometerDelta !== delta) {
            update.odometerDelta = delta;
          }
        }
        lastOdo = odometerCurrent;
      }

      if (evaluation.skipChecklist === undefined) {
        update.skipChecklist = false;
      }

      if (Object.keys(update).length > 0) {
        await Evaluation.updateOne({ _id: evaluation._id }, { $set: update });
        updated += 1;
      }
    }
  }

  console.log(`Backfill completado. Evaluaciones revisadas: ${processed}. Evaluaciones actualizadas: ${updated}.`);
}

backfill()
  .catch((err) => {
    console.error('Error ejecutando backfill', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
