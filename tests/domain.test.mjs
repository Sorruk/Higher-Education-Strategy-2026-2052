import assert from 'node:assert/strict';
import { test } from 'node:test';
import { achievement,isOverdue,targetNumber,csvCell } from '../lib/domain.ts';
import fs from 'node:fs';
const seed=JSON.parse(fs.readFileSync(new URL('../lib/seed.json',import.meta.url),'utf8'));
test('missing facts are not zeros, dash and all are not numeric goals',()=>{assert.equal(achievement(null,'17'),null);assert.equal(achievement(0,'17'),0);assert.equal(targetNumber('-'),null);assert.equal(targetNumber('Hemmesi'),null);assert.equal(achievement(10,'0'),null);assert.equal(achievement(5,'10'),50);});
test('unknown and completed actions cannot be marked overdue',()=>{for(const status of ['unknown','completed'])assert.equal(isOverdue({status,due_date:'2026-01-01'},'2026-11-08'),false);assert.equal(isOverdue({status:'in_progress',due_date:'2026-01-01'},'2026-11-08'),true);assert.equal(isOverdue({status:'in_progress',due_date:'2026-11-08'},'2026-11-08'),false);assert.equal(isOverdue({status:'planned',archived:1,due_date:'2026-01-01'},'2026-11-08'),false);});
test('source import preserves exact count, null facts and nonnumeric targets',{skip:seed.actions.length===0},()=>{assert.equal(seed.actions.length,37);assert.equal(seed.indicators.length,34);assert.equal(seed.targets.length,170);assert.ok(seed.actions.every(a=>a.status==='unknown'&&a.progress===null));assert.equal(seed.targets.find(t=>t.id==='kpi-12-2026').value,'1');assert.equal(seed.targets.find(t=>t.id==='kpi-26-2030').value,'Hemmesi');assert.equal(new Set(seed.targets.map(t=>t.id)).size,170);});
test('export escapes spreadsheet formulas and quotes',()=>{assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('a"b'),'"a""b"');assert.equal(csvCell(null),'""');});
