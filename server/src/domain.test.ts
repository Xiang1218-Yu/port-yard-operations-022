import test from 'node:test'; import assert from 'node:assert/strict'; import { containerPlan, dashboard, gateConflicts, prioritizeTasks } from './domain.js';
test('dashboard aggregates berth, yard, gate and exception signals', () => { const data = dashboard(); assert.equal(data.activeVoyages, 2); assert.ok(data.yardUtilization > 0.7); assert.ok(data.blockedTasks >= 1); });
test('gate conflict engine detects same truck overlap', () => { const conflicts = gateConflicts(); assert.ok(conflicts.some(item => item.appointmentId === 'APT-9001' || item.appointmentId === 'APT-9004')); });
test('yard planner respects reefer and hazmat constraints', () => { const plan = containerPlan('TGHU-9831204'); assert.equal(plan?.recommendedBlock?.hazmatAllowed, true); assert.ok(plan?.reasons.some(reason => reason.includes('危险品'))); });
test('priority queue promotes customs inspection work', () => { const tasks = prioritizeTasks(); assert.equal(tasks[0].containerId, 'TGHU-9831204'); });

test('container register supports combined filters for duty workflows', async () => {
  const { filterContainers } = await import('./domain.js');
  const reeferInspection = filterContainers({ reefer: 'yes', customs: 'inspection' });
  assert.deepEqual(reeferInspection.map(item => item.id), ['TEMU-1774029']);
  const searched = filterContainers({ search: 'mscu-48', voyageId: 'VOY-AX7', direction: 'import' });
  assert.deepEqual(searched.map(item => item.id), ['MSCU-4829017']);
  const hazmatHold = filterContainers({ hazmat: 'yes', status: 'hold' });
  assert.deepEqual(hazmatHold.map(item => item.id), ['TGHU-9831204']);
  const withAppointment = filterContainers({ appointment: 'yes' });
  assert.ok(withAppointment.length > 0 && withAppointment.every(item => item.appointmentId));
  const withoutAppointment = filterContainers({ appointment: 'no' });
  assert.ok(withoutAppointment.every(item => !item.appointmentId));
  assert.equal(filterContainers({ status: 'released', customs: 'hold' }).length, 0);
  assert.equal(filterContainers({}).length, filterContainers({ search: '  ' }).length);
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
