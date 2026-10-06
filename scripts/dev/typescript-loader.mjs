import { readFile } from 'node:fs/promises';
import ts from 'typescript';

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:') || !url.endsWith('.ts')) return nextLoad(url, context);
  const result = ts.transpileModule(await readFile(new URL(url), 'utf8'), {
    fileName: new URL(url).pathname,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true
  });
  const errors = (result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new SyntaxError(errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
  return { format: 'module', source: result.outputText, shortCircuit: true };
}
