import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { readMapping, validateHorarios, validateIdentity, validateNoStaleFallback } from './validate-horarios.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const payload = JSON.parse(readFileSync(new URL('../data/horarios.json', import.meta.url), 'utf8'));
const { codes, year } = readMapping(html);

test('o arquivo publicado corresponde aos códigos e datas das duas visualizações', () => {
  assert.deepEqual(validateHorarios(payload, codes, year), []);
  assert.deepEqual(validateNoStaleFallback(html), []);
});

test('a validação rejeita uma aula sem código e datas', () => {
  const changed = structuredClone(payload);
  changed.AIA.phases[0].schedule.push({ d: 'Sábado', c: 'NOVA', n: 'Nova disciplina', p: 'Pendente' });
  assert.match(validateHorarios(changed, codes, year).join('\n'), /AIA 2ª Fase Sábado: código\/datas ausentes/);
});

test('a validação rejeita datas inválidas no mapeamento', () => {
  const changed = structuredClone(codes);
  changed.ROO['1ª Fase'].dias.Segunda.dates = ['31/02'];
  assert.match(validateHorarios(payload, changed, year).join('\n'), /data inválida 31\/02/);
});

test('a validação rejeita horário embutido como fallback', () => {
  assert.match(validateNoStaleFallback("let data = { 'AIA': { phases: [] } };").join('\n'), /horários embutidos/);
});

test('o JavaScript da página tem sintaxe válida e escapa dados externos', () => {
  const start = html.indexOf('function schEsc(value)');
  const end = html.indexOf('function schIso(ddmm)', start);
  assert.ok(start >= 0 && end > start);
  const helpers = vm.runInNewContext('(() => { ' + html.slice(start, end) + ' return { schEsc, schSafeLink }; })()', { URL });
  assert.equal(helpers.schEsc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(helpers.schSafeLink('javascript:alert(1)'), '');
  assert.match(helpers.schSafeLink('https://calendar.google.com/'), /^https:/);

  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const scheduleScript = scripts.map(match => match[1]).find(source => source.includes('const SCH_WEEK'));
  assert.ok(scheduleScript);
  assert.doesNotThrow(() => new vm.Script(scheduleScript));
});

test('a sincronização exige revisão quando a disciplina troca no mesmo dia', () => {
  const changed = structuredClone(payload);
  changed.AIA.phases[0].schedule[0].c = 'OUTRA';
  assert.match(validateIdentity(changed, payload).join('\n'), /identidade da disciplina/);
});

test('a sincronização aceita correção de docente sem alterar a disciplina', () => {
  const changed = structuredClone(payload);
  changed.AIA.phases[0].schedule[0].p = 'Profa. Atualizada';
  assert.deepEqual(validateIdentity(changed, payload), []);
});
