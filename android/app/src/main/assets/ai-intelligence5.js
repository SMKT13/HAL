/* HAL Atlas AI Desk: deterministic privacy routing and priority assessment.
 * No network, trading, or persistent financial writes. */
(function(root){
'use strict';
function finite(x){return typeof x==='number'&&Number.isFinite(x);}
function classify(question,mode){
 if(mode==='research')return 'research';
 if(mode==='deliberate')return 'comprehensive';
 const q=String(question||'').toLowerCase();
 if(/\b(daily.{0,40}brief|intelligence brief|comprehensive|review everything|full review|six perspectives)\b/.test(q))return 'comprehensive';
 if(/\b(recover|recovery|lifetime|historical loss|realized|realised|charges)\b/.test(q))return 'recovery';
 if(/\b(hedge|protect|rollover|roll over|put option|uncovered|expiry gap)\b/.test(q))return 'hedge';
 if(/\b(my position|my future|my trade|my exposure|my pnl|my p&l|my option|portfolio|my risk|margin)\b/.test(q))return 'position';
 if(/\b(everything|all perspectives|whole book|full review)\b/.test(q))return 'comprehensive';
 if(/\b(news|filing|announcement|results|order book|earnings|fundamental)\b/.test(q))return 'research';
 return 'market';
}
function selectContext(packet,question,options){
 if(!packet||typeof packet!=='object')throw Error('Evidence must be prepared before AI review.');
 const mode=options&&options.mode||'copilot',kind=classify(question,mode);
 const allowed=!!(options&&options.includePortfolio)&&packet.portfolioIncluded===true&&mode!=='research';
 const financial=allowed&&['position','hedge','recovery','comprehensive'].includes(kind);
 const out={schemaVersion:4,generatedAt:packet.generatedAt||null,quoteAsOf:packet.quoteAsOf||null,portfolioIncluded:financial};
 for(const field of ['market','technical','news','fundamentals','sources']){
  if(field==='market'||field==='sources'||kind==='comprehensive'||kind==='market'&&field==='technical'||kind==='research'&&['news','fundamentals'].includes(field)||kind==='hedge'&&field==='technical'){
   if(Object.prototype.hasOwnProperty.call(packet,field))out[field]=packet[field];
  }
 }
 if(financial){
  if(!/^rev-[a-f0-9]{8,64}$/.test(packet.bookRevision||''))throw Error('Validated position revision unavailable.');
  out.bookRevision=packet.bookRevision;
  for(const key of ['portfolio','valuation','risk','funding','scenarios','coach'])if(Object.prototype.hasOwnProperty.call(packet,key))out[key]=packet[key];
  if(kind==='recovery')out.contextNote='The supplied valuation may not contain a fully reconciled lifetime recovery baseline. Do not infer it.';
 }
 // Only the public research subset is retained for unapproved/private-irrelevant questions.
 if(!financial&&!out.market)out.market={};
 return {scope:kind,evidence:out,portfolioIncluded:financial};
}
function priority(input){
 const src=input||{},risk=src.risk||{},market=src.market||{},valuation=src.valuation||{};
 const issue=String(src.integrityIssue||'').trim();
 if(issue)return {level:0,code:'DATA_INTEGRITY',title:'Verify saved financial records',detail:'The saved book needs reconciliation. A complete portfolio assessment is withheld.',reason:issue};
 if(src.hasOpenPosition===true&&valuation.complete===false)return {level:0,code:'MISSING_MARKS',title:'Position valuation needs verification',detail:'One or more required contract marks are missing; basket P&L must not be inferred.'};
 const expiry=src.verifiedExpirySessions;
 // Evaluate P1 conditions before any P2 condition. A minor coverage gap must
 // never conceal an imminent expiry review.
 if(Number.isInteger(expiry)&&expiry>=0&&expiry<=2&&src.hasContinuingFutures===true)
  return {level:1,code:'EXPIRY_IMMINENT',title:'Protection expires soon',detail:'The verified put expiry falls within two NSE trading sessions while futures exposure continues.'};
 const ratio=src.bookConfirmed===true&&finite(risk.futureUnits)&&risk.futureUnits>0&&finite(risk.uncoveredUnits)
  ?Math.max(0,risk.uncoveredUnits)/risk.futureUnits:null;
 if(ratio!=null&&ratio>=0.25)
  return {level:1,code:'COVERAGE_CRITICAL',title:'HAL hedge coverage needs review',detail:'At least 25% of futures units are not covered by eligible put quantity. Strike and expiry also matter.'};
 if(Number.isInteger(expiry)&&expiry>=3&&expiry<=5&&src.hasContinuingFutures===true)
  return {level:2,code:'EXPIRY_APPROACHING',title:'Review approaching put expiry',detail:'Protection expires within five verified NSE trading sessions.'};
 if(ratio!=null&&ratio>0)
  return {level:2,code:'COVERAGE_GAP',title:'Review partial put coverage',detail:'Some verified futures units lack eligible protective put quantity.'};
 if(Number.isInteger(src.savedExpiryCalendarDays)&&src.savedExpiryCalendarDays>=0&&
    src.savedExpiryCalendarDays<=7&&src.hasContinuingFutures===true){
  return {level:2,code:'SAVED_EXPIRY_CALENDAR_REVIEW',title:'Review recorded put expiry',
   detail:'A saved protective put approaches expiry in '+src.savedExpiryCalendarDays+
    ' calendar day(s) while futures continue. Exchange sessions, holidays and broker cutoffs are not verified.'};
 }
 const spot=market.spot||{},pct=spot.changePct;
 if(src.marketVerified===true&&finite(pct)&&Math.abs(pct)>=3)return {level:3,code:'MARKET_MOVE',title:'Material HAL market move',detail:'The verified cash-equity change exceeds the configured 3% review threshold.'};
 if(src.verifiedMaterialFiling===true)return {level:3,code:'NEW_FILING',title:'New HAL filing needs review',detail:'A material official disclosure was verified. Inspect its contents and source.'};
 return {level:4,code:'ROUTINE',title:'HAL market intelligence',detail:'No higher-priority verified event was selected. Review market trend, position and catalysts.'};
}
function sections(result){
 if(!result||typeof result!=='object')return [];
 const fields=[['conclusion','Conclusion'],['supportingEvidence','Supporting evidence'],['contraryEvidence','Contrary evidence'],['positionImplications','Position implications'],['riskWarnings','Risks'],['nextReview','What to monitor'],['limitations','Limitations']];
 return fields.filter(x=>result[x[0]]!=null).map(x=>({key:x[0],label:x[1],value:result[x[0]]}));
}
const api={classify,selectContext,priority,sections};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.HALAIIntelligence=api;
})(typeof globalThis!=='undefined'?globalThis:this);
