import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const siteRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultHtml = resolve(siteRoot, 'index.html');
const defaultJson = resolve(siteRoot, 'data/horarios.json');

export function readMapping(html) {
  const start = html.indexOf('const SCH_WEEK = {');
  const end = html.indexOf('// Paletas validadas', start);
  const year = html.match(/const SCH_YEAR = (\d{4});/);
  if (start < 0 || end < start || !year) {
    throw new Error('Mapeamento ou ano letivo dos horários não encontrado em index.html');
  }
  const expression = `(() => { ${html.slice(start, end)} return SCH_CODES; })()`;
  return { codes: vm.runInNewContext(expression, {}, { timeout: 1000 }), year: Number(year[1]) };
}

function validDate(value, year) {
  if (typeof value !== 'string' || !/^\d{2}\/\d{2}$/.test(value)) return false;
  const [day, month] = value.split('/').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateHorarios(payload, codes, year) {
  const errors = [];
  const campusKeys = ['AIA', 'ROO'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['O arquivo de horários deve ser um objeto com AIA e ROO.'];
  }
  for (const campus of campusKeys) {
    const entry = payload[campus];
    const mapped = codes[campus];
    if (!entry || !Array.isArray(entry.phases) || !mapped) {
      errors.push(`${campus}: câmpus, fases ou mapeamento ausente.`);
      continue;
    }
    const labels = entry.phases.map(phase => phase.label);
    if (new Set(labels).size !== labels.length) errors.push(`${campus}: fases duplicadas.`);
    for (const label of Object.keys(mapped)) {
      if (!labels.includes(label)) errors.push(`${campus}: mapeamento de ${label} sem fase no arquivo.`);
    }
    for (const phase of entry.phases) {
      const label = phase.label;
      const map = mapped[label];
      if (!map || !Array.isArray(phase.schedule)) {
        errors.push(`${campus} ${label}: fase ou horários semanais sem mapeamento.`);
        continue;
      }
      const days = phase.schedule.map(slot => slot.d);
      if (new Set(days).size !== days.length) errors.push(`${campus} ${label}: dia duplicado.`);
      for (const day of Object.keys(map.dias || {})) {
        if (!days.includes(day)) errors.push(`${campus} ${label}: código para ${day} sem aula correspondente.`);
      }
      for (const slot of phase.schedule) {
        const context = `${campus} ${label} ${slot.d}`;
        if (![slot.d, slot.c, slot.n, slot.p].every(value => typeof value === 'string' && value.trim())) {
          errors.push(`${context}: dia, sigla, disciplina ou docente vazio.`);
        }
        const info = map.dias?.[slot.d];
        if (!info) {
          errors.push(`${context}: código/datas ausentes no mapeamento.`);
        } else {
          validateMapping(info, context, year, errors);
        }
      }
      if (Boolean(phase.modular) !== Boolean(map.modular)) {
        errors.push(`${campus} ${label}: disciplina modular diverge do mapeamento.`);
      } else if (phase.modular) {
        validateMapping(map.modular, `${campus} ${label} modular`, year, errors);
      }
    }
  }
  for (const campus of Object.keys(payload)) {
    if (!campusKeys.includes(campus)) errors.push(`Câmpus inesperado: ${campus}.`);
  }
  return errors;
}

export function validateIdentity(payload, baseline) {
  const errors = [];
  for (const campus of ['AIA', 'ROO']) {
    const current = payload?.[campus];
    const saved = baseline?.[campus];
    if (!current || !saved || !Array.isArray(current.phases) || !Array.isArray(saved.phases)) {
      errors.push(`${campus}: não foi possível comparar com os horários publicados.`);
      continue;
    }
    if (current.name !== saved.name || current.phases.length !== saved.phases.length) {
      errors.push(`${campus}: câmpus ou conjunto de fases mudou; confira a fonte antes de publicar.`);
    }
    for (const phase of current.phases) {
      const prior = saved.phases.find(item => item.label === phase.label);
      const identity = item => JSON.stringify({
        id: item.id,
        label: item.label,
        link: item.link,
        schedule: item.schedule?.map(slot => ({ d: slot.d, c: slot.c, n: slot.n })),
        modular: item.modular && { c: item.modular.c, n: item.modular.n, d: item.modular.d },
        extras: item.extras?.map(extra => ({ c: extra.c, n: extra.n }))
      });
      if (!prior || identity(phase) !== identity(prior)) {
        errors.push(`${campus} ${phase.label}: identidade da disciplina, período ou agenda mudou; confira código e fonte antes de publicar.`);
      }
    }
  }
  return errors;
}

function validateMapping(info, context, year, errors) {
  if (typeof info.cod !== 'string' || !info.cod.trim()) errors.push(`${context}: código vazio.`);
  if (!Array.isArray(info.dates) || info.dates.length === 0) {
    errors.push(`${context}: datas ausentes.`);
    return;
  }
  if (new Set(info.dates).size !== info.dates.length) errors.push(`${context}: datas duplicadas.`);
  for (const date of info.dates) {
    if (!validDate(date, year)) errors.push(`${context}: data inválida ${date}.`);
  }
}

export function validateNoStaleFallback(html) {
  return /let data\s*=\s*\{\s*[\x27\x22]?AIA[\x27\x22]?\s*:/.test(html)
    ? ['index.html mantém horários embutidos que podem divergir do arquivo sincronizado.']
    : [];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const jsonPath = resolve(process.argv[2] || defaultJson);
  const htmlPath = resolve(process.argv[3] || defaultHtml);
  try {
    const html = readFileSync(htmlPath, 'utf8');
    const payload = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const { codes, year } = readMapping(html);
    const baseline = JSON.parse(readFileSync(defaultJson, 'utf8'));
    const errors = [...validateNoStaleFallback(html), ...validateHorarios(payload, codes, year), ...validateIdentity(payload, baseline)];
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else {
      console.log(`Horários ${year}: contrato AIA/ROO válido; sem fallback embutido.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
