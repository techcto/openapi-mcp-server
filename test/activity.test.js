import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { trackRequest } from '../src/utils/activity.js';

test('activity records only allowlisted metadata and never request or response bodies', () => {
  const lines = [], original = console.log;
  console.log = line => lines.push(JSON.parse(line));
  try {
    const res = new EventEmitter();res.statusCode=200;
    trackRequest({headers:{authorization:'secret-bearer'},body:{method:'tools/call',params:{name:'read-website',arguments:{secret:'private-content'}}}},res,new Map([['read-website',{}]]),'streamable-http');
    res.emit('finish');
    assert.equal(lines.length,2);assert.equal(lines[0].tool,'read-website');assert.equal(lines[1].status,'200');
    assert.equal(lines[0].request_id,lines[1].request_id);
    const output=JSON.stringify(lines);assert.ok(!output.includes('secret-bearer'));assert.ok(!output.includes('private-content'));assert.ok(!output.includes('arguments'));
  } finally {console.log=original;}
});

test('unknown methods and tools cannot inject arbitrary values into activity', () => {
  const lines=[], original=console.log;console.log=line=>lines.push(JSON.parse(line));
  try {trackRequest({body:{method:'private-password',params:{name:'private-token'}}},new EventEmitter(),new Map(),'streamable-http');assert.equal(lines[0].method,'unknown');assert.equal(lines[0].tool,undefined);} finally {console.log=original;}
});
