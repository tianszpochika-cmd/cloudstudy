const assert=require('node:assert/strict');
const previous=require('./real-chain-assert-9.cjs');
function assertEmptyChain(facts,route){
 const result=previous.assertEmptyChain(facts,route);
 assert.ok(['ready','empty'].includes(facts.bff.coursesFacet.state),route+' unfinished course facet');
 // 空目录 projection.generatedAt 为 null 属合法（无已发布版本可聚合）；
 // 有效时间以后置 facet.updatedAt 核验，由调用方归档页面实际 BFF 响应。
 assert.ok(Number.isFinite(Date.parse(facts.bff.coursesFacet.updatedAt)),route+' invalid facet updatedAt');
 return result;
}
module.exports={...previous,LEGAL_COURSE_FACETS:['ready','empty'],assertEmptyChain};
