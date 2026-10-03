import test from 'node:test'; import assert from 'node:assert/strict'; import { containerPlan, dashboard, filterContainers, gateConflicts, prioritizeTasks } from './domain.js';
test('dashboard aggregates berth, yard, gate and exception signals', () => { const data = dashboard(); assert.equal(data.activeVoyages, 2); assert.ok(data.yardUtilization > 0.7); assert.ok(data.blockedTasks >= 1); });
test('gate conflict engine detects same truck overlap', () => { const conflicts = gateConflicts(); assert.ok(conflicts.some(item => item.appointmentId === 'APT-9001' || item.appointmentId === 'APT-9004')); });
test('yard planner respects reefer and hazmat constraints', () => { const plan = containerPlan('TGHU-9831204'); assert.equal(plan?.recommendedBlock?.hazmatAllowed, true); assert.ok(plan?.reasons.some(reason => reason.includes('危险品'))); });
test('priority queue promotes customs inspection work', () => { const tasks = prioritizeTasks(); assert.equal(tasks[0].containerId, 'TGHU-9831204'); });

test('container filter supports text search on container id', () => {
  const result = filterContainers({ q: 'msCU-48' });
  assert.deepEqual(result.map(item => item.id), ['MSCU-4829017']);
});

test('container filter combines voyage, direction, status and customs conditions', () => {
  const byVoyage = filterContainers({ voyageId: 'VOY-QF2' });
  assert.ok(byVoyage.length >= 2 && byVoyage.every(item => item.voyageId === 'VOY-QF2'));
  const held = filterContainers({ direction: 'transshipment', status: 'hold', customs: 'inspection' });
  assert.deepEqual(held.map(item => item.id), ['TGHU-9831204']);
  assert.deepEqual(filterContainers({ voyageId: 'VOY-AX7', customs: 'inspection', status: 'in-yard' }).map(item => item.id), ['TEMU-1774029']);
});

test('container filter handles priority, reefer, hazmat and appointment flags', () => {
  assert.ok(filterContainers({ priority: 'reefer' }).every(item => item.priority === 'reefer'));
  assert.deepEqual(filterContainers({ reefer: 'yes', customs: 'inspection' }).map(item => item.id), ['TEMU-1774029']);
  assert.ok(filterContainers({ reefer: 'no' }).every(item => !item.reefer));
  assert.deepEqual(filterContainers({ hazmat: 'yes' }).map(item => item.id), ['TGHU-9831204']);
  assert.ok(filterContainers({ hazmat: 'no' }).every(item => !item.hazmatClass));
  assert.deepEqual(filterContainers({ appointment: 'linked' }).map(item => item.id), ['OOLU-7734201']);
  assert.ok(filterContainers({ appointment: 'unlinked' }).every(item => !item.appointmentId));
  assert.equal(filterContainers({ q: '不存在', reefer: 'yes' }).length, 0);
});

test('container create, update and delete form a complete audited CRUD cycle', async () => {
  const { createContainer, updateContainer, deleteContainer, containers } = await import('./domain.js');
  const created = createContainer({ id: 'TEST-CRUD-0001', voyageId: 'VOY-AX7', size: '20', isoType: '22G1', direction: 'import', status: 'in-yard', weightT: 10, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R11-T1' });
  assert.equal(created.id, 'TEST-CRUD-0001');
  assert.equal(updateContainer(created.id, { weightT: 12 })?.weightT, 12);
  assert.equal(deleteContainer(created.id)?.id, 'TEST-CRUD-0001');
  assert.equal(containers.some(item => item.id === 'TEST-CRUD-0001'), false);
});

test('appointment and task domain operations support create, update and delete', async () => {
  const { createGateAppointment, editGateAppointment, deleteGateAppointment, createYardTask, updateYardTask, deleteYardTask } = await import('./domain.js');
  const appointment = createGateAppointment({ containerId: 'MSCU-4829017', truckNo: 'TEST-CRUD-01', driver: '测试司机', type: 'pickup', windowStart: new Date(Date.now()+3600000).toISOString(), windowEnd: new Date(Date.now()+7200000).toISOString(), lane: 'north' });
  assert.equal(editGateAppointment(appointment.id, { driver: '更新司机' })?.driver, '更新司机');
  assert.equal(deleteGateAppointment(appointment.id)?.id, appointment.id);
  const task = createYardTask({ kind: 'deliver', containerId: 'MSCU-4829017', from: 'A01-R01-T1', to: '南闸口', priority: 40, scheduledAt: new Date().toISOString(), estimatedMinutes: 12 });
  assert.equal(updateYardTask(task.id, { to: '北闸口' })?.to, '北闸口');
  assert.equal(deleteYardTask(task.id)?.id, task.id);
});
