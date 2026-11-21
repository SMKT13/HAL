package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Set;

/** Pure tests for disallowing unsupported INR claims in Gemini prose. */
public final class AiNumericClaimGuardTest {
    private static int checks;
    private static void check(boolean yes) {
        checks++;if(!yes)throw new AssertionError("Numeric claim test "+checks);
    }
    private static void rejected(JSONObject response,JSONObject evidence)throws Exception {
        boolean threw=false;
        try{AiNumericClaimGuard.validate(response,evidence);}
        catch(Exception expected){threw=true;}
        check(threw);
    }
    private static JSONObject response(String conclusion)throws Exception {
        return new JSONObject().put("conclusion",conclusion)
          .put("supportingEvidence",new JSONArray())
          .put("contraryEvidence",new JSONArray())
          .put("riskWarnings",new JSONArray())
          .put("nextReview",new JSONArray())
          .put("limitations",new JSONArray())
          .put("positionImplications","");
    }
    public static void main(String[]args)throws Exception {
        JSONObject marketOnly=new JSONObject().put("portfolioIncluded",false)
            .put("market",new JSONObject().put("spot",new JSONObject().put("price",5020.50)));
        check(AiNumericClaimGuard.approvedMoney(marketOnly).contains("5020.5"));
        AiNumericClaimGuard.validate(response("The verified cash quote was ₹5,020.50."),marketOnly);
        check(true);
        rejected(response("Expected guaranteed return of ₹999,999."),marketOnly);
        rejected(response("Position loss ₹10,000."),marketOnly);
        JSONObject permitted=new JSONObject().put("portfolioIncluded",true)
            .put("market",new JSONObject().put("spot",new JSONObject().put("price",5020.50)))
            .put("portfolio",new JSONObject().put("legs",new JSONArray().put(
                new JSONObject().put("entry",4927.35).put("lots",2).put("lotSize",150))))
            .put("valuation",new JSONObject().put("net",-5650.50))
            .put("risk",new JSONObject().put("futureUnits",300).put("coveredUnits",300));
        AiNumericClaimGuard.validate(response("Saved net value is -₹5,650.50 (verify marks)."),permitted);
        check(true);
        rejected(response("Exposure costs ₹300."),permitted); // futureUnits is not money
        rejected(response("Guaranteed gain ₹5.00 lakh."),permitted);
        rejected(response("Estimated proceeds INR 5 crore."),permitted);
        rejected(response("The model estimates ₹15,000 future gains."),permitted);
        JSONObject listAnswer=response("Based only on approved values.");
        listAnswer.put("riskWarnings",new JSONArray().put("Unknown additional ₹20,000 margin requirement."));
        rejected(listAnswer,permitted);
        JSONObject technical=new JSONObject().put("portfolioIncluded",false)
            .put("technical",new JSONObject().put("support",new JSONArray().put(4875.50))
                .put("resistance",new JSONArray().put(5100))
                .put("pivots",new JSONObject().put("r1",5060.25)));
        AiNumericClaimGuard.validateFreeForm("Verified support ₹4,875.50 and R1 ₹5,060.25.",technical);
        check(true);
        rejected(response("The upside target is ₹4,900."),technical);
        boolean specialistRejected=false;
        try{AiNumericClaimGuard.validateFreeForm("Potential gains INR 35,000.",technical);}
        catch(Exception expected){specialistRejected=true;}
        check(specialistRejected);
        System.out.println("PASS "+checks+" approved-amount and hallucination guards");
    }
}
