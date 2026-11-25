import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
export const editorialTemplates=cache(():Record<string,string>=>JSON.parse(readFileSync(join(process.cwd(),'.generated/editorial.json'),'utf8')));
