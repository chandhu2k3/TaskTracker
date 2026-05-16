const { DateTime } = require('luxon');

const testZone = 'Asia/Kolkata';
const dt = DateTime.fromISO('2026-05-16T09:00:00', { zone: testZone });

console.log('Test Zone:', testZone);
console.log('ISO String:', dt.toISO());
console.log('Offset:', dt.offset);
console.log('Zone Name:', dt.zoneName);
console.log('Is valid:', dt.isValid);

if (dt.offset === 0 && testZone !== 'UTC') {
    console.error('CRITICAL: Luxon is defaulting to UTC! Timezone data is missing.');
} else {
    console.log('Luxon timezone support is working correctly.');
}
