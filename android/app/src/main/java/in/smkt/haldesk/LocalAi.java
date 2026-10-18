package in.smkt.haldesk;

import com.google.ai.edge.litertlm.Backend;
import com.google.ai.edge.litertlm.Conversation;
import com.google.ai.edge.litertlm.ConversationConfig;
import com.google.ai.edge.litertlm.Engine;
import com.google.ai.edge.litertlm.EngineConfig;
import com.google.ai.edge.litertlm.SamplerConfig;
import com.google.ai.edge.litertlm.ThinkingConfig;
import java.io.File;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;

/** No HTTP client, account, API key or remote fallback. Inference is CPU-local. */
final class LocalAi {
    private volatile Conversation running;
    private final AtomicBoolean cancelled=new AtomicBoolean(false);
    void prepare(){cancelled.set(false);}
    void cancel(){cancelled.set(true);Conversation c=running;if(c!=null)try{c.cancelProcess();}catch(Exception ignored){}}
    String generate(File model,File cache,String prompt)throws Exception {
        if(cancelled.get())throw new Exception("Local review cancelled.");
        EngineConfig config=new EngineConfig(model.getAbsolutePath(),new Backend.CPU(4,null),null,null,4096,null,cache.getAbsolutePath(),null);
        try(Engine engine=new Engine(config)){
            engine.initialize();
            if(cancelled.get())throw new Exception("Local review cancelled.");
            ConversationConfig conversationConfig=new ConversationConfig(null,Collections.emptyList(),Collections.emptyList(),new SamplerConfig(20,.9,.2,42),false,Collections.emptyList(),Collections.emptyMap(),null,false,512,new ThinkingConfig(false,0));
            try(Conversation conversation=engine.createConversation(conversationConfig)){
                running=conversation;
                if(cancelled.get())throw new Exception("Local review cancelled.");
                String answer=conversation.sendMessage(prompt).toString();
                if(cancelled.get())throw new Exception("Local review cancelled.");
                if(answer==null||answer.trim().isEmpty())throw new Exception("The local model returned no answer. Try a shorter question.");
                return answer.trim();
            } finally {running=null;}
        }
    }
}
