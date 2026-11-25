import 'server-only';
import { cache } from 'react';
import { editorialTemplates as templates } from './editorial/templates';

/** Reviewed editorial copy, committed as a TypeScript module (no .html files). */
export const editorialTemplates = cache((): Record<string, string> => templates);
