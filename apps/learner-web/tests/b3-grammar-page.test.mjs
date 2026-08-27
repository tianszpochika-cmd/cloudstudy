import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, appRoot), "utf8");

test("B3 Web grammar renders a text input when a fill-blank exercise has no options", async () => {
  const source = await read("src/pages/B3GrammarPage.vue");
  assert.match(
    source,
    /selectedExercise\.type === 'FILL_BLANK' && selectedExercise\.options\.length > 0 \? 'FILL_BLANK' :/u,
  );
  assert.match(
    source,
    /selectedExercise\.type === 'FILL_BLANK' && selectedExercise\.options\.length === 0/u,
  );
  assert.match(source, /填写空格后提交，由服务端规则判定/u);
  assert.match(
    source,
    /item\.nodeId === blockId \|\| item\.role\.toLowerCase\(\) === blockId\.toLowerCase\(\)/u,
  );
  assert.match(source, /blockLabel\(nodeId\)/u);
});

test("B3 Web grammar persists selected content, sentence drafts, and exercise answers for refresh recovery", async () => {
  const page = await read("src/pages/B3GrammarPage.vue");
  const store = await read("src/stores/b10.ts");
  assert.match(page, /store\.grammarBlockOrder\(/u);
  assert.match(page, /store\.saveGrammarBlockOrder\(/u);
  assert.match(page, /store\.grammarImitationSlots\(/u);
  assert.match(page, /store\.saveGrammarImitationSlots\(/u);
  assert.match(page, /store\.grammarExerciseAnswer\(/u);
  assert.match(page, /store\.saveGrammarExerciseAnswer\(/u);
  assert.match(store, /grammar-drafts/u);
  assert.match(store, /selectedGrammarPointId/u);
  assert.match(store, /exerciseAnswers/u);
});

test("B3 mobile grammar persists the selected point and sentence construction drafts", async () => {
  const source = await read(
    new URL(
      "../../mobile/src/pages/b3-grammar/b3-grammar.vue",
      import.meta.url,
    ),
  );
  assert.match(source, /yx\.b10\.mobile\.grammar-draft\.v1/u);
  assert.match(source, /selectedPointId/u);
  assert.match(source, /blockOrders/u);
  assert.match(source, /slotValues/u);
  assert.match(source, /watch\(blockOrder/u);
  assert.match(source, /watch\(slotValues/u);
});
