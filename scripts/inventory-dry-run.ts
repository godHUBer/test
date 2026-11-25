import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lakhToRupees } from '../lib/format';

// Deliberately no database client or credentials. This command cannot import remotely.
const source = readFileSync('assets/data/inventory.json','utf8');
const inventory = JSON.parse(source);
const ids = new Set<string>();
let missingTransmissions = 0;
const records = inventory.cars.map((car: Record<string, unknown>) => {
  if (typeof car.id !== 'string' || !/^[a-z0-9-]+$/.test(car.id) || ids.has(car.id)) throw new Error('Invalid or duplicate legacy vehicle ID');
  ids.add(car.id);
  for (const key of ['year','km']) if (typeof car[key] !== 'number' || !Number.isSafeInteger(car[key]) || (car[key] as number) < 0) throw new Error(`Invalid ${key} on ${car.id}`);
  if (typeof car.priceLakh !== 'number' || car.priceLakh <= 0) throw new Error(`Invalid price on ${car.id}`);
  const rupees = lakhToRupees(String(car.priceLakh));
  const stock = `assets/img/stock/${car.id}.jpg`;
  if (!existsSync(stock)) throw new Error(`Missing stock photograph: ${car.id}`);
  if (car.transmission === null) missingTransmissions++;
  return { legacyId: car.id, existingTableKey: car.id, sourcePriceLakh: String(car.priceLakh), exactPriceRupees: rupees, proposedStatus: 'draft', needsAvailabilityReview: true, stockPhoto: stock };
});
const report = {
  dryRun: true, remoteWrites: 0, sourceHash: createHash('sha256').update(source).digest('hex'),
  sourceVerifiedOn: inventory.brand.verifiedOn, recordCount: records.length, missingTransmissions,
  strategy: 'Match existing cars by text ID; never overwrite or auto-publish. Compare existing rows after approval before a separate importer is implemented.',
  records,
};
mkdirSync('.generated',{ recursive: true });
writeFileSync('.generated/inventory-dry-run.json', JSON.stringify(report,null,2)+'\n');
console.log(`Dry run only: ${records.length} validated vehicles, ${missingTransmissions} unknown transmissions; no remote writes.`);
